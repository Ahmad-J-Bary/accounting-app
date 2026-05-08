import { StatCard } from '@widgets/stats/StatCard';
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import type { CustomerDto } from "@erp/shared-types";

interface CustomerStatsProps {
  customers: CustomerDto[];
}

export function CustomerStats({ customers }: CustomerStatsProps) {
  const { formatMonetaryAmount } = useCurrencyContext();
  const totalBalance = customers.reduce((s, c) => s + Number(c.balance || 0), 0);
  const zeroBalanceCount = customers.filter(c => Number(c.balance || 0) === 0).length;
  const withBalanceCount = customers.length - zeroBalanceCount;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
      <StatCard label="إجمالي العملاء" value={customers.length} />
      <StatCard label="عملاء بأرصدة" value={withBalanceCount} color="text-green-600" />
      <StatCard label="إجمالي الذمم" value={formatMonetaryAmount(totalBalance, "base")} color="text-blue-600" />
      <StatCard label="أرصدة صفرية" value={zeroBalanceCount} />
    </div>
  );
}
