import { cn } from "@/lib/cn";
import { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className="flex w-full flex-col gap-2">
        {label ? (
          <label htmlFor={inputId} className="text-caption text-ink">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-12 w-full rounded-md border border-ink/15 bg-paper px-4 text-base text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";
