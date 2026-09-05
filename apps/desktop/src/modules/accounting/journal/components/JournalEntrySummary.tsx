import { useMemo } from "react";
import { toFixed } from "@shared/lib/format";
import { cn } from "@shared/lib/utils";
import type { JournalLineDraft } from "../lib/journal-entry-utils";

interface JournalEntrySummaryProps {
  lines: JournalLineDraft[];
}

export function JournalEntrySummary({ lines }: JournalEntrySummaryProps) {
  const { totalDebit, totalCredit, difference, isBalanced, hasLines } = useMemo(() => {
    const totalDebit = lines.reduce(
      (sum, l) => (l.side === "debit" ? sum + (parseFloat(l.amount) || 0) : sum),
      0,
    );
    const totalCredit = lines.reduce(
      (sum, l) => (l.side === "credit" ? sum + (parseFloat(l.amount) || 0) : sum),
      0,
    );
    const difference = Math.abs(totalDebit - totalCredit);
    const hasLines = lines.some((l) => l.amount.trim() !== "" && parseFloat(l.amount) > 0);
    const isBalanced = hasLines && difference < 0.001;

    return { totalDebit, totalCredit, difference, isBalanced, hasLines };
  }, [lines]);

  if (!hasLines) return null;

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        isBalanced
          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : "bg-amber-50 border-amber-200 text-amber-800",
      )}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <span className="font-bold">
            إجمالي المدين: <span className="tabular-nums">{toFixed(totalDebit, 2)}</span>
          </span>
          <span className="font-bold">
            إجمالي الدائن: <span className="tabular-nums">{toFixed(totalCredit, 2)}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isBalanced ? (
            <span className="font-bold text-emerald-700">متوازن</span>
          ) : (
            <span className="font-bold text-amber-700">
              غير متوازن — فارق: {toFixed(difference, 2)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
