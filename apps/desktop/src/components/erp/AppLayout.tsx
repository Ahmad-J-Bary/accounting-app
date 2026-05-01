import { ReactNode, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { TabBar } from './TabBar';
import { ErpRoutes } from '../../ErpRoutes';
import { useTabs } from '@/context/TabContext';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface AppLayoutProps {
  title?: string;
  subtitle?: string;
}

export function AppLayout({ title, subtitle }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { tabs, openTab } = useTabs();
  const navigate = useNavigate();

  const shortcuts = useMemo(() => [
    { key: 'k', ctrlKey: true, action: () => console.log('Open search'), description: 'فتح البحث' },
    { key: 'n', ctrlKey: true, action: () => {
        openTab({ id: '/sales-invoices', title: 'فواتير المبيعات', path: '/sales-invoices' });
        setTimeout(() => window.dispatchEvent(new CustomEvent("erp:open-new-invoice")), 100);
      }, description: 'فاتورة مبيعات جديدة' },
    { key: 'b', ctrlKey: true, action: () => {
        openTab({ id: '/purchase-invoices', title: 'فواتير المشتريات', path: '/purchase-invoices' });
        setTimeout(() => window.dispatchEvent(new CustomEvent("erp:open-new-purchase-invoice")), 100);
      }, description: 'فاتورة مشتريات جديدة' },
    { key: 'r', ctrlKey: true, action: () => openTab({ id: '/payments', title: 'المقبوضات والمدفوعات', path: '/payments' }), description: 'سند قبض جديد' },
    { key: 'p', ctrlKey: true, action: () => openTab({ id: '/payments', title: 'المقبوضات والمدفوعات', path: '/payments' }), description: 'سند صرف جديد' },
    { key: 'j', ctrlKey: true, action: () => openTab({ id: '/journal', title: 'القيود اليومية', path: '/journal' }), description: 'قيد يومية جديد' },
  ], [openTab]);

  useKeyboardShortcuts(shortcuts);

  return (
    <div className="min-h-screen bg-gray-50 overflow-hidden" dir="rtl">
      <div className="flex h-screen overflow-hidden">
        {/* Right Sidebar Navigation */}
        {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Navigation Bar */}
          <TopBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
          
          {/* Tab Bar */}
          <TabBar />
          
          {/* Page Content Containers (One per tab) */}
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
                  {/* Page Header */}
                  {(title || subtitle) && tab.active && (
                    <div className="mb-6">
                      {title && <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>}
                      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
                    </div>
                  )}
                  
                  {/* The Page Component for this tab */}
                  <ErpRoutes location={tab.path} />
                </div>
              </div>
            ))}
          </main>
        </div>
      </div>
    </div>
  );
}
