import { cn } from "@shared/lib/utils";
import { readinessLabel, type Readiness } from "../lib/migration-labels";

interface ReconciliationStatusBannerProps {
  readiness: Readiness;
}

/** Colored readiness banner shared by the wizard (step 5) and the reconciliation card. */
export function ReconciliationStatusBanner({ readiness }: ReconciliationStatusBannerProps) {
  const { readyToPost, readyToLock } = readiness;
  return (
    <div
      className={cn(
        "px-3 py-2 text-xs font-bold rounded-b-lg",
        readyToPost ? (readyToLock ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700") : "bg-red-50 text-red-600",
      )}
    >
      {readinessLabel(readiness)}
    </div>
  );
}
