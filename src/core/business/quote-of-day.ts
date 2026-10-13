import { Book, Citacao } from '../models/book';
import { getMetaValue, setMetaValue } from '../storage/idb';

export interface QuoteOfDay {
  quote: Citacao;
  book: Book;
}

/**
 * Todas as citações vivas da biblioteca (fora dos tombstones de exclusão),
 * em ordem estável por id — a seleção do dia precisa ser idêntica em
 * qualquer aparelho, então nada de depender da ordem do array de livros.
 */
export function getAllQuotes(books: Book[]): QuoteOfDay[] {
  const tombstones = new Set<string>();
  books.forEach((b) =>
    (b.deletedCitacoes ?? []).forEach((t) => t?.id && tombstones.add(t.id))
  );
  const out: QuoteOfDay[] = [];
  books.forEach((b) =>
    (b.citacoes ?? []).forEach((c) => {
      if (c?.id && !tombstones.has(c.id)) out.push({ quote: c, book: b });
    })
  );
  out.sort((a, b) => a.quote.id.localeCompare(b.quote.id));
  return out;
}

/** Chave do dia no fuso local — "2026-10-13". */
export function dayKey(date: Date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * Citação do dia: hash determinístico da data local → índice na lista
 * estável. Todos os aparelhos mostram a mesma frase no mesmo dia, sem
 * precisar de rede nem de entidade persistida.
 */
export function getQuoteOfTheDay(
  books: Book[],
  date: Date = new Date()
): QuoteOfDay | null {
  const all = getAllQuotes(books);
  if (!all.length) return null;
  const key = dayKey(date);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return all[h % all.length];
}

/* --- Lembrete diário (notificação) ------------------------------------ */

const META_QUOTE_REMINDER = 'quoteReminder';
const META_QUOTE_NOTIF_DATE = 'quoteNotifDate';

export async function isQuoteReminderEnabled(): Promise<boolean> {
  return (await getMetaValue<boolean>(META_QUOTE_REMINDER)) === true;
}

export async function setQuoteReminder(enabled: boolean): Promise<void> {
  await setMetaValue(META_QUOTE_REMINDER, enabled);
}

/**
 * Dispara a "Citação do dia" como notificação, no máximo uma vez por dia.
 * Um PWA estático não tem push agendado sem servidor (NotificationTrigger
 * ainda é experimental), então a notificação sai quando o app é aberto —
 * no mobile é a "frase do dia" ao abrir o app instalado.
 */
export async function maybeNotifyQuoteOfDay(books: Book[]): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!(await isQuoteReminderEnabled())) return;
  const today = dayKey();
  if ((await getMetaValue<string>(META_QUOTE_NOTIF_DATE)) === today) return;

  const qod = getQuoteOfTheDay(books);
  if (!qod) return;
  await setMetaValue(META_QUOTE_NOTIF_DATE, today);

  const body = `“${qod.quote.text}” — ${qod.book.title}${qod.quote.page ? `, p. ${qod.quote.page}` : ''}`;
  const opts = { body, tag: 'quote-of-day' };
  try {
    // Android/PWA exige showNotification via ServiceWorkerRegistration
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification('✨ Citação do dia', opts);
    else new Notification('✨ Citação do dia', opts);
  } catch {
    try {
      new Notification('✨ Citação do dia', opts);
    } catch {
      // sem suporte a notificação — o cartão na Estante continua funcionando
    }
  }
}
