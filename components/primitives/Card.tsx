import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-bone bg-paper p-6 transition-all duration-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-h3 font-semibold text-ink", className)}>
      {children}
    </h3>
  );
}

export function CardMeta({
  className,
  children,
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-caption text-ash", className)}>{children}</p>
  );
}
