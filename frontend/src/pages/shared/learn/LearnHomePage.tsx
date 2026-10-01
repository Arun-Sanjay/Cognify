import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import { clsx } from 'clsx'
import { ArrowRight, GraduationCap, Layers, ListChecks, LoaderCircle, Lock, PlayCircle } from 'lucide-react'
import { learnApi } from '../../../api/client'
import { useAuthStore } from '../../../store/authStore'
import type { LearnCatalog } from '../../../types'

const stagger: Variants = { animate: { transition: { staggerChildren: 0.04 } } }
const fadeUp: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
}

/** Learn home: pick a subject (GATE paper), then a unit (syllabus section). */
export default function LearnHomePage() {
  const role = useAuthStore((s) => s.user?.role ?? 'student')
  const [catalog, setCatalog] = useState<LearnCatalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [subjectId, setSubjectId] = useState<string | null>(null)

  useEffect(() => {
    learnApi
      .catalog()
      .then((data) => {
        setCatalog(data)
        setSubjectId((cur) => cur ?? data.subjects[0]?.id ?? null)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load courses'))
  }, [])

  const subject = catalog?.subjects.find((s) => s.id === subjectId)

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] flex items-center justify-center shrink-0">
          <GraduationCap className="h-5 w-5 text-[var(--text-primary)]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Learn</h2>
          <p className="text-sm text-[var(--text-tertiary)] mt-1 max-w-2xl">
            Complete GATE units built from the best lectures on YouTube: a Hinglish and an English pick for every
            topic, each with a transcript, AI study notes and a tutor you can question.
          </p>
        </div>
      </motion.div>

      {error && <div className="card p-4 text-sm text-danger">{error}</div>}
      {!catalog && !error && (
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Loading courses…
        </div>
      )}

      {catalog && catalog.subjects.length > 1 && (
        <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
          {catalog.subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSubjectId(s.id)}
              className={clsx(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                s.id === subjectId
                  ? 'border-[var(--border-strong)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              {s.code} · {s.name}
            </button>
          ))}
        </motion.div>
      )}

      {subject && (
        <>
          <motion.div variants={fadeUp} className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-[var(--border-strong)] px-2 py-0.5 text-xs font-bold text-[var(--text-primary)]">
                {subject.code}
              </span>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{subject.name}</h3>
            </div>
            {subject.description && (
              <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-3xl">{subject.description}</p>
            )}
          </motion.div>

          <motion.div variants={stagger} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subject.units.map((unit) => {
              const body = (
                <div className={clsx('h-full flex flex-col', !unit.available && 'opacity-50')}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                      Unit {unit.number ?? ''}
                    </span>
                    {unit.available ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                        <PlayCircle className="h-3 w-3" /> Live
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--text-tertiary)]">
                        <Lock className="h-3 w-3" /> Coming soon
                      </span>
                    )}
                  </div>
                  <h4 className="mt-2 font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    {unit.name}
                    {unit.available && (
                      <ArrowRight className="h-4 w-4 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5" />
                    )}
                  </h4>
                  <p className="mt-1.5 text-[13px] text-[var(--text-secondary)] line-clamp-3 flex-1">{unit.syllabus}</p>
                  {unit.available && (
                    <div className="mt-3 flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                      <span className="inline-flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" /> {unit.topic_count} topics
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <PlayCircle className="h-3.5 w-3.5" /> {unit.lecture_count} lectures
                      </span>
                      {unit.has_quiz && (
                        <span className="inline-flex items-center gap-1">
                          <ListChecks className="h-3.5 w-3.5" /> Quizzes
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
              return (
                <motion.div key={unit.id} variants={fadeUp}>
                  {unit.available ? (
                    <Link to={`/${role}/learn/${subject.id}/${unit.id}`} className="group block h-full">
                      <div className="card-hover h-full p-4">{body}</div>
                    </Link>
                  ) : (
                    <div className="card p-4 h-full" aria-disabled="true">
                      {body}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
