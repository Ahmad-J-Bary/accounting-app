import { useState } from "react";
import { cn } from '@shared/lib/utils';
import { Button } from "@shared/ui/button";
import { Badge } from "@shared/ui/badge";
import { Checkbox } from "@shared/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@shared/ui/popover";
import { Filter, X } from "lucide-react";
import { MOVEMENT_TYPE_CONFIG, MOVEMENT_TYPE_KEYS, PARENT_CHILD_MAP, CHILD_PARENT_MAP } from '../constants/movementTypes';

interface MovementTypeFilterProps {
  value: string[];
  onChange: (types: string[]) => void;
}

export function MovementTypeFilter({ value, onChange }: MovementTypeFilterProps) {
  const [open, setOpen] = useState(false);

  const allSelected = MOVEMENT_TYPE_KEYS.every(k => value.includes(k));
  const noneSelected = value.length === 0;

  const toggle = (key: string) => {
    const isSelected = value.includes(key);
    let next: string[];

    if (isSelected) {
      next = value.filter(v => v !== key);
      const parent = CHILD_PARENT_MAP[key];
      if (parent) next = next.filter(v => v !== parent);
      const children = PARENT_CHILD_MAP[key];
      if (children && children.every(c => value.includes(c))) {
        next = next.filter(v => !children.includes(v));
      }
    } else {
      next = [...value, key];
      const children = PARENT_CHILD_MAP[key];
      if (children) {
        children.forEach(c => { if (!next.includes(c)) next.push(c); });
      }
      const parent = CHILD_PARENT_MAP[key];
      if (parent) {
        const siblings = PARENT_CHILD_MAP[parent];
        if (siblings.every(s => next.includes(s)) && !next.includes(parent)) {
          next.push(parent);
        }
      }
    }

    onChange(next);
  };

  const selectAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...MOVEMENT_TYPE_KEYS]);
    }
  };

  const clear = () => onChange([]);

  let lastGroup: string | null = null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 border-slate-200 bg-white text-xs font-medium",
            !noneSelected && "border-emerald-200 bg-emerald-50 text-emerald-700"
          )}
        >
          <Filter className="w-3.5 h-3.5 shrink-0" />
          <span>النوع</span>
          {!noneSelected && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] font-bold">
              {value.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        <div className="space-y-1">
          <button
            onClick={selectAll}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Checkbox checked={allSelected} />
            <span>{allSelected ? 'إلغاء الكل' : 'تحديد الكل'}</span>
          </button>
          <div className="h-px bg-slate-100 my-1" />
          {MOVEMENT_TYPE_KEYS.map(key => {
            const cfg = MOVEMENT_TYPE_CONFIG[key];
            const showSep = lastGroup !== null && cfg.group !== lastGroup;
            lastGroup = cfg.group;
            return (
              <div key={key}>
                {showSep && <div className="h-px bg-slate-200 my-1.5" />}
                <button
                  onClick={() => toggle(key)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-slate-100 transition-colors"
                >
                  <Checkbox checked={value.includes(key)} />
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ring-1 ring-inset",
                    cfg.inflow ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' :
                    'bg-rose-50 text-rose-700 ring-rose-100'
                  )}>
                    {cfg.label}
                  </span>
                </button>
              </div>
            );
          })}
          {!noneSelected && (
            <>
              <div className="h-px bg-slate-100 my-1" />
              <button
                onClick={clear}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <X className="w-3 h-3" />
                <span>إزالة الفلتر</span>
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
