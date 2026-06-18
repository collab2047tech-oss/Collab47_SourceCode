import { cn } from "@/lib/cn";

interface AvatarProps {
  name: string;
  src?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

const sizeClass = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
  "2xl": "size-32 text-3xl",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-full bg-bone font-semibold text-ink",
        sizeClass[size],
        className
      )}
      aria-label={name}
    >
      {src ? (
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}
