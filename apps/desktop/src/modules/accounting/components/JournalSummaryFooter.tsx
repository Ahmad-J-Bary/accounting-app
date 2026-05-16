import { useMemo } from 'react';
import { cn } from "@shared/lib/utils";

interface CurrencyTotal {
  currencyCode: string;
  currencySymbol: string;
  debit: number;
  credit: number;
}

interface JournalSummaryFooterProps {
  totals: CurrencyTotal[];
  className?: string;
}

export function JournalSummaryFooter({ totals, className }: JournalSummaryFooterProps) {
  const summaryItems = useMemo(() => {
    return totals.map(t => {
      const balance = t.debit - t.credit;
      const isDebit = balance > 0;
      const isCredit = balance < 0;
      const absBalance = Math.abs(balance);
      return {
        ...t,
        balance: absBalance,
        isDebit,
        isCredit,
        isZero: balance === 0,
        balanceLabel: isDebit ? `الرصيد / مدين (${t.currencySymbol})` : isCredit ? `الرصيد / دائن (${t.currencySymbol})` : `الرصيد (${t.currencySymbol})`
      };
    });
  }, [totals]);

  const usdTotal = totals.find(t => t.currencyCode === 'USD');
  const sypTotal = totals.find(t => t.currencyCode === 'SYP');

  return (
    <div className={cn("w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg", className)} dir="rtl">
      <table className="w-full text-right border-collapse" aria-label="ملخص اليومية">
        <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
          <tr>
            <th scope="col" className="p-2 border-l border-slate-800">عليه / مدين ($)</th>
            <th scope="col" className="p-2 border-l border-slate-800">عليه / مدين (ل.س)</th>
            <th scope="col" className="p-2 border-l border-slate-800">له / دائن ($)</th>
            <th scope="col" className="p-2 border-l border-slate-800">له / دائن (ل.س)</th>
            {summaryItems.map(item => (
              <th key={`head-bal-${item.currencyCode}`} scope="col" className="p-2 border-l border-slate-800">
                {item.balanceLabel}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-slate-50/50 font-black tabular-nums text-slate-900">
          <tr className="divide-x divide-x-reverse divide-slate-200">
            <td className="p-3 text-lg border-l">{usdTotal?.debit.toLocaleString() || "0"}</td>
            <td className="p-3 text-lg border-l">{sypTotal?.debit.toLocaleString() || "0"}</td>
            <td className="p-3 text-lg border-l">{usdTotal?.credit.toLocaleString() || "0"}</td>
            <td className="p-3 text-lg border-l">{sypTotal?.credit.toLocaleString() || "0"}</td>
            {summaryItems.map(item => (
              <td key={`val-bal-${item.currencyCode}`} className={cn(
                "p-3 text-xl border-l",
                item.isDebit ? "text-red-600 bg-red-50/30" : item.isCredit ? "text-emerald-600 bg-emerald-50/30" : "text-slate-400"
              )}>
                {item.balance.toLocaleString()}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
