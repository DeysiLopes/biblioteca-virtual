export type BookStatus = 'Quero ler' | 'Lendo' | 'Lido' | 'Abandonado';

export interface Citacao {
  id: string;
  text: string;
  page: number;
  ts: number;
  updatedAt?: number;
}

export interface DeletedCitacao {
  id: string;
  ts: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  genero?: string | null;
  formato?: string | null;
  idioma?: string | null;
  tipo?: string | null; // e.g. "Estudo", "Lazer"
  paginas?: number | null;
  paginasLidas?: number | null;
  inicio?: string | null; // YYYY-MM-DD
  fim?: string | null;    // YYYY-MM-DD
  nota?: number;
  comentarios?: string;
  resenha?: string;
  cover?: string;
  codigo_isbn?: string | null;
  readingEpoch?: number;
  citacoes?: Citacao[];
  deletedCitacoes?: DeletedCitacao[];
  updatedAt?: number;
}
