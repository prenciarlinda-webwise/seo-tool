"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  fetchBacklinkSummary,
  fetchBacklinks,
  fetchReferringDomains,
  fetchAnchors,
  runBacklinks,
  type BacklinkSummaryData,
  type BacklinkData,
  type ReferringDomainData,
  type AnchorData,
} from "@/lib/api";
import { ActionButton } from "@/components/action-button";
import { cn, formatNumber } from "@/lib/utils";
import {
  Link2,
  Globe,
  Shield,
  ShieldOff,
  Award,
  TrendingUp,
  TrendingDown,
  Search,
  ExternalLink,
  Activity,
  Anchor,
  RefreshCw,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Tab = "backlinks" | "referring-domains" | "anchors";

const TABS: { key: Tab; label: string }[] = [
  { key: "backlinks", label: "Backlinks" },
  { key: "referring-domains", label: "Referring Domains" },
  { key: "anchors", label: "Anchors" },
];

/* ------------------------------------------------------------------ */
/*  Small components                                                   */
/* ------------------------------------------------------------------ */

function SummaryCard({
  label,
  value,
  icon,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </span>
        <span className="text-gray-400">{icon}</span>
      </div>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {sub && (
        <span className={cn("text-xs font-medium", subColor || "text-gray-500")}>
          {sub}
        </span>
      )}
    </div>
  );
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        color,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function BacklinksPage() {
  const { slug } = useParams<{ slug: string }>();
  const clientSlug = slug;

  const [tab, setTab] = useState<Tab>("backlinks");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Data
  const [summary, setSummary] = useState<BacklinkSummaryData | null>(null);
  const [backlinks, setBacklinks] = useState<BacklinkData[]>([]);
  const [domains, setDomains] = useState<ReferringDomainData[]>([]);
  const [anchorTexts, setAnchorTexts] = useState<AnchorData[]>([]);

  // Pagination
  const [blPage, setBlPage] = useState(1);
  const [blCount, setBlCount] = useState(0);
  const [rdPage, setRdPage] = useState(1);
  const [rdCount, setRdCount] = useState(0);
  const [anPage, setAnPage] = useState(1);
  const [anCount, setAnCount] = useState(0);

  const PAGE_SIZE = 50;

  const loadSummary = useCallback(async () => {
    try {
      const s = await fetchBacklinkSummary(clientSlug);
      setSummary(s);
    } catch {
      /* ignore */
    }
  }, [clientSlug]);

  const loadBacklinks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(blPage));
      params.set("page_size", String(PAGE_SIZE));
      if (search) params.set("search", search);
      const res = await fetchBacklinks(clientSlug, params.toString());
      setBacklinks(res.results);
      setBlCount(res.count);
    } catch {
      /* ignore */
    }
  }, [clientSlug, blPage, search]);

  const loadDomains = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(rdPage));
      params.set("page_size", String(PAGE_SIZE));
      if (search) params.set("search", search);
      const res = await fetchReferringDomains(clientSlug, params.toString());
      setDomains(res.results);
      setRdCount(res.count);
    } catch {
      /* ignore */
    }
  }, [clientSlug, rdPage, search]);

  const loadAnchors = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(anPage));
      params.set("page_size", String(PAGE_SIZE));
      if (search) params.set("search", search);
      const res = await fetchAnchors(clientSlug, params.toString());
      setAnchorTexts(res.results);
      setAnCount(res.count);
    } catch {
      /* ignore */
    }
  }, [clientSlug, anPage, search]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([loadSummary(), loadBacklinks(), loadDomains(), loadAnchors()]).finally(() =>
      setLoading(false),
    );
  }, [loadSummary, loadBacklinks, loadDomains, loadAnchors]);

  // Reset page on search change
  useEffect(() => {
    setBlPage(1);
    setRdPage(1);
    setAnPage(1);
  }, [search]);

  /* ---- helpers ---- */

  function currentCount() {
    if (tab === "backlinks") return blCount;
    if (tab === "referring-domains") return rdCount;
    return anCount;
  }

  function currentPage() {
    if (tab === "backlinks") return blPage;
    if (tab === "referring-domains") return rdPage;
    return anPage;
  }

  function setCurrentPage(p: number) {
    if (tab === "backlinks") setBlPage(p);
    else if (tab === "referring-domains") setRdPage(p);
    else setAnPage(p);
  }

  const totalPages = Math.max(1, Math.ceil(currentCount() / PAGE_SIZE));

  function shortDate(d: string | null) {
    if (!d) return "-";
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <Activity className="h-5 w-5 animate-pulse" />
          <span className="text-sm">Loading backlinks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Backlinks</h1>
        <ActionButton
          label="Pull Backlinks"
          loadingLabel="Pulling..."
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => runBacklinks(clientSlug)}
          onSuccess={() => {
            Promise.all([loadSummary(), loadBacklinks(), loadDomains(), loadAnchors()]);
          }}
        />
      </div>

      {/* ---- Summary Cards ---- */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <SummaryCard
            label="Total Backlinks"
            value={formatNumber(summary.total_backlinks)}
            icon={<Link2 className="h-4 w-4" />}
            sub={
              summary.new_backlinks || summary.lost_backlinks
                ? `+${formatNumber(summary.new_backlinks)} / -${formatNumber(summary.lost_backlinks)}`
                : undefined
            }
            subColor={
              summary.new_backlinks > summary.lost_backlinks
                ? "text-green-600"
                : summary.lost_backlinks > summary.new_backlinks
                  ? "text-red-600"
                  : "text-gray-500"
            }
          />
          <SummaryCard
            label="Referring Domains"
            value={formatNumber(summary.referring_domains)}
            icon={<Globe className="h-4 w-4" />}
            sub={
              summary.new_referring_domains || summary.lost_referring_domains
                ? `+${formatNumber(summary.new_referring_domains)} / -${formatNumber(summary.lost_referring_domains)}`
                : undefined
            }
            subColor={
              summary.new_referring_domains > summary.lost_referring_domains
                ? "text-green-600"
                : "text-gray-500"
            }
          />
          <SummaryCard
            label="Dofollow"
            value={formatNumber(summary.dofollow)}
            icon={<Shield className="h-4 w-4" />}
            sub={
              summary.total_backlinks > 0
                ? `${((summary.dofollow / summary.total_backlinks) * 100).toFixed(1)}% of total`
                : undefined
            }
          />
          <SummaryCard
            label="Nofollow"
            value={formatNumber(summary.nofollow)}
            icon={<ShieldOff className="h-4 w-4" />}
            sub={
              summary.total_backlinks > 0
                ? `${((summary.nofollow / summary.total_backlinks) * 100).toFixed(1)}% of total`
                : undefined
            }
          />
          <SummaryCard
            label="Domain Rank"
            value={summary.rank != null ? String(summary.rank) : "-"}
            icon={<Award className="h-4 w-4" />}
            sub={summary.date ? `as of ${shortDate(summary.date)}` : undefined}
          />
        </div>
      )}

      {/* ---- Tabs + Search ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                tab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* ---- Tab Content ---- */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {tab === "backlinks" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Source URL
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Source Domain
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Target URL
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Anchor
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Follow
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Rank
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    First Seen
                  </th>
                </tr>
              </thead>
              <tbody>
                {backlinks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No backlinks found.
                    </td>
                  </tr>
                ) : (
                  backlinks.map((bl) => (
                    <tr
                      key={bl.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-2.5 max-w-[200px] truncate">
                        <a
                          href={bl.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          <span className="truncate">{bl.source_url}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 font-medium">
                        {bl.source_domain}
                      </td>
                      <td className="px-4 py-2.5 max-w-[200px] truncate text-gray-600">
                        {bl.target_url}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 max-w-[150px] truncate">
                        {bl.anchor || "-"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {bl.is_dofollow ? (
                          <Badge color="bg-green-100 text-green-800">dofollow</Badge>
                        ) : (
                          <Badge color="bg-gray-100 text-gray-600">nofollow</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {bl.is_new && (
                          <Badge color="bg-blue-100 text-blue-800">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            New
                          </Badge>
                        )}
                        {bl.is_lost && (
                          <Badge color="bg-red-100 text-red-800">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Lost
                          </Badge>
                        )}
                        {!bl.is_new && !bl.is_lost && (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {bl.source_rank ?? "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                        {shortDate(bl.first_seen)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "referring-domains" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Domain
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Backlinks
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Dofollow
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Nofollow
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Rank
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    First Seen
                  </th>
                </tr>
              </thead>
              <tbody>
                {domains.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No referring domains found.
                    </td>
                  </tr>
                ) : (
                  domains.map((rd) => (
                    <tr
                      key={rd.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-2.5 text-gray-900 font-medium">
                        {rd.domain}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-900 font-medium">
                        {formatNumber(rd.backlinks_count)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-green-700">
                        {formatNumber(rd.dofollow_count)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500">
                        {formatNumber(rd.nofollow_count)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {rd.rank ?? "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                        {shortDate(rd.first_seen)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "anchors" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Anchor Text
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Backlinks
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Referring Domains
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Dofollow
                  </th>
                </tr>
              </thead>
              <tbody>
                {anchorTexts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No anchor texts found.
                    </td>
                  </tr>
                ) : (
                  anchorTexts.map((an) => (
                    <tr
                      key={an.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-2.5 text-gray-900 font-medium max-w-[300px] truncate">
                        <div className="flex items-center gap-2">
                          <Anchor className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                          {an.anchor || "(empty)"}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-900 font-medium">
                        {formatNumber(an.backlinks_count)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">
                        {formatNumber(an.referring_domains)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-green-700">
                        {formatNumber(an.dofollow)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ---- Pagination ---- */}
        {currentCount() > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-600">
              Showing {(currentPage() - 1) * PAGE_SIZE + 1}-
              {Math.min(currentPage() * PAGE_SIZE, currentCount())} of{" "}
              {formatNumber(currentCount())}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage() - 1))}
                disabled={currentPage() === 1}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md border transition-colors",
                  currentPage() === 1
                    ? "border-gray-200 text-gray-400 cursor-not-allowed"
                    : "border-gray-300 text-gray-700 hover:bg-gray-100",
                )}
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage() + 1))}
                disabled={currentPage() === totalPages}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md border transition-colors",
                  currentPage() === totalPages
                    ? "border-gray-200 text-gray-400 cursor-not-allowed"
                    : "border-gray-300 text-gray-700 hover:bg-gray-100",
                )}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
