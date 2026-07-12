import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from '@modules/core/pages/dashboard';
import Accounting from '@modules/accounting/pages/accounting';
import Journal from '@modules/accounting/pages/journal';
import Customers from '@modules/partners/pages/customers';
import Suppliers from '@modules/partners/pages/suppliers';
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
import OpeningBalance from '@modules/accounting/pages/openingBalance';
import Adjustments from '@modules/inventory/pages/adjustments';
import MaterialMovementsPage from '@modules/inventory/pages/MaterialMovementsPage';
import Reports from '@modules/core/pages/reports';
import Users from '@modules/core/pages/users';
import Settings from '@modules/core/pages/settings';
import AuditLog from '@modules/core/pages/auditLog';
import Partners from '@modules/partners/pages/partners';
import CustomerStatementPage from '@modules/partners/pages/customerStatementPage';
import SupplierStatementPage from '@modules/partners/pages/supplierStatementPage';
import FixedAssets from '@modules/fixed-assets/pages/fixedAssets';

import Expenses from '@modules/accounting/pages/expenses';

import AccountingJournalsReport from '@modules/accounting/pages/AccountingJournalsReport';
import AccountMovementsReport from '@modules/accounting/pages/AccountMovementsReport';
import AccountMovement from '@modules/accounting/pages/accountMovement';
import IncomeStatementReport from '@modules/accounting/pages/IncomeStatementReport';
import TrialBalanceReport from '@modules/accounting/pages/TrialBalanceReport';
import BalanceSheetReport from '@modules/accounting/pages/BalanceSheetReport';
import PartnerProfitShareReport from '@modules/accounting/pages/PartnerProfitShareReport';
import PartnerStatementReport from '@modules/accounting/pages/PartnerStatementReport';

export function ErpRoutes({ location }: { location?: string | Partial<Location> }) {
  return (
    <Routes location={location}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/partners" element={<Partners />} />
      <Route path="/accounting" element={<Accounting />} />
      <Route path="/accounting/journals" element={<AccountingJournalsReport />} />
      <Route path="/accounting/reports/ledger" element={<AccountMovementsReport />} />
      <Route path="/accounting/reports/movements" element={<AccountMovementsReport />} />
      <Route path="/accounting/reports/income" element={<IncomeStatementReport />} />
      <Route path="/accounting/reports/trial-balance" element={<TrialBalanceReport />} />
      <Route path="/accounting/reports/balance-sheet" element={<BalanceSheetReport />} />
      <Route path="/accounting/reports/partner-profit-share" element={<PartnerProfitShareReport />} />
      <Route path="/accounting/reports/partner-statement" element={<PartnerStatementReport />} />
      <Route path="/accounting/account-ledger/:accountId" element={<AccountMovement />} />
      <Route path="/journal" element={<Journal />} />
      <Route path="/customers" element={<Customers />} />
      <Route path="/partners/customer-statement/:id" element={<CustomerStatementPage />} />
      <Route path="/suppliers" element={<Suppliers />} />
      <Route path="/partners/supplier-statement/:id" element={<SupplierStatementPage />} />
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
      <Route path="/adjustments" element={<Adjustments />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/users" element={<Users />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/audit-log" element={<AuditLog />} />
      <Route path="/fixed-assets" element={<FixedAssets />} />
      <Route path="/currencies" element={<Navigate to="/settings" replace />} />
    </Routes>
  );
}
