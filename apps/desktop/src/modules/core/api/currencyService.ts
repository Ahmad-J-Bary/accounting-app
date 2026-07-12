import { invoke } from "@shared/lib/invoke";
import type {
  Currency,
  ExchangeRate,
  TodayRateStatus,
  CreateCurrencyRequest,
  UpdateCurrencyRequest,
  SetExchangeRateRequest,
  CurrencyContextDto,
  WorldCurrency,
} from "@erp/shared-types";

export type {
  Currency,
  ExchangeRate,
  TodayRateStatus,
  CreateCurrencyRequest,
  UpdateCurrencyRequest,
  SetExchangeRateRequest,
  CurrencyContextDto,
  WorldCurrency,
};

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
