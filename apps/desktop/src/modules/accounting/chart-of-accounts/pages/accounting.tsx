import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildTree, getVisibleRootTree, getErrorMessage } from "../lib/tree-utils";
import { parseSafeNumber } from "@shared/lib/parseSafeNumber";
import type { AccountTreeNode, ToggleNodeHandler } from "../lib/types";
import { AccountTreeNodeItem } from "../components/AccountTreeNodeItem";
import { AccountDetailsSidebar } from "../components/AccountDetailsSidebar";
import { HierarchicalTreeTemplate } from '@widgets/templates/HierarchicalTreeTemplate';
import { toast } from "sonner";
import { useChartOfAccountsTree } from "@shared/hooks/queries/useAccountQueries";
import { accountingService } from '@modules/accounting/api/accountingService';
import { QUERY_KEYS } from "@shared/hooks/queryClient";

const ROOT_ACCOUNT_ID = "__chart_of_accounts_root__";

// Compute balances from actual general ledger totals, then propagate up the tree
// so every parent's balance = sum of its direct children's balances.
function computeTreeBalances(nodes: AccountTreeNode[], ltMap: Map<string, { debit: number; credit: number }>): AccountTreeNode[] {
  return nodes.map(node => {
    const lt = ltMap.get(node.id);
    const ownBalance = lt ? lt.debit - lt.credit : 0;
    if (!node.children?.length) {
      return { ...node, balance: String(ownBalance) };
    }
    const computedChildren = computeTreeBalances(node.children, ltMap);
    const childrenSum = computedChildren.reduce((sum, child) => sum + parseSafeNumber(child.balance), 0);
    return { ...node, balance: String(childrenSum), children: computedChildren };
  });
}

export default function Accounting() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<AccountTreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery] = useState("");
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
  const parentName = useMemo(() => {
    if (!selected?.parent_id) return null;
    return accounts.find((a) => a.id === selected.parent_id)?.name_ar ?? null;
  }, [selected, accounts]);

  const handleDelete = useCallback(async () => {
    if (!selected || isRootSelected) return;
    if (!window.confirm(`هل تريد حذف/تعطيل الحساب "${selected.name_ar}"؟`)) return;
    try {
      await accountingService.deleteAccount(selected.id);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chartOfAccounts });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chartOfAccountsTree });
      toast.success("تم حذف الحساب بنجاح");
    } catch (error) { toast.error(`فشلت العملية: ${getErrorMessage(error)}`); }
  }, [selected, isRootSelected, queryClient]);

  const isLoadingNow = isLoading;

  return (
    <HierarchicalTreeTemplate
      title="دليل الحسابات"
      toolbar={<></>}
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
      treeSidebar={
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
              onSelect={setSelected}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              virtualRootId={ROOT_ACCOUNT_ID}
            />
          )}
        </div>
      }
      detailContent={
        <AccountDetailsSidebar
          selected={isRootSelected ? null : selected}
          allAccounts={accounts}
          parentName={parentName}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chartOfAccounts });
            await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.chartOfAccountsTree });
          }}
          onDelete={() => void handleDelete()}
          canEdit={!isRootSelected && !!selected}
          canDelete={!isRootSelected && !!selected}
        />
      }
    />
  );
}

