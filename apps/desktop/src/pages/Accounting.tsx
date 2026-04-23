import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Download,
  ChevronDown,
  ChevronLeft,
  Search,
  Edit,
  FileText,
  RefreshCw,
  Folder,
  File,
  ShieldCheck,
  Lock,
  Activity,
  History,
  Trash2,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { accountingService } from "@/services/accountingService";
import type { AccountDto } from "@erp/shared-types";
import { AccountDialog } from "@/components/erp/AccountDialog";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  Assets: { label: "أصول", color: "bg-blue-50 text-blue-700 border-blue-200" },
  Liabilities: {
    label: "خصوم",
    color: "bg-red-50 text-red-700 border-red-200",
  },
  Equity: {
    label: "حقوق ملكية",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  Revenue: {
    label: "إيرادات",
    color: "bg-green-50 text-green-700 border-green-200",
  },
  Expenses: {
    label: "مصروفات",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

interface AccountTreeNode extends AccountDto {
  children: AccountTreeNode[];
}

type ToggleNodeHandler = (id: string, event: React.MouseEvent) => void;

const isSummaryAccount = (account: Pick<AccountDto, "category">): boolean =>
  account.category === "Summary";

const parseAmount = (value: string | number | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

function buildTree(accounts: AccountDto[]): AccountTreeNode[] {
  const map = new Map<string, AccountTreeNode>();
  const roots: AccountTreeNode[] = [];

  const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code));

  for (const account of sorted) {
    map.set(account.id, { ...account, children: [] });
  }

  for (const account of sorted) {
    const node = map.get(account.id);
    if (!node) continue;

    if (account.parent_id && map.has(account.parent_id)) {
      map.get(account.parent_id)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function getVisibleRootTree(
  roots: AccountTreeNode[],
  query: string,
): AccountTreeNode[] {
  const q = query.trim();
  if (!q) return roots;

  const includesQuery = (a: Pick<AccountDto, "name_ar" | "code">): boolean =>
    a.name_ar.includes(q) || a.code.includes(q);

  const hasMatchingDescendant = (node: AccountTreeNode): boolean =>
    node.children.some(
      (child) => includesQuery(child) || hasMatchingDescendant(child),
    );

  return roots.filter(
    (node) => includesQuery(node) || hasMatchingDescendant(node),
  );
}

interface AccountNodeProps {
  account: AccountTreeNode;
  level?: number;
  selectedId: string;
  onSelect: (account: AccountTreeNode) => void;
  expandedNodes: Set<string>;
  toggleNode: ToggleNodeHandler;
}

function AccountNode({
  account,
  level = 0,
  selectedId,
  onSelect,
  expandedNodes,
  toggleNode,
}: AccountNodeProps) {
  const isExpanded = expandedNodes.has(account.id);
  const hasChildren = account.children.length > 0;
  const isSelected = selectedId === account.id;
  const isSummary = isSummaryAccount(account);

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 border-b border-border/40 cursor-pointer transition-colors hover:bg-slate-50",
          isSelected && "bg-primary/5 border-l-2 border-l-primary",
          isSummary ? "font-bold text-slate-800" : "text-sm text-slate-600",
        )}
        style={{ paddingRight: `${level * 24 + 12}px` }}
        onClick={() => onSelect(account)}
      >
        <div className="flex items-center gap-1 w-[40px]">
          {hasChildren ? (
            <button
              onClick={(event) => toggleNode(account.id, event)}
              className="p-1 hover:bg-slate-200 rounded text-slate-500"
              type="button"
              aria-label={isExpanded ? "طي العقدة" : "توسيع العقدة"}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-6" />
          )}
        </div>

        <div className="flex items-center gap-2 flex-1">
          {isSummary ? (
            <Folder className="w-4 h-4 text-slate-400" />
          ) : (
            <File className="w-4 h-4 text-slate-300" />
          )}
          <span className="tabular-nums min-w-[60px]">{account.code}</span>
          <span className="flex-1">{account.name_ar}</span>

          {account.is_default && (
            <span className="inline-flex" aria-label="حساب افتراضي">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500 ml-1" />
            </span>
          )}

          {!account.is_active && (
            <span className="inline-flex" aria-label="حساب معطل">
              <Lock className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </span>
          )}
        </div>

        <div className="w-[100px] text-xs">
          {isSummary ? (
            <span className="text-slate-400">تجميعي</span>
          ) : (
            <span className="text-slate-500">فرعي</span>
          )}
        </div>

        <div className="w-[120px]">
          <span
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full border",
              TYPE_LABELS[account.account_type]?.color || "",
            )}
          >
            {TYPE_LABELS[account.account_type]?.label || account.account_type}
          </span>
        </div>

        <div className="w-[120px] text-left tabular-nums">
          {formatCurrency(parseAmount(account.balance))}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {account.children.map((child) => (
            <AccountNode
              key={child.id}
              account={child}
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

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim().length > 0) return error;
  return "حدث خطأ غير متوقع";
};

export default function Accounting() {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AccountTreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountDto | null>(null);
  const [parentAccountForNew, setParentAccountForNew] =
    useState<AccountDto | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await accountingService.getChartOfAccounts();
      setAccounts(data);

      const defaultExpanded = new Set<string>();
      for (const account of data) {
        if ((account.level ?? 1) <= 2) defaultExpanded.add(account.id);
      }
      setExpandedNodes(defaultExpanded);

      setSelected((prev) => {
        if (prev) {
          const updated = data.find((a) => a.id === prev.id);
          return updated ? { ...updated, children: [] } : null;
        }

        if (data.length === 0) return null;
        return { ...data[0], children: [] };
      });
    } catch (error: unknown) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleNode: ToggleNodeHandler = useCallback((id, event) => {
    event.stopPropagation();
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedNodes(new Set(accounts.map((a) => a.id)));
  }, [accounts]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;

    const matchingAncestors = new Set<string>();

    for (const account of accounts) {
      if (account.name_ar.includes(q) || account.code.includes(q)) {
        let currentParent = account.parent_id;
        while (currentParent) {
          matchingAncestors.add(currentParent);
          const parent = accounts.find((a) => a.id === currentParent);
          currentParent = parent?.parent_id ?? null;
        }
      }
    }

    if (matchingAncestors.size > 0) {
      setExpandedNodes((prev) => new Set([...prev, ...matchingAncestors]));
    }
  }, [searchQuery, accounts]);

  const tree = useMemo(() => buildTree(accounts), [accounts]);
  const visibleTree = useMemo(
    () => getVisibleRootTree(tree, searchQuery),
    [tree, searchQuery],
  );

  const handleCreateNew = useCallback(() => {
    setEditingAccount(null);
    setParentAccountForNew(null);
    setIsDialogOpen(true);
  }, []);

  const handleCreateSubAccount = useCallback(() => {
    if (!selected) return;
    setEditingAccount(null);
    setParentAccountForNew(selected);
    setIsDialogOpen(true);
  }, [selected]);

  const handleEdit = useCallback(() => {
    if (!selected) return;
    setEditingAccount(selected);
    setParentAccountForNew(null);
    setIsDialogOpen(true);
  }, [selected]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;

    if (selected.is_default) {
      window.alert("لا يمكن حذف حسابات النظام الافتراضية");
      return;
    }

    if (
      !window.confirm(
        `هل أنت متأكد من حذف الحساب "${selected.name_ar}"؟ لا يمكن التراجع عن هذه العملية.`,
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      await accountingService.deleteAccount(selected.id);
      setSelected(null);
      await load();
    } catch (error: unknown) {
      console.error(error);
      window.alert(`فشل الحذف: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [selected, load]);

  return (
    <>
      <PageHeader
        title="دليل الحسابات"
        subtitle="إدارة شجرة الحسابات المحاسبية للشركة"
        breadcrumbs={[
          { label: "الرئيسية", to: "/dashboard" },
          { label: "المحاسبة" },
          { label: "دليل الحسابات" },
        ]}
        actions={
          <>
            <Button variant="outline">
              <Download className="w-4 h-4 ml-2" />
              تصدير الدليل
            </Button>
            <Button onClick={handleCreateNew}>
              <Plus className="w-4 h-4 ml-2" />
              حساب رئيسي جديد
            </Button>
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
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={expandAll}
                className="text-xs h-8"
              >
                توسيع الكل
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={collapseAll}
                className="text-xs h-8"
              >
                طي الكل
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-white"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw
                  className={cn(
                    "w-4 h-4 text-slate-600",
                    loading && "animate-spin",
                  )}
                />
              </Button>
            </div>
          </div>

          <div className="flex text-xs font-semibold text-slate-500 bg-slate-100 py-2 px-3 border-b border-border/40">
            <div className="w-[40px]" />
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
            ) : visibleTree.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <Folder className="w-12 h-12 text-slate-200" />
                <p>لا توجد حسابات مضافة</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleCreateNew}
                >
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة حساب رئيسي
                </Button>
              </div>
            ) : (
              visibleTree.map((account) => (
                <AccountNode
                  key={account.id}
                  account={account}
                  selectedId={selected?.id || ""}
                  onSelect={setSelected}
                  expandedNodes={expandedNodes}
                  toggleNode={toggleNode}
                />
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
                    <span className="text-xs text-slate-400">
                      مستوى {selected.level || 1}
                    </span>
                  </div>
                  <div className="font-bold text-2xl tabular-nums text-primary">
                    {selected.code}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={handleEdit}
                  >
                    <Edit className="w-3.5 h-3.5 ml-1.5" />
                    تعديل
                  </Button>

                  {!selected.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100"
                      onClick={() => void handleDelete()}
                    >
                      <Trash2 className="w-3.5 h-3.5 ml-1.5" />
                      حذف
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-xl text-slate-800">
                  {selected.name_ar}
                </h3>
                <h4 className="text-sm text-slate-500 font-medium mb-3">
                  {selected.name_en}
                </h4>

                <div className="flex gap-2">
                  <span
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-medium border",
                      TYPE_LABELS[selected.account_type]?.color,
                    )}
                  >
                    {TYPE_LABELS[selected.account_type]?.label ||
                      selected.account_type}
                  </span>

                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    {selected.category === "Summary"
                      ? "حساب رئيسي (تجميعي)"
                      : "حساب فرعي"}
                  </span>

                  {selected.is_default && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-100 flex items-center">
                      <ShieldCheck className="w-3 h-3 ml-1" />
                      حساب افتراضي
                    </span>
                  )}

                  {!selected.is_active && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-500 border border-slate-200 flex items-center">
                      <Lock className="w-3 h-3 ml-1" />
                      معطل
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-4 bg-slate-50 rounded-lg p-4 border border-slate-100">
                <div className="flex justify-between items-center pb-3 border-b border-slate-200 border-dashed">
                  <span className="text-sm text-slate-500">
                    الرصيد الافتتاحي
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(parseAmount(selected.opening_balance))}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">
                    الرصيد الحالي
                  </span>
                  <span
                    className={cn(
                      "font-bold text-lg tabular-nums",
                      parseAmount(selected.balance) > 0
                        ? "text-emerald-600"
                        : parseAmount(selected.balance) < 0
                          ? "text-red-600"
                          : "text-slate-700",
                    )}
                  >
                    {formatCurrency(parseAmount(selected.balance))}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white border border-slate-100 rounded flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase">
                    <History className="w-3 h-3" />
                    آخر حركة
                  </div>
                  <div className="text-xs font-medium text-slate-600">--</div>
                </div>

                <div className="p-3 bg-white border border-slate-100 rounded flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold uppercase">
                    <Activity className="w-3 h-3" />
                    نشاط الشهر
                  </div>
                  <div className="text-xs font-medium text-slate-600">--</div>
                </div>
              </div>

              {selected.notes && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 mb-1">
                    ملاحظات
                  </h4>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-100">
                    {selected.notes}
                  </p>
                </div>
              )}

              {selected.category === "Detail" && (
                <Button
                  className="w-full shadow-sm"
                  onClick={() => navigate(`/journal?accountId=${selected.id}`)}
                >
                  <FileText className="w-4 h-4 ml-2" />
                  عرض كشف الحساب (دفتر الأستاذ)
                </Button>
              )}

              {selected.category === "Summary" && (
                <Button
                  variant="secondary"
                  className="w-full shadow-sm bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                  onClick={handleCreateSubAccount}
                >
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة حساب فرعي جديد
                </Button>
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

      <AccountDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSaved={() => void load()}
        initialData={editingAccount}
        parentAccount={parentAccountForNew}
        allAccounts={accounts}
      />
    </>
  );
}
