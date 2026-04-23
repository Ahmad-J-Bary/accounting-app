import { useState, useEffect, useMemo, useCallback } from "react";

import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Download, Search, RefreshCw, Folder } from "lucide-react";
import { accountingService } from "@/services/accountingService";
import type { AccountDto } from "@erp/shared-types";
import { AccountDialog } from "@/components/erp/AccountDialog";
import {
  buildTree,
  getVisibleRootTree,
  getErrorMessage,
} from "./accounting/tree-utils";
import type { AccountTreeNode, ToggleNodeHandler } from "./accounting/types";
import { AccountTreeNodeItem } from "./accounting/AccountTreeNodeItem";
import { AccountDetailsSidebar } from "./accounting/AccountDetailsSidebar";
import { cn } from "@/lib/utils";

export default function Accounting() {
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

  const parentName = useMemo(() => {
    if (!selected?.parent_id) return null;
    const parent = accounts.find((a) => a.id === selected.parent_id);
    return parent?.name_ar ?? null;
  }, [selected, accounts]);

  const handleCreateNew = useCallback(() => {
    setEditingAccount(null);
    setParentAccountForNew(selected ?? null);
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

    if (!window.confirm(`هل تريد حذف/تعطيل الحساب "${selected.name_ar}"؟`)) {
      return;
    }

    try {
      setLoading(true);
      await accountingService.deleteAccount(selected.id);
      await load();
    } catch (error: unknown) {
      console.error(error);
      window.alert(`فشلت العملية: ${getErrorMessage(error)}`);
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
          <Button variant="outline">
            <Download className="w-4 h-4 ml-2" />
            تصدير الدليل
          </Button>
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
                  إضافة حساب
                </Button>
              </div>
            ) : (
              visibleTree.map((account) => (
                <AccountTreeNodeItem
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

        <AccountDetailsSidebar
          selected={selected}
          parentName={parentName}
          onCreateNew={handleCreateNew}
          onEdit={handleEdit}
          onDelete={() => void handleDelete()}
        />
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
