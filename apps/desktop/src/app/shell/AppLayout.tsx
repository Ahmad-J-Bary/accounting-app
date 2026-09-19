import { useState, useMemo, useEffect, useCallback } from 'react';
import { ErpRoutes } from '@app/router/ErpRoutes';
import { useTabs } from '@app/providers/TabContext';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';
import { TabLocationContext } from '@app/providers/TabLocationContext';
import { cn } from '@shared/lib/utils';
import { useKeyboardShortcuts } from '@shared/hooks/useKeyboardShortcuts';
import { useAppearance } from '@shared/hooks/useAppearance';
import { useResponsiveContext } from '@shared/hooks/useResponsiveContext';
import { FloatingExchangeRateWidget } from '@modules/core/currencies/components/FloatingExchangeRateWidget';
import { useCurrencyContext } from '@app/providers/CurrencyContext';
import { warehouseService } from '@modules/inventory/api/warehouseService';
import { VerticalLayout } from './layouts/VerticalLayout';
import { TopNavLayout } from './layouts/TopNavLayout';
import { HorizontalLayout } from './layouts/HorizontalLayout';
import { ComboLayout } from './layouts/ComboLayout';
import { DefaultVerticalLayout } from './layouts/DefaultVerticalLayout';
import { DefaultTopNavLayout } from './layouts/DefaultTopNavLayout';
import { DefaultHorizontalLayout } from './layouts/DefaultHorizontalLayout';
import { DefaultComboLayout } from './layouts/DefaultComboLayout';
import { MobileNav } from './MobileNav';
import { UpdateProvider } from '@modules/core/update/context/UpdateContext';
import { useGlobalSearch } from '@app/providers/useGlobalSearch';
import { useCommands } from '@app/providers/useCommands';
import { GlobalSearch } from './GlobalSearch';
import { VoiceAssistantOverlay } from './VoiceAssistantOverlay';
import { BarcodeScanDialog } from '@shared/ui/BarcodeScanDialog';
import { useLocalization } from '@app/providers/LocalizationProvider';
import { WorkspaceTabContext } from '@app/providers/WorkspaceTabContext';
import { DefaultWorkspace } from './DefaultWorkspace';
import { BrowserWorkspace } from './BrowserWorkspace';
import { VSCodeWorkspace } from './VSCodeWorkspace';

interface AppLayoutProps {
  title?: string;
  subtitle?: string;
}

