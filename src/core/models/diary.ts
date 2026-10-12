export interface DiaryEntry {
  id: string; // UUID string
  bookId: string;
  date: string; // YYYY-MM-DD
  pages: number;
  note?: string;
  ts: number;
  readingEpoch?: number;
}
