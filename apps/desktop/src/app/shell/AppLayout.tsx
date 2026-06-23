import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ErpRoutes } from '@app/router/ErpRoutes';
import { useTabs } from '@app/providers/TabContext';
import { cn } from '@shared/lib/utils';
import { useKeyboardShortcuts } from '@shared/hooks/useKeyboardShortcuts';
import { useAppearance } from '@shared/hooks/useAppearance';
import { FloatingExchangeRateWidget } from '@modules/core/components/FloatingExchangeRateWidget';
import { UpdateBanner } from '@modules/core/components/UpdateBanner';
import { warehouseService } from '@modules/inventory/api/warehouseService';
import { VerticalLayout } from './layouts/VerticalLayout';
import { TopNavLayout } from './layouts/TopNavLayout';
import { HorizontalLayout } from './layouts/HorizontalLayout';
import { ComboLayout } from './layouts/ComboLayout';
import { TabBar } from './TabBar';

interface AppLayoutProps {
  title?: string;
  subtitle?: string;
}

export function AppLayout({ title, subtitle }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { tabs, openTab } = useTabs();
  const navigate = useNavigate();
  const { activeLayout, settings } = useAppearance();
  const location = useLocation();

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
    { key: 'k', ctrlKey: true, action: () => console.log('Open search'), description: 'فتح البحث' },
    { key: 'n', ctrlKey: true, action: () => {
        const id = `/sales-invoices/new-${Date.now()}`;
        openTab({ 
          id, 
          title: 'فاتورة مبيعات جديدة', 
          path: id,
          closable: true
        });
      }, description: 'فاتورة مبيعات جديدة' },
    { key: 'b', ctrlKey: true, action: () => {
        const id = `/purchase-invoices/new-${Date.now()}`;
        openTab({ 
          id, 
          title: 'فاتورة مشتريات جديدة', 
          path: id,
          closable: true
        });
      }, description: 'فاتورة مشتريات جديدة' },
    { key: 'r', ctrlKey: true, action: () => {
        const id = `/opening-balance/new-${Date.now()}`;
        openTab({ 
          id, 
          title: 'فاتورة أول المدة جديدة', 
          path: id,
          closable: true
        });
      }, description: 'فاتورة أول المدة جديدة' },
    { key: 'j', ctrlKey: true, action: () => {
        const id = `/journal/new-${Date.now()}`;
        openTab({ 
          id, 
          title: 'قيد يومية جديد', 
          path: id,
          closable: true
        });
      }, description: 'قيد يومية جديد' },
  ], [openTab]);

  useKeyboardShortcuts(shortcuts);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  // Render content (tabs + routes) — memoized to preserve reference across shell switches
  const content = useMemo(() => (
    <>
      <UpdateBanner />
      <main className="flex-1 relative bg-slate-100 overflow-hidden">
        {tabs.map((tab) => (
          <div 
            key={tab.id}
            className={cn(
              "absolute inset-0 flex flex-col transition-opacity duration-200",
              tab.active ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            )}
          >
            <div className="flex-1 p-6 overflow-auto">
              {(title || subtitle) && tab.active && (
                <div className="mb-6">
                  {title && <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>}
                  {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
                </div>
              )}
              <ErpRoutes location={tab.path} />
            </div>
          </div>
        ))}
        <FloatingExchangeRateWidget isVisible={isExchangeVisible} onClose={() => toggleExchange()} />
      </main>
    </>
  ), [tabs, isExchangeVisible, title, subtitle]);

  switch (activeLayout.shellVariant) {
    case 'topnav':
      return (
        <div className="min-h-screen bg-gray-50 overflow-hidden" dir="rtl">
          <TopNavLayout isExchangeVisible={isExchangeVisible} onToggleExchange={toggleExchange}>
            {content}
          </TopNavLayout>
        </div>
      );
    case 'horizontal':
      return (
        <div className="min-h-screen bg-gray-50 overflow-hidden" dir="rtl">
          <HorizontalLayout isExchangeVisible={isExchangeVisible} onToggleExchange={toggleExchange}>
            {content}
          </HorizontalLayout>
        </div>
      );
    case 'combo':
      return (
        <div className="min-h-screen bg-gray-50 overflow-hidden" dir="rtl">
          <ComboLayout sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} isExchangeVisible={isExchangeVisible} onToggleExchange={toggleExchange}>
            {content}
          </ComboLayout>
        </div>
      );
    case 'vertical':
    default:
      return (
        <div className="min-h-screen bg-gray-50 overflow-hidden" dir="rtl">
          <VerticalLayout sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} isExchangeVisible={isExchangeVisible} onToggleExchange={toggleExchange}>
            {content}
          </VerticalLayout>
        </div>
      );
  }
}
