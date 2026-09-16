import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@shared/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { journalEntryService } from "@modules/accounting/api/journalEntryService";
import { JOURNAL_TYPE_LABELS } from "@modules/accounting/journal/lib/journal-config";
import type { JournalEntryDto } from "@erp/shared-types";
import { format } from "date-fns";
import { Loader2, ArrowRightLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@shared/ui/button";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { toLocalString, formatNumber } from "@shared/lib/format";
import { partnerDirectionMultiplier } from "@shared/lib/balance-utils";
import { useLocalization } from "@app/providers/LocalizationProvider";
import type { LocalizationContextValue } from "@shared/types/i18n";

interface PartnerStatementProps {
  partnerId: string;
  partnerName: string;
  partnerType: "customer" | "supplier";
}

function getJournalDisplay(entry: JournalEntryDto, t: LocalizationContextValue["t"]): string {
  if (entry.journal_type === "GeneralJournal") {
    const hasDebit = entry.lines.some((l) => {
      const accCode = l.account_code || "";
      return (accCode.startsWith("47") || accCode.startsWith("332")) && parseFloat(l.debit || "0") > 0;
    });
    if (hasDebit) {
      const matchedAccount = entry.lines.find((l) => {
        const accCode = l.account_code || "";
        return (accCode.startsWith("47") || accCode.startsWith("332")) && parseFloat(l.debit || "0") > 0;
      });
      if (matchedAccount) {
        const code = matchedAccount.account_code || "";
        if (code.startsWith("332")) return t("statement.liabilityEarned", { namespace: "partners",  });
        if (code.startsWith("47")) return t("statement.liabilityGranted", { namespace: "partners",  });
      }
    }
  }
  return JOURNAL_TYPE_LABELS[entry.journal_type] || entry.journal_type_display || entry.journal_type || "";
}

export const PartnerStatement: React.FC<PartnerStatementProps> = ({
  partnerId,
  partnerName,
  partnerType,
}) => {
  const [entries, setEntries] = useState<JournalEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currencies, baseCurrency } = useCurrencyContext();
  const { t } = useLocalization();

  const dirMul = partnerDirectionMultiplier(partnerType);

  const sortedCurrencies = useMemo(() => {
    if (!baseCurrency) return currencies;
    return [baseCurrency, ...currencies.filter((c) => c.code !== baseCurrency.code)];
  }, [currencies, baseCurrency]);

  useEffect(() => {
    const fetchStatement = async () => {
      try {
        setLoading(true);
        const data = await journalEntryService.listPostedJournalEntries(undefined, undefined, undefined, partnerId);
        const sorted = data.sort(
          (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
        );
        setEntries(sorted);
      } catch (err) {
        console.error("Failed to fetch statement:", err);
        setError(t("statement.loadError", { namespace: "partners",  }));
      } finally {
        setLoading(false);
      }
    };

    if (partnerId) {
      fetchStatement();
    }
  }, [partnerId, t]);

  const totals = useMemo(() => {
    const acc: Record<string, { debit: number; credit: number }> = {};
    sortedCurrencies.forEach((c) => {
      acc[c.code] = { debit: 0, credit: 0 };
    });

    entries.forEach((entry) => {
      const partnerLines = entry.lines.filter((l) => l.partner_id === partnerId);
      partnerLines.forEach((line) => {
        const d = parseFloat(line.debit || "0");
        const c = parseFloat(line.credit || "0");
        if (acc[line.currency]) {
          acc[line.currency].debit += d;
          acc[line.currency].credit += c;
        }
      });
    });

    return sortedCurrencies.map((c) => ({
      currencyCode: c.code,
      currencySymbol: c.symbol,
      debit: acc[c.code]?.debit || 0,
      credit: acc[c.code]?.credit || 0,
    }));
  }, [entries, partnerId, sortedCurrencies]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold">{t("statement.loading", { namespace: "partners",  })}</p>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-500 font-bold">{error}</div>;
  }

  const runningBalances: Record<string, number> = {};
  const titlePrefix = partnerType === "customer" ? t("statement.titleCustomer", { namespace: "partners",  }) : t("statement.titleSupplier", { namespace: "partners",  });
  const emptyText =
    partnerType === "customer"
      ? t("statement.emptyCustomer", { namespace: "partners",  })
      : t("statement.emptySupplier", { namespace: "partners",  });

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-primary" />
            {titlePrefix}: {partnerName}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => { window.dispatchEvent(new Event("app:prepare-print")); requestAnimationFrame(() => window.print()); }} className="font-bold">
            {t("statement.print", { namespace: "partners",  })}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="rounded-xl border border-muted overflow-hidden bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-right font-bold w-[120px]">{t("statement.colDate", { namespace: "partners",  })}</TableHead>
                <TableHead className="text-right font-bold w-[100px]">{t("statement.colEntryNumber", { namespace: "partners",  })}</TableHead>
                <TableHead className="text-right font-bold">{t("statement.colDescription", { namespace: "partners",  })}</TableHead>
                {sortedCurrencies.map((c) => (
                  <React.Fragment key={c.code}>
                    <TableHead className="text-left font-bold w-[100px]">{t("statement.colDebit", { namespace: "partners", vars: { currency: c.symbol },  })}</TableHead>
                    <TableHead className="text-left font-bold w-[100px]">{t("statement.colCredit", { namespace: "partners", vars: { currency: c.symbol },  })}</TableHead>
                    <TableHead className="text-left font-bold w-[110px]">{t("statement.colBalance", { namespace: "partners", vars: { currency: c.symbol },  })}</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3 + sortedCurrencies.length * 3}
                    className="text-center py-12 text-muted-foreground font-medium italic"
                  >
                    {emptyText}
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const partnerLines = entry.lines.filter((l) => l.partner_id === partnerId);
                  const perCurrency = sortedCurrencies.map((c) => {
                    const lines = partnerLines.filter((l) => l.currency === c.code);
                    const d = lines.reduce((sum, l) => sum + parseFloat(l.debit), 0);
                    const cr = lines.reduce((sum, l) => sum + parseFloat(l.credit), 0);
                    runningBalances[c.code] =
                      (runningBalances[c.code] || 0) + (d - cr) * dirMul;
                    return {
                      code: c.code,
                      symbol: c.symbol,
                      debit: d,
                      credit: cr,
                      balance: runningBalances[c.code],
                    };
                  });

                  return (
                    <TableRow
                      key={entry.id}
                      className="hover:bg-muted/50/30 transition-colors"
                    >
                      <TableCell className="font-medium text-slate-600">
                        {format(new Date(entry.entry_date), "yyyy/MM/dd")}
                      </TableCell>
                      <TableCell className="font-bold text-primary">{formatNumber(parseInt(entry.entry_number) || 0)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">{entry.description}</span>
                          <span className="text-xs text-muted-foreground">
                            {getJournalDisplay(entry, t)}
                          </span>
                        </div>
                      </TableCell>
                      {perCurrency.map(({ code, symbol, debit, credit, balance }) => (
                        <React.Fragment key={code}>
                          <TableCell className="text-left">
                            {debit > 0 ? (
                              <div className="flex items-center justify-end gap-1 text-red-600 font-bold">
                                {toLocalString(debit)}
                                <TrendingUp className="w-3 h-3" />
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-left">
                            {credit > 0 ? (
                              <div className="flex items-center justify-end gap-1 text-success font-bold">
                                {toLocalString(credit)}
                                <TrendingDown className="w-3 h-3" />
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-left font-black text-slate-900 bg-muted/20">
                            {toLocalString(balance)}
                            <span className="text-[10px] mr-1 text-muted-foreground">{symbol}</span>
                          </TableCell>
                        </React.Fragment>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <TableFooter>
          {sortedCurrencies.map((targetCurr, targetIdx) => {
            const row = totals.find((totalRow) => totalRow.currencyCode === targetCurr.code);
            if (!row) return null;
            const bal = (row.debit - row.credit) * dirMul;
            return (
              <TableRow key={targetCurr.code} className="bg-muted font-bold">
                <TableCell className="text-muted-foreground text-xs" colSpan={3}>
                  {t("statement.total", { namespace: "partners", vars: { currency: targetCurr.symbol },  })}
                </TableCell>
                {sortedCurrencies.map((_, idx) => {
                  if (idx === targetIdx) {
                    return (
                      <React.Fragment key={targetCurr.code}>
                        <TableCell className="text-left text-red-600">
                          {toLocalString(row.debit) || "0"}
                        </TableCell>
                        <TableCell className="text-left text-success">
                          {toLocalString(row.credit) || "0"}
                        </TableCell>
                        <TableCell className="text-left font-black text-slate-900">
                          {toLocalString(bal)}
                        </TableCell>
                      </React.Fragment>
                    );
                  }
                  return (
                    <React.Fragment key={`${idx}`}>
                      <TableCell />
                      <TableCell />
                      <TableCell />
                    </React.Fragment>
                  );
                })}
              </TableRow>
            );
          })}
        </TableFooter>
      </CardContent>
    </Card>
  );
};
