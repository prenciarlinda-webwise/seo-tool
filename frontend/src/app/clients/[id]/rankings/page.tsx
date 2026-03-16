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
  fetchRankComparison,
  fetchCompetitors,
  createCompetitor,
  deleteCompetitor,
  runRanks,
  runCompetitors,
  type CompetitorData,
  type RankComparisonKeyword,
  type RankComparisonResponse,
  type RankComparisonSummary,
  type RankTypeSummary,
} from "@/lib/api";
import { ActionButton } from "@/components/action-button";
import { cn, formatNumber } from "@/lib/utils";

type RankFilter = "all" | "top10" | "top20" | "top50";

// ─── Time Period Quick Filter Helpers ────────────────────────────────────────

type TimePeriod = "1w" | "1m" | "3m" | "6m";

const TIME_PERIODS: { key: TimePeriod; label: string; days: number }[] = [
  { key: "1w", label: "Last week", days: 7 },
  { key: "1m", label: "Last month", days: 30 },
  { key: "3m", label: "3 months", days: 90 },
  { key: "6m", label: "6 months", days: 180 },
];

function findClosestDate(dates: string[], targetDaysAgo: number, fromDate: string): string {
  if (dates.length === 0) return fromDate;
  const from = new Date(fromDate).getTime();
  const targetMs = from - targetDaysAgo * 86400000;
  let closest = dates[0];
  let closestDiff = Math.abs(new Date(dates[0]).getTime() - targetMs);
  for (const d of dates) {
    const diff = Math.abs(new Date(d).getTime() - targetMs);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = d;
    }
  }
  return closest;
}

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

// ─── Rank Cell With Popover ──────────────────────────────────────────────────

