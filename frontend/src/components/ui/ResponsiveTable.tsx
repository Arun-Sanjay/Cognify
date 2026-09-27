import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface ResponsiveColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Use this column's value as the card title on mobile. */
  primary?: boolean
  /** Hide this column in the mobile card view. */
  hideOnMobile?: boolean
  className?: string
  headerClassName?: string
}

export interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string | number
  empty?: ReactNode
  onRowClick?: (row: T) => void
  className?: string
}

/**
 * One data source, two renderings: a real <table> at md+ (unchanged desktop
 * look, with overflow-x-auto as a safety net) and a stack of cards below md so
 * wide tables stop horizontally scrolling on phones. The `primary` column
 * becomes each card's title; the rest render as label:value rows.
 */
export default function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  empty = 'Nothing here yet.',
  onRowClick,
  className,
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) {
    return <div className="py-10 text-center text-sm text-[var(--text-tertiary)]">{empty}</div>
  }

  const primary = columns.find((c) => c.primary)
  const secondary = columns.filter((c) => !c.hideOnMobile && !c.primary)

  return (
    <>
      {/* md+ : real table */}
      <div className={clsx('hidden md:block overflow-x-auto scroll-touch', className)}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-default)] text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={clsx('px-4 py-3 font-medium text-[var(--text-tertiary)]', c.headerClassName)}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  'border-b border-[var(--border-subtle)] last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-[var(--bg-tertiary)]',
                )}
              >
                {columns.map((c) => (
                  <td key={c.key} className={clsx('px-4 py-3 text-[var(--text-primary)]', c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* < md : stacked cards */}
      <div className="md:hidden space-y-2">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={clsx('card p-3', onRowClick && 'cursor-pointer active:opacity-80 min-h-[44px]')}
          >
            {primary && (
              <div className="font-medium text-[var(--text-primary)] mb-2">{primary.render(row)}</div>
            )}
            {secondary.length > 0 && (
              <div className="space-y-1.5">
                {secondary.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-xs text-[var(--text-tertiary)] shrink-0">{c.header}</span>
                    <span className="text-[var(--text-primary)] text-right min-w-0 truncate">{c.render(row)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
