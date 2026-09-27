import { clsx } from 'clsx'
import type { Components } from 'react-markdown'

/**
 * Shared markdown component overrides used by `ChatMessage` and the
 * solved/unsolved cards' nested ReactMarkdown.
 *
 * The `code` override here is plain (no fence dispatch) — `ChatMessage`
 * extends/overrides it to route `language-solved` / `language-unsolved` /
 * `language-mermaid` etc. into card components. Cards themselves use this
 * plain override so a fenced code block inside a card body just renders as
 * normal code (no recursive dispatch).
 */
export const baseMarkdownComponents: Components = {
  h1: ({ node: _n, ...props }) => (
    <h1
      className="text-lg font-bold mt-2 mb-1.5 text-[var(--text-primary)]"
      {...props}
    />
  ),
  h2: ({ node: _n, ...props }) => (
    <h2
      className="text-base font-bold mt-2 mb-1.5 text-[var(--text-primary)]"
      {...props}
    />
  ),
  h3: ({ node: _n, ...props }) => (
    <h3
      className="text-sm font-semibold mt-2 mb-1 text-[var(--text-primary)]"
      {...props}
    />
  ),
  h4: ({ node: _n, ...props }) => (
    <h4
      className="text-sm font-semibold mt-1.5 mb-1 text-[var(--text-primary)]"
      {...props}
    />
  ),
  p: ({ node: _n, ...props }) => (
    <p className="my-1.5 leading-relaxed" {...props} />
  ),
  ul: ({ node: _n, ...props }) => (
    <ul className="my-1.5 pl-5 list-disc space-y-1" {...props} />
  ),
  ol: ({ node: _n, ...props }) => (
    <ol className="my-1.5 pl-5 list-decimal space-y-1" {...props} />
  ),
  li: ({ node: _n, ...props }) => (
    <li className="leading-relaxed" {...props} />
  ),
  strong: ({ node: _n, ...props }) => (
    <strong className="font-semibold text-[var(--text-primary)]" {...props} />
  ),
  em: ({ node: _n, ...props }) => <em className="italic" {...props} />,
  a: ({ node: _n, ...props }) => (
    <a
      className="text-primary underline underline-offset-2 hover:opacity-80"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: ({ node: _n, ...props }) => (
    <blockquote
      className="border-l-2 border-[var(--border-strong)] pl-3 my-2 text-[var(--text-secondary)] italic"
      {...props}
    />
  ),
  hr: ({ node: _n, ...props }) => (
    <hr className="my-3 border-[var(--border-default)]" {...props} />
  ),
  code: ({ node: _n, className, children, ...props }) => {
    const isBlock = (className ?? '').startsWith('language-')
    if (isBlock) {
      return (
        <code
          className={clsx(
            'block whitespace-pre overflow-x-auto rounded-md px-3 py-2 my-2 text-[12.5px] font-mono',
            'bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)]',
          )}
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code
        className="px-1 py-0.5 rounded text-[12.5px] font-mono bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)]"
        {...props}
      >
        {children}
      </code>
    )
  },
  pre: ({ node: _n, children, ...props }) => (
    // `whitespace-pre-wrap` + `break-words` so an unnamed fenced block
    // (which the LLM occasionally uses for prose) wraps inside the bubble
    // instead of forcing horizontal page scroll. Block code with a language
    // class on its inner <code> still gets its own `whitespace-pre overflow-x-auto`
    // and ignores this — which is what we want for actual code.
    <pre className="my-2 not-prose max-w-full overflow-x-auto whitespace-pre-wrap break-words" {...props}>
      {children}
    </pre>
  ),
  table: ({ node: _n, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table
        className="w-full text-[12.5px] border-collapse border border-[var(--border-default)]"
        {...props}
      />
    </div>
  ),
  th: ({ node: _n, ...props }) => (
    <th
      className="text-left font-semibold px-2 py-1 border border-[var(--border-default)] bg-[var(--bg-tertiary)]"
      {...props}
    />
  ),
  td: ({ node: _n, ...props }) => (
    <td className="px-2 py-1 border border-[var(--border-default)]" {...props} />
  ),
}
