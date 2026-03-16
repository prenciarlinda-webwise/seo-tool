import { cn } from "@/lib/utils";

const colors: Record<string, string> = {
  tracked: "bg-green-100 text-green-800",
  discovered: "bg-blue-100 text-blue-800",
  ignored: "bg-gray-100 text-gray-600",
  paused: "bg-yellow-100 text-yellow-800",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize",
        colors[status] || "bg-gray-100 text-gray-600"
      )}
    >
      {status}
    </span>
  );
}
