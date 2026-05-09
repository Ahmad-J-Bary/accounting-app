import { invoke } from '@shared/lib/invoke';
import type { 
  JournalEntryDto, 
  CreateJournalEntryRequest 
} from '@erp/shared-types';

export interface JournalFilters {
  from_date?: string;
  to_date?: string;
  journal_type?: string;
  account_id?: string;
  partner_id?: string;
  status?: string;
  [key: string]: unknown;
}

export const journalEntryService = {
  async createJournalEntry(request: CreateJournalEntryRequest): Promise<JournalEntryDto> {
    return await invoke<JournalEntryDto>('create_journal_entry', { request });
  },

  async listJournalEntries(filters?: JournalFilters): Promise<JournalEntryDto[]> {
    return await invoke<JournalEntryDto[]>('list_journal_entries', filters || {});
  },

  async getJournalEntryDetails(id: string): Promise<JournalEntryDto> {
    return await invoke<JournalEntryDto>('get_journal_entry_details', { id });
  },

  async postJournalEntry(entryId: string): Promise<JournalEntryDto> {
    return await invoke<JournalEntryDto>('post_journal_entry', { entryId });
  },

  async reverseJournalEntry(entryId: string): Promise<JournalEntryDto> {
    return await invoke<JournalEntryDto>('reverse_journal_entry', { entryId });
  },
};
