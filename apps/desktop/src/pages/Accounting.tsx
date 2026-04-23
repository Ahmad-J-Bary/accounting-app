import { useState, useEffect } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Download, ChevronDown, ChevronLeft, Search, Edit, FileText, RefreshCw, Folder, File } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { accountingService } from "@/services/accountingService";
import type { AccountDto } from "@erp/shared-types";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  Assets: { label: "أصول", color: "bg-blue-50 text-blue-700 border-blue-200" },
  Liabilities: { label: "خصوم", color: "bg-red-50 text-red-700 border-red-200" },
  Equity: { label: "حقوق ملكية", color: "bg-purple-50 text-purple-700 border-purple-200" },
  Revenue: { label: "إيرادات", color: "bg-green-50 text-green-700 border-green-200" },
  Expenses: { label: "مصروفات", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

interface AccountTreeNode extends AccountDto {
  children?: AccountTreeNode[];
}

function buildTree(accounts: AccountDto[]): AccountTreeNode[] {
  const map = new Map<string, AccountTreeNode>();
  const roots: AccountTreeNode[] = [];

  // Sort by code first to ensure correct order
  const sortedAccounts = [...accounts].sort((a, b) => a.code.localeCompare(b.code));

  sortedAccounts.forEach(a => map.set(a.id, { ...a, children: [] }));

  sortedAccounts.forEach(a => {
    if (a.parent_id && map.has(a.parent_id)) {
      map.get(a.parent_id)!.children!.push(map.get(a.id)!);
    } else {
      roots.push(map.get(a.id)!);
    }
  });

  return roots;
}

function AccountNode({ account, level = 0, selectedId, onSelect, expandedNodes, toggleNode }: { 
  account: AccountTreeNode; 
  level?: number; 
  selectedId: string; 
  onSelect: (a: AccountTreeNode) => void;
  expandedNodes: Set<string>;
  toggleNode: (id: string, e: React.MouseEvent) => void;
}) {
  const isExpanded = expandedNodes.has(account.id);
  const hasChildren = account.children && account.children.length > 0;
  const isSelected = selectedId === account.id;
  const isSummary = account.category === "Summary";

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 border-b border-border/40 cursor-pointer transition-colors hover:bg-slate-50",
          isSelected && "bg-primary/5 border-l-2 border-l-primary",
          isSummary ? "font-bold text-slate-800" : "text-sm text-slate-600"
        )}
        style={{ paddingRight: `${level * 24 + 12}px` }}
        onClick={() => onSelect(account)}
      >
        <div className="flex items-center gap-1 w-[40px]">
          {hasChildren ? (
            <button onClick={(e) => toggleNode(account.id, e)} className="p-1 hover:bg-slate-200 rounded text-slate-500">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          ) : <span className="w-6" />}
        </div>
        
        <div className="flex items-center gap-2 flex-1">
          {isSummary ? <Folder className="w-4 h-4 text-slate-400" /> : <File className="w-4 h-4 text-slate-300" />}
          <span className="tabular-nums min-w-[60px]">{account.code}</span>
          <span>{account.name_ar}</span>
        </div>

        <div className="w-[100px] text-xs">
           {isSummary ? (
             <span className="text-slate-400">تجميعي</span>
           ) : (
             <span className="text-slate-500">فرعي</span>
           )}
        </div>

        <div className="w-[120px]">
          <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", TYPE_LABELS[account.account_type]?.color || "")}>
            {TYPE_LABELS[account.account_type]?.label || account.account_type}
          </span>
        </div>

        <div className="w-[120px] text-left tabular-nums">
          {formatCurrency(parseFloat(account.balance))}
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div>
          {account.children!.map((c) => (
            <AccountNode 
              key={c.id} 
              account={c} 
              level={level + 1} 
              selectedId={selectedId} 
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
            />
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
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await accountingService.getChartOfAccounts();
      setAccounts(data);
      
      // Expand level 1 and 2 by default
      const defaultExpanded = new Set<string>();
      data.forEach(a => {
        if ((a as any).level <= 2) {
          defaultExpanded.add(a.id);
        }
      });
      setExpandedNodes(defaultExpanded);

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

  const toggleNode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedNodes);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedNodes(next);
  };

  const expandAll = () => {
    setExpandedNodes(new Set(accounts.map(a => a.id)));
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const filteredAccounts = accounts.filter(a => 
    a.name_ar.includes(searchQuery) || 
    a.code.includes(searchQuery) ||
    a.name_en?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If searching, we show a flat list or expand relevant nodes. For simplicity, if there's a search query, just build a tree from the filtered ones or expand all.
  // Actually, better approach for search: Expand all nodes that contain matches.
  useEffect(() => {
    if (searchQuery.length > 0) {
      const matchingIds = new Set<string>();
      accounts.forEach(a => {
        if (a.name_ar.includes(searchQuery) || a.code.includes(searchQuery)) {
          // Add parent ids to expand them
          let currentParent = a.parent_id;
          while (currentParent) {
            matchingIds.add(currentParent);
            const p = accounts.find(acc => acc.id === currentParent);
            currentParent = p?.parent_id;
          }
        }
      });
      setExpandedNodes(prev => new Set([...prev, ...matchingIds]));
    }
  }, [searchQuery, accounts]);

  const tree = buildTree(accounts);

  return (
    <>
      <PageHeader
        title="دليل الحسابات"
        subtitle="إدارة شجرة الحسابات المحاسبية للشركة"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المحاسبة" }, { label: "دليل الحسابات" }]}
        actions={
          <>
            <Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير الدليل</Button>
            <Button><Plus className="w-4 h-4 ml-2" />حساب جديد</Button>
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 flex flex-col h-[calc(100vh-220px)] overflow-hidden border-border/60 shadow-sm">
          <div className="p-4 border-b border-border/40 bg-slate-50/50 flex items-center justify-between gap-4">
            <div className="relative w-72">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="بحث بالاسم أو الرقم..." 
                className="pr-9 bg-white" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-8">توسيع الكل</Button>
              <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-8">طي الكل</Button>
              <Button variant="outline" size="icon" className="h-8 w-8 bg-white" onClick={load} disabled={loading}>
                <RefreshCw className={cn("w-4 h-4 text-slate-600", loading && "animate-spin")} />
              </Button>
            </div>
          </div>
          
          <div className="flex text-xs font-semibold text-slate-500 bg-slate-100 py-2 px-3 border-b border-border/40">
            <div className="w-[40px]"></div>
            <div className="flex-1">اسم الحساب / الرقم</div>
            <div className="w-[100px]">النوع</div>
            <div className="w-[120px]">التصنيف</div>
            <div className="w-[120px] text-left">الرصيد</div>
          </div>

          <div className="flex-1 overflow-y-auto p-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <p>جاري تحميل دليل الحسابات...</p>
              </div>
            ) : tree.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <Folder className="w-12 h-12 text-slate-200" />
                <p>لا توجد حسابات مضافة</p>
                <Button variant="outline" size="sm" className="mt-2"><Plus className="w-4 h-4 ml-2" />إضافة حساب رئيسي</Button>
              </div>
            ) : (
              tree.map((a) => (
                <div key={a.id} className={cn(searchQuery && !a.name_ar.includes(searchQuery) && !a.code.includes(searchQuery) && !a.children?.some(c => JSON.stringify(c).includes(searchQuery)) && "hidden")}>
                  <AccountNode 
                    account={a} 
                    selectedId={selected?.id || ""} 
                    onSelect={setSelected}
                    expandedNodes={expandedNodes}
                    toggleNode={toggleNode}
                  />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-6 h-fit border-border/60 shadow-sm flex flex-col gap-6 sticky top-6">
          {selected ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      رقم الحساب
                    </span>
                    <span className="text-xs text-slate-400">مستوى {selected.level || 1}</span>
                  </div>
                  <div className="font-bold text-2xl tabular-nums text-primary">{selected.code}</div>
                </div>
                <Button variant="outline" size="sm" className="h-8"><Edit className="w-3.5 h-3.5 ml-1.5" />تعديل</Button>
              </div>
              
              <div>
                <h3 className="font-bold text-xl text-slate-800">{selected.name_ar}</h3>
                <h4 className="text-sm text-slate-500 font-medium mb-3">{selected.name_en}</h4>
                <div className="flex gap-2">
                  <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium border", TYPE_LABELS[selected.account_type]?.color)}>
                    {TYPE_LABELS[selected.account_type]?.label || selected.account_type}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    {selected.category === 'Summary' ? 'حساب رئيسي (تجميعي)' : 'حساب فرعي'}
                  </span>
                </div>
              </div>

              <div className="space-y-4 bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200 border-dashed">
                  <span className="text-sm text-slate-500">الرصيد الافتتاحي</span>
                  <span className="font-medium tabular-nums">{formatCurrency(parseFloat((selected as any).opening_balance || '0'))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">الرصيد الحالي</span>
                  <span className={cn(
                    "font-bold text-lg tabular-nums",
                    parseFloat(selected.balance) > 0 ? "text-emerald-600" : parseFloat(selected.balance) < 0 ? "text-red-600" : "text-slate-700"
                  )}>
                    {formatCurrency(parseFloat(selected.balance))}
                  </span>
                </div>
              </div>

              {selected.notes && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 mb-1">ملاحظات</h4>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-100">{selected.notes}</p>
                </div>
              )}

              {selected.category === 'Detail' && (
                <Button className="w-full shadow-sm"><FileText className="w-4 h-4 ml-2" />عرض كشف الحساب (دفتر الأستاذ)</Button>
              )}
              {selected.category === 'Summary' && (
                <Button variant="secondary" className="w-full shadow-sm bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"><Plus className="w-4 h-4 ml-2" />إضافة حساب فرعي جديد</Button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-4">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                <FileText className="w-8 h-8 text-slate-300" />
              </div>
              <p>يرجى اختيار حساب من الشجرة لعرض تفاصيله</p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}