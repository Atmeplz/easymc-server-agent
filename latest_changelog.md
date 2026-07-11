# Latest Changelog

> Generated on 2026-07-11

## ingame_memory 功能模块

新增游戏内记忆系统，支持 AI Agent 持久化玩家偏好、坐标、秘密等信息，并区分公开/私有记忆等级。

### 新增文件

- **`server/agent/ingame-memory-store.js`**（358 行）：
  - 记忆存储基础设施，管理 `mc-server/ingame_memory/` 目录。
  - 按玩家 UUID 隔离目录，每个玩家拥有 `public.md`（公开可读）和 `private.md`（仅本人可读）。
  - 提供 `readPublic`、`readPrivate`、`writePublic`、`writePrivate`、`listPlayers` 方法。
  - 通过 `usercache.json` 做 playerName ↔ UUID 双向解析。
  - 文件使用 frontmatter + markdown 列表格式存储。
  - `archiveOldMemory()` 实现旧世界记忆归档到 `old_memory/<timestamp>/`，保留最近 5 次归档。
  - `isWorldReplaced()` 通过比较 `world/level.dat` 修改时间与 `meta.json` 创建时间检测世界替换。

- **`server/managers/plugin-auto-deployer.js`**（59 行）：
  - 内置插件自动部署器，从 `.easymc/plugins/` 复制 JAR 到 `mc-server/plugins/`。
  - 通过 `CoreDetector` 检测核心是否支持插件（Paper/Spigot/Purpur 支持，Forge/Fabric/Vanilla 不支持）。
  - 服务器启动时自动执行，JAR 替换时也会重新触发。

- **`agent-pm-command/`**（Java 插件项目）：
  - 极简 Spigot 插件，注册 `/agentpm <message>` 命令。
  - 玩家执行后在控制台输出 `[AgentPM] <playerName> <message>`，供 chat-monitor.js 识别为私密消息。
  - `api-version: 1.16`，兼容主流 Bukkit/Paper/Spigot 服务端。
  - 构建产物：`.easymc/plugins/agent-pm-command.jar`。

### Agent 工具集成

- **`server/agent/tools.js`**（614 行）：
  - 新增 `ingame_memory` 工具定义，支持 `read_public`、`read_private`、`write_public`、`write_private`、`list_players` 五种操作。
  - 执行器通过 `context.callerPlayerName` 识别调用者身份，实施隐私鉴权。
  - 每次调用实例化 `IngameMemoryStore` 并调用 `ensureStructure()`，确保目录结构完整。

### 消息路由与回复路径

- **`server/agent/chat-monitor.js`**（275 行）：
  - 新增 `pmRegex`：匹配 `[AgentPM] <playerName> <message>` 格式，识别 `/agentpm` 命令触发的私密消息。
  - `handleAgentRequest` 新增 `isWhisper` 参数，传递给 `agent-core.js`。
  - 回复路由：whisper 请求走 `tell ${playerName}`（私聊），公开请求走 `say`（广播）。
  - 事件发射中增加 `isWhisper` 字段，供 Web UI 感知。

### AI 核心调整

- **`server/agent/agent-core.js`**（405 行）：
  - `getContext()` 新增 `callerPlayerName` 和 `isWhisper` 参数，注入工具执行上下文。
  - `handlePlayerRequest()` 新增 `isWhisper` 参数，传递给 prompt 和 context。
  - 回复长度限制：whisper 模式使用 `whisperMaxResponseLength`（默认 128 字），公开模式仍为 `maxResponseLength`（默认 30 字）。

### Prompt 更新

- **`server/agent/prompts.js`**（135 行）：
  - 玩家 prompt 新增游戏内记忆规则：公开/私有记忆区别、隐私保护要求、默认写入 private.md 的判断逻辑。
  - 新增 `{whisperHint}` 占位符，根据 `isWhisper` 动态替换为"私密消息模式"或"公共频道"提示。
  - 新增私密消息规则说明：whisper 回复走 `/tell`，公开回复走 `/say`。
  - 拒绝列表新增"读取或泄露其他玩家的 private.md"。

### 服务器管理器

- **`server/managers/server-manager.js`**（294 行）：
  - 构造函数新增 `pluginAutoDeployer` 参数（第 4 个参数）。
  - 启动流程中新增：插件自动部署（`pluginAutoDeployer.deployIfSupported()`）和世界替换检测（`archiveMemoryIfWorldReplaced()`）。
  - `archiveMemoryIfWorldReplaced()` 自动创建 `IngameMemoryStore` 并调用 `isWorldReplaced()` / `archiveOldMemory()`。

### REST API

- **`server/routes/api.js`**（350 行）：
  - 新增 `POST /server/archive-memory`：手动触发游戏内记忆归档。
  - `POST /server/core/jar` 替换 JAR 后自动触发内置插件重新部署。

### 服务入口

- **`server/index.js`**（665 行）：
  - 实例化 `PluginAutoDeployer` 和 `CoreDetector`，注入 `ServerManager` 和 API 路由。

### 配置

- **`server/config.js`**：
  - 新增 `agent.whisperMaxResponseLength: 128`（whisper 模式回复最大长度）。
  - 新增 `agent.ingameMemoryDir: './mc-server/ingame_memory'`（记忆目录路径）。
  - 新增 `agent.privateMessageCommand: '/agentpm'`（私密消息命令标识）。

### 降级与异常处理

| 场景 | 行为 |
|------|------|
| 服务器不支持插件（Forge/Fabric/Vanilla） | PluginAutoDeployer 跳过部署，private.md 和 /agentpm 不可用 |
| usercache.json 查不到 UUID | IngameMemoryStore 返回错误，不创建目录 |
| ingame_memory 目录被删除 | 下次工具调用时 `ensureStructure()` 自动重建 |
| 世界文件被替换 | 启动时自动归档旧记忆到 `old_memory/<timestamp>/` |
| 归档超过 5 次 | 自动清理最旧的归档 |

### 未修改的文件

本次变更**未修改任何前端文件**，保持现有界面完全一致。
