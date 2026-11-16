# 🧠 obsidian-memory

<a id="chinese"></a>

**简体中文** | [English](#english)

> 让 AI 助手在开口之前，先翻一遍你的 Obsidian。

一个给 **DeepSeek Harness（DSH）** 用的「记忆优先」Skill：纯 Markdown，零依赖，不联网。

> 🌍 想用在 Claude Code / ChatGPT / Codex / Cursor / GitHub Copilot / Gemini CLI？用通用版：[obsidian-memory-anywhere](https://github.com/ImportMyBrain/obsidian-memory-anywhere)。

---

## 为什么需要它

和 AI 聊得越久，越容易遇到这三个问题：

- 上个月聊过的项目细节，今天它完全不记得；
- 你明明在 Obsidian 里记了目标、偏好、项目进度，它却像第一次见你；
- 每次都要重新贴背景，贴完还是模板化回答。

`obsidian-memory` 把「先查记忆，再回答」变成固定流程：**每次回答前，先分级检索你的本地 Obsidian 库，把相关记忆找出来、判断新旧、整合进答案，然后才开口。**

## 🆕 v2.0：分级检索（省 token）

不再全库 grep + 整篇读，改成 4 级：

| 级别 | 读什么 | 目标大小 |
| --- | --- | --- |
| **0 小抄** | `.memory/MEMORY_DIGEST.md`：偏好 / 目标 / 当前项目 / 最近更新 | ~2–3 KB |
| **1 索引** | `memory-search.mjs` 返回 top 3–5 条摘要 | ≤2 KB |
| **2 片段** | 候选笔记前 60–80 行 / 关键词附近 ±20 行 | ≤1.5 KB/篇 |
| **3 原文** | 仅必要时，最多 1–2 篇 | ≤8 KB/篇 |

- 实测：搜“项目”从全库 grep 约 17 KB 输出降到 **0.5–0.8 KB**；每轮记忆读取约 **5–8 KB**，笔记再多也基本恒定。
- 冷归档（历史对话记录等）默认不参与，问“之前聊过”才查。
- skill 每会话只加载一次；同一话题追问复用结果。

## ✨ 它做了什么

| 步骤 | 说明 |
| --- | --- |
| 0. 先看小抄 | `.memory/MEMORY_DIGEST.md`（~2–3 KB） |
| 1. 查索引 | `memory-search.mjs` 返回 top 3–5 条摘要，不全库 grep |
| 2. 读片段 | 候选笔记前 60–80 行 / 关键词附近 ±20 行 |
| 3. 读原文 | 仅必要时，最多 1–2 篇 |
| 判断记忆 | 直接相关 / 背景相关 / 历史快照（冷）/ 无关；冲突时以较新的笔记为准 |
| 整合回答 | 记忆影响结论、优先级、语气和例子；引用来源与日期，区分事实和推断 |
| 必要时写回 | 只有出现新事实才更新主笔记并加 `[[双链]]`，没新信息不动库 |
| 查不到时 | 一句话说明「没查到相关记录」，然后正常回答；绝不编造记忆 |

## 📦 安装

### 方式一：直接复制（最快）

把仓库里的 `obsidian-memory/` 文件夹放进 DSH 用户技能库：

```powershell
# Windows
Copy-Item -Recurse obsidian-memory "$env:USERPROFILE\.dsh\skills\"
```

```bash
# macOS / Linux
cp -r obsidian-memory ~/.dsh/skills/
```

或者运行安装脚本：

```powershell
.\install.ps1
```

### 方式二：下载 zip

从 [Releases](https://github.com/ImportMyBrain/obsidian-memory-skill/releases) 下载 `obsidian-memory-skill.zip`，解压后把 `obsidian-memory/` 放进 `~/.dsh/skills/`。

### 验证

新开 / 恢复一个会话后，技能目录里应出现 `obsidian-memory`；让 agent 用 `skill` 工具加载一次，能看到完整流程即可。

## ⚙️ 配置（必做，1 分钟）

打开 `obsidian-memory/SKILL.md`，改第 0 节：

```markdown
- `VAULT`：`D:\Obsidian\MyVault`      # 你的 Obsidian 库根目录
- `MEMORY_DIR`：`<VAULT>/.memory`     # 小抄 / 索引目录（默认）
- `ARCHIVE_DIRS`：`Chats`             # 冷数据目录（可选，可多个）
- `FALLBACK_MEMORY`：`MEMORY.md`      # 工作区记忆摘要（可选）
```

只保留你需要的，其余删掉。首次安装 / 库有大改动后，生成小抄和索引：

```bash
node obsidian-memory/scripts/memory-build.mjs --vault "D:\Obsidian\MyVault" --archive "Chats"
```

## 🔁 让它每轮自动生效（推荐）

DSH 的 skill 默认按需加载。想让它**每次回答前都自动跑**，在工作区根目录的 `AGENTS.md` 里加：

```markdown
## Obsidian 记忆优先（每轮强制 · 分级检索 v2）
会话只加载一次 `obsidian-memory` skill。每轮回答前：先读小抄（MEMORY_DIGEST.md）；不够再跑 memory-search 查索引；仍不够读原文片段；最后才读整篇（最多 1–2 篇）。冷归档默认不参与。
```

完整示例见 [`examples/AGENTS.example.md`](examples/AGENTS.example.md)。

> 注意：全局指令（如 `~/.dsh/AGENTS.md`）会影响这台机器上的所有会话；如果还有群聊机器人 / 其他 agent，建议只用工作区级 `AGENTS.md`。

## 🗂️ 目录结构

```
obsidian-memory/
├── SKILL.md              # skill 本体（分级检索流程）
└── scripts/
    ├── memory-build.mjs  # 生成小抄 + 索引
    └── memory-search.mjs # 检索索引（top-k 摘要）
examples/
└── AGENTS.example.md     # 每轮自动加载的指令示例
install.ps1               # Windows 安装脚本
README.md                 # 中英双语说明（中文在前，English 在后）
LICENSE                   # MIT
```

## 🔒 隐私

- 纯本地：只读你的 Markdown，不发网络请求，不上传任何内容。
- 不读 `.obsidian/`、系统目录和附件二进制；不把隐私内容带进群聊或第三方会话。
- 本仓库的示例全部是通用文本，不含任何真实笔记内容或路径。

## 🤝 兼容性

为 **DeepSeek Harness** 的 skill 机制编写（YAML frontmatter + Markdown 正文）。其他支持 `SKILL.md` 的 agent 框架也可以手动加载，具体以其文档为准。

## 📄 License

[MIT](LICENSE)

## 🧾 版本

| 版本 | 日期 | 变化 |
| --- | --- | --- |
| **v2.0.0** | 2026-11-16 | 分级检索（小抄 → 索引 → 片段 → 原文）；新增 `memory-build` / `memory-search` 脚本；冷归档默认排除；skill 每会话只加载一次 |
| v1.0.0 | 2026-11-13 | 首个公开版本 |

---

如果这个 skill 帮你省下了每次重新解释自己的时间，欢迎点个 ⭐。

---

<a id="english"></a>

# 🌐 English

[简体中文](#chinese) | **English**

> Let your AI assistant look through your Obsidian vault before it answers.

A recall-first skill for **DeepSeek Harness (DSH)**. Plain Markdown, no dependencies, no network access.

> 🌍 Need it in Claude Code, ChatGPT/Codex, Cursor, GitHub Copilot or Gemini CLI? Use the portable Agent Skills version: [obsidian-memory-anywhere](https://github.com/ImportMyBrain/obsidian-memory-anywhere).

## Why

Chats drift. The assistant forgets last month's project details, even though you wrote everything down in Obsidian. You end up re-explaining your context in every conversation — and still get generic answers.

`obsidian-memory` makes "recall first, answer second" a fixed workflow: **before every answer, recall in tiers — digest → index → excerpt → full note — and weave it into the answer.**

### New in v2.0 — tiered recall

| Level | What to read | Target size |
| --- | --- | --- |
| **0 digest** | `.memory/MEMORY_DIGEST.md` | ~2–3 KB |
| **1 index** | `memory-search.mjs` top 3–5 rows | ≤2 KB |
| **2 excerpt** | first 60–80 lines / ±20 lines around a keyword | ≤1.5 KB/note |
| **3 full note** | only when necessary, max 1–2 notes | ≤8 KB/note |

Measured: a "project" search drops from ~17 KB of raw grep output to 0.5–0.8 KB; per-turn recall ~5–8 KB and roughly constant as the vault grows. Cold archives are excluded by default; load the skill once per session.

## What it does

| Step | Detail |
| --- | --- |
| 0. Digest first | `.memory/MEMORY_DIGEST.md` (~2–3 KB) |
| 1. Search index | `memory-search.mjs` top 3–5 summaries, no full-vault grep |
| 2. Read excerpt | first 60–80 lines / ±20 lines around a keyword |
| 3. Read full note | only when necessary, max 1–2 notes |
| Judge memories | Direct / background / historical snapshot (cold) / irrelevant; newer notes win conflicts |
| Integrate | Memory shapes conclusions, priorities, tone and examples; cite source and date |
| Write back | Only when there is genuinely new information; add `[[links]]`; never churn the vault |
| No match | Say "no relevant notes found" and answer normally; never fabricate memories |

## Install

```powershell
# Windows
Copy-Item -Recurse obsidian-memory "$env:USERPROFILE\.dsh\skills\"
```

```bash
# macOS / Linux
cp -r obsidian-memory ~/.dsh/skills/
```

Or run `.\install.ps1` (Windows), or download `obsidian-memory-skill.zip` from [Releases](https://github.com/ImportMyBrain/obsidian-memory-skill/releases).

## Configure

Edit section 0 of `obsidian-memory/SKILL.md`:

```markdown
- `VAULT`: `D:\Obsidian\MyVault`      # your vault root
- `MEMORY_DIR`: `<VAULT>/.memory`     # generated digest / index (default)
- `ARCHIVE_DIRS`: `Chats`             # cold folders (optional)
- `FALLBACK_MEMORY`: `MEMORY.md`      # workspace memory summary (optional)
```

Build the digest and index once after installing or after major vault changes:

```bash
node obsidian-memory/scripts/memory-build.mjs --vault "D:\Obsidian\MyVault" --archive "Chats"
```

## Make it automatic

DSH loads skills on demand. To run it before **every** answer, add this to your workspace `AGENTS.md`:

```markdown
## Obsidian recall first (every turn · tiered v2)
Load the `obsidian-memory` skill once per session. Before every answer: read the digest (MEMORY_DIGEST.md); if not enough, search the index with memory-search; if needed, read an excerpt; only then a full note (max 1–2). Cold archives are excluded by default.
```

See [`examples/AGENTS.example.md`](examples/AGENTS.example.md). Prefer workspace-level instructions over user-global ones if the same machine also runs group-chat bots or other agents.

## Privacy

- Local only: reads Markdown, makes no network calls, uploads nothing.
- Skips `.obsidian/`, system folders and binary attachments; keeps private notes out of group chats and third-party sessions.
- Every example in this repository is generic — no real note content or personal paths.

## Compatibility

Built for the **DeepSeek Harness** skill format (YAML frontmatter + Markdown body). Other agent frameworks that support `SKILL.md` can load it manually.

## Version

| Version | Date | Change |
| --- | --- | --- |
| **v2.0.0** | 2026-11-16 | Tiered recall (digest → index → excerpt → full note); `memory-build` / `memory-search` scripts; cold archives excluded by default; load once per session |
| v1.0.0 | 2026-11-13 | First public release |

## License

[MIT](LICENSE)
