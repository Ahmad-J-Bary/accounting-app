import { StatCard } from "@/components/erp/shared/StatCard";
import { formatCurrency } from "@/lib/format";
import type { CustomerDto } from "@erp/shared-types";

interface CustomerStatsProps {
  customers: CustomerDto[];
}

export function CustomerStats({ customers }: CustomerStatsProps) {
  const activeCount = customers.filter(c => c.is_active).length;
  const totalBalance = customers.reduce((s, c) => s + Number(c.balance || 0), 0);
  const zeroBalanceCount = customers.filter(c => Number(c.balance || 0) === 0).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
      <StatCard label="إجمالي العملاء" value={customers.length} />
      <StatCard label="العملاء النشطون" value={activeCount} color="text-green-600" />
      <StatCard label="إجمالي الذمم" value={formatCurrency(totalBalance)} color="text-blue-600" />
      <StatCard label="عملاء بأرصدة صفرية" value={zeroBalanceCount} />
    </div>
  );
}
