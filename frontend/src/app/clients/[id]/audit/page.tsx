"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  fetchSiteAudits,
  fetchAuditPages,
  fetchLighthouseResults,
  runAudit,
  runLighthouse,
  type SiteAuditData,
  type AuditPageData,
  type LighthouseData,
} from "@/lib/api";
import { ActionButton } from "@/components/action-button";
import { cn, formatNumber } from "@/lib/utils";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Globe,
  Smartphone,
  Zap,
  FileText,
  Link2,
  Image,
  Eye,
  Loader2,
  ClipboardList,
  RefreshCw,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types & Helpers                                                     */
/* ------------------------------------------------------------------ */

type Tab = "overview" | "technical" | "seo" | "pages" | "lighthouse";

function scoreColor(level: "good" | "ok" | "poor") {
  if (level === "good") return "bg-green-500";
  if (level === "ok") return "bg-yellow-500";
  return "bg-red-500";
}

function scoreLabelColor(level: "good" | "ok" | "poor") {
  if (level === "good") return "text-green-700 bg-green-50";
  if (level === "ok") return "text-yellow-700 bg-yellow-50";
  return "text-red-700 bg-red-50";
}

function statusCodeColor(code: number | null) {
  if (code == null) return "text-gray-400";
  if (code >= 200 && code < 300) return "text-green-600 bg-green-50";
  if (code >= 300 && code < 400) return "text-yellow-600 bg-yellow-50";
  return "text-red-600 bg-red-50";
}

function lighthouseScoreLevel(score: number | null): "good" | "ok" | "poor" {
  if (score == null) return "poor";
  if (score >= 90) return "good";
  if (score >= 50) return "ok";
  return "poor";
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function ScoreCircle({
  label,
  level,
  icon: Icon,
}: {
  label: string;
  level: "good" | "ok" | "poor";
  icon: React.ElementType;
}) {
  const labels = { good: "Good", ok: "Needs Work", poor: "Poor" };
  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-gray-200 min-w-[140px]">
      <div
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center",
          scoreColor(level)
        )}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>
      <span className="text-sm font-medium text-gray-900">{label}</span>
      <span
        className={cn(
          "text-xs font-medium px-2 py-0.5 rounded-full",
          scoreLabelColor(level)
        )}
      >
        {labels[level]}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-gray-600",
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
      <div className={cn("p-2 rounded-lg bg-gray-50", color)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function IssueRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold px-2.5 py-0.5 rounded-full",
          count === 0
            ? "bg-green-50 text-green-700"
            : "bg-red-50 text-red-700"
        )}
      >
        {formatNumber(count)}
      </span>
    </div>
  );
}

function LighthouseScoreCircle({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  const level = lighthouseScoreLevel(score);
  const ringColor =
    level === "good"
      ? "border-green-500 text-green-700"
      : level === "ok"
        ? "border-yellow-500 text-yellow-700"
        : "border-red-500 text-red-700";

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "w-20 h-20 rounded-full border-4 flex items-center justify-center",
          ringColor
        )}
      >
        <span className="text-xl font-bold">
          {score != null ? score : "--"}
        </span>
      </div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </div>
  );
}

