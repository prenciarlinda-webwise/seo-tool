"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  ClipboardList,
  Target,
  Check,
  X,
  Globe,
  FileText,
  Link2,
  MapPin,
  Building2,
  ArrowLeft,
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Loader2,
  Save,
} from "lucide-react";
import {
  fetchPlans,
  fetchPlan,
  createPlan,
  updatePlan,
  deletePlan,
  createPlanItem,
  updatePlanItem,
  deletePlanItem,
  createDeliverable,
  updateDeliverable,
  deleteDeliverable,
  type QuarterlyPlanSummary,
  type QuarterlyPlanDetail,
  type PlanItem,
  type DeliverableData,
} from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";

type CategoryTab = "on_page" | "gmb" | "citations" | "content" | "link_building";

const CATEGORY_CONFIG: {
  key: CategoryTab;
  label: string;
  icon: React.ElementType;
}[] = [
  { key: "on_page", label: "On-Page", icon: Target },
  { key: "gmb", label: "GMB", icon: MapPin },
  { key: "citations", label: "Citations", icon: Building2 },
  { key: "content", label: "Content", icon: FileText },
  { key: "link_building", label: "Link Building", icon: Link2 },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  archived: "bg-yellow-100 text-yellow-700",
};

const DELIVERABLE_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
};

const PLAN_STATUSES = ["draft", "active", "completed", "archived"] as const;
const DELIVERABLE_STATUSES = ["pending", "in_progress", "done", "blocked"] as const;

/* ---------- Shared components ---------- */

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize",
        STATUS_COLORS[status] || "bg-gray-100 text-gray-600"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function DeliverableStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize",
        DELIVERABLE_STATUS_COLORS[status] || "bg-gray-100 text-gray-600"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function ProgressBar({ pct, size = "md" }: { pct: number; size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div className={cn("w-full bg-gray-200 rounded-full", h)}>
      <div
        className={cn(
          "rounded-full transition-all",
          h,
          pct >= 100
            ? "bg-green-500"
            : pct >= 50
            ? "bg-blue-500"
            : "bg-amber-500"
        )}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function RankCell({ rank, target }: { rank: number | null; target: number | null }) {
  if (rank == null) return <span className="text-gray-300">-</span>;
  let colorClass = "text-gray-700";
  if (target != null) {
    if (rank <= target) colorClass = "text-green-700 font-semibold";
    else if (rank <= target + 5) colorClass = "text-yellow-700";
    else colorClass = "text-red-600";
  }
  return <span className={cn("text-sm", colorClass)}>{rank}</span>;
}

function ConfirmButton({
  onConfirm,
  label,
  confirmLabel = "Confirm",
  className,
  loading,
}: {
  onConfirm: () => void;
  label: React.ReactNode;
  confirmLabel?: string;
  className?: string;
  loading?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1">
        <button
          onClick={() => {
            onConfirm();
            setConfirming(false);
          }}
          disabled={loading}
          className="text-xs text-red-600 hover:text-red-800 font-medium"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : confirmLabel}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className={cn("text-gray-400 hover:text-red-500 transition-colors", className)}
      disabled={loading}
    >
      {label}
    </button>
  );
}

function CitationStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    found: "bg-green-100 text-green-700",
    not_found: "bg-red-100 text-red-700",
    nap_error: "bg-yellow-100 text-yellow-700",
  };
  const labels: Record<string, string> = {
    found: "Found",
    not_found: "Not Found",
    nap_error: "NAP Error",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        map[status] || "bg-gray-100 text-gray-600"
      )}
    >
      {labels[status] || status}
    </span>
  );
}

function ContentStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    planned: "bg-gray-100 text-gray-700",
    writing: "bg-yellow-100 text-yellow-700",
    published: "bg-green-100 text-green-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize",
        map[status] || "bg-gray-100 text-gray-600"
      )}
    >
      {status}
    </span>
  );
}

function LinkStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    prospecting: "bg-gray-100 text-gray-700",
    outreach: "bg-blue-100 text-blue-700",
    acquired: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize",
        map[status] || "bg-gray-100 text-gray-600"
      )}
    >
      {status}
    </span>
  );
}

/* ---------- Deliverable list components ---------- */

function DeliverableStatusDropdown({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
    >
      {DELIVERABLE_STATUSES.map((s) => (
        <option key={s} value={s}>
          {s.replace("_", " ")}
        </option>
      ))}
    </select>
  );
}

function OnPageDeliverableRow({
  d,
  clientSlug,
  planId,
  itemId,
  onMutate,
}: {
  d: DeliverableData;
  clientSlug: string;
  planId: number;
  itemId: number;
  onMutate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: d.title,
    on_page_action: d.on_page_action,
    due_date: d.due_date || "",
    assignee: d.assignee,
    status: d.status,
  });

  async function handleSave() {
    setSaving(true);
    try {
      await updateDeliverable(clientSlug, planId, itemId, d.id, form);
      setEditing(false);
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: string) {
    setSaving(true);
    try {
      await updateDeliverable(clientSlug, planId, itemId, d.id, { status: status as DeliverableData["status"] });
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteDeliverable(clientSlug, planId, itemId, d.id);
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr className="bg-blue-50/30">
        <td className="px-3 py-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full text-xs border rounded px-2 py-1" />
        </td>
        <td className="px-3 py-2">
          <input value={form.on_page_action} onChange={(e) => setForm({ ...form, on_page_action: e.target.value })} className="w-full text-xs border rounded px-2 py-1" />
        </td>
        <td className="px-3 py-2">
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="text-xs border rounded px-2 py-1" />
        </td>
        <td className="px-3 py-2">
          <input value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} className="w-full text-xs border rounded px-2 py-1" />
        </td>
        <td className="px-3 py-2">
          <DeliverableStatusDropdown value={form.status} onChange={(v) => setForm({ ...form, status: v as DeliverableData["status"] })} />
        </td>
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-1">
            <button onClick={handleSave} disabled={saving} className="text-blue-600 hover:text-blue-800">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-3 py-2 text-xs text-gray-800">{d.title}</td>
      <td className="px-3 py-2 text-xs text-gray-600">{d.on_page_action || "-"}</td>
      <td className="px-3 py-2 text-xs text-gray-600">{d.due_date || "-"}</td>
      <td className="px-3 py-2 text-xs text-gray-600">{d.assignee || "-"}</td>
      <td className="px-3 py-2">
        <DeliverableStatusDropdown value={d.status} onChange={handleStatusChange} disabled={saving} />
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1">
          <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-blue-500">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <ConfirmButton onConfirm={handleDelete} label={<Trash2 className="h-3.5 w-3.5" />} loading={saving} />
        </span>
      </td>
    </tr>
  );
}

