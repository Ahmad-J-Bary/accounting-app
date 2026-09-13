import { Button } from "@shared/ui/button";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { Input } from "@shared/ui/input";
import { SectionCard } from "@shared/ui/section-card";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface CreateFiscalYearCardProps {
  label: string;
  start: string;
  end: string;
  onLabelChange: (v: string) => void;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  canCreate: boolean;
  isPending: boolean;
  error: unknown;
  onCreate: () => void;
}

export function CreateFiscalYearCard({
  label,
  start,
  end,
  onLabelChange,
  onStartChange,
  onEndChange,
  canCreate,
  isPending,
  error,
  onCreate,
}: CreateFiscalYearCardProps) {
  const { t } = useLocalization();
  return (
    <SectionCard title={t("fiscalYears.createCard.title", { namespace: "accounting", fallback: "إنشاء سنة مالية" })}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="fy-label" required>{t("fiscalYears.createCard.label", { namespace: "accounting", fallback: "التسمية" })}</FieldLabel>
          <Input id="fy-label" type="text" value={label} onChange={(e) => onLabelChange(e.target.value)} className="h-9" placeholder={t("fiscalYears.createCard.labelPlaceholder", { namespace: "accounting", fallback: "مثال: 2026" })} aria-required />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="fy-start" required>{t("fiscalYears.createCard.start", { namespace: "accounting", fallback: "البداية" })}</FieldLabel>
          <Input id="fy-start" type="date" value={start} onChange={(e) => onStartChange(e.target.value)} className="h-9" aria-required />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="fy-end" required>{t("fiscalYears.createCard.end", { namespace: "accounting", fallback: "النهاية" })}</FieldLabel>
          <Input id="fy-end" type="date" value={end} onChange={(e) => onEndChange(e.target.value)} className="h-9" aria-required />
        </div>
      </div>
      <Button
        onClick={onCreate}
        disabled={!canCreate || isPending}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
      >
        {isPending ? t("fiscalYears.createCard.pending", { namespace: "accounting", fallback: "جارٍ الإنشاء..." }) : t("fiscalYears.createCard.create", { namespace: "accounting", fallback: "إنشاء السنة المالية" })}
      </Button>
      {label && start && end && !canCreate && (
        <p className="text-2xs text-red-600" role="alert">{t("fiscalYears.createCard.validation", { namespace: "accounting", fallback: "التسمية مطلوبة، والنهاية يجب أن تكون بعد البداية." })}</p>
      )}
      {error && <p className="text-xs text-red-500" role="alert">{String(error)}</p>}
    </SectionCard>
  );
}
