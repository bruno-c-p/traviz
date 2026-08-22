import type { Marks } from "./colors";

export async function fetchMarks(): Promise<Marks> {
  const res = await fetch("/api/marks");
  if (!res.ok) throw new Error(`Failed to load marks (${res.status})`);
  const data = (await res.json()) as { marks: Marks };
  return data.marks;
}

export async function saveMarks(marks: Marks): Promise<void> {
  const res = await fetch("/api/marks", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ marks }),
  });
  if (!res.ok) throw new Error(`Failed to save marks (${res.status})`);
}

export async function clearMarks(): Promise<void> {
  const res = await fetch("/api/marks", { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to clear marks (${res.status})`);
}
