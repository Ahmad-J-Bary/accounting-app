import { invoke } from '@/lib/invoke';
import type { 
  JournalEntryDto, 
  CreateJournalEntryRequest 
} from '@erp/shared-types';

export const journalEntryService = {
  async createJournalEntry(request: CreateJournalEntryRequest): Promise<JournalEntryDto> {
    return await invoke<JournalEntryDto>('create_journal_entry', { request });
  },

  async listJournalEntries(): Promise<JournalEntryDto[]> {
    return await invoke<JournalEntryDto[]>('list_journal_entries');
  },

  async postJournalEntry(entryId: string): Promise<JournalEntryDto> {
    return await invoke<JournalEntryDto>('post_journal_entry', { entryId });
  },
};
