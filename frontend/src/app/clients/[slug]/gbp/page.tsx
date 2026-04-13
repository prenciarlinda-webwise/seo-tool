"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  fetchGBPPerformance,
  fetchGBPCalls,
  fetchGBPReviews,
  fetchGBPSearchKeywords,
  type GBPPerformanceMetric,
  type GBPCallMetric,
  type GBPReviewSnapshot,
  type GBPSearchKeyword,
} from "@/lib/api";
import StatCard from "@/components/stat-card";
import DataTable from "@/components/data-table";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import {
  Eye,
  MousePointerClick,
  Phone,
  Globe,
  MapPin,
  PhoneCall,
  PhoneOff,
  Clock,
  Star,
  MessageSquare,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Search,
  Navigation,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Tab = "performance" | "calls" | "reviews" | "keywords";

/* ── Period helpers ─────────────────────────────────────────── */

interface PeriodOption {
  key: string;
  label: string;
  date_from: string;
  date_to: string;
}

function buildPresets(): PeriodOption[] {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  const ago = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  };
  return [
    { key: "7d", label: "7 days", date_from: ago(7), date_to: to },
    { key: "30d", label: "30 days", date_from: ago(30), date_to: to },
    { key: "3m", label: "3 months", date_from: ago(90), date_to: to },
    { key: "6m", label: "6 months", date_from: ago(180), date_to: to },
  ];
}

function buildMonthOptions(): PeriodOption[] {
  const now = new Date();
  const months: PeriodOption[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const pad = (n: number) => String(n).padStart(2, "0");
    months.push({
      key: `m-${year}-${pad(month + 1)}`,
      label,
      date_from: `${year}-${pad(month + 1)}-01`,
      date_to: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
    });
  }
  return months;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "-";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i <= Math.round(rating)
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          )}
        />
      ))}
      <span className="ml-1 text-sm font-medium text-gray-700">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

