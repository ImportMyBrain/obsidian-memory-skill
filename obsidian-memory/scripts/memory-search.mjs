#!/usr/bin/env node
/**
 * memory-search.mjs — compact search over the memory index.
 *
 * Returns only the top-k matching index rows (title / path / date / summary),
 * so the AI never has to read the whole vault or a raw grep dump.
 *
 * Usage:
 *   node scripts/memory-search.mjs --vault "D:\Obsidian\MyVault" --query "考研 数学"
 *   node scripts/memory-search.mjs --index "D:\Obsidian\MyVault\.memory\index.json" --query "项目" --top 3
 *
 * Options:
 *   --vault <path>     Vault root (index path inferred: <vault>/.memory/index.json)
 *   --index <file>     Explicit index.json path
 *   --query <text>     Keywords (required)
 *   --top <n>          Max results (default 5)
 *   --max-chars <n>    Output budget (default 2000)
 *   --include-cold     Include archive/cold notes
 *
 * Zero dependencies, no network, no writes.
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

function arg(name, fallback) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = args[i + 1];
  if (v === undefined || v.startsWith('--')) return fallback;
  return v;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

const VAULT = arg('vault', process.env.OBSIDIAN_VAULT || '');
const INDEX = path.resolve(arg('index', VAULT ? path.join(VAULT, '.memory', 'index.json') : ''));
const QUERY = arg('query', '');
const TOP = Math.max(1, Math.min(20, Number(arg('top', '5')) || 5));
const MAX_CHARS = Math.max(400, Number(arg('max-chars', '2000')) || 2000);
const INCLUDE_COLD = args.includes('--include-cold');

function fail(msg) {
  console.error(`memory-search: ${msg}`);
  process.exit(2);
}

function normalize(text) {
  return String(text || '').toLowerCase();
}

function tokenize(query) {
  const raw = String(query || '').trim().toLowerCase();
  const tokens = new Set();
  if (!raw) return { raw, tokens: [] };
  tokens.add(raw);
  const parts = raw.split(/[\s,，、;；:：/|()（）\-+]+/).filter(Boolean);
  for (const part of parts) {
    if (!part) continue;
    tokens.add(part);
    // CJK: add bigrams so partial phrases still match
    const cjkRuns = part.match(/[\u3400-\u9fff]+/g) || [];
    for (const run of cjkRuns) {
      if (run.length >= 2) for (let i = 0; i + 2 <= run.length; i += 1) tokens.add(run.slice(i, i + 2));
    }
    // Latin: words already split; add prefixes for light fuzzy match
    const latinRuns = part.match(/[a-z0-9]{2,}/g) || [];
    for (const run of latinRuns) tokens.add(run);
  }
  return { raw, tokens: [...tokens] };
}

function build() {
  if (!QUERY.trim()) fail('--query is required');
  if (!INDEX || !fs.existsSync(INDEX)) {
    fail(`index not found: ${INDEX || '(empty)'}. Run: node scripts/memory-build.mjs --vault "<vault>"`);
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
  } catch (error) {
    fail(`cannot parse ${INDEX}: ${error.message}`);
  }
  const notes = Array.isArray(data.notes) ? data.notes : [];
  if (notes.length === 0) fail('index has no notes; rerun memory-build');

  const { raw, tokens } = tokenize(QUERY);
  const phrase = normalize(raw);
  const scored = [];

  for (const note of notes) {
    if (note.cold && !INCLUDE_COLD) continue;
    const title = normalize(note.title);
    const summary = normalize(note.summary);
    const tags = normalize(note.tags);
    const p = normalize(note.path);
    let score = 0;
    for (const token of tokens) {
      if (!token) continue;
      if (title.includes(token)) score += 10;
      if (tags.includes(token)) score += 6;
      if (summary.includes(token)) score += 4;
      if (p.includes(token)) score += 2;
    }
    if (phrase && title.includes(phrase)) score += 15;
    if (note.cold) score -= 15;
    if (score > 0) scored.push({ note, score });
  }

  scored.sort((a, b) => b.score - a.score || String(b.note.updated).localeCompare(String(a.note.updated)));
  const top = scored.slice(0, TOP);

  const lines = [];
  lines.push(`# memory-search: "${raw}"`);
  lines.push(`# top ${top.length} of ${scored.length} matches · ${notes.length} notes · cold ${INCLUDE_COLD ? 'included' : 'excluded'} · ${data.vault || ''}`);
  if (top.length === 0) {
    lines.push('');
    lines.push('No matching notes. Try different keywords, or use --include-cold for archived conversation logs.');
    console.log(lines.join('\n'));
    return;
  }

  let idx = 0;
  for (const { note, score } of top) {
    idx += 1;
    const coldMark = note.cold ? ' · cold' : '';
    const head = `${idx}. [${score}] **${note.title}** — \`${note.path}\` · ${note.updated}${coldMark}`;
    const body = note.summary ? `   ${note.summary}` : '';
    const block = [head, body].filter(Boolean).join('\n');
    if (lines.join('\n').length + block.length > MAX_CHARS) break;
    lines.push(block);
  }
  lines.push('');
  lines.push('> 下一级：确认候选后，读对应笔记的前 60~80 行或相关段落；仍不够再读全文（同类问题最多读 1~2 篇）。');
  console.log(lines.join('\n'));
}

build();
