import { cva } from "class-variance-authority"

// Kept out of button.tsx so that file only exports components (react-refresh).
//
// The variant *names* are shadcn's and are load-bearing — feature code already
// passes `outline`, `ghost`, `sm`, `icon-sm` and friends — so DESIGN.md's button
// table is mapped onto them rather than replacing them:
//
//   DESIGN "Primary"      -> variant="default"      (blue-700 -> blue-900 gradient)
//   DESIGN "Ghost"        -> variant="outline"      (white, slate border)
//   DESIGN "Danger ghost" -> variant="danger-ghost" (added; red outline, quiet)
//
// shadcn's own `ghost` stays a truly transparent button, which is what the icon
// buttons want; `destructive` is left defined for the type but is unused on
// purpose — a previous pass removed every loud destructive button in the app.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-blue-700 to-blue-900 text-white shadow-md hover:brightness-110",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border border-slate-300 bg-white text-slate-700 shadow-xs hover:bg-slate-50",
        "danger-ghost":
          "border border-red-200 bg-white text-red-500 hover:bg-red-50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-5 py-2 has-[>svg]:px-4",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3.5 text-[12.5px] has-[>svg]:px-3",
        lg: "h-10 px-6 has-[>svg]:px-5",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
