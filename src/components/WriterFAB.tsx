import { marked } from 'marked'
import { useEffect, useRef, useState } from 'react'
import { GITHUB_CLIENT_ID, OAUTH_SCOPE, WORKER_URL } from '@/lib/writer-config'

// ---- types ----

interface Asset {
  name: string
  b64: string
  mimeType: string
}

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

function toSlug(title: string) {
  return title.trim().replace(/\s+/g, '_').replace(/[^\w\u4e00-\u9fff]/g, '')
}

function buildFrontmatter(
  title: string,
  description: string,
  tags: string[],
  date: string,
  coverName: string | null,
) {
  const lines = [
    '---',
    `title: "${title}"`,
    `description: "${description}"`,
    `date: ${date}`,
    `authors: ["kkghrsbsb"]`,
  ]
  if (tags.length) lines.push(`tags: [${tags.map((t) => `"${t}"`).join(', ')}]`)
  if (coverName) lines.push(`image: './${coverName}'`)
  lines.push('---', '', '')
  return lines.join('\n')
}

function renderPreview(md: string, assets: Asset[]) {
  let resolved = md
  for (const img of assets) {
    resolved = resolved.replaceAll(`./${img.name}`, `data:${img.mimeType};base64,${img.b64}`)
  }
  return marked.parse(resolved) as string
}

async function readAsB64(file: File): Promise<Asset> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      resolve({ name: file.name, b64: dataUrl.split(',')[1], mimeType: file.type })
    }
    reader.onerror = () => reject(new Error('read error'))
    reader.readAsDataURL(file)
  })
}

