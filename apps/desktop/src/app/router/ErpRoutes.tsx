import type { ReactElement } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useCompanyTypeSettings, useCompanyInitState } from '@shared/hooks';
import {
  companyCapabilities,
  companyTypeOf,
} from '@modules/opening-balance/lib/company-lifecycle';
import Dashboard from '@modules/dashboard/pages/dashboard';
import Accounting from '@modules/accounting/chart-of-accounts/pages/accounting';
import Journal from '@modules/accounting/journal/pages/journal';
import PartyPage from '@modules/partners/pages/PartyPage';
import PartyStatementPage from '@modules/partners/pages/PartyStatementPage';
import SalesInvoices from '@modules/invoicing/pages/salesInvoices';
import PurchaseInvoices from '@modules/invoicing/pages/purchaseInvoices';
import SalesReturns from '@modules/invoicing/pages/salesReturns';
import PurchaseReturns from '@modules/invoicing/pages/purchaseReturns';
import Payments from '@modules/payments/pages/payments';
import Materials from '@modules/inventory/pages/materials';
import Categories from '@modules/inventory/pages/categories';
import Inventory from '@modules/inventory/pages/inventory';
import Transfers from '@modules/inventory/pages/transfers';
import Warehouses from '@modules/inventory/pages/warehouses';
import Damaged from '@modules/inventory/pages/damaged';
import Production from '@modules/inventory/pages/production';
import OpeningBalance from '@modules/opening-balance/pages/openingBalance';
import OpeningBalanceMigration from '@modules/opening-balance/pages/openingBalanceMigration';
import Adjustments from '@modules/inventory/pages/adjustments';
import MaterialMovementsPage from '@modules/inventory/pages/MaterialMovementsPage';
import Users from '@modules/users/pages/users';
import Settings from '@modules/core/settings/pages/settings';
import AuditLog from '@modules/audit/pages/auditLog';
import Partners from '@modules/partners/pages/partners';

import FixedAssets from '@modules/fixed-assets/pages/fixedAssets';

import Expenses from '@modules/expenses/pages/expenses';

import AccountMovementsReport from '@modules/reports/pages/AccountMovementsReport';
import AccountMovement from '@modules/accounting/account-movements/pages/accountMovement';
import IncomeStatementReport from '@modules/reports/pages/IncomeStatementReport';
import TrialBalanceReport from '@modules/reports/pages/TrialBalanceReport';
import BalanceSheetReport from '@modules/reports/pages/BalanceSheetReport';
import PartnerProfitShareReport from '@modules/reports/pages/PartnerProfitShareReport';
import PartnerStatementReport from '@modules/reports/pages/PartnerStatementReport';
import FiscalPeriodsPage from '@modules/accounting/fiscal-periods/pages/FiscalPeriodsPage';

// Phase 5: while an EXISTING company is still in its opening workflow
// (before OPENING_LOCKED), daily-log transactional pages are blocked and
// redirected to the opening migration; master-data / opening pages stay open.
// Until the lifecycle queries resolve we stay permissive to avoid flash-gating.
function OpeningTransactionGate({ children }: { children: ReactElement }) {
  const settings = useCompanyTypeSettings();
  const { initState, isReady } = useCompanyInitState();
  const capabilities = companyCapabilities(
    companyTypeOf(settings),
    isReady ? initState : 'ACTIVE',
  );
  if (!capabilities.isNormalAccountingEnabled) {
    return <Navigate to="/opening-balance-migration" replace />;
  }
  return children;
}

