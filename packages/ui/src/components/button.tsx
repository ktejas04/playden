import * as React from "react";
import { cn } from "cn";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

// Solid buttons are game pieces: a thicker bottom edge that lifts on hover and
// presses flat on tap. Hover lift only applies to real pointers, not touch.
const pressable =
  "shadow-[0_3px_0_0_var(--edge)] [@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:shadow-[0_4px_0_0_var(--edge)] active:translate-y-[3px] active:shadow-[0_0_0_0_var(--edge)]";

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-transparent font-heading font-semibold whitespace-nowrap outline-none select-none transition-[translate,box-shadow,background-color,color,filter] duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-3 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: cn(
          "bg-primary text-primary-foreground [--edge:var(--primary-edge)] hover:brightness-[1.04]",
          pressable,
        ),
        secondary: cn(
          "bg-secondary text-secondary-foreground [--edge:var(--secondary-edge)] hover:brightness-[1.03]",
          pressable,
        ),
        outline: cn(
          "border-input bg-card text-foreground [--edge:var(--input)] hover:bg-muted",
          pressable,
        ),
        destructive: cn(
          "bg-destructive text-white [--edge:var(--destructive-edge)] hover:brightness-[1.05]",
          pressable,
        ),
        ghost: "text-foreground hover:bg-foreground/[0.06] active:bg-foreground/10",
        link: "h-auto px-0 text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:decoration-[3px]",
      },
      size: {
        default: "h-10 px-4 text-sm",
        xs: "h-7 rounded-lg px-2.5 text-xs",
        sm: "h-8 rounded-lg px-3 text-sm",
        lg: "h-12 px-5 text-base",
        xl: "h-14 px-6 text-lg",
        icon: "size-10",
        "icon-xs": "size-7 rounded-lg",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
