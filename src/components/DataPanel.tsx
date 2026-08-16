import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { AlertTriangle, Download, Upload } from "lucide-react";
import countriesData from "../data/countries.json";
import type { Country } from "../lib/stats";
import { exportMarks, importMarks } from "../lib/importExport";
import type { SkippedEntry } from "../lib/importExport";
import { useCountriesStore } from "../store/countries";

const countries = countriesData as Country[];
const VALID_CODES = countries.map((c) => c.code);

const SKIP_REASON_LABEL: Record<SkippedEntry["reason"], string> = {
  unknown_code: "Unknown country code",
  invalid_state: "Not a valid state value",
  invalid_value: "Value was not a string",
};

type ImportOutcome =
  | { ok: true; appliedCount: number; skipped: SkippedEntry[] }
  | { ok: false; error: string };

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DataPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOutcome, setImportOutcome] = useState<ImportOutcome | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  function handleExport() {
    const marks = useCountriesStore.getState().marks;
    const json = exportMarks(marks);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `traviz-${todayStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const text = await file.text();
    const result = importMarks(text, VALID_CODES);

    if (!result.ok) {
      setImportOutcome({ ok: false, error: result.error });
      return;
    }

    useCountriesStore.getState().replaceAll(result.marks);
    setImportOutcome({
      ok: true,
      appliedCount: Object.keys(result.marks).length,
      skipped: result.skipped,
    });
  }

  function handleResetConfirmed() {
    useCountriesStore.getState().resetAll();
    setConfirmingReset(false);
    setImportOutcome(null);
    setResetDone(true);
  }

  return (
    <>
      <h1 className="px-6 pt-6 text-lg font-semibold text-slate-900">Data</h1>

      <div className="flex flex-col gap-8 px-6 py-6">
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Export</h2>
          <p className="mb-3 text-sm text-slate-600">
            Download all your marks as a JSON file you can back up or re-import later.
          </p>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export marks
          </button>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Import</h2>
          <p className="mb-3 text-sm text-slate-600">
            Import a previously exported JSON file. This replaces your current marks.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            Import marks
          </button>

          {importOutcome && !importOutcome.ok && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {importOutcome.error}
            </div>
          )}

          {importOutcome && importOutcome.ok && (
            <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
              <p>
                Imported {importOutcome.appliedCount} mark{importOutcome.appliedCount === 1 ? "" : "s"}.{" "}
                {importOutcome.skipped.length > 0
                  ? `Skipped ${importOutcome.skipped.length} row${importOutcome.skipped.length === 1 ? "" : "s"}.`
                  : "No rows skipped."}
              </p>
              {importOutcome.skipped.length > 0 && (
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-teal-700">
                  {importOutcome.skipped.map((entry, i) => (
                    <li key={`${entry.code}-${i}`}>
                      <span className="font-mono">{entry.code}</span>: {SKIP_REASON_LABEL[entry.reason]}{" "}
                      <span className="text-slate-500">({JSON.stringify(entry.value)})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Danger zone
          </h2>
          <p className="mb-3 text-sm text-slate-600">Permanently erase every mark. This cannot be undone.</p>

          {!confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
            >
              Reset all data
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-rose-300 bg-rose-100 p-3">
              <p className="text-sm text-rose-800">Are you sure? All marks will be permanently deleted.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleResetConfirmed}
                  className="rounded-lg bg-rose-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-600"
                >
                  Yes, erase everything
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {resetDone && <p className="mt-3 text-sm text-slate-600">All data has been reset.</p>}
        </section>
      </div>
    </>
  );
}
