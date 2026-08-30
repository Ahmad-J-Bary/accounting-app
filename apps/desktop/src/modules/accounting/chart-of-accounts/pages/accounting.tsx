import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2, BookOpen } from "lucide-react";
import { buildTree, getVisibleRootTree, getErrorMessage } from "../lib/tree-utils";
import { computeTreeBalances } from "../lib/tree-balances";
import { parseSafeNumber } from "@shared/lib/parseSafeNumber";
import type { AccountTreeNode, ToggleNodeHandler } from "../lib/types";
import { AccountTreeNodeItem } from "../components/AccountTreeNodeItem";
import { AccountPanel, type AccountPanelMode } from "../components/AccountPanel";
import { HierarchicalTreeTemplate } from '@widgets/templates/HierarchicalTreeTemplate';
import { Button } from "@shared/ui/button";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { toast } from "sonner";
import { useChartOfAccountsTree } from "@shared/hooks/queries/useAccountQueries";
import { accountingService } from '@modules/accounting/api/accountingService';
import { QUERY_KEYS, CHART_MUTATION_KEYS, invalidateKeys } from "@shared/hooks/queryClient";
import { useTabs } from "@app/providers/TabContext";

const ROOT_ACCOUNT_ID = "__chart_of_accounts_root__";

export default function Accounting() {
  const queryClient = useQueryClient();
  const { openTab } = useTabs();
  const [selected, setSelected] = useState<AccountTreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery] = useState("");
  const [panelMode, setPanelMode] = useState<AccountPanelMode | null>(null);
  const [createParent, setCreateParent] = useState<AccountTreeNode | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const { data, isLoading } = useChartOfAccountsTree();

  const accounts = useMemo(() => data?.accounts ?? [], [data?.accounts]);
  const ledgerTotals = useMemo(() => data?.ledgerTotals ?? new Map(), [data?.ledgerTotals]);

  const toggleNode: ToggleNodeHandler = useCallback((id, event) => {
    event.stopPropagation();
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = new Set(accounts.map((a) => a.id));
    allIds.add(ROOT_ACCOUNT_ID);
    setExpandedNodes(allIds);
  }, [accounts]);

  const collapseAll = useCallback(() => setExpandedNodes(new Set([ROOT_ACCOUNT_ID])), []);

const tree = useMemo(() => buildTree(accounts), [accounts]);

const computedTree = useMemo(() => computeTreeBalances(tree, ledgerTotals), [tree, ledgerTotals]);

// Root balance follows the accounting formula based on direct children only:
// (Assets + Revenues) - (Liabilities + Expenses)
const rootBalance = useMemo(() => {
  let assets = 0, liabilities = 0, revenues = 0, expenses = 0;
  for (const child of computedTree) {
    const bal = parseSafeNumber(child.balance);
    switch (child.account_type) {
      case "Assets": assets += bal; break;
      case "Liabilities": liabilities += bal; break;
      case "Revenue": revenues += bal; break;
      case "Expenses": expenses += bal; break;
    }
  }
  return (assets + revenues) - (liabilities + expenses);
}, [computedTree]);

