import { Card } from "@/components/ui/card";
import { Package, Layers, Barcode } from "lucide-react";
import { StatCard } from "@/components/erp/shared/StatCard";

interface MaterialStatsProps {
  totalMaterials: number;
  totalCategories: number;
  materialsWithBarcode: number;
}

export function MaterialStats({ totalMaterials, totalCategories, materialsWithBarcode }: MaterialStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <StatCard 
        label="إجمالي المواد" 
        value={totalMaterials} 
        icon={<Package className="w-6 h-6 text-blue-600" />}
        iconBg="bg-blue-100"
      />
      <StatCard 
        label="إجمالي التصنيفات" 
        value={totalCategories} 
        color="text-emerald-600"
        icon={<Layers className="w-6 h-6 text-emerald-600" />}
        iconBg="bg-emerald-100"
      />
      <StatCard 
        label="مواد بباركود" 
        value={materialsWithBarcode} 
        color="text-amber-600"
        icon={<Barcode className="w-6 h-6 text-amber-600" />}
        iconBg="bg-amber-100"
      />
    </div>
  );
}
