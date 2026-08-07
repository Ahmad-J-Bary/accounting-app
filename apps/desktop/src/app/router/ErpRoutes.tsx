import { Routes, Route, Navigate } from 'react-router-dom';
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
      <Route path="/accounting/account-ledger/:accountId" element={<AccountMovement />} />
      <Route path="/journal" element={<Journal />} />
      <Route path="/customers" element={<PartyPage entityName="customer" />} />
      <Route path="/partners/customer-statement/:id" element={<PartyStatementPage entityName="customer" />} />
      <Route path="/suppliers" element={<PartyPage entityName="supplier" />} />
      <Route path="/partners/supplier-statement/:id" element={<PartyStatementPage entityName="supplier" />} />
      <Route path="/expenses" element={<Expenses />} />
      <Route path="/sales-invoices" element={<SalesInvoices />} />
      <Route path="/sales-invoices/new/*" element={<SalesInvoices />} />
      <Route path="/sales-invoices/:id" element={<SalesInvoices />} />
      <Route path="/purchase-invoices" element={<PurchaseInvoices />} />
      <Route path="/purchase-invoices/new/*" element={<PurchaseInvoices />} />
      <Route path="/purchase-invoices/:id" element={<PurchaseInvoices />} />
      <Route path="/sales-returns" element={<SalesReturns />} />
      <Route path="/sales-returns/new/*" element={<SalesReturns />} />
      <Route path="/sales-returns/:id" element={<SalesReturns />} />
      <Route path="/purchase-returns" element={<PurchaseReturns />} />
      <Route path="/purchase-returns/new/*" element={<PurchaseReturns />} />
      <Route path="/purchase-returns/:id" element={<PurchaseReturns />} />
      <Route path="/payments" element={<Payments />} />
      <Route path="/materials" element={<Materials />} />
      <Route path="/categories" element={<Categories />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/inventory/transfers" element={<Transfers />} />
      <Route path="/inventory/warehouses" element={<Warehouses />} />
      <Route path="/inventory/purchases/:materialId" element={<MaterialMovementsPage />} />
      <Route path="/inventory/sales/:materialId" element={<MaterialMovementsPage />} />
      <Route path="/damaged" element={<Damaged />} />
      <Route path="/production" element={<Production />} />
      <Route path="/opening-balance" element={<OpeningBalance />} />
      <Route path="/opening-balance/new/*" element={<OpeningBalance />} />
      <Route path="/opening-balance/:id" element={<OpeningBalance />} />
      <Route path="/opening-balance-migration" element={<OpeningBalanceMigration />} />
      <Route path="/adjustments" element={<Adjustments />} />
      <Route path="/users" element={<Users />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/audit-log" element={<AuditLog />} />
      <Route path="/fixed-assets" element={<FixedAssets />} />
      <Route path="/currencies" element={<Navigate to="/settings" replace />} />
    </Routes>
  );
}