function GMBDeliverableRow({
  d,
  clientSlug,
  planId,
  itemId,
  onMutate,
}: {
  d: DeliverableData;
  clientSlug: string;
  planId: number;
  itemId: number;
  onMutate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: d.title,
    gmb_post_type: d.gmb_post_type,
    gmb_post_cta: d.gmb_post_cta,
    due_date: d.due_date || "",
    month: d.month ?? "",
    status: d.status,
  });

  async function handleSave() {
    setSaving(true);
    try {
      await updateDeliverable(clientSlug, planId, itemId, d.id, {
        ...form,
        month: form.month === "" ? null : Number(form.month),
      });
      setEditing(false);
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: string) {
    setSaving(true);
    try {
      await updateDeliverable(clientSlug, planId, itemId, d.id, { status: status as DeliverableData["status"] });
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteDeliverable(clientSlug, planId, itemId, d.id);
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr className="bg-blue-50/30">
        <td className="px-3 py-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full text-xs border rounded px-2 py-1" />
        </td>
        <td className="px-3 py-2">
          <input value={form.gmb_post_type} onChange={(e) => setForm({ ...form, gmb_post_type: e.target.value })} className="w-full text-xs border rounded px-2 py-1" />
        </td>
        <td className="px-3 py-2">
          <input value={form.gmb_post_cta} onChange={(e) => setForm({ ...form, gmb_post_cta: e.target.value })} className="w-full text-xs border rounded px-2 py-1" />
        </td>
        <td className="px-3 py-2">
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="text-xs border rounded px-2 py-1" />
        </td>
        <td className="px-3 py-2">
          <input type="number" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="w-16 text-xs border rounded px-2 py-1" placeholder="1-3" />
        </td>
        <td className="px-3 py-2">
          <DeliverableStatusDropdown value={form.status} onChange={(v) => setForm({ ...form, status: v as DeliverableData["status"] })} />
        </td>
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-1">
            <button onClick={handleSave} disabled={saving} className="text-blue-600 hover:text-blue-800">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-3 py-2 text-xs text-gray-800">{d.title}</td>
      <td className="px-3 py-2 text-xs text-gray-600">{d.gmb_post_type || "-"}</td>
      <td className="px-3 py-2 text-xs text-gray-600">{d.gmb_post_cta || "-"}</td>
      <td className="px-3 py-2 text-xs text-gray-600">{d.due_date || "-"}</td>
      <td className="px-3 py-2 text-xs text-gray-600">{d.month ?? "-"}</td>
      <td className="px-3 py-2">
        <DeliverableStatusDropdown value={d.status} onChange={handleStatusChange} disabled={saving} />
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1">
          <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-blue-500">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <ConfirmButton onConfirm={handleDelete} label={<Trash2 className="h-3.5 w-3.5" />} loading={saving} />
        </span>
      </td>
    </tr>
  );
}

function ContentDeliverableRow({
  d,
  clientSlug,
  planId,
  itemId,
  onMutate,
}: {
  d: DeliverableData;
  clientSlug: string;
  planId: number;
  itemId: number;
  onMutate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: d.title,
    status: d.status,
    description: d.description,
    due_date: d.due_date || "",
  });

  async function handleSave() {
    setSaving(true);
    try {
      await updateDeliverable(clientSlug, planId, itemId, d.id, form);
      setEditing(false);
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: string) {
    setSaving(true);
    try {
      await updateDeliverable(clientSlug, planId, itemId, d.id, { status: status as DeliverableData["status"] });
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteDeliverable(clientSlug, planId, itemId, d.id);
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr className="bg-blue-50/30">
        <td className="px-3 py-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full text-xs border rounded px-2 py-1" />
        </td>
        <td className="px-3 py-2">
          <DeliverableStatusDropdown value={form.status} onChange={(v) => setForm({ ...form, status: v as DeliverableData["status"] })} />
        </td>
        <td className="px-3 py-2">
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full text-xs border rounded px-2 py-1" placeholder="URL" />
        </td>
        <td className="px-3 py-2">
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="text-xs border rounded px-2 py-1" />
        </td>
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-1">
            <button onClick={handleSave} disabled={saving} className="text-blue-600 hover:text-blue-800">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-3 py-2 text-xs text-gray-800">{d.title}</td>
      <td className="px-3 py-2">
        <DeliverableStatusDropdown value={d.status} onChange={handleStatusChange} disabled={saving} />
      </td>
      <td className="px-3 py-2 text-xs text-gray-600 max-w-[200px] truncate">{d.description || "-"}</td>
      <td className="px-3 py-2 text-xs text-gray-600">{d.due_date || "-"}</td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1">
          <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-blue-500">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <ConfirmButton onConfirm={handleDelete} label={<Trash2 className="h-3.5 w-3.5" />} loading={saving} />
        </span>
      </td>
    </tr>
  );
}

function LinkBuildingDeliverableRow({
  d,
  clientSlug,
  planId,
  itemId,
  onMutate,
}: {
  d: DeliverableData;
  clientSlug: string;
  planId: number;
  itemId: number;
  onMutate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: d.title,
    description: d.description,
    status: d.status,
    due_date: d.due_date || "",
  });

  async function handleSave() {
    setSaving(true);
    try {
      await updateDeliverable(clientSlug, planId, itemId, d.id, form);
      setEditing(false);
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: string) {
    setSaving(true);
    try {
      await updateDeliverable(clientSlug, planId, itemId, d.id, { status: status as DeliverableData["status"] });
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteDeliverable(clientSlug, planId, itemId, d.id);
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <tr className="bg-blue-50/30">
        <td className="px-3 py-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full text-xs border rounded px-2 py-1" />
        </td>
        <td className="px-3 py-2">
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full text-xs border rounded px-2 py-1" placeholder="Target Domain" />
        </td>
        <td className="px-3 py-2">
          <DeliverableStatusDropdown value={form.status} onChange={(v) => setForm({ ...form, status: v as DeliverableData["status"] })} />
        </td>
        <td className="px-3 py-2">
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="text-xs border rounded px-2 py-1" />
        </td>
        <td className="px-3 py-2">
          <span className="inline-flex items-center gap-1">
            <button onClick={handleSave} disabled={saving} className="text-blue-600 hover:text-blue-800">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-3 py-2 text-xs text-gray-800">{d.title}</td>
      <td className="px-3 py-2 text-xs text-gray-600">{d.description || "-"}</td>
      <td className="px-3 py-2">
        <DeliverableStatusDropdown value={d.status} onChange={handleStatusChange} disabled={saving} />
      </td>
      <td className="px-3 py-2 text-xs text-gray-600">{d.due_date || "-"}</td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1">
          <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-blue-500">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <ConfirmButton onConfirm={handleDelete} label={<Trash2 className="h-3.5 w-3.5" />} loading={saving} />
        </span>
      </td>
    </tr>
  );
}

/* ---------- Add deliverable forms ---------- */

function AddOnPageDeliverableForm({
  clientSlug,
  planId,
  itemId,
  onDone,
}: {
  clientSlug: string;
  planId: number;
  itemId: number;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", on_page_action: "", due_date: "", assignee: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createDeliverable(clientSlug, planId, itemId, { ...form, due_date: form.due_date || null });
      setForm({ title: "", on_page_action: "", due_date: "", assignee: "" });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 px-3 py-2 bg-gray-50 border-t border-gray-100">
      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" required className="text-xs border rounded px-2 py-1.5 flex-1" />
      <input value={form.on_page_action} onChange={(e) => setForm({ ...form, on_page_action: e.target.value })} placeholder="Action type" className="text-xs border rounded px-2 py-1.5 w-28" />
      <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="text-xs border rounded px-2 py-1.5" />
      <input value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} placeholder="Assignee" className="text-xs border rounded px-2 py-1.5 w-24" />
      <button type="submit" disabled={saving} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
      </button>
    </form>
  );
}

function AddGMBDeliverableForm({
  clientSlug,
  planId,
  itemId,
  onDone,
}: {
  clientSlug: string;
  planId: number;
  itemId: number;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", gmb_post_type: "", gmb_post_cta: "", due_date: "", month: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createDeliverable(clientSlug, planId, itemId, {
        ...form,
        due_date: form.due_date || null,
        month: form.month ? Number(form.month) : null,
      });
      setForm({ title: "", gmb_post_type: "", gmb_post_cta: "", due_date: "", month: "" });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 px-3 py-2 bg-gray-50 border-t border-gray-100">
      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" required className="text-xs border rounded px-2 py-1.5 flex-1" />
      <input value={form.gmb_post_type} onChange={(e) => setForm({ ...form, gmb_post_type: e.target.value })} placeholder="Post type" className="text-xs border rounded px-2 py-1.5 w-24" />
      <input value={form.gmb_post_cta} onChange={(e) => setForm({ ...form, gmb_post_cta: e.target.value })} placeholder="CTA" className="text-xs border rounded px-2 py-1.5 w-24" />
      <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="text-xs border rounded px-2 py-1.5" />
      <input type="number" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} placeholder="Month" className="text-xs border rounded px-2 py-1.5 w-16" />
      <button type="submit" disabled={saving} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
      </button>
    </form>
  );
}

