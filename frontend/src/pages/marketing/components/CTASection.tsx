import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import MarketingButton from './MarketingButton'

export default function CTASection() {
  return (
    <section className="section">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="glass-strong"
          style={{
            position: 'relative',
            padding: 'clamp(40px, 6vw, 72px)',
            textAlign: 'center',
            overflow: 'hidden',
            borderRadius: 'var(--landing-radius-lg)',
            background:
              'linear-gradient(180deg, rgba(139,92,246,0.12) 0%, rgba(34,211,238,0.06) 100%)',
          }}
        >
          <span
            aria-hidden
            className="halo"
            style={{
              width: 380,
              height: 380,
              background: 'radial-gradient(circle, rgba(139,92,246,0.45), transparent 60%)',
              top: '-100px',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
          <span
            aria-hidden
            className="halo"
            style={{
              width: 240,
              height: 240,
              background: 'radial-gradient(circle, rgba(34,211,238,0.4), transparent 60%)',
              bottom: '-60px',
              right: '-60px',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <span className="eyebrow">Ready when you are</span>
            <h2
              className="display"
              style={{
                fontSize: 'clamp(32px, 5vw, 56px)',
                margin: '14px 0 16px',
              }}
            >
              Stop guessing what to learn next.
              <br />
              <span className="gradient-text">Start becoming.</span>
            </h2>
            <p
              style={{
                color: 'var(--landing-fg-muted)',
                fontSize: 16,
                lineHeight: 1.6,
                maxWidth: 540,
                margin: '0 auto 28px',
              }}
            >
              Sign up in under a minute and start learning with an AI tutor that knows your material.
            </p>
            <div
              style={{
                display: 'flex',
                gap: 12,
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Link to="/signup" style={{ textDecoration: 'none' }}>
                <MarketingButton size="lg" iconRight={ArrowRight}>
                  Create your account
                </MarketingButton>
              </Link>
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <MarketingButton size="lg" variant="secondary">
                  I already have one
                </MarketingButton>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