function RankCellWithPopover({
  rank,
  change,
  url,
  serpUrl,
  screenshotUrl,
}: {
  rank: number | null;
  change: number | null;
  url?: string;
  serpUrl?: string;
  screenshotUrl?: string;
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

  if (rank == null) {
    return <span className="text-gray-300 font-medium">-</span>;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center justify-center w-9 h-7 rounded font-semibold text-sm cursor-pointer transition-all",
          "hover:ring-2 hover:ring-blue-300",
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
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
          <button
            onClick={() => setOpen(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">
                Position #{rank}
              </span>
              <ChangeCell change={change} />
            </div>

            {url && (
              <div>
                <p className="text-[10px] uppercase text-gray-500 mb-0.5">
                  Ranking URL
                </p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 break-all flex items-center gap-1"
                >
                  {url}
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              </div>
            )}

            {serpUrl && (
              <div>
                <p className="text-[10px] uppercase text-gray-500 mb-0.5">
                  SERP Page
                </p>
                <a
                  href={serpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  View Google Results
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </a>
              </div>
            )}

            {screenshotUrl && (
              <div>
                <p className="text-[10px] uppercase text-gray-500 mb-1">
                  SERP Screenshot
                </p>
                <a
                  href={screenshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <div className="rounded border border-gray-200 bg-gray-50 p-2 hover:bg-gray-100 transition-colors text-center">
                    <Camera className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                    <span className="text-[10px] text-gray-500">
                      View Screenshot
                    </span>
                  </div>
                </a>
              </div>
            )}

            {!url && !serpUrl && !screenshotUrl && (
              <p className="text-xs text-gray-400">
                No SERP data captured for this check
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Overview Section ────────────────────────────────────────────────────────

function RankTypeCard({
  label,
  iconColor,
  borderColor,
  summary,
  totalKeywords,
  showTopRows,
}: {
  label: string;
  iconColor: string;
  borderColor: string;
  summary: RankTypeSummary;
  totalKeywords: number;
  showTopRows: "desktop" | "mobile" | "local_pack" | "local_finder";
}) {
  const allNull =
    summary.avg_rank == null &&
    summary.found === 0 &&
    summary.improved === 0 &&
    summary.declined === 0 &&
    summary.new === 0 &&
    summary.lost === 0;

  return (
    <div className={cn("bg-white rounded-xl border p-5 shadow-sm", borderColor)}>
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("w-2.5 h-2.5 rounded-full", iconColor)} />
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {label}
        </p>
      </div>

      {allNull ? (
        <p className="text-sm text-gray-400 mt-4">No data yet</p>
      ) : (
        <>
          {/* Big avg position */}
          <div className="mb-3">
            <span className="text-3xl font-bold text-gray-900">
              {summary.avg_rank != null ? summary.avg_rank : "-"}
            </span>
            <span className="text-xs text-gray-400 ml-1.5">avg position</span>
          </div>

          {/* Stat pills row */}
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
            {summary.new > 0 && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-medium">
                &#9733; {summary.new}
              </span>
            )}
            {summary.lost > 0 && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-medium">
                &#10005; {summary.lost}
              </span>
            )}
          </div>

          {/* Top N rows */}
          {showTopRows === "desktop" || showTopRows === "mobile" ? (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                Top 3: <span className="font-semibold text-gray-700">{summary.in_top_3}</span>
              </span>
              <span className="text-gray-300">|</span>
              <span>
                Top 10: <span className="font-semibold text-gray-700">{summary.in_top_10 ?? 0}</span>
              </span>
            </div>
          ) : showTopRows === "local_pack" ? (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                Found: <span className="font-semibold text-gray-700">{summary.found}</span>
              </span>
              <span className="text-gray-300">|</span>
              <span>
                Top 3: <span className="font-semibold text-gray-700">{summary.in_top_3}</span>
              </span>
              <span className="text-gray-300">|</span>
              <span>
                Coverage:{" "}
                <span className="font-semibold text-gray-700">
                  {summary.coverage_pct != null
                    ? summary.coverage_pct
                    : totalKeywords > 0
                    ? Math.round((summary.found / totalKeywords) * 100)
                    : 0}
                  %
                </span>
              </span>
            </div>
          ) : (
            /* local_finder */
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                Found: <span className="font-semibold text-gray-700">{summary.found}</span>
              </span>
              <span className="text-gray-300">|</span>
              <span>
                Top 3: <span className="font-semibold text-gray-700">{summary.in_top_3}</span>
              </span>
              <span className="text-gray-300">|</span>
              <span>
                Top 10: <span className="font-semibold text-gray-700">{summary.in_top_10 ?? 0}</span>
              </span>
              <span className="text-gray-300">|</span>
              <span>
                Top 20: <span className="font-semibold text-gray-700">{summary.in_top_20 ?? 0}</span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OverviewSection({
  data,
}: {
  data: RankComparisonSummary;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <RankTypeCard
        label="Desktop"
        iconColor="bg-blue-500"
        borderColor="border-blue-200"
        summary={data.desktop}
        totalKeywords={data.total_keywords}
        showTopRows="desktop"
      />
      <RankTypeCard
        label="Mobile"
        iconColor="bg-sky-400"
        borderColor="border-sky-200"
        summary={data.mobile}
        totalKeywords={data.total_keywords}
        showTopRows="mobile"
      />
      <RankTypeCard
        label="Local Pack"
        iconColor="bg-green-500"
        borderColor="border-green-200"
        summary={data.local_pack}
        totalKeywords={data.total_keywords}
        showTopRows="local_pack"
      />
      <RankTypeCard
        label="Local Finder"
        iconColor="bg-purple-500"
        borderColor="border-purple-200"
        summary={data.local_finder}
        totalKeywords={data.total_keywords}
        showTopRows="local_finder"
      />
    </div>
  );
}

// ─── Date Comparison Controls ────────────────────────────────────────────────

function DateComparisonControls({
  dates,
  dateCurrent,
  datePrevious,
  onDateCurrentChange,
  onDatePreviousChange,
}: {
  dates: string[];
  dateCurrent: string;
  datePrevious: string;
  onDateCurrentChange: (d: string) => void;
  onDatePreviousChange: (d: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Calendar className="h-4 w-4 text-gray-400" />
      <span className="text-sm font-medium text-gray-600">Compare:</span>
      <select
        value={dateCurrent}
        onChange={(e) => onDateCurrentChange(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white font-medium"
      >
        {dates.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <span className="text-sm text-gray-400">with</span>
      <select
        value={datePrevious}
        onChange={(e) => onDatePreviousChange(e.target.value)}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white font-medium"
      >
        {dates.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Competitors Section ─────────────────────────────────────────────────────

function CompetitorsSection({
  clientId,
  dates,
  dateCurrent,
  datePrevious,
  onDateCurrentChange,
  onDatePreviousChange,
}: {
  clientId: number;
  dates: string[];
  dateCurrent: string;
  datePrevious: string;
  onDateCurrentChange: (d: string) => void;
  onDatePreviousChange: (d: string) => void;
}) {
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [loadingCompetitors, setLoadingCompetitors] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formDomain, setFormDomain] = useState("");
  const [formName, setFormName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  function loadCompetitors() {
    setLoadingCompetitors(true);
    fetchCompetitors(clientId)
      .then((res) => setCompetitors(res.results))
      .finally(() => setLoadingCompetitors(false));
  }

  useEffect(() => {
    loadCompetitors();
  }, [clientId]);

  async function handleAdd() {
    if (!formDomain.trim()) return;
    setSubmitting(true);
    try {
      await createCompetitor(clientId, {
        domain: formDomain.trim(),
        name: formName.trim() || undefined,
      });
      setFormDomain("");
      setFormName("");
      setShowForm(false);
      loadCompetitors();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(competitorId: number) {
    setDeleting(competitorId);
    try {
      await deleteCompetitor(clientId, competitorId);
      loadCompetitors();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800">Chosen Competitors</h2>
          {competitors.length > 0 && (
            <span className="text-xs text-gray-400">({competitors.length})</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <DateComparisonControls
            dates={dates}
            dateCurrent={dateCurrent}
            datePrevious={datePrevious}
            onDateCurrentChange={onDateCurrentChange}
            onDatePreviousChange={onDatePreviousChange}
          />
          <ActionButton
            label="Discover Competitors"
            loadingLabel="Discovering..."
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => runCompetitors(clientId)}
            onSuccess={() => loadCompetitors()}
          />
          {competitors.length > 0 && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="px-5 py-3 border-b border-gray-100 bg-blue-50/30">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Domain <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. competitor.com"
                value={formDomain}
                onChange={(e) => setFormDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md w-56 bg-white"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Name <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md w-48 bg-white"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={submitting || !formDomain.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Adding..." : "Add"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setFormDomain("");
                setFormName("");
              }}
              className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Competitor cards */}
      {competitors.length > 0 && (
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex flex-wrap gap-2">
            {competitors.map((c) => (
              <div
                key={c.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              >
                <div>
                  <span className="font-medium text-gray-800">{c.domain}</span>
                  {c.name && (
                    <span className="text-gray-400 ml-1.5">({c.name})</span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deleting === c.id}
                  className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                  title="Remove competitor"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state (only when no competitors) */}
      {!loadingCompetitors && competitors.length === 0 && !showForm && (
        <div className="px-5 py-16 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Users className="h-7 w-7 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">
            No competitors tracked yet
          </p>
          <p className="text-sm text-gray-500 mb-5 max-w-md">
            Add competitors to track their rankings alongside yours. Compare
            position changes across all your tracked keywords.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Competitors
          </button>
        </div>
      )}

      {/* Loading state */}
      {loadingCompetitors && competitors.length === 0 && (
        <div className="px-5 py-10 text-center text-sm text-gray-400">
          Loading competitors...
        </div>
      )}

      {/* Comparison table */}
      <div className="border-t border-gray-100">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
                  Keyword
                </th>
                {competitors.length > 0
                  ? competitors.map((c) => (
                      <th
                        key={c.id}
                        className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase border-l border-gray-200"
                      >
                        {c.domain}
                        <span className="block text-[10px] font-normal text-gray-400">
                          Rank / Change
                        </span>
                      </th>
                    ))
                  : [1, 2, 3].map((n) => (
                      <th
                        key={n}
                        className="px-4 py-2.5 text-center text-xs font-medium text-gray-400 uppercase border-l border-gray-200"
                      >
                        competitor{n}.com
                        <span className="block text-[10px] font-normal text-gray-400">
                          Rank / Change
                        </span>
                      </th>
                    ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={1 + (competitors.length > 0 ? competitors.length : 3)}
                  className="px-4 py-6 text-center text-xs text-gray-400"
                >
                  {competitors.length === 0
                    ? "Competitor data will appear here once competitors are added."
                    : "Ranking data will appear after next check."}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function RankingsPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);

  const [dates, setDates] = useState<string[]>([]);
  const [dateCurrent, setDateCurrent] = useState("");
  const [datePrevious, setDatePrevious] = useState("");
  const [data, setData] = useState<RankComparisonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rankFilter, setRankFilter] = useState<RankFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activePeriod, setActivePeriod] = useState<TimePeriod | null>(null);

  // Load check dates
  useEffect(() => {
    fetchCheckDates(clientId).then((datesRes) => {
      setDates(datesRes.dates);
      if (datesRes.dates.length >= 2) {
        setDateCurrent(datesRes.dates[0]);
        setDatePrevious(datesRes.dates[1]);
      } else if (datesRes.dates.length === 1) {
        setDateCurrent(datesRes.dates[0]);
        setDatePrevious(datesRes.dates[0]);
      }
    });
  }, [clientId]);

  useEffect(() => {
    if (!dateCurrent) return;
    setLoading(true);
    fetchRankComparison(clientId, dateCurrent, datePrevious || dateCurrent)
      .then(setData)
      .finally(() => setLoading(false));
  }, [clientId, dateCurrent, datePrevious]);

  function handleQuickPeriod(period: TimePeriod) {
    if (dates.length === 0) return;
    const mostRecent = dates[0];
    const target = TIME_PERIODS.find((p) => p.key === period);
    if (!target) return;
    const prev = findClosestDate(dates, target.days, mostRecent);
    setDateCurrent(mostRecent);
    setDatePrevious(prev);
    setActivePeriod(period);
  }

  function handleDateCurrentChange(d: string) {
    setDateCurrent(d);
    setActivePeriod(null);
  }

  function handleDatePreviousChange(d: string) {
    setDatePrevious(d);
    setActivePeriod(null);
  }

  const filteredKeywords = (data?.keywords ?? []).filter((kw) => {
    if (
      searchQuery &&
      !kw.keyword_text.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    if (rankFilter !== "all") {
      const maxRank =
        rankFilter === "top10" ? 10 : rankFilter === "top20" ? 20 : 50;
      const hasRank =
        (kw.organic_rank != null && kw.organic_rank <= maxRank) ||
        (kw.organic_mobile_rank != null && kw.organic_mobile_rank <= maxRank) ||
        (kw.local_pack_rank != null && kw.local_pack_rank <= maxRank) ||
        (kw.local_finder_rank != null && kw.local_finder_rank <= maxRank);
      if (!hasRank) return false;
    }
    return true;
  });

  const filterOptions: { key: RankFilter; label: string }[] = [
    { key: "all", label: `All (${data?.keywords.length ?? 0})` },
    { key: "top10", label: "Top 10" },
    { key: "top20", label: "Top 20" },
    { key: "top50", label: "Top 50" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">
          Rank Tracker
        </h1>
        <ActionButton
          label="Run Check"
          loadingLabel="Checking..."
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => runRanks(clientId)}
          onSuccess={() => {
            fetchRankComparison(clientId, dateCurrent, datePrevious || dateCurrent).then(setData);
          }}
        />
      </div>

      {/* Overview section */}
      {data && (
        <OverviewSection data={data.summary} />
      )}

      {/* Rankings Table section */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Quick period filters */}
        <div className="flex flex-wrap items-center gap-2 px-5 pt-4 pb-2">
          <span className="text-xs font-medium text-gray-500 mr-1">Quick range:</span>
          {TIME_PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => handleQuickPeriod(p.key)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-full border transition-colors",
                activePeriod === p.key
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:border-gray-400"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Table header bar */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <DateComparisonControls
            dates={dates}
            dateCurrent={dateCurrent}
            datePrevious={datePrevious}
            onDateCurrentChange={handleDateCurrentChange}
            onDatePreviousChange={handleDatePreviousChange}
          />

          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 ml-4">
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

          <div className="relative ml-auto">
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
          <div className="text-gray-500 py-12 text-center">
            Loading rankings...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                    rowSpan={2}
                  >
                    Keyword
                  </th>
                  <th
                    className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase"
                    rowSpan={2}
                  >
                    Volume
                  </th>
                  <th
                    className="px-2 py-2 text-center text-xs font-semibold text-blue-700 uppercase border-l border-gray-200"
                    colSpan={2}
                  >
                    Organic Desktop
                  </th>
                  <th
                    className="px-2 py-2 text-center text-xs font-semibold text-sky-700 uppercase border-l border-gray-200"
                    colSpan={2}
                  >
                    Organic Mobile
                  </th>
                  <th
                    className="px-2 py-2 text-center text-xs font-semibold text-green-700 uppercase border-l border-gray-200"
                    colSpan={2}
                  >
                    Local Pack
                  </th>
                  <th
                    className="px-2 py-2 text-center text-xs font-semibold text-purple-700 uppercase border-l border-gray-200"
                    colSpan={2}
                  >
                    Local Finder
                  </th>
                </tr>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {/* Organic Desktop sub-headers */}
                  <th className="px-3 py-1.5 text-center text-[10px] text-gray-500 border-l border-gray-200">
                    Rank
                  </th>
                  <th className="px-3 py-1.5 text-center text-[10px] text-gray-500">
                    Change
                  </th>
                  {/* Organic Mobile sub-headers */}
                  <th className="px-3 py-1.5 text-center text-[10px] text-gray-500 border-l border-gray-200">
                    Rank
                  </th>
                  <th className="px-3 py-1.5 text-center text-[10px] text-gray-500">
                    Change
                  </th>
                  {/* Local Pack sub-headers */}
                  <th className="px-3 py-1.5 text-center text-[10px] text-gray-500 border-l border-gray-200">
                    Rank
                  </th>
                  <th className="px-3 py-1.5 text-center text-[10px] text-gray-500">
                    Change
                  </th>
                  {/* Local Finder sub-headers */}
                  <th className="px-3 py-1.5 text-center text-[10px] text-gray-500 border-l border-gray-200">
                    Rank
                  </th>
                  <th className="px-3 py-1.5 text-center text-[10px] text-gray-500">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredKeywords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-sm text-gray-500"
                    >
                      {data?.keywords.length === 0
                        ? "No tracked keywords with ranking data."
                        : "No keywords match this filter."}
                    </td>
                  </tr>
                ) : (
                  filteredKeywords.map((kw) => (
                    <tr
                      key={kw.keyword_id}
                      className="hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-900">
                            {kw.keyword_text}
                          </span>
                          {kw.organic_serp_features?.ai_overview && (
                            <span className="px-1 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-semibold rounded">
                              AI
                            </span>
                          )}
                          {kw.organic_serp_features?.featured_snippet && (
                            <span className="px-1 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-semibold rounded">
                              FS
                            </span>
                          )}
                          {kw.organic_serp_features?.local_pack && (
                            <span className="px-1 py-0.5 bg-green-100 text-green-700 text-[9px] font-semibold rounded">
                              LP
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-sm text-gray-600">
                        {kw.search_volume != null
                          ? kw.search_volume < 10
                            ? "<10"
                            : formatNumber(kw.search_volume)
                          : "-"}
                      </td>
                      {/* Organic Desktop */}
                      <td className="px-3 py-2.5 text-center border-l border-gray-50">
                        <RankCellWithPopover
                          rank={kw.organic_rank}
                          change={kw.organic_change}
                          url={kw.organic_url}
                          serpUrl={kw.organic_serp_url || undefined}
                          screenshotUrl={kw.organic_screenshot_url || undefined}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <ChangeCell change={kw.organic_change} />
                      </td>
                      {/* Organic Mobile */}
                      <td className="px-3 py-2.5 text-center border-l border-gray-50">
                        <RankCellWithPopover
                          rank={kw.organic_mobile_rank}
                          change={kw.organic_mobile_change}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <ChangeCell change={kw.organic_mobile_change} />
                      </td>
                      {/* Local Pack */}
                      <td className="px-3 py-2.5 text-center border-l border-gray-50">
                        <RankCellWithPopover
                          rank={kw.local_pack_rank}
                          change={kw.local_pack_change}
                          serpUrl={kw.local_pack_serp_url || undefined}
                          screenshotUrl={
                            kw.local_pack_screenshot_url || undefined
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <ChangeCell change={kw.local_pack_change} />
                      </td>
                      {/* Local Finder */}
                      <td className="px-3 py-2.5 text-center border-l border-gray-50">
                        <RankCellWithPopover
                          rank={kw.local_finder_rank}
                          change={kw.local_finder_change}
                          serpUrl={kw.local_finder_serp_url || undefined}
                          screenshotUrl={
                            kw.local_finder_screenshot_url || undefined
                          }
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <ChangeCell change={kw.local_finder_change} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-400">
          Showing {filteredKeywords.length} of {data?.keywords.length ?? 0}{" "}
          keywords
        </div>
      </div>

      {/* Competitors Section */}
      <CompetitorsSection
        clientId={clientId}
        dates={dates}
        dateCurrent={dateCurrent}
        datePrevious={datePrevious}
        onDateCurrentChange={handleDateCurrentChange}
        onDatePreviousChange={handleDatePreviousChange}
      />
    </div>
  );
}
