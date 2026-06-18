import { cn } from "@/lib/cn";

interface TagProps {
  children: React.ReactNode;
  variant?: "default" | "saffron" | "moss" | "outline";
  className?: string;
}

export function Tag({ children, variant = "default", className }: TagProps) {
  const styles = {
    default: "bg-bone text-ink",
    saffron: "bg-saffron/10 text-saffron-dk",
    moss: "bg-moss/10 text-moss",
    outline: "border border-ink/15 text-ink",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
