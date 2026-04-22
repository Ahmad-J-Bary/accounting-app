import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/erp/AppLayout';
import Dashboard from './pages/Dashboard';
import Accounting from './pages/Accounting';
import Journal from './pages/Journal';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Suppliers from './pages/Suppliers';
import SalesInvoices from './pages/SalesInvoices';
import PurchaseInvoices from './pages/PurchaseInvoices';
import Payments from './pages/Payments';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Inventory from './pages/Inventory';
import Damaged from './pages/Damaged';
import Production from './pages/Production';
import Adjustments from './pages/Adjustments';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';
import AuditLog from './pages/AuditLog';
import Assets from './pages/Assets';
import InvoiceDetail from './pages/InvoiceDetail';
import AuthCallback from './pages/AuthCallback';
import AuthError from './pages/AuthError';
import Index from './pages/Index';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/error" element={<AuthError />} />
          
          {/* ERP Routes with AppLayout */}
          <Route path="/*" element={
            <AppLayout>
              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/accounting" element={<Accounting />} />
                <Route path="/journal" element={<Journal />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/sales-invoices" element={<SalesInvoices />} />
                <Route path="/sales-invoices/:id" element={<InvoiceDetail />} />
                <Route path="/purchase-invoices" element={<PurchaseInvoices />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/damaged" element={<Damaged />} />
                <Route path="/production" element={<Production />} />
                <Route path="/adjustments" element={<Adjustments />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/users" element={<Users />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/audit-log" element={<AuditLog />} />
                <Route path="/assets" element={<Assets />} />
              </Routes>
            </AppLayout>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
