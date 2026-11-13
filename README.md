# 🧠 obsidian-memory

**简体中文** | [English](README.en.md)

> 让 AI 助手在开口之前，先翻一遍你的 Obsidian。

一个给 **DeepSeek Harness（DSH）** 用的「记忆优先」Skill：纯 Markdown，零依赖，不联网。

---

## 为什么需要它

和 AI 聊得越久，越容易遇到这三个问题：

- 上个月聊过的项目细节，今天它完全不记得；
- 你明明在 Obsidian 里记了目标、偏好、项目进度，它却像第一次见你；
- 每次都要重新贴背景，贴完还是模板化回答。

`obsidian-memory` 把「先查记忆，再回答」变成固定流程：**每次回答前，先检索你的本地 Obsidian 库，把相关笔记找出来、判断新旧、整合进答案，然后才开口。**

## ✨ 它做了什么

| 步骤 | 说明 |
| --- | --- |
| 1. 抽关键词 | 从问题里识别项目、课程、人物、目标、时间、专有名词，做同义扩展 |
| 2. 检索库 | 用 agent 自带工具 `grep` → `glob` → `read`，只读本地 `.md` |
| 3. 判断记忆 | 直接相关 / 背景相关 / 历史快照 / 无关；冲突时以较新的笔记为准 |
| 4. 整合回答 | 记忆影响结论、优先级、语气和例子；引用来源与日期，区分事实和推断 |
| 5. 必要时写回 | 只有出现新事实才更新主笔记并加 `[[双链]]`，没新信息不动库 |
| 6. 查不到时 | 一句话说明「没查到相关记录」，然后正常回答；绝不编造记忆 |

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
- `PROFILE_DIR`：`Profile`            # 个人档案目录（相对 VAULT，可选）
- `ARCHIVE_DIR`：`Chats`              # 历史对话归档（可选）
- `FALLBACK_MEMORY`：`MEMORY.md`      # 工作区记忆摘要（可选）
```

只保留你需要的，其余删掉。`PROFILE_DIR` 里建议放一份「关于我 / 我的偏好」的笔记，检索时先读它，回答会更贴合你。

## 🔁 让它每轮自动生效（推荐）

DSH 的 skill 默认按需加载。想让它**每次回答前都自动跑**，在工作区根目录的 `AGENTS.md` 里加：

```markdown
## Obsidian 记忆优先（每轮强制）
回答任何消息之前，先加载 `obsidian-memory` skill，按其流程检索 Obsidian 库里的相关记忆，整合后再回答。新对话、追问、简单问题、短消息都要做；不查完不要直接回答。
```

完整示例见 [`examples/AGENTS.example.md`](examples/AGENTS.example.md)。

> 注意：全局指令（如 `~/.dsh/AGENTS.md`）会影响这台机器上的所有会话；如果还有群聊机器人 / 其他 agent，建议只用工作区级 `AGENTS.md`。

## 🗂️ 目录结构

```
obsidian-memory/
└── SKILL.md              # skill 本体（安装时复制整个文件夹）
examples/
└── AGENTS.example.md     # 每轮自动加载的指令示例
install.ps1               # Windows 安装脚本
README.md                 # 中文说明
README.en.md              # English readme
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

---

如果这个 skill 帮你省下了每次重新解释自己的时间，欢迎点个 ⭐。
