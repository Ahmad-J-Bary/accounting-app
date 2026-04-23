import { invoke } from '@/lib/invoke';
import type { 
  InvoiceDto, 
  CreateInvoiceRequest 
} from '@erp/shared-types';

export const invoiceService = {
  async createInvoice(request: CreateInvoiceRequest): Promise<InvoiceDto> {
    return await invoke<InvoiceDto>('create_invoice', { request });
  },

  async listInvoices(customerId?: string): Promise<InvoiceDto[]> {
    return await invoke<InvoiceDto[]>('list_invoices', { customerId });
  },

  async postInvoice(id: string): Promise<InvoiceDto> {
    return await invoke<InvoiceDto>('post_invoice', { id });
  },
};
