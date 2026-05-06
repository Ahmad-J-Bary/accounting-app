import { createContext, useContext } from 'react';
import { TabContextType } from '@shared/types/tabs';

export const TabContext = createContext<TabContextType | undefined>(undefined);

export const useTabs = () => {
  const context = useContext(TabContext);
  if (!context) throw new Error('useTabs must be used within TabProvider');
  return context;
};
