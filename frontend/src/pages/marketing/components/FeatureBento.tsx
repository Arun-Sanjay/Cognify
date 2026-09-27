import { motion } from 'framer-motion'
import {
  BookOpen,
  Library,
  Network,
  ListChecks,
  Mic,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'

interface Feature {
  id: string
  icon: LucideIcon
  title: string
  desc: string
  size?: 'large' | 'wide' | 'standard'
}

const FEATURES: Feature[] = [
  {
    id: 'assistant',
    icon: BookOpen,
    title: 'AI Assistant',
    desc: 'Chat with your actual study material. Streaming answers grounded in cited document chunks via pgvector RAG.',
    size: 'large',
  },
  {
    id: 'library',
    icon: Library,
    title: 'Your Library',
    desc: 'Upload PDFs, slides and notes — chunked and embedded automatically.',
  },
  {
    id: 'diagrams',
    icon: Network,
    title: 'Diagrams on demand',
    desc: 'Ask for a visual and get a rendered Mermaid diagram.',
  },
  {
    id: 'practice',
    icon: ListChecks,
    title: 'Practice problems',
    desc: 'Solved walkthroughs and unsolved problems with hints.',
  },
  {
    id: 'private',
    icon: ShieldCheck,
    title: 'Private notes',
    desc: 'Your uploads stay yours — shared material is curated by educators.',
  },
  {
    id: 'voice',
    icon: Mic,
    title: 'Voice-ready',
    desc: 'Speech in and out, with graceful fallback to the browser.',
    size: 'wide',
  },
]

const card = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
}

export default function FeatureBento() {
  return (
    <section id="features" className="section">
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span className="eyebrow">What's inside</span>
          <h2
            className="display"
            style={{
              fontSize: 'clamp(32px, 5vw, 56px)',
              margin: '12px 0 14px',
            }}
          >
            Everything you need to learn.{' '}
            <span className="gradient-text">One platform.</span>
          </h2>
          <p
            style={{
              color: 'var(--landing-fg-muted)',
              maxWidth: 620,
              margin: '0 auto',
              fontSize: 16,
              lineHeight: 1.6,
            }}
          >
            An AI tutor that answers from your material — with sources, diagrams and practice built in.
          </p>
        </div>

        <div className="bento">
          {FEATURES.map((f, i) => {
            const sizeClass =
              f.size === 'large' ? 'bento-large' : f.size === 'wide' ? 'bento-wide' : ''
            return (
              <motion.div
                key={f.id}
                {...card}
                transition={{ ...card.transition, delay: i * 0.04 }}
                className={`tile glow-border ${sizeClass}`}
                style={{ padding: 0 }}
              >
                {/* Accent wash in place of a screenshot */}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'radial-gradient(120% 90% at 85% 0%, rgba(139,92,246,0.22), transparent 60%), radial-gradient(90% 70% at 0% 100%, rgba(34,211,238,0.14), transparent 60%)',
                    zIndex: 0,
                  }}
                />
                {/* Dark gradient overlay so the metadata reads cleanly */}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(180deg, rgba(6,7,10,0) 35%, rgba(6,7,10,0.55) 65%, rgba(6,7,10,0.92) 100%)',
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 20,
                    right: 20,
                    bottom: 18,
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                  }}
                >
                  <div className="tile-icon">
                    <f.icon size={20} strokeWidth={2} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3
                      className="display"
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        margin: '0 0 4px',
                        color: 'var(--landing-fg)',
                      }}
                    >
                      {f.title}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: 'var(--landing-fg-muted)',
                        lineHeight: 1.5,
                      }}
                    >
                      {f.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
