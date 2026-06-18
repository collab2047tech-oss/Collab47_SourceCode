"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { ArrowRight } from "lucide-react";
import { forwardRef } from "react";

const button = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-out-soft disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-saffron text-cream hover:bg-saffron-dk active:scale-[0.98]",
        secondary:
          "bg-transparent text-ink border border-ink/15 hover:border-ink hover:bg-ink hover:text-cream",
        ghost: "bg-transparent text-ink hover:bg-bone",
        destructive: "bg-ember text-cream hover:opacity-90",
        link: "text-ink underline underline-offset-4 decoration-saffron decoration-2 hover:text-saffron px-0",
      },
      size: {
        sm: "h-9 px-4 text-sm rounded-md",
        md: "h-11 px-5 text-base rounded-lg",
        lg: "h-14 px-7 text-lg rounded-lg",
        xl: "h-16 px-9 text-xl rounded-xl",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  withArrow?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, withArrow, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(button({ variant, size }), className)}
        {...props}
      >
        {children}
        {withArrow ? (
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
        ) : null}
      </button>
    );
  }
);
Button.displayName = "Button";
