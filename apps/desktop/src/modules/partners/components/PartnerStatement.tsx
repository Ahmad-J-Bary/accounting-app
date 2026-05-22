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
import type { JournalEntryDto } from "@erp/shared-types";
import { format } from "date-fns";
import { Loader2, ArrowRightLeft, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@shared/ui/button";
import { useCurrencyContext } from "@app/providers/CurrencyContext";

interface PartnerStatementProps {
  partnerId: string;
  partnerName: string;
  partnerType: "customer" | "supplier";
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

  const sortedCurrencies = useMemo(() => {
    if (!baseCurrency) return currencies;
    return [baseCurrency, ...currencies.filter(c => c.code !== baseCurrency.code)];
  }, [currencies, baseCurrency]);

  useEffect(() => {
    const fetchStatement = async () => {
      try {
        setLoading(true);
        const data = await journalEntryService.listJournalEntries({ partner_id: partnerId });
        const sorted = data.sort(
          (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
        );
        setEntries(sorted);
      } catch (err) {
        console.error("Failed to fetch statement:", err);
        setError("فشل تحميل كشف الحساب");
      } finally {
        setLoading(false);
      }
    };

    if (partnerId) {
      fetchStatement();
    }
  }, [partnerId]);

  const totals = useMemo(() => {
    const acc: Record<string, { debit: number; credit: number }> = {};
    sortedCurrencies.forEach(c => { acc[c.code] = { debit: 0, credit: 0 }; });

    entries.forEach(entry => {
      const partnerLines = entry.lines.filter(l => l.partner_id === partnerId);
      partnerLines.forEach(line => {
        const d = parseFloat(line.debit || "0");
        const c = parseFloat(line.credit || "0");
        if (acc[line.currency]) {
          acc[line.currency].debit += d;
          acc[line.currency].credit += c;
        }
      });
    });

    return sortedCurrencies.map(c => ({
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
        <p className="text-slate-500 font-bold">جاري تحضير كشف الحساب...</p>
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-500 font-bold">{error}</div>;
  }

  const runningBalances: Record<string, number> = {};
  const titlePrefix = partnerType === "customer" ? "كشف حساب العميل" : "كشف حساب المورد";
  const emptyText =
    partnerType === "customer"
      ? "لا توجد حركات مسجلة لهذا العميل حتى الآن."
      : "لا توجد حركات مسجلة لهذا المورد حتى الآن.";

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="px-0 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-primary" />
            {titlePrefix}: {partnerName}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="font-bold">
            طباعة الكشف
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="text-right font-bold w-[120px]">التاريخ</TableHead>
                <TableHead className="text-right font-bold w-[100px]">رقم القيد</TableHead>
                <TableHead className="text-right font-bold">البيان / الحركة</TableHead>
                {sortedCurrencies.map(c => (
                  <React.Fragment key={c.code}>
                    <TableHead className="text-left font-bold w-[100px]">مدين ({c.symbol})</TableHead>
                    <TableHead className="text-left font-bold w-[100px]">دائن ({c.symbol})</TableHead>
                    <TableHead className="text-left font-bold w-[110px]">الرصيد ({c.symbol})</TableHead>
                  </React.Fragment>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3 + sortedCurrencies.length * 3} className="text-center py-12 text-slate-400 font-medium italic">
                    {emptyText}
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const partnerLines = entry.lines.filter(l => l.partner_id === partnerId);
                  const perCurrency = sortedCurrencies.map(c => {
                    const lines = partnerLines.filter(l => l.currency === c.code);
                    const d = lines.reduce((sum, l) => sum + parseFloat(l.debit), 0);
                    const cr = lines.reduce((sum, l) => sum + parseFloat(l.credit), 0);
                    runningBalances[c.code] = (runningBalances[c.code] || 0) + (d - cr);
                    return { code: c.code, symbol: c.symbol, debit: d, credit: cr, balance: runningBalances[c.code] };
                  });

                  return (
                    <TableRow key={entry.id} className="hover:bg-slate-50/30 transition-colors">
                      <TableCell className="font-medium text-slate-600">
                        {format(new Date(entry.entry_date), "yyyy/MM/dd")}
                      </TableCell>
                      <TableCell className="font-bold text-primary">{entry.entry_number}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{entry.description}</span>
                          <span className="text-xs text-slate-400">{entry.journal_type_display}</span>
                        </div>
                      </TableCell>
                      {perCurrency.map(({ code, symbol, debit, credit, balance }) => (
                        <React.Fragment key={code}>
                          <TableCell className="text-left">
                            {debit > 0 ? (
                              <div className="flex items-center justify-end gap-1 text-red-600 font-bold">
                                {debit.toLocaleString()}
                                <TrendingUp className="w-3 h-3" />
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-left">
                            {credit > 0 ? (
                              <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold">
                                {credit.toLocaleString()}
                                <TrendingDown className="w-3 h-3" />
                              </div>
                            ) : "-"}
                          </TableCell>
                          <TableCell className="text-left font-black text-slate-900 bg-slate-50/20">
                            {balance.toLocaleString()}
                            <span className="text-[10px] mr-1 text-slate-400">{symbol}</span>
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
            const t = totals.find(t => t.currencyCode === targetCurr.code);
            if (!t) return null;
            const bal = t.debit - t.credit;
            return (
              <TableRow key={targetCurr.code} className="bg-slate-50 font-bold">
                <TableCell className="text-slate-400 text-xs" colSpan={3}>{`الإجمالي (${targetCurr.symbol})`}</TableCell>
                {sortedCurrencies.map((_, idx) => {
                  if (idx === targetIdx) {
                    return (
                      <React.Fragment key={targetCurr.code}>
                        <TableCell className="text-left text-red-600">{t.debit.toLocaleString() || '0'}</TableCell>
                        <TableCell className="text-left text-emerald-600">{t.credit.toLocaleString() || '0'}</TableCell>
                        <TableCell className="text-left font-black text-slate-900">{bal.toLocaleString()}</TableCell>
                      </React.Fragment>
                    );
                  }
                  return (
                    <React.Fragment key={`${idx}`}>
                      <TableCell /><TableCell /><TableCell />
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

