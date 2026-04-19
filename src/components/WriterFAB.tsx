import { useEffect, useRef, useState } from 'react'
import { GITHUB_CLIENT_ID, OAUTH_SCOPE, WORKER_URL } from '@/lib/writer-config'

// ---- helpers ----

function buildOAuthUrl(returnTo: string) {
  const state = crypto.randomUUID()
  sessionStorage.setItem('oauth_state', state)
  sessionStorage.setItem('oauth_return', returnTo)
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: OAUTH_SCOPE,
    state,
    redirect_uri: `${window.location.origin}/auth/callback/`,
  })
  return `https://github.com/login/oauth/authorize?${params}`
}

function buildFrontmatter(
  title: string,
  description: string,
  tags: string[],
  date: string,
) {
  const tagList = tags.length ? `\ntags: [${tags.map((t) => `"${t}"`).join(', ')}]` : ''
  return `---\ntitle: "${title}"\ndescription: "${description}"\ndate: ${date}\nauthors: ["kkghrsbsb"]${tagList}\n---\n\n`
}

function buildFilePath(title: string, date: string) {
  const slug = title
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
  const datePrefix = date.replace(/-/g, '')
  return `src/content/blog/${datePrefix}_${slug}/index.mdx`
}

// ---- component ----

type PanelState = 'closed' | 'open'

export default function WriterFAB() {
  const [session, setSession] = useState<string | null>(null)
  const [panel, setPanel] = useState<PanelState>('closed')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setSession(localStorage.getItem('writer_session'))
  }, [])

  function handleLogin() {
    window.location.href = buildOAuthUrl(window.location.pathname)
  }

  async function handleLogout() {
    if (session) {
      await fetch(`${WORKER_URL}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session }),
      }).catch(() => {})
    }
    localStorage.removeItem('writer_session')
    setSession(null)
    setPanel('closed')
  }

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) {
      setFeedback({ ok: false, msg: '标题和内容不能为空' })
      return
    }
    setSubmitting(true)
    setFeedback(null)

    const date = new Date().toISOString().slice(0, 10)
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const mdxContent = buildFrontmatter(title, description, tags, date) + body
    const path = buildFilePath(title, date)
    const content = btoa(unescape(encodeURIComponent(mdxContent)))

    try {
      const res = await fetch(`${WORKER_URL}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session,
          path,
          content,
          message: `feat: add post "${title}"`,
        }),
      })

      if (res.status === 401) {
        localStorage.removeItem('writer_session')
        setSession(null)
        setFeedback({ ok: false, msg: '登录已过期，请重新登录' })
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'unknown' }))
        setFeedback({ ok: false, msg: err.error || '提交失败' })
        return
      }

      setFeedback({ ok: true, msg: `已提交：${path}，CI 构建中...` })
      setTitle('')
      setDescription('')
      setTagsRaw('')
      setBody('')
    } catch {
      setFeedback({ ok: false, msg: '网络错误，请重试' })
    } finally {
      setSubmitting(false)
    }
  }

  // Not logged in: subtle lock icon
  if (!session) {
    return (
      <button
        onClick={handleLogin}
        title="站长登录"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '2.5rem',
          height: '2.5rem',
          borderRadius: '9999px',
          background: 'transparent',
          border: '1px solid color-mix(in oklab, currentColor 20%, transparent)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.3,
          zIndex: 40,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </button>
    )
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setPanel(panel === 'open' ? 'closed' : 'open')}
        title="写文章"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '3rem',
          height: '3rem',
          borderRadius: '9999px',
          background: 'var(--foreground)',
          color: 'var(--background)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 50,
        }}
      >
        {panel === 'open' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      {panel === 'open' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 49,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            padding: '1rem',
            paddingBottom: '5rem',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '540px',
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>新文章</span>
              <button
                onClick={handleLogout}
                style={{ fontSize: '0.75rem', opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
              >
                退出登录
              </button>
            </div>

            <input
              placeholder="标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="描述（可选）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={inputStyle}
            />
            <input
              placeholder="标签，逗号分隔（可选）"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              style={inputStyle}
            />
            <textarea
              ref={textareaRef}
              placeholder="正文（MDX）"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
            />

            {feedback && (
              <p style={{ fontSize: '0.8rem', color: feedback.ok ? 'green' : 'red', margin: 0 }}>
                {feedback.msg}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                background: 'var(--foreground)',
                color: 'var(--background)',
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? '提交中...' : '提交'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.375rem',
  border: '1px solid var(--border)',
  background: 'var(--background)',
  color: 'var(--foreground)',
  fontSize: '0.875rem',
  boxSizing: 'border-box',
  outline: 'none',
}
