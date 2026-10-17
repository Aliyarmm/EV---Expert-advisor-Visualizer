/**
 * CSV serialization utilities for EV — Expert Advisor Visualizer.
 * Escapes values per RFC 4180 so commas, quotes, and newlines are handled safely.
 */

/** Download a string as a CSV file in the browser. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Escape a single value per RFC 4180. */
function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a CSV string from rows of values. */
export function toCsv(rows: unknown[][]): string {
  return rows
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

/** Build a CSV string from an array of objects. */
export function toCsvObjects(
  rows: Record<string, unknown>[],
  columns?: string[]
): string {
  const cols = columns || (rows.length ? Object.keys(rows[0]) : []);
  return toCsv([
    cols,
    ...rows.map((r) => cols.map((c) => r[c])),
  ]);
}
