export type Severity = "low" | "medium" | "high";

export type RiskType =
  | "auto_renewal"
  | "high_penalty"
  | "non_compete"
  | "unfavorable_termination"
  | "vague_terms"
  | "unilateral_change"
  | "other";

export const RISK_TYPE_LABELS: Record<RiskType, string> = {
  auto_renewal: "自動續約",
  high_penalty: "高額違約金",
  non_compete: "競業禁止",
  unfavorable_termination: "不利終止條件",
  vague_terms: "模糊期限或條款",
  unilateral_change: "單方變更權",
  other: "其他風險",
};

export interface Report {
  source: string;
  full_text: string;
  key_fields: {
    parties: { name: string; role: string }[];
    subject: string | null;
    amount: string | null;
    start_date: string | null;
    end_date: string | null;
    termination: string | null;
  };
  risks: {
    risk_type: RiskType;
    severity: Severity;
    title: string;
    explanation: string;
    quote: string;
    chunk_id: number;
    start: number | null;
    end: number | null;
    verified: boolean;
  }[];
  risk_score: number;
  summary: string;
  chunks: {
    id: number;
    text: string;
    start: number;
    end: number;
    clause_no: string | null;
  }[];
}

export interface HealthStatus {
  status: "ok" | "degraded";
  ollama: boolean;
  models: string[];
}

export type AppView = "upload" | "analyzing" | "report";

export interface AnalysisState {
  view: AppView;
  jobId: string | null;
  progressMessages: string[];
  report: Report | null;
  error: string | null;
  fileName: string | null;
}
