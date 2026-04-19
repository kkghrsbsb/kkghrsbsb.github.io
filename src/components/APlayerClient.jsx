import { useEffect, useRef } from 'react'
import APlayer from 'aplayer'

const LS_KEY_PREFIX = 'aplayer_cache:'
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

function readCache(key) {
  try {
    const raw = localStorage.getItem(LS_KEY_PREFIX + key)
    if (!raw) return null
    const { ts, audio } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return audio
  } catch {
    return null
  }
}

function writeCache(key, audio) {
  try {
    localStorage.setItem(LS_KEY_PREFIX + key, JSON.stringify({ ts: Date.now(), audio }))
  } catch {}
}

export default function APlayerClient({
  playlistId = '737648214',
  server = 'netease',
  containerId = 'aplayer',
}) {
  const containerRef = useRef(null)

  useEffect(() => {
    let player
    const state =
      window.__aplayerState ||
      (window.__aplayerState = {
        instance: null,
        audio: null,
        key: null,
      })
    const cacheKey = `${server}:${playlistId}`

    const init = async () => {
      if (!containerRef.current) return
      const metingUrl = `https://api.injahow.cn/meting/?server=${server}&type=playlist&id=${playlistId}`

      try {
        // Reuse instance and cached playlist to avoid theme-toggle stalls.
        const hasPlayerDom = Boolean(
          containerRef.current.querySelector('.aplayer'),
        )
        if (state.instance && state.key === cacheKey && hasPlayerDom) {
          player = state.instance
          return
        }

        if (!state.audio || state.key !== cacheKey) {
          const cached = readCache(cacheKey)
          if (cached) {
            state.audio = cached
          } else {
            const response = await fetch(metingUrl)
            if (!response.ok) {
              throw new Error(`Meting API error: ${response.status}`)
            }

            const data = await response.json()
            state.audio = data.map((song) => ({
              name: song.title || song.name,
              artist: song.artist || song.author,
              url: song.url,
              cover: song.pic || song.cover,
              lrc: song.lrc,
            }))
            writeCache(cacheKey, state.audio)
          }
        }

        if (state.instance) {
          state.instance.destroy()
          state.instance = null
        }

        player = new APlayer({
          container: containerRef.current,
          audio: state.audio || [],
          lrcType: 3,
          listFolded: true,
          listMaxHeight: 'calc(var(--aplayer-row-h, 2.2em) * 4)',
        })
        state.instance = player
        state.key = cacheKey
      } catch (error) {
        console.error('Failed to load APlayer playlist:', error)
      }
    }

    init()

    return () => {
      // Keep the instance alive across theme switches to avoid rebuilds.
    }
  }, [playlistId, server])

  return <div id={containerId} ref={containerRef} className="aplayer"></div>
}
