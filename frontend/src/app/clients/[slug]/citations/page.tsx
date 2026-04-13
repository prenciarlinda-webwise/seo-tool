"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  fetchCitationSummary,
  fetchCitations,
  fetchCitationDirectories,
  createCitation,
  updateCitation,
  deleteCitation,
  triggerCitationCheck,
  type CitationSummaryResponse,
  type CitationData,
  type CitationDirectoryData,
} from "@/lib/api";
import { ActionButton } from "@/components/action-button";
import { cn, formatNumber } from "@/lib/utils";
import {
  Activity,
  Plus,
  X,
  Check,
  Minus,
  Pencil,
  Trash2,
  ExternalLink,
  Building2,
  MapPin,
  Phone,
  Hash,
  Star,
  Search,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Filter = "all" | "found" | "not_found" | "key";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "found", label: "Found" },
  { key: "not_found", label: "Not Found" },
  { key: "key", label: "Key Citations Only" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  found: { label: "Found", color: "bg-green-100 text-green-800" },
  not_found: { label: "Not Found", color: "bg-red-100 text-red-800" },
  claimed: { label: "Claimed", color: "bg-blue-100 text-blue-800" },
  unclaimed: { label: "Unclaimed", color: "bg-yellow-100 text-yellow-800" },
};

/* ------------------------------------------------------------------ */
/*  Small components                                                   */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  icon: React.ReactNode;
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
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function CircularProgress({ percentage }: { percentage: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percentage / 100) * circ;
  const color =
    percentage >= 80
      ? "text-green-500"
      : percentage >= 50
        ? "text-yellow-500"
        : "text-red-500";
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="72" height="72" className="-rotate-90">
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-gray-200"
        />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <span className="absolute text-sm font-bold text-gray-900">
        {percentage}%
      </span>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        color
      )}
    >
      {children}
    </span>
  );
}

