#!/usr/bin/env node
"use strict";
// Gera books.json a partir do banco de Leituras no Notion.
const { readFileSync, existsSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const DB_ID = process.env.NOTION_LEITURAS_DB || "3f61815b-43b3-818c-9486-c2a0f3a81179";
const TOKEN_PATH = process.env.NOTION_TOKEN_FILE || `${process.env.HOME}/.config/opencode/notion-token`;
const OUT = join(__dirname, "books.json");

if (!existsSync(TOKEN_PATH)) { console.error("erro: token não encontrado."); process.exit(1); }
const token = readFileSync(TOKEN_PATH, "utf8").trim();

async function api(path, method, body) {
  const res = await fetch("https://api.notion.com/v1" + path, {
    method, headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${j.code || res.status}: ${j.message}`);
  return j;
}

const txt = (p, key) => (p.properties[key]?.rich_text || []).map((x) => x.plain_text).join("");
const sel = (p, key) => p.properties[key]?.select?.name || null;
const num = (p, key) => p.properties[key]?.number ?? null;
const fnum = (p, key) => { const f = p.properties[key]?.formula; return f ? f[f.type] ?? null : null; };
const dstart = (p, key) => p.properties[key]?.date?.start || null;

(async () => {
  const out = [];
  let cursor;
  do {
    const b = { page_size: 100 };
    if (cursor) b.start_cursor = cursor;
    const r = await api(`/databases/${DB_ID}/query`, "POST", b);
    for (const p of r.results) {
      const cover = p.cover?.type === "external" ? p.cover.external.url : p.cover?.type === "file" ? p.cover.file.url : "";
      out.push({
        id: p.id,
        title: (p.properties["Título"].title || []).map((x) => x.plain_text).join(""),
        author: txt(p, "Autor"),
        status: sel(p, "Status"),
        genero: sel(p, "Gênero"),
        formato: sel(p, "Formato"),
        idioma: sel(p, "Idioma"),
        tipo: sel(p, "Tipo"),
        paginas: num(p, "Páginas"),
        paginasLidas: num(p, "Páginas lidas"),
        inicio: dstart(p, "Início"),
        fim: dstart(p, "Fim"),
        nota: num(p, "Nota"),
        comentarios: txt(p, "Comentários"),
        resenha: txt(p, "Resenha"),
        progresso: fnum(p, "Progresso"),
        estrelas: fnum(p, "Estrelas"),
        ano: fnum(p, "Ano"),
        cover,
      });
    }
    cursor = r.has_more ? r.next_cursor : undefined;
  } while (cursor);

  out.sort((a, b) => a.title.localeCompare(b.title, "pt"));
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`books.json atualizado: ${out.length} livros.`);
})();