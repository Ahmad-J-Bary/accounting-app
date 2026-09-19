import React, { ReactNode } from 'react';
import { TableSettings, TableDensity, TableBorderStyle } from '@shared/types/table-settings';
import { TableSettingsContext } from '@shared/context/TableSettingsContext';
import { useUiPreferences } from '@shared/hooks/useUiPreferences';

export { type TableSettings, type TableDensity, type TableBorderStyle };
export { TableSettingsContext };

export const TableSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { preferences, updateTableAppearance, resetTableAppearance } = useUiPreferences();
  const settings: TableSettings = preferences.tableAppearance;

  const updateSetting = <K extends keyof TableSettings>(key: K, value: TableSettings[K]) => {
    updateTableAppearance({ [key]: value } as Partial<TableSettings>);
  };

  const resetSettings = () => {
    resetTableAppearance();
  };

  const getDensityPadding = () => {
    switch (settings.density) {
      case 'compact': return 'px-2 py-1.5';
      case 'spacious': return 'px-6 py-5';
      case 'comfortable':
      default: return 'px-4 py-3.5';
    }
  };

  const getRowHeight = () => {
    switch (settings.density) {
      case 'compact': return 'h-9';
      case 'spacious': return 'h-16';
      case 'comfortable':
      default: return 'h-12';
    }
  };

  return (
    <TableSettingsContext.Provider value={{ settings, updateSetting, resetSettings, getDensityPadding, getRowHeight }}>
      {children}
    </TableSettingsContext.Provider>
  );
};