function AddContentDeliverableForm({
  clientSlug,
  planId,
  itemId,
  onDone,
}: {
  clientSlug: string;
  planId: number;
  itemId: number;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_date: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createDeliverable(clientSlug, planId, itemId, { ...form, due_date: form.due_date || null });
      setForm({ title: "", description: "", due_date: "" });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 px-3 py-2 bg-gray-50 border-t border-gray-100">
      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" required className="text-xs border rounded px-2 py-1.5 flex-1" />
      <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="URL" className="text-xs border rounded px-2 py-1.5 w-40" />
      <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="text-xs border rounded px-2 py-1.5" />
      <button type="submit" disabled={saving} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
      </button>
    </form>
  );
}

function AddLinkBuildingDeliverableForm({
  clientSlug,
  planId,
  itemId,
  onDone,
}: {
  clientSlug: string;
  planId: number;
  itemId: number;
  onDone: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_date: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createDeliverable(clientSlug, planId, itemId, { ...form, due_date: form.due_date || null });
      setForm({ title: "", description: "", due_date: "" });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 px-3 py-2 bg-gray-50 border-t border-gray-100">
      <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" required className="text-xs border rounded px-2 py-1.5 flex-1" />
      <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Target domain" className="text-xs border rounded px-2 py-1.5 w-40" />
      <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="text-xs border rounded px-2 py-1.5" />
      <button type="submit" disabled={saving} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add
      </button>
    </form>
  );
}

