import { cn, rankBadgeColor, rankChangeDisplay } from "@/lib/utils";

export function RankBadge({ rank }: { rank: number | null }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        rankBadgeColor(rank)
      )}
    >
      {rank ?? "N/A"}
    </span>
  );
}

export function RankChange({ change }: { change: number | null }) {
  const { text, color } = rankChangeDisplay(change);
  return <span className={cn("text-sm font-medium", color)}>{text}</span>;
}
