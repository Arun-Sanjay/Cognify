import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import MarketingButton from './MarketingButton'

const fade = {
  initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
}

/**
 * Per-character "neural decode" entrance — letters resolve from a blurred,
 * offset state with a tight stagger so the headline reads as if a network
 * is coming online. Splits per word: each word is its own inline-block so
 * the line wraps at word boundaries (not mid-word), with each character
 * inside still animating individually.
 */
function NeuralText({
  text,
  className,
  startDelay = 0,
  perCharDelay = 0.022,
  style,
}: {
  text: string
  className?: string
  startDelay?: number
  perCharDelay?: number
  style?: React.CSSProperties
}): ReactNode {
  const tokens = text.split(/(\s+)/)
  let charIdx = 0
  // background-clip: text breaks when text is inside nested inline-blocks,
  // so we re-apply the gradient styles per character.
  const isGradient = className?.split(' ').includes('gradient-text') ?? false
  const gradientStyle: React.CSSProperties = isGradient
    ? {
        backgroundImage: 'var(--landing-gradient-text)',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
        animation: 'shimmer 6s linear infinite',
      }
    : {}
  return (
    <span className={className} style={style}>
      {tokens.map((token, ti) => {
        if (token === '') return null
        if (/^\s+$/.test(token)) {
          return <span key={`s${ti}`}>{token}</span>
        }
        return (
          <span
            key={`w${ti}`}
            style={{ display: 'inline-block', whiteSpace: 'nowrap' }}
          >
            {Array.from(token).map((ch) => {
              const i = charIdx++
              return (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 6, filter: 'blur(7px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{
                    duration: 0.55,
                    delay: startDelay + i * perCharDelay,
                    ease: [0.2, 0.65, 0.3, 1] as [number, number, number, number],
                  }}
                  style={{ display: 'inline-block', ...gradientStyle }}
                >
                  {ch}
                </motion.span>
              )
            })}
          </span>
        )
      })}
    </span>
  )
}

const HEAD_LINE_1 = 'Most platforms ask what you want to '
const HEAD_LEARN = 'learn.'
const HEAD_LINE_2 = 'We ask who you want to '
const HEAD_BECOME = 'become.'

const HEADLINE_FULL_LEN =
  HEAD_LINE_1.length + HEAD_LEARN.length + HEAD_LINE_2.length + HEAD_BECOME.length
const HEADLINE_TOTAL_S = 0.18 + HEADLINE_FULL_LEN * 0.022 + 0.55

export default function Hero() {
  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(120px, 16vh, 160px) 24px clamp(72px, 10vh, 110px)',
        overflow: 'hidden',
        isolation: 'isolate',
      }}
    >
      {/* Looping neural-network video background — at frontend/public/neural-bg.mp4.
          The atmospheric overlay below dims it for headline legibility. */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        src="/neural-bg.mp4"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
          filter: 'brightness(0.78) saturate(1.1)',
          pointerEvents: 'none',
        }}
      />

      {/* Atmospheric backdrop — sits over the video to dim it for legibility,
          and stands alone if the video file isn't present yet. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background:
            'radial-gradient(ellipse 55% 55% at 50% 48%, rgba(139, 92, 246, 0.28) 0%, rgba(139, 92, 246, 0) 60%), ' +
            'radial-gradient(ellipse 35% 35% at 82% 28%, rgba(34, 211, 238, 0.18) 0%, rgba(34, 211, 238, 0) 65%), ' +
            'radial-gradient(ellipse 40% 35% at 18% 82%, rgba(167, 139, 250, 0.14) 0%, transparent 65%), ' +
            'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(6,7,10,0.55) 0%, rgba(6,7,10,0.0) 70%), ' +
            'linear-gradient(180deg, rgba(6,7,10,0.85) 0%, rgba(6,7,10,0.0) 16%), ' +
            'linear-gradient(180deg, rgba(6,7,10,0) 65%, rgba(6,7,10,0.96) 100%)',
        }}
      />

<motion.div
        {...fade}
        style={{
          position: 'relative',
          zIndex: 2,
          textAlign: 'center',
          maxWidth: 880,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
        }}
      >
        <motion.span
          {...fade}
          transition={{ ...fade.transition, delay: 0.05 }}
          className="chip chip-accent"
        >
          <Sparkles size={12} strokeWidth={2.5} />
          AI-powered learning
        </motion.span>

        <h1
          className="display"
          style={{
            fontSize: 'clamp(30px, 4.6vw, 60px)',
            lineHeight: 1.08,
            margin: 0,
            maxWidth: 820,
          }}
        >
          <NeuralText text={HEAD_LINE_1} startDelay={0.18} />
          <NeuralText
            text={HEAD_LEARN}
            className="display-italic"
            startDelay={0.18 + HEAD_LINE_1.length * 0.022}
            style={{ color: 'var(--landing-fg-muted)' }}
          />
          <br />
          <NeuralText
            text={HEAD_LINE_2}
            startDelay={
              0.18 + (HEAD_LINE_1.length + HEAD_LEARN.length) * 0.022 + 0.05
            }
          />
          <NeuralText
            text={HEAD_BECOME}
            className="display-italic gradient-text"
            startDelay={
              0.18 +
              (HEAD_LINE_1.length + HEAD_LEARN.length + HEAD_LINE_2.length) *
                0.022 +
              0.05
            }
          />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: HEADLINE_TOTAL_S - 0.1, ease: 'easeOut' }}
          style={{
            fontSize: 17,
            lineHeight: 1.55,
            color: 'var(--landing-fg-muted)',
            maxWidth: 560,
            margin: 0,
          }}
        >
          An AI tutor grounded in your own study material — ask anything, get cited answers, diagrams and practice problems.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: HEADLINE_TOTAL_S, ease: 'easeOut' }}
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <Link to="/signup" style={{ textDecoration: 'none' }}>
            <MarketingButton size="lg" iconRight={ArrowRight}>
              Start free
            </MarketingButton>
          </Link>
          <Link to="/login" style={{ textDecoration: 'none' }}>
            <MarketingButton size="lg" variant="secondary">
              Log in
            </MarketingButton>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: HEADLINE_TOTAL_S + 0.15 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            color: 'var(--landing-fg-faint)',
            fontSize: 11,
            letterSpacing: '0.08em',
            marginTop: 6,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#22D3EE',
                boxShadow: '0 0 10px #22D3EE',
                animation: 'mb-pulse 2.4s ease-in-out infinite',
              }}
            />
            AI TUTOR
          </span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>RAG-GROUNDED</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span>CITED ANSWERS</span>
        </motion.div>
      </motion.div>
    </section>
  )
}
