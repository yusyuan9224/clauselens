import type { HealthStatus, Report } from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function checkHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
  if (!res.ok) throw new Error("健康檢查失敗");
  return res.json() as Promise<HealthStatus>;
}

export async function analyzeFile(file: File): Promise<{ job_id: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/analyze/file`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(data.detail ?? `上傳失敗 (${res.status})`);
  }
  return res.json() as Promise<{ job_id: string }>;
}

export async function analyzeText(text: string): Promise<{ job_id: string }> {
  const res = await fetch(`${API_BASE}/api/analyze/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string };
    throw new Error(data.detail ?? `送出失敗 (${res.status})`);
  }
  return res.json() as Promise<{ job_id: string }>;
}

export interface JobStatus {
  status: "queued" | "running" | "done" | "error";
  progress: string[];
  report: Report | null;
  error: string | null;
}

export async function pollJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`查詢失敗 (${res.status})`);
  return res.json() as Promise<JobStatus>;
}

export function createJobEventSource(jobId: string): EventSource {
  return new EventSource(`${API_BASE}/api/jobs/${jobId}/events`);
}
