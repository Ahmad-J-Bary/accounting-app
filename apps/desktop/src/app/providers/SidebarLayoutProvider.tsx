import React, { type ReactNode } from 'react';
import { SidebarLayoutContext } from '@shared/context/SidebarLayoutContext';
import { useSidebarLayout } from '@shared/hooks/useSidebarLayout';

export const SidebarLayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const sidebarLayout = useSidebarLayout();

  return (
    <SidebarLayoutContext.Provider value={sidebarLayout}>
      {children}
    </SidebarLayoutContext.Provider>
  );
};
