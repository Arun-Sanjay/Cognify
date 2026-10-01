import { clsx } from 'clsx'
import Badge from '../ui/Badge'
import { LEVEL_BADGE, LEVEL_LABEL, readinessColor } from './quizFormat'
import type { SkillView } from '../../types'

/** Readiness (0–100) bar; faded while the estimate is still uncertain. */
export function ReadinessBar({ value, uncertain, className }: { value: number; uncertain?: boolean; className?: string }) {
  return (
    <div className={clsx('h-1.5 w-full rounded-full bg-[var(--bg-tertiary)] overflow-hidden', className)}>
      <div
        className={clsx('h-full rounded-full transition-all duration-500', readinessColor(value), uncertain && 'opacity-50')}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export function MasteryBadge({ skill }: { skill: SkillView }) {
  return (
    <Badge size="sm" variant={LEVEL_BADGE[skill.level]}>
      {LEVEL_LABEL[skill.level]}
    </Badge>
  )
}

/** Compact readiness readout: bar + number, or "—" before any practice. */
export function SkillMeter({ skill, className }: { skill: SkillView; className?: string }) {
  if (!skill.attempts) {
    return <span className={clsx('text-[11px] text-[var(--text-tertiary)]', className)}>Not practised</span>
  }
  return (
    <div className={clsx('flex items-center gap-2', className)} title={`Readiness ${skill.readiness} / 100 after ${skill.attempts} answers`}>
      <ReadinessBar value={skill.readiness} uncertain={skill.uncertainty > 0.6} className="flex-1" />
      <span className="w-7 text-right text-[11px] tabular-nums text-[var(--text-secondary)]">{Math.round(skill.readiness)}</span>
    </div>
  )
}
