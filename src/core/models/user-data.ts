import { Book } from './book';
import { DiaryEntry } from './diary';

export interface UserMeta {
  reminder?: { time: string };
  lastSyncAt?: number;
  migratedFromSyncJson?: boolean;
}

export interface UserLibraryData {
  version: number;
  updatedAt: number;
  books: Book[];
  diary: DiaryEntry[];
  meta?: UserMeta;
}
