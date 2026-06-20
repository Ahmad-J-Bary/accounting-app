import { useContext } from 'react';
import { SidebarLayoutContext } from '@shared/context/SidebarLayoutContext';

export const useSidebarLayout = () => {
  const context = useContext(SidebarLayoutContext);
  if (context === undefined) {
    throw new Error('useSidebarLayout must be used within a SidebarLayoutProvider');
  }
  return context;
};
