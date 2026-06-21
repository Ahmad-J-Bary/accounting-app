import React from 'react';
import { ICON_MAP } from '@app/shell/sidebarConfig';
import { cn } from '@shared/lib/utils';

interface IconPickerProps {
  value?: string;
  onChange: (icon: string) => void;
  className?: string;
}

export function IconPicker({ value, onChange, className }: IconPickerProps) {
  return (
    <div className={cn("grid grid-cols-6 gap-1.5 p-3 bg-white rounded-lg border border-slate-200", className)}>
      {Object.keys(ICON_MAP).map(iconName => {
        const IconComp = ICON_MAP[iconName];
        const isSelected = value === iconName;
        return (
          <button
            key={iconName}
            type="button"
            onClick={() => onChange(iconName)}
            className={cn(
              "flex items-center justify-center p-2 rounded-lg border transition-all duration-150",
              isSelected
                ? "border-blue-500 bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-500/30"
                : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
            )}
            title={iconName}
          >
            <IconComp className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
