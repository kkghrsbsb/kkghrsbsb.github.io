import { useEffect, useState } from 'react'
import { WORKER_URL } from '@/lib/writer-config'

export default function CallbackHandler() {
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const storedState = sessionStorage.getItem('oauth_state')

    if (!code || !state || state !== storedState) {
      setStatus('error')
      setMessage(
        `code=${code ?? 'null'} | state=${state ?? 'null'} | stored=${storedState ?? 'null'}`,
      )
      return
    }

    sessionStorage.removeItem('oauth_state')

    fetch(`${WORKER_URL}/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then((res) => {
        if (res.status === 403) throw new Error('Access denied: not allowed.')
        if (!res.ok) throw new Error('Token exchange failed.')
        return res.json()
      })
      .then(({ session_id }) => {
        localStorage.setItem('writer_session', session_id)
        const returnTo = sessionStorage.getItem('oauth_return') || '/'
        sessionStorage.removeItem('oauth_return')
        window.location.replace(returnTo)
      })
      .catch((e) => {
        setStatus('error')
        setMessage(e.message)
      })
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', textAlign: 'center' }}>
      {status === 'loading' ? (
        <p>登录中，请稍候...</p>
      ) : (
        <>
          <p style={{ color: 'red' }}>{message}</p>
          <a href="/">返回首页</a>
        </>
      )}
    </div>
  )
}
