import React from 'react';
import type { DensityMode } from '@shared/types/appearance';
import { Rows3, Rows2, Rows4 } from 'lucide-react';

const DENSITY_META: Record<
  DensityMode,
  { label: string; labelAr: string; icon: React.ReactNode; description: string; descriptionAr: string }
> = {
  compact: {
    label: 'Compact',
    labelAr: 'مضغوط',
    icon: <Rows3 className="w-4 h-4" />,
    description: 'Tight spacing for dense data views',
    descriptionAr: 'مسافات ضيقة لعرض البيانات المكثف',
  },
  comfortable: {
    label: 'Comfortable',
    labelAr: 'مريح',
    icon: <Rows2 className="w-4 h-4" />,
    description: 'Balanced spacing for everyday use',
    descriptionAr: 'مسافات متوازنة للاستخدام اليومي',
  },
  spacious: {
    label: 'Spacious',
    labelAr: 'واسع',
    icon: <Rows4 className="w-4 h-4" />,
    description: 'Relaxed spacing for readability',
    descriptionAr: 'مسافات مريحة لسهولة القراءة',
  },
};

interface DensityPreviewProps {
  mode: DensityMode;
  isSelected?: boolean;
  onClick: () => void;
}

export function DensityPreview({ mode, isSelected, onClick }: DensityPreviewProps) {
  const meta = DENSITY_META[mode];

  return (
    <button
      onClick={onClick}
      className={`
        relative w-full p-3 rounded-lg border-2 text-start transition-all duration-200
        ${isSelected
          ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
      aria-pressed={isSelected}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          {meta.icon}
        </div>
        <div>
          <div className="text-sm font-medium">{meta.label}</div>
          <div className="text-xs text-muted-foreground">{meta.labelAr}</div>
        </div>
      </div>
    </button>
  );
}
