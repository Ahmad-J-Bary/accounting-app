import { cn } from "@shared/lib/utils";
import { formatCurrency } from "@shared/lib/format";
import { ArrowUpRight, ArrowDownLeft, BookOpen, Landmark, FileText } from "lucide-react";
import { ReportMeta } from "@widgets/reports";
import { AccountMovementTable } from "@modules/accounting/account-movements/components/AccountMovementTable";
import { computeClosingBalance } from "@modules/accounting/account-movements/lib/openingLines";
import type { LoadedAccountMovementsData } from "../hooks/useAccountMovementsReport";

type AccountMovementViewProps = {
  data: LoadedAccountMovementsData;
  loading: boolean;
  search: string;
  onSearchChange: (val: string) => void;
  symbol: string;
};

export function AccountMovementView({ data, loading, search, onSearchChange, symbol }: AccountMovementViewProps) {
  const { accountName, openingBalance, openingEntry, openingBalanceDate, filteredLines, totals, openingDebitTotal, openingCreditTotal } = data;
  const closing = computeClosingBalance(totals.debit + openingDebitTotal, totals.credit + openingCreditTotal);

  return (
    <div className="flex flex-col h-full">
      <ReportMeta title="دفتر الأستاذ / كشف حركات الحساب" description="عرض تفصيلي لجميع الحركات المالية والقيود المؤثرة على حساب معين خلال فترة" />

      <div className="grid grid-cols-5 gap-3 px-4 pt-4 pb-2">
        <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <Landmark className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block">الافتتاحي</span>
            <div className="text-sm font-black text-indigo-900 tabular-nums">{formatCurrency(openingBalance, symbol)}</div>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">المدين</span>
            <div className="text-sm font-black text-slate-900 tabular-nums">{formatCurrency(totals.debit + openingDebitTotal, symbol)}</div>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
            <ArrowDownLeft className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">الدائن</span>
            <div className="text-sm font-black text-slate-900 tabular-nums">{formatCurrency(totals.credit + openingCreditTotal, symbol)}</div>
          </div>
        </div>

        <div className={cn(
          "p-3 rounded-xl border flex items-center gap-3",
          (totals.debit - totals.credit) >= 0
            ? "bg-amber-50 border-amber-100"
            : "bg-red-50 border-red-100"
        )}>
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center text-white",
            (totals.debit - totals.credit) >= 0 ? "bg-amber-600" : "bg-red-600"
          )}>
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">صافي</span>
            <div className={cn(
              "text-sm font-black tabular-nums",
              (totals.debit - totals.credit) >= 0 ? "text-amber-700" : "text-red-700"
            )}>
              {formatCurrency(totals.debit - totals.credit, symbol)}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center text-white backdrop-blur-md">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">الختامي / {closing.sign}</span>
            <div className={cn(
              "text-sm font-black tabular-nums",
              closing.sign === "مدين" ? "text-blue-300" : closing.sign === "دائن" ? "text-emerald-300" : "text-white"
            )}>
              {formatCurrency(Math.abs(closing.net), symbol)}
            </div>
          </div>
        </div>
      </div>

      <AccountMovementTable
        lines={filteredLines}
        loading={loading}
        search={search}
        onSearchChange={onSearchChange}
        accountName={accountName}
        openingBalance={openingBalance}
        openingBalanceDate={openingBalanceDate}
        openingEntry={openingEntry}
        openingDebitTotal={openingDebitTotal}
        openingCreditTotal={openingCreditTotal}
      />
    </div>
  );
}
