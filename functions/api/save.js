import { getCookie, verifySessionToken, jsonResponse, SESSION_COOKIE } from '../_lib/auth.js';

// The GitHub repo this site deploys from. Set these in the Cloudflare Pages environment
// so the code never has to change when the repo moves or is renamed.
const DEFAULT_OWNER = 'ElVideoCowboy';
const DEFAULT_REPO = 'flyfitjagsaf.org';
const DEFAULT_BRANCH = 'main';

function toBase64Utf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const token = getCookie(request, SESSION_COOKIE);
  const session = await verifySessionToken(token, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: 'Invalid request body' }, 400);
  }

  const { slug, content } = body || {};
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return jsonResponse({ error: 'Invalid page slug' }, 400);
  }
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return jsonResponse({ error: 'Invalid content payload' }, 400);
  }

  const ghToken = env.GITHUB_TOKEN;
  if (!ghToken) {
    return jsonResponse({ error: 'GitHub token is not configured yet — see README.md' }, 500);
  }

  const owner = env.GITHUB_REPO_OWNER || DEFAULT_OWNER;
  const repo = env.GITHUB_REPO_NAME || DEFAULT_REPO;
  const branch = env.GITHUB_BRANCH || DEFAULT_BRANCH;

  const path = `assets/content/${slug}.json`;
  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const ghHeaders = {
    Authorization: `Bearer ${ghToken}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'flyfitjags-admin'
  };

  // GitHub's Contents API requires the current file's SHA to update it (404 is fine — new file).
  let sha = null;
  const getRes = await fetch(`${apiBase}?ref=${branch}`, { headers: ghHeaders });
  if (getRes.ok) {
    const getData = await getRes.json();
    sha = getData.sha;
  } else if (getRes.status !== 404) {
    return jsonResponse({ error: 'Could not read the current file from GitHub', detail: await getRes.text() }, 502);
  }

  const jsonString = JSON.stringify(content, null, 2) + '\n';

  const putRes = await fetch(apiBase, {
    method: 'PUT',
    headers: { ...ghHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Update ${slug} content via admin console`,
      content: toBase64Utf8(jsonString),
      branch,
      ...(sha ? { sha } : {})
    })
  });

  if (!putRes.ok) {
    return jsonResponse({ error: 'GitHub commit failed', detail: await putRes.text() }, 502);
  }

  return jsonResponse({
    ok: true,
    message: 'Saved. Cloudflare Pages will redeploy automatically — usually live within a minute.'
  });
}
