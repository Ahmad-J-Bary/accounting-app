export type TableDensity = 'compact' | 'comfortable' | 'spacious';
export type TableBorderStyle = 'full' | 'horizontal' | 'none';

export interface TableSettings {
  density: TableDensity;
  fontSize: number;
  fontFamily: string;
  rowHoverEffect: boolean;
  zebraRows: boolean;
  borderStyle: TableBorderStyle;
  headerColor: string;
  stickyHeader: boolean;
  showToolbar: boolean;
  showSummary: boolean;
  showPagination: boolean;
}
