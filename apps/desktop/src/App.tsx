import { useEffect, useState } from 'react';
import { Toaster } from '@shared/ui/sonner';
import { TooltipProvider } from '@shared/ui/tooltip';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppearanceProvider } from '@app/providers/AppearanceProvider';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@app/shell/AppLayout';
import { TabProvider } from '@app/providers/TabProvider';
import { CurrencyProvider } from '@app/providers/CurrencyProvider';
import { TableSettingsProvider } from '@app/providers/TableSettingsProvider';
import { SidePanelSettingsProvider } from '@app/providers/SidePanelSettingsProvider';
import { NavSidebarSettingsProvider } from '@app/providers/NavSidebarSettingsProvider';
import { SidebarLayoutProvider } from '@app/providers/SidebarLayoutProvider';
import AuthCallback from '@modules/auth/pages/authCallback';
import AuthError from '@modules/auth/pages/authError';
import Index from '@modules/auth/pages/index';
import SetupWizard from '@modules/core/setup/pages/setupWizard';
import UpdateRequiredScreen from '@modules/core/setup/pages/UpdateRequiredScreen';
import { backupService, type StartupBlockInfo } from '@modules/core/api/backupService';
import { queryClient } from '@shared/hooks/queryClient';
import { LocalizationProvider } from '@app/providers/LocalizationProvider';
import { WindowProvider } from '@app/providers/WindowProvider';
import { CommandProvider } from '@app/providers/CommandProvider';
import { GlobalSearchProvider } from '@app/providers/GlobalSearchProvider';
import { VoiceProvider } from '@app/providers/VoiceProvider';
import { BarcodeScannerProvider } from '@app/providers/BarcodeScannerProvider';
import { ResponsiveProvider } from '@app/providers/ResponsiveProvider';

const App = () => {
  const [block, setBlock] = useState<StartupBlockInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void backupService
      .getStartupBlock()
      .then((b) => {
        if (!cancelled) setBlock(b);
      })
      .catch(() => {
        if (!cancelled) setBlock(null);
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked) {
    return (
      <div dir="rtl" className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (block?.reason === 'newer-schema') {
    return <UpdateRequiredScreen block={block} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>
        <LocalizationProvider>
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
                    <ResponsiveProvider>
                      <TableSettingsProvider>
                        <SidePanelSettingsProvider>
                          <NavSidebarSettingsProvider>
                            <SidebarLayoutProvider>
                              <TabProvider>
                                <WindowProvider>
                                  <CommandProvider>
                                    <GlobalSearchProvider>
                                      <VoiceProvider>
                                        <BarcodeScannerProvider>
                                          <AppLayout />
                                        </BarcodeScannerProvider>
                                      </VoiceProvider>
                                    </GlobalSearchProvider>
                                  </CommandProvider>
                                </WindowProvider>
                              </TabProvider>
                            </SidebarLayoutProvider>
                          </NavSidebarSettingsProvider>
                        </SidePanelSettingsProvider>
                      </TableSettingsProvider>
                    </ResponsiveProvider>
                  </CurrencyProvider>
                } />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </LocalizationProvider>
      </AppearanceProvider>
    </QueryClientProvider>
  );
};

export default App;
