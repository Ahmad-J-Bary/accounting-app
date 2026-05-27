import { invoke } from "@shared/lib/invoke";

export interface Currency {
  code: string;
  name: string;
  name_ar: string;
  name_en: string;
  symbol: string;
  decimals: number;
  is_base: boolean;
  is_active: boolean;
  notes?: string | null;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: string;
  rate_type: string;
  rate_date: string;
  source: string | null;
}

export interface TodayRateStatus {
  currency_code: string;
  currency_name_ar: string;
  currency_name_en: string;
  currency_symbol: string;
  has_rate_today: boolean;
  rate: string | null;
  rate_type: string | null;
  last_rate: string | null;
  last_rate_date: string | null;
}

export interface CreateCurrencyRequest {
  code: string;
  name?: string;
  name_ar: string;
  name_en: string;
  symbol: string;
  decimals: number;
  is_base: boolean;
  is_active: boolean;
  notes?: string;
}

export interface UpdateCurrencyRequest {
  code: string;
  name?: string;
  name_ar: string;
  name_en: string;
  symbol: string;
  decimals: number;
  is_active: boolean;
  notes?: string;
}

export interface SetExchangeRateRequest {
  from_currency: string;
  to_currency: string;
  rate: string;
  rate_type: string;
  rate_date?: string;
  source?: string;
  user_id?: string;
}

export interface CurrencyContextDto {
  base_currency_code: string;
  active_currencies: Currency[];
  today_status: TodayRateStatus[];
  last_updated_at: string | null;
}

export const currencyService = {
  listCurrencies: (): Promise<Currency[]> => 
    invoke("list_currencies"),
    
  listActiveCurrencies: (): Promise<Currency[]> => 
    invoke("list_active_currencies"),
    
  createCurrency: (dto: CreateCurrencyRequest): Promise<Currency> => 
    invoke("create_currency", { dto }),

  updateCurrency: (dto: UpdateCurrencyRequest): Promise<Currency> =>
    invoke("update_currency", { dto }),

  setBaseCurrency: (code: string): Promise<Currency> =>
    invoke("set_base_currency", { code }),
    
  deleteCurrency: (code: string): Promise<void> => 
    invoke("delete_currency", { code }),

  getCurrencyContext: (): Promise<CurrencyContextDto> =>
    invoke("get_currency_context"),
    
  getTodayRatesStatus: (): Promise<TodayRateStatus[]> => 
    invoke("get_today_rates_status"),
    
  setExchangeRate: (dto: SetExchangeRateRequest): Promise<ExchangeRate> => 
    invoke("set_exchange_rate", {
      dto: {
        ...dto,
        rate_date: dto.rate_date ?? new Date().toISOString(),
        source: dto.source ?? "Manual",
      },
    }),
    
  listRateHistory: (from: string, to: string, limit: number): Promise<ExchangeRate[]> => 
    invoke("list_rate_history", { from, to, limit }),
    
  getLatestExchangeRate: (from: string, to: string): Promise<string | null> => 
    invoke("get_latest_exchange_rate", { from, to }),

  getWorldCurrencies: (): Promise<WorldCurrency[]> =>
    invoke("get_world_currencies"),

  isSetupComplete: (): Promise<boolean> =>
    invoke("is_setup_complete"),

  setupCurrencies: (baseCode: string, secondaryCode?: string): Promise<CurrencyContextDto> =>
    invoke("setup_currencies", { baseCode, secondaryCode }),
};

export interface WorldCurrency {
  code: string;
  name_ar: string;
  name_en: string;
  symbol: string;
  decimals: number;
}
