import { invoke } from '@shared/lib/invoke';
import type { JournalFilters } from '@shared/types/filters';
import type { 
  JournalEntryDto, 
  CreateJournalEntryRequest 
} from '@erp/shared-types';

export type { JournalFilters };

export const journalEntryService = {
  async createJournalEntry(request: CreateJournalEntryRequest): Promise<JournalEntryDto> {
    return await invoke<JournalEntryDto>('create_journal_entry', { request });
  },

  async listJournalEntries(filters?: JournalFilters): Promise<JournalEntryDto[]> {
    return await invoke<JournalEntryDto[]>('list_journal_entries', filters || {});
  },

  async listPostedJournalEntries(
    fromDate?: string,
    toDate?: string,
    accountId?: string,
    partnerId?: string,
  ): Promise<JournalEntryDto[]> {
    return await invoke<JournalEntryDto[]>('list_posted_journal_entries', {
      fromDate,
      toDate,
      accountId,
      partnerId,
    });
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
