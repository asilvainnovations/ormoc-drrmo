import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-action focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-action text-on-action hover:bg-action/80",
        secondary:
          "border-transparent bg-sunken text-ink hover:bg-sunken/80",
        destructive:
          "border-transparent bg-bad text-on-strong hover:bg-bad/80",
        outline: "text-ink border-line",
        success:
          "bg-ok-soft text-ok border-ok/30",
        warning:
          "bg-warn-soft text-warn border-warn/30",
        info:
          "border-transparent bg-action/10 text-action border-action/30",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-3 py-0.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
