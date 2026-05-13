import { invoke } from '@shared/lib/invoke';
import type { 
  InvoiceDto, 
  CreateInvoiceRequest,
  UpdateInvoiceRequest
} from '@erp/shared-types';

export const invoiceService = {
  async createInvoice(request: CreateInvoiceRequest): Promise<InvoiceDto> {
    return await invoke<InvoiceDto>('create_unified_invoice', { request });
  },

  async updateInvoice(request: UpdateInvoiceRequest): Promise<InvoiceDto> {
    return await invoke<InvoiceDto>('update_unified_invoice', { request });
  },

  async listInvoicesByType(invoiceType: "Sales" | "Purchase" | "OpeningBalance" | ("Purchase" | "OpeningBalance")[]): Promise<InvoiceDto[]> {
    if (Array.isArray(invoiceType)) {
      const results = await Promise.all(
        invoiceType.map(t => invoke<InvoiceDto[]>('list_unified_invoices_by_type', { invoiceType: t }))
      );
      return results.flat().sort((a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime());
    }
    return await invoke<InvoiceDto[]>('list_unified_invoices_by_type', { invoiceType });
  },

  async getInvoiceById(id: string): Promise<InvoiceDto> {
    return await invoke<InvoiceDto>('get_unified_invoice_by_id', { id });
  },

  async postInvoice(id: string): Promise<InvoiceDto> {
    return await invoke<InvoiceDto>('post_unified_invoice', { id });
  },

  async listInvoices(): Promise<InvoiceDto[]> {
    return await invoke<InvoiceDto[]>('list_all_unified_invoices');
  },

  async reopenInvoice(id: string): Promise<InvoiceDto> {
    return await invoke<InvoiceDto>('reopen_unified_invoice', { id });
  },

  async getNextInvoiceNumber(invoiceType: "Sales" | "Purchase" | "OpeningBalance"): Promise<string> {
    return await invoke<string>('get_next_invoice_number', { invoiceType });
  },
  
  async deleteInvoice(id: string): Promise<void> {
    return await invoke<void>('delete_unified_invoice', { id });
  },
};
