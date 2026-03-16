"use client";

import { useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportModalProps {
  title: string;
  description: string;
  templateColumns: string[];
  sampleRow?: string[];
  exportUrl?: string;
  onImport: (file: File) => Promise<{ created?: number; updated?: number; skipped?: number; errors?: string[] }>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportModal({
  title,
  description,
  templateColumns,
  sampleRow,
  exportUrl,
  onImport,
  onClose,
  onSuccess,
}: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    created?: number;
    updated?: number;
    skipped?: number;
    errors?: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const res = await onImport(file);
      setResult(res);
      onSuccess();
    } catch (err) {
      setResult({ errors: [err instanceof Error ? err.message : "Import failed"] });
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const csv = [templateColumns.join(",")];
    if (sampleRow) csv.push(sampleRow.join(","));
    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "_")}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">{description}</p>

          {/* Template download */}
          <div className="flex items-center gap-3">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download Template
            </button>
            {exportUrl && (
              <a
                href={exportUrl}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export Current Data
              </a>
            )}
          </div>

          {/* Expected columns */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">
              Expected columns:
            </p>
            <div className="flex flex-wrap gap-1">
              {templateColumns.map((col) => (
                <span
                  key={col}
                  className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-mono"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* File upload */}
          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              file
                ? "border-green-300 bg-green-50"
                : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/30"
            )}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <div>
                <p className="text-sm font-medium text-green-700">{file.name}</p>
                <p className="text-xs text-green-600 mt-1">
                  {(file.size / 1024).toFixed(1)} KB — Click to change
                </p>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  Click to upload CSV file
                </p>
              </div>
            )}
          </div>

          {/* Results */}
          {result && (
            <div
              className={cn(
                "rounded-lg p-3 text-sm",
                result.errors && result.errors.length > 0
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              )}
            >
              {result.created != null && <p>Created: {result.created}</p>}
              {result.updated != null && <p>Updated: {result.updated}</p>}
              {result.skipped != null && <p>Skipped: {result.skipped}</p>}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-1">
                  <p className="font-medium">Errors:</p>
                  <ul className="list-disc list-inside text-xs mt-1">
                    {result.errors.slice(0, 5).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>...and {result.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
          >
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? "Importing..." : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
