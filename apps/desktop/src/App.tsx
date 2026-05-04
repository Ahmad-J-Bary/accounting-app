import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/erp/AppLayout';
import { TabProvider } from '@/context/TabContext';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { ErpRoutes } from './ErpRoutes';
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
            <CurrencyProvider>
              <TabProvider>
                <AppLayout />
              </TabProvider>
            </CurrencyProvider>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
