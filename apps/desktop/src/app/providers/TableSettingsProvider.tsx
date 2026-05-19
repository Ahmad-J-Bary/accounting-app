import React, { useState, useEffect, ReactNode } from 'react';
import { TableSettings, TableDensity, TableBorderStyle } from '@shared/types/table-settings';
import { TableSettingsContext } from '@shared/context/TableSettingsContext';

export { type TableSettings, type TableDensity, type TableBorderStyle };
export { TableSettingsContext };

const DEFAULT_SETTINGS: TableSettings = {
  density: 'comfortable',
  fontSize: 13,
  fontFamily: 'Inter, system-ui, sans-serif',
  rowHoverEffect: true,
  zebraRows: false,
  borderStyle: 'horizontal',
  headerColor: 'bg-slate-50/50',
  stickyHeader: true,
  showToolbar: true,
  showSummary: true,
  showPagination: true,
};

export const TableSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<TableSettings>(() => {
    const saved = localStorage.getItem('erp_table_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('erp_table_settings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = <K extends keyof TableSettings>(key: K, value: TableSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
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
