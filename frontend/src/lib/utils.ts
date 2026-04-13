import clsx from "clsx";

export function cn(...inputs: (string | undefined | false | null)[]) {
  return clsx(inputs);
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString();
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null) return "-";
  return `${(n * 100).toFixed(1)}%`;
}

export function rankChangeDisplay(change: number | null): {
  text: string;
  color: string;
} {
  if (change == null || change === 0) return { text: "-", color: "text-gray-400" };
  if (change > 0)
    return { text: `+${change}`, color: "text-green-600" };
  return { text: `${change}`, color: "text-red-600" };
}

export function rankBadgeColor(rank: number | null): string {
  if (rank == null) return "bg-gray-100 text-gray-500";
  if (rank <= 3) return "bg-green-100 text-green-800";
  if (rank <= 10) return "bg-blue-100 text-blue-800";
  if (rank <= 20) return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-600";
}

/**
 * Build a Google SERP URL for a keyword with location targeting.
 * Uses &near= for local results.
 * If a DataForSEO check_url exists, prefer that (it's exact).
 */
export function buildSerpUrl(keyword: string, location?: string, dataforseoUrl?: string): string {
  if (dataforseoUrl) return dataforseoUrl;
  const q = encodeURIComponent(keyword);
  if (location) {
    return `https://www.google.com/search?q=${q}&near=${encodeURIComponent(location)}`;
  }
  return `https://www.google.com/search?q=${q}`;
}
