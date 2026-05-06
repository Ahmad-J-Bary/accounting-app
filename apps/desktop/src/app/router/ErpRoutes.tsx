import { Routes, Route } from 'react-router-dom';
import Dashboard from '@modules/core/pages/dashboard';
import Accounting from '@modules/accounting/pages/accounting';
import Journal from '@modules/accounting/pages/journal';
import Customers from '@modules/partners/pages/customers';
import Suppliers from '@modules/partners/pages/suppliers';
import SalesInvoices from '@modules/invoicing/pages/salesInvoices';
import PurchaseInvoices from '@modules/invoicing/pages/purchaseInvoices';
import Payments from '@modules/payments/pages/payments';
import Materials from '@modules/inventory/pages/materials';
import Categories from '@modules/inventory/pages/categories';
import Inventory from '@modules/inventory/pages/inventory';
import Damaged from '@modules/inventory/pages/damaged';
import Production from '@modules/inventory/pages/production';
import OpeningBalance from '@modules/accounting/pages/openingBalance';
import Adjustments from '@modules/inventory/pages/adjustments';
import Reports from '@modules/core/pages/reports';
import Users from '@modules/core/pages/users';
import Settings from '@modules/core/pages/settings';
import AuditLog from '@modules/core/pages/auditLog';
import Partners from '@modules/partners/pages/partners';
import Assets from '@modules/assets/pages/assets';
import InvoiceDetail from '@modules/invoicing/pages/invoiceDetail';
import CurrencySettings from '@modules/core/pages/currencySettings';

export function ErpRoutes({ location }: { location?: string | Partial<Location> }) {
  return (
    <Routes location={location}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/partners" element={<Partners />} />
      <Route path="/accounting" element={<Accounting />} />
      <Route path="/journal" element={<Journal />} />
      <Route path="/customers" element={<Customers />} />
      <Route path="/suppliers" element={<Suppliers />} />
      <Route path="/sales-invoices" element={<SalesInvoices />} />
      <Route path="/sales-invoices/new/*" element={<SalesInvoices />} />
      <Route path="/sales-invoices/:id" element={<SalesInvoices />} />
      <Route path="/purchase-invoices" element={<PurchaseInvoices />} />
      <Route path="/purchase-invoices/new/*" element={<PurchaseInvoices />} />
      <Route path="/purchase-invoices/:id" element={<PurchaseInvoices />} />
      <Route path="/payments" element={<Payments />} />
      <Route path="/materials" element={<Materials />} />
      <Route path="/categories" element={<Categories />} />
      <Route path="/inventory" element={<Inventory />} />
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
      <Route path="/assets" element={<Assets />} />
      <Route path="/currencies" element={<CurrencySettings />} />
    </Routes>
  );
}
