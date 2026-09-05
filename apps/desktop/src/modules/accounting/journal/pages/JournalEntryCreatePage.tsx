import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { JournalType } from "@erp/shared-types";
import { Button } from "@shared/ui/button";
import { Input } from "@shared/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@shared/ui/card";
import { ErrorBoundary } from "@shared/ui/ErrorBoundary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { useChartOfAccounts } from "@shared/hooks/queries/useAccountQueries";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { JOURNAL_MUTATION_KEYS, invalidateKeys } from "@shared/hooks/queryClient";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { JournalLineEditor } from "@modules/accounting/journal/components/JournalLineEditor";
import { JournalEntrySummary } from "@modules/accounting/journal/components/JournalEntrySummary";
import {
  createEmptyLine,
  validateJournalEntry,
  buildCreateRequest,
  MANUAL_JOURNAL_TYPES,
  type JournalLineDraft,
} from "@modules/accounting/journal/lib/journal-entry-utils";

export default function JournalEntryCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { baseCurrency } = useCurrencyContext();
  const { data: accounts = [] } = useChartOfAccounts();

  const [journalType, setJournalType] = useState<JournalType>("GeneralJournal");
  const [entryDate, setEntryDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<JournalLineDraft[]>([
    createEmptyLine(baseCurrency?.code || "SYP"),
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const detailAccounts = useMemo(
    () => accounts.filter((a) => a.is_final && a.is_active),
    [accounts],
  );

  const validation = useMemo(
    () => validateJournalEntry(journalType, entryDate, description, lines),
    [journalType, entryDate, description, lines],
  );

  const handleSubmit = useCallback(async () => {
    const result = validateJournalEntry(journalType, entryDate, description, lines);
    if (!result.isValid) {
      setFormErrors(result.errors);
      return;
    }

    setFormErrors([]);
    setIsSubmitting(true);

    try {
      const request = buildCreateRequest(journalType, entryDate, description, lines);
      const entry = await journalEntryService.createJournalEntry(request);
      toast.success(`تم إنشاء القيد بنجاح — رقم ${entry.entry_number}`);
      await invalidateKeys(queryClient, JOURNAL_MUTATION_KEYS);
      navigate(`/journal/${entry.id}`, { replace: true });
    } catch (e) {
      toast.error("فشل إنشاء القيد: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSubmitting(false);
    }
  }, [journalType, entryDate, description, lines, queryClient, navigate]);

  const handleBack = useCallback(() => {
    navigate("/journal");
  }, [navigate]);

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-full">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-8 w-8 p-0"
              aria-label="العودة"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-slate-800">قيد يومية جديد</h1>
              <p className="text-xs text-slate-500">إنشاء قيد يومية جديد في دفتر الأستاذ</p>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !validation.isValid}
            className="h-9 px-5 font-bold bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? "جاري الإنشاء..." : "إنشاء القيد"}
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {formErrors.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              <ul className="list-disc list-inside space-y-0.5">
                {formErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">معلومات القيد</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-600">
                    نوع اليومية <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={journalType}
                    onValueChange={(val) => setJournalType(val as JournalType)}
                  >
                    <SelectTrigger className="h-10 font-bold bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MANUAL_JOURNAL_TYPES.map((jt) => (
                        <SelectItem key={jt.value} value={jt.value} className="font-bold">
                          {jt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-600">
                    التاريخ <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="h-10 font-bold"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1 md:row-span-1">
                  <label className="text-sm font-bold text-slate-600">
                    البيان <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="وصف القيد..."
                    className="h-10 font-bold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">بنود القيد</CardTitle>
            </CardHeader>
            <CardContent>
              <JournalLineEditor
                lines={lines}
                onLinesChange={setLines}
                accounts={accounts}
                detailAccounts={detailAccounts}
                baseCurrency={baseCurrency?.code || "SYP"}
              />
            </CardContent>
          </Card>

          <JournalEntrySummary lines={lines} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
