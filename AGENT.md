# AGENT.md — 项目状态报告

> **最后更新**: 2026-07-03
> **阅读本文件前，请先阅读 [README.md](README.md) 了解项目全貌。**

---

## 一、项目概述

EasyMC Server Agent 是一个 **Node.js 本地 Minecraft 服务器管理工具**，提供：

- 一键启动 MC 服务器（含 Java 环境自动检测/下载）
- Web UI 左右分栏：AI 对话 + 终端日志
- AI Agent 通过 tool-calling 管理服务器（执行命令、修改配置、管理插件/Mod）
- 游戏内 `@agent` 触发词监听，玩家可直接与 AI 交互
- 服务器核心自动部署（Vanilla / Paper / Purpur / Fabric / Forge）

---

## 二、架构总览

```
浏览器 (React + Vite + Tailwind + xterm.js)
    ↕ Socket.IO
Node.js 后端 (Express)
    ├── server/index.js          — 入口，Socket.IO 事件路由
    ├── server/agent/            — AI Agent 核心
    │   ├── agent-core.js        — OpenAI tool-calling 循环
    │   ├── tools.js             — 10 个工具定义 + 执行器
    │   ├── prompts.js           — 系统 Prompt（管理员/玩家）
    │   └── chat-monitor.js      — 游戏内 @agent 监听
    ├── server/managers/         — 功能管理器
    ├── server/permissions/      — 权限系统（ops.json）
    ├── server/security/         — FileGuard 路径安全校验
    ├── server/sources/          — 下载源检测与解析
    └── server/routes/           — REST API
```

---

## 三、开发进度

### Phase 1–4：全部完成 ✅

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 骨架 + Java 环境管理 | ✅ |
| Phase 2 | AI Agent 集成（tool-calling） | ✅ |
| Phase 3 | @agent 游戏内监听 + 权限系统 | ✅ |
| Phase 4 | 服务器部署 + 插件/Mod 管理 | ✅ |

### Phase 5：体验优化 — 未开始（暂不推进）

Markdown 渲染、主题切换、通知系统、移动端适配、交互历史查看器等均未实现。

---

## 四、已完成的 Bug 修复与功能补充

### 4.1 已修复的 Bug

| # | 问题 | 修复方式 | 涉及文件 |
|---|------|----------|----------|
| 1 | ChatMonitor 不广播回复 | `handleAgentRequest()` 改用 `serverManager.sendCommand('say [Agent]: ...')` 真正发送到 MC 服务器 | `chat-monitor.js`, `index.js` |
| 2 | 高危命令无确认流程 | 管理员对话中通过 Socket.IO 弹出确认卡片（60 秒超时）；@agent 请求中直接 `/say` 拒绝并广播 | `tools.js`, `agent-core.js`, `index.js`, `useChat.js`, `ChatPanel.jsx` |
| 3 | LLM API 无重试 | `_callWithRetry()` 3 次重试 + 指数退避（1s/2s/4s），对 429/5xx/超时等可重试错误生效 | `agent-core.js` |

### 4.2 新增工具

| 工具名 | 功能 | 文件 |
|--------|------|------|
| `server_properties` | 合并读取/修改 server.properties，支持全量读取、单项查询、单项修改（带 FileGuard 校验） | `tools.js` |
| `backup_world` | 递归复制世界存档到 `mc-server/backups/`，返回大小统计 | `tools.js` |

### 4.3 结构优化

| 变更 | 说明 |
|------|------|
| 移除 `agent-workspace/` | Agent 以整个项目目录为操作区，备份改存 `mc-server/backups/`，配置中 `agentWorkspace` 段已删除 |
| `.gitignore` 清理 | 移除 `agent-workspace/output/` 条目 |

---

## 五、当前工具清单（10 个）

