import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

export const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-zinc-900 text-zinc-50 shadow hover:bg-zinc-800',
        secondary: 'border-transparent bg-zinc-100 text-zinc-900 hover:bg-zinc-200',
        destructive: 'border-transparent bg-red-100 text-red-700 border-red-200',
        outline: 'border-zinc-200 text-zinc-700 bg-white',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        amber: 'border-amber-300 bg-amber-50 text-amber-800',
        blue: 'border-blue-200 bg-blue-50 text-blue-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
