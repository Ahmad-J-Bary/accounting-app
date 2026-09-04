import React from 'react';
import type { ThemeDefinition } from '@shared/types/appearance';
import { Sun, Moon, Monitor, Crown, Palette, Snowflake, Leaf, Flame, Ghost, Stars } from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  Sun: <Sun className="w-4 h-4" />,
  Moon: <Moon className="w-4 h-4" />,
  Monitor: <Monitor className="w-4 h-4" />,
  Crown: <Crown className="w-4 h-4" />,
  Palette: <Palette className="w-4 h-4" />,
  Snowflake: <Snowflake className="w-4 h-4" />,
  Leaf: <Leaf className="w-4 h-4" />,
  Flame: <Flame className="w-4 h-4" />,
  Ghost: <Ghost className="w-4 h-4" />,
  Stars: <Stars className="w-4 h-4" />,
};

interface ThemePreviewProps {
  theme: ThemeDefinition;
  isSelected?: boolean;
  onClick: () => void;
}

export function ThemePreview({ theme, isSelected, onClick }: ThemePreviewProps) {
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
        <div
          className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center"
          style={{
            backgroundColor: theme.cssVariables['--background'],
            color: theme.cssVariables['--foreground'],
          }}
        >
          {ICON_MAP[theme.icon] ?? <Sun className="w-4 h-4" />}
        </div>
        <div>
          <div className="text-sm font-medium">{theme.name}</div>
          <div className="text-xs text-muted-foreground">{theme.nameAr}</div>
        </div>
      </div>
    </button>
  );
}
