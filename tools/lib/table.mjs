// Minimal readers for the translation table: CSV / TSV / JSON / XLSX (no dependencies).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const normalizeHeader = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s_\-]/g, '');

const HEADER_ALIASES = {
  id: ['id', 'card', 'cardid', 'cardno', 'number', '编号', '卡号', '卡牌编号', '卡片编号', '卡片id', '卡牌id'],
  name: [
    'name',
    'namezh',
    'zh',
    'zhname',
    '中文名',
    '中文名称',
    '中文卡名',
    '卡名',
    '卡牌名称',
    '译名',
    '中文译名',
    '名称',
  ],
  text: ['text', 'textzh', 'zhtext', '中文文本', '中文效果', '中文效果文本', '中译效果', '卡文', '中文卡文', '效果', '效果文本'],
  en: ['en', 'nameen', 'english', '英文', '英文名', '英文卡名'],
  ja: ['ja', 'nameja', 'japanese', '日文', '日文名', '日文卡名'],
  ko: ['ko', 'nameko', 'korean', '韩文', '韩文名', '韩文卡名'],
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeXml = (value) =>
  value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ENTITIES[name]);

function readZip(buffer) {
  let eocd = -1;
  const floor = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= floor; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('不是有效的 xlsx（zip）文件');
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.set(name, { method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return (name) => {
    const entry = entries.get(name);
    if (!entry) return null;
    const local = entry.localOffset;
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error('xlsx 本地文件头损坏: ' + name);
    const nameLength = buffer.readUInt16LE(local + 26);
    const extraLength = buffer.readUInt16LE(local + 28);
    const start = local + 30 + nameLength + extraLength;
    const data = buffer.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) return data;
    if (entry.method === 8) return zlib.inflateRawSync(data);
    throw new Error('不支持的 zip 压缩方式: ' + entry.method);
  };
}

function readSharedStrings(read) {
  const raw = read('xl/sharedStrings.xml');
  if (!raw) return [];
  const xml = raw.toString('utf8');
  const strings = [];
  for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const body = match[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    const parts = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1]));
    strings.push(parts.join(''));
  }
  return strings;
}

function columnIndex(ref) {
  const letters = String(ref).replace(/\d+/g, '');
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.toUpperCase().charCodeAt(0) - 64);
  return index - 1;
}

function readSheetRows(read, shared) {
  const sheet = read('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('xlsx 中找不到 xl/worksheets/sheet1.xml');
  const xml = sheet.toString('utf8');
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const values = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2] || '';
      const ref = /r="([A-Za-z]+\d+)"/.exec(attrs)?.[1];
      const type = /t="([^"]+)"/.exec(attrs)?.[1];
      let value = '';
      if (type === 'inlineStr') {
        value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1])).join('');
      } else {
        const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (raw !== undefined) value = type === 's' ? shared[Number(raw)] ?? '' : decodeXml(raw);
      }
      if (ref) values[columnIndex(ref)] = value;
      else values.push(value);
    }
    rows.push(values);
  }
  return rows;
}

function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function rowsFromMatrix(matrix) {
  if (!matrix.length) return [];
  const [headerRow, ...body] = matrix;
  const columns = new Map();
  headerRow.forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (!key) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(key) && !columns.has(field)) columns.set(field, index);
    }
  });
  if (!columns.size) throw new Error('译名表第一行没有可识别的表头（需要 id / 卡名 / 卡文 等列）');
  return body
    .filter((row) => row.some((cell) => String(cell ?? '').trim()))
    .map((row) => {
      const record = {};
      for (const [field, index] of columns) record[field] = String(row[index] ?? '').trim();
      return record;
    });
}

function rowsFromJson(data) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.translations)
      ? data.translations
      : Array.isArray(data?.cards)
        ? data.cards
        : null;
  if (list) {
    return list.map((item) => ({
      id: String(item.id ?? item.card ?? item.number ?? '').trim(),
      name: String(item.name ?? item.zh ?? item.name_zh ?? item['卡名'] ?? '').trim(),
      text: String(item.text ?? item.zh_text ?? item['卡文'] ?? '').trim(),
      en: String(item.en ?? item.name_en ?? '').trim(),
      ja: String(item.ja ?? item.name_ja ?? '').trim(),
      ko: String(item.ko ?? item.name_ko ?? '').trim(),
    }));
  }
  const map = data?.cards ?? data;
  if (map && typeof map === 'object') {
    return Object.entries(map).map(([id, value]) => {
      if (Array.isArray(value)) return { id, name: String(value[0] ?? '').trim(), text: String(value[1] ?? '').trim() };
      if (typeof value === 'string') return { id, name: value.trim(), text: '' };
      return {
        id: String(value?.id ?? id).trim(),
        name: String(value?.name ?? value?.zh ?? value?.name_zh ?? '').trim(),
        text: String(value?.text ?? value?.zh_text ?? '').trim(),
        en: String(value?.en ?? '').trim(),
        ja: String(value?.ja ?? '').trim(),
        ko: String(value?.ko ?? '').trim(),
      };
    });
  }
  throw new Error('无法识别的 JSON 结构：需要 { "cards": { 卡号: ... } } 或数组');
}

export function readTable(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.json') return rowsFromJson(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')));
  if (extension === '.xlsx') {
    const read = readZip(fs.readFileSync(file));
    const shared = readSharedStrings(read);
    return rowsFromMatrix(readSheetRows(read, shared));
  }
  const text = fs.readFileSync(file, 'utf8');
  const delimiter = extension === '.tsv' || !text.includes(',') ? '\t' : ',';
  const matrix = delimiter === '\t' ? text.split(/\r?\n/).map((line) => line.split('\t')) : parseCsv(text);
  return rowsFromMatrix(matrix);
}
