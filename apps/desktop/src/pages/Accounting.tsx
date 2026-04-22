import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Download, ChevronDown, ChevronLeft, Search, Edit, FileText, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { accountingService } from "@/services/accountingService";
import type { AccountDto } from "@erp/shared-types";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  Assets: { label: "أصول", color: "bg-blue-50 text-blue-700" },
  Liabilities: { label: "خصوم", color: "bg-red-50 text-red-700" },
  Equity: { label: "حقوق ملكية", color: "bg-purple-50 text-purple-700" },
  Revenue: { label: "إيرادات", color: "bg-green-50 text-green-700" },
  Expenses: { label: "مصروفات", color: "bg-amber-50 text-amber-700" },
};

interface AccountTreeNode extends AccountDto {
  children?: AccountTreeNode[];
}

function buildTree(accounts: AccountDto[]): AccountTreeNode[] {
  const map = new Map<string, AccountTreeNode>();
  const roots: AccountTreeNode[] = [];

  accounts.forEach(a => map.set(a.id, { ...a, children: [] }));

  accounts.forEach(a => {
    if (a.parent_id && map.has(a.parent_id)) {
      map.get(a.parent_id)!.children!.push(map.get(a.id)!);
    } else {
      roots.push(map.get(a.id)!);
    }
  });

  return roots;
}

function AccountNode({ account, level = 0, selectedId, onSelect }: { account: AccountTreeNode; level?: number; selectedId: string; onSelect: (a: AccountTreeNode) => void }) {
  const [open, setOpen] = useState(true);
  const hasChildren = account.children && account.children.length > 0;
  const isSelected = selectedId === account.id;

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
        <span className="flex-1 font-medium">{account.name_ar}</span>
        <span className={cn("text-[10px] px-2 py-0.5 rounded-full", TYPE_LABELS[account.account_type]?.color || "")}>
          {TYPE_LABELS[account.account_type]?.label || account.account_type}
        </span>
        <span className="tabular-nums text-sm min-w-[120px] text-left">{formatCurrency(parseFloat(account.balance))}</span>
      </div>
      {hasChildren && open && (
        <div>
          {account.children!.map((c) => (
            <AccountNode key={c.id} account={c} level={level + 1} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Accounting() {
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AccountTreeNode | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await accountingService.getChartOfAccounts();
      setAccounts(data);
      if (data.length > 0 && !selected) {
        setSelected({ ...data[0], children: [] });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tree = buildTree(accounts);

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
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="بحث في الحسابات..." className="pr-10" />
            </div>
            <Button variant="outline" size="icon" onClick={load} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
          <div className="border-t border-border pt-2 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">جاري التحميل...</div>
            ) : tree.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">لا توجد حسابات مضافة</div>
            ) : (
              tree.map((a) => (
                <AccountNode key={a.id} account={a} selectedId={selected?.id || ""} onSelect={setSelected} />
              ))
            )}
          </div>
        </Card>

        <Card className="p-5 h-fit">
          {selected ? (
            <>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-xs text-muted-foreground">رقم الحساب</div>
                  <div className="font-bold text-lg tabular-nums">{selected.code}</div>
                </div>
                <Button variant="outline" size="sm"><Edit className="w-4 h-4 ml-2" />تعديل</Button>
              </div>
              <h3 className="font-bold text-xl mb-2">{selected.name_ar}</h3>
              <span className={cn("text-xs px-2 py-1 rounded-full", TYPE_LABELS[selected.account_type]?.color)}>
                {TYPE_LABELS[selected.account_type]?.label || selected.account_type}
              </span>

              <div className="mt-6 space-y-3">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">الرصيد الحالي</span>
                  <span className="font-bold tabular-nums">{formatCurrency(parseFloat(selected.balance))}</span>
                </div>
              </div>

              <Button variant="outline" className="w-full mt-4"><FileText className="w-4 h-4 ml-2" />عرض دفتر الأستاذ</Button>
            </>
          ) : (
            <div className="text-center py-10 text-muted-foreground">اختر حساباً لعرض التفاصيل</div>
          )}
        </Card>
      </div>
    </>
  );
}