import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Download, RefreshCw, Folder, Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { accountingService } from '@modules/accounting/api/accountingService';
import { journalEntryService } from '@modules/accounting/api/journalEntryService';
import { materialService } from '@modules/inventory/api/materialService';
import { invoiceService } from '@modules/invoicing/api/invoiceService';
import { returnService } from '@modules/invoicing/api/returnService';
import type { AccountDto, MaterialDto } from "@erp/shared-types";
import { buildTree, getVisibleRootTree, getErrorMessage, parseAmount } from "./accounting/tree-utils";
import type { AccountTreeNode, ToggleNodeHandler } from "./accounting/types";
import { AccountTreeNodeItem } from "./accounting/AccountTreeNodeItem";
import { AccountDetailsSidebar } from "./accounting/AccountDetailsSidebar";
import { HierarchicalTreeTemplate } from '@widgets/templates/HierarchicalTreeTemplate';
import { Input } from "@shared/ui/input";
import { toast } from "sonner";

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
    const childrenSum = computedChildren.reduce((sum, child) => sum + parseAmount(child.balance), 0);
    return { ...node, balance: String(childrenSum), children: computedChildren };
  });
}

export default function Accounting() {
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [ledgerTotals, setLedgerTotals] = useState<Map<string, { debit: number; credit: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<AccountTreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      
      const [data, entries] = await Promise.all([
        accountingService.getChartOfAccounts(),
        journalEntryService.listJournalEntries({}),
      ]);
      setAccounts(data);

      // Aggregate debit/credit per account from all journal entry lines
      const totals = new Map<string, { debit: number; credit: number }>();
      for (const entry of entries) {
        for (const line of entry.lines) {
          const cur = totals.get(line.account_id) || { debit: 0, credit: 0 };
          cur.debit += parseFloat(line.debit_base || line.debit || "0");
          cur.credit += parseFloat(line.credit_base || line.credit || "0");
          totals.set(line.account_id, cur);
        }
      }

      // For inventory/purchase-cost accounts that may not have journal postings,
      // compute balances from stock movements and purchase invoices (like Income Statement)
      try {
        const [materials, purchaseInvoices, purchaseReturns] = await Promise.allSettled([
          materialService.listMaterials(),
          invoiceService.listInvoicesByType("Purchase"),
          returnService.listPurchaseReturns(),
        ]);

        const movementResults = materials.status === "fulfilled"
          ? await Promise.allSettled(
              materials.value.map(async (m: MaterialDto) => ({
                materialId: m.id,
                movements: await materialService.listMovementsByMaterial(m.id),
              })),
            )
          : [];

        // Sum all stock movements → total inventory value (for بضاعة آخر المدة / المخزون)
        let totalInventory = 0;
        // Sum OpeningBalance movements only → opening inventory (for بضاعة أول المدة)
        let openingInventory = 0;

        for (const result of movementResults) {
          if (result.status !== "fulfilled") continue;
          const movements = result.value.movements ?? [];
          for (const mov of movements) {
            const base = parseFloat(mov.total_cost_base ?? mov.total_cost ?? "0");
            const val = mov.is_inflow ? base : -base;
            totalInventory += val;
            if (mov.movement_type === "OpeningBalance") {
              openingInventory += val;
            }
          }
        }

        // Compute net purchase cost from invoices + returns (for تكاليف إضافية على المشتريات)
        let netPurchaseCost = 0;
        if (purchaseInvoices.status === "fulfilled") {
          for (const inv of purchaseInvoices.value) {
            if (inv.status !== "Posted" && inv.status !== "Paid") continue;
            netPurchaseCost += parseFloat(inv.total_amount || "0");
          }
        }
        if (purchaseReturns.status === "fulfilled") {
          for (const ret of purchaseReturns.value) {
            for (const line of ret.lines ?? []) {
              netPurchaseCost -= parseFloat(line.line_total || "0");
            }
          }
        }

        // Override specific accounts by name
        for (const account of data) {
          if (account.name_ar === "بضاعة أول المدة") {
            const debit = openingInventory > 0 ? openingInventory : 0;
            const credit = openingInventory < 0 ? Math.abs(openingInventory) : 0;
            totals.set(account.id, { debit, credit });
          }
          if (account.name_ar === "بضاعة آخر المدة" || account.name_ar === "المخزون") {
            const debit = totalInventory > 0 ? totalInventory : 0;
            const credit = totalInventory < 0 ? Math.abs(totalInventory) : 0;
            totals.set(account.id, { debit, credit });
          }
          if (account.name_ar === "تكاليف إضافية على المشتريات") {
            const debit = netPurchaseCost > 0 ? netPurchaseCost : 0;
            const credit = netPurchaseCost < 0 ? Math.abs(netPurchaseCost) : 0;
            totals.set(account.id, { debit, credit });
          }
        }
      } catch (e) {
        console.warn("Inventory/purchase-cost override failed, using journal entries only:", e);
      }

      setLedgerTotals(totals);
      
      if (isInitial) {
        const defaultExpanded = new Set<string>();
        defaultExpanded.add(ROOT_ACCOUNT_ID);
        for (const account of data) {
          if ((account.level ?? 1) <= 2) defaultExpanded.add(account.id);
        }
        setExpandedNodes(defaultExpanded);
      }
      
      setSelected((prev) => {
        const rootNode: AccountTreeNode = {
          id: ROOT_ACCOUNT_ID, code: "", name_ar: "دليل الحسابات", name_en: "Chart of Accounts",
          account_type: "Assets", parent_id: null, category: "Summary", level: 0, opening_balance: "0",
          balance: "0", notes: null, is_active: true, is_default: false, is_final: false,
          linked_customer_id: null, linked_supplier_id: null, debit: "0", credit: "0", children: [],
        };
        if (prev?.id === ROOT_ACCOUNT_ID) return rootNode;
        if (prev) {
          const updated = data.find((a) => a.id === prev.id);
          return updated ? { ...updated, children: [] } : null;
        }
        return rootNode;
      });
    } catch (error) { toast.error("فشل تحميل البيانات: " + error); }
    finally { 
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(true); }, [load]);

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
    const bal = parseAmount(child.balance);
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

  const isRootSelected = selected?.id === ROOT_ACCOUNT_ID;
  const parentName = useMemo(() => {
    if (!selected?.parent_id) return null;
    return accounts.find((a) => a.id === selected.parent_id)?.name_ar ?? null;
  }, [selected, accounts]);

  const handleDelete = useCallback(async () => {
    if (!selected || isRootSelected) return;
    if (!window.confirm(`هل تريد حذف/تعطيل الحساب "${selected.name_ar}"؟`)) return;
    try {
      setLoading(true);
      await accountingService.deleteAccount(selected.id);
      await load();
      toast.success("تم حذف الحساب بنجاح");
    } catch (error) { toast.error(`فشلت العملية: ${getErrorMessage(error)}`); }
    finally { setLoading(false); }
  }, [selected, isRootSelected, load]);

  const isLoading = loading || refreshing;

  return (
    <HierarchicalTreeTemplate
      title="دليل الحسابات"
      toolbar={
        <>
           <div className="relative w-64 ml-4">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="بحث في الحسابات..." 
              className="pr-10 h-10 border-slate-200 bg-slate-50/50" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={expandAll} className="bg-white">
            <ChevronLeft className="w-4 h-4 ml-1" /> توسيع الكل
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} className="bg-white">
             طي الكل <ChevronRight className="w-4 h-4 mr-1" />
          </Button>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <Button size="sm" className="bg-slate-900 text-white">
            <Download className="w-4 h-4 ml-2" /> تصدير PDF
          </Button>
        </>
      }
      treeSidebar={
        <div className="space-y-1">
          {loading ? (
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
          onSaved={() => void load(false)}
          onDelete={() => void handleDelete()}
          canEdit={!isRootSelected && !!selected}
          canDelete={!isRootSelected && !!selected}
        />
      }
      filterBar={
        <div className="flex items-center gap-6 w-full">
           {[
             { label: "إجمالي الحسابات", value: accounts.length, color: "text-slate-900" },
             { label: "الأصول", value: accounts.filter(a => a.account_type === "Assets").length, color: "text-blue-600" },
             { label: "الخصوم", value: accounts.filter(a => a.account_type === "Liabilities").length, color: "text-red-600" },
             { label: "حقوق الملكية", value: accounts.filter(a => a.account_type === "Equity").length, color: "text-emerald-600" },
           ].map((stat, i) => (
             <div key={i} className="flex flex-col items-start gap-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{stat.label}</span>
                <div className={`text-lg font-black tabular-nums ${stat.color}`}>{stat.value}</div>
             </div>
           ))}
        </div>
      }
    />
  );
}