async function workerSubmit(
  sessionId: string,
  path: string,
  content: string,
  message: string,
  binary = false,
) {
  const b64 = binary ? content : btoa(unescape(encodeURIComponent(content)))
  const res = await fetch(`${WORKER_URL}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, path, content: b64, message }),
  })
  if (res.status === 401) throw new Error('SESSION_EXPIRED')
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '' }))
    throw new Error(err.error || '提交失败')
  }
}

// ---- styles ----

const btn: React.CSSProperties = {
  fontSize: '0.75rem',
  padding: '4px 10px',
  border: '1px solid var(--border)',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  background: 'transparent',
  color: 'var(--foreground)',
  whiteSpace: 'nowrap',
  fontFamily: 'var(--font-sans)',
}

const btnPrimary: React.CSSProperties = {
  ...btn,
  background: 'var(--foreground)',
  color: 'var(--background)',
  border: 'none',
}

const fieldInput: React.CSSProperties = {
  flex: 1,
  padding: '4px 8px',
  border: '1px solid var(--border)',
  borderRadius: '0.375rem',
  background: 'color-mix(in oklab, var(--muted) 50%, transparent)',
  color: 'var(--foreground)',
  fontSize: '0.8rem',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
}

const label: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--muted-foreground)',
  minWidth: '2.5rem',
  fontWeight: 500,
  flexShrink: 0,
}

// ---- component ----

export default function WriterFAB() {
  const isDev = import.meta.env.DEV

  const [session, setSession] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [body, setBody] = useState('')
  const [wordCount, setWordCount] = useState(0)

  const [cover, setCover] = useState<Asset | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<Asset[]>([])

  const [isMobile, setIsMobile] = useState(false)
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write')
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)

  const editorRef = useRef<HTMLTextAreaElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setSession(localStorage.getItem('writer_session'))
  }, [])

  function handleTitleChange(v: string) {
    setTitle(v)
    setSlug(toSlug(v))
  }

  function handleBodyChange(v: string) {
    setBody(v)
    setWordCount(v.replace(/\s/g, '').length)
  }

  function onTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
      e.preventDefault()
      const v = tagInput.trim().replace(/[,，]/g, '')
      if (v && !tags.includes(v)) setTags([...tags, v])
      setTagInput('')
    }
    if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(tags.slice(0, -1))
    }
  }

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const asset = await readAsB64(file)
    setCover(asset)
    setCoverPreview(`data:${asset.mimeType};base64,${asset.b64}`)
    e.target.value = ''
  }

  async function handleInlineImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const asset = await readAsB64(file)
    const ta = editorRef.current
    if (!ta) return
    // 编辑器只插入相对路径占位，base64 存在内存里
    const md = `![${file.name}](./${file.name})`
    const s = ta.selectionStart
    const newVal = ta.value.slice(0, s) + '\n' + md + '\n' + ta.value.slice(s)
    handleBodyChange(newVal)
    setPendingImages((prev) => [...prev, asset])
    e.target.value = ''
  }

  function handleLogin() {
    if (isDev) {
      localStorage.setItem('writer_session', 'dev-session')
      setSession('dev-session')
      return
    }
    window.location.href = buildOAuthUrl(window.location.pathname)
  }

  async function handleLogout() {
    if (session && !isDev) {
      await fetch(`${WORKER_URL}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session }),
      }).catch(() => {})
    }
    localStorage.removeItem('writer_session')
    setSession(null)
    setOpen(false)
  }

  async function handleSubmit() {
    if (!title.trim() || !slug.trim() || !body.trim()) {
      setFeedback({ ok: false, msg: '标题和内容不能为空' })
      return
    }
    setFeedback(null)

    const dirPath = `src/content/blog/${date.replace(/-/g, '')}_${slug}`

    if (isDev) {
      const fm = buildFrontmatter(title, description, tags, date, cover?.name ?? null)
      console.log('[dev] would submit:\n' + fm + body)
      if (cover) console.log('[dev] would upload cover:', `${dirPath}/${cover.name}`)
      setFeedback({ ok: true, msg: `[dev] ${dirPath}/index.mdx` })
      return
    }

    setSubmitting(true)
    try {
      if (cover) {
        await workerSubmit(
          session!,
          `${dirPath}/${cover.name}`,
          cover.b64,
          `assets: cover for "${title}"`,
          true,
        )
      }

      for (const img of pendingImages) {
        await workerSubmit(session!, `${dirPath}/${img.name}`, img.b64, `assets: ${img.name}`, true)
      }

      const fm = buildFrontmatter(title, description, tags, date, cover?.name ?? null)
      await workerSubmit(session!, `${dirPath}/index.mdx`, fm + body, `feat: add post "${title}"`)

      setFeedback({ ok: true, msg: `已提交 ${dirPath}/index.mdx，CI 构建中...` })
      setTitle(''); setSlug(''); setDescription('')
      setTags([]); setDate(new Date().toISOString().slice(0, 10))
      setBody(''); setWordCount(0); setCover(null); setCoverPreview(null); setPendingImages([])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '提交失败'
      if (msg === 'SESSION_EXPIRED') {
        localStorage.removeItem('writer_session')
        setSession(null)
        setFeedback({ ok: false, msg: '登录已过期，请重新登录' })
      } else {
        setFeedback({ ok: false, msg })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ---- not logged in ----
  if (!session) {
    return (
      <button
        onClick={handleLogin}
        title={isDev ? '站长登录（dev）' : '站长登录'}
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          width: '2.5rem', height: '2.5rem', borderRadius: '9999px',
          background: 'transparent',
          border: '1px solid color-mix(in oklab, currentColor 20%, transparent)',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', opacity: 0.3, zIndex: 52,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </button>
    )
  }

  // ---- logged in ----
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        title="写文章"
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem',
          width: '3rem', height: '3rem', borderRadius: '9999px',
          background: 'var(--foreground)', color: 'var(--background)',
          border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: 52,
        }}
      >
        {open ? (
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

      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 51,
          background: 'var(--background)',
          display: 'grid',
          gridTemplateRows: isMobile ? 'auto auto auto 1fr' : 'auto auto 1fr',
          overflow: 'hidden',
        }}>
          {/* top bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: isMobile ? '0.625rem 0.75rem' : '0.5rem 1rem',
            borderBottom: '1px solid var(--border)',
            minHeight: isMobile ? '3rem' : 'auto',
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', flex: 1 }}>新文章</span>
            <input ref={imgInputRef} type="file" accept="image/*"
              style={{ display: 'none' }} onChange={handleInlineImage} />
            {/* 插入图片：手机上用图标，桌面用文字 */}
            <button onClick={() => imgInputRef.current?.click()}
              style={{ ...btn, padding: isMobile ? '8px' : '4px 10px' }}
              title="插入图片">
              {isMobile ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              ) : '插入图片'}
            </button>
            <button
              onClick={handleSubmit} disabled={submitting}
              style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'not-allowed' : 'pointer',
                padding: isMobile ? '8px 12px' : '4px 10px' }}
            >
              {submitting ? '提交中...' : isMobile ? '提交 ↗' : '提交到 GitHub ↗'}
            </button>
            <button onClick={handleLogout}
              style={{ ...btn, opacity: 0.5, padding: isMobile ? '8px' : '4px 10px' }}
              title="退出">
              {isMobile ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              ) : '退出'}
            </button>
          </div>

          {/* meta bar */}
          <div style={{
            padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: '0.4rem',
            overflowY: isMobile ? 'auto' : 'visible',
            maxHeight: isMobile ? '42vh' : 'none',
          }}>
            {isMobile ? (
              // 手机：每行独占全宽
              <>
                <input value={title} onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="标题" style={{ ...fieldInput, fontSize: '1rem', padding: '8px 10px' }} />
                <input value={slug} onChange={(e) => setSlug(e.target.value)}
                  placeholder="slug（自动生成）"
                  style={{ ...fieldInput, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '8px 10px' }} />
                <input value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="摘要（可选）" style={{ ...fieldInput, padding: '8px 10px' }} />
                <div
                  onClick={() => document.getElementById('fab-tag-input')?.focus()}
                  style={{
                    display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center',
                    minHeight: '2.5rem', padding: '6px 10px',
                    border: '1px solid var(--border)', borderRadius: '0.375rem',
                    background: 'color-mix(in oklab, var(--muted) 50%, transparent)', cursor: 'text',
                  }}>
                  {tags.map((t) => (
                    <span key={t} style={{
                      fontSize: '0.75rem', padding: '2px 10px', borderRadius: '9999px',
                      background: 'var(--background)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                      {t}
                      <span onClick={() => setTags(tags.filter((x) => x !== t))}
                        style={{ cursor: 'pointer', opacity: 0.5 }}>✕</span>
                    </span>
                  ))}
                  <input id="fab-tag-input" value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)} onKeyDown={onTagKey}
                    placeholder={tags.length ? '' : '标签，回车添加...'}
                    style={{ border: 'none', background: 'transparent', outline: 'none',
                      fontSize: '0.875rem', color: 'var(--foreground)', minWidth: '100px', flex: 1 }} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    style={{ ...fieldInput, flex: 1, padding: '8px 10px' }} />
                  <input ref={coverInputRef} type="file" accept="image/*"
                    style={{ display: 'none' }} onChange={handleCoverChange} />
                  <button onClick={() => coverInputRef.current?.click()}
                    style={{ ...btn, flex: 1, padding: '8px 10px', textAlign: 'center', justifyContent: 'center' }}>
                    {cover ? `封面: ${cover.name}` : '选择封面图'}
                  </button>
                  {cover && (
                    <span onClick={() => { setCover(null); setCoverPreview(null) }}
                      style={{ cursor: 'pointer', opacity: 0.5, fontSize: '1rem', padding: '4px' }}>✕</span>
                  )}
                </div>
                {coverPreview && (
                  <img src={coverPreview} alt="cover"
                    style={{ width: '100%', maxHeight: '80px', objectFit: 'cover', borderRadius: '4px' }} />
                )}
              </>
            ) : (
              // 桌面：原有横排布局
              <>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={label}>标题</label>
                  <input value={title} onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="文章标题" style={fieldInput} />
                  <label style={{ ...label, minWidth: 'auto' }}>slug</label>
                  <input value={slug} onChange={(e) => setSlug(e.target.value)}
                    placeholder="auto"
                    style={{ ...fieldInput, flex: '0 0 160px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={label}>摘要</label>
                  <input value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="文章摘要（可选）" style={fieldInput} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={label}>标签</label>
                  <div onClick={() => document.getElementById('fab-tag-input')?.focus()}
                    style={{
                      flex: 1, minWidth: '160px', display: 'flex', flexWrap: 'wrap',
                      gap: '0.25rem', alignItems: 'center', minHeight: '2rem',
                      padding: '3px 6px', border: '1px solid var(--border)',
                      borderRadius: '0.375rem',
                      background: 'color-mix(in oklab, var(--muted) 50%, transparent)', cursor: 'text',
                    }}>
                    {tags.map((t) => (
                      <span key={t} style={{
                        fontSize: '0.7rem', padding: '1px 8px', borderRadius: '9999px',
                        background: 'var(--background)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        {t}
                        <span onClick={() => setTags(tags.filter((x) => x !== t))}
                          style={{ cursor: 'pointer', opacity: 0.5, fontSize: '0.65rem' }}>✕</span>
                      </span>
                    ))}
                    <input id="fab-tag-input" value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)} onKeyDown={onTagKey}
                      placeholder={tags.length ? '' : '输入后回车添加...'}
                      style={{ border: 'none', background: 'transparent', outline: 'none',
                        fontSize: '0.8rem', color: 'var(--foreground)', minWidth: '80px', flex: 1,
                        fontFamily: 'var(--font-sans)' }} />
                  </div>
                  <label style={{ ...label, minWidth: 'auto' }}>日期</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    style={{ ...fieldInput, flex: '0 0 140px' }} />
                  <label style={{ ...label, minWidth: 'auto' }}>封面</label>
                  <input ref={coverInputRef} type="file" accept="image/*"
                    style={{ display: 'none' }} onChange={handleCoverChange} />
                  <button onClick={() => coverInputRef.current?.click()} style={btn}>
                    {cover ? cover.name : '选择图片'}
                  </button>
                  {coverPreview && (
                    <img src={coverPreview} alt="cover preview"
                      style={{ height: '1.75rem', aspectRatio: '16/9', objectFit: 'cover', borderRadius: '3px' }} />
                  )}
                  {cover && (
                    <span onClick={() => { setCover(null); setCoverPreview(null) }}
                      style={{ fontSize: '0.7rem', opacity: 0.5, cursor: 'pointer' }}>✕</span>
                  )}
                </div>
              </>
            )}

            {feedback && (
              <div style={{ fontSize: '0.75rem', padding: '3px 0', color: feedback.ok ? '#16a34a' : '#dc2626' }}>
                {feedback.msg}
              </div>
            )}
          </div>

          {/* 手机标签栏 */}
          {isMobile && (
            <div style={{
              display: 'flex', borderBottom: '1px solid var(--border)',
              background: 'color-mix(in oklab, var(--muted) 40%, transparent)',
            }}>
              {(['write', 'preview'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                    fontSize: '0.8rem', fontFamily: 'var(--font-sans)',
                    background: activeTab === tab ? 'var(--background)' : 'transparent',
                    color: activeTab === tab ? 'var(--foreground)' : 'var(--muted-foreground)',
                    borderBottom: activeTab === tab ? '2px solid var(--foreground)' : '2px solid transparent',
                    fontWeight: activeTab === tab ? 600 : 400,
                  }}>
                  {tab === 'write' ? `编写 · ${wordCount} 字` : '预览'}
                </button>
              ))}
            </div>
          )}

          {/* editor + preview */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            overflow: 'hidden',
          }}>
            {/* editor pane */}
            {(!isMobile || activeTab === 'write') && (
              <div style={{ display: 'flex', flexDirection: 'column',
                borderRight: isMobile ? 'none' : '1px solid var(--border)', overflow: 'hidden' }}>
                {!isMobile && (
                  <div style={{
                    fontSize: '0.7rem', padding: '4px 12px', color: 'var(--muted-foreground)',
                    borderBottom: '1px solid var(--border)',
                    background: 'color-mix(in oklab, var(--muted) 40%, transparent)',
                    display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span>markdown</span><span>{wordCount} 字</span>
                  </div>
                )}
                <textarea
                  ref={editorRef}
                  value={body} onChange={(e) => handleBodyChange(e.target.value)}
                  placeholder="开始写作..."
                  style={{
                    flex: 1, resize: 'none', border: 'none', outline: 'none',
                    padding: isMobile ? '1rem 0.75rem' : '1rem',
                    fontSize: isMobile ? '1rem' : '0.8rem', lineHeight: 1.8,
                    fontFamily: 'var(--font-mono)', background: 'var(--background)',
                    color: 'var(--foreground)', overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                  }}
                />
              </div>
            )}

            {/* preview pane */}
            {(!isMobile || activeTab === 'preview') && (
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {!isMobile && (
                  <div style={{
                    fontSize: '0.7rem', padding: '4px 12px', color: 'var(--muted-foreground)',
                    borderBottom: '1px solid var(--border)',
                    background: 'color-mix(in oklab, var(--muted) 40%, transparent)',
                  }}>预览</div>
                )}
                <div
                  className="prose max-w-none"
                  style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '1rem 0.75rem' : '1rem',
                    WebkitOverflowScrolling: 'touch' }}
                  dangerouslySetInnerHTML={{
                    __html: body
                      ? renderPreview(body, cover ? [...pendingImages, cover] : pendingImages)
                      : '<span style="color:var(--muted-foreground);font-size:0.8rem">输入内容后显示预览...</span>',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