/* ---------- Expandable item rows ---------- */

function OnPageItemRow({
  item,
  plan,
  clientSlug,
  onMutate,
}: {
  item: PlanItem;
  plan: QuarterlyPlanDetail;
  clientSlug: string;
  onMutate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteItem() {
    setDeleting(true);
    try {
      await deletePlanItem(clientSlug, plan.id, item.id);
      onMutate();
    } finally {
      setDeleting(false);
    }
  }

  const deliverables = item.deliverables || [];

  return (
    <>
      <tr className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <td className="px-2 py-2.5 w-8">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </td>
        <td className="px-3 py-2.5">
          <div className="text-sm text-gray-900">{item.keyword_text}</div>
          {item.search_volume != null && (
            <div className="text-[10px] text-gray-400">Vol: {formatNumber(item.search_volume)}</div>
          )}
        </td>
        <td className="px-3 py-2.5 text-sm text-gray-600 max-w-[180px] truncate">{item.target_url || "-"}</td>
        <td className="px-3 py-2.5 text-center">
          {item.target_rank != null ? (
            <span className="inline-flex items-center justify-center w-8 h-6 rounded text-xs font-semibold bg-indigo-100 text-indigo-700">{item.target_rank}</span>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center text-xs text-gray-500">
          {deliverables.length > 0 ? `${deliverables.filter((d) => d.status === "done").length}/${deliverables.length}` : "-"}
        </td>
        <td className="px-3 py-2.5 text-center">
          {item.is_target_achieved ? (
            <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
              <Check className="h-3.5 w-3.5" /> Achieved
            </span>
          ) : item.is_completed ? (
            <Check className="h-4 w-4 text-green-600 mx-auto" />
          ) : (
            <X className="h-4 w-4 text-gray-300 mx-auto" />
          )}
        </td>
        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <ConfirmButton onConfirm={handleDeleteItem} label={<Trash2 className="h-3.5 w-3.5" />} loading={deleting} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-gray-50/70 px-4 py-3">
            {/* Rank progression */}
            <div className="flex items-center gap-4 mb-3 text-xs">
              <span className="text-gray-500 font-medium">Ranks:</span>
              <span className="text-gray-600">{plan.month_0_label}: <RankCell rank={item.month_0_rank} target={item.target_rank} /></span>
              <span className="text-gray-600">{plan.month_1_label}: <RankCell rank={item.month_1_rank} target={item.target_rank} /></span>
              <span className="text-gray-600">{plan.month_2_label}: <RankCell rank={item.month_2_rank} target={item.target_rank} /></span>
              <span className="text-gray-600">{plan.month_3_label}: <RankCell rank={item.month_3_rank} target={item.target_rank} /></span>
            </div>

            {/* Deliverables table */}
            {deliverables.length > 0 && (
              <table className="w-full mb-2">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Assignee</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-1.5 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deliverables.map((d) => (
                    <OnPageDeliverableRow key={d.id} d={d} clientSlug={clientSlug} planId={plan.id} itemId={item.id} onMutate={onMutate} />
                  ))}
                </tbody>
              </table>
            )}

            {showAddForm ? (
              <AddOnPageDeliverableForm
                clientSlug={clientSlug}
                planId={plan.id}
                itemId={item.id}
                onDone={() => {
                  setShowAddForm(false);
                  onMutate();
                }}
              />
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
              >
                <Plus className="h-3 w-3" /> Add Deliverable
              </button>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function GMBItemRow({
  item,
  plan,
  clientSlug,
  onMutate,
}: {
  item: PlanItem;
  plan: QuarterlyPlanDetail;
  clientSlug: string;
  onMutate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteItem() {
    setDeleting(true);
    try {
      await deletePlanItem(clientSlug, plan.id, item.id);
      onMutate();
    } finally {
      setDeleting(false);
    }
  }

  const deliverables = item.deliverables || [];

  return (
    <>
      <tr className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <td className="px-2 py-2.5 w-8">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </td>
        <td className="px-3 py-2.5">
          <div className="text-sm text-gray-900">{item.keyword_text}</div>
          {item.search_volume != null && (
            <div className="text-[10px] text-gray-400">Vol: {formatNumber(item.search_volume)}</div>
          )}
        </td>
        <td className="px-3 py-2.5 text-center">
          {item.target_rank != null ? (
            <span className="inline-flex items-center justify-center w-8 h-6 rounded text-xs font-semibold bg-indigo-100 text-indigo-700">{item.target_rank}</span>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center text-xs text-gray-500">
          {deliverables.length > 0 ? `${deliverables.filter((d) => d.status === "done").length}/${deliverables.length}` : "-"}
        </td>
        <td className="px-3 py-2.5 text-center">
          {item.is_target_achieved ? (
            <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
              <Check className="h-3.5 w-3.5" /> Achieved
            </span>
          ) : item.is_completed ? (
            <Check className="h-4 w-4 text-green-600 mx-auto" />
          ) : (
            <X className="h-4 w-4 text-gray-300 mx-auto" />
          )}
        </td>
        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <ConfirmButton onConfirm={handleDeleteItem} label={<Trash2 className="h-3.5 w-3.5" />} loading={deleting} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-gray-50/70 px-4 py-3">
            {/* Rank progression */}
            <div className="flex items-center gap-4 mb-3 text-xs">
              <span className="text-gray-500 font-medium">Ranks:</span>
              <span className="text-gray-600">{plan.month_0_label}: <RankCell rank={item.month_0_rank} target={item.target_rank} /></span>
              <span className="text-gray-600">{plan.month_1_label}: <RankCell rank={item.month_1_rank} target={item.target_rank} /></span>
              <span className="text-gray-600">{plan.month_2_label}: <RankCell rank={item.month_2_rank} target={item.target_rank} /></span>
              <span className="text-gray-600">{plan.month_3_label}: <RankCell rank={item.month_3_rank} target={item.target_rank} /></span>
            </div>

            {deliverables.length > 0 && (
              <table className="w-full mb-2">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Post Type</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">CTA</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Month</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-1.5 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deliverables.map((d) => (
                    <GMBDeliverableRow key={d.id} d={d} clientSlug={clientSlug} planId={plan.id} itemId={item.id} onMutate={onMutate} />
                  ))}
                </tbody>
              </table>
            )}

            {showAddForm ? (
              <AddGMBDeliverableForm
                clientSlug={clientSlug}
                planId={plan.id}
                itemId={item.id}
                onDone={() => {
                  setShowAddForm(false);
                  onMutate();
                }}
              />
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
              >
                <Plus className="h-3 w-3" /> Add GMB Post
              </button>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function CitationItemRow({
  item,
  clientSlug,
  planId,
  onMutate,
}: {
  item: PlanItem;
  clientSlug: string;
  planId: number;
  onMutate: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleStatusChange(newStatus: string) {
    setSaving(true);
    try {
      await updatePlanItem(clientSlug, planId, item.id, { citation_status: newStatus });
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleComplete() {
    setSaving(true);
    try {
      await updatePlanItem(clientSlug, planId, item.id, { is_completed: !item.is_completed });
      onMutate();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem() {
    setDeleting(true);
    try {
      await deletePlanItem(clientSlug, planId, item.id);
      onMutate();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-4 py-2.5 text-sm text-gray-900">{item.citation_source || item.title || "-"}</td>
      <td className="px-3 py-2.5 text-center">
        <select
          value={item.citation_status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={saving}
          className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="not_found">Not Found</option>
          <option value="found">Found</option>
          <option value="nap_error">NAP Error</option>
        </select>
      </td>
      <td className="px-3 py-2.5 text-center">
        <input
          type="checkbox"
          checked={item.is_completed}
          onChange={handleToggleComplete}
          disabled={saving}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      </td>
      <td className="px-3 py-2.5">
        <ConfirmButton onConfirm={handleDeleteItem} label={<Trash2 className="h-3.5 w-3.5" />} loading={deleting} />
      </td>
    </tr>
  );
}

function ContentItemRow({
  item,
  plan,
  clientSlug,
  onMutate,
}: {
  item: PlanItem;
  plan: QuarterlyPlanDetail;
  clientSlug: string;
  onMutate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteItem() {
    setDeleting(true);
    try {
      await deletePlanItem(clientSlug, plan.id, item.id);
      onMutate();
    } finally {
      setDeleting(false);
    }
  }

  const deliverables = item.deliverables || [];

  return (
    <>
      <tr className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <td className="px-2 py-2.5 w-8">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </td>
        <td className="px-3 py-2.5 text-sm text-gray-900">{item.content_title || item.title || "-"}</td>
        <td className="px-3 py-2.5 text-center">
          <ContentStatusBadge status={item.content_status} />
        </td>
        <td className="px-3 py-2.5 text-sm text-gray-600 max-w-[200px] truncate">
          {item.publish_url ? (
            <a href={item.publish_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
              {item.publish_url}
            </a>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center text-xs text-gray-500">
          {deliverables.length > 0 ? `${deliverables.filter((d) => d.status === "done").length}/${deliverables.length}` : "-"}
        </td>
        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <ConfirmButton onConfirm={handleDeleteItem} label={<Trash2 className="h-3.5 w-3.5" />} loading={deleting} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-gray-50/70 px-4 py-3">
            {deliverables.length > 0 && (
              <table className="w-full mb-2">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">URL</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="px-3 py-1.5 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deliverables.map((d) => (
                    <ContentDeliverableRow key={d.id} d={d} clientSlug={clientSlug} planId={plan.id} itemId={item.id} onMutate={onMutate} />
                  ))}
                </tbody>
              </table>
            )}

            {showAddForm ? (
              <AddContentDeliverableForm
                clientSlug={clientSlug}
                planId={plan.id}
                itemId={item.id}
                onDone={() => {
                  setShowAddForm(false);
                  onMutate();
                }}
              />
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
              >
                <Plus className="h-3 w-3" /> Add Content Task
              </button>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function LinkBuildingItemRow({
  item,
  plan,
  clientSlug,
  onMutate,
}: {
  item: PlanItem;
  plan: QuarterlyPlanDetail;
  clientSlug: string;
  onMutate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteItem() {
    setDeleting(true);
    try {
      await deletePlanItem(clientSlug, plan.id, item.id);
      onMutate();
    } finally {
      setDeleting(false);
    }
  }

  const deliverables = item.deliverables || [];

  return (
    <>
      <tr className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <td className="px-2 py-2.5 w-8">
          {expanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-sm text-gray-900">{item.link_target_domain || item.title || "-"}</span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-center">
          <LinkStatusBadge status={item.link_status} />
        </td>
        <td className="px-3 py-2.5 text-center text-xs text-gray-500">
          {deliverables.length > 0 ? `${deliverables.filter((d) => d.status === "done").length}/${deliverables.length}` : "-"}
        </td>
        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <ConfirmButton onConfirm={handleDeleteItem} label={<Trash2 className="h-3.5 w-3.5" />} loading={deleting} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} className="bg-gray-50/70 px-4 py-3">
            {deliverables.length > 0 && (
              <table className="w-full mb-2">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Title</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Target Domain</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-500 uppercase">Due Date</th>
                    <th className="px-3 py-1.5 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deliverables.map((d) => (
                    <LinkBuildingDeliverableRow key={d.id} d={d} clientSlug={clientSlug} planId={plan.id} itemId={item.id} onMutate={onMutate} />
                  ))}
                </tbody>
              </table>
            )}

            {showAddForm ? (
              <AddLinkBuildingDeliverableForm
                clientSlug={clientSlug}
                planId={plan.id}
                itemId={item.id}
                onDone={() => {
                  setShowAddForm(false);
                  onMutate();
                }}
              />
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
              >
                <Plus className="h-3 w-3" /> Add Link Task
              </button>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ---------- Add item forms ---------- */

function AddItemForm({
  category,
  clientSlug,
  planId,
  onDone,
  onCancel,
}: {
  category: CategoryTab;
  clientSlug: string;
  planId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    title: "",
    keyword_text: "",
    target_url: "",
    target_rank: "",
    citation_source: "",
    content_title: "",
    link_target_domain: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data: Partial<PlanItem> = { category };

      if (category === "on_page" || category === "gmb") {
        data.keyword_text = form.keyword_text;
        data.target_url = form.target_url;
        data.target_rank = form.target_rank ? Number(form.target_rank) : null;
        data.title = form.keyword_text;
      } else if (category === "citations") {
        data.citation_source = form.citation_source;
        data.title = form.citation_source;
      } else if (category === "content") {
        data.content_title = form.content_title;
        data.title = form.content_title;
      } else if (category === "link_building") {
        data.link_target_domain = form.link_target_domain;
        data.title = form.link_target_domain;
      }

      await createPlanItem(clientSlug, planId, data);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 bg-blue-50/50 border-t border-blue-100">
      <div className="flex items-end gap-2 flex-wrap">
        {(category === "on_page" || category === "gmb") && (
          <>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Keyword</label>
              <input value={form.keyword_text} onChange={(e) => setForm({ ...form, keyword_text: e.target.value })} required className="text-xs border rounded px-2 py-1.5 w-40" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Target URL</label>
              <input value={form.target_url} onChange={(e) => setForm({ ...form, target_url: e.target.value })} className="text-xs border rounded px-2 py-1.5 w-48" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Target Rank</label>
              <input type="number" value={form.target_rank} onChange={(e) => setForm({ ...form, target_rank: e.target.value })} className="text-xs border rounded px-2 py-1.5 w-20" />
            </div>
          </>
        )}
        {category === "citations" && (
          <div>
            <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Source</label>
            <input value={form.citation_source} onChange={(e) => setForm({ ...form, citation_source: e.target.value })} required className="text-xs border rounded px-2 py-1.5 w-60" />
          </div>
        )}
        {category === "content" && (
          <div>
            <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Content Title</label>
            <input value={form.content_title} onChange={(e) => setForm({ ...form, content_title: e.target.value })} required className="text-xs border rounded px-2 py-1.5 w-60" />
          </div>
        )}
        {category === "link_building" && (
          <div>
            <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Target Domain</label>
            <input value={form.link_target_domain} onChange={(e) => setForm({ ...form, link_target_domain: e.target.value })} required className="text-xs border rounded px-2 py-1.5 w-60" />
          </div>
        )}
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Add Item
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------- Category table wrappers ---------- */

function OnPageTable({ items, plan, clientSlug, onMutate }: { items: PlanItem[]; plan: QuarterlyPlanDetail; clientSlug: string; onMutate: () => void }) {
  return (
    <table className="min-w-full">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="w-8"></th>
          <th className="px-3 py-2.5 text-left text-[10px] font-medium text-gray-500 uppercase">Keyword</th>
          <th className="px-3 py-2.5 text-left text-[10px] font-medium text-gray-500 uppercase">URL</th>
          <th className="px-3 py-2.5 text-center text-[10px] font-medium text-gray-500 uppercase">Target</th>
          <th className="px-3 py-2.5 text-center text-[10px] font-medium text-gray-500 uppercase">Deliverables</th>
          <th className="px-3 py-2.5 text-center text-[10px] font-medium text-gray-500 uppercase">Status</th>
          <th className="px-3 py-2.5 w-10"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.map((item) => (
          <OnPageItemRow key={item.id} item={item} plan={plan} clientSlug={clientSlug} onMutate={onMutate} />
        ))}
      </tbody>
    </table>
  );
}

function GMBTable({ items, plan, clientSlug, onMutate }: { items: PlanItem[]; plan: QuarterlyPlanDetail; clientSlug: string; onMutate: () => void }) {
  return (
    <table className="min-w-full">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="w-8"></th>
          <th className="px-3 py-2.5 text-left text-[10px] font-medium text-gray-500 uppercase">Keyword</th>
          <th className="px-3 py-2.5 text-center text-[10px] font-medium text-gray-500 uppercase">Target</th>
          <th className="px-3 py-2.5 text-center text-[10px] font-medium text-gray-500 uppercase">Deliverables</th>
          <th className="px-3 py-2.5 text-center text-[10px] font-medium text-gray-500 uppercase">Status</th>
          <th className="px-3 py-2.5 w-10"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.map((item) => (
          <GMBItemRow key={item.id} item={item} plan={plan} clientSlug={clientSlug} onMutate={onMutate} />
        ))}
      </tbody>
    </table>
  );
}

function CitationsTable({ items, clientSlug, planId, onMutate }: { items: PlanItem[]; clientSlug: string; planId: number; onMutate: () => void }) {
  return (
    <table className="min-w-full">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="px-4 py-2.5 text-left text-[10px] font-medium text-gray-500 uppercase">Source</th>
          <th className="px-3 py-2.5 text-center text-[10px] font-medium text-gray-500 uppercase">Status</th>
          <th className="px-3 py-2.5 text-center text-[10px] font-medium text-gray-500 uppercase">Completed</th>
          <th className="px-3 py-2.5 w-10"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.map((item) => (
          <CitationItemRow key={item.id} item={item} clientSlug={clientSlug} planId={planId} onMutate={onMutate} />
        ))}
      </tbody>
    </table>
  );
}

function ContentTable({ items, plan, clientSlug, onMutate }: { items: PlanItem[]; plan: QuarterlyPlanDetail; clientSlug: string; onMutate: () => void }) {
  return (
    <table className="min-w-full">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="w-8"></th>
          <th className="px-3 py-2.5 text-left text-[10px] font-medium text-gray-500 uppercase">Title</th>
          <th className="px-3 py-2.5 text-center text-[10px] font-medium text-gray-500 uppercase">Status</th>
          <th className="px-3 py-2.5 text-left text-[10px] font-medium text-gray-500 uppercase">URL</th>
          <th className="px-3 py-2.5 text-center text-[10px] font-medium text-gray-500 uppercase">Deliverables</th>
          <th className="px-3 py-2.5 w-10"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.map((item) => (
          <ContentItemRow key={item.id} item={item} plan={plan} clientSlug={clientSlug} onMutate={onMutate} />
        ))}
      </tbody>
    </table>
  );
}

function LinkBuildingTable({ items, plan, clientSlug, onMutate }: { items: PlanItem[]; plan: QuarterlyPlanDetail; clientSlug: string; onMutate: () => void }) {
  return (
    <table className="min-w-full">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50">
          <th className="w-8"></th>
          <th className="px-3 py-2.5 text-left text-[10px] font-medium text-gray-500 uppercase">Target Domain</th>
          <th className="px-3 py-2.5 text-center text-[10px] font-medium text-gray-500 uppercase">Status</th>
          <th className="px-3 py-2.5 text-center text-[10px] font-medium text-gray-500 uppercase">Deliverables</th>
          <th className="px-3 py-2.5 w-10"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {items.map((item) => (
          <LinkBuildingItemRow key={item.id} item={item} plan={plan} clientSlug={clientSlug} onMutate={onMutate} />
        ))}
      </tbody>
    </table>
  );
}

/* ---------- Plan detail view ---------- */

function PlanDetail({
  plan,
  clientSlug,
  onBack,
  onReload,
}: {
  plan: QuarterlyPlanDetail;
  clientSlug: string;
  onBack: () => void;
  onReload: () => void;
}) {
  const [activeTab, setActiveTab] = useState<CategoryTab>("on_page");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(plan.name);
  const [savingName, setSavingName] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);

  const itemsByCategory = (cat: CategoryTab) =>
    plan.items.filter((i) => i.category === cat);

  const categoryCount = (cat: CategoryTab) => itemsByCategory(cat).length;
  const currentItems = itemsByCategory(activeTab);

  async function handleNameSave() {
    if (!nameValue.trim() || nameValue === plan.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await updatePlan(clientSlug, plan.id, { name: nameValue });
      setEditingName(false);
      onReload();
    } finally {
      setSavingName(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setSavingStatus(true);
    try {
      await updatePlan(clientSlug, plan.id, { status: newStatus as QuarterlyPlanDetail["status"] });
      onReload();
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleDeletePlan() {
    setDeletingPlan(true);
    try {
      await deletePlan(clientSlug, plan.id);
      onBack();
    } finally {
      setDeletingPlan(false);
    }
  }

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to plans
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              {editingName ? (
                <span className="inline-flex items-center gap-2">
                  <input
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleNameSave();
                      if (e.key === "Escape") {
                        setNameValue(plan.name);
                        setEditingName(false);
                      }
                    }}
                    autoFocus
                    className="text-2xl font-semibold text-gray-900 border-b-2 border-blue-400 outline-none bg-transparent"
                  />
                  <button onClick={handleNameSave} disabled={savingName} className="text-blue-600 hover:text-blue-800">
                    {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </button>
                  <button onClick={() => { setNameValue(plan.name); setEditingName(false); }} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </span>
              ) : (
                <h1
                  className="text-2xl font-semibold text-gray-900 cursor-pointer hover:text-blue-700 transition-colors group"
                  onClick={() => setEditingName(true)}
                >
                  {plan.name}
                  <Pencil className="h-3.5 w-3.5 inline ml-2 text-gray-300 group-hover:text-blue-500" />
                </h1>
              )}
              <select
                value={plan.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={savingStatus}
                className={cn(
                  "text-xs font-medium rounded px-2 py-1 border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400",
                  STATUS_COLORS[plan.status] || "bg-gray-100 text-gray-600"
                )}
              >
                {PLAN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-gray-500">
              {plan.quarter_start} &mdash; {plan.quarter_end}
            </p>
          </div>
          <div className="flex items-start gap-4">
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-900">{Math.round(plan.progress_pct)}%</p>
              <p className="text-xs text-gray-400">
                {plan.achieved_count} of {plan.items_count} achieved
              </p>
            </div>
            <ConfirmButton
              onConfirm={handleDeletePlan}
              label={<Trash2 className="h-4 w-4" />}
              confirmLabel="Delete Plan"
              loading={deletingPlan}
              className="text-gray-300 hover:text-red-500 mt-1"
            />
          </div>
        </div>
        <ProgressBar pct={plan.progress_pct} size="md" />
        {plan.notes && (
          <p className="text-sm text-gray-500 mt-3">{plan.notes}</p>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4 overflow-x-auto">
        {CATEGORY_CONFIG.map(({ key, label, icon: Icon }) => {
          const count = categoryCount(key);
          return (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setShowAddItem(false); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                activeTab === key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {count > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold px-1",
                    activeTab === key
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-200 text-gray-600"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Category table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {currentItems.length === 0 && !showAddItem ? (
          <div className="px-5 py-16 text-center text-sm text-gray-500">
            No items in this category.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === "on_page" && currentItems.length > 0 && (
              <OnPageTable items={currentItems} plan={plan} clientSlug={clientSlug} onMutate={onReload} />
            )}
            {activeTab === "gmb" && currentItems.length > 0 && (
              <GMBTable items={currentItems} plan={plan} clientSlug={clientSlug} onMutate={onReload} />
            )}
            {activeTab === "citations" && currentItems.length > 0 && (
              <CitationsTable items={currentItems} clientSlug={clientSlug} planId={plan.id} onMutate={onReload} />
            )}
            {activeTab === "content" && currentItems.length > 0 && (
              <ContentTable items={currentItems} plan={plan} clientSlug={clientSlug} onMutate={onReload} />
            )}
            {activeTab === "link_building" && currentItems.length > 0 && (
              <LinkBuildingTable items={currentItems} plan={plan} clientSlug={clientSlug} onMutate={onReload} />
            )}
          </div>
        )}

        {showAddItem && (
          <AddItemForm
            category={activeTab}
            clientSlug={clientSlug}
            planId={plan.id}
            onDone={() => {
              setShowAddItem(false);
              onReload();
            }}
            onCancel={() => setShowAddItem(false)}
          />
        )}

        <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {currentItems.filter((i) => i.is_completed).length} of {currentItems.length} completed
          </span>
          {!showAddItem && (
            <button
              onClick={() => setShowAddItem(true)}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              <Plus className="h-3 w-3" /> Add Item
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Create plan form ---------- */

function CreatePlanForm({
  clientSlug,
  onDone,
  onCancel,
}: {
  clientSlug: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    quarter_start: "",
    quarter_end: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createPlan(clientSlug, form);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 mb-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Create New Plan</h3>
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="Q1 2026 SEO Plan"
            className="text-sm border rounded-lg px-3 py-2 w-60"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Quarter Start</label>
          <input
            type="date"
            value={form.quarter_start}
            onChange={(e) => setForm({ ...form, quarter_start: e.target.value })}
            required
            className="text-sm border rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Quarter End</label>
          <input
            type="date"
            value={form.quarter_end}
            onChange={(e) => setForm({ ...form, quarter_end: e.target.value })}
            required
            className="text-sm border rounded-lg px-3 py-2"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* ---------- Main page ---------- */

export default function PlansPage() {
  const { slug } = useParams<{ slug: string }>();
  const clientSlug = slug;

  const [plans, setPlans] = useState<QuarterlyPlanSummary[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<QuarterlyPlanDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadPlans = useCallback(() => {
    fetchPlans(clientSlug)
      .then((res) => setPlans(res.results))
      .finally(() => setLoading(false));
  }, [clientSlug]);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const loadPlanDetail = useCallback(
    (planId: number) => {
      setDetailLoading(true);
      fetchPlan(clientSlug, planId)
        .then((detail) => setSelectedPlan(detail))
        .finally(() => setDetailLoading(false));
    },
    [clientSlug]
  );

  const reloadCurrentPlan = useCallback(() => {
    if (selectedPlan) {
      loadPlanDetail(selectedPlan.id);
    }
  }, [selectedPlan, loadPlanDetail]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading plans...
      </div>
    );
  }

  if (detailLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading plan details...
      </div>
    );
  }

  if (selectedPlan) {
    return (
      <PlanDetail
        plan={selectedPlan}
        clientSlug={clientSlug}
        onBack={() => {
          setSelectedPlan(null);
          loadPlans();
        }}
        onReload={reloadCurrentPlan}
      />
    );
  }

  // List view
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-semibold text-gray-900">Plans</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Plan
        </button>
      </div>

      {showCreateForm && (
        <CreatePlanForm
          clientSlug={clientSlug}
          onDone={() => {
            setShowCreateForm(false);
            loadPlans();
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {plans.length === 0 && !showCreateForm ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-16 text-center">
          <ClipboardList className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No plans created yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => loadPlanDetail(plan.id)}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-left hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    {plan.name}
                  </h3>
                </div>
                <StatusBadge status={plan.status} />
              </div>

              <p className="text-xs text-gray-500 mb-3">
                {plan.quarter_start} &mdash; {plan.quarter_end}
              </p>

              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Progress</span>
                  <span className="text-xs font-semibold text-gray-700">
                    {Math.round(plan.progress_pct)}%
                  </span>
                </div>
                <ProgressBar pct={plan.progress_pct} size="sm" />
              </div>

              <p className="text-xs text-gray-400">{plan.items_count} items</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
