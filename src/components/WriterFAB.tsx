import { useEffect, useState } from 'react'
import { GITHUB_CLIENT_ID, OAUTH_SCOPE } from '@/lib/writer-config'

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

export default function WriterFAB() {
  const isDev = import.meta.env.DEV
  const [session, setSession] = useState<string | null>(null)
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  useEffect(() => {
    setSession(localStorage.getItem('writer_session'))
  }, [])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setKeyboardOffset(Math.max(0, window.innerHeight - vv.offsetTop - vv.height))
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const fabStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: `${24 + keyboardOffset}px`,
    left: '1.5rem',
    width: '2.5rem',
    height: '2.5rem',
    borderRadius: '9999px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 52,
  }

  if (!session) {
    return (
      <button
        onClick={() => {
          if (isDev) {
            localStorage.setItem('writer_session', 'dev-session')
            setSession('dev-session')
          } else {
            window.location.href = buildOAuthUrl('/write')
          }
        }}
        title={isDev ? '站长登录（dev）' : '站长登录'}
        style={{
          ...fabStyle,
          background: 'transparent',
          border: '1px solid color-mix(in oklab, currentColor 20%, transparent)',
          opacity: 0.3,
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
    <a
      href="/write"
      title="写文章"
      style={{
        ...fabStyle,
        width: '3rem',
        height: '3rem',
        background: 'var(--foreground)',
        color: 'var(--background)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        textDecoration: 'none',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </a>
  )
}
