import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Small MediaRecorder wrapper used by the Phase 20 voice features.
 *
 * - `start()` requests the mic + camera, kicks off recording, and starts a
 *   second timer for elapsed seconds.
 * - `stop()` resolves with the final Blob + duration + an attached video
 *   stream (for the confidence coach — null when video was disabled).
 * - Releases the mic/camera tracks on unmount so the OS indicator turns off.
 *
 * The default mime type is `audio/webm;codecs=opus`, which Whisper and the
 * backend FFI can both parse without extra work.
 */

export interface UseMediaRecorderOptions {
  /** Request a video track alongside audio (for the confidence coach). */
  video?: boolean
  /** Called once per second while recording, for UI timers. */
  onTick?: (elapsedSeconds: number) => void
  /** Called when the user grants permission and the preview stream is live. */
  onStreamReady?: (stream: MediaStream) => void
}

export interface RecorderResult {
  blob: Blob
  durationSeconds: number
  mimeType: string
}

export type RecorderState = 'idle' | 'preparing' | 'recording' | 'error'

export interface UseMediaRecorderReturn {
  state: RecorderState
  elapsed: number
  error: string | null
  stream: MediaStream | null
  start: () => Promise<void>
  stop: () => Promise<RecorderResult | null>
  reset: () => void
}

function pickMimeType(video: boolean): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = video
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/mpeg']
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

export function useMediaRecorder(
  options: UseMediaRecorderOptions = {},
): UseMediaRecorderReturn {
  const { video = false, onTick, onStreamReady } = options
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const tickRef = useRef<number | null>(null)
  const startTimestampRef = useRef<number>(0)

  const cleanupTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setStream(null)
  }, [])

  const clearTick = useCallback(() => {
    if (tickRef.current != null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clearTick()
    recorderRef.current = null
    chunksRef.current = []
    startTimestampRef.current = 0
    cleanupTracks()
    setState('idle')
    setElapsed(0)
    setError(null)
  }, [clearTick, cleanupTracks])

  // Release the mic/camera if the component unmounts mid-recording
  useEffect(() => {
    return () => {
      clearTick()
      cleanupTracks()
    }
  }, [clearTick, cleanupTracks])

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setError('Recording is not supported in this browser')
      setState('error')
      return
    }
    setState('preparing')
    setError(null)
    setElapsed(0)
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: video ? { width: 640, height: 480 } : false,
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = mediaStream
      setStream(mediaStream)
      onStreamReady?.(mediaStream)

      const mimeType = pickMimeType(video)
      const recorder = mimeType
        ? new MediaRecorder(mediaStream, { mimeType })
        : new MediaRecorder(mediaStream)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.start(1000) // 1s chunks so `ondataavailable` fires continuously
      startTimestampRef.current = Date.now()
      tickRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startTimestampRef.current) / 1000)
        setElapsed(secs)
        onTick?.(secs)
      }, 250) as unknown as number
      setState('recording')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not access microphone — check browser permissions',
      )
      setState('error')
      cleanupTracks()
    }
  }, [cleanupTracks, onStreamReady, onTick, video])

  const stop = useCallback(async (): Promise<RecorderResult | null> => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') {
      return null
    }
    const durationMs = Date.now() - startTimestampRef.current
    clearTick()

    return new Promise<RecorderResult | null>((resolve) => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || (video ? 'video/webm' : 'audio/webm')
        const blob = new Blob(chunksRef.current, { type: mimeType })
        cleanupTracks()
        setState('idle')
        resolve({
          blob,
          durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
          mimeType,
        })
      }
      recorder.stop()
    })
  }, [cleanupTracks, clearTick, video])

  return { state, elapsed, error, stream, start, stop, reset }
}
