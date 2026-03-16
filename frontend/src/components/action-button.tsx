"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionButtonProps {
  label: string;
  loadingLabel?: string;
  icon: React.ReactNode;
  onClick: () => Promise<unknown>;
  onSuccess?: () => void;
  variant?: "primary" | "secondary";
  className?: string;
}

export function ActionButton({
  label,
  loadingLabel,
  icon,
  onClick,
  onSuccess,
  variant = "primary",
  className,
}: ActionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setResult(null);
    try {
      const res = await onClick();
      const msg =
        (res as Record<string, string>)?.message || "Done";
      setResult(msg);
      onSuccess?.();
      setTimeout(() => setResult(null), 5000);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Failed");
      setTimeout(() => setResult(null), 5000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors shadow-sm",
          variant === "primary"
            ? loading
              ? "bg-gray-100 text-gray-400"
              : "bg-blue-600 text-white hover:bg-blue-700"
            : loading
            ? "bg-gray-50 text-gray-400 border border-gray-200"
            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
          className
        )}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          icon
        )}
        {loading ? (loadingLabel || "Running...") : label}
      </button>
      {result && (
        <span
          className={cn(
            "text-xs px-2 py-1 rounded",
            result.toLowerCase().includes("fail") || result.toLowerCase().includes("error")
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          )}
        >
          {result}
        </span>
      )}
    </div>
  );
}
