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
import { MobileNav } from './MobileNav';
import { UpdateProvider } from '@modules/core/update/context/UpdateContext';
import { useGlobalSearch } from '@app/providers/GlobalSearchProvider';
import { useCommands } from '@app/providers/CommandProvider';
import { GlobalSearch } from './GlobalSearch';
import { VoiceAssistantOverlay } from './VoiceAssistantOverlay';
import { BarcodeScanDialog } from '@shared/ui/BarcodeScanDialog';
import { useLocalization } from '@app/providers/LocalizationProvider';

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
  const { direction } = useLocalization();

  useEffect(() => {
    warehouseService.ensureDefaultWarehouse().catch(() => {});
  }, []);

  const [isExchangeVisible, setIsExchangeVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('erp_exchange_visible') !== 'false';
    }
    return true;
  });

  const toggleExchange = () => {
    setIsExchangeVisible(prev => {
      localStorage.setItem('erp_exchange_visible', String(!prev));
      return !prev;
    });
  };

  const shortcuts = useMemo(() => [
    { key: 'k', ctrlKey: true, action: () => openSearch(), description: 'فتح البحث' },
    { key: 'n', ctrlKey: true, action: () => executeCommand('new-sales-invoice'), description: 'فاتورة مبيعات جديدة' },
    { key: 'b', ctrlKey: true, action: () => executeCommand('new-purchase-invoice'), description: 'فاتورة مشتريات جديدة' },
    { key: 'r', ctrlKey: true, action: () => executeCommand('new-opening-balance'), description: 'فاتورة أول المدة جديدة' },
    { key: 'j', ctrlKey: true, action: () => executeCommand('new-journal-entry'), description: 'قيد يومية جديد' },
  ], [executeCommand, openSearch]);

  useKeyboardShortcuts(shortcuts);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  // Render content (tabs + routes) — memoized to preserve reference across shell switches
  const content = useMemo(() => (
    <>
      <main className="flex-1 relative bg-slate-100 overflow-hidden">
        {tabs.map((tab) => (
          <div 
            key={tab.id}
            className={cn(
              "absolute inset-0 flex flex-col transition-opacity duration-200",
              tab.active ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            )}
          >
            <div className="flex-1 p-3 md:p-6 overflow-auto">
              {(title || subtitle) && tab.active && (
                <div className="mb-6">
                  {title && <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>}
                  {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
                </div>
              )}
              <TabLocationContext.Provider value={tab.path}><ErrorBoundary key={tab.id}><ErpRoutes location={tab.path} /></ErrorBoundary></TabLocationContext.Provider>
            </div>
          </div>
        ))}
        {hasMultipleCurrencies && <FloatingExchangeRateWidget isVisible={isExchangeVisible} onClose={() => toggleExchange()} />}
      </main>
      <GlobalSearch />
      <VoiceAssistantOverlay />
      <BarcodeScanDialog />
    </>
  ), [tabs, isExchangeVisible, title, subtitle, hasMultipleCurrencies]);

  return <UpdateProvider>{renderLayout()}</UpdateProvider>;

  function renderLayout() {
    // Mobile: simplified layout with bottom nav
    if (isMobile) {
      return (
        <div className="min-h-screen bg-gray-50 overflow-hidden" dir={direction} data-tab-style={settings.tabStyle}>
          <div className="flex flex-col h-screen pb-14">
            {content}
          </div>
          <MobileNav />
        </div>
      );
    }

    // Tablet: force sidebar collapsed for more content space
    const effectiveSidebarOpen = isTablet ? false : sidebarOpen;

    // Desktop/Tablet: full layout with sidebar
    switch (activeLayout.shellVariant) {
      case 'topnav':
        return (
          <div className="min-h-screen bg-gray-50 overflow-hidden" dir={direction} data-tab-style={settings.tabStyle}>
            <TopNavLayout isExchangeVisible={isExchangeVisible} onToggleExchange={toggleExchange}>
              {content}
            </TopNavLayout>
          </div>
        );
      case 'horizontal':
        return (
          <div className="min-h-screen bg-gray-50 overflow-hidden" dir={direction} data-tab-style={settings.tabStyle}>
            <HorizontalLayout isExchangeVisible={isExchangeVisible} onToggleExchange={toggleExchange}>
              {content}
            </HorizontalLayout>
          </div>
        );
      case 'combo':
        return (
          <div className="min-h-screen bg-gray-50 overflow-hidden" dir={direction} data-tab-style={settings.tabStyle}>
            <ComboLayout sidebarOpen={effectiveSidebarOpen} onToggleSidebar={handleToggleSidebar} isExchangeVisible={isExchangeVisible} onToggleExchange={toggleExchange}>
              {content}
            </ComboLayout>
          </div>
        );
      case 'vertical':
      default:
        return (
          <div className="min-h-screen bg-gray-50 overflow-hidden" dir={direction} data-tab-style={settings.tabStyle}>
            <VerticalLayout sidebarOpen={effectiveSidebarOpen} onToggleSidebar={handleToggleSidebar} isExchangeVisible={isExchangeVisible} onToggleExchange={toggleExchange}>
              {content}
            </VerticalLayout>
          </div>
        );
    }
  }
}
