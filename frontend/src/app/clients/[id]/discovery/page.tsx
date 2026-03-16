"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  Crosshair,
  Globe,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  fetchDiscoveryRuns,
  fetchDiscoveryResults,
  promoteKeywords,
  runDiscovery,
  type DiscoveryRun,
  type DiscoveryResult,
} from "@/lib/api";
import { ActionButton } from "@/components/action-button";
import { cn, formatNumber } from "@/lib/utils";

type SourceFilter = "all" | "ranked" | "competitor_gap";
type FlagFilter = "all" | "new" | "interesting";

function RankBadge({ rank }: { rank: number | null }) {
  if (rank == null) return <span className="text-gray-300">N/A</span>;
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

export default function DiscoveryPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<DiscoveryRun | null>(null);
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [flagFilter, setFlagFilter] = useState<FlagFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDiscoveryRuns(clientId)
      .then((res) => {
        setRuns(res.results);
        if (res.results.length > 0) setSelectedRun(res.results[0]);
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => {
    if (!selectedRun) return;
    setLoadingResults(true);
    const params: string[] = [];
    if (sourceFilter !== "all") params.push(`source=${sourceFilter}`);
    if (flagFilter === "new") params.push("is_new=true");
    if (flagFilter === "interesting") params.push("is_interesting=true");
    const qs = params.length > 0 ? params.join("&") : undefined;

    fetchDiscoveryResults(clientId, selectedRun.id, qs)
      .then((res) => setResults(res.results))
      .finally(() => setLoadingResults(false));
  }, [clientId, selectedRun, sourceFilter, flagFilter]);

  function toggleSelect(kw: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === filteredResults.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredResults.map((r) => r.keyword_text)));
    }
  }

  async function handlePromote() {
    if (selected.size === 0) return;
    await promoteKeywords(clientId, Array.from(selected));
    setSelected(new Set());
    if (selectedRun) {
      const res = await fetchDiscoveryResults(clientId, selectedRun.id);
      setResults(res.results);
    }
  }

  const filteredResults = results.filter(
    (r) =>
      !searchQuery ||
      r.keyword_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const rankedCount = results.filter(
    (r) => !r.source || r.source === "ranked"
  ).length;
  const gapCount = results.filter(
    (r) => r.source === "competitor_gap"
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">
          Keyword Discovery
        </h1>
        <ActionButton
          label="Run Discovery"
          loadingLabel="Discovering..."
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => runDiscovery(clientId)}
          onSuccess={() => {
            fetchDiscoveryRuns(clientId).then((res) => {
              setRuns(res.results);
              if (res.results.length > 0) setSelectedRun(res.results[0]);
            });
          }}
        />
      </div>
      <p className="text-sm text-gray-500 mb-5">
        Find new keyword opportunities from your existing rankings and competitor gaps
      </p>

      {runs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Search className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-1">No discovery runs yet</p>
          <p className="text-sm text-gray-400">
            Runs happen automatically on the 1st of each month
          </p>
        </div>
      ) : (
        <>
          {/* Run selector + source tabs */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <select
              value={selectedRun?.id ?? ""}
              onChange={(e) => {
                const run = runs.find((r) => r.id === Number(e.target.value));
                setSelectedRun(run || null);
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.run_date} — {run.total_keywords_found} keywords (
                  {run.new_keywords_found} new)
                </option>
              ))}
            </select>
          </div>

          {/* Source tabs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <button
              onClick={() => setSourceFilter("all")}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
                sourceFilter === "all"
                  ? "border-blue-500 bg-blue-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">All Keywords</p>
                <p className="text-xs text-gray-500">{results.length} total</p>
              </div>
            </button>

            <button
              onClick={() => setSourceFilter("ranked")}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
                sourceFilter === "ranked"
                  ? "border-green-500 bg-green-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Already Ranking</p>
                <p className="text-xs text-gray-500">
                  {rankedCount} keywords you rank for but aren't tracking
                </p>
              </div>
            </button>

            <button
              onClick={() => setSourceFilter("competitor_gap")}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
                sourceFilter === "competitor_gap"
                  ? "border-purple-500 bg-purple-50 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Crosshair className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Competitor Gap</p>
                <p className="text-xs text-gray-500">
                  {gapCount} keywords competitors rank for
                </p>
              </div>
            </button>
          </div>

          {/* Filters + actions bar */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(["all", "new", "interesting"] as FlagFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFlagFilter(f)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors",
                    flagFilter === f
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md w-56"
              />
            </div>

            {selected.size > 0 && (
              <button
                onClick={handlePromote}
                className="px-4 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm"
              >
                Promote {selected.size} to Tracked
              </button>
            )}
          </div>

          {/* Results table */}
          {loadingResults ? (
            <div className="text-gray-500 py-12 text-center">Loading...</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2.5 w-8">
                      <input
                        type="checkbox"
                        checked={
                          selected.size > 0 &&
                          selected.size === filteredResults.length
                        }
                        onChange={selectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      Keyword
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">
                      Rank
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">
                      Volume
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">
                      KD
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">
                      CPC
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-12 text-center text-sm text-gray-500"
                      >
                        No keywords match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-blue-50/30 transition-colors"
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(r.keyword_text)}
                            onChange={() => toggleSelect(r.keyword_text)}
                            disabled={r.is_promoted}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {r.keyword_text}
                            </span>
                            {r.is_new && (
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded">
                                New
                              </span>
                            )}
                            {r.is_interesting && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded">
                                <Sparkles className="h-2.5 w-2.5 inline" />
                              </span>
                            )}
                            {r.is_promoted && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded">
                                Tracked
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <RankBadge rank={r.rank_absolute} />
                        </td>
                        <td className="px-3 py-2.5 text-center text-sm text-gray-600">
                          {formatNumber(r.search_volume)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {r.keyword_difficulty != null ? (
                            <span
                              className={cn(
                                "text-sm font-medium",
                                r.keyword_difficulty <= 30
                                  ? "text-green-600"
                                  : r.keyword_difficulty <= 60
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              )}
                            >
                              {r.keyword_difficulty}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center text-sm text-gray-600">
                          {r.cpc != null ? `$${r.cpc}` : "-"}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.source === "competitor_gap" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-medium rounded">
                              <Crosshair className="h-2.5 w-2.5" />
                              {r.competitor_domain || "Competitor"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-medium rounded">
                              <TrendingUp className="h-2.5 w-2.5" />
                              Ranking
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-400">
                Showing {filteredResults.length} of {results.length} keywords
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
