import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@shared/ui/button";
import { Download, RefreshCw, Folder, Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { accountingService } from '@modules/accounting/api/accountingService';
import type { AccountDto } from "@erp/shared-types";
import { buildTree, getVisibleRootTree, getErrorMessage } from "./accounting/tree-utils";
import type { AccountTreeNode, ToggleNodeHandler } from "./accounting/types";
import { AccountTreeNodeItem } from "./accounting/AccountTreeNodeItem";
import { AccountDetailsSidebar } from "./accounting/AccountDetailsSidebar";
import { HierarchicalTreeTemplate } from '@widgets/templates/HierarchicalTreeTemplate';
import { Input } from "@shared/ui/input";
import { toast } from "sonner";

const ROOT_ACCOUNT_ID = "__chart_of_accounts_root__";

export default function Accounting() {
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<AccountTreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      
      const data = await accountingService.getChartOfAccounts();
      setAccounts(data);
      
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
          linked_customer_id: null, linked_supplier_id: null, children: [],
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
  const visibleTree = useMemo(() => getVisibleRootTree(tree, searchQuery), [tree, searchQuery]);
  const rootNode = useMemo<AccountTreeNode>(() => ({
    id: ROOT_ACCOUNT_ID, code: "", name_ar: "دليل الحسابات", name_en: "Chart of Accounts",
    account_type: "Assets", parent_id: null, category: "Summary", level: 0, opening_balance: "0",
    balance: "0", notes: null, is_active: true, is_default: false, is_final: false,
    linked_customer_id: null, linked_supplier_id: null, children: visibleTree,
  }), [visibleTree]);

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

