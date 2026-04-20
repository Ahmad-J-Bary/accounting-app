import { useState } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Download, ChevronDown, ChevronLeft, Search, Edit, FileText } from "lucide-react";
import { accountsTree, Account } from "@/lib/mockData";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  asset: { label: "أصول", color: "bg-blue-50 text-blue-700" },
  liability: { label: "خصوم", color: "bg-red-50 text-red-700" },
  equity: { label: "حقوق ملكية", color: "bg-purple-50 text-purple-700" },
  revenue: { label: "إيرادات", color: "bg-green-50 text-green-700" },
  expense: { label: "مصروفات", color: "bg-amber-50 text-amber-700" },
};

function AccountNode({ account, level = 0, selected, onSelect }: { account: Account; level?: number; selected: string; onSelect: (a: Account) => void }) {
  const [open, setOpen] = useState(true);
  const hasChildren = account.children && account.children.length > 0;
  const isSelected = selected === account.id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer text-sm",
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-slate-50"
        )}
        style={{ paddingRight: `${level * 20 + 12}px` }}
        onClick={() => onSelect(account)}
      >
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="p-0.5">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        ) : <span className="w-5" />}
        <span className="text-xs tabular-nums text-muted-foreground min-w-[50px]">{account.code}</span>
        <span className="flex-1 font-medium">{account.name}</span>
        <span className={cn("text-[10px] px-2 py-0.5 rounded-full", TYPE_LABELS[account.type].color)}>
          {TYPE_LABELS[account.type].label}
        </span>
        <span className="tabular-nums text-sm min-w-[120px] text-left">{formatCurrency(account.balance)}</span>
      </div>
      {hasChildren && open && (
        <div>
          {account.children!.map((c) => (
            <AccountNode key={c.id} account={c} level={level + 1} selected={selected} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Accounting() {
  const [selected, setSelected] = useState<Account>(accountsTree[0]);

  return (
    <>
      <PageHeader
        title="دليل الحسابات"
        subtitle="إدارة شجرة الحسابات المحاسبية"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المحاسبة" }, { label: "دليل الحسابات" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير</Button>
            <Button><Plus className="w-4 h-4 ml-2" />حساب جديد</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="relative mb-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث في الحسابات..." className="pr-10" />
          </div>
          <div className="border-t border-border pt-2 max-h-[600px] overflow-y-auto">
            {accountsTree.map((a) => (
              <AccountNode key={a.id} account={a} selected={selected.id} onSelect={setSelected} />
            ))}
          </div>
        </Card>

        <Card className="p-5 h-fit">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs text-muted-foreground">رقم الحساب</div>
              <div className="font-bold text-lg tabular-nums">{selected.code}</div>
            </div>
            <Button variant="outline" size="sm"><Edit className="w-4 h-4 ml-2" />تعديل</Button>
          </div>
          <h3 className="font-bold text-xl mb-2">{selected.name}</h3>
          <span className={cn("text-xs px-2 py-1 rounded-full", TYPE_LABELS[selected.type].color)}>
            {TYPE_LABELS[selected.type].label}
          </span>

          <div className="mt-6 space-y-3">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">الرصيد الحالي</span>
              <span className="font-bold tabular-nums">{formatCurrency(selected.balance)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">الرصيد الافتتاحي</span>
              <span className="tabular-nums">{formatCurrency(selected.balance * 0.8)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">مدين</span>
              <span className="tabular-nums text-green-600">{formatCurrency(selected.balance * 1.2)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">دائن</span>
              <span className="tabular-nums text-red-600">{formatCurrency(selected.balance * 0.4)}</span>
            </div>
          </div>

          <Button variant="outline" className="w-full mt-4"><FileText className="w-4 h-4 ml-2" />عرض دفتر الأستاذ</Button>
        </Card>
      </div>
    </>
  );
}