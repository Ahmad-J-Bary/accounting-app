import { Button } from "@shared/ui/button";
import { Plus, History as HistoryIcon, PlusCircle, Download, TrendingUp, Coins } from "lucide-react";
import { toast } from "sonner";

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
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={!selectedPartner}
        onClick={() => {
          if (!selectedPartner?.drawings_account_id) {
            toast.error("لا يوجد حساب مسحوبات مرتبط بهذا الشريك");
            return;
          }
          onOpenDrawingsLedger(
            selectedPartner.id,
            selectedPartner.drawings_account_id,
            selectedPartner.name
          );
        }}
        className="border-slate-200 text-slate-700 hover:bg-slate-50"
      >
        <HistoryIcon className="w-4 h-4 ml-2 text-slate-500" /> مسحوبات الشريك
      </Button>

      <Button
        size="sm"
        variant="outline"
        disabled={!selectedPartner}
        onClick={() => {
          if (!selectedPartner?.drawings_account_id) {
            toast.error("لا يوجد حساب مسحوبات مرتبط بهذا الشريك");
            return;
          }
          onOpenDrawingsForm(selectedPartner.id);
        }}
        className="border-slate-200 text-slate-700 hover:bg-slate-50"
      >
        <PlusCircle className="w-4 h-4 ml-2 text-amber-500" /> سند مسحوبات
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => toast.info("جاري التصدير...")}
        className="border-slate-200 text-slate-700 hover:bg-slate-50"
      >
        <Download className="w-4 h-4 ml-2 text-emerald-500" /> تصدير إكسل
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onOpenPartnerStatement}
        className="border-slate-200 text-slate-700 hover:bg-slate-50"
      >
        <TrendingUp className="w-4 h-4 ml-2 text-emerald-500" /> الشركاء وحقوقهم
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onOpenProfitDistribution}
        className="border-slate-200 text-slate-700 hover:bg-slate-50"
      >
        <Coins className="w-4 h-4 ml-2 text-amber-500" /> توزيع الأرباح
      </Button>

      <div className="w-px h-6 bg-slate-200 mx-1" />

      <Button
        size="sm"
        onClick={onAddPartner}
        className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 font-bold"
      >
        <Plus className="w-4 h-4 ml-2" /> إضافة شريك جديد
      </Button>
    </div>
  );
}