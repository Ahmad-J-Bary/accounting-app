import { cn } from "@shared/lib/utils";
import { formatCurrency } from "@shared/lib/format";
import { ArrowUpRight, ArrowDownLeft, BookOpen, Landmark, FileText } from "lucide-react";
import { ReportMeta } from "@widgets/reports";
import { AccountMovementTable } from "@modules/accounting/account-movements/components/AccountMovementTable";
import { computeClosingBalance } from "@modules/accounting/account-movements/lib/openingLines";
import type { LoadedAccountMovementsData } from "../hooks/useAccountMovementsReport";
import { StatCard } from "@widgets/stats/StatCard";

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

      <div className="grid grid-cols-5 gap-2 px-4 pt-4 pb-2">
        <StatCard label="الافتتاحي" value={formatCurrency(openingBalance, symbol)} icon={Landmark} />
        <StatCard label="المدين" value={formatCurrency(totals.debit + openingDebitTotal, symbol)} icon={ArrowUpRight} />
        <StatCard label="الدائن" value={formatCurrency(totals.credit + openingCreditTotal, symbol)} icon={ArrowDownLeft} />
        <StatCard
          label="صافي"
          value={formatCurrency(totals.debit - totals.credit, symbol)}
          icon={BookOpen}
          variant={(totals.debit - totals.credit) >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label={`الختامي / ${closing.sign}`}
          value={formatCurrency(Math.abs(closing.net), symbol)}
          icon={FileText}
          variant="accent"
        />
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
