"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  fetchGA4Traffic,
  fetchGA4Events,
  fetchGA4Conversions,
  fetchGA4LandingPages,
  type GA4TrafficSnapshot,
  type GA4Event,
  type GA4ConversionSummary,
  type GA4LandingPage,
} from "@/lib/api";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import {
  BarChart3,
  MousePointerClick,
  Target,
  Users,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  FileText,
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
  ResponsiveContainer,
  Legend,
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const EVENT_COLORS: Record<string, string> = {
  scroll: "#94a3b8",
  high_intent_page: "#8b5cf6",
  click: "#3b82f6",
  phone_click: "#10b981",
  estimate_request: "#f59e0b",
  financing_interest: "#ec4899",
};

const EVENT_NAMES = Object.keys(EVENT_COLORS);

type Period = "7d" | "30d" | "3m" | "6m";

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "3m", label: "3 months", days: 90 },
  { key: "6m", label: "6 months", days: 180 },
];

function dateRange(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { date_from: fmt(from), date_to: fmt(to) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shortDate(d: any) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Async helpers — fetch all pages                                    */
/* ------------------------------------------------------------------ */

async function fetchAllPages<T>(
  fetcher: (params: string) => Promise<{ count: number; next: string | null; results: T[] }>,
  baseParams: string,
  pageSize = 200,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const sep = baseParams ? "&" : "";
    const res = await fetcher(`${baseParams}${sep}page=${page}&page_size=${pageSize}`);
    all.push(...res.results);
    hasMore = res.next !== null;
    page++;
  }
  return all;
}

/* ------------------------------------------------------------------ */
/*  Small components                                                   */
/* ------------------------------------------------------------------ */

function SummaryCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "flat";
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </span>
        <span className="text-gray-400">{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {trend === "up" && <TrendingUp className="h-4 w-4 text-green-500 mb-1" />}
        {trend === "down" && <TrendingDown className="h-4 w-4 text-red-500 mb-1" />}
        {trend === "flat" && <Minus className="h-4 w-4 text-gray-400 mb-1" />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function AnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);

  const [period, setPeriod] = useState<Period>("30d");
  const [traffic, setTraffic] = useState<GA4TrafficSnapshot[]>([]);
  const [events, setEvents] = useState<GA4Event[]>([]);
  const [conversions, setConversions] = useState<GA4ConversionSummary[]>([]);
  const [landingPages, setLandingPages] = useState<GA4LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [trafficDetailsOpen, setTrafficDetailsOpen] = useState(false);

  const days = PERIODS.find((p) => p.key === period)!.days;
  const { date_from, date_to } = useMemo(() => dateRange(days), [days]);
  const qs = `date_from=${date_from}&date_to=${date_to}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, e, c, lp] = await Promise.all([
        fetchAllPages<GA4TrafficSnapshot>((p) => fetchGA4Traffic(clientId, p), qs),
        fetchAllPages<GA4Event>((p) => fetchGA4Events(clientId, p), qs),
        fetchAllPages<GA4ConversionSummary>((p) => fetchGA4Conversions(clientId, p), qs),
        fetchAllPages<GA4LandingPage>((p) => fetchGA4LandingPages(clientId, p), qs),
      ]);
      setTraffic(t.sort((a, b) => a.date.localeCompare(b.date)));
      setEvents(e.sort((a, b) => a.date.localeCompare(b.date)));
      setConversions(c.sort((a, b) => a.date.localeCompare(b.date)));
      setLandingPages(lp);
    } finally {
      setLoading(false);
    }
  }, [clientId, qs]);

  useEffect(() => {
    load();
  }, [load]);

  /* ---- Computed values ---- */

  const totalSessions = useMemo(
    () => traffic.reduce((s, r) => s + r.organic_sessions, 0),
    [traffic],
  );
  const totalUsers = useMemo(
    () => traffic.reduce((s, r) => s + r.organic_users, 0),
    [traffic],
  );
  const totalConversions = useMemo(
    () => conversions.reduce((s, r) => s + r.organic_conversions, 0),
    [conversions],
  );
  const avgEngagement = useMemo(() => {
    const valid = traffic.filter((r) => r.organic_engagement_rate != null);
    if (!valid.length) return null;
    return valid.reduce((s, r) => s + (r.organic_engagement_rate ?? 0), 0) / valid.length;
  }, [traffic]);

  // Determine simple trend from first half vs second half
  function halfTrend(arr: number[]): "up" | "down" | "flat" {
    if (arr.length < 2) return "flat";
    const mid = Math.floor(arr.length / 2);
    const first = arr.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const second = arr.slice(mid).reduce((a, b) => a + b, 0) / (arr.length - mid);
    if (second > first * 1.05) return "up";
    if (second < first * 0.95) return "down";
    return "flat";
  }

  const sessionsTrend = halfTrend(traffic.map((r) => r.organic_sessions));
  const usersTrend = halfTrend(traffic.map((r) => r.organic_users));
  const convTrend = halfTrend(conversions.map((r) => r.organic_conversions));

  /* ---- Events chart data ---- */

  const eventsChartData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};
    for (const e of events) {
      if (!byDate[e.date]) byDate[e.date] = {};
      byDate[e.date][e.event_name] = (byDate[e.date][e.event_name] || 0) + e.organic_event_count;
    }
    return Object.keys(byDate)
      .sort()
      .map((date) => ({ date, ...byDate[date] }));
  }, [events]);

  const eventTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const e of events) {
      totals[e.event_name] = (totals[e.event_name] || 0) + e.organic_event_count;
    }
    return totals;
  }, [events]);

  const grandTotalEvents = useMemo(
    () => Object.values(eventTotals).reduce((a, b) => a + b, 0),
    [eventTotals],
  );

  // Selected event detail data
  const selectedEventData = useMemo(() => {
    if (!selectedEvent) return [];
    return events
      .filter((e) => e.event_name === selectedEvent)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, selectedEvent]);

  /* ---- Conversions chart data ---- */

  const conversionsChartData = useMemo(
    () =>
      conversions.map((c) => ({
        date: c.date,
        form_submissions: c.form_submissions,
        phone_clicks: c.phone_clicks,
      })),
    [conversions],
  );

  /* ---- Landing pages aggregated ---- */

  const aggregatedPages = useMemo(() => {
    const byPath: Record<
      string,
      { sessions: number; users: number; bounceSum: number; bounceCount: number }
    > = {};
    for (const lp of landingPages) {
      if (!byPath[lp.page_path]) {
        byPath[lp.page_path] = { sessions: 0, users: 0, bounceSum: 0, bounceCount: 0 };
      }
      const p = byPath[lp.page_path];
      p.sessions += lp.organic_sessions;
      p.users += lp.organic_users;
      if (lp.organic_bounce_rate != null) {
        p.bounceSum += lp.organic_bounce_rate;
        p.bounceCount += 1;
      }
    }
    return Object.entries(byPath)
      .map(([path, v]) => ({
        page_path: path,
        sessions: v.sessions,
        users: v.users,
        avg_bounce_rate: v.bounceCount ? v.bounceSum / v.bounceCount : null,
      }))
      .sort((a, b) => b.sessions - a.sessions);
  }, [landingPages]);

  /* ---- Traffic chart data ---- */

  const trafficChartData = useMemo(
    () =>
      traffic.map((t) => ({
        date: t.date,
        organic_sessions: t.organic_sessions,
        organic_users: t.organic_users,
      })),
    [traffic],
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <Activity className="h-5 w-5 animate-pulse" />
          <span className="text-sm">Loading analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header + Period Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                period === p.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---- Summary Cards ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Organic Sessions"
          value={formatNumber(totalSessions)}
          icon={<BarChart3 className="h-4 w-4" />}
          trend={sessionsTrend}
        />
        <SummaryCard
          label="Organic Users"
          value={formatNumber(totalUsers)}
          icon={<Users className="h-4 w-4" />}
          trend={usersTrend}
        />
        <SummaryCard
          label="Organic Conversions"
          value={formatNumber(totalConversions)}
          icon={<Target className="h-4 w-4" />}
          trend={convTrend}
        />
        <SummaryCard
          label="Avg Engagement Rate"
          value={avgEngagement != null ? formatPercent(avgEngagement) : "-"}
          icon={<MousePointerClick className="h-4 w-4" />}
        />
      </div>

      {/* ---- Events Overview ---- */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900">Events Overview</h2>

        {/* Stacked Area Chart */}
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={eventsChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={shortDate}
                formatter={(value: any, name: any) => [formatNumber(Number(value)), name]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              {EVENT_NAMES.map((name) => (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stackId="1"
                  stroke={EVENT_COLORS[name]}
                  fill={EVENT_COLORS[name]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / summary row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {EVENT_NAMES.map((name) => {
            const total = eventTotals[name] || 0;
            const pct = grandTotalEvents > 0 ? total / grandTotalEvents : 0;
            const isSelected = selectedEvent === name;
            return (
              <button
                key={name}
                onClick={() => setSelectedEvent(isSelected ? null : name)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                  isSelected
                    ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: EVENT_COLORS[name] }}
                  />
                  <span className="text-xs font-medium text-gray-700 truncate">
                    {name.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-900">{formatNumber(total)}</span>
                <span className="text-xs text-gray-500">{(pct * 100).toFixed(1)}%</span>
              </button>
            );
          })}
        </div>

        {/* Selected event detail panel */}
        {selectedEvent && selectedEventData.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ backgroundColor: EVENT_COLORS[selectedEvent] + "15" }}
            >
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: EVENT_COLORS[selectedEvent] }}
              />
              <span className="text-sm font-semibold text-gray-900">
                {selectedEvent.replace(/_/g, " ")} — Daily Breakdown
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Date</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">
                      Organic Count
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">
                      Total Count
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">
                      Unique Users
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEventData.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{shortDate(row.date)}</td>
                      <td className="px-4 py-2 text-right text-gray-900 font-medium">
                        {formatNumber(row.organic_event_count)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {formatNumber(row.event_count)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {formatNumber(row.unique_users)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ---- Traffic Overview ---- */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900">Traffic Overview</h2>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trafficChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={shortDate}
                formatter={(value: any, name: any) => [formatNumber(Number(value)), name.replace(/_/g, " ")]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Legend
                formatter={(value: any) => (
                  <span className="text-xs text-gray-600">{value.replace(/_/g, " ")}</span>
                )}
              />
              <Line
                type="monotone"
                dataKey="organic_sessions"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="organic_users"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Expandable detail table */}
        <div className="border border-gray-200 rounded-lg">
          <button
            onClick={() => setTrafficDetailsOpen(!trafficDetailsOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>View Details</span>
            {trafficDetailsOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {trafficDetailsOpen && (
            <div className="max-h-72 overflow-y-auto border-t border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Date</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">
                      Organic Sessions
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">
                      Organic Users
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">
                      Total Sessions
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">
                      Bounce Rate
                    </th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">
                      Engagement
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {traffic.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{shortDate(row.date)}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">
                        {formatNumber(row.organic_sessions)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {formatNumber(row.organic_users)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {formatNumber(row.total_sessions)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {formatPercent(row.organic_bounce_rate)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600">
                        {formatPercent(row.organic_engagement_rate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ---- Conversions ---- */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-900">Conversions</h2>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={conversionsChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                labelFormatter={shortDate}
                formatter={(value: any, name: any) => [formatNumber(Number(value)), name.replace(/_/g, " ")]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              />
              <Legend
                formatter={(value: any) => (
                  <span className="text-xs text-gray-600">{value.replace(/_/g, " ")}</span>
                )}
              />
              <Bar
                dataKey="form_submissions"
                stackId="conv"
                fill="#3b82f6"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="phone_clicks"
                stackId="conv"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ---- Top Pages ---- */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Top Pages</h2>
        </div>

        {aggregatedPages.length === 0 ? (
          <p className="text-sm text-gray-500">No landing page data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Page Path</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Sessions</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Users</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Avg Bounce Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {aggregatedPages.slice(0, 25).map((row, i) => (
                  <tr
                    key={row.page_path}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-2.5 text-gray-400 text-xs font-medium">{i + 1}</td>
                    <td className="px-4 py-2.5 text-gray-900 font-medium max-w-xs truncate">
                      {row.page_path}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-900 font-medium">
                      {formatNumber(row.sessions)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-700">
                      {formatNumber(row.users)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-600">
                      {formatPercent(row.avg_bounce_rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