export function AppLayout({ title, subtitle }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { tabs } = useTabs();
  const { activeLayout, settings } = useAppearance();
  const { isMobile, isTablet } = useResponsiveContext();
  const { hasMultipleCurrencies } = useCurrencyContext();
  const { openSearch } = useGlobalSearch();
  const { executeCommand } = useCommands();
  const { direction, t } = useLocalization();

  useEffect(() => {
    warehouseService.ensureDefaultWarehouse().catch(() => {});
  }, []);

  const [isExchangeVisible, setIsExchangeVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('erp_exchange_visible') !== 'false';
    }
    return true;
  });

  const toggleExchange = useCallback(() => {
    setIsExchangeVisible((prev) => {
      localStorage.setItem('erp_exchange_visible', String(!prev));
      return !prev;
    });
  }, []);

  const shortcuts = useMemo(() => [
    { key: 'k', ctrlKey: true, action: () => openSearch(), description: t('shortcuts.openSearch', { namespace: 'shell' }) },
    { key: 'n', ctrlKey: true, action: () => executeCommand('new-sales-invoice'), description: t('shortcuts.newSalesInvoice', { namespace: 'shell' }) },
    { key: 'b', ctrlKey: true, action: () => executeCommand('new-purchase-invoice'), description: t('shortcuts.newPurchaseInvoice', { namespace: 'shell' }) },
    { key: 'r', ctrlKey: true, action: () => executeCommand('new-opening-balance'), description: t('shortcuts.newOpeningBalance', { namespace: 'shell' }) },
    { key: 'j', ctrlKey: true, action: () => executeCommand('new-journal-entry'), description: t('shortcuts.newJournalEntry', { namespace: 'shell' }) },
  ], [executeCommand, openSearch, t]);

  useKeyboardShortcuts(shortcuts);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const workspaceContent = useMemo(() => (
    <main className="relative flex-1 overflow-hidden bg-muted">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            'absolute inset-0 flex flex-col transition-opacity duration-200',
            tab.active ? 'z-10 opacity-100' : 'pointer-events-none z-0 opacity-0',
          )}
        >
          <div className="flex-1 overflow-auto p-3 md:p-6">
            {(title || subtitle) && tab.active && (
              <div className="mb-6">
                {title && <h1 className="mb-1 text-2xl font-bold text-foreground">{title}</h1>}
                {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
              </div>
            )}
            <WorkspaceTabContext.Provider value={{ tabId: tab.id, path: tab.path, active: tab.active }}>
              <TabLocationContext.Provider value={tab.path}>
                <ErrorBoundary key={tab.id}>
                  <ErpRoutes location={tab.path} />
                </ErrorBoundary>
              </TabLocationContext.Provider>
            </WorkspaceTabContext.Provider>
          </div>
        </div>
      ))}
    </main>
  ), [subtitle, tabs, title]);

  const sharedOverlays = useMemo(() => (
    <>
      {hasMultipleCurrencies && (
        <FloatingExchangeRateWidget
          isVisible={isExchangeVisible}
          onClose={toggleExchange}
        />
      )}
      <GlobalSearch />
      <VoiceAssistantOverlay />
      <BarcodeScanDialog />
    </>
  ), [hasMultipleCurrencies, isExchangeVisible, toggleExchange]);

  const effectiveSidebarOpen = isTablet ? false : sidebarOpen;

  const renderDefaultLayout = () => {
    if (isMobile) {
      return (
        <div className="flex h-full flex-col overflow-hidden pb-14">
          <div className="min-h-0 flex flex-1 flex-col">
            {workspaceContent}
          </div>
          <MobileNav />
        </div>
      );
    }

    switch (activeLayout.shellVariant) {
      case 'topnav':
        return (
          <DefaultTopNavLayout isExchangeVisible={isExchangeVisible} onToggleExchange={toggleExchange}>
            {workspaceContent}
          </DefaultTopNavLayout>
        );
      case 'horizontal':
        return (
          <DefaultHorizontalLayout isExchangeVisible={isExchangeVisible} onToggleExchange={toggleExchange}>
            {workspaceContent}
          </DefaultHorizontalLayout>
        );
      case 'combo':
        return (
          <DefaultComboLayout
            sidebarOpen={effectiveSidebarOpen}
            onToggleSidebar={handleToggleSidebar}
            isExchangeVisible={isExchangeVisible}
            onToggleExchange={toggleExchange}
          >
            {workspaceContent}
          </DefaultComboLayout>
        );
      case 'vertical':
      default:
        return (
          <DefaultVerticalLayout
            sidebarOpen={effectiveSidebarOpen}
            onToggleSidebar={handleToggleSidebar}
            isExchangeVisible={isExchangeVisible}
            onToggleExchange={toggleExchange}
          >
            {workspaceContent}
          </DefaultVerticalLayout>
        );
    }
  };

  const renderStandardLayout = () => {
    if (isMobile) {
      return (
        <div className="flex h-full flex-col overflow-hidden pb-14">
          <div className="min-h-0 flex flex-1 flex-col">
            {workspaceContent}
          </div>
          <MobileNav />
        </div>
      );
    }

    switch (activeLayout.shellVariant) {
      case 'topnav':
        return <TopNavLayout>{workspaceContent}</TopNavLayout>;
      case 'horizontal':
        return <HorizontalLayout>{workspaceContent}</HorizontalLayout>;
      case 'combo':
        return (
          <ComboLayout sidebarOpen={effectiveSidebarOpen} onToggleSidebar={handleToggleSidebar}>
            {workspaceContent}
          </ComboLayout>
        );
      case 'vertical':
      default:
        return (
          <VerticalLayout sidebarOpen={effectiveSidebarOpen} onToggleSidebar={handleToggleSidebar}>
            {workspaceContent}
          </VerticalLayout>
        );
    }
  };

  return (
    <UpdateProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background" dir={direction} data-tab-style={settings.tabStyle}>
        {settings.tabStyle === 'vscode' ? (
          <VSCodeWorkspace
            content={workspaceContent}
            isExchangeVisible={isExchangeVisible}
            onToggleExchange={toggleExchange}
          />
        ) : settings.tabStyle === 'browser' ? (
          <BrowserWorkspace
            isExchangeVisible={isExchangeVisible}
            onToggleExchange={toggleExchange}
          >
            {renderStandardLayout()}
          </BrowserWorkspace>
        ) : (
          <DefaultWorkspace>
            {renderDefaultLayout()}
          </DefaultWorkspace>
        )}
        {sharedOverlays}
      </div>
    </UpdateProvider>
  );
}
