import { formatCurrency } from "@shared/lib/format";
import { ArrowUpRight, ArrowDownLeft, Landmark, FileText } from "lucide-react";
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
  const { accountName, openingBalance, openingEntry, openingEntries, openingBalanceDate, filteredLines, totals, openingDebitTotal, openingCreditTotal } = data;
  const closing = computeClosingBalance(totals.debit + openingDebitTotal, totals.credit + openingCreditTotal);
  const openingClosing = computeClosingBalance(openingDebitTotal, openingCreditTotal);

  return (
    <div className="flex flex-col h-full">
      <ReportMeta title="دفتر الأستاذ / كشف حركات الحساب" description="عرض تفصيلي لجميع الحركات المالية والقيود المؤثرة على حساب معين خلال فترة" />

      <div className="grid grid-cols-4 gap-2 px-4 pt-4 pb-2">
        <StatCard label="افتتاحي / مدين" value={formatCurrency(openingDebitTotal, symbol)} icon={ArrowUpRight} />
        <StatCard label="افتتاحي / دائن" value={formatCurrency(openingCreditTotal, symbol)} icon={ArrowDownLeft} />
        <StatCard
          label={`صافي الافتتاحي / ${openingClosing.sign}`}
          value={formatCurrency(Math.abs(openingClosing.net), symbol)}
          icon={Landmark}
          variant={openingClosing.net >= 0 ? "positive" : "negative"}
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
        openingEntries={openingEntries}
        openingDebitTotal={openingDebitTotal}
        openingCreditTotal={openingCreditTotal}
      />
    </div>
  );
}
