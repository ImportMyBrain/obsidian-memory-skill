#!/usr/bin/env node
/**
 * memory-build.mjs — build the two-level memory index for a notes vault.
 *
 * Produces, inside <vault>/.memory/:
 *   MEMORY_DIGEST.md   Level 0 "cheat sheet": profile, goals, active projects, recent notes (~2 KB)
 *   MEMORY_INDEX.md    Level 1 readable index: one line per note
 *   index.json         machine index used by memory-search.mjs
 *
 * Usage:
 *   node scripts/memory-build.mjs --vault "D:\Obsidian\MyVault"
 *   node scripts/memory-build.mjs --vault "D:\Obsidian\MyVault" --archive "Chats" --archive "Archive"
 *
 * Options:
 *   --vault <path>        Vault root (or env OBSIDIAN_VAULT)
 *   --out <dir>           Output dir (default <vault>/.memory)
 *   --archive <path>      Archive dir (relative to vault); repeatable; also auto-detected
 *   --digest-chars <n>    Digest budget (default 2600)
 *   --summary-chars <n>   Summary length in index (default 90)
 *   --days <n>            "Recent" window (default 30)
 *
 * Zero dependencies, read-only on notes, never touches the network.
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

function argAll(name) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === `--${name}` && args[i + 1] && !args[i + 1].startsWith('--')) out.push(args[i + 1]);
  }
  return out;
}

function normPath(p) {
  return p.replaceAll('\\', '/').replace(/\/+$/, '');
}

const VAULT = path.resolve(arg('vault', process.env.OBSIDIAN_VAULT || ''));
const OUT = path.resolve(arg('out', VAULT ? path.join(VAULT, '.memory') : ''));
const DIGEST_CHARS = Math.max(800, Number(arg('digest-chars', '2600')) || 2600);
const SUMMARY_CHARS = Math.max(40, Number(arg('summary-chars', '90')) || 90);
const RECENT_DAYS = Math.max(1, Number(arg('days', '30')) || 30);

const SKIP_DIRS = new Set(['.obsidian', '.trash', '.git', 'node_modules', '_source', '.memory']);
const ARCHIVE_SEGMENT_RE = /(^|[\s_-])(archive|archived|backup|backups|snapshot|归档|旧版|历史|memory-recovery|记忆恢复)([\s_-]|$)/i;
const ENTRY_RE = /^(00[\s_.-]*)?(index|home|首页|readme|moc|总览)/i;
const PROFILE_RE = /profile|personal|identity|about[-_ ]?me|preferences?|个人|偏好|简介|关于我|设定/i;
const GOAL_RE = /goal|target|priority|plan|roadmap|目标|计划|优先级|规划/i;
const PROJECT_RE = /project|projects|work|workspace|项目|作品|业务/i;

function fail(msg) {
  console.error(`memory-build: ${msg}`);
  process.exit(1);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const hit = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!hit) continue;
    let value = hit[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
    fm[hit[1].toLowerCase()] = value;
  }
  return fm;
}

function plain(text) {
  return String(text)
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstHeading(text) {
  const m = stripFrontmatter(text).match(/^#\s+(.+)$/m);
  return m ? plain(m[1]) : '';
}

function summaryOf(body, fm) {
  const fromFm = fm.summary || fm.description || '';
  if (typeof fromFm === 'string' && fromFm.trim()) return plain(String(fromFm)).slice(0, SUMMARY_CHARS);
  const lines = stripFrontmatter(body).split(/\r?\n/);
  for (const raw of lines) {
    const rawTrim = raw.trim();
    if (!rawTrim || rawTrim.startsWith('#') || rawTrim.startsWith('```') || rawTrim.startsWith('---')) continue;
    const line = rawTrim
      .replace(/^[-*+]\s+/, '')
      .replace(/^>+\s*/, '')
      .replace(/^\[![^\]]+\]\s*/, '')
      .trim();
    if (!line) continue;
    return plain(line).slice(0, SUMMARY_CHARS);
  }
  return '';
}

