import { useContext } from 'react';
import { TableSettingsContext } from '@shared/context/TableSettingsContext';

export const useTableSettings = () => {
  const context = useContext(TableSettingsContext);
  if (context === undefined) {
    throw new Error('useTableSettings must be used within a TableSettingsProvider');
  }
  return context;
};
