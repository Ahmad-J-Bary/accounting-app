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
    openTab({ id, title: t("newSalesInvoiceTab", { namespace: "shell",  }), path: id, closable: true });
  };

  const handleNewPurchaseInvoice = () => {
    const id = `/purchase-invoices/new-${Date.now()}`;
    openTab({ id, title: t("newPurchaseInvoiceTab", { namespace: "shell",  }), path: id, closable: true });
  };

  const defaultActions: QuickAction[] = actions || [
    {
      label: t("quickActionsList.newSalesInvoice", { namespace: "shell",  }),
      icon: Receipt,
      description: t("quickActionsList.newSalesInvoiceDesc", { namespace: "shell",  }),
      onClick: handleNewInvoice,
      color: 'bg-primary/10 text-primary hover:bg-primary/20',
    },
    {
      label: t("quickActionsList.newPurchaseInvoice", { namespace: "shell",  }),
      icon: ShoppingCart,
      description: t("quickActionsList.newPurchaseInvoiceDesc", { namespace: "shell",  }),
      onClick: handleNewPurchaseInvoice,
      color: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
    },
    {
      label: t("quickActionsList.receiptVoucher", { namespace: "shell",  }),
      icon: Wallet,
      description: t("quickActionsList.receiptVoucherDesc", { namespace: "shell",  }),
      onClick: () => {},
      color: 'bg-green-50 text-green-600 hover:bg-green-100',
    },
    {
      label: t("quickActionsList.paymentVoucher", { namespace: "shell",  }),
      icon: Wallet,
      description: t("quickActionsList.paymentVoucherDesc", { namespace: "shell",  }),
      onClick: () => {},
      color: 'bg-red-50 text-red-600 hover:bg-red-100',
    },
    {
      label: t("quickActionsList.journalEntry", { namespace: "shell",  }),
      icon: FileText,
      description: t("quickActionsList.journalEntryDesc", { namespace: "shell",  }),
      onClick: () => {},
      color: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
    },
    {
      label: t("quickActionsList.newCustomer", { namespace: "shell",  }),
      icon: User,
      description: t("quickActionsList.newCustomerDesc", { namespace: "shell",  }),
      onClick: () => {},
      color: 'bg-teal-50 text-teal-600 hover:bg-teal-100',
    },
    {
      label: t("quickActionsList.newProduct", { namespace: "shell",  }),
      icon: Package,
      description: t("quickActionsList.newProductDesc", { namespace: "shell",  }),
      onClick: () => {},
      color: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100',
    },
    {
      label: t("quickActionsList.more", { namespace: "shell",  }),
      icon: ChevronRight,
      description: t("quickActionsList.moreDesc", { namespace: "shell",  }),
      onClick: () => {},
      color: 'bg-gray-50 text-gray-600 hover:bg-gray-100',
    },
  ];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">{t("quickActions", { namespace: "shell",  })}</h3>
        <Button variant="ghost" size="sm">
          <Plus className="ms-2 h-4 w-4" />
          {t("customize", { namespace: "shell",  })}
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
