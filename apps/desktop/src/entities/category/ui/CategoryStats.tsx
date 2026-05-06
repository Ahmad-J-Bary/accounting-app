import { Card } from "@/components/ui/card";
import { Folders, Package, Shuffle } from "lucide-react";
import type { CategoryDto, MaterialDto } from "@erp/shared-types";

interface CategoryStatsProps {
  categories: CategoryDto[];
  materials: MaterialDto[];
}

export function CategoryStats({ categories, materials }: CategoryStatsProps) {
  const normalCatsCount = categories.filter(c => !c.is_hybrid).length;
  const hybridCatsCount = categories.filter(c => c.is_hybrid).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <Card className="p-4 flex items-center gap-4 bg-slate-50/50">
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
          <Folders className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums">{normalCatsCount}</div>
          <div className="text-xs text-muted-foreground">التصنيفات العادية</div>
        </div>
      </Card>
      
      <Card className="p-4 flex items-center gap-4 bg-slate-50/50">
        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
          <Shuffle className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums text-purple-600">{hybridCatsCount}</div>
          <div className="text-xs text-muted-foreground">التصنيفات الهجينة</div>
        </div>
      </Card>
      
      <Card className="p-4 flex items-center gap-4 bg-slate-50/50">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <Package className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums text-emerald-600">{materials.length}</div>
          <div className="text-xs text-muted-foreground">إجمالي المواد</div>
        </div>
      </Card>
    </div>
  );
}
