import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export interface ImageZoomModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

/**
 * Full-screen, dark, pinch-zoomable viewer for a single visual (an injected
 * Mermaid SVG, an answer-sheet page, etc.). Portals to body so it escapes any
 * transformed ancestor; `touch-action: pinch-zoom` enables native pinch.
 */
export default function ImageZoomModal({ isOpen, onClose, children }: ImageZoomModalProps) {
  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onEsc)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onEsc)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
      <div className="flex justify-end p-2 pt-safe shrink-0">
        <button
          onClick={onClose}
          aria-label="Close"
          className="tap-target flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div
        className="flex-1 overflow-auto scroll-touch flex items-center justify-center p-4 pb-safe"
        style={{ touchAction: 'pinch-zoom' }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
