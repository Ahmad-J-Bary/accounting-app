import { useContext } from 'react';
import { SidePanelSettingsContext } from '@shared/context/SidePanelSettingsContext';

export const useSidePanelSettings = () => {
  const context = useContext(SidePanelSettingsContext);
  if (context === undefined) {
    throw new Error('useSidePanelSettings must be used within a SidePanelSettingsProvider');
  }
  return context;
};
