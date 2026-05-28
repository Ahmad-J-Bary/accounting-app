import React from "react";
import { cn } from "@shared/lib/utils";
import { Button } from "@shared/ui/button";
import { RotateCcw } from "lucide-react";

interface SettingsGroupProps {
  title: string;
  icon: React.ElementType;
  color?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsGroup({ title, icon: Icon, color = "text-blue-600", children, className }: SettingsGroupProps) {
  return (
    <div className={cn("bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4", className)}>
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-xl bg-opacity-10", color)} style={{ backgroundColor: color.replace('text-', 'rgba(') }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
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
  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-500" dir="rtl">
      {children}
      {(resetButton || resetAction) && (
        <div className="flex justify-start">
          {resetButton || (
            resetAction && (
              <Button
                variant="outline"
                onClick={resetAction}
                className="rounded-xl h-10 gap-2 text-slate-500 border-slate-200"
              >
                <RotateCcw className="w-4 h-4" />
                استعادة الإعدادات الافتراضية
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