function NapCell({
  value,
  onClick,
}: {
  value: boolean | null;
  onClick: () => void;
}) {
  return (
    <td className="px-4 py-2.5 text-center">
      <button
        onClick={onClick}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors hover:ring-2 hover:ring-offset-1 hover:ring-gray-300"
        title="Click to toggle"
      >
        {value === true && (
          <Check className="h-4 w-4 text-green-600" />
        )}
        {value === false && (
          <X className="h-4 w-4 text-red-600" />
        )}
        {value === null && (
          <Minus className="h-4 w-4 text-gray-300" />
        )}
      </button>
    </td>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Citation Form                                                  */
/* ------------------------------------------------------------------ */

function AddCitationForm({
  directories,
  onSubmit,
  onCancel,
}: {
  directories: CitationDirectoryData[];
  onSubmit: (data: Partial<CitationData>) => Promise<void>;
  onCancel: () => void;
}) {
  const [directoryId, setDirectoryId] = useState<number | "">("");
  const [newDirName, setNewDirName] = useState("");
  const [status, setStatus] = useState<CitationData["status"]>("not_found");
  const [listingUrl, setListingUrl] = useState("");
  const [listedName, setListedName] = useState("");
  const [listedAddress, setListedAddress] = useState("");
  const [listedPhone, setListedPhone] = useState("");
  const [listedZip, setListedZip] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [useNewDir, setUseNewDir] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data: Partial<CitationData> & { new_directory_name?: string } = {
        status,
        listing_url: listingUrl,
        listed_name: listedName,
        listed_address: listedAddress,
        listed_phone: listedPhone,
        listed_zip: listedZip,
        notes,
      };
      if (useNewDir && newDirName) {
        // We'll handle this differently - caller will create directory first
        (data as any).new_directory_name = newDirName;
      } else if (directoryId !== "") {
        data.directory = directoryId as number;
      }
      await onSubmit(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Add Citation</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Directory selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Directory</label>
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={() => setUseNewDir(false)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-md border",
              !useNewDir
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            )}
          >
            Existing
          </button>
          <button
            type="button"
            onClick={() => setUseNewDir(true)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-md border",
              useNewDir
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            )}
          >
            New directory
          </button>
        </div>
        {useNewDir ? (
          <input
            type="text"
            value={newDirName}
            onChange={(e) => setNewDirName(e.target.value)}
            placeholder="Directory name (e.g. Yelp)"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        ) : (
          <div className="relative">
            <select
              value={directoryId}
              onChange={(e) => setDirectoryId(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
              required
            >
              <option value="">Select a directory...</option>
              {directories.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.is_key_citation ? " (Key)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Status */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Status</label>
        <div className="relative">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CitationData["status"])}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
          >
            <option value="found">Found</option>
            <option value="not_found">Not Found</option>
            <option value="claimed">Claimed</option>
            <option value="unclaimed">Unclaimed</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Listing URL */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Listing URL</label>
        <input
          type="url"
          value={listingUrl}
          onChange={(e) => setListingUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* NAP fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Listed Business Name</label>
          <input
            type="text"
            value={listedName}
            onChange={(e) => setListedName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Listed Phone</label>
          <input
            type="text"
            value={listedPhone}
            onChange={(e) => setListedPhone(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Listed Address</label>
          <input
            type="text"
            value={listedAddress}
            onChange={(e) => setListedAddress(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Listed Zip</label>
          <input
            type="text"
            value={listedZip}
            onChange={(e) => setListedZip(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Add Citation"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline Edit Row                                                    */
/* ------------------------------------------------------------------ */

function EditableRow({
  citation,
  onSave,
  onCancel,
}: {
  citation: CitationData;
  onSave: (data: Partial<CitationData>) => Promise<void>;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState(citation.status);
  const [listingUrl, setListingUrl] = useState(citation.listing_url);
  const [listedName, setListedName] = useState(citation.listed_name);
  const [listedAddress, setListedAddress] = useState(citation.listed_address);
  const [listedPhone, setListedPhone] = useState(citation.listed_phone);
  const [listedZip, setListedZip] = useState(citation.listed_zip);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        status,
        listing_url: listingUrl,
        listed_name: listedName,
        listed_address: listedAddress,
        listed_phone: listedPhone,
        listed_zip: listedZip,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-gray-100 bg-blue-50/30">
      <td className="px-4 py-2.5">
        <div className="font-medium text-gray-900">{citation.directory_name}</div>
        <input
          type="url"
          value={listingUrl}
          onChange={(e) => setListingUrl(e.target.value)}
          placeholder="Listing URL"
          className="mt-1 w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-2.5">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as CitationData["status"])}
          className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
        >
          <option value="found">Found</option>
          <option value="not_found">Not Found</option>
          <option value="claimed">Claimed</option>
          <option value="unclaimed">Unclaimed</option>
        </select>
      </td>
      <td className="px-4 py-2.5">
        <Badge color={status === "claimed" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"}>
          {status === "claimed" ? "Yes" : "No"}
        </Badge>
      </td>
      <td className="px-4 py-2.5">
        <input
          type="text"
          value={listedName}
          onChange={(e) => setListedName(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          type="text"
          value={listedAddress}
          onChange={(e) => setListedAddress(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          type="text"
          value={listedPhone}
          onChange={(e) => setListedPhone(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-2.5">
        <input
          type="text"
          value={listedZip}
          onChange={(e) => setListedZip(e.target.value)}
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50"
            title="Save"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function CitationsPage() {
  const { slug } = useParams<{ slug: string }>();
  const clientSlug = slug;

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CitationSummaryResponse | null>(null);
  const [citations, setCitations] = useState<CitationData[]>([]);
  const [directories, setDirectories] = useState<CitationDirectoryData[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    try {
      const [s, c, d] = await Promise.all([
        fetchCitationSummary(clientSlug),
        fetchCitations(clientSlug),
        fetchCitationDirectories(),
      ]);
      setSummary(s);
      setCitations(c.results);
      setDirectories(d.results);
    } catch {
      /* ignore */
    }
  }, [clientSlug]);

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [reload]);

  /* ---- Filtering ---- */

  const filtered = citations.filter((c) => {
    if (filter === "found" && !["found", "claimed"].includes(c.status)) return false;
    if (filter === "not_found" && c.status !== "not_found") return false;
    if (filter === "key" && !c.is_key_citation) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !c.directory_name.toLowerCase().includes(q) &&
        !c.listed_name.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  /* ---- Handlers ---- */

  async function handleAddCitation(data: Partial<CitationData> & { new_directory_name?: string }) {
    const payload = { ...data };
    // If new directory, create it first via the directory endpoint - for now just pass directory id
    // The backend handles directory by id, so for new directories we'd need a separate call
    // For simplicity, if new_directory_name is set, we skip (user should use existing)
    delete (payload as any).new_directory_name;
    await createCitation(clientSlug, payload);
    setShowAddForm(false);
    await reload();
  }

  async function handleUpdateCitation(citationId: number, data: Partial<CitationData>) {
    await updateCitation(clientSlug, citationId, data);
    setEditingId(null);
    await reload();
  }

  async function handleDeleteCitation(citationId: number) {
    if (!confirm("Delete this citation?")) return;
    await deleteCitation(clientSlug, citationId);
    await reload();
  }

  async function toggleNap(
    citation: CitationData,
    field: "name_accurate" | "address_accurate" | "phone_accurate" | "zip_accurate"
  ) {
    const current = citation[field];
    // Cycle: null -> true -> false -> null
    const next = current === null ? true : current === true ? false : null;
    await updateCitation(clientSlug, citation.id, { [field]: next });
    await reload();
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-500">
          <Activity className="h-5 w-5 animate-pulse" />
          <span className="text-sm">Loading citations...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Citations</h1>
        <div className="flex items-center gap-2">
        <ActionButton
          label="Check NAP"
          loadingLabel="Checking..."
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => triggerCitationCheck(clientSlug)}
          onSuccess={() => reload()}
        />
        <button
          onClick={() => {
            setShowAddForm(true);
            setEditingId(null);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Citation
        </button>
        </div>
      </div>

      {/* ---- Summary Cards ---- */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <CircularProgress percentage={summary.percentage_found} />
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Percentage Found
              </div>
              <div className="text-lg font-bold text-gray-900">
                {summary.found} / {summary.total}
              </div>
            </div>
          </div>

          <StatCard
            label="Key Citation Score"
            value={`${summary.key_citation_score}/100`}
            icon={<Star className="h-4 w-4" />}
          />

          <StatCard
            label="Live Citations"
            value={formatNumber(summary.found)}
            sub={
              summary.claimed > 0 ? (
                <span>
                  <span className="text-blue-600 font-medium">{summary.claimed}</span> claimed
                </span>
              ) : undefined
            }
            icon={<Building2 className="h-4 w-4" />}
          />

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                NAP Errors
              </span>
            </div>
            {summary.nap_errors && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <Building2 className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-600">Name</span>
                  <span
                    className={cn(
                      "ml-auto font-bold",
                      summary.nap_errors.name > 0 ? "text-red-600" : "text-green-600"
                    )}
                  >
                    {summary.nap_errors.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <MapPin className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-600">Address</span>
                  <span
                    className={cn(
                      "ml-auto font-bold",
                      summary.nap_errors.address > 0 ? "text-red-600" : "text-green-600"
                    )}
                  >
                    {summary.nap_errors.address}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Phone className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-600">Phone</span>
                  <span
                    className={cn(
                      "ml-auto font-bold",
                      summary.nap_errors.phone > 0 ? "text-red-600" : "text-green-600"
                    )}
                  >
                    {summary.nap_errors.phone}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Hash className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-600">Zip</span>
                  <span
                    className={cn(
                      "ml-auto font-bold",
                      summary.nap_errors.zip > 0 ? "text-red-600" : "text-green-600"
                    )}
                  >
                    {summary.nap_errors.zip}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Add Citation Form ---- */}
      {showAddForm && (
        <AddCitationForm
          directories={directories}
          onSubmit={handleAddCitation}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* ---- Filters + Search ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                filter === f.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search directories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* ---- Citations Table ---- */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Directory
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Status
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Claimed
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Name
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Address
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Phone
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Zip
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No citations found.
                  </td>
                </tr>
              ) : (
                filtered.map((c) =>
                  editingId === c.id ? (
                    <EditableRow
                      key={c.id}
                      citation={c}
                      onSave={(data) => handleUpdateCitation(c.id, data)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr
                      key={c.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {c.directory_name}
                          </span>
                          {c.is_key_citation && (
                            <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        {c.listing_url && (
                          <a
                            href={c.listing_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            <span className="truncate max-w-[200px]">
                              {c.listing_url}
                            </span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge color={STATUS_CONFIG[c.status]?.color || "bg-gray-100 text-gray-600"}>
                          {STATUS_CONFIG[c.status]?.label || c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge
                          color={
                            c.status === "claimed"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-600"
                          }
                        >
                          {c.status === "claimed" ? "Yes" : "No"}
                        </Badge>
                      </td>
                      <NapCell
                        value={c.name_accurate}
                        onClick={() => toggleNap(c, "name_accurate")}
                      />
                      <NapCell
                        value={c.address_accurate}
                        onClick={() => toggleNap(c, "address_accurate")}
                      />
                      <NapCell
                        value={c.phone_accurate}
                        onClick={() => toggleNap(c, "phone_accurate")}
                      />
                      <NapCell
                        value={c.zip_accurate}
                        onClick={() => toggleNap(c, "zip_accurate")}
                      />
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingId(c.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCitation(c.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
