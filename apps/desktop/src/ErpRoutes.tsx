import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Accounting from './pages/Accounting';
import Journal from './pages/Journal';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Suppliers from './pages/Suppliers';
import SalesInvoices from './pages/SalesInvoices';
import PurchaseInvoices from './pages/PurchaseInvoices';
import Payments from './pages/Payments';
import Materials from './pages/Materials';
import MaterialDetail from './pages/MaterialDetail';
import Categories from './pages/Categories';
import Inventory from './pages/Inventory';
import Damaged from './pages/Damaged';
import Production from './pages/Production';
import OpeningBalance from './pages/OpeningBalance';
import Adjustments from './pages/Adjustments';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';
import AuditLog from './pages/AuditLog';
import Partners from './pages/Partners';
import Assets from './pages/Assets';
import InvoiceDetail from './pages/InvoiceDetail';

export function ErpRoutes({ location }: { location?: string | Partial<Location> }) {
  return (
    <Routes location={location}>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/partners" element={<Partners />} />
      <Route path="/accounting" element={<Accounting />} />
      <Route path="/journal" element={<Journal />} />
      <Route path="/customers" element={<Customers />} />
      <Route path="/customers/:id" element={<CustomerDetail />} />
      <Route path="/suppliers" element={<Suppliers />} />
      <Route path="/sales-invoices" element={<SalesInvoices />} />
      <Route path="/sales-invoices/new*" element={<SalesInvoices />} />
      <Route path="/sales-invoices/:id" element={<SalesInvoices />} />
      <Route path="/purchase-invoices" element={<PurchaseInvoices />} />
      <Route path="/purchase-invoices/new*" element={<PurchaseInvoices />} />
      <Route path="/purchase-invoices/:id" element={<PurchaseInvoices />} />
      <Route path="/payments" element={<Payments />} />
      <Route path="/materials" element={<Materials />} />
      <Route path="/materials/:id" element={<MaterialDetail />} />
      <Route path="/categories" element={<Categories />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route path="/damaged" element={<Damaged />} />
      <Route path="/production" element={<Production />} />
      <Route path="/opening-balance" element={<OpeningBalance />} />
      <Route path="/opening-balance/new*" element={<OpeningBalance />} />
      <Route path="/opening-balance/:id" element={<OpeningBalance />} />
      <Route path="/adjustments" element={<Adjustments />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/users" element={<Users />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/audit-log" element={<AuditLog />} />
      <Route path="/assets" element={<Assets />} />
    </Routes>
  );
}
