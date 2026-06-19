type ComingSoonBadgeProps = {
  className?: string;
  compact?: boolean;
};

/** Small label for features not launched yet (Shop, Tickets, etc.). */
export function ComingSoonBadge({ className = "", compact = false }: ComingSoonBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-amber/50 bg-amber/15 font-mono font-bold uppercase tracking-wider text-amber ${compact ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[9px]"} ${className}`}
    >
      {compact ? "Soon" : "Coming soon"}
    </span>
  );
}
