"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { fetchPages, type PageData, type PageKeyword } from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";

function RankBadgeSmall({ rank }: { rank: number | null }) {
  if (rank == null) return <span className="text-gray-300">-</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-8 h-6 rounded text-xs font-semibold",
        rank <= 3
          ? "bg-green-500 text-white"
          : rank <= 10
          ? "bg-green-100 text-green-800"
          : rank <= 20
          ? "bg-yellow-100 text-yellow-800"
          : rank <= 50
          ? "bg-orange-100 text-orange-800"
          : "bg-red-100 text-red-800"
      )}
    >
      {rank}
    </span>
  );
}

function ChangeIndicator({ change }: { change: number | null }) {
  if (change == null || change === 0) return <span className="text-gray-300 text-xs">-</span>;
  if (change > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-green-600 text-xs font-medium">
        <TrendingUp className="h-3 w-3" />
        {change}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-red-600 text-xs font-medium">
      <TrendingDown className="h-3 w-3" />
      {Math.abs(change)}
    </span>
  );
}

function PageRow({ page }: { page: PageData }) {
  const [expanded, setExpanded] = useState(false);

  let displayPath = page.url;
  try {
    const u = new URL(page.url);
    displayPath = u.pathname || "/";
  } catch {
    // keep full url
  }

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-blue-50/30 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}

        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">
              {displayPath}
            </p>
            {page.in_plan && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-medium rounded flex-shrink-0">
                <ClipboardList className="h-2.5 w-2.5" />
                Plan ({page.plan_keywords_count})
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">{page.url}</p>
        </div>

        <div className="flex items-center gap-5 flex-shrink-0">
          {/* Keywords */}
          <div className="text-center w-16">
            <p className="text-lg font-bold text-blue-600">{page.total_keywords}</p>
            <p className="text-[10px] text-gray-400">Keywords</p>
          </div>

          {/* Traffic */}
          <div className="text-center w-16">
            <div className="flex items-center justify-center gap-0.5">
              <Zap className="h-3 w-3 text-amber-500" />
              <p className="text-sm font-semibold text-gray-900">
                {page.total_traffic != null ? formatNumber(Math.round(page.total_traffic)) : "-"}
              </p>
            </div>
            <p className="text-[10px] text-gray-400">Traffic/mo</p>
          </div>

          {/* Best position */}
          <div className="text-center w-14">
            <RankBadgeSmall rank={page.best_position} />
            <p className="text-[10px] text-gray-400 mt-0.5">Best</p>
          </div>

          {/* Avg position */}
          <div className="text-center w-14">
            <p className="text-sm font-semibold text-gray-700">
              {page.avg_position ?? "-"}
            </p>
            <p className="text-[10px] text-gray-400">Avg</p>
          </div>

          {/* Volume */}
          <div className="text-center w-16">
            <p className="text-sm font-semibold text-gray-700">
              {formatNumber(page.total_volume)}
            </p>
            <p className="text-[10px] text-gray-400">Volume</p>
          </div>

          {/* Movement */}
          <div className="flex items-center gap-2 w-20">
            <div className="flex items-center gap-0.5">
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              <span className="text-sm font-medium text-green-600">{page.keywords_improved}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              <span className="text-sm font-medium text-red-600">{page.keywords_declined}</span>
            </div>
          </div>
        </div>
      </button>

      {/* Expanded keywords */}
      {expanded && (
        <div className="bg-gray-50/50 border-t border-gray-100">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-8 py-2 text-left text-[10px] font-medium text-gray-500 uppercase">Keyword</th>
                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 uppercase">Volume</th>
                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 uppercase">Traffic</th>
                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 uppercase">Rank</th>
                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 uppercase">Change</th>
                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 uppercase">Maps</th>
                <th className="px-3 py-2 text-center text-[10px] font-medium text-gray-500 uppercase">Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {page.keywords.map((kw) => (
                <tr key={kw.keyword_id} className="hover:bg-white">
                  <td className="px-8 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-gray-900">{kw.keyword_text}</span>
                      {kw.in_plan && (
                        <ClipboardList className="h-3 w-3 text-indigo-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center text-sm text-gray-600">
                    {formatNumber(kw.search_volume)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {kw.estimated_traffic != null ? (
                      <span className="text-sm text-amber-600 font-medium">
                        {Math.round(kw.estimated_traffic)}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <RankBadgeSmall rank={kw.rank} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <ChangeIndicator change={kw.rank_change} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <RankBadgeSmall rank={kw.maps_rank} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    {kw.in_plan ? (
                      <div className="flex items-center justify-center gap-1">
                        <Target className="h-3 w-3 text-indigo-500" />
                        <span className="text-xs text-indigo-600 font-medium">
                          Top {kw.plan_target_rank}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type SortKey = "keywords" | "traffic" | "position" | "volume";

export default function PagesPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);
  const [data, setData] = useState<PageData[]>([]);
  const [totalTraffic, setTotalTraffic] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("keywords");
  const [showPlanOnly, setShowPlanOnly] = useState(false);

  useEffect(() => {
    fetchPages(clientId)
      .then((res) => {
        setData(res.pages);
        setTotalTraffic(res.total_traffic);
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  let filtered = data.filter(
    (p) =>
      (!searchQuery || p.url.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (!showPlanOnly || p.in_plan)
  );

  // Sort
  filtered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "keywords":
        return b.total_keywords - a.total_keywords;
      case "traffic":
        return (b.total_traffic || 0) - (a.total_traffic || 0);
      case "position":
        return (a.avg_position || 999) - (b.avg_position || 999);
      case "volume":
        return b.total_volume - a.total_volume;
      default:
        return 0;
    }
  });

  const totalKeywords = data.reduce((s, p) => s + p.total_keywords, 0);
  const totalVolume = data.reduce((s, p) => s + p.total_volume, 0);
  const planPages = data.filter((p) => p.in_plan).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading pages...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Pages</h1>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Pages</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.length}</p>
          <p className="text-xs text-gray-400">{totalKeywords} total keywords</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Est. Traffic</p>
          <div className="flex items-baseline gap-1 mt-1">
            <Zap className="h-4 w-4 text-amber-500" />
            <p className="text-2xl font-bold text-gray-900">{formatNumber(Math.round(totalTraffic))}</p>
          </div>
          <p className="text-xs text-gray-400">monthly organic visits</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Volume</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(totalVolume)}</p>
          <p className="text-xs text-gray-400">monthly searches</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">In Active Plan</p>
          <div className="flex items-baseline gap-1 mt-1">
            <ClipboardList className="h-4 w-4 text-indigo-500" />
            <p className="text-2xl font-bold text-indigo-600">{planPages}</p>
          </div>
          <p className="text-xs text-gray-400">pages being worked on</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          />
        </div>

        <button
          onClick={() => setShowPlanOnly(!showPlanOnly)}
          className={cn(
            "px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5",
            showPlanOnly
              ? "bg-indigo-50 border-indigo-300 text-indigo-700"
              : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
          )}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          In Plan Only
        </button>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 ml-auto">
          {(
            [
              { key: "keywords", label: "Keywords" },
              { key: "traffic", label: "Traffic" },
              { key: "position", label: "Position" },
              { key: "volume", label: "Volume" },
            ] as { key: SortKey; label: string }[]
          ).map((s) => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                sortBy === s.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pages list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="hidden md:flex items-center gap-3 px-5 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-medium text-gray-500 uppercase">
          <div className="w-8" />
          <div className="w-4" />
          <div className="flex-1">Page URL</div>
          <div className="w-16 text-center">Keywords</div>
          <div className="w-16 text-center">Traffic</div>
          <div className="w-14 text-center">Best</div>
          <div className="w-14 text-center">Avg</div>
          <div className="w-16 text-center">Volume</div>
          <div className="w-20 text-center">Movement</div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            {data.length === 0
              ? "No pages with ranking data yet."
              : "No pages match your filter."}
          </div>
        ) : (
          filtered.map((page) => <PageRow key={page.url} page={page} />)
        )}

        <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-400">
          Showing {filtered.length} of {data.length} pages
        </div>
      </div>
    </div>
  );
}
