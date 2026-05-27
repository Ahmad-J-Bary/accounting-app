import { useContext } from 'react';
import { SidebarSettingsContext } from '@shared/context/SidebarSettingsContext';

export const useSidebarSettings = () => {
  const context = useContext(SidebarSettingsContext);
  if (context === undefined) {
    throw new Error('useSidebarSettings must be used within a SidebarSettingsProvider');
  }
  return context;
};
