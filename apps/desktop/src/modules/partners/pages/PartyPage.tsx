import { useState, useCallback, useEffect } from "react";
import { Button } from "@shared/ui/button";
import { Plus, History, ShoppingBag, Printer, Download, Undo2, Receipt, DollarSign } from "lucide-react";
import { toast } from "sonner";

import { customerService } from '@modules/partners/api/customerService';
import { supplierService } from '@modules/partners/api/supplierService';
import { accountingService } from '@modules/accounting/api/accountingService';
import { paymentService } from '@modules/payments/api/paymentService';
import type { AccountDto, CreatePaymentRequest, CustomerDto, SupplierDto, CreateCustomerRequest, UpdateCustomerRequest, CreateSupplierRequest, UpdateSupplierRequest } from "@erp/shared-types";

import { useCurrencyContext } from "@app/providers/CurrencyContext";
import { useTabs } from "@app/providers/TabContext";
import { useEntityList } from '@shared/hooks/useEntityList';
import { saveExcelFile } from '@shared/lib/excel';
import type { ExcelExportColumn, ExcelExportOptions } from '@shared/lib/excel';
import { QUERY_KEYS } from "@shared/hooks/queryClient";
import { PartyTable } from '@modules/partners/components/PartyTable';
import { PaymentForm, PAYMENT_CONFIGS } from '@modules/partners/components/PaymentForm';
import { ReturnFromMaterialPanel } from '@modules/inventory/components/ReturnFromMaterialPanel';
import { OperationalTableTemplate } from '@widgets/templates/OperationalTableTemplate';
import { PartnerDetailPanel } from '@modules/partners/components/PartnerDetailPanel';
import { PartnerFormPanel } from '@modules/partners/components/PartnerFormPanel';

// ── Side panel mode type ─────────────────────────────────────────────────────────

type PanelMode = 'form' | 'return' | 'payment' | 'detail' | null;

// ── Entity-specific configuration ──────────────────────────────────────────────

interface PartyPageConfig {
  title: string;
  addButtonLabel: string;
  eventType: string;
  invoiceType: "Sales" | "Purchase";
  returnReturnType: "sales" | "purchase";
  isCreditFirst: boolean;
  paymentConfig: (entity: CustomerDto | SupplierDto) => ReturnType<typeof PAYMENT_CONFIGS.customer>;
  statementPath: (id: string, name: string) => { id: string; title: string; path: string };
  invoicesTab: (id: string, name: string) => { id: string; title: string; path: string };
  successMessage: string;
}

const PARTY_CONFIGS: Record<string, PartyPageConfig> = {
  customer: {
    title: "إدارة العملاء",
    addButtonLabel: "إضافة عميل جديد",
    eventType: "erp:open-new-customer",
    invoiceType: "Sales",
    returnReturnType: "sales",
    isCreditFirst: false,
    paymentConfig: (entity) => PAYMENT_CONFIGS.customer(entity as CustomerDto),
    statementPath: (id, name) => ({
      id: `statement-${id}`,
      title: `كشف: ${name}`,
      path: `/partners/customer-statement/${id}`,
    }),
    invoicesTab: (id, name) => ({
      id: `sales-customer-${id}`,
      title: `مبيعات: ${name}`,
      path: `/sales-invoices?customerId=${id}`,
    }),
    successMessage: "تم تسجيل سند القبض بنجاح",
  },
  supplier: {
    title: "إدارة الموردين",
    addButtonLabel: "مورد جديد",
    eventType: "erp:open-new-supplier",
    invoiceType: "Purchase",
    returnReturnType: "purchase",
    isCreditFirst: true,
    paymentConfig: (entity) => PAYMENT_CONFIGS.supplier(entity as SupplierDto),
    statementPath: (id, name) => ({
      id: `statement-${id}`,
      title: `كشف: ${name}`,
      path: `/partners/supplier-statement/${id}`,
    }),
    invoicesTab: (id, name) => ({
      id: `purchases-supplier-${id}`,
      title: `مشتريات: ${name}`,
      path: `/purchase-invoices?supplierId=${id}`,
    }),
    successMessage: "تم تسجيل سند الدفع بنجاح",
  },
};

