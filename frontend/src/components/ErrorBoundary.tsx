import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Optional label so a stack-trace error includes which route boundary tripped. */
  scope?: string
}

interface State {
  error: Error | null
}

/**
 * Hard guard around any subtree. Catches render-time exceptions and shows
 * a recovery card instead of letting the whole shell go blank. Stack traces
 * are only rendered in dev (`import.meta.env.DEV`) so production users
 * don't see internals.
 */
export default class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`ErrorBoundary[${this.props.scope ?? 'app'}] caught:`, error, info)
  }

  reset = () => {
    this.setState({ error: null })
  }

  override render() {
    if (!this.state.error) return this.props.children

    const isDev = import.meta.env.DEV

    return (
      <div
        style={{
          minHeight: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <div
          className="card p-6"
          style={{
            maxWidth: 520,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#FCA5A5',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle size={20} />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Something went wrong on this page.
              </h2>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                }}
              >
                {this.state.error.message ||
                  'An unexpected error stopped this view from loading.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={this.reset}
            className="btn btn-primary"
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 8,
              border: 0,
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            Try again
          </button>

          {isDev && this.state.error.stack && (
            <details
              style={{
                marginTop: 6,
                fontSize: 12,
                color: 'var(--text-tertiary)',
              }}
            >
              <summary style={{ cursor: 'pointer' }}>Dev stack trace</summary>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: 11,
                  background: 'var(--bg-tertiary)',
                  padding: 10,
                  borderRadius: 6,
                  marginTop: 8,
                  maxHeight: 220,
                  overflowY: 'auto',
                }}
              >
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}
