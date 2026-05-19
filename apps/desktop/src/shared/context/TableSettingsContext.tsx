import { createContext } from 'react';
import { TableSettings } from '@shared/types/table-settings';

export interface TableSettingsContextType {
  settings: TableSettings;
  updateSetting: <K extends keyof TableSettings>(key: K, value: TableSettings[K]) => void;
  resetSettings: () => void;
  getDensityPadding: () => string;
  getRowHeight: () => string;
}

export const TableSettingsContext = createContext<TableSettingsContextType | undefined>(undefined);
