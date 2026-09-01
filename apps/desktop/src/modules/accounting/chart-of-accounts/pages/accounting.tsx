import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildTree, getVisibleRootTree, getErrorMessage } from "../lib/tree-utils";
import { computeTreeBalances } from "../lib/tree-balances";
import { parseSafeNumber } from "@shared/lib/parseSafeNumber";
import type { AccountTreeNode, ToggleNodeHandler } from "../lib/types";
import { AccountTreeNodeItem } from "../components/AccountTreeNodeItem";
import { BranchPanel, type PanelMode } from "../components/BranchPanel";
import { HierarchicalTreeTemplate } from '@widgets/templates/HierarchicalTreeTemplate';
import { Button } from "@shared/ui/button";
import { ConfirmDialog } from "@shared/ui/confirm-dialog";
import { toast } from "sonner";
import { useChartOfAccountsTree } from "@shared/hooks/queries/useAccountQueries";
import { accountingService } from '@modules/accounting/api/accountingService';
import {
  CHART_MUTATION_KEYS,
  QUERY_KEYS,
  ALL_PARTY_KEYS,
  ALL_INVENTORY_KEYS,
  PARTNER_MUTATION_KEYS,
  invalidateKeys,
} from "@shared/hooks/queryClient";
import { useTabs } from "@app/providers/TabContext";
import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { getExchangeRate } from "@shared/lib/currency-strategy";
import { customerService } from "@modules/partners/api/customerService";
import { supplierService } from "@modules/partners/api/supplierService";
import { partnerService, type PartnerRequest } from "@modules/partners/api/partnerService";
import type { PartnerFormPayload } from "@modules/partners/components/PartnerFormPanel";
import type { ExpenseFormPayload } from "@modules/expenses/components/ExpenseFormPanel";
import { resolveAccountNodeActions } from "@shared/tree/actionsResolver";
import { resolveChartNode, inferFixedAssetType } from "../lib/branches";
import type { TreeNodeCreatePanelKind } from "@shared/tree/nodeTypes";
import { SYSTEM_ACCOUNT_IDS } from "@erp/shared-types";
import { resolveAccountNavigation } from "@shared/tree/navigationResolver";
import { findRouteById } from "@app/shell/routeRegistry";
import { useCompanyInitState, useCompanyTypeSettings } from "@shared/hooks";
import { companyTypeOf, hiddenNavIds } from "@modules/opening-balance/lib/company-lifecycle";

const ROOT_ACCOUNT_ID = "__chart_of_accounts_root__";

