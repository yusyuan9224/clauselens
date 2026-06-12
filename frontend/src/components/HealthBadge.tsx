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
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block w-2 h-2 rounded-full bg-gray-300 animate-pulse" />
        <span>檢查後端...</span>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-600">
        <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
        <span>後端未連線</span>
      </div>
    );
  }

  const isOk = health.status === "ok";
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className={`inline-block w-2 h-2 rounded-full ${isOk ? "bg-green-500" : "bg-yellow-500"}`}
      />
      <span className={isOk ? "text-green-700" : "text-yellow-700"}>
        後端{isOk ? "正常" : "降級"}
      </span>
      {health.models.length > 0 && (
        <span className="text-muted-foreground ml-1">
          · {health.models.join(", ")}
        </span>
      )}
    </div>
  );
}
