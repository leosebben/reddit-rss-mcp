#!/usr/bin/env node
/**
 * reddit-rss-mcp — servidor MCP que lê o Reddit via feeds RSS (sem API key).
 * Paridade de tools com reddit-mcp-buddy; campos numéricos de popularidade
 * (score, karma, num_comments) não existem no RSS e vêm como null.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as reddit from './reddit.js';
import { explain } from './explain.js';

// --- Helpers ---------------------------------------------------------------

function postFromEntry(e) {
  return {
    id: e.id,
    title: e.title,
    author: e.author,
    score: null,
    upvote_ratio: null,
    num_comments: null,
    created: e.published,
    permalink: e.link,
    subreddit: e.subreddit,
    content: e.content ? e.content.slice(0, 1000) : '',
  };
}

function extractPostId(url) {
  const clean = url.split('?')[0].split('#')[0];
  let m = clean.match(/reddit\.com\/r\/(\w+)\/comments\/(\w+)/i);
  if (m) return { subreddit: m[1], postId: m[2] };
  m = clean.match(/redd\.it\/(\w+)/i);
  if (m) return { subreddit: undefined, postId: m[1] };
  m = clean.match(/reddit\.com\/comments\/(\w+)/i);
  if (m) return { subreddit: undefined, postId: m[1] };
  throw new Error('URL do Reddit inválida. Use reddit.com/r/<sub>/comments/<id> ou redd.it/<id>');
}

// --- Definição das tools ---------------------------------------------------

const TOOLS = [
  {
    name: 'browse_subreddit',
    description:
      'Lista posts de um subreddit via RSS. Use o nome sem "r/", "all" para todo o Reddit ou "popular" para os em alta. Observação: score/num_comments não existem no RSS (vêm null).',
    inputSchema: {
      type: 'object',
      properties: {
        subreddit: { type: 'string', description: 'Nome do subreddit sem o prefixo r/' },
        sort: { type: 'string', enum: ['hot', 'new', 'top', 'rising', 'controversial'], default: 'hot' },
        time: { type: 'string', enum: ['hour', 'day', 'week', 'month', 'year', 'all'] },
        limit: { type: 'number', minimum: 1, maximum: 100, default: 25 },
      },
      required: ['subreddit'],
    },
  },
  {
    name: 'search_reddit',
    description:
      'Busca posts no Reddit todo ou em subreddits específicos, via RSS. score/num_comments vêm null.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Termo de busca' },
        subreddits: { type: 'array', items: { type: 'string' }, description: 'Subreddits onde buscar (vazio = todo o Reddit)' },
        sort: { type: 'string', enum: ['relevance', 'hot', 'top', 'new', 'comments'], default: 'relevance' },
        time: { type: 'string', enum: ['hour', 'day', 'week', 'month', 'year', 'all'], default: 'all' },
        limit: { type: 'number', minimum: 1, maximum: 100, default: 25 },
        author: { type: 'string', description: 'Filtra por autor' },
        flair: { type: 'string', description: 'Filtra por flair' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_post_details',
    description:
      'Detalhes de um post e seus comentários, via RSS. Informe post_id (+subreddit) ou url. Comentários vêm sem score e em lista plana (RSS não fornece a árvore).',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: { type: 'string', description: 'ID do post (ex: "1abc2d3")' },
        subreddit: { type: 'string', description: 'Subreddit (opcional, mas mais eficiente com post_id)' },
        url: { type: 'string', description: 'URL completa do post (alternativa ao post_id)' },
        comment_limit: { type: 'number', minimum: 1, maximum: 500, default: 20 },
        comment_sort: { type: 'string', enum: ['best', 'top', 'new', 'controversial', 'qa'], default: 'best' },
        max_top_comments: { type: 'number', minimum: 1, maximum: 100, default: 20 },
      },
    },
  },
  {
    name: 'user_analysis',
    description:
      'Posts e comentários recentes de um usuário, com os subreddits mais frequentes. Observação: karma, cake day e idade da conta não existem no RSS (vêm null).',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'Nome do usuário no Reddit' },
        posts_limit: { type: 'number', minimum: 0, maximum: 100, default: 10 },
        comments_limit: { type: 'number', minimum: 0, maximum: 100, default: 10 },
        top_subreddits_limit: { type: 'number', minimum: 1, maximum: 50, default: 10 },
      },
      required: ['username'],
    },
  },
  {
    name: 'reddit_explain',
    description: 'Explica um termo/gíria do Reddit (ex: "karma", "cake day", "AMA").',
    inputSchema: {
      type: 'object',
      properties: { term: { type: 'string', description: 'Termo do Reddit a explicar' } },
      required: ['term'],
    },
  },
];

// --- Implementações --------------------------------------------------------

async function handleBrowse(a) {
  const entries = await reddit.browseSubreddit(a.subreddit, a.sort || 'hot', {
    limit: a.limit || 25,
    time: a.time,
  });
  return { posts: entries.map(postFromEntry), total_posts: entries.length, note: reddit.METRICS_NOTE };
}

async function handleSearch(a) {
  const subs = a.subreddits && a.subreddits.length ? a.subreddits : [undefined];
  const limitEach = Math.max(1, Math.ceil((a.limit || 25) / subs.length));
  const settled = await Promise.allSettled(
    subs.map((sub) =>
      reddit.search(a.query, { subreddit: sub, sort: a.sort, time: a.time, limit: limitEach })
    )
  );
  let entries = settled.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
  if (a.author) entries = entries.filter((e) => e.author.toLowerCase() === a.author.toLowerCase());
  if (a.flair) entries = entries.filter((e) => (e.title || '').toLowerCase().includes(a.flair.toLowerCase()));
  return { results: entries.map(postFromEntry), total_results: entries.length, note: reddit.METRICS_NOTE };
}

async function handlePost(a) {
  let subreddit = a.subreddit;
  let postId = a.post_id;
  if (a.url) ({ subreddit, postId } = extractPostId(a.url));
  if (!postId) throw new Error('Informe url OU post_id');
  const sortMap = { best: 'confidence', top: 'top', new: 'new', controversial: 'controversial', qa: 'qa' };
  const { post, comments } = await reddit.getPost({
    subreddit,
    postId,
    sort: sortMap[a.comment_sort || 'best'],
    limit: a.comment_limit || 20,
  });
  const top = comments.slice(0, a.max_top_comments || 20).map((c) => ({
    id: c.id,
    author: c.author,
    score: null,
    body: c.content ? c.content.slice(0, 500) : '',
    created: c.published,
    permalink: c.link,
  }));
  return {
    post: post ? postFromEntry(post) : null,
    total_comments: comments.length,
    top_comments: top,
    note: reddit.METRICS_NOTE,
  };
}

async function handleUser(a) {
  const result = {
    username: a.username,
    karma: null,
    account_age: null,
    note: reddit.METRICS_NOTE,
  };
  const subCount = {};
  const tally = (e) => {
    if (e.subreddit) subCount[e.subreddit] = (subCount[e.subreddit] || 0) + 1;
  };
  if ((a.posts_limit ?? 10) > 0) {
    const posts = await reddit.getUserFeed(a.username, 'submitted', { limit: a.posts_limit || 10 });
    posts.forEach(tally);
    result.recent_posts = posts.map((e) => ({
      id: e.id,
      title: e.title,
      subreddit: e.subreddit,
      created: e.published,
      permalink: e.link,
    }));
  }
  if ((a.comments_limit ?? 10) > 0) {
    const comments = await reddit.getUserFeed(a.username, 'comments', { limit: a.comments_limit || 10 });
    comments.forEach(tally);
    result.recent_comments = comments.map((e) => ({
      id: e.id,
      subreddit: e.subreddit,
      body: e.content ? e.content.slice(0, 200) : '',
      created: e.published,
      permalink: e.link,
    }));
  }
  result.top_subreddits = Object.entries(subCount)
    .sort((x, y) => y[1] - x[1])
    .slice(0, a.top_subreddits_limit || 10)
    .map(([subreddit, count]) => ({ subreddit, count }));
  return result;
}

const HANDLERS = {
  browse_subreddit: handleBrowse,
  search_reddit: handleSearch,
  get_post_details: handlePost,
  user_analysis: handleUser,
  reddit_explain: (a) => explain(a.term),
};

// --- Servidor MCP ----------------------------------------------------------

const server = new Server(
  { name: 'reddit-rss', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const handler = HANDLERS[req.params.name];
  if (!handler) throw new Error(`Tool desconhecida: ${req.params.name}`);
  try {
    const data = await handler(req.params.arguments || {});
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: `Erro: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
