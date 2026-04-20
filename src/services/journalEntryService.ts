import { invoke } from '@tauri-apps/api/core';
import type { 
  JournalEntryDto, 
  CreateJournalEntryRequest 
} from '@erp/shared-types';

export const journalEntryService = {
  async createJournalEntry(request: CreateJournalEntryRequest): Promise<JournalEntryDto> {
    // TODO: Implement Tauri command
    return {} as JournalEntryDto;
  },

  async listJournalEntries(): Promise<JournalEntryDto[]> {
    // TODO: Implement Tauri command
    return [];
  },

  async postJournalEntry(entryId: string): Promise<JournalEntryDto> {
    // TODO: Implement Tauri command
    return {} as JournalEntryDto;
  },
};
