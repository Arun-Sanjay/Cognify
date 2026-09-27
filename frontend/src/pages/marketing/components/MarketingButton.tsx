import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'md' | 'lg'

interface MarketingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  iconRight?: LucideIcon
  loading?: boolean
  children?: ReactNode
}

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
}

const MarketingButton = forwardRef<HTMLButtonElement, MarketingButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon: Icon,
      iconRight: IconRight,
      loading = false,
      disabled,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        className={clsx(
          'btn',
          size === 'lg' && 'btn-lg',
          variantClass[variant],
          className,
        )}
        {...rest}
      >
        {Icon && !loading && <Icon size={16} strokeWidth={2.25} />}
        {loading && (
          <span
            aria-hidden
            style={{
              width: 14,
              height: 14,
              border: '2px solid currentColor',
              borderRightColor: 'transparent',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'mb-spin 0.7s linear infinite',
            }}
          />
        )}
        {children}
        {IconRight && !loading && <IconRight size={16} strokeWidth={2.25} />}
      </button>
    )
  },
)

MarketingButton.displayName = 'MarketingButton'

export default MarketingButton
