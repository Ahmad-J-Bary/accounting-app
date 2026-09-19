import { useEffect, useState, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Toaster } from '@shared/ui/sonner';
import { TooltipProvider } from '@shared/ui/tooltip';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppearanceProvider } from '@app/providers/AppearanceProvider';
import { UiPreferencesProvider } from '@app/providers/UiPreferencesProvider';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@app/shell/AppLayout';
import { TabProvider } from './app/providers/TabProvider';
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
import { LanguageSelector } from '@modules/core/setup/components/LanguageSelector';
import { isValidLanguage, type AppLanguage } from '@shared/types/i18n';
import { currencyService } from '@modules/core/api/currencyService';
import { StartupWindowShell } from '@app/shell/StartupWindowShell';

const LANGUAGE_KEY = "erp_language";

function loadPersistedLanguage(): AppLanguage | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  return isValidLanguage(stored) ? stored : null;
}

const App = () => {
  const [language, setLanguage] = useState<AppLanguage | null>(loadPersistedLanguage);
  // null = fresh install (nothing persisted yet). true/false = result of
  // the single is_setup_complete check done ONLY when a language exists.
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  // true once the check has resolved OR the user made an explicit choice.
  const [checkedSetup, setCheckedSetup] = useState(false);
  const explicitChoiceRef = useRef(false);

  // FRESH INSTALL / NO PERSISTED LANGUAGE: resolve IMMEDIATELY, zero IPC.
  // The selector below renders BEFORE any provider, any router, any IPC.
  useEffect(() => {
    if (language) return;
    setCheckedSetup(true);
  }, [language]);

  // LANGUAGE EXISTS: run the single authoritative setup-state check. This
  // distinguishes a returning configured user from a "data-reset" user who
  // still has erp_language in localStorage but whose setup is incomplete.
  useEffect(() => {
    if (!language || explicitChoiceRef.current) return;
    let cancelled = false;
    currencyService
      .isSetupComplete()
      .then((complete) => {
        if (!cancelled) {
          setSetupComplete(complete);
          setCheckedSetup(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSetupComplete(false);
          setCheckedSetup(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const handleLanguageSelected = useCallback((lang: AppLanguage) => {
    localStorage.setItem(LANGUAGE_KEY, lang);
    explicitChoiceRef.current = true;
    setLanguage(lang);
    // Explicit choice ALWAYS proceeds: the user already expressed intent by
    // clicking, so the language gate must not trap them again.
    setCheckedSetup(true);
    setSetupComplete(true);
  }, []);

  // LANGUAGE NOT CHOSEN YET: show the selector IMMEDIATELY.
  // This renders BEFORE any IPC, any provider, any router.
  if (!language) {
    return <LanguageSelector onComplete={handleLanguageSelected} />;
  }

  if (!checkedSetup) {
    return (
      <StartupWindowShell title="المواكب" subtitle="جاري التحقق من الإعدادات">
        <div className="flex min-h-full w-full items-center justify-center bg-muted">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </StartupWindowShell>
    );
  }

  // LANGUAGE EXISTS + SETUP INCOMPLETE (data was reset but erp_language
  // lingered in WebView localStorage): show the selector again so first
  // "fresh-start" language intent is re-expressed. initialLanguage is a
  // VISUAL default only # never auto-persisted.
  if (!setupComplete) {
    return (
      <LanguageSelector
        initialLanguage={language}
        onComplete={handleLanguageSelected}
      />
    );
  }

  // LANGUAGE EXISTS + SETUP COMPLETE: skip the selector, normal startup.
  return <NormalStartup />;
};

function NormalStartup() {
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
      <StartupWindowShell title="المواكب" subtitle="جاري تشغيل التطبيق">
        <div className="flex min-h-full w-full items-center justify-center bg-muted">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </StartupWindowShell>
    );
  }

  if (block?.reason === 'newer-schema') {
    return <UpdateRequiredScreen block={block} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <UiPreferencesProvider>
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
      </UiPreferencesProvider>
    </QueryClientProvider>
  );
}

export default App;
