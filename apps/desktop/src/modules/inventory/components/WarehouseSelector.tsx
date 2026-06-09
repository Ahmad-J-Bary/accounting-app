import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shared/ui/select";
import { cn } from "@shared/lib/utils";
import type { WarehouseDto } from "@erp/shared-types";

interface WarehouseSelectorProps {
  warehouses: WarehouseDto[];
  value?: string;
  onValueChange: (value: string) => void;
  includeAll?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function WarehouseSelector({
  warehouses,
  value,
  onValueChange,
  includeAll = false,
  disabled = false,
  placeholder = "اختر مستودع",
  className,
}: WarehouseSelectorProps) {
  const effectiveIncludeAll = includeAll && warehouses.length > 1;

  const effectiveValue = useMemo(() => {
    if (value) return value;
    if (warehouses.length === 1) return warehouses[0].id;
    return 'all';
  }, [value, warehouses]);

  return (
    <Select dir="rtl" value={effectiveValue} onValueChange={onValueChange} disabled={disabled || warehouses.length === 0}>
      <SelectTrigger className={cn("w-[200px] bg-white border-slate-200 h-9", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent sideOffset={4} align="start">
        {effectiveIncludeAll && <SelectItem value="all">جميع المستودعات</SelectItem>}
        {warehouses.map((w) => (
          <SelectItem key={w.id} value={w.id}>
            {w.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
