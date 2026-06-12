"use client";

import { useEffect, useState } from "react";
import { checkHealth } from "@/lib/api";
import type { HealthStatus } from "@/lib/types";

export function HealthBadge() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkHealth()
      .then(setHealth)
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-muted-foreground">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-border animate-pulse" />
        <span>檢查後端...</span>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center gap-2 font-mono text-[11px] tracking-wide text-risk-high">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-risk-high" />
        <span>後端未連線</span>
      </div>
    );
  }

  const isOk = health.status === "ok";
  return (
    <div className="flex items-center gap-2 font-mono text-[11px] tracking-wide">
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${isOk ? "bg-risk-safe" : "bg-risk-medium"}`}
      />
      <span className={isOk ? "text-muted-foreground" : "text-risk-medium"}>
        後端{isOk ? "正常" : "降級"}
      </span>
      {health.models.length > 0 && (
        <span className="text-muted-foreground/70 hidden md:inline">
          · {health.models.join(", ")}
        </span>
      )}
    </div>
  );
}
