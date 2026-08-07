import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Skeleton } from "@shared/ui/skeleton";
import { partnerService, type PartnerEquityStatementDto } from "@modules/partners/api/partnerService";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

export function PartnerEquityCard() {
  const { formatAmount, baseCurrency } = useCurrencyContext();
  const { data, isLoading, error } = useQuery<PartnerEquityStatementDto>({
    queryKey: ["partner-equity-statement"],
    queryFn: () => partnerService.getPartnerEquityStatement(),
  });

  const sym = baseCurrency?.symbol || baseCurrency?.code || "";
  const show = (v?: string) => (v !== undefined && v !== null ? formatAmount(parseFloat(v), { currencyCode: baseCurrency?.code || "" }) : "—");

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="py-3">
        <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-indigo-600" /> بيان شركاء — حقوق الملكية ({sym})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && (
          <div className="p-4 space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded" />)}
          </div>
        )}
        {error && <p className="text-xs text-red-500 p-4">فشل تحميل بيان الشركاء: {String(error)}</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="text-right px-4 py-2 font-semibold">الشريك</th>
                  <th className="text-right px-4 py-2 font-semibold">رأس المال المسجل</th>
                  <th className="text-right px-4 py-2 font-semibold">رصيد دفتر الأستاذ</th>
                  <th className="text-right px-4 py-2 font-semibold">الأرباح المتراكمة</th>
                  <th className="text-right px-4 py-2 font-semibold">إجمالي حقوق الملكية</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-slate-400">لا يوجد شركاء</td>
                  </tr>
                )}
                {data.rows.map((r) => (
                  <tr key={r.partner_id} className="border-b border-slate-100">
                    <td className="px-4 py-2 font-bold text-slate-700">{r.partner_name}</td>
                    <td className="px-4 py-2 tabular-nums text-slate-600">{show(r.capital_registered)}</td>
                    <td className="px-4 py-2 tabular-nums text-slate-600">{show(r.ledger_balance)}</td>
                    <td className={"px-4 py-2 tabular-nums " + (parseFloat(r.profit_allocated) < 0 ? "text-red-600" : "text-emerald-700")}>
                      {show(r.profit_allocated)}
                    </td>
                    <td className="px-4 py-2 tabular-nums font-black text-indigo-700">{show(r.total_equity)}</td>
                  </tr>
                ))}
                {data.rows.length > 0 && (
                  <tr className="bg-slate-50 font-black text-slate-800">
                    <td className="px-4 py-2">الإجمالي</td>
                    <td className="px-4 py-2 tabular-nums">{show(data.total_capital)}</td>
                    <td className="px-4 py-2 tabular-nums">—</td>
                    <td className="px-4 py-2 tabular-nums">{show(data.total_profit_allocated)}</td>
                    <td className="px-4 py-2 tabular-nums">{show(data.total_equity)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}