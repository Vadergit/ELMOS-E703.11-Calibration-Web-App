const origin = 'https://vadergit.github.io';
const endpoint = 'https://api.github.com/repos/Vadergit/ELMOS-E703.11-Calibration-Web-App/issues';
const repositoryId = '1452952381';
const attachmentEndpoint = 'https://uploads.github.com/user-attachments/assets';
const maxImage = 2 * 1024 * 1024;
const maxRequest = 3 * maxImage + 65536;
const action = 'feedback';

function json(data, status = 200) {
  return Response.json(data, { status, headers: {
    'Access-Control-Allow-Origin': origin,
    'Cache-Control': 'no-store',
  } });
}

function imageType(bytes) {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte))
    return ['png', 'image/png'];
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return ['jpg', 'image/jpeg'];
  return [];
}

async function submit(request, env) {
  const { success: allowed } = await env.SUBMISSIONS.limit({
    key: request.headers.get('CF-Connecting-IP') || 'unknown',
  });
  if (!allowed) return json({ code: 'rate' }, 429);
  const length = Number(request.headers.get('Content-Length'));
  if (!(length > 0 && length <= maxRequest)) return json({ code: 'size' }, 413);
  const form = await request.formData().catch(() => null);
  if (!form) return json({ code: 'form' }, 400);
  const field = key => typeof form.get(key) === 'string' ? form.get(key).trim() : '';
  const kind = field('kind'), title = field('title'), description = field('description');
  const version = field('version'), token = field('token');
  const files = form.getAll('images');
  if (!['bug', 'feature'].includes(kind) || title.length < 4 || title.length > 120 ||
      description.length < 10 || description.length > 5000 || field('public') !== 'yes' ||
      !token || token.length > 2048)
    return json({ code: 'form' }, 400);
  if (files.length > 3 || files.some(file => typeof file === 'string' || !file.size || file.size > maxImage))
    return json({ code: 'size' }, 413);

  const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token }),
  });
  if (!check.ok) return json({ code: 'service' }, 502);
  const verification = await check.json();
  if (!verification.success || verification.hostname !== 'vadergit.github.io' || verification.action !== action)
    return json({ code: 'challenge' }, 400);

  const images = [];
  for (const file of files) {
    const data = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const [extension, type] = imageType(data);
    if (!type || type !== file.type) return json({ code: 'type' }, 400);
    images.push({ file, type, extension });
  }
  const attachments = [];
  for (const [index, { file, type, extension }] of images.entries()) {
    const upload = new URL(attachmentEndpoint);
    upload.search = new URLSearchParams({
      repository_id: repositoryId,
      name: 'screenshot-' + (index + 1) + '.' + extension,
      content_type: type,
    });
    const result = await fetch(upload, {
      method: 'POST',
      redirect: 'error',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'token ' + env.GITHUB_ISSUES_TOKEN,
        'Content-Type': 'application/octet-stream',
        'User-Agent': 'Elmos-Calibration-Feedback',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: file,
    });
    if (result.status !== 201) return json({ code: 'attachment' }, 502);
    const asset = await result.json();
    if (!/^https:\/\/github\.com\/user-attachments\/assets\/[a-f0-9-]{36}$/i.test(asset.url))
      return json({ code: 'attachment' }, 502);
    attachments.push(asset.url);
  }
  const label = kind === 'bug' ? 'Fehler' : 'Funktionswunsch';
  // Render the visitor's text literally. Image URLs are returned by GitHub.
  const fence = '~'.repeat(Math.max(3, ...(description.match(/~+/g) || []).map(run => run.length + 1)));
  const body = [
    '**Meldung aus dem Kalibrierassistenten**',
    /^\d+\.\d+\.\d+$/.test(version) ? 'Web-App: v' + version : '',
    fence + 'text\n' + description + '\n' + fence,
    ...attachments.map((link, i) => `![Screenshot ${i + 1}](${link})`),
  ].filter(Boolean).join('\n\n');
  const result = await fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + env.GITHUB_ISSUES_TOKEN,
      'Content-Type': 'application/json',
      'User-Agent': 'Elmos-Calibration-Feedback',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ title: '[' + label + '] ' + title.replace(/[\r\n]/g, ' ').replace(/@/g, '＠'), body }),
  });
  if (result.status !== 201) return json({ code: 'service' }, 502);
  const issue = await result.json();
  return json({ url: issue.html_url }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.headers.get('Origin') !== origin || url.pathname !== '/feedback')
      return json({ code: 'origin' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    } });
    if (!env.GITHUB_ISSUES_TOKEN || !env.TURNSTILE_SECRET || !env.TURNSTILE_SITE_KEY)
      return json({ code: 'service' }, 503);
    if (request.method === 'GET') return json({ siteKey: env.TURNSTILE_SITE_KEY });
    if (request.method !== 'POST') return json({ code: 'method' }, 405);
    try {
      return await submit(request, env);
    } catch {
      return json({ code: 'service' }, 502);
    }
  },
};
