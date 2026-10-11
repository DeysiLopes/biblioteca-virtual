#!/usr/bin/env node
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const crc32 = (buf, init = 0) => zlib.crc32(buf, init);

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function draw(size) {
  const S = size;
  const buf = Buffer.alloc(S * S * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  const roundedRect = (cx, cy, w, h, rad, color, rot = 0) => {
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const x0 = Math.floor(cx - w / 2) - 1, x1 = Math.ceil(cx + w / 2) + 1;
    const y0 = Math.floor(cy - h / 2) - 1, y1 = Math.ceil(cy + h / 2) + 1;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // inside rounded-rect local coords
        const lx = x - (cx - w / 2), ly = y - (cy - h / 2);
        let inside = true;
        if (lx < rad && ly < rad) inside = dist(lx, ly, rad, rad) <= rad;
        else if (lx > w - rad && ly < rad) inside = dist(lx, ly, w - rad, rad) <= rad;
        else if (lx < rad && ly > h - rad) inside = dist(lx, ly, rad, h - rad) <= rad;
        else if (lx > w - rad && ly > h - rad) inside = dist(lx, ly, w - rad, h - rad) <= rad;
        else if (lx < 0 || lx > w || ly < 0 || ly > h) inside = false;
        if (!inside) continue;
        const wx = x - cx, wy = y - cy;
        const rx = wx * cos - wy * sin + cx;
        const ry = wx * sin + wy * cos + cy;
        if (Math.abs(rx - cx) <= w / 2 + 1 && Math.abs(ry - cy) <= h / 2 + 1)
          set(Math.round(rx), Math.round(ry), color[0], color[1], color[2]);
      }
    }
  };

  // fundo: quadrado arredondado
  roundedRect(S / 2, S / 2, S, S, 0.20 * S, [246, 235, 217]);
  // vinheta suave no rodapé
  for (let y = Math.floor(S * 0.78); y < S; y++) {
    const t = (y - S * 0.78) / (S * 0.22);
    const v = Math.floor(26 * t);
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      if (buf[i + 3] > 0) {
        buf[i] = Math.max(0, buf[i] - v);
        buf[i + 1] = Math.max(0, buf[i + 1] - v);
        buf[i + 2] = Math.max(0, buf[i + 2] - v);
      }
    }
  }

  const boardY = 0.72 * S;
  roundedRect(S / 2, boardY + 0.045 * S, 0.84 * S, 0.085 * S, 0.018 * S, [163, 122, 80]);

  // livros: [largura, altura, cor, rotação]
  const books = [
    [0.15, 0.52, [62, 92, 74], -0.05],
    [0.145, 0.6, [194, 112, 61], 0.03],
    [0.16, 0.47, [35, 58, 49], 0.08],
  ];
  let x0 = 0.315 * S;
  for (const [w, h, col, rot] of books) {
    const cx = x0 + (w * S) / 2;
    const cy = boardY - (h * S) / 2 + 0.03 * S;
    roundedRect(cx, cy, w * S, h * S, 0.02 * S, col, rot);
    x0 += w * S + 0.033 * S;
  }

  return buf;
}

function drawMaskable(size) {
  const S = size;
  const buf = Buffer.alloc(S * S * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const roundedRect = (cx, cy, w, h, rad, color, rot = 0) => {
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const x0 = Math.floor(cx - w / 2) - 1, x1 = Math.ceil(cx + w / 2) + 1;
    const y0 = Math.floor(cy - h / 2) - 1, y1 = Math.ceil(cy + h / 2) + 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const lx = x - (cx - w / 2), ly = y - (cy - h / 2);
      let inside = true;
      if (lx < rad && ly < rad) inside = dist(lx, ly, rad, rad) <= rad;
      else if (lx > w - rad && ly < rad) inside = dist(lx, ly, w - rad, rad) <= rad;
      else if (lx < rad && ly > h - rad) inside = dist(lx, ly, rad, h - rad) <= rad;
      else if (lx > w - rad && ly > h - rad) inside = dist(lx, ly, w - rad, h - rad) <= rad;
      else if (lx < 0 || lx > w || ly < 0 || ly > h) inside = false;
      if (!inside) continue;
      const wx = x - cx, wy = y - cy;
      const rx = wx * cos - wy * sin + cx;
      const ry = wx * sin + wy * cos + cy;
      if (Math.abs(rx - cx) <= w / 2 + 1 && Math.abs(ry - cy) <= h / 2 + 1)
        set(Math.round(rx), Math.round(ry), color[0], color[1], color[2]);
    }
  };
  // fundo cheio
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, 246, 235, 217);
  const boardY = 0.74 * S;
  roundedRect(S / 2, boardY + 0.04 * S, 0.7 * S, 0.08 * S, 0.02 * S, [163, 122, 80]);
  const books = [
    [0.13, 0.46, [62, 92, 74], -0.05],
    [0.125, 0.53, [194, 112, 61], 0.03],
    [0.14, 0.42, [35, 58, 49], 0.08],
  ];
  let x0 = 0.345 * S;
  for (const [w, h, col, rot] of books) {
    const cx = x0 + (w * S) / 2;
    const cy = boardY - (h * S) / 2 + 0.02 * S;
    roundedRect(cx, cy, w * S, h * S, 0.02 * S, col, rot);
    x0 += w * S + 0.03 * S;
  }
  return buf;
}

const dir = path.join(__dirname, "..");
for (const size of [192, 512]) {
  fs.writeFileSync(path.join(dir, `icon-${size}.png`), encodePNG(size, draw(size)));
  fs.writeFileSync(path.join(dir, `icon-maskable-${size}.png`), encodePNG(size, drawMaskable(size)));
  console.log(`icon-${size}.png / icon-maskable-${size}.png ok`);
}