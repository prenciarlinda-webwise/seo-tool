"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  ChevronRight,
  ClipboardCheck,
  Globe,
  MapPin,
  MessageSquare,
  Monitor,
  MousePointerClick,
  Navigation,
  Phone,
  Search,
  Smartphone,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { fetchClientSummary } from "@/lib/api";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

/* ---------- helper components ---------- */

function SectionCard({
  title,
  icon: Icon,
  iconColor,
  href,
  children,
}: {
  title: string;
  icon?: React.ElementType;
  iconColor?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={cn("h-4 w-4", iconColor)} />}
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <Link
          href={href}
          className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          View Full Report <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  sub,
  icon: Icon,
  color = "text-gray-900",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ElementType;
  color?: string;
}) {
  return (
    <div className="text-center">
      {Icon && <Icon className={cn("h-4 w-4 mx-auto mb-1", color)} />}
      <p className={cn("text-xl font-bold", color)}>{value}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

function StarDisplay({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-gray-300">-</span>;
  return (
    <div className="flex items-center gap-1">
      <span className="text-2xl font-bold text-yellow-500">
        {rating.toFixed(1)}
      </span>
      <div className="flex">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={cn(
              "h-4 w-4",
              s <= Math.round(rating)
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-200"
            )}
          />
        ))}
      </div>
    </div>
  );
}

