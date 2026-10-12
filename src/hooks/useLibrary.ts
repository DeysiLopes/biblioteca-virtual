import { useState, useEffect, useCallback } from 'react';
import { Book } from '../core/models/book';
import { DiaryEntry } from '../core/models/diary';
import { syncManager } from '../core/storage/sync-manager';
import { syncChannel } from '../core/broadcast/channel';
import { computeDashboardSummary, DashboardSummary } from '../core/business/dashboard';

export function useLibrary() {
  const [books, setBooks] = useState<Book[]>([]);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const refreshData = useCallback(() => {
    const b = syncManager.getBooks();
    const d = syncManager.getDiary();
    setBooks(b);
    setDiary(d);
    setSummary(computeDashboardSummary(b, d));
  }, []);

  useEffect(() => {
    let mounted = true;
    syncManager.initialize().then(({ books: b, diary: d }) => {
      if (mounted) {
        setBooks(b);
        setDiary(d);
        setSummary(computeDashboardSummary(b, d));
        setLoading(false);
      }
    });

    const unsubscribe = syncChannel.subscribe((msg) => {
      if (msg.type === 'LIBRARY_UPDATED' && mounted) {
        refreshData();
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [refreshData]);

  const saveBook = async (book: Book, diaryEntry?: DiaryEntry) => {
    await syncManager.saveBook(book, diaryEntry);
    refreshData();
  };

  const saveBatch = async (newBooks: Book[], newDiary: DiaryEntry[] = []) => {
    await syncManager.saveBatch(newBooks, newDiary);
    refreshData();
  };

  const removeBook = async (id: string) => {
    await syncManager.removeBook(id);
    refreshData();
  };

  const exportBackup = () => {
    syncManager.exportDriveBackup();
  };

  return {
    books,
    diary,
    loading,
    summary,
    saveBook,
    saveBatch,
    removeBook,
    exportBackup,
    refreshData,
  };
}