| # | 工具名 | 用途 | 权限 |
|---|--------|------|------|
| 1 | `execute_mc_command` | 执行 MC 命令（含高危确认拦截） | 管理员 / 玩家（受限） |
| 2 | `get_server_status` | 获取服务器运行状态 | 管理员 / 玩家 |
| 3 | `list_players` | 列出在线玩家 | 管理员 / 玩家 |
| 4 | `read_server_log` | 读取终端最近 N 行日志 | 管理员 / 玩家 |
| 5 | `read_file` | 读取项目文件（FileGuard 校验） | 仅管理员 |
| 6 | `write_file` | 写入项目文件（FileGuard 校验） | 仅管理员 |
| 7 | `list_files` | 列出目录内容 | 仅管理员 |
| 8 | `broadcast_reply` | `/say [Agent]` 广播到游戏 | 管理员 / 玩家 |
| 9 | `server_properties` | 读取/修改 server.properties | 仅管理员 |
| 10 | `backup_world` | 备份世界存档 | 仅管理员 |

---

## 六、安全机制

- **FileGuard**：路径遍历防护 + 符号链接逃逸检测 + 敏感目录/文件黑名单
- **权限系统**：基于 ops.json 的 OP 等级（0–4），PLAYER_BLACKLIST 绝对禁止列表
- **高危命令拦截**：`stop`, `op`, `deop`, `ban`, `pardon`, `whitelist`, `reload` 等需管理员确认
- **API Key 隐藏**：REST API 返回配置时自动掩码

---

## 七、仍需处理的问题（不含 Phase 5）

### 高优先级

| # | 问题 | 说明 |
|---|------|------|
| 1 | MC 服务器崩溃检测 | 进程异常退出时未通知前端，管理员可能长时间不知情 |
| 2 | 下载镜像自动降级 | 主源下载失败时不会自动切换备选镜像 |

### 中优先级

| # | 问题 | 说明 |
|---|------|------|
| 3 | `checkDependencies()` | ModManager 缺少 Mod 依赖检查方法，安装 Mod 时可能缺前置 |
| 4 | 端口冲突检测 | 启动时未检查 3000 端口是否被占用 |
| 5 | `agent:approve_player` 事件 | 管理员审批玩家 @agent 请求的 Socket 事件未实现（当前高危命令直接拒绝） |
| 6 | `upload_file` 路径 | 上传文件写入项目根目录，应写入 `mc-server/` 下 |

### 低优先级

| # | 问题 | 说明 |
|---|------|------|
| 7 | 持久化审计日志 | @agent 交互仅 console.log，无文件记录 |
| 8 | `gamerule` 命令粒度 | 当前整个 gamerule 归为高危，但 `doDaylightCycle true` 这类无害操作也受影响 |
| 9 | 确认流程对话连续性 | 管理员确认后 AI 重新发起工具调用，对话历史中会多一轮"已拒绝"的记录 |

---

## 八、配置文件

- **`server/config.js`** — 默认配置（所有字段的默认值）
- **`config.local.json`** — 用户本地覆盖（gitignore），deepMerge 合并
- 配置结构：`port`, `mc`, `ai`, `terminal`, `agent`, `deploy`, `java`

---

## 九、Socket.IO 事件清单

### Client → Server

| 事件 | 说明 |
|------|------|
| `chat:message` | 管理员发送 AI 对话消息 |
| `terminal:input` | 终端命令输入 |
| `server:start / stop / restart` | 服务器控制 |
| `java:check / download / set_path` | Java 环境管理 |
| `deploy:get_types / get_versions / start / status` | 服务器部署 |
| `plugin:list / install / toggle / remove` | 插件管理 |
| `mod:list / install / toggle / remove` | Mod 管理 |
| `agent:upload_file` | 文件上传 |
| `agent:confirm_response` | 高危命令确认响应 |
| `app:shutdown` | 关闭整个应用 |

### Server → Client

| 事件 | 说明 |
|------|------|
| `chat:reply` | AI 回复 |
| `chat:tool_call` | 工具调用通知 |
| `terminal:output / history` | 终端输出 |
| `server:status` | 服务器状态变更 |
| `java:status / download_progress / ready` | Java 状态 |
| `deploy:step / progress / complete / error` | 部署进度 |
| `plugin:list / mod:list` | 插件/Mod 列表 |
| `agent:player_activity / player_result` | @agent 活动 |
| `agent:confirm_request / confirm_timeout` | 高危确认请求/超时 |
