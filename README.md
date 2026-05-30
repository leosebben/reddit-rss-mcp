# reddit-rss-mcp

Servidor MCP que lê o Reddit pelos feeds **RSS** públicos (`.rss`), sem precisar de API key.

## Por que existe

Em 2026 o Reddit passou a bloquear (HTTP 403) os endpoints `.json` para acesso anônimo
e fechou o cadastro self-serve de apps de API (Responsible Builder Policy). O
`reddit-mcp-buddy`, que dependia do `.json`, parou de funcionar. Os feeds `.rss`
continuam abertos — este servidor usa eles via `curl` com User-Agent de navegador.

## Tools (paridade com reddit-mcp-buddy)

| Tool | Status |
|------|--------|
| `browse_subreddit` | posts do subreddit (hot/new/top/rising) |
| `search_reddit` | busca global ou por subreddits |
| `get_post_details` | post + comentários (lista plana) |
| `user_analysis` | posts/comentários recentes + top subreddits |
| `reddit_explain` | dicionário estático de termos |

## Limitações do RSS

O RSS **não** fornece números de popularidade. Estes campos vêm sempre `null`:
`score`, `upvote_ratio`, `num_comments`, `karma`, idade da conta, e contagem de
inscritos. Comentários vêm sem score e em lista plana (sem a árvore de respostas).

## Registro no Claude Code

```bash
claude mcp add -s user reddit-rss -- node ~/Projects/reddit-rss-mcp/index.js
```
