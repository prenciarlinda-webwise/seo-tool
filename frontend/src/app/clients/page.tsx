"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  Download,
  Edit,
  MoreVertical,
  Plus,
  Power,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
} from "lucide-react";
import { fetchClients, updateClient, deleteClient, importClients, exportClientsUrl, type Client } from "@/lib/api";
import ImportModal from "@/components/import-modal";
import { cn, formatNumber } from "@/lib/utils";

function MetricPill({
  value,
  icon: Icon,
  color,
  label,
}: {
  value: number | string;
  icon: React.ElementType;
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <Icon className={cn("h-3.5 w-3.5", color)} />
      <span className={cn("text-sm font-semibold", color)}>{value}</span>
    </div>
  );
}

function ClientActions({
  client,
  onUpdate,
}: {
  client: Client;
  onUpdate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleToggleActive() {
    await updateClient(client.slug, { is_active: !client.is_active });
    setOpen(false);
    onUpdate();
  }

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    await deleteClient(client.slug);
    setOpen(false);
    setConfirming(false);
    onUpdate();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
          setConfirming(false);
        }}
        className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          <Link
            href={`/clients/${client.slug}`}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ChevronRight className="h-3.5 w-3.5" />
            View Dashboard
          </Link>
          <Link
            href={`/clients/new?edit=${client.slug}`}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Edit className="h-3.5 w-3.5" />
            Edit Client
          </Link>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleToggleActive();
            }}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 w-full text-left"
          >
            <Power className="h-3.5 w-3.5" />
            {client.is_active ? "Deactivate" : "Activate"}
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDelete();
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm w-full text-left",
              confirming
                ? "text-white bg-red-600 hover:bg-red-700"
                : "text-red-600 hover:bg-red-50"
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {confirming ? "Confirm Delete" : "Delete Client"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showImport, setShowImport] = useState(false);

  const router = useRouter();

  function reload() {
    fetchClients().then((res) => setClients(res.results));
  }

  useEffect(() => {
    fetchClients()
      .then((res) => setClients(res.results))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter(
    (c) =>
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading clients...
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">All Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Showing {filtered.length} of {clients.length} clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Import
          </button>
          <a
            href={exportClientsUrl()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </a>
          <Link
            href="/clients/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Client
          </Link>
        </div>
      </div>

      {showImport && (
        <ImportModal
          title="Import Clients"
          description="Upload a CSV file with client data. Existing clients (matched by domain) will be updated."
          templateColumns={[
            "name", "domain", "website_url", "business_type",
            "contact_name", "contact_email", "contact_phone",
            "address", "city", "state", "zip_code", "country",
            "google_business_name", "google_place_id",
          ]}
          sampleRow={[
            "Acme Plumbing", "acmeplumbing.com", "https://acmeplumbing.com", "Plumbing",
            "John Smith", "john@acmeplumbing.com", "(512) 555-0199",
            "123 Main St", "Austin", "TX", "78701", "United States",
            "Acme Plumbing Austin", "",
          ]}
          exportUrl={exportClientsUrl()}
          onImport={importClients}
          onClose={() => setShowImport(false)}
          onSuccess={() => fetchClients().then((res) => setClients(res.results))}
        />
      )}

      {/* Search bar */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, domain, or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {/* Column headers */}
      <div className="hidden md:grid grid-cols-[1fr_100px_100px_100px_110px_110px_40px] gap-4 px-5 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
        <span>Client</span>
        <span className="text-center">Rankings Up</span>
        <span className="text-center">Rankings Down</span>
        <span className="text-center">New</span>
        <span className="text-center">Organic Sessions</span>
        <span className="text-center">Avg Position</span>
        <span></span>
      </div>

      {/* Client cards */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
            {clients.length === 0
              ? "No clients yet. Add your first client to get started."
              : "No clients match your search."}
          </div>
        ) : (
          filtered.map((client) => (
            <div
              key={client.id}
              onClick={() => router.push(`/clients/${client.slug}`)}
              className="block bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group cursor-pointer"
            >
              <div className="grid grid-cols-1 md:grid-cols-[1fr_100px_100px_100px_110px_110px_40px] gap-4 items-center px-5 py-4">
                {/* Client info */}
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {client.name}
                      </h3>
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0",
                          client.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {client.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {client.city && client.state
                        ? `${client.city}, ${client.zip_code || client.state}`
                        : client.domain}
                    </p>
                    <p className="text-xs text-gray-400">
                      {client.tracked_keywords_count} tracked keywords
                    </p>
                  </div>
                </div>

                {/* Rankings Up */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-1">
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                    <span className="text-lg font-bold text-green-600">
                      {client.rankings_up ?? 0}
                    </span>
                  </div>
                </div>

                {/* Rankings Down */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-1">
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                    <span className="text-lg font-bold text-red-600">
                      {client.rankings_down ?? 0}
                    </span>
                  </div>
                </div>

                {/* Rankings New */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-1">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                    <span className="text-lg font-bold text-blue-600">
                      {client.rankings_new ?? 0}
                    </span>
                  </div>
                </div>

                {/* Organic Sessions */}
                <div className="text-center">
                  {client.organic_sessions != null ? (
                    <div className="inline-flex items-center gap-1">
                      <BarChart3 className="h-4 w-4 text-purple-500" />
                      <span className="text-lg font-bold text-gray-900">
                        {formatNumber(client.organic_sessions)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Connect GA</span>
                  )}
                </div>

                {/* Avg Position */}
                <div className="text-center">
                  {client.avg_position != null ? (
                    <span
                      className={cn(
                        "inline-flex items-center justify-center px-2.5 py-1 rounded-md text-lg font-bold",
                        client.avg_position <= 10
                          ? "text-green-700 bg-green-50"
                          : client.avg_position <= 20
                          ? "text-yellow-700 bg-yellow-50"
                          : client.avg_position <= 50
                          ? "text-orange-700 bg-orange-50"
                          : "text-red-700 bg-red-50"
                      )}
                    >
                      {client.avg_position}
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </div>

                {/* Actions */}
                <div className="text-center" onClick={(e) => e.stopPropagation()}>
                  <ClientActions client={client} onUpdate={reload} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
