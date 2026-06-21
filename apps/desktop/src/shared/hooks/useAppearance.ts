import { useContext } from 'react';
import { AppearanceContext } from '@app/providers/AppearanceProvider';
import type { AppearanceContextType } from '@shared/types/appearance';

export const useAppearance = (): AppearanceContextType => {
  const context = useContext(AppearanceContext);
  if (context === undefined) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
};
