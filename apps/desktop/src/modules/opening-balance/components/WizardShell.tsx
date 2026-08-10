import { type ReactNode } from "react";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { cn } from "@shared/lib/utils";

export interface WizardStepDef {
  id: string;
  label: string;
}

interface WizardShellProps {
  title: string;
  subtitle?: string;
  steps: WizardStepDef[];
  stepIndex: number;
  canPrev?: boolean;
  canNext?: boolean;
  isNexting?: boolean;
  isFinal?: boolean;
  nextLabel?: string;
  onNext: () => void;
  onPrev: () => void;
  children: ReactNode;
}

/**
 * Lightweight multi-step shell: renders a numbered progress header, the active
 * step content, and prev/next navigation. Validation of the current step is the
 * caller's responsibility (via `canNext`).
 */
export function WizardShell({
  title,
  subtitle,
  steps,
  stepIndex,
  canPrev = true,
  canNext = true,
  isNexting = false,
  isFinal = false,
  nextLabel,
  onNext,
  onPrev,
  children,
}: WizardShellProps) {
  const progress = ((stepIndex + 1) / steps.length) * 100;

  return (
    <div className="flex flex-col gap-4 w-full">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="py-3">
          <CardTitle className="text-base font-bold text-slate-800">{title}</CardTitle>
          {subtitle && <p className="text-xs text-slate-500 -mt-1">{subtitle}</p>}
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-2">
            {steps.map((s, i) => {
              const active = i === stepIndex;
              const passed = i < stepIndex;
              return (
                <div key={s.id} className="flex flex-1 flex-col items-center gap-1 min-w-0">
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border-2 shadow-sm transition-all",
                      active
                        ? "bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100"
                        : passed
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "bg-white border-slate-200 text-slate-400",
                    )}
                    title={s.label}
                  >
                    {passed ? <Check className="w-4 h-4 stroke-[3]" /> : <span className="text-xs font-bold font-mono">{i + 1}</span>}
                  </div>
                  <span
                    className={cn(
                      "text-2xs font-semibold truncate max-w-full",
                      active ? "text-blue-600" : passed ? "text-emerald-600" : "text-slate-400",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-4">{children}</CardContent>
      </Card>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={!canPrev || stepIndex === 0}
          className="border-slate-200 text-slate-700 font-bold"
        >
          <ChevronRight className="w-4 h-4 ml-1.5" /> السابق
        </Button>
        <span className="text-xs font-semibold text-slate-500 tabular-nums">
          الخطوة {stepIndex + 1} من {steps.length}
        </span>
        <Button
          size="sm"
          onClick={onNext}
          disabled={!canNext || isNexting}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
        >
          {isNexting ? "جارٍ التنفيذ..." : (nextLabel || (isFinal ? "إنهاء" : "التالي"))}
          {!isFinal && <ChevronLeft className="w-4 h-4 mr-1.5" />}
        </Button>
      </div>
    </div>
  );
}