function collect() {
  const notes = [];
  const now = Date.now();
  const recentMs = RECENT_DAYS * 24 * 60 * 60 * 1000;
  const archivePrefixes = argAll('archive').map((p) => normPath(p).replace(/^\/+/, ''));

  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(abs);
        continue;
      }
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
      let stat;
      try {
        stat = fs.statSync(abs);
      } catch {
        continue;
      }
      if (stat.size > 512 * 1024) continue;
      const rel = normPath(path.relative(VAULT, abs));
      if (archivePrefixes.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) {
        // still indexed, but marked cold
      }
      let text;
      try {
        text = fs.readFileSync(abs, 'utf8');
      } catch {
        continue;
      }
      const fm = parseFrontmatter(text);
      const tags = Array.isArray(fm.tags) ? fm.tags.join(' ') : String(fm.tags || '');
      const title = (typeof fm.title === 'string' && fm.title.trim()) || firstHeading(text) || path.basename(abs, '.md');
      const updatedRaw = fm.updated || fm.created;
      const updated = updatedRaw ? new Date(String(updatedRaw)) : stat.mtime;
      const dateOk = !Number.isNaN(updated.getTime());
      const haystack = `${rel} ${title} ${tags}`;
      const explicitArchive = archivePrefixes.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`));
      const autoArchive = rel.split('/').some((segment) => ARCHIVE_SEGMENT_RE.test(segment));
      notes.push({
        title,
        path: rel,
        tags: String(tags),
        summary: summaryOf(text, fm),
        updated: dateOk ? updated : stat.mtime,
        cold: explicitArchive || autoArchive,
        size: stat.size,
        recent: now - (dateOk ? updated.getTime() : stat.mtime.getTime()) <= recentMs,
        entry: ENTRY_RE.test(path.basename(rel, '.md')),
        profile: PROFILE_RE.test(haystack),
        goal: GOAL_RE.test(haystack),
        project: PROJECT_RE.test(haystack),
      });
    }
  };

  walk(VAULT);
  notes.sort((a, b) => b.updated - a.updated);
  return notes;
}

function build() {
  if (!VAULT || !fs.existsSync(VAULT) || !fs.statSync(VAULT).isDirectory()) {
    fail(`vault not found: "${VAULT || '(empty)'}". Pass --vault "<path>" or set OBSIDIAN_VAULT.`);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const notes = collect();
  if (notes.length === 0) fail(`no Markdown notes found under ${VAULT}`);
  const cold = notes.filter((n) => n.cold);
  const hot = notes.filter((n) => !n.cold);

  // ---------- Level 0: digest ----------
  const generated = new Date();
  const digestLines = [];
  const addLine = (line) => digestLines.push(line);
  const totalChars = () => digestLines.join('\n').length;

  addLine('# Memory Digest');
  addLine('');
  addLine(`<!-- 自动生成的小抄，供 AI 每轮先读；不要手改。生成于 ${fmtDate(generated)} ${pad(generated.getHours())}:${pad(generated.getMinutes())}；库：${path.basename(VAULT)}；笔记 ${notes.length} 篇（冷 ${cold.length}） -->`);
  addLine('');

  const entryNotes = hot.filter((n) => n.entry && !n.profile).slice(0, 2);
  const profileNotes = hot.filter((n) => n.profile).slice(0, 5);
  const goalNotes = hot.filter((n) => n.goal).slice(0, 5);
  const projectNotes = hot.filter((n) => n.project).slice(0, 8);
  const used = new Set();
  const addSection = (heading, list, cap) => {
    const chosen = list.filter((n) => !used.has(n.path)).slice(0, cap);
    if (chosen.length === 0) return;
    if (totalChars() > DIGEST_CHARS * 0.9) return;
    addLine(`## ${heading}`);
    for (const n of chosen) {
      used.add(n.path);
      const line = `- **${n.title}** — ${n.summary || '（无摘要）'} · \`${n.path}\` · ${fmtDate(n.updated)}`;
      if (totalChars() + line.length > DIGEST_CHARS) break;
      addLine(line);
    }
    addLine('');
  };

  addSection('入口 / 总览', entryNotes, 2);
  addSection('关于我 / 偏好', profileNotes, 5);
  addSection('目标 / 优先级', goalNotes, 5);
  addSection('当前项目', projectNotes, 8);

  // recent notes not yet included
  const recent = hot.filter((n) => n.recent && !used.has(n.path)).slice(0, 8);
  if (recent.length > 0) {
    addLine('## 最近更新');
    for (const n of recent) {
      const line = `- ${fmtDate(n.updated)} · **${n.title}** — ${n.summary || ''} · \`${n.path}\``;
      if (totalChars() + line.length > DIGEST_CHARS) break;
      addLine(line);
    }
    addLine('');
  }

  addLine(`> 需要更多信息时，先查索引（memory-search.mjs），再读原文片段；冷归档（${cold.length} 篇）默认不参与。`);
  const digest = `${digestLines.join('\n')}\n`;

  // ---------- Level 1: index ----------
  const indexData = {
    generated: generated.toISOString(),
    vault: path.basename(VAULT),
    digest: 'MEMORY_DIGEST.md',
    count: notes.length,
    coldCount: cold.length,
    notes: notes.map((n) => ({
      title: n.title,
      path: n.path,
      tags: n.tags,
      summary: n.summary,
      updated: fmtDate(n.updated),
      cold: n.cold,
      size: n.size,
    })),
  };

  const indexLines = ['# Memory Index', '', `<!-- 自动生成于 ${fmtDate(generated)}；${notes.length} 篇（冷 ${cold.length}）；用 memory-search.mjs 检索 -->`, ''];
  for (const n of notes) {
    const coldMark = n.cold ? ' · cold' : '';
    indexLines.push(`- ${fmtDate(n.updated)} · **${n.title}** — ${n.summary || '（无摘要）'} · \`${n.path}\`${coldMark}`);
  }
  const indexMd = `${indexLines.join('\n')}\n`;

  fs.writeFileSync(path.join(OUT, 'MEMORY_DIGEST.md'), digest, 'utf8');
  fs.writeFileSync(path.join(OUT, 'MEMORY_INDEX.md'), indexMd, 'utf8');
  fs.writeFileSync(path.join(OUT, 'index.json'), `${JSON.stringify(indexData, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(OUT, 'README.md'),
    '# .memory\n\n自动生成的分级记忆索引，供 AI 读取；不要手改。\n\n- `MEMORY_DIGEST.md`：第 0 级小抄（每轮先读）\n- `MEMORY_INDEX.md`：第 1 级可读索引\n- `index.json`：第 1 级机器索引（memory-search.mjs 使用）\n\n重新生成：\n\n```bash\nnode scripts/memory-build.mjs --vault "<vault>"\n```\n',
    'utf8',
  );

  console.log(`memory-build: ${notes.length} notes (${cold.length} cold)`);
  console.log(`memory-build: digest ${Buffer.byteLength(digest)} bytes (${digest.split('\n').length} lines)`);
  console.log(`memory-build: index  ${Buffer.byteLength(indexMd)} bytes; index.json ${Buffer.byteLength(JSON.stringify(indexData))} bytes`);
  console.log(`memory-build: output ${OUT}`);
}

build();