function CollapsibleTable({
  label,
  columns,
  data,
}: {
  label: string;
  columns: any[];
  data: any[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
      >
        {open ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
        {label}
      </button>
      {open && (
        <div className="mt-3">
          <DataTable columns={columns} data={data} emptyMessage="No data yet." />
        </div>
      )}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "white",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "13px",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  },
};

export default function GBPPage() {
  const { slug } = useParams<{ slug: string }>();
  const clientSlug = slug;

  const presets = useMemo(buildPresets, []);
  const monthOptions = useMemo(buildMonthOptions, []);

  const [tab, setTab] = useState<Tab>("performance");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("30d");
  const [performance, setPerformance] = useState<GBPPerformanceMetric[]>([]);
  const [calls, setCalls] = useState<GBPCallMetric[]>([]);
  const [reviews, setReviews] = useState<GBPReviewSnapshot[]>([]);
  const [keywords, setKeywords] = useState<GBPSearchKeyword[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve the active date range from the selected period key
  const dateRange = useMemo(() => {
    const all = [...presets, ...monthOptions];
    return all.find((p) => p.key === selectedPeriod) || presets[1]; // default 30d
  }, [selectedPeriod, presets, monthOptions]);

  useEffect(() => {
    setLoading(true);
    const { date_from, date_to } = dateRange;
    // Request up to 365 records so all daily data fits in one page
    const qs = `date_from=${date_from}&date_to=${date_to}&page_size=365`;

    const fetchers: Record<Tab, () => Promise<void>> = {
      performance: () =>
        fetchGBPPerformance(clientSlug, qs).then((r) => setPerformance(r.results)),
      calls: () =>
        fetchGBPCalls(clientSlug, qs).then((r) => setCalls(r.results)),
      reviews: () =>
        fetchGBPReviews(clientSlug, qs).then((r) => setReviews(r.results)),
      keywords: () =>
        fetchGBPSearchKeywords(clientSlug, `page_size=365`).then((r) =>
          setKeywords(r.results)
        ),
    };
    fetchers[tab]().finally(() => setLoading(false));
  }, [clientSlug, tab, dateRange]);

  // ---------- Performance aggregations ----------
  const perfSummary = useMemo(() => {
    return {
      impressions: performance.reduce((s, r) => s + r.total_impressions, 0),
      interactions: performance.reduce((s, r) => s + r.total_interactions, 0),
      callClicks: performance.reduce((s, r) => s + r.call_clicks, 0),
      websiteClicks: performance.reduce((s, r) => s + r.website_clicks, 0),
      directionRequests: performance.reduce(
        (s, r) => s + r.direction_requests,
        0
      ),
    };
  }, [performance]);

  const perfChartData = useMemo(
    () =>
      [...performance]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => ({
          date: formatDate(r.date),
          rawDate: r.date,
          total_impressions: r.total_impressions,
          call_clicks: r.call_clicks,
          website_clicks: r.website_clicks,
          direction_requests: r.direction_requests,
        })),
    [performance]
  );

  // ---------- Calls aggregations ----------
  const callsSummary = useMemo(() => {
    const total = calls.reduce((s, r) => s + r.total_calls, 0);
    const answered = calls.reduce((s, r) => s + r.answered_calls, 0);
    const missed = calls.reduce((s, r) => s + r.missed_calls, 0);
    const durations = calls.filter((r) => r.avg_duration_seconds != null);
    const avgDuration =
      durations.length > 0
        ? durations.reduce((s, r) => s + r.avg_duration_seconds!, 0) /
          durations.length
        : null;
    return { total, answered, missed, avgDuration };
  }, [calls]);

  const callsChartData = useMemo(
    () =>
      [...calls]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => ({
          date: formatDate(r.date),
          rawDate: r.date,
          total_calls: r.total_calls,
          answered_calls: r.answered_calls,
        })),
    [calls]
  );

  // ---------- Reviews aggregations ----------
  const reviewSummary = useMemo(() => {
    const latest = reviews[0];
    if (!latest) return null;
    const totalNew = reviews.reduce((s, r) => s + r.new_reviews_since_last, 0);
    const ratesWithData = reviews.filter((r) => r.response_rate != null);
    const avgResponseRate =
      ratesWithData.length > 0
        ? ratesWithData.reduce((s, r) => s + r.response_rate!, 0) /
          ratesWithData.length
        : null;
    return {
      totalReviews: latest.total_reviews,
      avgRating: latest.average_rating,
      newReviews: totalNew,
      responseRate: avgResponseRate,
      five: latest.five_star,
      four: latest.four_star,
      three: latest.three_star,
      two: latest.two_star,
      one: latest.one_star,
    };
  }, [reviews]);

  const reviewChartData = useMemo(
    () =>
      [...reviews]
        .sort((a, b) => a.date.localeCompare(b.date))
        .filter((r) => r.average_rating != null)
        .map((r) => ({
          date: formatDate(r.date),
          rawDate: r.date,
          average_rating: r.average_rating,
        })),
    [reviews]
  );

  // ---------- Keywords ----------
  const sortedKeywords = useMemo(
    () => [...keywords].sort((a, b) => b.impressions - a.impressions),
    [keywords]
  );

  const top20Keywords = useMemo(() => sortedKeywords.slice(0, 20), [sortedKeywords]);

  const keywordChartData = useMemo(
    () =>
      top20Keywords.map((k) => ({
        keyword:
          k.keyword.length > 25 ? k.keyword.slice(0, 22) + "..." : k.keyword,
        impressions: k.impressions,
      })),
    [top20Keywords]
  );

  // ---------- Column definitions ----------
  const perfColumns = [
    { key: "date", header: "Date" },
    {
      key: "total_impressions",
      header: "Impressions",
      render: (row: GBPPerformanceMetric) => formatNumber(row.total_impressions),
      className: "text-right",
    },
    {
      key: "total_interactions",
      header: "Interactions",
      render: (row: GBPPerformanceMetric) =>
        formatNumber(row.total_interactions),
      className: "text-right",
    },
    {
      key: "call_clicks",
      header: "Calls",
      render: (row: GBPPerformanceMetric) => formatNumber(row.call_clicks),
      className: "text-right",
    },
    {
      key: "website_clicks",
      header: "Website",
      render: (row: GBPPerformanceMetric) => formatNumber(row.website_clicks),
      className: "text-right",
    },
    {
      key: "direction_requests",
      header: "Directions",
      render: (row: GBPPerformanceMetric) =>
        formatNumber(row.direction_requests),
      className: "text-right",
    },
  ];

  const callColumns = [
    { key: "date", header: "Date" },
    {
      key: "total_calls",
      header: "Total",
      render: (row: GBPCallMetric) => formatNumber(row.total_calls),
      className: "text-right",
    },
    {
      key: "answered_calls",
      header: "Answered",
      render: (row: GBPCallMetric) => formatNumber(row.answered_calls),
      className: "text-right",
    },
    {
      key: "missed_calls",
      header: "Missed",
      render: (row: GBPCallMetric) => formatNumber(row.missed_calls),
      className: "text-right",
    },
    {
      key: "avg_duration_seconds",
      header: "Avg Duration",
      render: (row: GBPCallMetric) => formatDuration(row.avg_duration_seconds),
      className: "text-right",
    },
  ];

  const reviewColumns = [
    { key: "date", header: "Date" },
    {
      key: "average_rating",
      header: "Avg Rating",
      render: (row: GBPReviewSnapshot) =>
        row.average_rating != null ? row.average_rating.toFixed(1) : "-",
      className: "text-right",
    },
    {
      key: "total_reviews",
      header: "Total",
      render: (row: GBPReviewSnapshot) => formatNumber(row.total_reviews),
      className: "text-right",
    },
    {
      key: "new_reviews_since_last",
      header: "New",
      render: (row: GBPReviewSnapshot) =>
        formatNumber(row.new_reviews_since_last),
      className: "text-right",
    },
    {
      key: "response_rate",
      header: "Response Rate",
      render: (row: GBPReviewSnapshot) => formatPercent(row.response_rate),
      className: "text-right",
    },
  ];

  const kwColumns = [
    { key: "keyword", header: "Keyword" },
    {
      key: "impressions",
      header: "Impressions",
      render: (row: GBPSearchKeyword) => formatNumber(row.impressions),
      className: "text-right",
    },
    {
      key: "impressions_change",
      header: "Change",
      render: (row: GBPSearchKeyword) => {
        if (row.impressions_change == null) return "-";
        const color =
          row.impressions_change > 0
            ? "text-green-600"
            : row.impressions_change < 0
            ? "text-red-600"
            : "text-gray-400";
        return (
          <span className={cn("font-medium", color)}>
            {row.impressions_change > 0 ? "+" : ""}
            {row.impressions_change}
          </span>
        );
      },
      className: "text-right",
    },
    {
      key: "impressions_change_pct",
      header: "% Change",
      render: (row: GBPSearchKeyword) => {
        if (row.impressions_change_pct == null) return "-";
        const color =
          row.impressions_change_pct > 0
            ? "text-green-600"
            : row.impressions_change_pct < 0
            ? "text-red-600"
            : "text-gray-400";
        return (
          <span className={cn("font-medium", color)}>
            {row.impressions_change_pct > 0 ? "+" : ""}
            {row.impressions_change_pct.toFixed(1)}%
          </span>
        );
      },
      className: "text-right",
    },
    { key: "period_start", header: "Period Start" },
    { key: "period_end", header: "Period End" },
  ];

  // ---------- Tab definitions ----------
  const tabs: { key: Tab; label: string }[] = [
    { key: "performance", label: "Performance" },
    { key: "calls", label: "Calls" },
    { key: "reviews", label: "Reviews" },
    { key: "keywords", label: "Search Keywords" },
  ];

  // ---------- Star distribution bar ----------
  function StarDistribution({
    stars,
    total,
  }: {
    stars: { label: string; count: number }[];
    total: number;
  }) {
    return (
      <div className="space-y-2">
        {stars.map((s) => {
          const pct = total > 0 ? (s.count / total) * 100 : 0;
          return (
            <div key={s.label} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600 w-8 text-right">
                {s.label}
              </span>
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-sm text-gray-500 w-16 text-right">
                {s.count} ({pct.toFixed(0)}%)
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // ---------- Render ----------
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        GBP Insights
      </h1>

      {/* Period Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm font-medium text-gray-500 mr-1">Period:</span>
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => setSelectedPeriod(p.key)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors border",
              selectedPeriod === p.key
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            {p.label}
          </button>
        ))}
        <span className="text-gray-300 mx-1">|</span>
        {monthOptions.map((m) => (
          <button
            key={m.key}
            onClick={() => setSelectedPeriod(m.key)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors border",
              selectedPeriod === m.key
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : (
        <>
          {/* ========== PERFORMANCE TAB ========== */}
          {tab === "performance" && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <StatCard
                  label="Total Impressions"
                  value={formatNumber(perfSummary.impressions)}
                  icon={<Eye className="h-4 w-4" />}
                />
                <StatCard
                  label="Total Interactions"
                  value={formatNumber(perfSummary.interactions)}
                  icon={<MousePointerClick className="h-4 w-4" />}
                />
                <StatCard
                  label="Call Clicks"
                  value={formatNumber(perfSummary.callClicks)}
                  icon={<Phone className="h-4 w-4" />}
                />
                <StatCard
                  label="Website Clicks"
                  value={formatNumber(perfSummary.websiteClicks)}
                  icon={<Globe className="h-4 w-4" />}
                />
                <StatCard
                  label="Direction Requests"
                  value={formatNumber(perfSummary.directionRequests)}
                  icon={<Navigation className="h-4 w-4" />}
                />
              </div>

              {perfChartData.length > 0 && (
                <>
                  {/* Impressions Area Chart */}
                  <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-4">
                      Impressions Over Time
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={perfChartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f0f0f0"
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          interval={Math.max(0, Math.floor(perfChartData.length / 12) - 1)}
                        />
                        <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                        <Tooltip
                          {...tooltipStyle}
                          formatter={(value: any) => [
                            formatNumber(value),
                            "Impressions",
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="total_impressions"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.15}
                          strokeWidth={2}
                          name="Impressions"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Interactions Stacked Bar Chart */}
                  <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-4">
                      Interactions Breakdown
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={perfChartData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f0f0f0"
                        />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          interval={Math.max(0, Math.floor(perfChartData.length / 12) - 1)}
                        />
                        <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                        <Tooltip
                          {...tooltipStyle}
                          formatter={(value: any, name: any) => [
                            formatNumber(value),
                            name,
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="call_clicks"
                          stackId="interactions"
                          fill="#3b82f6"
                          name="Call Clicks"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="direction_requests"
                          stackId="interactions"
                          fill="#f59e0b"
                          name="Direction Requests"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="website_clicks"
                          stackId="interactions"
                          fill="#10b981"
                          name="Website Clicks"
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              <CollapsibleTable
                label="View Daily Data"
                columns={perfColumns}
                data={performance}
              />
            </div>
          )}

          {/* ========== CALLS TAB ========== */}
          {tab === "calls" && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard
                  label="Total Calls"
                  value={formatNumber(callsSummary.total)}
                  icon={<PhoneCall className="h-4 w-4" />}
                />
                <StatCard
                  label="Answered"
                  value={formatNumber(callsSummary.answered)}
                  icon={<Phone className="h-4 w-4" />}
                />
                <StatCard
                  label="Missed"
                  value={formatNumber(callsSummary.missed)}
                  icon={<PhoneOff className="h-4 w-4" />}
                />
                <StatCard
                  label="Avg Duration"
                  value={formatDuration(callsSummary.avgDuration)}
                  icon={<Clock className="h-4 w-4" />}
                />
              </div>

              {callsChartData.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">
                    Daily Calls
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={callsChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f0f0f0"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        interval={Math.max(0, Math.floor(callsChartData.length / 12) - 1)}
                      />
                      <YAxis tick={{ fontSize: 12 }} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: any, name: any) => [
                          formatNumber(value),
                          name,
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="total_calls"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        name="Total Calls"
                      />
                      <Line
                        type="monotone"
                        dataKey="answered_calls"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        name="Answered Calls"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <CollapsibleTable
                label="View Daily Data"
                columns={callColumns}
                data={calls}
              />
            </div>
          )}

          {/* ========== REVIEWS TAB ========== */}
          {tab === "reviews" && (
            <div>
              {reviewSummary && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <StatCard
                      label="Total Reviews"
                      value={formatNumber(reviewSummary.totalReviews)}
                      icon={<MessageSquare className="h-4 w-4" />}
                    />
                    <div className="bg-white rounded-lg border border-gray-200 p-5">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-500">
                          Avg Rating
                        </p>
                        <span className="text-gray-400">
                          <Star className="h-4 w-4" />
                        </span>
                      </div>
                      <div className="mt-2">
                        {reviewSummary.avgRating != null ? (
                          <StarRating rating={reviewSummary.avgRating} />
                        ) : (
                          <span className="text-2xl font-semibold text-gray-900">
                            -
                          </span>
                        )}
                      </div>
                    </div>
                    <StatCard
                      label="New Reviews"
                      value={formatNumber(reviewSummary.newReviews)}
                      sub="in period"
                      icon={<TrendingUp className="h-4 w-4" />}
                    />
                    <StatCard
                      label="Response Rate"
                      value={formatPercent(reviewSummary.responseRate)}
                      icon={<MessageSquare className="h-4 w-4" />}
                    />
                  </div>

                  {/* Star Distribution */}
                  <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-4">
                      Rating Distribution
                    </h3>
                    <StarDistribution
                      total={reviewSummary.totalReviews}
                      stars={[
                        { label: "5", count: reviewSummary.five },
                        { label: "4", count: reviewSummary.four },
                        { label: "3", count: reviewSummary.three },
                        { label: "2", count: reviewSummary.two },
                        { label: "1", count: reviewSummary.one },
                      ]}
                    />
                  </div>
                </>
              )}

              {!reviewSummary && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No review data for this period.
                </div>
              )}

              {reviewChartData.length > 1 && (
                <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">
                    Average Rating Over Time
                  </h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={reviewChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f0f0f0"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 5]}
                        ticks={[1, 2, 3, 4, 5]}
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: any) => [
                          Number(value).toFixed(2),
                          "Avg Rating",
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="average_rating"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={{ fill: "#f59e0b", r: 3 }}
                        name="Average Rating"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <CollapsibleTable
                label="View Daily Data"
                columns={reviewColumns}
                data={reviews}
              />
            </div>
          )}

          {/* ========== KEYWORDS TAB ========== */}
          {tab === "keywords" && (
            <div>
              {keywordChartData.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">
                    Top {Math.min(20, keywordChartData.length)} Keywords by
                    Impressions
                  </h3>
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(300, keywordChartData.length * 28)}
                  >
                    <BarChart
                      data={keywordChartData}
                      layout="vertical"
                      margin={{ left: 120 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f0f0f0"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="keyword"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        width={115}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value: any) => [
                          formatNumber(value),
                          "Impressions",
                        ]}
                      />
                      <Bar
                        dataKey="impressions"
                        fill="#3b82f6"
                        radius={[0, 4, 4, 0]}
                        name="Impressions"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-700">
                    All Keywords
                  </h3>
                  <span className="text-xs text-gray-400 ml-1">
                    sorted by impressions
                  </span>
                </div>
                <DataTable
                  columns={kwColumns}
                  data={sortedKeywords}
                  emptyMessage="No keyword data yet."
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
