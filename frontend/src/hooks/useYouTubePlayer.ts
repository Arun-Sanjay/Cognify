import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

// Minimal typing for the bits of the YouTube IFrame Player API we use.
interface YTPlayer {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  playVideo: () => void
  getCurrentTime: () => number
  destroy: () => void
}

interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      playerVars?: Record<string, number | string>
      events?: { onReady?: () => void }
    },
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | null = null

/** Load https://www.youtube.com/iframe_api once for the whole app. */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    document.head.appendChild(script)
  })
  return apiPromise
}

export interface YouTubeControls {
  ready: boolean
  /** Seek to `seconds` and start playing. */
  seekTo: (seconds: number) => void
  /** Current playback position in seconds (0 until ready). */
  getCurrentTime: () => number
}

/**
 * Mount a YouTube player inside `hostRef` for `videoId`. The host element is
 * handed to the IFrame API, which replaces a child div with the iframe — so
 * render an empty container and let the hook own its contents.
 */
export function useYouTubePlayer(hostRef: RefObject<HTMLDivElement | null>, videoId: string): YouTubeControls {
  const playerRef = useRef<YTPlayer | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host || !videoId) return
    let cancelled = false
    setReady(false)

    const mount = document.createElement('div')
    host.replaceChildren(mount)

    loadYouTubeApi().then((YT) => {
      if (cancelled) return
      playerRef.current = new YT.Player(mount, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: { onReady: () => !cancelled && setReady(true) },
      })
    })

    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
      host.replaceChildren()
    }
  }, [hostRef, videoId])

  const seekTo = useCallback(
    (seconds: number) => {
      const player = playerRef.current
      if (!player || !ready) return
      player.seekTo(Math.max(0, seconds), true)
      player.playVideo()
    },
    [ready],
  )
  const getCurrentTime = useCallback(
    () => (ready && playerRef.current ? playerRef.current.getCurrentTime() : 0),
    [ready],
  )

  return { ready, seekTo, getCurrentTime }
}
