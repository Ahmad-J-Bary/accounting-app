import { Card } from "@shared/ui/card";
import { formatCurrency } from '@shared/lib/format';
import { ArrowUpRight, ArrowDownRight, LucideIcon } from "lucide-react";

interface ReceivablesPayablesCardProps {
  title: string;
  total: string | number;
  debit: string | number;
  credit: string | number;
  icon: LucideIcon;
  color: string; // e.g. "amber" or "red"
  unlinkedCount: number;
  type: "receivable" | "payable";
}

export function ReceivablesPayablesCard({
  title,
  total,
  debit,
  credit,
  color,
  unlinkedCount,
  type
}: ReceivablesPayablesCardProps) {
  const isAmber = color === "amber";
  const borderClass = isAmber ? "border-r-amber-500" : "border-r-red-500";
  const iconColorClass = isAmber ? "text-amber-600" : "text-red-600";
  const totalColorClass = isAmber ? "text-amber-600" : "text-red-600";
  const ArrowIcon = type === "receivable" ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className={`p-5 border-r-4 ${borderClass}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowIcon className={`w-5 h-5 ${iconColorClass}`} />
          <h3 className="font-semibold">{title}</h3>
        </div>
        <span className={`text-2xl font-bold ${totalColorClass}`}>
          {formatCurrency(typeof total === "string" ? parseFloat(total) : total)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="p-3 bg-slate-50 rounded-md">
          <div className="text-muted-foreground text-xs mb-1">إجمالي المدين</div>
          <div className="font-bold text-red-600">
            {formatCurrency(typeof debit === "string" ? parseFloat(debit) : debit)}
          </div>
        </div>
        <div className="p-3 bg-slate-50 rounded-md">
          <div className="text-muted-foreground text-xs mb-1">إجمالي الدائن</div>
          <div className="font-bold text-green-600">
            {formatCurrency(typeof credit === "string" ? parseFloat(credit) : credit)}
          </div>
        </div>
      </div>
      {unlinkedCount > 0 && (
        <div className={`mt-3 text-[10px] font-medium flex items-center gap-1 ${isAmber ? "text-amber-600" : "text-red-600"}`}>
          <span className="flex h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
          ⚠️ {unlinkedCount} {type === "receivable" ? "عملاء" : "موردين"} غير مرتبطين بحسابات محاسبية
        </div>
      )}
    </Card>
  );
}
