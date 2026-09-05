import { Button } from "@shared/ui/button";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { Input } from "@shared/ui/input";
import { SectionCard } from "@shared/ui/section-card";

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
  return (
    <SectionCard title="إنشاء سنة مالية">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="fy-label" required>التسمية</FieldLabel>
          <Input id="fy-label" type="text" value={label} onChange={(e) => onLabelChange(e.target.value)} className="h-9" placeholder="مثال: 2026" aria-required />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="fy-start" required>البداية</FieldLabel>
          <Input id="fy-start" type="date" value={start} onChange={(e) => onStartChange(e.target.value)} className="h-9" aria-required />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="fy-end" required>النهاية</FieldLabel>
          <Input id="fy-end" type="date" value={end} onChange={(e) => onEndChange(e.target.value)} className="h-9" aria-required />
        </div>
      </div>
      <Button
        onClick={onCreate}
        disabled={!canCreate || isPending}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
      >
        {isPending ? "جارٍ الإنشاء..." : "إنشاء السنة المالية"}
      </Button>
      {label && start && end && !canCreate && (
        <p className="text-2xs text-red-600" role="alert">التسمية مطلوبة، والنهاية يجب أن تكون بعد البداية.</p>
      )}
      {error && <p className="text-xs text-red-500" role="alert">{String(error)}</p>}
    </SectionCard>
  );
}
