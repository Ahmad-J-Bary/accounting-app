import { RefreshCw } from "lucide-react";
import { useLocalization } from "@app/providers/LocalizationProvider";

export function UnderDevelopmentSection() {
  const { t } = useLocalization();
  return (
    <div className="flex flex-col items-center justify-center p-10 sm:p-16 md:p-20 bg-muted/30 rounded-[2rem] border border-dashed border-border text-muted-foreground text-center space-y-4">
      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-muted rounded-full flex items-center justify-center">
        <RefreshCw className="w-7 h-7 sm:w-8 sm:h-8" />
      </div>
      <div className="space-y-1">
        <h3 className="font-black text-foreground">{t("underDevelopment.title", { namespace: "settings" })}</h3>
        <p className="text-sm font-medium">{t("underDevelopment.description", { namespace: "settings" })}</p>
      </div>
    </div>
  );
}
