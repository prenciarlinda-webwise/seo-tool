const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Clients ---

export function fetchClients() {
  return request<PaginatedResponse<Client>>("/clients/");
}

export function fetchClient(slug: string) {
  return request<Client>(`/clients/${slug}/`);
}

export function fetchClientSummary(slug: string) {
  return request<ClientSummary>(`/clients/${slug}/summary/`);
}

export function createClient(data: Partial<Client>) {
  return request<Client>("/clients/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateClient(slug: string, data: Partial<Client>) {
  return request<Client>(`/clients/${slug}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteClient(slug: string) {
  return request<void>(`/clients/${slug}/`, { method: "DELETE" });
}

export function syncClient(slug: string) {
  return request<{ message: string; results: Record<string, unknown> }>(`/clients/${slug}/sync/`, {
    method: "POST",
  });
}

export function runDiscovery(slug: string) {
  return request<{ message: string }>(`/clients/${slug}/run-discovery/`, { method: "POST" });
}

export function runRanks(slug: string) {
  return request<{ message: string }>(`/clients/${slug}/run-ranks/`, { method: "POST" });
}

export function runBacklinks(slug: string) {
  return request<{ message: string }>(`/clients/${slug}/run-backlinks/`, { method: "POST" });
}

export function runAudit(slug: string) {
  return request<{ message: string; audit_id: number }>(`/clients/${slug}/run-audit/`, { method: "POST" });
}

export function fetchAuditResults(slug: string) {
  return request<{ message: string; status: string; audit_id?: number }>(`/clients/${slug}/fetch-audit-results/`, { method: "POST" });
}

export function runLighthouse(slug: string) {
  return request<{ message: string; scores: Record<string, number> }>(`/clients/${slug}/run-lighthouse/`, { method: "POST" });
}

export function runCompetitors(slug: string) {
  return request<{ message: string }>(`/clients/${slug}/run-competitors/`, { method: "POST" });
}

export async function importClients(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/clients/import/`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ created: number; updated: number; errors: string[] }>;
}

export function exportClientsUrl() {
  return `${API_URL}/clients/export/`;
}

export async function importCitations(clientSlug: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}/clients/${clientSlug}/citations/import/`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ created: number; skipped: number; errors: string[]; message: string }>;
}

export function exportCitationsUrl(clientSlug: string) {
  return `${API_URL}/clients/${clientSlug}/citations/export/`;
}

export function triggerCitationCheck(clientSlug: string) {
  return request<{ message: string }>(`/clients/${clientSlug}/citations/check/`, { method: "POST" });
}

// --- Keywords ---

export function fetchKeywords(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<Keyword>>(
    `/clients/${clientSlug}/keywords/${qs}`
  );
}

export function createKeyword(clientSlug: string, data: Partial<Keyword>) {
  return request<Keyword>(`/clients/${clientSlug}/keywords/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateKeyword(
  clientSlug: string,
  keywordId: number,
  data: Partial<Keyword>
) {
  return request<Keyword>(`/clients/${clientSlug}/keywords/${keywordId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteKeyword(clientSlug: string, keywordId: number) {
  return request<void>(`/clients/${clientSlug}/keywords/${keywordId}/`, {
    method: "DELETE",
  });
}

export function bulkUpdateKeywordStatus(
  clientSlug: string,
  keywordIds: number[],
  status: string
) {
  return request<{ updated: number }>(
    `/clients/${clientSlug}/keywords/bulk-status/`,
    {
      method: "POST",
      body: JSON.stringify({ keyword_ids: keywordIds, status }),
    }
  );
}

// --- Rankings ---

export function fetchLatestRankings(clientSlug: string, compareDate?: string) {
  const qs = compareDate ? `?compare_date=${compareDate}` : "";
  return request<LatestRankingsResponse>(`/clients/${clientSlug}/rankings/latest/${qs}`);
}

export interface LatestRankingsResponse {
  summary: {
    total_keywords: number;
    desktop: RankTypeSummary;
    mobile: RankTypeSummary;
    local_pack: RankTypeSummary;
  };
  keywords: LatestRank[];
  location: string;
}

export function fetchRankChanges(clientSlug: string) {
  return request<LatestRank[]>(`/clients/${clientSlug}/rankings/changes/`);
}

export function fetchOrganicRankings(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<SERPResult>>(
    `/clients/${clientSlug}/rankings/organic/${qs}`
  );
}

export function fetchMapsRankings(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<MapsRankResult>>(
    `/clients/${clientSlug}/rankings/maps/${qs}`
  );
}

export interface CheckDate {
  date: string;
  keywords_checked: number;
}

export function fetchCheckDates(clientSlug: string) {
  return request<{ dates: CheckDate[] }>(`/clients/${clientSlug}/rankings/dates/`);
}

export function fetchRankComparison(
  clientSlug: string,
  dateCurrent: string,
  datePrevious: string,
  maxRank?: number
) {
  let qs = `?date_current=${dateCurrent}&date_previous=${datePrevious}`;
  if (maxRank) qs += `&max_rank=${maxRank}`;
  return request<RankComparisonResponse>(
    `/clients/${clientSlug}/rankings/compare/${qs}`
  );
}

// --- Discovery ---

export function fetchDiscoveryRuns(clientSlug: string) {
  return request<PaginatedResponse<DiscoveryRun>>(
    `/clients/${clientSlug}/discovery/runs/`
  );
}

export function fetchDiscoveryResults(
  clientSlug: string,
  runId: number,
  params?: string
) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<DiscoveryResult>>(
    `/clients/${clientSlug}/discovery/runs/${runId}/results/${qs}`
  );
}

export function promoteKeywords(clientSlug: string, keywordTexts: string[]) {
  return request<{ created: number; total: number }>(
    `/clients/${clientSlug}/discovery/promote/`,
    {
      method: "POST",
      body: JSON.stringify({ keyword_texts: keywordTexts }),
    }
  );
}

// --- Plans ---

export function fetchPlans(clientSlug: string) {
  return request<PaginatedResponse<QuarterlyPlanSummary>>(`/clients/${clientSlug}/plans/`);
}

export function fetchPlan(clientSlug: string, planId: number) {
  return request<QuarterlyPlanDetail>(`/clients/${clientSlug}/plans/${planId}/`);
}

export function createPlan(clientSlug: string, data: Partial<QuarterlyPlanDetail>) {
  return request<QuarterlyPlanDetail>(`/clients/${clientSlug}/plans/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePlan(clientSlug: string, planId: number, data: Partial<QuarterlyPlanDetail>) {
  return request<QuarterlyPlanDetail>(`/clients/${clientSlug}/plans/${planId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deletePlan(clientSlug: string, planId: number) {
  return request<void>(`/clients/${clientSlug}/plans/${planId}/`, { method: "DELETE" });
}

export function createPlanItem(clientSlug: string, planId: number, data: Partial<PlanItem>) {
  return request<PlanItem>(`/clients/${clientSlug}/plans/${planId}/items/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePlanItem(clientSlug: string, planId: number, itemId: number, data: Partial<PlanItem>) {
  return request<PlanItem>(`/clients/${clientSlug}/plans/${planId}/items/${itemId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deletePlanItem(clientSlug: string, planId: number, itemId: number) {
  return request<void>(`/clients/${clientSlug}/plans/${planId}/items/${itemId}/`, { method: "DELETE" });
}

export function createDeliverable(clientSlug: string, planId: number, itemId: number, data: Partial<DeliverableData>) {
  return request<DeliverableData>(`/clients/${clientSlug}/plans/${planId}/items/${itemId}/deliverables/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateDeliverable(clientSlug: string, planId: number, itemId: number, deliverableId: number, data: Partial<DeliverableData>) {
  return request<DeliverableData>(`/clients/${clientSlug}/plans/${planId}/items/${itemId}/deliverables/${deliverableId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteDeliverable(clientSlug: string, planId: number, itemId: number, deliverableId: number) {
  return request<void>(`/clients/${clientSlug}/plans/${planId}/items/${itemId}/deliverables/${deliverableId}/`, { method: "DELETE" });
}

// --- Pages ---

export function fetchPages(clientSlug: string) {
  return request<PagesResponse>(`/clients/${clientSlug}/pages/`);
}

// --- GBP ---

export function fetchGBPPerformance(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<GBPPerformanceMetric>>(
    `/clients/${clientSlug}/gbp/performance/${qs}`
  );
}

export function fetchGBPCalls(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<GBPCallMetric>>(
    `/clients/${clientSlug}/gbp/calls/${qs}`
  );
}

export function fetchGBPReviews(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<GBPReviewSnapshot>>(
    `/clients/${clientSlug}/gbp/reviews/${qs}`
  );
}

export function fetchGBPSearchKeywords(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<GBPSearchKeyword>>(
    `/clients/${clientSlug}/gbp/search-keywords/${qs}`
  );
}

// --- Analytics ---

export function fetchGA4Traffic(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<GA4TrafficSnapshot>>(
    `/clients/${clientSlug}/analytics/traffic/${qs}`
  );
}

export function fetchGA4LandingPages(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<GA4LandingPage>>(
    `/clients/${clientSlug}/analytics/landing-pages/${qs}`
  );
}

export function fetchGA4Events(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<GA4Event>>(
    `/clients/${clientSlug}/analytics/events/${qs}`
  );
}

export function fetchGA4Conversions(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<GA4ConversionSummary>>(
    `/clients/${clientSlug}/analytics/conversions/${qs}`
  );
}

// --- Citations ---

export function fetchCitationSummary(clientSlug: string) {
  return request<CitationSummaryResponse>(`/clients/${clientSlug}/citations/summary/`);
}

export function fetchCitations(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<CitationData>>(`/clients/${clientSlug}/citations/${qs}`);
}

export function createCitation(clientSlug: string, data: Partial<CitationData>) {
  return request<CitationData>(`/clients/${clientSlug}/citations/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCitation(clientSlug: string, citationId: number, data: Partial<CitationData>) {
  return request<CitationData>(`/clients/${clientSlug}/citations/${citationId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteCitation(clientSlug: string, citationId: number) {
  return request<void>(`/clients/${clientSlug}/citations/${citationId}/`, { method: "DELETE" });
}

export function fetchCitationDirectories() {
  return request<PaginatedResponse<CitationDirectoryData>>(`/citation-directories/`);
}

// --- Backlinks ---

export function fetchBacklinkSummary(clientSlug: string) {
  return request<BacklinkSummaryData>(`/clients/${clientSlug}/backlinks/summary/`);
}

export function fetchBacklinks(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<BacklinkData>>(`/clients/${clientSlug}/backlinks/links/${qs}`);
}

export function fetchReferringDomains(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<ReferringDomainData>>(`/clients/${clientSlug}/backlinks/referring-domains/${qs}`);
}

export function fetchAnchors(clientSlug: string, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<AnchorData>>(`/clients/${clientSlug}/backlinks/anchors/${qs}`);
}

// --- Competitors ---

export function fetchCompetitors(clientSlug: string) {
  return request<PaginatedResponse<CompetitorData>>(`/clients/${clientSlug}/competitors/`);
}

export function createCompetitor(clientSlug: string, data: { domain: string; name?: string }) {
  return request<CompetitorData>(`/clients/${clientSlug}/competitors/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteCompetitor(clientSlug: string, competitorId: number) {
  return request<void>(`/clients/${clientSlug}/competitors/${competitorId}/`, { method: "DELETE" });
}

export interface CompetitorRankingsResponse {
  date_current: string;
  date_previous: string | null;
  competitors: { id: number; domain: string; name: string }[];
  keywords: {
    keyword_id: number;
    keyword_text: string;
    search_volume: number | null;
    client_rank: number | null;
    competitors: Record<number, { rank: number | null; change: number | null }>;
  }[];
}

export function fetchCompetitorRankings(clientSlug: string, dateCurrent: string, datePrevious?: string) {
  let qs = `?date_current=${dateCurrent}`;
  if (datePrevious) qs += `&date_previous=${datePrevious}`;
  return request<CompetitorRankingsResponse>(`/clients/${clientSlug}/rankings/competitors/${qs}`);
}

// --- Site Audit ---

export function fetchSiteAudits(clientSlug: string) {
  return request<PaginatedResponse<SiteAuditData>>(`/clients/${clientSlug}/audits/`);
}

export function fetchSiteAudit(clientSlug: string, auditId: number) {
  return request<SiteAuditData>(`/clients/${clientSlug}/audits/${auditId}/`);
}

export function fetchAuditPages(clientSlug: string, auditId: number, params?: string) {
  const qs = params ? `?${params}` : "";
  return request<PaginatedResponse<AuditPageData>>(`/clients/${clientSlug}/audits/${auditId}/pages/${qs}`);
}

export function fetchLighthouseResults(clientSlug: string) {
  return request<PaginatedResponse<LighthouseData>>(`/clients/${clientSlug}/lighthouse/`);
}

// --- Types ---

export interface CompetitorData {
  id: number;
  client: number;
  domain: string;
  name: string;
  is_auto_discovered: boolean;
  created_at: string;
}

export interface Client {
  id: number;
  slug: string;
  name: string;
  domain: string;
  website_url: string;
  business_type: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  city: string;
  state: string;
  zip_code: string;
  is_active: boolean;
  track_organic: boolean;
  track_mobile: boolean;
  track_maps: boolean;
  discovery_enabled: boolean;
  tracked_keywords_count: number;
  discovered_keywords_count: number;
  rankings_up?: number;
  rankings_down?: number;
  rankings_new?: number;
  avg_position?: number | null;
  organic_sessions?: number | null;
  created_at: string;
  updated_at: string;
}

export interface RankingSummary {
  found: number;
  not_found: number;
  avg_rank: number | null;
  improved: number;
  declined: number;
  in_top_3?: number;
  in_top_10?: number;
  in_top_20?: number;
  in_top_50?: number;
  coverage_pct?: number;
  history: { date: string; avg_rank: number }[];
}

export interface ClientSummary {
  client: Client;
  total_tracked_keywords: number;
  total_discovered_keywords: number;
  last_discovery_run: string | null;
  last_rank_check: string | null;
  rankings: {
    desktop: RankingSummary;
    mobile: RankingSummary;
    local_pack: RankingSummary;
    local_finder: RankingSummary;
  };
  reviews: {
    total_reviews: number;
    average_rating: number | null;
    new_reviews_since_last: number;
    response_rate: number | null;
    five_star: number;
    four_star: number;
    three_star: number;
    two_star: number;
    one_star: number;
  } | null;
  gbp_totals: {
    impressions: number;
    interactions: number;
    call_clicks: number;
    website_clicks: number;
    direction_requests: number;
  };
  ga4_traffic_history: {
    date: string;
    organic_sessions: number;
    organic_users: number;
  }[];
  ga4_totals: {
    sessions: number;
    users: number;
    total_sessions: number;
  };
  ga4_conversions: {
    total: number;
    organic: number;
  };
  citations: {
    total: number;
    found: number;
    nap_errors: number;
  };
  active_plan: {
    id: number;
    name: string;
    progress_pct: number;
    total_items: number;
    completed_items: number;
  } | null;
}

export interface Keyword {
  id: number;
  client: number;
  keyword_text: string;
  status: "tracked" | "discovered" | "ignored" | "paused";
  intent: string;
  group_name: string;
  is_branded: boolean;
  is_primary: boolean;
  maps_enabled: boolean;
  search_volume: number | null;
  competition: number | null;
  cpc: string | null;
  keyword_difficulty: number | null;
  current_organic_rank: number | null;
  current_organic_url: string;
  current_maps_rank: number | null;
  previous_organic_rank: number | null;
  previous_maps_rank: number | null;
  rank_change: number | null;
  last_checked_at: string | null;
  created_at: string;
}

export interface LatestRank {
  keyword_id: number;
  keyword_text: string;
  search_volume: number | null;
  keyword_difficulty: number | null;
  organic_rank: number | null;
  organic_url: string;
  organic_rank_change: number | null;
  organic_serp_url: string;
  organic_screenshot_url: string;
  mobile_rank: number | null;
  mobile_url: string;
  mobile_rank_change: number | null;
  mobile_serp_url: string;
  maps_rank: number | null;
  maps_rank_change: number | null;
  maps_serp_url: string;
  last_checked: string | null;
}

export interface SERPResult {
  id: number;
  keyword: number;
  keyword_text: string;
  checked_at: string;
  rank_absolute: number | null;
  rank_group: number | null;
  is_found: boolean;
  url: string;
  title: string;
  rank_change: number | null;
  previous_rank: number | null;
  featured_snippet_present: boolean;
  local_pack_present: boolean;
  ai_overview_present: boolean;
}

export interface MapsRankResult {
  id: number;
  keyword: number;
  keyword_text: string;
  checked_at: string;
  rank_group: number | null;
  is_found: boolean;
  title: string;
  rating_value: number | null;
  rating_count: number | null;
  rank_change: number | null;
}

export interface DiscoveryRun {
  id: number;
  client: number;
  run_date: string;
  total_keywords_found: number;
  new_keywords_found: number;
  keywords_in_top_10: number;
  keywords_in_top_20: number;
  status: string;
}

export interface DiscoveryResult {
  id: number;
  keyword_text: string;
  rank_absolute: number | null;
  url: string;
  search_volume: number | null;
  competition: number | null;
  cpc: string | null;
  keyword_difficulty: number | null;
  is_new: boolean;
  is_promoted: boolean;
  is_interesting: boolean;
  source?: "ranked" | "competitor_gap";
  competitor_domain?: string;
}

export interface PageKeyword {
  keyword_id: number;
  keyword_text: string;
  rank: number | null;
  rank_change: number | null;
  search_volume: number | null;
  maps_rank: number | null;
  estimated_traffic: number | null;
  in_plan: boolean;
  plan_target_rank: number | null;
}

export interface PageData {
  url: string;
  total_keywords: number;
  avg_position: number | null;
  best_position: number | null;
  total_volume: number;
  total_traffic: number | null;
  keywords_improved: number;
  keywords_declined: number;
  in_plan: boolean;
  plan_keywords_count: number;
  keywords: PageKeyword[];
}

export interface PagesResponse {
  pages: PageData[];
  total_pages: number;
  total_traffic: number;
}

export interface GBPPerformanceMetric {
  id: number;
  date: string;
  total_impressions: number;
  total_interactions: number;
  call_clicks: number;
  website_clicks: number;
  direction_requests: number;
  business_impressions_desktop_maps: number;
  business_impressions_desktop_search: number;
  business_impressions_mobile_maps: number;
  business_impressions_mobile_search: number;
}

export interface GBPCallMetric {
  id: number;
  date: string;
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  avg_duration_seconds: number | null;
}

export interface GBPReviewSnapshot {
  id: number;
  date: string;
  total_reviews: number;
  average_rating: number | null;
  new_reviews_since_last: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
  response_rate: number | null;
}

export interface GBPSearchKeyword {
  id: number;
  keyword: string;
  impressions: number;
  period_start: string;
  period_end: string;
  impressions_change: number | null;
  impressions_change_pct: number | null;
}

export interface GA4TrafficSnapshot {
  id: number;
  date: string;
  organic_sessions: number;
  organic_users: number;
  organic_new_users: number;
  organic_pageviews: number;
  total_sessions: number;
  total_users: number;
  organic_bounce_rate: number | null;
  organic_engagement_rate: number | null;
}

export interface GA4LandingPage {
  id: number;
  date: string;
  page_path: string;
  organic_sessions: number;
  organic_users: number;
  organic_bounce_rate: number | null;
}

export interface GA4Event {
  id: number;
  date: string;
  event_name: string;
  is_conversion: boolean;
  is_key_event: boolean;
  event_count: number;
  organic_event_count: number;
  unique_users: number;
  event_value: string | null;
}

export interface GA4ConversionSummary {
  id: number;
  date: string;
  total_conversions: number;
  organic_conversions: number;
  form_submissions: number;
  phone_clicks: number;
  chat_starts: number;
  organic_conversion_rate: number | null;
}

export interface RankComparisonKeyword {
  keyword_id: number;
  keyword_text: string;
  search_volume: number | null;
  group_name: string;
  tags: string[];
  organic_rank: number | null;
  organic_change: number | null;
  organic_url: string;
  organic_serp_url: string;
  organic_screenshot_url: string;
  organic_serp_features: Record<string, boolean>;
  organic_mobile_rank: number | null;
  organic_mobile_change: number | null;
  organic_mobile_url: string;
  organic_mobile_serp_url: string;
  organic_mobile_screenshot_url: string;
  local_pack_rank: number | null;
  local_pack_change: number | null;
  local_pack_serp_url: string;
  local_pack_screenshot_url: string;
  local_finder_rank: number | null;
  local_finder_change: number | null;
  local_finder_serp_url: string;
  local_finder_screenshot_url: string;
}

export interface RankTypeSummary {
  found: number;
  avg_rank: number | null;
  improved: number;
  declined: number;
  no_change: number;
  new: number;
  lost: number;
  in_top_3: number;
  in_top_10?: number;
  in_top_20?: number;
  in_top_50?: number;
  coverage_pct?: number;
}

export interface RankComparisonSummary {
  total_keywords: number;
  desktop: RankTypeSummary;
  mobile: RankTypeSummary;
  local_pack: RankTypeSummary;
  local_finder: RankTypeSummary;
}

export interface RankComparisonResponse {
  date_current: string;
  date_previous: string;
  summary: RankComparisonSummary;
  keywords: RankComparisonKeyword[];
}

export interface QuarterlyPlanSummary {
  id: number;
  client: number;
  name: string;
  status: "draft" | "active" | "completed" | "archived";
  quarter_start: string;
  quarter_end: string;
  items_count: number;
  progress_pct: number;
  created_at: string;
}

export interface DeliverableData {
  id: number;
  plan_item: number;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "done" | "blocked";
  due_date: string | null;
  completed_at: string | null;
  month: number | null;
  gmb_post_type: string;
  gmb_post_cta: string;
  gmb_post_image_url: string;
  on_page_action: string;
  assignee: string;
  notes: string;
}

export interface PlanItem {
  id: number;
  plan: number;
  category: "on_page" | "gmb" | "citations" | "content" | "link_building" | "technical";
  keyword_text: string;
  title: string;
  target_url: string;
  target_rank: number | null;
  month_0_rank: number | null;
  month_1_rank: number | null;
  month_2_rank: number | null;
  month_3_rank: number | null;
  month_0_traffic: number | null;
  month_1_traffic: number | null;
  month_2_traffic: number | null;
  month_3_traffic: number | null;
  search_volume: number | null;
  keyword_difficulty: number | null;
  citation_source: string;
  citation_status: string;
  content_title: string;
  content_status: string;
  publish_url: string;
  link_target_domain: string;
  link_status: string;
  priority: number;
  notes: string;
  is_completed: boolean;
  current_rank: number | null;
  rank_improvement: number | null;
  is_target_achieved: boolean;
  deliverables: DeliverableData[];
  deliverables_done: string | null;
}

export interface QuarterlyPlanDetail extends QuarterlyPlanSummary {
  month_0_label: string;
  month_1_label: string;
  month_2_label: string;
  month_3_label: string;
  notes: string;
  items: PlanItem[];
  achieved_count: number;
  category_summary: Record<string, number>;
}

export interface BacklinkSummaryData {
  total_backlinks: number;
  referring_domains: number;
  dofollow: number;
  nofollow: number;
  rank: number | null;
  new_backlinks: number;
  lost_backlinks: number;
  new_referring_domains: number;
  lost_referring_domains: number;
  date: string | null;
}

export interface BacklinkData {
  id: number;
  source_url: string;
  source_domain: string;
  source_title: string;
  target_url: string;
  anchor: string;
  is_dofollow: boolean;
  is_new: boolean;
  is_lost: boolean;
  source_rank: number | null;
  first_seen: string | null;
  last_seen: string | null;
}

export interface ReferringDomainData {
  id: number;
  domain: string;
  backlinks_count: number;
  dofollow_count: number;
  nofollow_count: number;
  rank: number | null;
  first_seen: string | null;
}

export interface AnchorData {
  id: number;
  anchor: string;
  backlinks_count: number;
  referring_domains: number;
  dofollow: number;
}

export interface SiteAuditData {
  id: number;
  target_url: string;
  status: string;
  pages_crawled: number;
  pages_with_errors: number;
  pages_with_warnings: number;
  total_4xx_errors: number;
  total_5xx_errors: number;
  broken_links_count: number;
  duplicate_titles: number;
  duplicate_descriptions: number;
  missing_titles: number;
  missing_descriptions: number;
  missing_h1: number;
  missing_alt_tags: number;
  non_indexable_pages: number;
  avg_page_load_time: number | null;
  has_ssl: boolean | null;
  has_robots_txt: boolean | null;
  has_sitemap: boolean | null;
  is_responsive: boolean | null;
  is_mobile_friendly: boolean | null;
  avg_word_count: number | null;
  thin_content_pages: number;
  created_at: string;
}

export interface AuditPageData {
  id: number;
  url: string;
  status_code: number | null;
  title: string;
  description: string;
  h1: string;
  word_count: number | null;
  page_load_time: number | null;
  internal_links_count: number;
  external_links_count: number;
  broken_links_count: number;
  images_count: number;
  images_missing_alt: number;
  is_indexable: boolean;
  errors: string[];
  warnings: string[];
}

export interface LighthouseData {
  id: number;
  url: string;
  is_mobile: boolean;
  performance_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  seo_score: number | null;
  first_contentful_paint: number | null;
  largest_contentful_paint: number | null;
  total_blocking_time: number | null;
  cumulative_layout_shift: number | null;
  created_at: string;
}

export interface CitationSummaryResponse {
  total: number;
  found: number;
  claimed: number;
  not_found: number;
  nap_errors: { name: number; address: number; phone: number; zip: number };
  key_citation_score: number;
  percentage_found: number;
}

export interface CitationData {
  id: number;
  client: number;
  directory: number;
  directory_name: string;
  directory_url: string;
  is_key_citation: boolean;
  status: "found" | "not_found" | "claimed" | "unclaimed";
  listing_url: string;
  listed_name: string;
  listed_address: string;
  listed_phone: string;
  listed_zip: string;
  name_accurate: boolean | null;
  address_accurate: boolean | null;
  phone_accurate: boolean | null;
  zip_accurate: boolean | null;
  nap_errors: number;
  last_checked_at: string | null;
  notes: string;
}

export interface CitationDirectoryData {
  id: number;
  name: string;
  url: string;
  category: string;
  is_key_citation: boolean;
}
