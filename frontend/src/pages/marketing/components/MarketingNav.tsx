import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import MarketingButton from './MarketingButton'
import { ArrowRight } from 'lucide-react'

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
]

export default function MarketingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={clsx('marketing-nav', scrolled && 'scrolled')}>
      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          textDecoration: 'none',
          color: 'inherit',
          paddingRight: 8,
        }}
      >
        <Mark />
        <span
          className="display"
          style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}
        >
          Cognify
        </span>
      </Link>

      <div
        style={{
          display: 'flex',
          gap: 4,
          flex: 1,
          justifyContent: 'center',
        }}
        className="nav-links"
      >
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href} className="nav-link">
            {l.label}
          </a>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link to="/login" className="nav-link">
          Log in
        </Link>
        <Link to="/signup" style={{ textDecoration: 'none' }}>
          <MarketingButton size="md" iconRight={ArrowRight}>
            Get started
          </MarketingButton>
        </Link>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .marketing-nav .nav-links { display: none; }
        }
      `}</style>
    </nav>
  )
}

export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="markGrad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0F1116" />
      <circle cx="32" cy="32" r="18" stroke="url(#markGrad)" strokeWidth="2" opacity="0.55" />
      <circle cx="32" cy="32" r="11" stroke="url(#markGrad)" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="3.5" fill="url(#markGrad)" />
      <circle cx="50" cy="32" r="2.6" fill="#22D3EE" />
      <circle cx="14" cy="32" r="1.6" fill="#A78BFA" />
    </svg>
  )
}
