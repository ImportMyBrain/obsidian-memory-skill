# 🧠 obsidian-memory

[简体中文](README.md) | **English**

> Let your AI assistant look through your Obsidian vault before it answers.

A recall-first skill for **DeepSeek Harness (DSH)**. Plain Markdown, no dependencies, no network access.

---

## Why

Chats drift. The assistant forgets last month's project details, even though you wrote everything down in Obsidian. You end up re-explaining your context in every conversation — and still get generic answers.

`obsidian-memory` makes "recall first, answer second" a fixed workflow: **before every answer, search the local vault, judge what's relevant and current, weave it into the answer.**

## What it does

| Step | Detail |
| --- | --- |
| 1. Extract keywords | Pull topics, projects, people, goals and dates from the message, then expand synonyms |
| 2. Search the vault | Use the agent's `grep` → `glob` → `read` tools; only local `.md` files |
| 3. Judge memories | Directly relevant / background / historical snapshot / irrelevant; newer notes win conflicts |
| 4. Integrate | Let memory shape conclusions, priorities, tone and examples; cite source and date |
| 5. Write back | Only when there is genuinely new information; add `[[links]]`; never churn the vault |
| 6. No match | Say "no relevant notes found" and answer normally; never fabricate memories |

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
- `PROFILE_DIR`: `Profile`            # personal profile folder (optional)
- `ARCHIVE_DIR`: `Chats`              # archived conversations (optional)
- `FALLBACK_MEMORY`: `MEMORY.md`      # workspace memory summary (optional)
```

## Make it automatic

DSH loads skills on demand. To run it before **every** answer, add this to your workspace `AGENTS.md`:

```markdown
## Obsidian recall first (every turn)
Before answering any message, load the `obsidian-memory` skill and search the local Obsidian vault for relevant memories, then integrate them into the answer. Do this for new chats, follow-ups, simple questions and short messages too.
```

See [`examples/AGENTS.example.md`](examples/AGENTS.example.md). Prefer workspace-level instructions over user-global ones if the same machine also runs group-chat bots or other agents.

## Privacy

- Local only: reads Markdown, makes no network calls, uploads nothing.
- Skips `.obsidian/`, system folders and binary attachments; keeps private notes out of group chats and third-party sessions.
- Every example in this repository is generic — no real note content or personal paths.

## Compatibility

Built for the **DeepSeek Harness** skill format (YAML frontmatter + Markdown body). Other agent frameworks that support `SKILL.md` can load it manually.

## License

[MIT](LICENSE)
