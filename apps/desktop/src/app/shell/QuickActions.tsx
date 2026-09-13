import { Button } from '@shared/ui/button';
import { Card } from '@shared/ui/card';
import { 
  Receipt, ShoppingCart, Wallet, FileText, Plus, User, Package, 
  ChevronRight 
} from 'lucide-react';
import { useTabs } from '@app/providers/TabContext';
import { useLocalization } from '@app/providers/LocalizationProvider';

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
  const { t } = useLocalization();

  const handleNewInvoice = () => {
    const id = `/sales-invoices/new-${Date.now()}`;
    openTab({ id, title: t("newSalesInvoiceTab", { namespace: "shell", fallback: "فاتورة مبيعات جديدة" }), path: id, closable: true });
  };

  const handleNewPurchaseInvoice = () => {
    const id = `/purchase-invoices/new-${Date.now()}`;
    openTab({ id, title: t("newPurchaseInvoiceTab", { namespace: "shell", fallback: "فاتورة مشتريات جديدة" }), path: id, closable: true });
  };

  const defaultActions: QuickAction[] = actions || [
    {
      label: t("quickActionsList.newSalesInvoice", { namespace: "shell", fallback: "فاتورة مبيعات" }),
      icon: Receipt,
      description: t("quickActionsList.newSalesInvoiceDesc", { namespace: "shell", fallback: "إنشاء فاتورة مبيعات جديدة" }),
      onClick: handleNewInvoice,
      color: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    },
    {
      label: t("quickActionsList.newPurchaseInvoice", { namespace: "shell", fallback: "فاتورة مشتريات" }),
      icon: ShoppingCart,
      description: t("quickActionsList.newPurchaseInvoiceDesc", { namespace: "shell", fallback: "إنشاء فاتورة مشتريات جديدة" }),
      onClick: handleNewPurchaseInvoice,
      color: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
    },
    {
      label: t("quickActionsList.receiptVoucher", { namespace: "shell", fallback: "سند قبض" }),
      icon: Wallet,
      description: t("quickActionsList.receiptVoucherDesc", { namespace: "shell", fallback: "تسجيل قبض من العميل" }),
      onClick: () => {},
      color: 'bg-green-50 text-green-600 hover:bg-green-100',
    },
    {
      label: t("quickActionsList.paymentVoucher", { namespace: "shell", fallback: "سند صرف" }),
      icon: Wallet,
      description: t("quickActionsList.paymentVoucherDesc", { namespace: "shell", fallback: "تسجيل صرف للمورد" }),
      onClick: () => {},
      color: 'bg-red-50 text-red-600 hover:bg-red-100',
    },
    {
      label: t("quickActionsList.journalEntry", { namespace: "shell", fallback: "قيد يومية" }),
      icon: FileText,
      description: t("quickActionsList.journalEntryDesc", { namespace: "shell", fallback: "إنشاء قيد محاسبي جديد" }),
      onClick: () => {},
      color: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
    },
    {
      label: t("quickActionsList.newCustomer", { namespace: "shell", fallback: "عميل جديد" }),
      icon: User,
      description: t("quickActionsList.newCustomerDesc", { namespace: "shell", fallback: "إضافة عميل جديد" }),
      onClick: () => {},
      color: 'bg-teal-50 text-teal-600 hover:bg-teal-100',
    },
    {
      label: t("quickActionsList.newProduct", { namespace: "shell", fallback: "منتج جديد" }),
      icon: Package,
      description: t("quickActionsList.newProductDesc", { namespace: "shell", fallback: "إضافة منتج جديد" }),
      onClick: () => {},
      color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100',
    },
    {
      label: t("quickActionsList.more", { namespace: "shell", fallback: "المزيد" }),
      icon: ChevronRight,
      description: t("quickActionsList.moreDesc", { namespace: "shell", fallback: "عرض جميع الإجراءات" }),
      onClick: () => {},
      color: 'bg-gray-50 text-gray-600 hover:bg-gray-100',
    },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{t("quickActions", { namespace: "shell", fallback: "إجراءات سريعة" })}</h3>
        <Button variant="ghost" size="sm">
          <Plus className="w-4 h-4 ml-2" />
          {t("customize", { namespace: "shell", fallback: "تخصيص" })}
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