// ── Component ──────────────────────────────────────────────────────────────────

interface PartyPageProps {
  entityName: "customer" | "supplier";
}

export default function PartyPage({ entityName }: PartyPageProps) {
  const cfg = PARTY_CONFIGS[entityName];
  const { openTab } = useTabs();
  const { currencies, baseCurrency, toBase, formatAmount } = useCurrencyContext();

  // ── CRUD via useEntityList ──

  const {
    filtered: items,
    loading,
    search,
    setSearch,
    refresh,
    refreshing,
    selectedId,
    setSelectedId,
    selectedItem,
    editItem,
    saving,
    handleOpenAdd,
    handleOpenEdit,
    handleSave,
    handleDelete,
  } = useEntityList<CustomerDto | SupplierDto, CreateCustomerRequest | UpdateCustomerRequest | CreateSupplierRequest | UpdateSupplierRequest>({
    queryKey: entityName === "customer" ? [...QUERY_KEYS.customers] : [...QUERY_KEYS.suppliers],
    fetchData: entityName === "customer"
      ? () => customerService.list()
      : () => supplierService.list(),
    manageFormState: false,
    saveData: async (payload) => {
      if (entityName === "customer") {
        const customerPayload = payload as CreateCustomerRequest | UpdateCustomerRequest;
        if ("id" in customerPayload && customerPayload.id) {
          return customerService.update(customerPayload);
        }
        return customerService.create(customerPayload);
      } else {
        const supplierPayload = payload as CreateSupplierRequest | UpdateSupplierRequest;
        if ("id" in supplierPayload && supplierPayload.id) {
          return supplierService.update(supplierPayload);
        }
        return supplierService.create(supplierPayload);
      }
    },
    deleteData: async (id) => {
      if (entityName === "customer") {
        return customerService.delete(id);
      } else {
        return supplierService.delete(id);
      }
    },
    searchFields: ["name", "phone", "code"],
    searchPredicate: (item, rawSearch) => {
      const searchValue = rawSearch.trim().toLowerCase();
      if (!searchValue) return true;

      const debit = Number(item.debit || 0);
      const credit = Number(item.credit || 0);
      const effectiveBalance = (debit - credit) * (cfg.isCreditFirst ? -1 : 1);
      const statusLabel = effectiveBalance === 0 ? "" : effectiveBalance > 0 ? "مدين" : "دائن";

      return [
        item.code,
        item.name,
        item.phone,
        item.balance,
        item.notes,
        statusLabel,
      ].some((value) => String(value ?? "").toLowerCase().includes(searchValue));
    },
  });

  // ── Side panel state ──

  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>([]);

  const handleSavePayment = async (payload: CreatePaymentRequest) => {
    try {
      setPaymentSaving(true);
      await paymentService.createPayment(payload);
      await refresh(true);
      toast.success(cfg.successMessage);
      setPanelMode(null);
    } catch (error) {
      toast.error("فشل تسجيل السند: " + error);
    } finally {
      setPaymentSaving(false);
    }
  };

  const isLoading = loading || refreshing;

  // ── Detail data (invoices, payments, accounts) ──

  const [accounts, setAccounts] = useState<AccountDto[]>([]);

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await accountingService.getChartOfAccounts());
    } catch (e) { console.error(e); }
  }, []);

  const handleOpenAddWithAccounts = useCallback(async () => {
    await loadAccounts();
    handleOpenAdd();
    setPanelMode('form');
  }, [loadAccounts, handleOpenAdd]);

  const handleOpenEditWithAccounts = useCallback(
    async (item: CustomerDto | SupplierDto) => {
      await loadAccounts();
      handleOpenEdit(item);
      setPanelMode('form');
    },
    [loadAccounts, handleOpenEdit],
  );

  const handlePartnerSave = useCallback(
    async (
      payload:
        | CreateCustomerRequest
        | UpdateCustomerRequest
        | CreateSupplierRequest
        | UpdateSupplierRequest,
    ) => {
      await handleSave(payload);
      setPanelMode(null);
    },
    [handleSave],
  );

  // ── Custom event listener ──

  useEffect(() => {
    const handler = () => handleOpenAddWithAccounts();
    window.addEventListener(cfg.eventType, handler);
    return () => window.removeEventListener(cfg.eventType, handler);
  }, [cfg.eventType, handleOpenAddWithAccounts]);

  // ── Handle Excel Export ──

  const handleExport = useCallback(async () => {
    const isCreditFirst = entityName === 'supplier';
    const colDefs: ExcelExportColumn[] = [
      { id: 'code', label: '#', width: 8, hidden: !visibleColumnIds.includes('code'), accessor: (row) => String(row.code ?? '') },
      { id: 'name', label: entityName === 'customer' ? 'اسم العميل' : 'اسم المورد', width: 25, hidden: !visibleColumnIds.includes('name'), accessor: (row) => String(row.name ?? '') },
      { id: 'phone', label: 'رقم الهاتف', width: 15, hidden: !visibleColumnIds.includes('phone'), accessor: (row) => String(row.phone ?? '') },
      {
        id: 'status', label: 'حالة الحساب', width: 12, hidden: !visibleColumnIds.includes('status'),
        accessor: (row) => {
          const debit = Number(row.debit || 0);
          const credit = Number(row.credit || 0);
          const effectiveBalance = (debit - credit) * (isCreditFirst ? -1 : 1);
          if (effectiveBalance === 0) return '—';
          return effectiveBalance > 0 ? 'دائن' : 'مدين';
        },
      },
      ...currencies.map((curr) => ({
        id: `balance_${curr.code}`,
        label: `الرصيد (${curr.symbol || curr.code})`,
        hidden: !visibleColumnIds.includes(`balance_${curr.code}`),
        width: 15,
        accessor: (row: Record<string, unknown>) => {
          const absBal = Math.abs(Number(row.balance || 0));
          if (absBal === 0) return '';
          const baseAmount = toBase(absBal, String(row.currency ?? baseCurrency?.code ?? ''));
          return formatAmount(baseAmount, { currencyCode: curr.code });
        },
      })),
      { id: 'notes', label: 'ملاحظات', width: 20, accessor: (row) => String(row.notes ?? '') },
    ];

    const exportOptions: ExcelExportOptions = {
      sheetName: entityName === 'supplier' ? 'الموردين' : 'العملاء',
      autoFilter: true,
      sortBy: {
        columnId: 'code',
        direction: 'asc',
        compare: (a, b) => (parseInt(String(a.code ?? '0'), 10) || 0) - (parseInt(String(b.code ?? '0'), 10) || 0),
      },
    };

    const ok = await saveExcelFile(
      items as unknown as Record<string, unknown>[],
      colDefs,
      entityName === 'supplier' ? 'الموردين' : 'العملاء',
      exportOptions,
    );
    if (ok) toast.success("تم الحفظ بنجاح");
  }, [items, currencies, entityName, toBase, formatAmount, baseCurrency?.code, visibleColumnIds]);

  // ── Toolbar ──

  const toolbar = (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        disabled={!selectedId}
        onClick={() => {
          const party = selectedItem as CustomerDto | SupplierDto;
          if (party?.account_id) {
            openTab({
              id: `ledger-${party.account_id}`,
              title: `حركة: ${selectedItem?.name}`,
              path: `/accounting/account-ledger/${party.account_id}`,
              closable: true,
            });
          }
        }}
      >
        <History className="w-4 h-4 ml-2 text-slate-500" /> حركة اليومية
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        disabled={!selectedId}
        onClick={() => {
          const tab = cfg.invoicesTab(selectedId!, selectedItem?.name || "");
          openTab(tab);
        }}
      >
        <ShoppingBag className="w-4 h-4 ml-2 text-blue-500" />
        {entityName === "customer" ? "مبيعات العميل" : "مشتريات المورد"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        disabled={!selectedId}
        onClick={() => {
          const tab = cfg.statementPath(selectedId!, selectedItem?.name || "");
          openTab(tab);
        }}
      >
        <Printer className="w-4 h-4 ml-2 text-emerald-500" /> طباعة كشف حساب
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        disabled={!selectedId}
        onClick={() => {
          setPanelMode('return');
        }}
      >
        <Undo2 className="w-4 h-4 ml-2 text-amber-500" />
        {entityName === "customer" ? "مرتجع مبيعات" : "مرتجع مشتريات"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        disabled={!selectedId}
        onClick={() => {
          setPanelMode('payment');
        }}
      >
        {entityName === "customer"
          ? <Receipt className="w-4 h-4 ml-2 text-amber-500" />
          : <DollarSign className="w-4 h-4 ml-2 text-rose-500" />
        }
        {entityName === "customer" ? "إنشاء سند قبض" : "إنشاء سند دفع"}
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        onClick={handleExport}
      >
        <Download className="w-4 h-4 ml-2 text-slate-500" /> تصدير إكسل
      </Button>

      <div className="h-6 w-px bg-slate-200 mx-1" />

      <Button size="sm" onClick={handleOpenAddWithAccounts} className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
        <Plus className="w-4 h-4 ml-2" /> {cfg.addButtonLabel}
      </Button>
    </div>
  );

  // ── Side panel ──

  const sidePanel = panelMode === 'form' ? (
    <PartnerFormPanel
      type={entityName}
      partner={editItem}
      accounts={accounts}
      onSave={handlePartnerSave}
      onClose={() => setPanelMode(null)}
      saving={saving}
    />
  ) : panelMode === 'return' && selectedItem ? (
    <ReturnFromMaterialPanel
      onClose={() => setPanelMode(null)}
      onSaved={() => refresh(true)}
      initialReturnType={cfg.returnReturnType}
      initialPartyId={selectedItem.id}
    />
  ) : panelMode === 'payment' && selectedItem ? (
    <PaymentForm
      config={cfg.paymentConfig(selectedItem)}
      onSave={handleSavePayment}
      onClose={() => setPanelMode(null)}
      saving={paymentSaving}
    />
  ) : panelMode === 'detail' && selectedItem ? (
    <PartnerDetailPanel
      type={entityName}
      partner={selectedItem}
      onClose={() => { setSelectedId(null); setPanelMode(null); }}
      onEdit={(p) => { void handleOpenEditWithAccounts(p as CustomerDto | SupplierDto); }}
      onDelete={(id) => { setSelectedId(null); handleDelete(id); }}
      onRefresh={() => refresh(true)}
    />
  ) : null;

  return (
    <OperationalTableTemplate
      title={cfg.title}
      toolbar={toolbar}
      tableContent={
        <PartyTable
          entityName={entityName}
          data={items}
          loading={isLoading}
          search={search}
          onSearchChange={setSearch}
          onView={(item) => { setSelectedId(item.id); setPanelMode('detail'); }}
          onEdit={(item) => { void handleOpenEditWithAccounts(item as unknown as CustomerDto | SupplierDto); }}
          onDelete={(id) => { setSelectedId(null); handleDelete(id); }}
          onJournal={(item) => {
            const party = item as unknown as CustomerDto | SupplierDto;
            if (party.account_id) {
              openTab({
                id: `ledger-${party.account_id}`,
                title: `حركة: ${item.name}`,
                path: `/accounting/account-ledger/${party.account_id}`,
                closable: true,
              });
            }
          }}
          onDocument={(item) => { setSelectedId(item.id); setPanelMode('payment'); }}
          selectedId={selectedId}
          onVisibleColumnsChange={setVisibleColumnIds}
        />
      }
      sidePanel={sidePanel}
      isPanelOpen={!!sidePanel}
    />
  );
}
