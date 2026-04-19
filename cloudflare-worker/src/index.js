const SESSION_TTL = 60 * 60 * 24 * 7 // 7 days

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}

async function handleExchange(request, env, cors) {
  const { code } = await request.json()
  if (!code) return json({ error: 'missing code' }, 400, cors)

  // Exchange code for access_token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return json({ error: 'token exchange failed' }, 400, cors)
  }

  // Verify GitHub login
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'User-Agent': 'blog-auth-worker',
    },
  })
  const user = await userRes.json()
  if (user.login !== env.ALLOWED_LOGIN) {
    return json({ error: 'forbidden' }, 403, cors)
  }

  // Store in KV
  const sessionId = crypto.randomUUID()
  await env.SESSIONS.put(sessionId, tokenData.access_token, {
    expirationTtl: SESSION_TTL,
  })

  return json({ session_id: sessionId }, 200, cors)
}

async function handleSubmit(request, env, cors) {
  const { session_id, path, content, message } = await request.json()
  if (!session_id || !path || !content) {
    return json({ error: 'missing fields' }, 400, cors)
  }

  const token = await env.SESSIONS.get(session_id)
  if (!token) return json({ error: 'invalid or expired session' }, 401, cors)

  const apiBase = `https://api.github.com/repos/${env.REPO}/contents/${path}`
  const headers = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'blog-auth-worker',
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }

  // Check if file exists (to get sha for update)
  let sha
  const getRes = await fetch(apiBase, { headers })
  if (getRes.ok) {
    const existing = await getRes.json()
    sha = existing.sha
  }

  const body = { message: message || 'feat: new post via web editor', content }
  if (sha) body.sha = sha

  const putRes = await fetch(apiBase, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  })

  if (!putRes.ok) {
    const err = await putRes.text()
    return json({ error: err }, putRes.status, cors)
  }

  return json({ ok: true }, 200, cors)
}

async function handleLogout(request, env, cors) {
  const { session_id } = await request.json()
  if (session_id) await env.SESSIONS.delete(session_id)
  return json({ ok: true }, 200, cors)
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN
    const cors = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    const url = new URL(request.url)
    try {
      if (url.pathname === '/exchange') return handleExchange(request, env, cors)
      if (url.pathname === '/submit') return handleSubmit(request, env, cors)
      if (url.pathname === '/logout') return handleLogout(request, env, cors)
      return new Response('Not Found', { status: 404 })
    } catch (e) {
      return json({ error: 'internal error' }, 500, cors)
    }
  },
}
