import { useEffect, useId, useRef, useState } from 'react'
import { ImageZoomModal } from '../../ui'

export interface MermaidDiagramProps {
  /** Raw Mermaid syntax (e.g. "flowchart TD\nA-->B"). */
  source: string
  /** Skip rendering while the parent message is still streaming — partial
   *  Mermaid almost never parses, so we'd just thrash. */
  isStreaming?: boolean
}

type MermaidLib = {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, source: string) => Promise<{ svg: string }>
}

let mermaidPromise: Promise<MermaidLib> | null = null
let mermaidInitialized = false

/**
 * Lazy-load mermaid and initialize once per page. Subsequent callers reuse
 * the same module instance — Vite code-splits this dynamic import so users
 * who never open Diagram mode never download the library (~600KB gzipped).
 */
async function loadMermaid(): Promise<MermaidLib> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const lib = (mod.default ?? mod) as MermaidLib
      if (!mermaidInitialized) {
        lib.initialize({
          startOnLoad: false,
          // 'neutral' reads well in all three Cognify themes (light/dark/nebula)
          // without us having to thread theme state in.
          theme: 'neutral',
          // Prevents Mermaid from injecting raw HTML in node labels — closes
          // the obvious XSS surface since diagrams are LLM-generated.
          securityLevel: 'strict',
          fontFamily: 'inherit',
        })
        mermaidInitialized = true
      }
      return lib
    })
  }
  return mermaidPromise
}

/**
 * Renders a Mermaid diagram. On parse error, gracefully falls back to the raw
 * source in a `<pre>` so the student still sees what the LLM tried to draw.
 */
export default function MermaidDiagram({ source, isStreaming }: MermaidDiagramProps) {
  const id = useId().replace(/[:]/g, '_') // Mermaid IDs must be CSS-safe
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false) // tap-to-zoom (mobile-friendly full-size view)

  useEffect(() => {
    if (isStreaming) return
    if (!source.trim()) return
    let cancelled = false

    void (async () => {
      try {
        const mermaid = await loadMermaid()
        // Mermaid wants a unique id per render; throws on duplicate.
        const renderId = `mermaid-${id}-${Date.now()}`
        const result = await mermaid.render(renderId, source)
        if (!cancelled) {
          setSvg(result.svg)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setSvg(null)
          setError(err instanceof Error ? err.message : 'Diagram failed to render.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [source, isStreaming, id])

  if (isStreaming) {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 my-3 text-center text-xs text-[var(--text-tertiary)]">
        Generating diagram…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 my-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-warning mb-2">
          Diagram couldn't render
        </div>
        <pre className="text-[12px] font-mono whitespace-pre-wrap text-[var(--text-secondary)] m-0">
          {source}
        </pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 my-3 text-center text-xs text-[var(--text-tertiary)]">
        Loading diagram…
      </div>
    )
  }

  return (
    <>
      <div
        ref={containerRef}
        role="button"
        tabIndex={0}
        aria-label="Tap to zoom diagram"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className="mermaid-host flex justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 my-3 overflow-hidden md:overflow-x-auto cursor-zoom-in"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <ImageZoomModal isOpen={open} onClose={() => setOpen(false)}>
        <div
          className="mermaid-host w-full flex justify-center"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </ImageZoomModal>
    </>
  )
}
