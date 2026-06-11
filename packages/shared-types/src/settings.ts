export interface CompanySettings {
  id: string;
  company_name: string;
  company_name_en?: string;
  tax_number?: string;
  commercial_register?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency: string;
  currency_symbol: string;
  tax_rate: string;
  invoice_prefix: string;
  purchase_prefix: string;
  journal_prefix: string;
  fiscal_year_start_month: number;
  logo_path?: string;
  purchase_warehouse_id?: string;
  sales_warehouse_id?: string;
  updated_at: string;
}

export interface UpdateSettingsRequest {
  company_name: string;
  company_name_en?: string;
  tax_number?: string;
  commercial_register?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
  currency_symbol?: string;
  tax_rate: number;
  invoice_prefix: string;
  purchase_prefix: string;
  journal_prefix: string;
  fiscal_year_start_month: number;
  purchase_warehouse_id?: string;
  sales_warehouse_id?: string;
}
