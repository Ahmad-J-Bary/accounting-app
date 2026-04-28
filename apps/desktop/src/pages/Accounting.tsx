import { useState, useEffect, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Folder } from "lucide-react";
import { accountingService } from "@/services/accountingService";
import type { AccountDto } from "@erp/shared-types";
import { buildTree, getVisibleRootTree, getErrorMessage } from "./accounting/tree-utils";
import type { AccountTreeNode, ToggleNodeHandler } from "./accounting/types";
import { AccountTreeNodeItem } from "./accounting/AccountTreeNodeItem";
import { AccountDetailsSidebar } from "./accounting/AccountDetailsSidebar";
import { TreeLayout } from "../components/erp/tree-management/TreeLayout";

const ROOT_ACCOUNT_ID = "__chart_of_accounts_root__";

export default function Accounting() {
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AccountTreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await accountingService.getChartOfAccounts();
      setAccounts(data);
      const defaultExpanded = new Set<string>();
      defaultExpanded.add(ROOT_ACCOUNT_ID);
      for (const account of data) {
        if ((account.level ?? 1) <= 2) defaultExpanded.add(account.id);
      }
      setExpandedNodes(defaultExpanded);
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
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

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

  const collapseAll = useCallback(() => setExpandedNodes(new Set()), []);

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
    if (matchingAncestors.size > 0) setExpandedNodes((prev) => new Set([...prev, ...matchingAncestors]));
  }, [searchQuery, accounts]);

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
    } catch (error) { window.alert(`فشلت العملية: ${getErrorMessage(error)}`); }
    finally { setLoading(false); }
  }, [selected, isRootSelected, load]);

  const treeContent = (
    <>
      {loading ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin" />
          <p>جاري تحميل دليل الحسابات...</p>
        </div>
      ) : visibleTree.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
          <Folder className="w-12 h-12 text-slate-200" />
          <p>لا توجد حسابات مضافة</p>
        </div>
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
    </>
  );

  const tableHeader = (
    <>
      <div className="w-[40px]" />
      <div className="flex-1">اسم الحساب / الرقم</div>
      <div className="w-[90px]">التصنيف</div>
      <div className="w-[100px]">النوع</div>
      <div className="w-[120px] text-left">الرصيد</div>
    </>
  );

  return (
    <>
      <PageHeader
        title="دليل الحسابات"
        subtitle="إدارة شجرة الحسابات المحاسبية للشركة"
        breadcrumbs={[{ label: "الرئيسية", to: "/dashboard" }, { label: "المحاسبة" }, { label: "دليل الحسابات" }]}
        actions={<Button variant="outline"><Download className="w-4 h-4 ml-2" />تصدير الدليل</Button>}
      />
      <TreeLayout
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onRefresh={() => void load()}
        loading={loading}
        tableHeader={tableHeader}
        treeContent={treeContent}
        sidebarContent={
          <AccountDetailsSidebar
            selected={isRootSelected ? null : selected}
            allAccounts={accounts}
            parentName={parentName}
            onSaved={() => void load()}
            onDelete={() => void handleDelete()}
            canEdit={!isRootSelected && !!selected}
            canDelete={!isRootSelected && !!selected}
          />
        }
      />
    </>
  );
}