const visibleTree = useMemo(() => getVisibleRootTree(computedTree, searchQuery), [computedTree, searchQuery]);
const rootNode = useMemo<AccountTreeNode>(() => ({
  id: ROOT_ACCOUNT_ID, code: "", name_ar: "دليل الحسابات", name_en: "Chart of Accounts",
  account_type: "Assets", parent_id: null, category: "Summary", level: 0, opening_balance: "0",
  balance: String(rootBalance), notes: null, is_active: true, is_default: false, is_final: false,
  linked_customer_id: null, linked_supplier_id: null, debit: "0", credit: "0", children: visibleTree,
}), [visibleTree, rootBalance]);

  // Expand nodes and set root node as selected on initial load
  useEffect(() => {
    if (!hasLoadedOnceRef.current && accounts.length > 0) {
      hasLoadedOnceRef.current = true;
      const defaultExpanded = new Set<string>();
      defaultExpanded.add(ROOT_ACCOUNT_ID);
      for (const account of accounts) {
        if ((account.level ?? 1) <= 2) defaultExpanded.add(account.id);
      }
      setExpandedNodes(defaultExpanded);
      setSelected(rootNode);
    }
  }, [accounts, rootNode]);

  // Keep the selected account in sync with any updates from queries
  useEffect(() => {
    if (accounts.length > 0 && selected && selected.id !== ROOT_ACCOUNT_ID) {
      const updated = accounts.find((a) => a.id === selected.id);
      if (updated) {
        if (
          updated.name_ar !== selected.name_ar ||
          updated.name_en !== selected.name_en ||
          updated.code !== selected.code ||
          updated.account_type !== selected.account_type ||
          updated.parent_id !== selected.parent_id ||
          updated.opening_balance !== selected.opening_balance
        ) {
          setSelected((prev) => (prev ? { ...prev, ...updated } : null));
        }
      } else {
        setSelected(null);
        setPanelMode(null);
      }
    }
  }, [accounts, selected]);

  // Sync root node balance in selected state when rootBalance changes
  useEffect(() => {
    if (selected?.id === ROOT_ACCOUNT_ID && selected.balance !== String(rootBalance)) {
      setSelected((prev) => (prev ? { ...prev, balance: String(rootBalance) } : null));
    }
  }, [rootBalance, selected?.id, selected?.balance]);

  const isRootSelected = selected?.id === ROOT_ACCOUNT_ID;
  const canOperate = !!selected && !isRootSelected;
  const parentName = useMemo(() => {
    if (!selected?.parent_id) return null;
    return accounts.find((a) => a.id === selected.parent_id)?.name_ar ?? null;
  }, [selected, accounts]);

  const handleSelect = useCallback((node: AccountTreeNode) => {
    setSelected(node);
    setCreateParent(node);
    if (node.id === ROOT_ACCOUNT_ID) setPanelMode(null);
    else setPanelMode("view");
  }, []);

  const handleOpenNew = useCallback(() => {
    if (canOperate) {
      if (selected.is_final) {
        toast.error("لا يمكن إضافة حسابات فرعية تحت حساب نهائي (ورقة)");
        return;
      }
      setCreateParent(selected);
    } else {
      setCreateParent(null);
    }
    setPanelMode("create");
  }, [canOperate, selected]);

  const handleOpenEdit = useCallback(() => {
    if (!canOperate) return;
    setPanelMode("edit");
  }, [canOperate]);

  const handleOpenLedger = useCallback(() => {
    if (!canOperate || !selected) return;
    openTab({
      id: `ledger-${selected.id}`,
      title: `حركة: ${selected.name_ar}`,
      path: `/accounting/account-ledger/${selected.id}`,
      closable: true,
    });
  }, [canOperate, selected, openTab]);

  const handleDeleteRequest = useCallback(() => {
    if (!canOperate) return;
    setDeleteOpen(true);
  }, [canOperate]);

  const handleConfirmDelete = useCallback(async () => {
    if (!selected || isRootSelected) return;
    setDeleting(true);
    try {
      await accountingService.deleteAccount(selected.id);
      await invalidateKeys(queryClient, CHART_MUTATION_KEYS);
      toast.success("تم حذف الحساب بنجاح");
      setSelected(null);
      setPanelMode(null);
      setDeleteOpen(false);
    } catch (error) {
      toast.error(`فشلت العملية: ${getErrorMessage(error)}`);
    } finally {
      setDeleting(false);
    }
  }, [selected, isRootSelected, queryClient]);

  const handleSaved = useCallback(async () => {
    await invalidateKeys(queryClient, CHART_MUTATION_KEYS);
    setPanelMode(selected && !isRootSelected ? "view" : null);
  }, [queryClient, selected, isRootSelected]);

  // TopBar / external "add new account" entry point
  useEffect(() => {
    const handler = () => handleOpenNew();
    window.addEventListener("erp:open-new-account", handler);
    return () => window.removeEventListener("erp:open-new-account", handler);
  }, [handleOpenNew]);

  const isLoadingNow = isLoading;
  const isPanelOpen =
    panelMode !== null && (panelMode !== "view" || canOperate);
  const panelSelected = isRootSelected ? null : selected;

  return (
    <HierarchicalTreeTemplate
      title="دليل الحسابات"
      toolbar={
        <>
          <Button size="sm" onClick={handleOpenNew} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 ml-2" /> جديد
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            disabled={!canOperate}
            onClick={handleOpenEdit}
          >
            <Edit className="w-4 h-4 ml-2" /> تعديل
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            disabled={!canOperate}
            onClick={handleOpenLedger}
          >
            <BookOpen className="w-4 h-4 ml-2 text-blue-600" />
            حركة اليومية
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="bg-white border-rose-200 text-rose-700 hover:bg-rose-50"
            disabled={!canOperate}
            onClick={handleDeleteRequest}
          >
            <Trash2 className="w-4 h-4 ml-2 text-rose-600" /> حذف
          </Button>
        </>
      }
      treeHeaderActions={
        <>
          <button
            onClick={expandAll}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" /> توسيع
          </button>
          <button
            onClick={collapseAll}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors"
          >
            طي <ChevronRight className="w-3 h-3" />
          </button>
        </>
      }
      treeContent={
        <div className="space-y-1">
          {isLoadingNow ? (
             Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-50 animate-pulse rounded-lg mb-2" />
            ))
          ) : (
            <AccountTreeNodeItem
              key={rootNode.id}
              account={rootNode}
              selectedId={selected?.id || ""}
              onSelect={handleSelect}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              virtualRootId={ROOT_ACCOUNT_ID}
            />
          )}
        </div>
      }
      sidePanel={
        isPanelOpen ? (
          <AccountPanel
            mode={panelMode as AccountPanelMode}
            selected={panelSelected}
            allAccounts={accounts}
            parentName={parentName}
            parentAccount={createParent}
            onClose={() => setPanelMode(null)}
            onSaved={handleSaved}
          />
        ) : undefined
      }
      isPanelOpen={isPanelOpen}
    >
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="حذف/تعطيل الحساب"
        description={
          selected
            ? `هل تريد حذف/تعطيل الحساب «${selected.name_ar}»؟`
            : undefined
        }
        confirmLabel="حذف"
        cancelLabel="إلغاء"
        destructive
        onConfirm={() => void handleConfirmDelete()}
      />
    </HierarchicalTreeTemplate>
  );
}