/* Mini sparkline — no axes, just a tiny area chart */
function Sparkline({
  data,
  dataKey,
  color,
  gradientId,
  reversed = false,
}: {
  data: { date: string; avg_rank: number }[];
  dataKey: string;
  color: string;
  gradientId: string;
  reversed?: boolean;
}) {
  if (!data || data.length === 0) return null;
  return (
    <div className="h-12 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            labelFormatter={(l: any) => `${l}`}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(v: any) => [`#${v}`, "Avg Position"]}
            contentStyle={{ fontSize: 11, borderRadius: 6, padding: "4px 8px" }}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------- ranking card config ---------- */

const RANKING_TYPES = [
  {
    key: "desktop",
    label: "Desktop",
    icon: Monitor,
    color: "text-blue-600",
    stroke: "#3b82f6",
    bg: "bg-blue-50",
  },
  {
    key: "mobile",
    label: "Mobile",
    icon: Smartphone,
    color: "text-sky-500",
    stroke: "#0ea5e9",
    bg: "bg-sky-50",
  },
  {
    key: "local_pack",
    label: "Local Pack",
    icon: MapPin,
    color: "text-green-600",
    stroke: "#16a34a",
    bg: "bg-green-50",
  },
  {
    key: "local_finder",
    label: "Local Finder",
    icon: Navigation,
    color: "text-purple-600",
    stroke: "#9333ea",
    bg: "bg-purple-50",
  },
] as const;

/* ---------- main page ---------- */

export default function ClientDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const clientId = Number(id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClientSummary(clientId)
      .then((d) => setData(d as any))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading dashboard...
      </div>
    );
  if (!data) return <div className="text-gray-500">Client not found</div>;

  const client = data.client as Record<string, any>;
  const rankings = data.rankings || {};
  const reviews = data.reviews;
  const gbp = data.gbp_totals || {};
  const ga4History = data.ga4_traffic_history || [];
  const ga4Totals = data.ga4_totals || {};
  const ga4Conv = data.ga4_conversions || {};
  const citations = data.citations || {};
  const activePlan = data.active_plan;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {String(client.name)}
        </h1>
        <p className="text-sm text-gray-500">
          {client.city && client.state
            ? `${client.city}, ${client.state}`
            : String(client.domain)}
        </p>
      </div>

      {/* Row 1: Rankings Overview — 4 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {RANKING_TYPES.map((rt) => {
          const r = rankings[rt.key] || {};
          const hasData = r.found > 0;
          return (
            <div
              key={rt.key}
              className={cn(
                "rounded-xl border border-gray-200 bg-white shadow-sm p-4 hover:shadow-md transition-shadow",
              )}
            >
              {/* Label + icon */}
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("p-1.5 rounded-lg", rt.bg)}>
                  <rt.icon className={cn("h-4 w-4", rt.color)} />
                </div>
                <span className="text-sm font-semibold text-gray-700">
                  {rt.label}
                </span>
              </div>

              {hasData ? (
                <>
                  {/* Avg position */}
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-3xl font-bold text-gray-900">
                      {r.avg_rank != null ? r.avg_rank.toFixed(1) : "-"}
                    </span>
                    <span className="text-xs text-gray-400">avg pos</span>
                  </div>

                  {/* Improved / Declined */}
                  <div className="flex items-center gap-3 text-sm mb-2">
                    {r.improved > 0 && (
                      <span className="flex items-center gap-0.5 text-green-600 font-medium">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        {r.improved}
                      </span>
                    )}
                    {r.declined > 0 && (
                      <span className="flex items-center gap-0.5 text-red-500 font-medium">
                        <ArrowDownRight className="h-3.5 w-3.5" />
                        {r.declined}
                      </span>
                    )}
                  </div>

                  {/* Top 3 / Top 10 */}
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>
                      Top 3:{" "}
                      <span className="font-semibold text-gray-800">
                        {r.in_top_3 ?? 0}
                      </span>
                    </span>
                    {r.in_top_10 != null && (
                      <span>
                        Top 10:{" "}
                        <span className="font-semibold text-gray-800">
                          {r.in_top_10}
                        </span>
                      </span>
                    )}
                    {rt.key === "local_pack" && r.coverage_pct != null && (
                      <span>
                        Coverage:{" "}
                        <span className="font-semibold text-gray-800">
                          {r.coverage_pct}%
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Sparkline */}
                  {r.history && r.history.length > 1 && (
                    <Sparkline
                      data={r.history}
                      dataKey="avg_rank"
                      color={rt.stroke}
                      gradientId={`spark-${rt.key}`}
                      reversed
                    />
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center py-6 text-sm text-gray-400">
                  No data yet
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Row 2: GBP + Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Google Business Profile */}
        <SectionCard
          title="Google Business Profile"
          icon={Globe}
          iconColor="text-blue-600"
          href={`/clients/${id}/gbp`}
        >
          <p className="text-xs text-gray-500 mb-3">
            Customer Actions — Last 30 days
          </p>
          <div className="grid grid-cols-4 gap-3">
            <MiniMetric
              label="Impressions"
              value={formatNumber(gbp.impressions)}
              icon={Globe}
              color="text-blue-600"
            />
            <MiniMetric
              label="Calls"
              value={formatNumber(gbp.call_clicks)}
              icon={Phone}
              color="text-green-600"
            />
            <MiniMetric
              label="Website"
              value={formatNumber(gbp.website_clicks)}
              icon={MousePointerClick}
              color="text-purple-600"
            />
            <MiniMetric
              label="Directions"
              value={formatNumber(gbp.direction_requests)}
              icon={Navigation}
              color="text-orange-600"
            />
          </div>
        </SectionCard>

        {/* Reputation Manager */}
        <SectionCard
          title="Reputation Manager"
          icon={Star}
          iconColor="text-yellow-500"
          href={`/clients/${id}/gbp`}
        >
          {reviews ? (
            <>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Star Rating</p>
                  <StarDisplay rating={reviews.average_rating} />
                </div>
                <div className="text-right">
                  <MiniMetric
                    label="Total Reviews"
                    value={formatNumber(reviews.total_reviews)}
                    icon={MessageSquare}
                    color="text-blue-600"
                  />
                </div>
              </div>

              {/* Star distribution */}
              <div className="space-y-1">
                {[
                  { label: "5", count: reviews.five_star ?? 0, color: "bg-green-500" },
                  { label: "4", count: reviews.four_star ?? 0, color: "bg-green-400" },
                  { label: "3", count: reviews.three_star ?? 0, color: "bg-yellow-400" },
                  { label: "2", count: reviews.two_star ?? 0, color: "bg-orange-400" },
                  { label: "1", count: reviews.one_star ?? 0, color: "bg-red-500" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="w-4 text-gray-500 flex items-center gap-0.5">
                      {s.label}
                      <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", s.color)}
                        style={{
                          width: `${
                            reviews.total_reviews > 0
                              ? (s.count / reviews.total_reviews) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-gray-600">{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm">
              No review data yet
            </div>
          )}
        </SectionCard>
      </div>

      {/* Row 3: Analytics + Citations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Google Analytics */}
        <SectionCard
          title="Google Analytics"
          icon={BarChart3}
          iconColor="text-purple-600"
          href={`/clients/${id}/analytics`}
        >
          <div className="grid grid-cols-3 gap-3 mb-4">
            <MiniMetric
              label="Sessions (30d)"
              value={formatNumber(ga4Totals.sessions)}
              icon={BarChart3}
              color="text-blue-600"
            />
            <MiniMetric
              label="Users (30d)"
              value={formatNumber(ga4Totals.users)}
              icon={Users}
              color="text-green-600"
            />
            <MiniMetric
              label="Conversions (30d)"
              value={formatNumber(ga4Conv.organic)}
              icon={TrendingUp}
              color="text-purple-600"
            />
          </div>

          {ga4History.length > 0 && (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ga4History}>
                  <defs>
                    <linearGradient
                      id="sessGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#8b5cf6"
                        stopOpacity={0.15}
                      />
                      <stop
                        offset="95%"
                        stopColor="#8b5cf6"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    labelFormatter={(l: any) => `Date: ${l}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="organic_sessions"
                    name="Sessions"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#sessGrad)"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="organic_users"
                    name="Users"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    fill="none"
                    dot={false}
                    strokeDasharray="4 2"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        {/* Citations */}
        <SectionCard
          title="Citations"
          icon={Search}
          iconColor="text-emerald-600"
          href={`/clients/${id}/citations`}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Found / Total</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900">
                  {citations.found ?? 0}
                </span>
                <span className="text-lg text-gray-400">
                  / {citations.total ?? 0}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 mb-1">NAP Errors</p>
              <span
                className={cn(
                  "text-2xl font-bold",
                  (citations.nap_errors ?? 0) > 0
                    ? "text-red-500"
                    : "text-green-600"
                )}
              >
                {citations.nap_errors ?? 0}
              </span>
            </div>
          </div>

          {/* Citation score visual */}
          {citations.total > 0 && (
            <div>
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Citation Coverage</span>
                <span className="font-semibold text-gray-700">
                  {citations.total > 0
                    ? Math.round(((citations.found ?? 0) / citations.total) * 100)
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${
                      citations.total > 0
                        ? ((citations.found ?? 0) / citations.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* Row 4: Active Plan */}
      <div className="mb-5">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-indigo-600" />
              <h3 className="font-semibold text-gray-900">Active Plan</h3>
            </div>
            {activePlan && (
              <Link
                href={`/clients/${id}/plans/${activePlan.id}`}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View Plan <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div className="p-5">
            {activePlan ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">
                    {activePlan.name}
                  </span>
                  <span className="text-sm text-gray-500">
                    {activePlan.completed_items} / {activePlan.total_items} items
                    completed
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all"
                    style={{
                      width: `${activePlan.progress_pct ?? 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  {(activePlan.progress_pct ?? 0).toFixed(0)}% complete
                </p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-400 mb-2">No active plan</p>
                <Link
                  href={`/clients/${id}/plans`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  Create Plan
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
