import { ReactNode, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function AppLayout({ children, title, subtitle }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  const shortcuts = useMemo(() => [
    { key: 'k', ctrlKey: true, action: () => console.log('Open search'), description: 'فتح البحث' },
    { key: 'n', ctrlKey: true, action: () => {
        navigate('/sales-invoices');
        setTimeout(() => window.dispatchEvent(new CustomEvent("erp:open-new-invoice")), 100);
      }, description: 'فاتورة مبيعات جديدة' },
    { key: 'b', ctrlKey: true, action: () => {
        navigate('/purchase-invoices');
        setTimeout(() => window.dispatchEvent(new CustomEvent("erp:open-new-purchase-invoice")), 100);
      }, description: 'فاتورة مشتريات جديدة' },
    { key: 'r', ctrlKey: true, action: () => navigate('/payments'), description: 'سند قبض جديد' },
    { key: 'p', ctrlKey: true, action: () => navigate('/payments'), description: 'سند صرف جديد' },
    { key: 'j', ctrlKey: true, action: () => navigate('/journal'), description: 'قيد يومية جديد' },
  ], [navigate]);

  useKeyboardShortcuts(shortcuts);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="flex min-h-screen">
        {/* Right Sidebar Navigation */}
        {sidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} />}
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          {/* Top Navigation Bar */}
          <TopBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
          
          {/* Page Content */}
          <main className="flex-1 p-6">
            {/* Page Header */}
            {(title || subtitle) && (
              <div className="mb-6">
                {title && <h1 className="text-2xl font-bold text-gray-900 mb-1">{title}</h1>}
                {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
              </div>
            )}
            
            {/* Page Content */}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
