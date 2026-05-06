import { Toaster } from '@shared/ui/sonner';
import { TooltipProvider } from '@shared/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@app/shell/AppLayout';
import { TabProvider } from '@app/providers/TabProvider';
import { CurrencyProvider } from '@app/providers/CurrencyProvider';
import { ErpRoutes } from '@app/router/ErpRoutes';
import AuthCallback from '@modules/core/pages/authCallback';
import AuthError from '@modules/core/pages/authError';
import Index from '@modules/core/pages/index';

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
