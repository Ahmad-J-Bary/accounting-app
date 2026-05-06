import { StatCard } from '@widgets/stats/StatCard';
import { formatCurrency } from '@shared/lib/format';
import type { SupplierDto } from "@erp/shared-types";

interface SupplierStatsProps {
  suppliers: SupplierDto[];
}

export function SupplierStats({ suppliers }: SupplierStatsProps) {
  const activeCount = suppliers.filter(s => s.is_active).length;
  const totalBalance = suppliers.reduce((sum, s) => sum + parseFloat(s.balance || "0"), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
      <StatCard label="إجمالي الموردين" value={suppliers.length} />
      <StatCard label="الموردون النشطون" value={activeCount} color="text-green-600" />
      <StatCard label="إجمالي الذمم الدائنة" value={formatCurrency(totalBalance)} color="text-red-600" />
      <StatCard label="موردون بأرصدة" value={suppliers.filter(s => parseFloat(s.balance || "0") > 0).length} />
    </div>
  );
}
