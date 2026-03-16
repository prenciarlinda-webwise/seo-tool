import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  trend?: { value: number; label?: string };
  className?: string;
}

export default function StatCard({
  label,
  value,
  sub,
  icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-gray-200 p-5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {icon && <span className="text-gray-400">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      {(sub || trend) && (
        <div className="mt-1 flex items-center gap-2 text-sm">
          {trend && (
            <span
              className={cn(
                "font-medium",
                trend.value > 0
                  ? "text-green-600"
                  : trend.value < 0
                  ? "text-red-600"
                  : "text-gray-400"
              )}
            >
              {trend.value > 0 ? "+" : ""}
              {trend.value}
              {trend.label ? ` ${trend.label}` : ""}
            </span>
          )}
          {sub && <span className="text-gray-400">{sub}</span>}
        </div>
      )}
    </div>
  );
}
