import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { MouseEvent, ReactNode } from 'react'
import { clsx } from 'clsx'
import { X } from 'lucide-react'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Optional pinned row at the bottom of the modal panel, outside the
   *  scrolling body. Use for primary actions on long modals. */
  footer?: ReactNode
  size?: ModalSize
  className?: string
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizes: Record<ModalSize, string> = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  // Portal to body so the modal escapes any Framer Motion transformed
  // ancestor (a transform on an ancestor creates a new containing block
  // for `position: fixed`, which would push the centered modal off-screen
  // when the surrounding page is mid-animation).
  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4"
      onClick={(e: MouseEvent<HTMLDivElement>) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={clsx(
          'relative w-full fade-in flex flex-col',
          'rounded-t-2xl md:rounded-card',
          'bg-[var(--bg-elevated)] border border-[var(--border-default)]',
          'max-h-[calc(100dvh-3rem)] md:max-h-[calc(100dvh-2rem)]',
          sizes[size],
          className,
        )}
        style={{ boxShadow: 'var(--shadow-elevated)' }}
      >
        {/* Mobile grab handle */}
        <div className="md:hidden mx-auto mt-2 h-1.5 w-10 rounded-full bg-[var(--border-strong)] shrink-0" />
        {/* Header is pinned so the X stays reachable even when the body
            scrolls (e.g. a long quiz review). */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)] shrink-0">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto scroll-touch flex-1 min-h-0">{children}</div>
        {footer && (
          <div className="px-4 py-3 border-t border-[var(--border-default)] shrink-0 pb-safe">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
