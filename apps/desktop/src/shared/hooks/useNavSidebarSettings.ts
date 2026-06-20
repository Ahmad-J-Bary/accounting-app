import { useContext } from 'react';
import { NavSidebarSettingsContext } from '@shared/context/NavSidebarSettingsContext';

export const useNavSidebarSettings = () => {
  const context = useContext(NavSidebarSettingsContext);
  if (context === undefined) {
    throw new Error('useNavSidebarSettings must be used within a NavSidebarSettingsProvider');
  }
  return context;
};
