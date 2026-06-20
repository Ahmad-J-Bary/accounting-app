import { Toaster } from '@shared/ui/sonner';
import { TooltipProvider } from '@shared/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@app/shell/AppLayout';
import { TabProvider } from '@app/providers/TabProvider';
import { CurrencyProvider } from '@app/providers/CurrencyProvider';
import { TableSettingsProvider } from '@app/providers/TableSettingsProvider';
import { SidePanelSettingsProvider } from '@app/providers/SidePanelSettingsProvider';
import { NavSidebarSettingsProvider } from '@app/providers/NavSidebarSettingsProvider';
import { SidebarLayoutProvider } from '@app/providers/SidebarLayoutProvider';
import { ErpRoutes } from '@app/router/ErpRoutes';
import AuthCallback from '@modules/core/pages/authCallback';
import AuthError from '@modules/core/pages/authError';
import Index from '@modules/core/pages/index';
import SetupWizard from '@modules/core/pages/setupWizard';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/error" element={<AuthError />} />
          <Route path="/setup" element={<SetupWizard />} />
          
          {/* ERP Routes with AppLayout */}
          <Route path="/*" element={
            <CurrencyProvider>
              <TableSettingsProvider>
                <SidePanelSettingsProvider>
                  <NavSidebarSettingsProvider>
                    <SidebarLayoutProvider>
                      <TabProvider>
                        <AppLayout />
                      </TabProvider>
                    </SidebarLayoutProvider>
                  </NavSidebarSettingsProvider>
                </SidePanelSettingsProvider>
              </TableSettingsProvider>
            </CurrencyProvider>
          } />
        </Routes>
      </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