export default function Accounting() {
  const queryClient = useQueryClient();
  const { openTab } = useTabs();
  const { currencies, rateMap, baseCurrency } = useCurrencyContext();
  const companySettings = useCompanyTypeSettings();
  const { initState, isReady } = useCompanyInitState();
  const [selected, setSelected] = useState<AccountTreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery] = useState("");
  const [panelMode, setPanelMode] = useState<PanelMode | null>(null);
  const [panelCreateKind, setPanelCreateKind] = useState<TreeNodeCreatePanelKind | null>(null);
  const [createParent, setCreateParent] = useState<AccountTreeNode | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [entitySaving, setEntitySaving] = useState(false);
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

  // Helper to find a node recursively in the computed tree
  const findNodeInTree = useCallback((nodes: AccountTreeNode[], id: string): AccountTreeNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeInTree(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Keep the selected account in sync with any updates from computedTree
  useEffect(() => {
    if (computedTree.length > 0 && selected && selected.id !== ROOT_ACCOUNT_ID) {
      const updated = findNodeInTree(computedTree, selected.id);
      if (updated) {
        if (
          updated.name_ar !== selected.name_ar ||
          updated.name_en !== selected.name_en ||
          updated.code !== selected.code ||
          updated.account_type !== selected.account_type ||
          updated.parent_id !== selected.parent_id ||
          updated.opening_balance !== selected.opening_balance ||
          updated.debit !== selected.debit ||
          updated.credit !== selected.credit ||
          updated.balance !== selected.balance
        ) {
          setSelected((prev) => (prev ? { ...prev, ...updated } : null));
        }
      } else {
        setSelected(null);
        setPanelMode(null);
      }
    }
  }, [computedTree, selected, findNodeInTree]);

  // Sync root node balance in selected state when rootBalance changes
  useEffect(() => {
    if (selected?.id === ROOT_ACCOUNT_ID && selected.balance !== String(rootBalance)) {
      setSelected((prev) => (prev ? { ...prev, balance: String(rootBalance) } : null));
    }
  }, [rootBalance, selected?.id, selected?.balance]);

  const isRootSelected = selected?.id === ROOT_ACCOUNT_ID;
  const canOperate = !!selected && !isRootSelected;
  const blockedRouteIds = useMemo(
    () => hiddenNavIds(companyTypeOf(companySettings), isReady ? initState : "ACTIVE"),
    [companySettings, initState, isReady],
  );
  const parentName = useMemo(() => {
    if (!selected?.parent_id) return null;
    return accounts.find((a) => a.id === selected.parent_id)?.name_ar ?? null;
  }, [selected, accounts]);

  // ── Central resolution: classification + capabilities + actions ──

  const resolved = useMemo(
    () => resolveChartNode({ node: selected, nodes: accounts, rootId: ROOT_ACCOUNT_ID }),
    [selected, accounts],
  );

  // Fixed-asset subtype implied by the selected asset account (e.g. selecting
  // "آليات ومركبات" → automotive). Null = unknown → the form shows the selector.
  const initialFixedAssetType = useMemo(
    () =>
      resolved?.branch === "fixed-assets" && selected
        ? inferFixedAssetType(selected, accounts)
        : null,
    [resolved, selected, accounts],
  );

  const handleSelect = useCallback((node: AccountTreeNode) => {
    setSelected(node);
    setCreateParent(node);
    if (node.id === ROOT_ACCOUNT_ID) setPanelMode(null);
    else setPanelMode("view");
  }, []);

  const handleOpenNew = useCallback(() => {
    if (!resolved.capabilities.canCreate || !resolved.capabilities.createPanelKind) return;
    if (resolved.capabilities.createPanelKind === "account" && selected?.is_final) {
      toast.error("لا يمكن إضافة حسابات فرعية تحت حساب نهائي (ورقة)");
      return;
    }
    setCreateParent(selected && selected.id !== ROOT_ACCOUNT_ID ? selected : null);
    setPanelCreateKind(resolved.capabilities.createPanelKind);
    setPanelMode("create");
  }, [resolved, selected]);

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

  const handleNodeDoubleClick = useCallback((node: AccountTreeNode) => {
    const target = resolveAccountNavigation({
      node,
      nodes: accounts,
      rootId: ROOT_ACCOUNT_ID,
    });

    if (target.type === "none") return;

    if (target.type === "ledger") {
      openTab({
        id: `ledger-${target.accountId}`,
        title: `حركة: ${node.name_ar}`,
        path: `/accounting/account-ledger/${target.accountId}`,
        closable: true,
      });
      return;
    }

    if (blockedRouteIds.has(target.routeId)) return;

    const route = findRouteById(target.routeId);
    if (!route?.to) return;

    openTab({
      id: route.id,
      title: route.label,
      path: route.to,
      closable: true,
    });
  }, [accounts, blockedRouteIds, openTab]);

  const handleDeleteRequest = useCallback(() => {
    if (!canOperate) return;
    setDeleteOpen(true);
  }, [canOperate]);

  const handleConfirmDelete = useCallback(async () => {
    if (!selected || isRootSelected) return;
    try {
      await accountingService.deleteAccount(selected.id);
      await invalidateKeys(queryClient, CHART_MUTATION_KEYS);
      toast.success("تم حذف الحساب بنجاح");
      setSelected(null);
      setPanelMode(null);
      setDeleteOpen(false);
    } catch (error) {
      toast.error(`فشلت العملية: ${getErrorMessage(error)}`);
    }
  }, [selected, isRootSelected, queryClient]);

  const handleSavedAccount = useCallback(async () => {
    await invalidateKeys(queryClient, CHART_MUTATION_KEYS);
    setPanelMode(selected && !isRootSelected ? "view" : null);
  }, [queryClient, selected, isRootSelected]);

  // ── Branch-aware entity creation ──

  const backToView = useCallback(() => {
    setPanelMode(selected && !isRootSelected ? "view" : null);
  }, [selected, isRootSelected]);

  const handleCreateCustomer = useCallback(async (payload: PartnerFormPayload) => {
    setEntitySaving(true);
    try {
      await customerService.create({
        code: "",
        name: payload.name,
        phone: payload.phone,
        address: payload.address,
        notes: payload.notes,
        opening_balance: payload.opening_balance,
        debit: payload.debit,
        credit: payload.credit,
        currency: payload.currency || undefined,
        is_active: true,
      });
      toast.success("تم إضافة العميل الجديد بنجاح");
      await invalidateKeys(queryClient, [...ALL_PARTY_KEYS, ...CHART_MUTATION_KEYS]);
      backToView();
    } catch (error) {
      toast.error(`فشلت العملية: ${getErrorMessage(error)}`);
    } finally {
      setEntitySaving(false);
    }
  }, [queryClient, backToView]);

  const handleCreateSupplier = useCallback(async (payload: PartnerFormPayload) => {
    setEntitySaving(true);
    try {
      await supplierService.create({
        code: "",
        name: payload.name,
        phone: payload.phone,
        address: payload.address,
        notes: payload.notes,
        opening_balance: payload.opening_balance,
        debit: payload.debit,
        credit: payload.credit,
        currency: payload.currency || undefined,
        is_active: true,
      });
      toast.success("تم إضافة المورد الجديد بنجاح");
      await invalidateKeys(queryClient, [...ALL_PARTY_KEYS, ...CHART_MUTATION_KEYS]);
      backToView();
    } catch (error) {
      toast.error(`فشلت العملية: ${getErrorMessage(error)}`);
    } finally {
      setEntitySaving(false);
    }
  }, [queryClient, backToView]);

  const handleEditCustomer = useCallback(async (payload: PartnerFormPayload) => {
    if (!payload.id) return;
    setEntitySaving(true);
    try {
      await customerService.update({
        id: payload.id,
        code: payload.code,
        name: payload.name,
        phone: payload.phone,
        address: payload.address,
        notes: payload.notes,
        opening_balance: payload.opening_balance,
        debit: payload.debit,
        credit: payload.credit,
        currency: payload.currency || undefined,
        is_active: payload.is_active,
      });
      toast.success("تم تحديث بيانات العميل بنجاح");
      await invalidateKeys(queryClient, [...ALL_PARTY_KEYS, ...CHART_MUTATION_KEYS]);
      backToView();
    } catch (error) {
      toast.error(`فشلت العملية: ${getErrorMessage(error)}`);
    } finally {
      setEntitySaving(false);
    }
  }, [queryClient, backToView]);

  const handleEditSupplier = useCallback(async (payload: PartnerFormPayload) => {
    if (!payload.id) return;
    setEntitySaving(true);
    try {
      await supplierService.update({
        id: payload.id,
        code: payload.code,
        name: payload.name,
        phone: payload.phone,
        address: payload.address,
        notes: payload.notes,
        opening_balance: payload.opening_balance,
        debit: payload.debit,
        credit: payload.credit,
        currency: payload.currency || undefined,
        is_active: payload.is_active,
      });
      toast.success("تم تحديث بيانات المورد بنجاح");
      await invalidateKeys(queryClient, [...ALL_PARTY_KEYS, ...CHART_MUTATION_KEYS]);
      backToView();
    } catch (error) {
      toast.error(`فشلت العملية: ${getErrorMessage(error)}`);
    } finally {
      setEntitySaving(false);
    }
  }, [queryClient, backToView]);

  const expensesParentAccount = useMemo(
    () => accounts.find((a) => a.id === SYSTEM_ACCOUNT_IDS.OTHER_EXPENSES) ?? null,
    [accounts],
  );
  const expenseItems = useMemo(() => {
    const isUnderExpenses = (account: {
      id: string;
      parent_id: string | null;
    }): boolean => {
      const seen = new Set<string>();
      let current: { id: string; parent_id: string | null } | null = account;
      let guard = 0;
      while (current && !seen.has(current.id) && guard < 64) {
        if (current.id === SYSTEM_ACCOUNT_IDS.OTHER_EXPENSES) return true;
        seen.add(current.id);
        current = current.parent_id ? (accounts.find((a) => a.id === current?.parent_id) ?? null) : null;
        guard += 1;
      }
      return false;
    };
    return accounts.filter(isUnderExpenses);
  }, [accounts]);

  const handleCreateExpense = useCallback(async (payload: ExpenseFormPayload) => {
    setEntitySaving(true);
    try {
      const parent = expensesParentAccount;
      const exchangeRate = getExchangeRate(payload.currency, rateMap, baseCurrency?.code);
      await accountingService.createAccount({
        code: payload.code,
        name_ar: payload.name_ar,
        name_en: payload.name_en,
        account_type: "Expenses",
        parent_id: parent?.id ?? null,
        category: "Detail",
        level: (parent?.level ?? 1) + 1,
        opening_balance: payload.opening_balance,
        notes: payload.notes,
        is_active: true,
        is_default: false,
        debit: payload.debit,
        credit: payload.credit,
        currency: payload.currency,
        exchange_rate: exchangeRate.toString(),
      });
      toast.success("تم إضافة بند المصروف بنجاح");
      await invalidateKeys(queryClient, [...CHART_MUTATION_KEYS, QUERY_KEYS.expenseItems]);
      backToView();
    } catch (error) {
      toast.error(`فشلت العملية: ${getErrorMessage(error)}`);
    } finally {
      setEntitySaving(false);
    }
  }, [expensesParentAccount, rateMap, baseCurrency, queryClient, backToView]);

  const handleCreatePartner = useCallback(async (payload: PartnerRequest) => {
    setEntitySaving(true);
    try {
      await partnerService.addPartner(payload);
      toast.success("تم إضافة الشريك بنجاح");
      await invalidateKeys(queryClient, [...PARTNER_MUTATION_KEYS, ...CHART_MUTATION_KEYS]);
      backToView();
    } catch (error) {
      toast.error(`فشلت العملية: ${getErrorMessage(error)}`);
    } finally {
      setEntitySaving(false);
    }
  }, [queryClient, backToView]);

  const handleAssetSaved = useCallback(async () => {
    await invalidateKeys(queryClient, [...CHART_MUTATION_KEYS, ...ALL_INVENTORY_KEYS]);
    backToView();
  }, [queryClient, backToView]);

  // ── Central action descriptors → toolbar buttons ──

  const actionDescriptors = resolveAccountNodeActions({
    resolved,
    onNew: handleOpenNew,
    onEdit: handleOpenEdit,
    onLedger: handleOpenLedger,
    onDelete: handleDeleteRequest,
  });

  // TopBar / external "add new account" entry point
  useEffect(() => {
    const handler = () => handleOpenNew();
    window.addEventListener("erp:open-new-account", handler);
    return () => window.removeEventListener("erp:open-new-account", handler);
  }, [handleOpenNew]);

  const isLoadingNow = isLoading;
  const isPanelOpen = panelMode !== null;
  const panelSelected = isRootSelected ? null : selected;

  return (
    <HierarchicalTreeTemplate
      title="دليل الحسابات"
      toolbar={
        <>
          {actionDescriptors.map((action) => {
            const Icon = action.icon;
            const toneClass =
              action.tone === "primary"
                ? "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 text-white"
                : action.tone === "danger"
                  ? "bg-white border-rose-200 text-rose-700 hover:bg-rose-50"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50";
            return (
              <Button
                key={action.key}
                size="sm"
                className={toneClass}
                disabled={action.disabled}
                onClick={action.onClick}
              >
                {Icon && <Icon className={`w-4 h-4 ml-2 ${action.tone === "primary" ? "" : action.tone === "danger" ? "text-rose-600" : action.key === "ledger" ? "text-blue-600" : ""}`} />}
                {action.label}
              </Button>
            );
          })}
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
              onDoubleClick={handleNodeDoubleClick}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              virtualRootId={ROOT_ACCOUNT_ID}
            />
          )}
        </div>
      }
      sidePanel={
        isPanelOpen ? (
          <BranchPanel
            mode={panelMode ?? "view"}
            createKind={panelCreateKind}
            selected={panelSelected}
            allAccounts={accounts}
            resolved={resolved}
            parentName={parentName}
            parentAccount={createParent}
            expenseItems={expenseItems}
            expenseParentCode={expensesParentAccount?.code}
            currencies={currencies}
            initialFixedAssetType={initialFixedAssetType}
            entitySaving={entitySaving}
            onClose={() => setPanelMode(null)}
            onSavedAccount={handleSavedAccount}
            onCreateCustomer={handleCreateCustomer}
            onCreateSupplier={handleCreateSupplier}
            onEditCustomer={handleEditCustomer}
            onEditSupplier={handleEditSupplier}
            onCreateExpense={handleCreateExpense}
            onCreatePartner={handleCreatePartner}
            onAssetSaved={handleAssetSaved}
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
