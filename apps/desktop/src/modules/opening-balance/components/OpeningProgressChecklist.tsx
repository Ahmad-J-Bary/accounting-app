import { Card, CardContent } from "@shared/ui/card";
import { Circle, CheckCircle2 } from "lucide-react";
import { cn } from "@shared/lib/utils";

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

interface OpeningProgressChecklistProps {
  items: ChecklistItem[];
}

/**
 * Opening completion checklist (§15): the user always sees what has been
 * finished and what is still missing without having to remember it. Done-state
 * is derived from wizard data + the reached step, never from user memory.
 */
export function OpeningProgressChecklist({ items }: OpeningProgressChecklistProps) {
  const doneCount = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="space-y-1.5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-slate-800">اكتمال الإعداد</span>
          <span className="text-2xs font-bold text-slate-500 tabular-nums">
            {doneCount}/{items.length}
          </span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <ul className="space-y-0.5 pt-0.5">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-1.5 text-xs">
              {item.done ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              )}
              <span className={cn(item.done ? "text-slate-700 font-semibold" : "text-slate-400")}>{item.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}