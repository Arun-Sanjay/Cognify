import { Mark } from './MarketingNav'

export default function Footer() {
  return (
    <footer className="footer">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontSize: 13,
          color: 'var(--landing-fg-muted)',
        }}
      >
        <Mark size={20} />
        <span
          className="display"
          style={{ color: 'var(--landing-fg)', fontWeight: 600 }}
        >
          Cognify
        </span>
        <span style={{ opacity: 0.4 }}>•</span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 12,
          color: 'var(--landing-fg-faint)',
        }}
      >
        <span>© {new Date().getFullYear()} Cognify</span>
      </div>
    </footer>
  )
}
