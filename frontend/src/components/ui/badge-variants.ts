import { cva } from "class-variance-authority"

// Kept out of badge.tsx so that file only exports components (react-refresh).
//
// `info` and `accent` are added for the two chips DESIGN.md keeps reusing — the
// blue "N Marks" pill on a question and the amber total-marks pill on an exam
// header. Both square the corners off, which the base class sets to a pill; the
// override survives because `cn` runs the result through tailwind-merge.
export const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        info: "rounded-md border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700",
        accent: "rounded-md bg-amber-500 px-2.5 py-1 font-bold text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
