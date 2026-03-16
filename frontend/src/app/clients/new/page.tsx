"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/api";

export default function NewClientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const data: Record<string, unknown> = {};
    form.forEach((value, key) => {
      if (value !== "") data[key] = value;
    });
    // Booleans
    data.is_active = form.has("is_active");
    data.track_organic = form.has("track_organic");
    data.track_maps = form.has("track_maps");
    data.discovery_enabled = form.has("discovery_enabled");

    try {
      const client = await createClient(data);
      router.push(`/clients/${client.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client");
      setSaving(false);
    }
  }

  const inputCls =
    "block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Add New Client
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
            <input name="name" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Domain *</label>
            <input
              name="domain"
              required
              placeholder="example.com"
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
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Business Type</label>
            <input
              name="business_type"
              placeholder="Plumbing, Dental, etc."
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Contact Name</label>
            <input name="contact_name" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Contact Email</label>
            <input name="contact_email" type="email" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>City</label>
            <input name="city" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>State</label>
            <input name="state" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Zip Code</label>
            <input name="zip_code" className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Google Business Name</label>
          <input
            name="google_business_name"
            placeholder="Name as it appears on Google Maps"
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
              defaultChecked
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-700">Active</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="track_organic"
              defaultChecked
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
              defaultChecked
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
            {saving ? "Saving..." : "Create Client"}
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
