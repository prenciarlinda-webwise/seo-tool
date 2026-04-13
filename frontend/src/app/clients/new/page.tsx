"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, fetchClient, updateClient, type Client } from "@/lib/api";

export default function ClientFormPageWrapper() {
  return (
    <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
      <ClientFormPage />
    </Suspense>
  );
}

function ClientFormPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEdit = !!editId;

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<Partial<Client>>({
    is_active: true,
    track_organic: true,
    track_maps: false,
    discovery_enabled: true,
  });

  useEffect(() => {
    if (editId) {
      fetchClient(editId)
        .then((client) => setFormData(client))
        .catch(() => setError("Failed to load client"))
        .finally(() => setLoading(false));
    }
  }, [editId]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    // Strip empty strings
    const payload: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(formData)) {
      if (val !== "" && val !== undefined) payload[key] = val;
    }

    try {
      if (isEdit) {
        await updateClient(editId, payload);
        router.push(`/clients/${editId}`);
      } else {
        const client = await createClient(payload);
        router.push(`/clients/${client.slug}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save client");
      setSaving(false);
    }
  }

  const inputCls =
    "block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  if (loading) {
    return <div className="text-gray-500">Loading client...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        {isEdit ? "Edit Client" : "Add New Client"}
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Client Name *</label>
            <input
              name="name"
              required
              value={formData.name || ""}
              onChange={handleChange}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Domain *</label>
            <input
              name="domain"
              required
              placeholder="example.com"
              value={formData.domain || ""}
              onChange={handleChange}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Website URL</label>
            <input
              name="website_url"
              type="url"
              placeholder="https://..."
              value={formData.website_url || ""}
              onChange={handleChange}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Business Type</label>
            <input
              name="business_type"
              placeholder="Plumbing, Dental, etc."
              value={formData.business_type || ""}
              onChange={handleChange}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Contact Name</label>
            <input
              name="contact_name"
              value={formData.contact_name || ""}
              onChange={handleChange}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Contact Email</label>
            <input
              name="contact_email"
              type="email"
              value={formData.contact_email || ""}
              onChange={handleChange}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Contact Phone</label>
          <input
            name="contact_phone"
            value={formData.contact_phone || ""}
            onChange={handleChange}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Address</label>
          <textarea
            name="address"
            rows={2}
            value={(formData as Record<string, string>).address || ""}
            onChange={handleChange}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>City</label>
            <input
              name="city"
              value={formData.city || ""}
              onChange={handleChange}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>State</label>
            <input
              name="state"
              value={formData.state || ""}
              onChange={handleChange}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Zip Code</label>
            <input
              name="zip_code"
              value={formData.zip_code || ""}
              onChange={handleChange}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Google Business Name</label>
          <input
            name="google_business_name"
            placeholder="Name as it appears on Google Maps"
            value={(formData as Record<string, string>).google_business_name || ""}
            onChange={handleChange}
            className={inputCls}
          />
        </div>

        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Tracking Options
          </p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active ?? true}
              onChange={handleChange}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="track_organic"
              checked={formData.track_organic ?? true}
              onChange={handleChange}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700">
              Track Organic Rankings
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="track_maps"
              checked={formData.track_maps ?? false}
              onChange={handleChange}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700">
              Track Maps Rankings
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="discovery_enabled"
              checked={formData.discovery_enabled ?? true}
              onChange={handleChange}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700">
              Enable Monthly Discovery
            </span>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Client"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
