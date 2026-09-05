import { useState } from "react";
import { Plus } from "lucide-react";
import type { AccountDto } from "@erp/shared-types";
import { Button } from "@shared/ui/button";
import { JournalLineRow } from "./JournalLineRow";
import type { JournalLineDraft } from "../lib/journal-entry-utils";
import { createEmptyLine } from "../lib/journal-entry-utils";

interface JournalLineEditorProps {
  lines: JournalLineDraft[];
  onLinesChange: (lines: JournalLineDraft[]) => void;
  accounts: readonly AccountDto[];
  detailAccounts: AccountDto[];
  baseCurrency: string;
}

export function JournalLineEditor({
  lines,
  onLinesChange,
  accounts,
  detailAccounts,
  baseCurrency,
}: JournalLineEditorProps) {
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());

  const handleUpdate = (key: string, patch: Partial<JournalLineDraft>) => {
    onLinesChange(
      lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };

  const handleRemove = (key: string) => {
    if (lines.length <= 1) return;
    onLinesChange(lines.filter((l) => l.key !== key));
    setNewKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleAdd = () => {
    const newLine = createEmptyLine(baseCurrency);
    onLinesChange([...lines, newLine]);
    setNewKeys((prev) => new Set(prev).add(newLine.key));
  };

  return (
    <div className="space-y-2">
      {lines.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-3">
          لا توجد بنود — أضف سطراً واحداً على الأقل
        </p>
      )}

      {lines.map((line, index) => (
        <JournalLineRow
          key={line.key}
          line={line}
          accounts={accounts}
          detailAccounts={detailAccounts}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
          isOnlyLine={lines.length <= 1}
          lineIndex={index + 1}
          autoFocus={newKeys.has(line.key)}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        className="h-8 shrink-0 rounded-full border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400 transition-all"
      >
        <Plus className="h-3.5 w-3.5 ms-1" />
        إضافة سطر
      </Button>
    </div>
  );
}
