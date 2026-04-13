"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Camera,
  Calendar,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  fetchCheckDates,
  fetchLatestRankings,
  fetchCompetitors,
  fetchCompetitorRankings,
  createCompetitor,
  deleteCompetitor,
  runRanks,
  type CheckDate,
  type LatestRank,
  type LatestRankingsResponse,
  type CompetitorData,
  type CompetitorRankingsResponse,
  type RankTypeSummary,
} from "@/lib/api";
import { ActionButton } from "@/components/action-button";
import { cn, formatNumber, buildSerpUrl } from "@/lib/utils";

type RankFilter = "all" | "top10" | "top20" | "top50";

// ─── Change Cell ─────────────────────────────────────────────────────────────

function ChangeCell({ change }: { change: number | null }) {
  if (change == null) return <span className="text-gray-300">-</span>;
  if (change === 0) return <span className="text-gray-400 text-sm">=</span>;
  if (change > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-green-600 font-medium text-sm">
        <TrendingUp className="h-3 w-3" />
        {change}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-red-600 font-medium text-sm">
      <TrendingDown className="h-3 w-3" />
      {Math.abs(change)}
    </span>
  );
}

// ─── Rank Badge with SERP Popover ───────────────────────────────────────────

function RankBadge({
  rank,
  serpUrl,
  screenshotUrl,
  rankingUrl,
  change,
}: {
  rank: number | null;
  serpUrl?: string;
  screenshotUrl?: string;
  rankingUrl?: string;
  change?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (rank == null) return <span className="text-gray-300 font-medium">-</span>;

  const hasPopoverData = serpUrl || screenshotUrl || rankingUrl;
  const badgeClass = cn(
    "inline-flex items-center justify-center w-9 h-7 rounded font-semibold text-sm",
    hasPopoverData && "cursor-pointer hover:ring-2 hover:ring-blue-300",
    rank <= 3
      ? "bg-green-500 text-white"
      : rank <= 10
      ? "bg-green-100 text-green-800"
      : rank <= 20
      ? "bg-yellow-100 text-yellow-800"
      : rank <= 50
      ? "bg-orange-100 text-orange-800"
      : "bg-red-100 text-red-800"
  );

  if (!hasPopoverData) return <span className={badgeClass}>{rank}</span>;

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen(!open)} className={badgeClass}>{rank}</button>
      {open && (
        <div className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden" style={{ width: screenshotUrl ? "22rem" : "18rem" }}>
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className={cn("inline-flex items-center justify-center w-7 h-6 rounded text-xs font-bold", rank <= 3 ? "bg-green-500 text-white" : rank <= 10 ? "bg-green-100 text-green-800" : rank <= 20 ? "bg-yellow-100 text-yellow-800" : rank <= 50 ? "bg-orange-100 text-orange-800" : "bg-red-100 text-red-800")}>{rank}</span>
              <span className="text-sm font-medium text-gray-700">Position</span>
            </div>
            <div className="flex items-center gap-2">
              {change != null && <ChangeCell change={change} />}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-0.5 rounded hover:bg-gray-200"><X className="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <div className="p-3 space-y-3">
            {screenshotUrl && (
              <a href={screenshotUrl} target="_blank" rel="noopener noreferrer" className="block group">
                <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                  <img src={screenshotUrl} alt="SERP Screenshot" className="w-full h-36 object-cover object-top group-hover:opacity-90 transition-opacity" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                    <span className="text-white text-xs font-medium flex items-center gap-1 bg-black/30 rounded-full px-2.5 py-1"><Camera className="h-3 w-3" />View full screenshot</span>
                  </div>
                </div>
              </a>
            )}
            {rankingUrl && (
              <div className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-gray-400 font-medium mb-0.5 tracking-wide">Ranking URL</p>
                  <a href={rankingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 break-all leading-snug">
                    {rankingUrl.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
                  </a>
                </div>
              </div>
            )}
            {serpUrl && (
              <div className="flex items-start gap-2">
                <div className="w-1 h-1 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] uppercase text-gray-400 font-medium mb-0.5 tracking-wide">SERP Query</p>
                  <a href={serpUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1">
                    View SERP <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overview Cards ────────────────────────────────────────────────────────

function RankTypeCard({
  label,
  iconColor,
  borderColor,
  summary,
  totalKeywords,
}: {
  label: string;
  iconColor: string;
  borderColor: string;
  summary: RankTypeSummary;
  totalKeywords: number;
}) {
  const noData = summary.found === 0 && summary.avg_rank == null;

  return (
    <div className={cn("bg-white rounded-xl border p-5 shadow-sm", borderColor)}>
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("w-2.5 h-2.5 rounded-full", iconColor)} />
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {label}
        </p>
      </div>
      {noData ? (
        <p className="text-sm text-gray-400 mt-4">No data yet</p>
      ) : (
        <>
          <div className="mb-3">
            <span className="text-3xl font-bold text-gray-900">
              {summary.avg_rank != null ? summary.avg_rank : "-"}
            </span>
            <span className="text-xs text-gray-400 ml-1.5">avg position</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {summary.improved > 0 && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[11px] font-medium">
                <TrendingUp className="h-3 w-3" />
                {summary.improved}
              </span>
            )}
            {summary.declined > 0 && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-medium">
                <TrendingDown className="h-3 w-3" />
                {summary.declined}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>
              Found: <span className="font-semibold text-gray-700">{summary.found}/{totalKeywords}</span>
            </span>
            <span className="text-gray-300">|</span>
            <span>
              Top 3: <span className="font-semibold text-gray-700">{summary.in_top_3}</span>
            </span>
            {summary.in_top_10 != null && (
              <>
                <span className="text-gray-300">|</span>
                <span>
                  Top 10: <span className="font-semibold text-gray-700">{summary.in_top_10}</span>
                </span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Competitors Section ─────────────────────────────────────────────────────

function CompetitorsSection({
  clientSlug,
  dateCurrent,
}: {
  clientSlug: string;
  dateCurrent: string;
}) {
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [compData, setCompData] = useState<CompetitorRankingsResponse | null>(null);
  const [loadingCompetitors, setLoadingCompetitors] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formDomain, setFormDomain] = useState("");
  const [formName, setFormName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  function loadCompetitors() {
    setLoadingCompetitors(true);
    fetchCompetitors(clientSlug)
      .then((res) => setCompetitors(res.results))
      .finally(() => setLoadingCompetitors(false));
  }

  useEffect(() => { loadCompetitors(); }, [clientSlug]);

  useEffect(() => {
    if (competitors.length > 0 && dateCurrent) {
      fetchCompetitorRankings(clientSlug, dateCurrent).then(setCompData).catch(() => {});
    }
  }, [competitors, dateCurrent]);

  async function handleAdd() {
    if (!formDomain.trim()) return;
    setSubmitting(true);
    try {
      await createCompetitor(clientSlug, { domain: formDomain.trim(), name: formName.trim() || undefined });
      setFormDomain(""); setFormName(""); setShowForm(false);
      loadCompetitors();
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try { await deleteCompetitor(clientSlug, id); loadCompetitors(); }
    finally { setDeleting(null); }
  }

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">Competitors</h2>
          {competitors.length > 0 && <span className="text-xs text-gray-400">({competitors.length})</span>}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {showForm && (
        <div className="px-5 py-3 border-b border-gray-100 bg-blue-50/30 flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Domain</label>
            <input value={formDomain} onChange={(e) => setFormDomain(e.target.value)} placeholder="competitor.com" className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Name (optional)</label>
            <input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Competitor Name" className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
          </div>
          <button onClick={handleAdd} disabled={submitting} className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {submitting ? "Adding..." : "Add"}
          </button>
        </div>
      )}

      {competitors.length > 0 && (
        <div className="px-5 py-2 border-b border-gray-100 flex flex-wrap gap-2">
          {competitors.map((c) => (
            <div key={c.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-700">
              {c.domain}
              <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id} className="text-gray-400 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!loadingCompetitors && competitors.length === 0 && !showForm && (
        <div className="px-5 py-10 text-center text-sm text-gray-400">
          Add competitors to compare rankings
        </div>
      )}

      {compData && compData.keywords.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Keyword</th>
                {competitors.map((c) => (
                  <th key={c.id} className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase border-l border-gray-200">
                    {c.domain}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {compData.keywords.map((kw) => (
                <tr key={kw.keyword_id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2 text-sm text-gray-800">
                    <div className="flex items-center gap-2">
                      {kw.keyword_text}
                      {kw.client_rank && <RankBadge rank={kw.client_rank} />}
                    </div>
                  </td>
                  {competitors.map((c) => {
                    const cd = kw.competitors[c.id];
                    return (
                      <td key={c.id} className="px-4 py-2 text-center border-l border-gray-100">
                        {cd?.rank != null ? (
                          <div className="inline-flex items-center gap-1.5">
                            <RankBadge rank={cd.rank} />
                            {cd.change != null && cd.change !== 0 && <ChangeCell change={cd.change} />}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-sm">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function RankingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const clientSlug = slug;

  const [checkDates, setCheckDates] = useState<CheckDate[]>([]);
  const [compareDate, setCompareDate] = useState<string>("");
  const [data, setData] = useState<LatestRankingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rankFilter, setRankFilter] = useState<RankFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Load available dates for comparison
  useEffect(() => {
    fetchCheckDates(clientSlug).then((res) => {
      setCheckDates(res.dates);
      // Default compare to oldest complete date
      if (res.dates.length > 0) {
        setCompareDate(res.dates[res.dates.length - 1].date);
      }
    });
  }, [clientSlug]);

  // Load rankings — always reads from Keyword.current_* fields
  useEffect(() => {
    setLoading(true);
    fetchLatestRankings(clientSlug, compareDate || undefined)
      .then(setData)
      .finally(() => setLoading(false));
  }, [clientSlug, compareDate]);

  function reloadData() {
    fetchCheckDates(clientSlug).then((res) => setCheckDates(res.dates));
    fetchLatestRankings(clientSlug, compareDate || undefined).then(setData);
  }

  // Filtering
  const allKws = data?.keywords ?? [];
  const filteredKeywords = allKws.filter((kw) => {
    if (searchQuery && !kw.keyword_text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (rankFilter !== "all") {
      const maxRank = rankFilter === "top10" ? 10 : rankFilter === "top20" ? 20 : 50;
      const hasRank =
        (kw.organic_rank != null && kw.organic_rank <= maxRank) ||
        (kw.mobile_rank != null && kw.mobile_rank <= maxRank) ||
        (kw.maps_rank != null && kw.maps_rank <= maxRank);
      if (!hasRank) return false;
    }
    return true;
  });

  const countForFilter = (maxRank: number) =>
    allKws.filter((kw) =>
      (kw.organic_rank != null && kw.organic_rank <= maxRank) ||
      (kw.mobile_rank != null && kw.mobile_rank <= maxRank) ||
      (kw.maps_rank != null && kw.maps_rank <= maxRank)
    ).length;

  const filterOptions: { key: RankFilter; label: string }[] = [
    { key: "all", label: `All (${allKws.length})` },
    { key: "top10", label: `Top 10 (${countForFilter(10)})` },
    { key: "top20", label: `Top 20 (${countForFilter(20)})` },
    { key: "top50", label: `Top 50 (${countForFilter(50)})` },
  ];

  // Most recent complete check date for competitors
  const latestDate = checkDates.length > 0
    ? [...checkDates].sort((a, b) => b.keywords_checked - a.keywords_checked)[0]?.date || ""
    : "";

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Rank Tracker</h1>
        <ActionButton
          label="Run Check"
          loadingLabel="Starting..."
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => runRanks(clientSlug)}
          onSuccess={() => setTimeout(reloadData, 3000)}
        />
      </div>

      {/* Overview Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <RankTypeCard
            label="Desktop"
            iconColor="bg-blue-500"
            borderColor="border-blue-200"
            summary={data.summary.desktop}
            totalKeywords={data.summary.total_keywords}
          />
          <RankTypeCard
            label="Mobile"
            iconColor="bg-sky-400"
            borderColor="border-sky-200"
            summary={data.summary.mobile}
            totalKeywords={data.summary.total_keywords}
          />
          <RankTypeCard
            label="Local Pack"
            iconColor="bg-green-500"
            borderColor="border-green-200"
            summary={data.summary.local_pack}
            totalKeywords={data.summary.total_keywords}
          />
        </div>
      )}

      {/* Rankings Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Controls bar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          {/* Compare date selector */}
          {checkDates.length > 0 && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-600">Compare with:</span>
              <select
                value={compareDate}
                onChange={(e) => setCompareDate(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm bg-white"
              >
                <option value="">No comparison</option>
                {checkDates.map((d) => (
                  <option key={d.date} value={d.date}>
                    {d.date} ({d.keywords_checked} kw)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Rank filter */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 ml-auto">
            {filterOptions.map((f) => (
              <button
                key={f.key}
                onClick={() => setRankFilter(f.key)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                  rankFilter === f.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Filter keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md w-48"
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-gray-500 py-12 text-center">Loading rankings...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Keyword</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Volume</th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">KD</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-700 uppercase border-l border-gray-200">Desktop</th>
                  <th className="px-3 py-2.5 text-center text-xs text-gray-500">Chg</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-sky-700 uppercase border-l border-gray-200">Mobile</th>
                  <th className="px-3 py-2.5 text-center text-xs text-gray-500">Chg</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-green-700 uppercase border-l border-gray-200">Pack</th>
                  <th className="px-3 py-2.5 text-center text-xs text-gray-500">Chg</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase border-l border-gray-200">Ranking URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredKeywords.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-500">
                      {allKws.length === 0 ? "No tracked keywords." : "No keywords match this filter."}
                    </td>
                  </tr>
                ) : (
                  filteredKeywords.map((kw) => (
                    <tr key={kw.keyword_id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-2.5 text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-1.5">
                          {kw.keyword_text}
                          <a
                            href={buildSerpUrl(kw.keyword_text, data?.location, kw.organic_serp_url || undefined)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-300 hover:text-green-600 transition-colors"
                            title="View SERP"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-gray-600">
                        {kw.search_volume != null ? formatNumber(kw.search_volume) : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-gray-600">
                        {kw.keyword_difficulty != null ? kw.keyword_difficulty : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-center border-l border-gray-50">
                        <RankBadge rank={kw.organic_rank} change={kw.organic_rank_change} serpUrl={kw.organic_serp_url || undefined} screenshotUrl={kw.organic_screenshot_url || undefined} rankingUrl={kw.organic_url || undefined} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <ChangeCell change={kw.organic_rank_change} />
                      </td>
                      <td className="px-3 py-2.5 text-center border-l border-gray-50">
                        <RankBadge rank={kw.mobile_rank} change={kw.mobile_rank_change} serpUrl={kw.mobile_serp_url || undefined} rankingUrl={kw.mobile_url || undefined} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <ChangeCell change={kw.mobile_rank_change} />
                      </td>
                      <td className="px-3 py-2.5 text-center border-l border-gray-50">
                        <RankBadge rank={kw.maps_rank} change={kw.maps_rank_change} serpUrl={kw.maps_serp_url || undefined} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <ChangeCell change={kw.maps_rank_change} />
                      </td>
                      <td className="px-3 py-2.5 border-l border-gray-50 text-xs text-gray-500 max-w-[200px] truncate">
                        {kw.organic_url ? (
                          <a href={kw.organic_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                            {kw.organic_url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 50)}
                          </a>
                        ) : "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-2 text-xs text-gray-400 border-t border-gray-100">
          Showing {filteredKeywords.length} of {allKws.length} keywords
        </div>
      </div>

      {/* Competitors */}
      <CompetitorsSection clientSlug={clientSlug} dateCurrent={latestDate} />
    </div>
  );
}
