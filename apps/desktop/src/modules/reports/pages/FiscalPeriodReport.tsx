import { useCallback, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { OperationalTableTemplate } from "@widgets/templates/OperationalTableTemplate";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { fiscalPeriodService } from "@modules/accounting/api/fiscalPeriodService";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@shared/ui/card";
import { Button } from "@shared/ui/button";
import { Label } from "@shared/ui/label";
import { Input } from "@shared/ui/input";

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

export default function FiscalPeriodReport() {
  const qc = useQueryClient();
  const { formatAmount, baseCurrency } = useCurrencyContext();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ["fiscal-periods"],
    queryFn: () => fiscalPeriodService.listFiscalPeriods(),
  });

  const create = useMutation({
    mutationFn: () =>
      fiscalPeriodService.createFiscalPeriod({
        start_date: new Date(start).toISOString(),
        end_date: new Date(end).toISOString(),
      }),
    onSuccess: () => {
      setStart("");
      setEnd("");
      qc.invalidateQueries({ queryKey: ["fiscal-periods"] });
    },
  });

  const closePeriod = useMutation({
    mutationFn: ({ periodId, finalize }: { periodId: string; finalize: boolean }) =>
      fiscalPeriodService.closeFiscalPeriod({ period_id: periodId, closed_by: "user", finalize }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fiscal-periods"] }),
  });

  const active = periods.find((p) => p.status === "Open" || p.status === "Reopened" || p.status === "Closing");

  const { data: distributable } = useQuery({
    queryKey: ["distributable-profit", active?.start_date, active?.end_date],
    queryFn: () =>
      fiscalPeriodService.getDistributableProfit(active!.start_date, active!.end_date),
    enabled: !!active,
  });

  const profit = useMemo(() => {
    if (!active || !distributable) return null;
    return distributable;
  }, [active, distributable]);

  const show = useCallback(
    (v?: string) =>
      v !== undefined && v !== null
        ? formatAmount(parseFloat(v), { currencyCode: baseCurrency?.code || "" })
        : "—",
    [formatAmount, baseCurrency],
  );

  const canCreate = start && end && new Date(start) < new Date(end);

  return (
    <OperationalTableTemplate
      title="الفترات المالية"
      toolbar={<p className="text-xs text-slate-500">حساب الأرباح وتوزيعها لكل فترة مالية منفصلة عن رصيد الافتتاح.</p>}
      tableContent={
        <div className="p-4 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base font-bold text-slate-800">إنشاء فترة مالية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">بداية الفترة</Label>
                  <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">نهاية الفترة</Label>
                  <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </div>
              <Button
                onClick={() => create.mutate()}
                disabled={!canCreate || create.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {create.isPending ? "جارٍ الإنشاء..." : "إنشاء الفترة"}
              </Button>
              {create.isError && <p className="text-xs text-red-500">{String(create.error)}</p>}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base font-bold text-slate-800">الربح القابل للتوزيع (الفترة النشطة)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {profit ? (
                <div className="space-y-1">
                  <p>صافي ربح الفترة: <span className="font-bold text-emerald-700">{show(profit.current_period_profit)}</span></p>
                  <p>رصيد الأرباح المبقاة: <span className="font-bold text-slate-700">{show(profit.retained_earnings_balance)}</span></p>
                  <p>المُوزَّع سابقاً: <span className="font-bold text-red-600">{show(profit.allocated_to_date)}</span></p>
                  <p className="border-t border-slate-200 pt-2">الربح القابل للتوزيع: <span className="font-black text-indigo-700">{show(profit.distributable)}</span></p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">لا توجد فترة نشطة.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="py-3">
              <CardTitle className="text-base font-bold text-slate-800">القائمة</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="text-right px-4 py-2 font-semibold">البداية</th>
                    <th className="text-right px-4 py-2 font-semibold">النهاية</th>
                    <th className="text-right px-4 py-2 font-semibold">الحالة</th>
                    <th className="text-right px-4 py-2 font-semibold">أُغلقت بواسطة</th>
                    <th className="text-right px-4 py-2 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={5} className="text-center py-4 text-slate-400">جارٍ التحميل...</td></tr>
                  )}
                  {!isLoading && periods.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-4 text-slate-400">لا توجد فترات بعد</td></tr>
                  )}
                  {periods.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="px-4 py-2 tabular-nums">{toDateInput(p.start_date)}</td>
                      <td className="px-4 py-2 tabular-nums">{toDateInput(p.end_date)}</td>
                      <td className="px-4 py-2">
                        <span className={
                          p.status === "Open" ? "text-emerald-700" :
                          p.status === "Closed" ? "text-red-600" :
                          p.status === "Closing" ? "text-amber-600" : "text-slate-500"
                        }>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">{p.closed_by || "—"}</td>
                      <td className="px-4 py-2">
                        {(p.status === "Open" || p.status === "Closing") && (
                          <Button
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={closePeriod.isPending}
                            onClick={() => closePeriod.mutate({ periodId: p.id, finalize: true })}
                          >
                            إغلاق
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      }
    />
  );
}