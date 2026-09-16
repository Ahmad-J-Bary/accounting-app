import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { Skeleton } from "@shared/ui/skeleton";
import { partnerService, type PartnerEquityStatementDto } from "@modules/partners/api/partnerService";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useLocalization } from "@app/providers/LocalizationProvider";
import { QUERY_KEYS } from "@shared/hooks/queryClient";

export function PartnerEquityCard() {
  const { formatAmount, baseCurrency } = useCurrencyContext();
  const { t } = useLocalization();
  const { data, isLoading, error } = useQuery<PartnerEquityStatementDto>({
    queryKey: QUERY_KEYS.partnerEquityStatement(),
    queryFn: () => partnerService.getPartnerEquityStatement(),
  });

  const sym = baseCurrency?.symbol || baseCurrency?.code || "";
  const show = (v?: string) => (v !== undefined && v !== null ? formatAmount(parseFloat(v), { currencyCode: baseCurrency?.code || "" }) : "—");

  return (
    <Card className="border-muted shadow-sm">
      <CardHeader className="py-3">
        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
          <Wallet className="w-4 h-4 text-indigo-600" /> {t("chart.equityTitle", { namespace: "partners", vars: { currency: sym },  })}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && (
          <div className="p-4 space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 rounded" />)}
          </div>
        )}
        {error && <p className="text-xs text-red-500 p-4">{t("chart.equityLoadError", { namespace: "partners", vars: { error: String(error) },  })}</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-muted text-muted-foreground">
                  <th className="text-right px-4 py-2 font-semibold">{t("chart.equityColumns.partner", { namespace: "partners",  })}</th>
                  <th className="text-right px-4 py-2 font-semibold">{t("chart.equityColumns.capitalRegistered", { namespace: "partners",  })}</th>
                  <th className="text-right px-4 py-2 font-semibold">{t("chart.equityColumns.ledgerBalance", { namespace: "partners",  })}</th>
                  <th className="text-right px-4 py-2 font-semibold">{t("chart.equityColumns.currentBalance", { namespace: "partners",  })}</th>
                  <th className="text-right px-4 py-2 font-semibold">{t("chart.equityColumns.drawings", { namespace: "partners",  })}</th>
                  <th className="text-right px-4 py-2 font-semibold">{t("chart.equityColumns.accumulatedProfit", { namespace: "partners",  })}</th>
                  <th className="text-right px-4 py-2 font-semibold">{t("chart.equityColumns.accumulatedLoss", { namespace: "partners",  })}</th>
                  <th className="text-right px-4 py-2 font-semibold">{t("chart.equityColumns.totalEquity", { namespace: "partners",  })}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-4 text-muted-foreground">{t("chart.equityEmpty", { namespace: "partners",  })}</td>
                  </tr>
                )}
                {data.rows.map((r) => (
                  <tr key={r.partner_id} className="border-b border-muted">
                    <td className="px-4 py-2 font-bold text-foreground">{r.partner_name}</td>
                    <td className="px-4 py-2 tabular-nums text-slate-600">{show(r.capital_registered)}</td>
                    <td className="px-4 py-2 tabular-nums text-slate-600">{show(r.ledger_balance)}</td>
                    <td className="px-4 py-2 tabular-nums text-slate-600">{show(r.current_balance)}</td>
                    <td className="px-4 py-2 tabular-nums text-red-600">{show(r.drawings)}</td>
                    <td className={"px-4 py-2 tabular-nums " + (parseFloat(r.profit_allocated) < 0 ? "text-red-600" : "text-success")}>
                      {show(r.profit_allocated)}
                    </td>
                    <td className={"px-4 py-2 tabular-nums " + (parseFloat(r.loss_allocated) > 0 ? "text-red-600" : "text-muted-foreground")}>
                      {show(r.loss_allocated)}
                    </td>
                    <td className="px-4 py-2 tabular-nums font-black text-indigo-700">{show(r.total_equity)}</td>
                  </tr>
                ))}
                {data.rows.length > 0 && (
                  <tr className="bg-muted font-black text-foreground">
                    <td className="px-4 py-2">{t("chart.equityTotal", { namespace: "partners",  })}</td>
                    <td className="px-4 py-2 tabular-nums">{show(data.total_capital)}</td>
                    <td className="px-4 py-2 tabular-nums">—</td>
                    <td className="px-4 py-2 tabular-nums">—</td>
                    <td className="px-4 py-2 tabular-nums">{show(data.total_drawings)}</td>
                    <td className="px-4 py-2 tabular-nums">{show(data.total_profit_allocated)}</td>
                    <td className="px-4 py-2 tabular-nums">—</td>
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