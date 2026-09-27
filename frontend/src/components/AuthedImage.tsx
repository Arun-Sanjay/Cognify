import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'

interface AuthedImageProps {
  url: string
  alt?: string
  className?: string
}

/**
 * <img> can't send an Authorization header, so private answer-sheet pages are
 * fetched as a blob with the bearer token and shown via an object URL.
 */
export default function AuthedImage({ url, alt = '', className }: AuthedImageProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl: string | undefined
    setSrc(null)
    setFailed(false)
    const token = useAuthStore.getState().token
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  if (failed) {
    return (
      <div
        className={className}
        style={{ background: 'var(--bg-tertiary)', display: 'grid', placeItems: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}
      >
        image unavailable
      </div>
    )
  }
  if (!src) {
    return <div className={className} style={{ background: 'var(--bg-tertiary)' }} />
  }
  return <img src={src} alt={alt} className={className} />
}
