import { clsx } from 'clsx'

const sizes = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
  xl: 'h-14 w-14 text-lg',
} satisfies Record<string, string>

export type AvatarSize = keyof typeof sizes

export interface AvatarProps {
  name?: string
  src?: string
  size?: AvatarSize
  className?: string
}

export default function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={clsx('rounded-full object-cover', sizes[size], className)}
      />
    )
  }

  return (
    <div
      className={clsx(
        'rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-semibold',
        'flex items-center justify-center shrink-0',
        sizes[size],
        className,
      )}
    >
      {initials}
    </div>
  )
}