export function ErpRoutes({ location }: { location?: string | Partial<Location> }) {
  return (
    <Routes location={location}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/partners" element={<Partners />} />
      <Route path="/accounting" element={<Accounting />} />
      <Route path="/accounting/reports/ledger" element={<AccountMovementsReport />} />
      <Route path="/accounting/reports/movements" element={<AccountMovementsReport />} />
      <Route path="/accounting/reports/income" element={<IncomeStatementReport />} />
      <Route path="/accounting/reports/trial-balance" element={<TrialBalanceReport />} />
      <Route path="/accounting/reports/balance-sheet" element={<BalanceSheetReport />} />
      <Route path="/accounting/reports/partner-profit-share" element={<PartnerProfitShareReport />} />
      <Route path="/accounting/reports/partner-statement" element={<PartnerStatementReport />} />
      <Route path="/accounting/fiscal-periods" element={<FiscalPeriodsPage />} />
      <Route path="/accounting/reports/fiscal-periods" element={<Navigate to="/accounting/fiscal-periods" replace />} />
      <Route path="/accounting/account-ledger/:accountId" element={<AccountMovement />} />
      <Route path="/journal" element={<OpeningTransactionGate><Journal /></OpeningTransactionGate>} />
      <Route path="/customers" element={<PartyPage entityName="customer" />} />
      <Route path="/partners/customer-statement/:id" element={<PartyStatementPage entityName="customer" />} />
      <Route path="/suppliers" element={<PartyPage entityName="supplier" />} />
      <Route path="/partners/supplier-statement/:id" element={<PartyStatementPage entityName="supplier" />} />
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/sales-invoices" element={<OpeningTransactionGate><SalesInvoices /></OpeningTransactionGate>} />
      <Route path="/sales-invoices/new/*" element={<OpeningTransactionGate><SalesInvoices /></OpeningTransactionGate>} />
      <Route path="/sales-invoices/:id" element={<OpeningTransactionGate><SalesInvoices /></OpeningTransactionGate>} />
      <Route path="/purchase-invoices" element={<OpeningTransactionGate><PurchaseInvoices /></OpeningTransactionGate>} />
      <Route path="/purchase-invoices/new/*" element={<OpeningTransactionGate><PurchaseInvoices /></OpeningTransactionGate>} />
      <Route path="/purchase-invoices/:id" element={<OpeningTransactionGate><PurchaseInvoices /></OpeningTransactionGate>} />
      <Route path="/sales-returns" element={<OpeningTransactionGate><SalesReturns /></OpeningTransactionGate>} />
      <Route path="/sales-returns/new/*" element={<OpeningTransactionGate><SalesReturns /></OpeningTransactionGate>} />
      <Route path="/sales-returns/:id" element={<OpeningTransactionGate><SalesReturns /></OpeningTransactionGate>} />
      <Route path="/purchase-returns" element={<OpeningTransactionGate><PurchaseReturns /></OpeningTransactionGate>} />
      <Route path="/purchase-returns/new/*" element={<OpeningTransactionGate><PurchaseReturns /></OpeningTransactionGate>} />
      <Route path="/purchase-returns/:id" element={<OpeningTransactionGate><PurchaseReturns /></OpeningTransactionGate>} />
      <Route path="/payments" element={<OpeningTransactionGate><Payments /></OpeningTransactionGate>} />
      <Route path="/materials" element={<Materials />} />
      <Route path="/categories" element={<Categories />} />
      <Route path="/inventory" element={<OpeningTransactionGate><Inventory /></OpeningTransactionGate>} />
      <Route path="/inventory/transfers" element={<OpeningTransactionGate><Transfers /></OpeningTransactionGate>} />
      <Route path="/inventory/warehouses" element={<Warehouses />} />
      <Route path="/inventory/purchases/:materialId" element={<OpeningTransactionGate><MaterialMovementsPage /></OpeningTransactionGate>} />
      <Route path="/inventory/sales/:materialId" element={<OpeningTransactionGate><MaterialMovementsPage /></OpeningTransactionGate>} />
      <Route path="/damaged" element={<OpeningTransactionGate><Damaged /></OpeningTransactionGate>} />
      <Route path="/production" element={<OpeningTransactionGate><Production /></OpeningTransactionGate>} />
      <Route path="/opening-balance" element={<OpeningBalance />} />
      <Route path="/opening-balance/new/*" element={<OpeningBalance />} />
      <Route path="/opening-balance/:id" element={<OpeningBalance />} />
      <Route path="/opening-balance-migration" element={<OpeningBalanceMigration />} />
      <Route path="/opening-balance-wizard" element={<Navigate to="/opening-balance-migration" replace />} />
      <Route path="/adjustments" element={<OpeningTransactionGate><Adjustments /></OpeningTransactionGate>} />
      <Route path="/users" element={<Users />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/audit-log" element={<AuditLog />} />
      <Route path="/fixed-assets" element={<FixedAssets />} />
      <Route path="/currencies" element={<Navigate to="/settings" replace />} />
    </Routes>
  );
}
