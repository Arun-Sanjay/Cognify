import { Link } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import { ArrowRight, Library, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Card from '../../components/ui/Card'
import { useAuthStore } from '../../store/authStore'

const stagger: Variants = { animate: { transition: { staggerChildren: 0.05 } } }
const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
}

interface QuickLink {
  to: string
  icon: LucideIcon
  title: string
  description: string
}

/**
 * Role home for students + teachers. A deliberately thin starting point —
 * replace with the real dashboard as Cognify's features land.
 */
export default function HomePage() {
  const user = useAuthStore((s) => s.user)
  const base = `/${user?.role ?? 'student'}`
  const firstName = user?.full_name.split(' ')[0] ?? 'there'

  const links: QuickLink[] = [
    {
      to: `${base}/assistant`,
      icon: Sparkles,
      title: 'AI Assistant',
      description: 'Ask questions answered from the knowledge base, with citations.',
    },
    {
      to: `${base}/library`,
      icon: Library,
      title: 'Library',
      description:
        user?.role === 'student'
          ? 'Upload your own notes and browse shared material.'
          : 'Upload study material that powers the assistant for everyone.',
    },
  ]

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Welcome, {firstName}</h2>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          Your Cognify workspace. More is on the way.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-2">
        {links.map(({ to, icon: Icon, title, description }) => (
          <Link key={to} to={to} className="group">
            <Card hover className="h-full">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-[var(--text-primary)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
                    <ArrowRight className="h-4 w-4 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{description}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </motion.div>
    </motion.div>
  )
}
