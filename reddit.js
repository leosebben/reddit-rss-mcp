/**
 * Acesso ao Reddit via feeds RSS (Atom), usando curl.
 * Os endpoints .json do Reddit retornam 403 para acesso anônimo;
 * os feeds .rss continuam públicos. Este módulo busca e faz o parse deles.
 */
import { execFile } from 'node:child_process';

const BASE = 'https://www.reddit.com';
// User-Agent de navegador: o Reddit bloqueia UAs de bibliotecas/HTTP padrão.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

// Campos numéricos de popularidade não existem no RSS. Documentado aqui uma vez.
export const METRICS_NOTE =
  'score, upvote_ratio, num_comments e karma não estão disponíveis via RSS (limitação do Reddit, não do servidor).';

function curlGet(url) {
  return new Promise((resolve, reject) => {
    execFile(
      'curl',
      ['-sS', '-A', UA, '--max-time', '25', '-w', '\n__HTTP__%{http_code}', url],
      { maxBuffer: 20 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`curl falhou: ${stderr || err.message}`));
        const idx = stdout.lastIndexOf('\n__HTTP__');
        const code = idx >= 0 ? stdout.slice(idx + 9).trim() : '000';
        const body = idx >= 0 ? stdout.slice(0, idx) : stdout;
        if (code !== '200') {
          return reject(new Error(`Reddit respondeu HTTP ${code} para ${url}`));
        }
        resolve(body);
      }
    );
  });
}

// --- Parsing de Atom -------------------------------------------------------

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#32;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&amp;/g, '&');
}

function htmlToText(html) {
  if (!html) return '';
  return decodeEntities(
    decodeEntities(html) // o conteúdo vem com entidades duplamente escapadas
      .replace(/<!--.*?-->/gs, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? m[1] : null;
}

function attr(block, name, a) {
  const m = block.match(new RegExp(`<${name}[^>]*\\b${a}="([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

/** Faz o parse de um feed Atom do Reddit numa lista de entradas normalizadas. */
function parseFeed(xml) {
  const entries = [];
  const re = /<entry\b[\s\S]*?<\/entry>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const e = m[0];
    const fullId = (tag(e, 'id') || '').trim(); // ex: t3_abc, t1_def
    const [kind, id] = fullId.includes('_') ? fullId.split('_') : [null, fullId];
    const authorName = (tag(e.match(/<author>[\s\S]*?<\/author>/i)?.[0] || '', 'name') || '')
      .replace(/^\/u\//, '')
      .trim();
    const contentHtml = tag(e, 'content') || '';
    entries.push({
      kind, // t3 = post, t1 = comentário
      id,
      title: decodeEntities((tag(e, 'title') || '').trim()),
      author: authorName,
      link: attr(e, 'link', 'href'),
      subreddit: (attr(e, 'category', 'label') || '').replace(/^r\//, '') || null,
      published: (tag(e, 'published') || tag(e, 'updated') || '').trim() || null,
      updated: (tag(e, 'updated') || '').trim() || null,
      content: htmlToText(contentHtml),
    });
  }
  return entries;
}

// --- Construção de URLs ----------------------------------------------------

function qs(params) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      parts.push(`${k}=${encodeURIComponent(v)}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

// --- API pública -----------------------------------------------------------

export async function browseSubreddit(subreddit, sort, { limit, time } = {}) {
  const url = `${BASE}/r/${encodeURIComponent(subreddit)}/${sort}.rss${qs({ limit, t: time })}`;
  const xml = await curlGet(url);
  return parseFeed(xml).filter((e) => e.kind === 't3' || !e.kind);
}

export async function search(query, { subreddit, sort, time, limit } = {}) {
  const path = subreddit ? `/r/${encodeURIComponent(subreddit)}/search.rss` : `/search.rss`;
  const url = `${BASE}${path}${qs({
    q: query,
    sort,
    t: time,
    limit,
    restrict_sr: subreddit ? 1 : undefined,
  })}`;
  const xml = await curlGet(url);
  return parseFeed(xml).filter((e) => e.kind === 't3' || !e.kind);
}

export async function getPost({ subreddit, postId, sort, limit }) {
  const path = subreddit
    ? `/r/${encodeURIComponent(subreddit)}/comments/${postId}/.rss`
    : `/comments/${postId}/.rss`;
  const url = `${BASE}${path}${qs({ sort, limit })}`;
  const xml = await curlGet(url);
  const entries = parseFeed(xml);
  const post = entries.find((e) => e.kind === 't3') || entries[0] || null;
  const comments = entries.filter((e) => e.kind === 't1');
  return { post, comments };
}

export async function getUserFeed(username, kind, { limit, sort, time } = {}) {
  // kind: 'submitted' (posts) | 'comments'
  const url = `${BASE}/user/${encodeURIComponent(username)}/${kind}.rss${qs({ limit, sort, t: time })}`;
  const xml = await curlGet(url);
  return parseFeed(xml);
}
