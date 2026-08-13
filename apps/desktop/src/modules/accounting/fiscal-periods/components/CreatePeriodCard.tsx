import { Button } from "@shared/ui/button";
import { FieldLabel } from "@widgets/sidebar-shell/FieldLabel";
import { Input } from "@shared/ui/input";
import { SectionCard } from "@shared/ui/section-card";

interface CreatePeriodCardProps {
  start: string;
  end: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  canCreate: boolean;
  isPending: boolean;
  error: unknown;
  onCreate: () => void;
}

export function CreatePeriodCard({
  start,
  end,
  onStartChange,
  onEndChange,
  canCreate,
  isPending,
  error,
  onCreate,
}: CreatePeriodCardProps) {
  return (
    <SectionCard title="إنشاء فترة مالية">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="fp-start" required>بداية الفترة</FieldLabel>
          <Input id="fp-start" type="date" value={start} onChange={(e) => onStartChange(e.target.value)} className="h-9" aria-required />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="fp-end" required>نهاية الفترة</FieldLabel>
          <Input id="fp-end" type="date" value={end} onChange={(e) => onEndChange(e.target.value)} className="h-9" aria-required />
        </div>
      </div>
      <Button
        onClick={onCreate}
        disabled={!canCreate || isPending}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
      >
        {isPending ? "جارٍ الإنشاء..." : "إنشاء الفترة"}
      </Button>
      {start && end && !canCreate && (
        <p className="text-2xs text-red-600" role="alert">نهاية الفترة يجب أن تكون بعد بدايتها.</p>
      )}
      {error && <p className="text-xs text-red-500" role="alert">{String(error)}</p>}
    </SectionCard>
  );
}
