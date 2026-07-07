import { Button } from '@shared/ui/button';
import { Card } from '@shared/ui/card';
import { 
  Receipt, ShoppingCart, Wallet, FileText, Plus, User, Package, 
  ArrowRight, ChevronRight 
} from 'lucide-react';
import { useTabs } from '@app/providers/TabContext';

interface QuickAction {
  label: string;
  icon: React.ElementType;
  description: string;
  onClick: () => void;
  color: string;
}

interface QuickActionsProps {
  actions?: QuickAction[];
  columns?: number;
}

export function QuickActions({ actions, columns = 4 }: QuickActionsProps) {
  const { openTab } = useTabs();

  const handleNewInvoice = () => {
    const id = `/sales-invoices/new-${Date.now()}`;
    openTab({ id, title: "فاتورة مبيعات جديدة", path: id, closable: true });
  };

  const handleNewPurchaseInvoice = () => {
    const id = `/purchase-invoices/new-${Date.now()}`;
    openTab({ id, title: "فاتورة مشتريات جديدة", path: id, closable: true });
  };

  const defaultActions: QuickAction[] = actions || [
    {
      label: 'فاتورة مبيعات',
      icon: Receipt,
      description: 'إنشاء فاتورة مبيعات جديدة',
      onClick: handleNewInvoice,
      color: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    },
    {
      label: 'فاتورة مشتريات',
      icon: ShoppingCart,
      description: 'إنشاء فاتورة مشتريات جديدة',
      onClick: handleNewPurchaseInvoice,
      color: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
    },
    {
      label: 'سند قبض',
      icon: Wallet,
      description: 'تسجيل قبض من العميل',
      onClick: () => {},
      color: 'bg-green-50 text-green-600 hover:bg-green-100',
    },
    {
      label: 'سند صرف',
      icon: Wallet,
      description: 'تسجيل صرف للمورد',
      onClick: () => {},
      color: 'bg-red-50 text-red-600 hover:bg-red-100',
    },
    {
      label: 'قيد يومية',
      icon: FileText,
      description: 'إنشاء قيد محاسبي جديد',
      onClick: () => {},
      color: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
    },
    {
      label: 'عميل جديد',
      icon: User,
      description: 'إضافة عميل جديد',
      onClick: () => {},
      color: 'bg-teal-50 text-teal-600 hover:bg-teal-100',
    },
    {
      label: 'منتج جديد',
      icon: Package,
      description: 'إضافة منتج جديد',
      onClick: () => {},
      color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100',
    },
    {
      label: 'المزيد',
      icon: ChevronRight,
      description: 'عرض جميع الإجراءات',
      onClick: () => {},
      color: 'bg-gray-50 text-gray-600 hover:bg-gray-100',
    },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">إجراءات سريعة</h3>
        <Button variant="ghost" size="sm">
          <Plus className="w-4 h-4 ml-2" />
          تخصيص
        </Button>
      </div>

      <div 
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {defaultActions.map((action, index) => (
          <Button
            key={index}
            variant="outline"
            className={`h-auto py-4 flex-col gap-2 ${action.color} border-0`}
            onClick={action.onClick}
          >
            <action.icon className="w-6 h-6" />
            <span className="font-medium text-sm">{action.label}</span>
            <span className="text-xs opacity-70 text-center line-clamp-2">
              {action.description}
            </span>
          </Button>
        ))}
      </div>
    </Card>
  );
}
