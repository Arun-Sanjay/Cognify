import { clsx } from 'clsx'
import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
  className?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  options = [],
  placeholder = 'Select...',
  className,
  ...props
}, ref) => {
  return (
    <div className="space-y-1.5">
      {label && <label className="label">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          className={clsx(
            'input-base w-full appearance-none pr-10',
            error && 'border-danger focus:border-danger',
            className,
          )}
          {...props}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)] pointer-events-none" />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
})

Select.displayName = 'Select'
export default Select
