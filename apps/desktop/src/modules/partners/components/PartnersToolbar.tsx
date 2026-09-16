import { Button } from "@shared/ui/button";
import { Plus, History as HistoryIcon, PlusCircle, Download, TrendingUp, Coins } from "lucide-react";
import { toast } from "sonner";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface PartnersToolbarProps {
  selectedPartner: { id: string; name: string; drawings_account_id?: string | null } | null;
  onOpenDrawingsLedger: (partnerId: string, accountId: string, name: string) => void;
  onOpenDrawingsForm: (partnerId: string) => void;
  onAddPartner: () => void;
  onOpenPartnerStatement: () => void;
  onOpenProfitDistribution: () => void;
}

export function PartnersToolbar({
  selectedPartner,
  onOpenDrawingsLedger,
  onOpenDrawingsForm,
  onAddPartner,
  onOpenPartnerStatement,
  onOpenProfitDistribution,
}: PartnersToolbarProps) {
  const { t } = useLocalization();
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={!selectedPartner}
        onClick={() => {
          if (!selectedPartner?.drawings_account_id) {
            toast.error(t("toast.noDrawingsAccount", { namespace: "partners",  }));
            return;
          }
          onOpenDrawingsLedger(
            selectedPartner.id,
            selectedPartner.drawings_account_id,
            selectedPartner.name
          );
        }}
        className="border-muted text-foreground hover:bg-muted"
      >
        <HistoryIcon className="w-4 h-4 ml-2 text-muted-foreground" /> {t("toolbar.drawings", { namespace: "partners",  })}
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={!selectedPartner}
        onClick={() => {
          if (!selectedPartner?.drawings_account_id) {
            toast.error(t("toast.noDrawingsAccount", { namespace: "partners",  }));
            return;
          }
          onOpenDrawingsForm(selectedPartner.id);
        }}
        className="border-muted text-foreground hover:bg-muted"
      >
        <PlusCircle className="w-4 h-4 ml-2 text-warning" /> {t("toolbar.drawingsVoucher", { namespace: "partners",  })}
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => toast.info(t("toolbar.exporting", { namespace: "partners",  }))}
        className="border-muted text-foreground hover:bg-muted"
      >
        <Download className="w-4 h-4 ml-2 text-success" /> {t("toolbar.exportExcel", { namespace: "partners",  })}
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onOpenPartnerStatement}
        className="border-muted text-foreground hover:bg-muted"
      >
        <TrendingUp className="w-4 h-4 ml-2 text-success" /> {t("toolbar.statement", { namespace: "partners",  })}
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onOpenProfitDistribution}
        className="border-muted text-foreground hover:bg-muted"
      >
        <Coins className="w-4 h-4 ml-2 text-warning" /> {t("toolbar.profitDistribution", { namespace: "partners",  })}
      </Button>

      <div className="w-px h-6 bg-muted mx-1" />

      <Button
        size="sm"
        onClick={onAddPartner}
        className="bg-primary hover:bg-primary/80 shadow-lg shadow-primary/20 font-bold"
      >
        <Plus className="w-4 h-4 ml-2" /> {t("toolbar.addPartner", { namespace: "partners",  })}
      </Button>
    </div>
  );
}