function CWVMetric({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
      <p className="text-2xl font-semibold text-gray-900">
        {value != null ? `${value.toFixed(unit === "s" ? 1 : unit === "" ? 3 : 0)}${unit}` : "--"}
      </p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                           */
/* ------------------------------------------------------------------ */

export default function AuditPage() {
  const params = useParams();
  const clientId = Number(params.id);

  const [audit, setAudit] = useState<SiteAuditData | null>(null);
  const [pages, setPages] = useState<AuditPageData[]>([]);
  const [lighthouse, setLighthouse] = useState<LighthouseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [searchUrl, setSearchUrl] = useState("");
  const [pageSearch, setPageSearch] = useState("");

  /* fetch audits */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [auditsRes, lhRes] = await Promise.all([
          fetchSiteAudits(clientId),
          fetchLighthouseResults(clientId),
        ]);
        if (cancelled) return;

        const latest = auditsRes.results[0] ?? null;
        setAudit(latest);
        setLighthouse(lhRes.results);

        if (latest) {
          const pagesRes = await fetchAuditPages(clientId, latest.id);
          if (!cancelled) setPages(pagesRes.results);
        }
      } catch (e) {
        console.error("Failed to load audit data", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  /* search pages */
  useEffect(() => {
    if (!audit) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const params = pageSearch ? `search=${encodeURIComponent(pageSearch)}` : "";
      try {
        const res = await fetchAuditPages(clientId, audit.id, params);
        if (!cancelled) setPages(res.results);
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [pageSearch, audit, clientId]);

  /* derived scores */
  const scores = useMemo(() => {
    if (!audit) return null;

    const errorCount =
      audit.total_4xx_errors + audit.total_5xx_errors + audit.broken_links_count;
    const technical: "good" | "ok" | "poor" =
      errorCount === 0 ? "good" : errorCount <= 10 ? "ok" : "poor";

    const seoIssues =
      audit.missing_titles +
      audit.missing_descriptions +
      audit.missing_h1 +
      audit.duplicate_titles +
      audit.duplicate_descriptions;
    const seo: "good" | "ok" | "poor" =
      seoIssues === 0 ? "good" : seoIssues <= 10 ? "ok" : "poor";

    const performance: "good" | "ok" | "poor" =
      audit.avg_page_load_time == null
        ? "ok"
        : audit.avg_page_load_time < 2000
          ? "good"
          : audit.avg_page_load_time < 5000
            ? "ok"
            : "poor";

    const security: "good" | "ok" | "poor" =
      audit.has_ssl === true ? "good" : audit.has_ssl === false ? "poor" : "ok";

    const mobile: "good" | "ok" | "poor" =
      audit.is_mobile_friendly === true && audit.is_responsive === true
        ? "good"
        : audit.is_mobile_friendly === false || audit.is_responsive === false
          ? "poor"
          : "ok";

    return { technical, seo, performance, security, mobile };
  }, [audit]);

  const latestLH = lighthouse[0] ?? null;

  /* loading */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  /* empty state */
  if (!audit) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <ClipboardList className="h-16 w-16 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700">
          No site audits yet
        </h2>
        <p className="text-sm text-gray-500 max-w-md text-center">
          Run your first audit to get a comprehensive analysis of technical SEO,
          on-page issues, performance, and more.
        </p>
        <button className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          Run Audit
        </button>
      </div>
    );
  }

  /* tabs */
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "technical", label: "Technical" },
    { key: "seo", label: "SEO Issues" },
    { key: "pages", label: "Pages" },
    ...(lighthouse.length > 0
      ? [{ key: "lighthouse" as Tab, label: "Lighthouse" }]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Site Audit</h1>
          <div className="flex items-center gap-2">
            <ActionButton
              label="Run Audit"
              loadingLabel="Auditing..."
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => runAudit(clientId)}
              onSuccess={() => {
                fetchSiteAudits(clientId).then((res) => {
                  const latest = res.results[0] ?? null;
                  setAudit(latest);
                  if (latest) {
                    fetchAuditPages(clientId, latest.id).then((pagesRes) => setPages(pagesRes.results));
                  }
                });
              }}
            />
            <ActionButton
              label="Run Lighthouse"
              loadingLabel="Running..."
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => runLighthouse(clientId)}
              onSuccess={() => {
                fetchLighthouseResults(clientId).then((res) => setLighthouse(res.results));
              }}
            />
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {audit.target_url} &middot;{" "}
          {new Date(audit.created_at).toLocaleDateString()} &middot;{" "}
          {formatNumber(audit.pages_crawled)} pages crawled
        </p>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                tab === t.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview */}
      {tab === "overview" && scores && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <ScoreCircle label="Technical" level={scores.technical} icon={Shield} />
            <ScoreCircle label="SEO" level={scores.seo} icon={Search} />
            <ScoreCircle label="Performance" level={scores.performance} icon={Zap} />
            <ScoreCircle label="Security" level={scores.security} icon={ShieldCheck} />
            <ScoreCircle label="Mobile" level={scores.mobile} icon={Smartphone} />
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Pages Crawled"
              value={formatNumber(audit.pages_crawled)}
              icon={Globe}
            />
            <StatCard
              label="Errors Found"
              value={formatNumber(audit.pages_with_errors)}
              icon={XCircle}
              color="text-red-500"
            />
            <StatCard
              label="Warnings"
              value={formatNumber(audit.pages_with_warnings)}
              icon={AlertTriangle}
              color="text-yellow-500"
            />
            <StatCard
              label="Healthy"
              value={formatNumber(
                audit.pages_crawled -
                  audit.pages_with_errors -
                  audit.pages_with_warnings
              )}
              icon={CheckCircle2}
              color="text-green-500"
            />
          </div>

          {/* Boolean checks */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "SSL", val: audit.has_ssl },
              { label: "robots.txt", val: audit.has_robots_txt },
              { label: "Sitemap", val: audit.has_sitemap },
              { label: "Responsive", val: audit.is_responsive },
              { label: "Mobile-friendly", val: audit.is_mobile_friendly },
            ].map(({ label, val }) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border text-sm font-medium",
                  val === true
                    ? "border-green-200 bg-green-50 text-green-700"
                    : val === false
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-gray-200 bg-gray-50 text-gray-500"
                )}
              >
                {val === true ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : val === false ? (
                  <XCircle className="h-4 w-4" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Technical */}
      {tab === "technical" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="4xx Errors"
            value={formatNumber(audit.total_4xx_errors)}
            icon={ShieldAlert}
            color="text-red-500"
          />
          <StatCard
            label="5xx Errors"
            value={formatNumber(audit.total_5xx_errors)}
            icon={XCircle}
            color="text-red-600"
          />
          <StatCard
            label="Broken Links"
            value={formatNumber(audit.broken_links_count)}
            icon={Link2}
            color="text-orange-500"
          />
          <StatCard
            label="Non-indexable Pages"
            value={formatNumber(audit.non_indexable_pages)}
            icon={Eye}
            color="text-yellow-500"
          />
        </div>
      )}

      {/* SEO Issues */}
      {tab === "seo" && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">
              On-Page SEO Issues
            </h3>
          </div>
          <IssueRow label="Missing Titles" count={audit.missing_titles} />
          <IssueRow label="Duplicate Titles" count={audit.duplicate_titles} />
          <IssueRow
            label="Missing Descriptions"
            count={audit.missing_descriptions}
          />
          <IssueRow
            label="Duplicate Descriptions"
            count={audit.duplicate_descriptions}
          />
          <IssueRow label="Missing H1" count={audit.missing_h1} />
          <IssueRow label="Missing Alt Tags" count={audit.missing_alt_tags} />
          <IssueRow
            label="Non-indexable Pages"
            count={audit.non_indexable_pages}
          />
          <IssueRow
            label="Thin Content (< 500 words)"
            count={audit.thin_content_pages}
          />
        </div>
      )}

      {/* Pages */}
      {tab === "pages" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by URL..."
              value={pageSearch}
              onChange={(e) => setPageSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    URL
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">
                    Title
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">
                    Words
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">
                    Load Time
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">
                    Links
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">
                    Issues
                  </th>
                </tr>
              </thead>
              <tbody>
                {pages.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      No pages found
                    </td>
                  </tr>
                )}
                {pages.map((p) => {
                  const issueCount = p.errors.length + p.warnings.length;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 max-w-xs truncate text-gray-700">
                        {p.url}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "inline-block px-2 py-0.5 rounded text-xs font-medium",
                            statusCodeColor(p.status_code)
                          )}
                        >
                          {p.status_code ?? "--"}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-gray-700">
                        {p.title || (
                          <span className="text-red-400 italic">Missing</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {p.word_count != null ? formatNumber(p.word_count) : "--"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {p.page_load_time != null
                          ? `${(p.page_load_time / 1000).toFixed(1)}s`
                          : "--"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {p.internal_links_count + p.external_links_count}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {issueCount > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
                            {issueCount}
                          </span>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-green-500 inline-block" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lighthouse */}
      {tab === "lighthouse" && latestLH && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Lighthouse Scores
            </h3>
            <p className="text-xs text-gray-500">
              {latestLH.url} &middot;{" "}
              {latestLH.is_mobile ? "Mobile" : "Desktop"} &middot;{" "}
              {new Date(latestLH.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="flex flex-wrap gap-6 justify-center sm:justify-start">
            <LighthouseScoreCircle
              label="Performance"
              score={latestLH.performance_score}
            />
            <LighthouseScoreCircle
              label="Accessibility"
              score={latestLH.accessibility_score}
            />
            <LighthouseScoreCircle
              label="Best Practices"
              score={latestLH.best_practices_score}
            />
            <LighthouseScoreCircle label="SEO" score={latestLH.seo_score} />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Core Web Vitals
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <CWVMetric
                label="First Contentful Paint"
                value={
                  latestLH.first_contentful_paint != null
                    ? latestLH.first_contentful_paint / 1000
                    : null
                }
                unit="s"
              />
              <CWVMetric
                label="Largest Contentful Paint"
                value={
                  latestLH.largest_contentful_paint != null
                    ? latestLH.largest_contentful_paint / 1000
                    : null
                }
                unit="s"
              />
              <CWVMetric
                label="Total Blocking Time"
                value={latestLH.total_blocking_time}
                unit="ms"
              />
              <CWVMetric
                label="Cumulative Layout Shift"
                value={latestLH.cumulative_layout_shift}
                unit=""
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
