import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'

interface MarketingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: LucideIcon
  error?: string
}

const MarketingInput = forwardRef<HTMLInputElement, MarketingInputProps>(
  ({ label, icon: Icon, error, className, id, ...rest }, ref) => {
    const reactId = useId()
    const inputId = id ?? reactId
    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="lbl">
            {label}
          </label>
        )}
        <div className="input-wrap">
          {Icon && <Icon aria-hidden />}
          <input
            ref={ref}
            id={inputId}
            className={clsx('input', Icon && 'input-with-icon', className)}
            {...rest}
          />
        </div>
        {error && (
          <p
            style={{
              fontSize: 12,
              marginTop: 6,
              color: '#FCA5A5',
            }}
          >
            {error}
          </p>
        )}
      </div>
    )
  },
)

MarketingInput.displayName = 'MarketingInput'

export default MarketingInput
