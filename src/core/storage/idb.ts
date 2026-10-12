import { Book } from '../models/book';
import { DiaryEntry } from '../models/diary';
import { UserMeta } from '../models/user-data';

const DB_NAME = 'biblioteca';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getIDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('diary')) {
          db.createObjectStore('diary', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'k' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export async function getAllBooks(): Promise<Book[]> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readonly');
    const store = tx.objectStore('books');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function putBook(book: Book): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readwrite');
    const store = tx.objectStore('books');
    const req = store.put(book);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function putBooksBatch(books: Book[]): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readwrite');
    const store = tx.objectStore('books');
    for (const b of books) {
      store.put(b);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readwrite');
    const store = tx.objectStore('books');
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllDiary(): Promise<DiaryEntry[]> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('diary', 'readonly');
    const store = tx.objectStore('diary');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function putDiaryEntry(entry: DiaryEntry): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('diary', 'readwrite');
    const store = tx.objectStore('diary');
    const req = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function putDiaryBatch(entries: DiaryEntry[]): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('diary', 'readwrite');
    const store = tx.objectStore('diary');
    for (const d of entries) {
      store.put(d);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Transação atômica que grava o livro e opcionalmente adiciona uma sessão no diário na mesma transação.
 */
export async function persistBookAndDiaryAtomic(book: Book, diaryEntry?: DiaryEntry): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const stores = diaryEntry ? ['books', 'diary'] : ['books'];
    const tx = db.transaction(stores, 'readwrite');
    tx.objectStore('books').put(book);
    if (diaryEntry) {
      tx.objectStore('diary').put(diaryEntry);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearStore(name: 'books' | 'diary' | 'meta'): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    const req = tx.objectStore(name).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getMetaValue<T>(key: string): Promise<T | null> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readonly');
    const req = tx.objectStore('meta').get(key);
    req.onsuccess = () => resolve(req.result ? req.result.v : null);
    req.onerror = () => reject(req.error);
  });
}

export async function setMetaValue<T>(key: string, value: T): Promise<void> {
  const db = await getIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    const req = tx.objectStore('meta').put({ k: key, v: value });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
