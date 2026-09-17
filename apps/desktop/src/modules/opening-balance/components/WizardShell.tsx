import { type ReactNode } from "react";
import { ChevronRight, ChevronLeft, Check } from "lucide-react";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { cn } from "@shared/lib/utils";
import { useLocalization } from "@app/providers/LocalizationProvider";

export interface WizardStepDef {
  id: string;
  label: string;
}

interface WizardShellProps {
  title: string;
  subtitle?: string;
  steps: WizardStepDef[];
  stepIndex: number;
  stepOrder?: number[];
  canPrev?: boolean;
  canNext?: boolean;
  isNexting?: boolean;
  isFinal?: boolean;
  nextLabel?: string;
  canNextHint?: string;
  onNext: () => void;
  onPrev: () => void;
  onStepClick?: (index: number) => void;
  canNavigateToStep?: (index: number) => boolean;
  completedSteps?: Set<number>;
  children: ReactNode;
}

/**
 * Lightweight multi-step shell: renders a numbered progress header, the active
 * step content, and prev/next navigation. Step indicators are clickable for
 * completed steps. Auto-save is handled by the caller on step transitions.
 */
export function WizardShell({
  title,
  subtitle,
  steps,
  stepIndex,
  stepOrder,
  canPrev = true,
  canNext = true,
  isNexting = false,
  isFinal = false,
  nextLabel,
  canNextHint,
  onNext,
  onPrev,
  onStepClick,
  canNavigateToStep,
  completedSteps,
  children,
}: WizardShellProps) {
  const { t, direction, isRTL } = useLocalization();
  // stepOrder maps visual position → actual step index. If not provided, use natural order.
  const orderedIndices = (stepOrder ?? steps.map((_, i) => i)).filter((idx) => idx >= 0 && idx < steps.length);
  const visualPosition = new Map(orderedIndices.map((idx, pos) => [idx, pos]));
  const currentVisualPos = visualPosition.get(stepIndex) ?? 0;
  const progress = ((currentVisualPos + 1) / steps.length) * 100;

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div className="flex flex-col gap-4 w-full" dir={direction}>
      <Card className="border-muted shadow-sm">
        <CardHeader className="py-3">
          <CardTitle className="text-base font-bold text-foreground">{title}</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground -mt-1">{subtitle}</p>}
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {orderedIndices.map((idx, pos) => {
              const s = steps[idx];
              const active = idx === stepIndex;
              const passed = completedSteps?.has(idx) ?? false;
              const clickable = canNavigateToStep?.(idx) ?? false;
              return (
                <button
                  type="button"
                  key={s.id}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 min-w-[3rem] sm:min-w-[3.5rem] transition-colors p-1 rounded-lg",
                    clickable && "cursor-pointer hover:bg-muted/50",
                  )}
                  onClick={() => clickable && onStepClick?.(idx)}
                  disabled={!clickable}
                  tabIndex={clickable ? 0 : -1}
                  aria-label={s.label}
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 shadow-sm transition-all text-xs",
                      active
                        ? "bg-primary border-blue-600 text-white ring-4 ring-primary/20 font-bold"
                        : passed
                          ? "bg-success border-success text-white"
                          : "bg-white border-muted text-muted-foreground",
                    )}
                    title={s.label}
                    aria-current={active ? "step" : undefined}
                  >
                    {passed ? <Check className="w-4 h-4 stroke-[3]" /> : <span className="text-2xs sm:text-xs font-bold font-mono">{pos + 1}</span>}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] sm:text-2xs font-semibold truncate max-w-full hidden xs:block sm:block",
                      active ? "text-primary" : passed ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-muted shadow-sm">
        <CardContent className="pt-4">{children}</CardContent>
      </Card>

      <div className="flex items-center justify-between border-t border-muted pt-3 gap-2 flex-wrap sm:flex-nowrap">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={!canPrev || stepIndex === 0}
          className="border-muted text-foreground font-bold"
        >
          <PrevIcon className="w-4 h-4 me-1 ms-1" /> {t("openingBalance.prevButton", { namespace: "accounting",  })}
        </Button>
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {t("openingBalance.progressStep", { namespace: "accounting", vars: { current: currentVisualPos + 1, total: steps.length },  })}
        </span>
        {!canNext && canNextHint && (
          <span className="basis-full text-2xs font-semibold text-amber-600">
            {canNextHint}
          </span>
        )}
        <Button
          size="sm"
          onClick={onNext}
          disabled={!canNext || isNexting}
          title={!canNext ? canNextHint : undefined}
          className="bg-primary hover:bg-primary/80 text-white font-bold"
        >
          {isNexting ? t("openingBalance.executingShort", { namespace: "accounting",  }) : (nextLabel || (isFinal ? t("openingBalance.finishButton", { namespace: "accounting",  }) : t("openingBalance.nextButton", { namespace: "accounting",  })))}
          {!isFinal && <NextIcon className="w-4 h-4 me-1 ms-1" />}
        </Button>
      </div>
    </div>
  );
}
