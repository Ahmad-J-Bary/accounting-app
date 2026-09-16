import React from "react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import { RotateCcw } from "lucide-react";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface SettingsGroupProps {
  title: string;
  icon: React.ElementType;
  color?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsGroup({ title, icon: Icon, color = "text-primary", children, className }: SettingsGroupProps) {
  return (
    <div className={cn("bg-card rounded-2xl p-4 sm:p-5 border border-border shadow-sm space-y-3 sm:space-y-4", className)}>
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className={cn("p-1.5 sm:p-2 rounded-xl bg-opacity-10 shrink-0", color)} style={{ backgroundColor: color.replace('text-', 'rgba(') }}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color }} />
        </div>
        <h3 className="text-base sm:text-lg font-bold text-foreground">{title}</h3>
      </div>
      <div className="pt-1">{children}</div>
    </div>
  );
}

interface SettingsManagerLayoutProps {
  children: React.ReactNode;
  resetButton?: React.ReactNode;
  resetAction?: () => void;
}

export function SettingsManagerLayout({ children, resetButton, resetAction }: SettingsManagerLayoutProps) {
  const { t } = useLocalization();
  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500" dir="rtl">
      {children}
      {(resetButton || resetAction) && (
        <div className="flex justify-start">
          {resetButton || (
            resetAction && (
              <Button
                variant="outline"
                onClick={resetAction}
                className="rounded-xl h-9 sm:h-10 gap-2 text-muted-foreground border-border"
              >
                <RotateCcw className="w-4 h-4" />
                {t('actions.restoreDefaults')}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
