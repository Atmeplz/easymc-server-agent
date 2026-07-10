# EasyMC Server Agent — 项目维护指南

> 本文档面向项目的二次开发与长期维护，逐文件给出架构定位、已知风险与改进建议。
> 生成时间：2026-07-09｜上次维护更新：2026-07-10

---

## 目录

- [项目总览](#项目总览)
- [启动与入口层](#启动与入口层)
- [后端：Express + Socket.IO 服务](#后端express--socketio-服务)
- [后端：Agent 模块（AI 核心）](#后端agent-模块ai-核心)
- [后端：Manager 层（业务管理器）](#后端manager-层业务管理器)
- [后端：Security 与 Permissions](#后端security-与-permissions)
- [后端：Sources 层（下载源解析）](#后端sources-层下载源解析)
- [后端：Download 层（下载服务与适配器）](#后端download-层下载服务与适配器)
- [后端：REST API 路由](#后端rest-api-路由)
- [前端：React SPA](#前端react-spa)
- [配置文件](#配置文件)
- [跨文件架构注意事项](#跨文件架构注意事项)

---

## 项目总览

EasyMC Server Agent 是一个本地运行的 Minecraft 服务器管理工具，集成 AI Agent 能力。技术栈：

| 层 | 技术 |
|---|---|
| 后端 | Node.js 18+, Express 4, Socket.IO 4 |
| 前端 | React 18, Vite, Tailwind CSS, lucide-react |
| AI | OpenAI SDK（兼容 DeepSeek 等接口） |
| 进程管理 | child_process spawn |
| 文件安全 | 自研 FileGuard 路径校验 |
| 权限 | 基于 ops.json 的 OP 等级系统 |

项目仅绑定 `127.0.0.1`，不对外暴露，是一个纯本地管理工具。

---

## 启动与入口层

### `start.js`（233 行）

**职责**：项目总入口，负责依赖检查、前端构建、配置初始化、Java 检测、启动 Express 服务并打开浏览器。

**维护建议**：
- `newestMtimeMs()` 递归比较 `src` 和 `dist` 的修改时间来判断是否需要重新 build，但如果 `dist/index.html` 被手动删除而 `src` 未改动，`ensureClientBuild()` 会因 `distTime >= sourceNewest` 判断跳过构建。需在条件中加 `!fs.existsSync(distIndex)` 的独立检查——目前代码逻辑是 `distTime >= sourceNewest && fs.existsSync(distIndex)`，已覆盖，但 `distTime` 在文件不存在时返回 0，逻辑是正确的。此处无问题，但建议加注释说明。
- `ensureDependencies()` 只检查 `node_modules` 是否存在，不验证依赖完整性。如果 `npm install` 中途中断，可能存在但不完整。建议加 `npm ci` 或 `npm verify` 作为可选校验。

### `start.bat` / `start.sh`

**职责**：平台启动脚本。

**维护建议**：
- `start.bat` 应检查 Node.js 是否安装，给出友好提示而非直接报错。
- `start.sh` 需确认在无 `xdg-open` 的环境下不会崩溃——当前已有 try/catch，可以。

---

## 后端：Express + Socket.IO 服务

### `server/index.js`（630 行）

**职责**：Express + Socket.IO 主入口，实例化所有 Manager，注册 Socket.IO 事件处理器，管理端口绑定。

**维护建议**：
- **Socket.IO 事件量巨大**：单文件内注册了 30+ 个 `socket.on()` 事件。随着功能增长，建议将 Socket 事件拆分到独立模块（如 `socket-handlers/chat.js`、`socket-handlers/deploy.js`），按功能域组织。当前结构在维护时容易遗漏事件清理。
- **`activeChatRun` 闭包陷阱**：`chat:message` 处理器内部通过闭包捕获 `activeChatRun`，在 `onConfirm` 回调中通过 `activeChatRun === chatRun` 做身份检查。这套模式可工作但脆弱——如果未来支持多 Socket 并发聊天，`activeChatRun` 是 per-socket 变量，需要改为 per-session 跟踪。
- **`deepMerge` 不处理数组**：`config.local.json` 中的数组（如 `jvmArgs`、`blockedCommands`）会被整体替换而非合并。这是当前设计意图（用户覆盖默认值），但需在文档中明确说明。
- **端口查找逻辑**：`findAvailablePort` 尝试 10 个端口，但只在启动时查找一次。如果运行中端口被占用（不太可能因为是本地），没有恢复机制。当前场景可接受。
- **`app.get('*')` 通配路由**：将所有非 `/api` 请求交给前端 SPA。需确保新增加的静态资源路径（如字体）在 `express.static` 之前注册。当前顺序正确。

### `server/config.js`（78 行）

**职责**：默认配置定义，用户通过 `config.local.json` 覆盖。

**维护建议**：
- **`java.versionMap` 格式脆弱**：使用字符串范围如 `'1.20.5-1.21.11'` 作为 key，但 `JavaManager` 中的 `MC_JAVA_MAP` 使用函数式 `test` 做版本比较。两处定义可能不同步。建议统一为一处定义。
- **`agent.blockedCommands`** 与 `rules.js` 的 `PLAYER_BLACKLIST` 重复定义，且内容不完全一致。`config.js` 的列表包含 `'whitelist off'`（带参数），而 `rules.js` 的列表包含 `'save-off'`、`'defaultgamemode'` 等不在 config 中的条目。需统一到一处。
- **`download.curseForgeApiKey`** 依赖环境变量，但项目没有 `.env` 加载机制。如果用户不设置环境变量，CurseForge 永远不可用。建议在 `start.js` 中加 `dotenv` 支持或在 UI 提供输入。

---

## 后端：Agent 模块（AI 核心）

### `server/agent/agent-core.js`（402 行）

**职责**：AI Agent 核心，管理 OpenAI 客户端、chat 循环（工具调用循环）、玩家请求处理、重试逻辑。

**维护建议**：
- **双路径设计**：`chat()` 方法服务于 Web UI（admin 权限），`handlePlayerRequest()` 服务于游戏内 @agent 请求（受限权限）。两个方法的循环逻辑高度相似但各自独立，存在维护同步风险。建议提取共用的循环框架。
- **`conversationHistory` 内存泄漏**：`chat()` 方法在没有 `externalHistory` 时会往 `this.conversationHistory` 追加消息，但只在 `clearHistory()` / `reinit()` 时清空。如果用户长时间使用而不切换会话，数组会无限增长。当前代码主要走 `externalHistory` 路径（来自 ChatSessionManager），`conversationHistory` 分支是遗留代码，建议移除或标注为 deprecated。
- **工具调用循环上限**：`maxToolRounds` 默认 50，玩家请求固定 6 轮。建议将玩家请求的上限也改为配置化。
- **`_callWithRetry` 退避策略**：使用固定指数退避（1s, 2s, 4s），没有 jitter（随机抖动）。在高并发场景下可能导致重试风暴。当前为单用户本地工具，问题不大。
- **`handlePlayerRequest` 中 `onConfirmPlayer`** 永远返回 `false`——玩家无法通过游戏内确认高危操作。这是安全设计，但应在 prompts 中告知玩家"此操作需要在管理面板执行"。
- **错误处理粒度**：401 和 429 有专门处理，但其他 HTTP 状态码（如 403、500）统一走 generic 分支。建议增加 403（API key 权限不足）的提示。
- **`messages` 数组在循环中被 mutate**：`assistantMessage` 直接 push 到 messages，但 OpenAI SDK 返回的 message 对象可能包含不可序列化的属性。建议做一次浅拷贝再 push。

### `server/agent/chat-monitor.js`（252 行）

**职责**：监听 Minecraft 服务器终端输出，解析玩家聊天，检测 @agent 触发词，分发请求给 AgentCore，广播回复。

**维护建议**：
- **自定义 Event 系统**：使用自己的 `on()`/`emit()` 实现（`this.listeners` 数组），而不是 Node.js `EventEmitter`。这导致不支持 `once()`、`removeAllListeners()` 等标准方法。建议继承 `EventEmitter`。
- **ANSI 正则**：`ANSI_REGEX` 在 `chat-monitor.js` 和 `server-manager.js` 中各定义了一次。应提取到共用模块（如 `shared/ansi.js`）。
- **冷却消息硬编码中文**：`say ${this.replyPrefix}: 请稍候再试` 和 `正在处理中，请稍候` 直接写死中文。如果项目要国际化，需提取到配置。
- **`processingTimeoutMs` 安全超时**：超时后只删除 `processing` Map 中的 key，但不取消正在进行的 API 调用。如果 API 调用最终返回，`handleAgentRequest` 的 `finally` 块会再次尝试删除（已删除，无副作用）。但广播回复可能在不期望的时间到达。建议在超时时也 abort 请求。
- **`stripLogPrefix` 多次 replace**：对同一行做了 4 次正则替换。性能影响可忽略（终端输出频率不高），但可合并为单次正则。
- **`isAgentReply` 检查**：通过检查 stripped line 是否以 `replyPrefix:` 开头来防止自回复。如果玩家名为 `[Agent]`（极端情况），会误判。概率极低但值得注意。

### `server/agent/tools.js`（505 行）

**职责**：定义 6 个 AI 可调用工具（execute_mc_command、server_manager、file_manager、broadcast_reply、server_properties、backup_world）及执行逻辑。

**维护建议**：
- **工具定义与执行耦合**：`getToolDefinitions()` 返回 OpenAI function schema，`executeTool()` 用 switch-case 执行。新增工具需要改两处。建议用注册模式：每个工具一个对象 `{ name, schema, execute }`，自动生成定义列表。
- **`execute_mc_command` 输出轮询**：通过 100ms 轮询 TerminalManager 历史来捕获命令输出，最多等 2 秒。这种方式对即时反馈命令（如 `list`）有效，但对延迟输出的命令（如 `give` 后的日志）可能截断。建议改为事件驱动：注册一次性 listener 等待下一条匹配输出。
- **`file_manager` 的 `inspect_files`**：限制 12 个文件、每文件 12000 字节。这些限制应可配置。
- **`server_properties` 解析**：简单的 `key=value` 行解析，不处理多行值或注释行中的 `=`。Minecraft 的 `server.properties` 格式简单，当前实现可工作，但建议用 `js-yaml` 或专用 properties 解析器以更健壮。
- **`backup_world` 同步复制**：使用 `fs.cpSync` 递归复制世界目录。大世界可能阻塞事件循环。建议改为异步流式复制。
- **`backup_world` 的 `save-all` 等待**：固定等 2 秒，但 `save-all` 在大世界上可能需要更久。建议监听终端输出中的 "Saved the game" 消息。

### `server/agent/prompts.js`（116 行）

**职责**：定义 Admin 和 Player 的系统提示词，支持通过 `config.prompts` 自定义。

**维护建议**：
- **提示词硬编码在代码中**：`DEFAULT_ADMIN_PROMPT` 和 `DEFAULT_PLAYER_PROMPT` 直接写在 JS 文件中。建议提取到外部 JSON/YAML 文件，便于非开发者修改。
- **Player prompt 中的 `preferably` 混用中英文**：`preferably 10-20 字` 中英文混排，应统一为中文。
- **`getAdminPrompt` 返回 `config.prompts?.admin || DEFAULT_ADMIN_PROMPT`**：如果用户在 config 中设了空字符串 `""`，会 fallback 到默认值（因为 `""` 是 falsy）。这可能不是用户意图。建议用 `config.prompts?.admin !== undefined ? config.prompts.admin : DEFAULT_ADMIN_PROMPT`。
- **Player prompt 模板替换**：使用简单的 `.replace()` 做模板变量替换。如果 `playerName` 包含 `{permissionLevel}` 等字符串，会导致错误替换。概率极低但建议用更安全的模板引擎或分步替换。

---

## 后端：Manager 层（业务管理器）

### `server/managers/server-manager.js`（249 行）

**职责**：管理 Minecraft 服务器进程的启动、停止、重启、状态跟踪、stdin 通信。

**维护建议**：
- **`stop()` 的 Promise + 事件监听**：当前实现通过 `proc.on('exit', onExit)` 等待退出，避免了轮询。但 `proc.on('exit')` 在 `start()` 中已注册了一个 handler，此处再注册一个。Node.js 支持多 listener，可以工作，但调试时需注意。
- **`restart()` 固定等 2 秒**：等待端口释放。在大内存服务器上 stop 后端口释放可能更慢。建议改为轮询端口可用性。

### `server/managers/terminal-manager.js`（157 行）

**职责**：终端输出管理，使用环形缓冲区存储历史，支持文件日志和搜索。

**维护建议**：
- **环形缓冲区设计优秀**：O(1) 追加和淘汰，适合高频终端输出。实现正确。
- **`_toArray()` 每次调用都分配新数组**：在 `getHistory()` 频繁调用时（如每个新连接的 Socket 都会 `getHistory()`），可能有性能开销。可以考虑缓存 `_toArray` 的结果，在 `addOutput` 时失效缓存。
- **`searchHistory` 线性扫描**：对大缓冲区（5000 条）做线性扫描可接受。如果需要更快的搜索，可以考虑维护一个倒排索引，但对当前规模不值得。

### `server/managers/java-manager.js`（381 行）

**职责**：Java 运行时检测、下载（Adoptium API）、版本映射、系统扫描。

**维护建议**：
- **`MC_JAVA_MAP` 与 `config.java.versionMap` 重复**：两处定义了 Minecraft 版本到 Java 版本的映射，且格式不同（一处用函数 test，一处用字符串范围 key）。应统一为单一数据源。
- **`detectJava` 使用 `execSync`**：同步阻塞 Node.js 事件循环。在服务器启动时可以接受，但如果 UI 触发重新检测（`/api/java/status`），会短暂阻塞所有 Socket 事件。建议改为 `exec` 异步版本。
- **`scanForJavas` 文件系统遍历**：对每个候选路径调用 `checkJavaAt`，而 `checkJavaAt` 执行 `java -version`。如果有大量候选路径，会串行执行多次子进程，耗时较长。建议用 `Promise.all` 并行化。
- **`downloadJre` 下载后不验证 SHA**：只验证了 Java 可执行性（`checkJavaAt`），但没有校验下载包的哈希。Adoptium API 返回的包有签名，但下载过程中可能被篡改。建议至少做文件大小校验。
- **`downloadJre` 的解压**：Windows 用 `extract-zip`，Linux/macOS 用 `tar`。但 Adoptium 对 macOS 也可能返回 zip。建议根据 `Content-Type` 或文件头判断格式而非仅靠 OS。
- **`getBundledJavaPath` 假设固定目录结构**：`jre-{version}/bin/java`。但 Adoptium 的 zip 解压后可能有一层嵌套目录（如 `jdk-21+35/bin/java`）。需要验证实际解压结构。

### `server/managers/deploy-manager.js`（220 行）

**职责**：一键部署流程——Java 检查、核心下载、目录创建、EULA 写入、SHA1 校验。

**维护建议**：
- **`deploy()` 缺少原子性**：如果下载成功但目录创建失败，已下载的 jar 不会被清理。建议用 try-catch 在失败时回滚（删除已下载的 jar）。
- **`downloadCore` 的 SHA1 校验**：使用 `calculateSha1` 流式读取文件。实现正确。但 SHA256 校验只在 Paper 中有（来自 `paperScraper`），且 `deployManager` 只校验 SHA1。建议统一校验逻辑。
- **`setupDirectory` 创建固定目录列表**：`['plugins', 'mods', 'config', 'world', 'logs']`。但 Vanilla 服务器不需要 `plugins` 或 `mods` 目录。建议根据核心类型决定创建哪些目录。
- **`writeEula` 覆盖已有文件**：直接写 `eula=true\n`，不保留用户可能添加的注释。建议在文件已存在时不覆盖，或追加而非替换。
- **`deploy` 不更新 `config.local.json`**：修改了 `this.config.mc.version` 和 `this.config.mc.coreType`，但没有持久化到文件。重启后配置丢失。建议在部署完成后调用保存逻辑。
- **`isDeployed` 只检查 jar 存在**：不验证 jar 是否有效（可能是损坏的文件）。可以用 `CoreDetector` 做更深入的检查。

### `server/managers/plugin-manager.js`（137 行）

**职责**：Bukkit/Paper/Spigot 插件的安装、启用、禁用、删除、元数据读取。

**维护建议**：
- **`installFromUrl` 不验证 URL 安全性**：直接从任意 URL 下载 jar。恶意 URL 可能返回非 jar 文件。建议在下载后验证文件是否为有效 zip/jar。
- **`installFromUrl` 不做哈希校验**：与 `DownloadService.installJar` 不同，此处没有 SHA 校验。建议统一。
- **`readPluginMeta` 使用 `adm-zip` 同步读取**：`new AdmZip(jarPath)` 一次性加载整个 jar 到内存。大插件 jar 可能占用较多内存。建议用流式读取或限制文件大小。
- **`togglePlugin` 不检查服务器状态**：在服务器运行时重命名 jar 文件不会立即生效（需重启），但 UI 没有提示。建议在返回结果中加 `requiresRestart: true`。
- **`removePlugin` 移到 `.trash` 目录**：好的设计，可恢复。但 `.trash` 目录不会被自动清理。建议加一个定期清理或手动清空功能。
- **`PluginManager` 和 `ModManager` 代码几乎完全相同**：两者结构一模一样，只是目标目录不同。强烈建议提取一个 `JarManager` 基类。

### `server/managers/mod-manager.js`（150 行）

**职责**：Forge/Fabric Mod 的安装、启用、禁用、删除、元数据读取。

**维护建议**：
- **与 `PluginManager` 高度重复**：见上方建议，应提取基类。
- **Fabric metadata 解析正确**：`fabric.mod.json` 用 JSON.parse，没问题。
- **`installFromUrl` 的问题与 `PluginManager` 相同**：无 URL 验证、无哈希校验。

### `server/managers/chat-session-manager.js`（140 行）

**职责**：AI 聊天会话的持久化存储（JSON 文件），支持创建、加载、删除、重命名、追加消息、Token 用量统计。

**维护建议**：
- **`save()` 同步写文件**：每次 `appendMessage` 都触发 `save()`，将整个 sessions 数组序列化写入磁盘。当会话数量多、消息长时，会有性能问题。建议加 debounce 或改为增量写入。
- **无文件锁**：如果多个进程同时写 `.easymc/chat-sessions.json`，会损坏数据。当前是单进程工具，问题不大，但需注意。
- **`toModelHistory` 过滤**：只保留 `user` 和 `assistant` 角色的消息，丢弃 `tool` 和 `confirm` 消息。这是正确的——模型不需要看到中间工具调用记录。但如果有 `tool` 消息包含了重要的上下文（如命令执行结果），模型可能丢失上下文。建议考虑将 tool 结果摘要后包含在 user/assistant 消息中。
- **无会话数量限制**：sessions 数组无限增长。建议加上最大会话数限制（如 100），自动删除最旧的。
- **`titleFromMessage` 截断为 34 字符**：对中文消息可能截断在字中间（中文字符在 JS 中长度为 1，但显示宽度为 2）。建议按字节或显示宽度截断。
- **消息无大小限制**：单条消息可以是任意长度。如果 AI 返回超长回复，会增大存储文件。建议限制单条消息的最大长度。

### `server/managers/core-detector.js`（205 行）

**职责**：检测 Minecraft 服务器核心类型和版本，通过读取 jar 内部文件或运行 `java -jar --version`。

**维护建议**：
- **缓存设计**：`_cache` 只在 `invalidateCache()` 时清空。如果 jar 被替换但没有调用 invalidate，会返回过期结果。`api.js` 中的 `POST /server/properties` 和 `POST /server/core/jar` 正确调用了 invalidate。
- **`_detectFromConsole` 运行 jar**：`java -jar server.jar --version` 会实际启动服务器进程（虽然 `--version` 参数会立即退出）。在某些核心上可能触发初始化逻辑。8 秒超时是合理的。
- **`_detectFromJar` 使用 `adm-zip`**：同 `plugin-manager` 的问题，大 jar 会占用内存。且如果 jar 损坏，`AdmZip` 可能抛异常。当前有 try-catch 保护。
- **检测优先级**：先从 jar 内部文件检测，失败再从控制台检测。但 Vanilla jar 的 `version.json` 可能在第一轮就成功，而 Paper jar 如果 `paper.yml` 不在根目录（在 `config/` 子目录），也可能被误判为 Vanilla。检测逻辑需要更细致的优先级排序。
- **`_inferNameFromPath`** 检查文件路径是否包含核心名称（如 "paper"、"forge"）。但如果用户重命名了 jar 为 `server.jar`，此方法无效。这是 fallback 手段，可以接受。

---

## 后端：Security 与 Permissions

### `server/security/file-guard.js`（106 行）

**职责**：路径安全校验，防止 AI Agent 读写项目敏感目录和文件。

**维护建议**：
- **`blockedDirs` 和 `blockedFiles` 硬编码**：列表在构造函数中写死。建议从配置读取，允许用户扩展。
- **符号链接检查**：`fs.realpathSync` 用于检测符号链接逃逸。但如果文件在检查后被替换为符号链接（TOCTOU 竞争），仍有风险。本地工具场景下可接受。
- **`validate` 在读模式下检查文件存在性**：`fs.realpathSync` 对不存在的路径会抛异常，被 catch 后返回 `allowed: false, reason: '路径不存在'`。但写模式下不检查存在性（因为可能要创建新文件）。逻辑正确。
- **`listWorkspaceFiles` 过滤不完整**：过滤了 `node_modules`、`.git`、`.claude`、`client`，但没有过滤 `.easymc`（包含聊天会话数据）和 `mc-server/logs`（可能很大）。建议加 `.easymc`。
- **Windows 路径分隔符**：`path.sep` 在 Windows 上是 `\`，`resolved.startsWith(this.projectRoot + path.sep)` 可以正确工作。但如果 `inputPath` 使用了 `/`（混合分隔符），`path.resolve` 会统一为 `\`，应该没问题。
- **未检查隐藏文件**：以 `.` 开头的文件（如 `.env`、`.gitignore`）部分被列入 `blockedFiles`，但不全面。建议添加规则：拒绝所有以 `.` 开头的文件（除了 `.easymc/` 下的会话文件）。

### `server/permissions/rules.js`（89 行）

**职责**：定义命令权限等级规则和玩家黑名单。

**维护建议**：
- **`PLAYER_BLACKLIST` 与 `config.agent.blockedCommands` 重复**：见 `config.js` 建议。应统一到一处。
- **未匹配命令默认要求 OP 2+**：这是一个安全默认值，好。但可能导致一些安全的命令（如 `seed`）被误拒。`seed` 已在 QUERY 规则中，没问题。但新命令出现时可能被误拒。

### `server/permissions/permission-manager.js`（117 行）

**职责**：从 `ops.json` 读取玩家 OP 等级，通过 chokidar 监听文件变化自动刷新。

**维护建议**：
- **`chokidar.watch` 可能监听不存在的文件**：如果 `ops.json` 不存在，chokidar 会在文件创建后才开始监听。需要确认 chokidar 的行为——默认会忽略不存在的文件。建议加 `awaitWriteFinish` 配置（已有）。
- **`opsCache` 直接存储 JSON.parse 结果**：`ops.json` 的格式是数组，直接存储为 `this.opsCache`。如果文件格式错误（不是数组），后续 `find` 调用会出错。`loadOps` 中有 try-catch，会回退为空数组，可以。
- **`getPlayerPermission` 大小写不敏感**：`op.name.toLowerCase() === playerName.toLowerCase()`。Minecraft 用户名大小写敏感但 Java 版用户名只允许特定字符，此实现是安全的。
- **`getLevelDescription` 描述与 `rules.js` 的描述不同**：`permission-manager.js` 中 level 1 描述为 "Moderator"，而 `rules.js` 中 BASIC level 1 描述为 "基础操作，需要 OP 1+"。建议统一描述来源。
- **`destroy` 关闭 watcher**：正确的资源清理。

---

## 后端：Sources 层（下载源解析）

### `server/sources/source-registry.js`（153 行）

**职责**：统一入口，为 Vanilla、Paper、Purpur、Fabric、Forge 提供版本列表和下载 URL。

**维护建议**：
- **各 API 超时统一为 10 秒**：在网络差的环境可能不够。建议从配置读取。
- **`getVanillaUrl` 发两次请求**：先获取 manifest，再获取版本详情。可以缓存 manifest 避免重复请求。
- **Paper 依赖 HTML 抓取**：`paperScraper.getLatestBuild` 通过解析 papermc.io 网页获取下载链接。网页结构变化会导致功能失效。建议监控 PaperMC 是否恢复了 API，或考虑使用社区维护的 API 代理。
- **Fabric URL 构造**：拼接 loader 和 installer 版本。如果 Fabric API 返回空数组（无稳定版本），`latestLoader` 为 `undefined`，URL 会包含 `undefined`。需加空值检查。
- **Forge 返回 installer jar**：`forge-{version}-installer.jar` 是安装器，不是服务端 jar。部署后需要运行安装器才能获得服务端。但 `deploy-manager.js` 的 `deploy()` 直接下载 jar 到 `server.jar` 位置，对 Forge 来说这是安装器而非服务端。这是一个已知的功能缺陷。

### `server/sources/mirror-detector.js`（104 行）

**职责**：检测各下载源（Mojang、Purpur、Fabric、Forge、BMCLAPI）的可用性和延迟。

**维护建议**：
- **未被实际使用**：`MirrorDetector` 在 `deploy-manager.js` 构造函数中实例化，但 `deploy()` 方法中没有调用 `getBestSource` 或 `detectAvailableSources`。可能是预留功能。建议要么实现镜像选择逻辑，要么移除以减少代码量。
- **BMCLAPI 镜像未实际集成**：`SOURCES` 中列出了 BMCLAPI（中国镜像），但没有实现将官方 URL 转换为 BMCLAPI URL 的逻辑。
- **缓存 5 分钟**：合理的时间窗口。
- **`detectAvailableSources` 对每个源发 GET 请求**：只检查根路径返回 2xx-3xx。某些 API 根路径可能返回 404 但实际功能正常。建议改为检查具体的 API 端点。

### `server/sources/paper-scraper.js`（79 行）

**职责**：通过 HTML 抓取 papermc.io 获取 Paper 下载链接。

**维护建议**：
- **HTML 抓取脆弱**：依赖 `fill-data.papermc.io` 域名和特定的 URL 格式。PaperMC 改版会导致失效。建议加错误降级提示。
- **`getLatestBuild` 返回类型不一致**：传 `targetVersion` 时返回单个对象或 null，不传时返回数组。这种多态返回容易导致调用方 bug。建议拆分为两个方法。
- **`getAvailableVersions` 调用 `getLatestBuild()` 不传参数**：获取所有版本的最新构建，然后提取版本号。但 `getLatestBuild()` 不传参数时返回的是数组而非单个对象，代码逻辑正确但容易混淆。
- **无版本号排序保证**：依赖 `papermc.io` 页面上链接的顺序。如果页面排序变化，版本列表顺序也会变。`.sort().reverse()` 做了客户端排序，可以。

### `server/sources/forge-parser.js`（82 行）

**职责**：解析 Forge Maven metadata XML 获取版本列表。

**维护建议**：
- **10 分钟缓存**：合理。Forge 版本不会频繁更新。
- **版本号解析正则**：`/^([\d.]+?)-/` 提取 MC 版本号。对 `1.20.1-47.4.5` 格式有效。但如果 Forge 改变版本号格式，需更新正则。
- **`getLatestBuildForMc` 取最后一个版本**：Maven metadata 中版本按时间排序，最后一个是最新的。但如果有 beta/alpha 版本混在中间，可能取到不稳定版本。建议加版本类型过滤。
- **XML 解析使用 `fast-xml-parser`**：同步解析。如果 XML 很大，会阻塞事件循环。Forge 的版本列表不会很大（几百个），可以接受。

---

## 后端：Download 层（下载服务与适配器）

### `server/download/download-service.js`（251 行）

**职责**：下载服务核心，管理适配器注册、搜索聚合、安装流程、哈希校验。

**维护建议**：
- **适配器注册模式好**：`register()` 方法允许动态注册适配器。`DisabledAdapter` 用于标记未配置的源（CurseForge、Hangar、Spiget），设计清晰。
- **`search` 用 `Promise.allSettled`**：好的设计，单个适配器失败不影响其他结果。
- **`install` 的 `queueItem` 查找**：`this.queue.items.find(item => item.id === queueItem.id)` 在 success 和 error 分支都调用了。建议提取为局部变量。
- **`safeFileName` 清理不够全面**：替换了 `<>:"/\|?*`，但没有处理路径遍历（`..`）。虽然 `path.basename` 已经提取了文件名部分，应该安全。
- **`calculateHash` 流式读取**：正确的大文件哈希计算方式。
- **`installJar` 的 SHA1 校验**：只在 `file.hashes?.sha1` 存在时校验。Modrinth 返回 sha1 和 sha512，但手动 URL 安装的插件/Mod 没有哈希信息。

### `server/download/download-queue.js`（66 行）

**职责**：下载队列管理，基于 EventEmitter。

**维护建议**：
- **队列无大小限制**：`items` 数组无限增长。`list()` 只返回前 50 个，但内部数组不清理。建议加最大队列大小或自动清理已完成项目。
- **`clearCompleted` 只过滤 `status !== 'complete'`**：不过滤 `status === 'error'` 的项目。错误项目会一直留在队列中。
- **无并发控制**：`config.download.maxConcurrentDownloads` 配置了但没有使用。当前所有安装请求是串行的（因为 UI 一次只触发一个），但后端没有强制限制。
- **`update` 直接 mutate item**：`Object.assign(item, patch, { updatedAt: Date.now() })`。如果 patch 包含 `id` 或 `status` 等字段，会覆盖原有值。这可能是期望行为，但需注意。

### `server/download/download-cache.js`（36 行）

**职责**：简单的 TTL 缓存，支持 `get`、`set`、`wrap`。

**维护建议**：
- **`wrap` 缓存 Promise**：`this.set(key, promise)` 存储的是 Promise 而非值。如果 Promise reject，缓存的 rejected Promise 会在 TTL 内一直返回 rejection。建议在 Promise reject 时删除缓存项。
- **无最大条目数**：`entries` Map 无限增长。长时间运行会积累大量缓存。建议加 LRU 淘汰或最大条目数。
- **无清理定时器**：过期条目只在 `get` 时被惰性删除。如果某些 key 不再被访问，对应的缓存项永远不会被清除。建议加定期清理。

### `server/download/adapters/core-adapter.js`（145 行）

**职责**：将 `DeployManager` 的核心部署能力包装为下载适配器。

**维护建议**：
- **`CORE_METADATA` 硬编码**：核心类型信息写死在代码中。如果新增核心类型（如 Folia），需要修改此处和 `deploy-manager.js` 的 `getCoreTypes()`。建议统一到一处定义。
- **`listFiles` 截断为 40 个版本**：某些核心（如 Vanilla）有数百个版本。只返回 40 个可能导致用户找不到需要的版本。建议加分页或增加限制。
- **`resolveFile` 的 fallback**：如果 `fileId` 不匹配，返回第一个文件。这可能导致安装错误的版本。建议在找不到匹配时抛异常。
- **`listFiles` 的缓存**：通过 `this.cache.wrap` 缓存版本列表。但 `DeployManager.getVersionList` 内部也有缓存（如 `ForgeParser` 的 10 分钟缓存）。双层缓存不是问题，但需注意一致性。

### `server/download/adapters/modrinth-adapter.js`（187 行）

**职责**：Modrinth API v2 适配器，支持搜索、项目详情、版本文件列表。

**维护建议**：
- **`TYPE_MAP` 不完整**：只有 `Mods: 'mod'`。`Plugins` 没有映射到 `project_type: 'plugin'`，而是通过 `categories` facets 过滤。这可能导致搜索结果不够精确。Modrinth API 支持 `project_type=plugin`，建议加入 TYPE_MAP。
- **`inferType` 启发式判断**：通过 `categories` 是否包含 plugin loader 来判断类型。如果 Modrinth 数据不完整，可能误判。
- **`normalizeVersion` 的 `fileId`**：使用 `file.hashes?.sha512 || file.hashes?.sha1 || file.filename` 作为 fileId。这意味着 fileId 不稳定——如果 Modrinth 更新了文件的哈希，fileId 会变化。建议直接使用 Modrinth 的 version ID 作为 fileId。
- **`normalizeSearchHit` 的 `loaders`**：直接使用 `hit.categories` 作为 loaders。但 categories 包含非 loader 的标签（如 "fabric" 是 loader，"optimization" 不是）。建议用 `hit.loaders` 字段（如果 API 提供）。
- **无速率限制处理**：Modrinth API 有速率限制（300/min）。当前没有处理 429 响应。建议加重试逻辑或使用 `DownloadCache` 减少请求。
- **`sourceInfo` 的 `supports`**：写死为 `['Mods', 'Plugins']`。Modrinth 也支持 Shaders、Resource Packs 等，但项目当前不需要。

---

## 后端：REST API 路由

### `server/routes/api.js`（323 行）

**职责**：Express REST API 路由，提供配置管理、服务器状态、Java 检测、工作区文件列表、Agent 工具/提示词管理、下载搜索/安装等接口。

**维护建议**：
- **`POST /config` 直接修改内存中的 config 对象**：修改后调用 `agentCore.reinit()` 使新配置生效。但其他 Manager（如 `serverManager`、`terminalManager`）持有的 config 引用是否共享同一对象？如果 `loadConfig()` 返回的是 deepMerge 的新对象，各 Manager 可能持有不同副本。需确认——在 `index.js` 中，config 对象被传给所有 Manager，它们持有同一引用，所以 `api.js` 修改 `config.ai.apiKey` 会被所有 Manager 看到。可以工作。
- **`POST /config` 写入 `config.local.json`**：`JSON.stringify(config, null, 2)` 序列化整个 config 对象。但 config 对象可能被运行时添加了额外属性（如 `mc.version`、`mc.coreType` 在 deploy 时添加）。这些动态属性也会被写入文件，可能导致配置文件膨胀。
- **API Key 安全处理**：`GET /config` 返回 `apiKey: '***'`（已配置）或 `''`（未配置）。`POST /config` 只在 `apiKey !== '***' && apiKey !== ''` 时更新。设计正确，防止了前端回传掩盖的 key。
- **缺少输入验证**：`POST /server/properties` 接受任意 key-value 对。恶意输入可以写入 `key=../../../etc/passwd`。但 FileGuard 的 `validate` 会拦截路径逃逸。不过 key 本身会被写入 `server.properties` 文件，如果 key 包含换行符，可能注入额外的 properties 行。建议验证 key 只允许字母、数字、连字符。
- **`POST /server/core/jar` 上传**：接受 base64 编码的 jar 文件。`express.json({ limit: '10mb' })` 限制了请求体大小。但 base64 编码会使数据膨胀约 33%，所以实际文件大小限制约 7.5MB。对于 Minecraft 服务端 jar（通常 40-60MB）来说太小了。建议提高限制或使用 multipart 上传。
- **`GET /download/search` 无分页**：`downloadService.search` 返回最多 80 条结果。对于 REST API 应该支持分页参数。
- **缺少认证**：所有 API 端点无需认证。因为是本地工具（绑定 127.0.0.1），可以接受。但如果未来支持远程访问，需要加认证中间件。
- **`GET /agent/prompts` 返回的 player prompt 包含模板占位符**：`getPlayerPrompt('{playerName}', '{permissionLevel}', '{permissionDescription}', config)` 会把占位符当 playerName 传入，输出中会包含替换后的内容。但占位符本身是大括号格式，`replace` 只会替换第一次出现的 `{playerName}`。如果 prompt 中有多个 `{playerName}`，都会被替换为字面量 `{playerName}`——等等，这不对。传入的 `playerName` 是 `'{playerName}'`，`replace` 会把 prompt 中的 `{playerName}` 替换为 `{playerName}`，结果不变。这实际上是对的——前端看到的 player prompt 保留了模板占位符。

---

## 前端：React SPA

### `client/src/App.jsx`（2838 行）

**职责**：应用主组件，包含所有页面路由、状态管理、Socket.IO 事件处理、UI 渲染。

**维护建议**：
- **文件过大，严重违反单一职责**：2838 行的单文件包含了终端面板、聊天面板、服务器基础设置、下载浏览器、插件/Mod 管理入口、Agent Stream 等所有功能。强烈建议拆分为多个页面组件和自定义 Hook。
- **状态管理过于集中**：所有状态（serverStatus、javaStatus、terminalLines、chatSessions、currentSession、downloads、plugins、mods 等）都在 App 组件中管理。建议使用 Context 或状态管理库（如 Zustand）分散状态。
- **Socket 事件监听在 useEffect 中注册**：多个 useEffect 注册 Socket.IO 事件，依赖数组不完整可能导致重复注册。需仔细检查每个 useEffect 的依赖数组。
- **`KeyRound` 事件**：此前因 `KeyRound` 图标未导入导致白屏。说明缺少 TypeScript 或 ESLint 的未使用变量检查。建议配置 ESLint `no-undef` 规则或迁移到 TypeScript。
- **硬编码的 `DOWNLOAD_RESOURCES`**：包含示例数据（Paper 1.21.1、Fabric API 等），这些数据不是从 API 获取的，是静态展示用的。需确认这些是否应该从后端动态获取。
- **`WELCOME_MESSAGES` 随机选择**：每次渲染都可能变化（如果用 `Math.random` 在 render 中调用）。应在 useState 初始化或 useEffect 中设置。
- **缺少 ErrorBoundary**：任何一个子组件抛异常会导致整个应用白屏（如 KeyRound 事件）。建议添加 React ErrorBoundary 组件包裹关键区域。
- **缺少代码分割**：所有组件都在一个 bundle 中。建议使用 `React.lazy` + `Suspense` 对非首屏组件（如 DeployWizard、SettingsModal）做懒加载。

### `client/src/main.jsx`（14 行）

**职责**：React 应用入口，挂载到 DOM。

**维护建议**：
- 使用 `React.StrictMode`，在开发模式下会双重渲染。生产构建不受影响。可以。
- 缺少 ErrorBoundary 包裹。建议在 `<App />` 外层加一个全局 ErrorBoundary。

### `client/src/hooks/useSocket.js`（54 行）

**职责**：Socket.IO 连接管理 Hook，提供 `emit`、`on`、`connected` 状态。

**维护建议**：
- **Socket 单例在模块级创建**：`const socket = io(...)` 在模块加载时执行。如果页面在服务器启动前打开，会立即尝试连接并重试。`reconnectionAttempts: 10` 限制重试次数，之后不再重连。建议设为 `Infinity` 或更大值。
- **`on` 返回清理函数**：正确的设计，在 useEffect 中使用时会自动清理。
- **`emit` 不支持 Promise/ack**：只是简单的 `s.emit(event, data)`。如果需要服务端确认（如 `emit('event', data, callback)`），当前实现不支持。建议加 `emitWithAck` 方法。
- **Socket 连接 URL**：`window.location.origin` 在开发模式下（Vite dev server 端口 5173）会连接到 dev server 而非后端。需要配置 Vite proxy 或使用固定 URL。

### `client/src/components/AgentStreamPage.jsx`（141 行）

**职责**：展示游戏内 @agent 活动流。

**维护建议**：
- **100 条消息限制**：`isAtLimit = messages.length >= 100`。超过后只显示提示，不截断。如果 messages 数组继续增长，会有内存问题。建议在父组件中做截断。
- **`Avatar` 组件定义在文件末尾**：不是默认导出，只在文件内使用。可以接受，但建议提取到共用组件文件。
- **自动滚动逻辑**：`useEffect` 依赖 `messages.length` 和 `isTyping`。在消息快速到达时可能频繁触发。可以加 debounce。

### `client/src/components/DeployWizard.jsx`（272 行）

**职责**：服务器部署向导，4 步流程（选择核心 → 选择版本 → 部署中 → 完成）。

**维护建议**：
- **步骤管理用数字**：`step` 状态用 1-4 数字。建议用枚举常量或字符串提高可读性。
- **`deploy:step`、`deploy:progress` 等事件在 `useEffect` 中注册**：依赖数组 `[on]`，如果 `on` 不稳定（每次渲染创建新函数），会导致重复注册。`useSocket` 的 `on` 用 `useCallback` 包裹了，是稳定的。
- **版本列表截断为 30**：`versions.slice(0, 30)`。某些核心有更多版本，用户可能找不到需要的。建议加搜索或分页。
- **`handleSelectType` 不重置 `selectedVersion`**：从 step 2 返回 step 1 再选择新核心时，`selectedVersion` 可能保留旧值。需在 `handleSelectType` 中清空。

### `client/src/components/SettingsModal.jsx`（225 行）

**职责**：设置弹窗，管理 AI API Key、Base URL、模型、服务器目录、JVM 内存。

**维护建议**：
- **JVM 内存解析逻辑脆弱**：`memArg.replace('-Xmx', '').replace('M', '').replace('G', '000')`。如果 jvmArgs 是 `-Xmx2G`，解析为 `2000`（近似），但 `2G` 应该是 `2048`。建议更精确地解析。
- **保存后不清除 `saved` 状态**：`setSaved(true)` + `setTimeout` 2.5 秒后清除。如果用户在 2.5 秒内关闭弹窗，setTimeout 仍会执行，可能导致对已卸载组件调用 setState 的警告。建议在 useEffect 中管理 timeout 并在 unmount 时清除。
- **Escape 键关闭**：`handleKeyDown` 检查 `e.key === 'Escape'`。但事件监听在 `div` 上，需要弹窗有焦点才能接收键盘事件。建议改用 `document.addEventListener`。
- **`onClick={onClose}` 在背景遮罩上**：点击背景关闭弹窗。内容区有 `e.stopPropagation()`。设计正确。

### `client/src/components/PluginManager.jsx`（138 行）和 `ModManager.jsx`（134 行）

**职责**：插件/Mod 管理界面，支持搜索、URL 安装、启用/禁用、删除。

**维护建议**：
- **两个组件代码几乎完全相同**：与后端 `PluginManager` 和 `ModManager` 的问题一致。应提取通用组件 `JarManagerView`。
- **`installing` 状态用 setTimeout 2 秒清除**：不依赖实际安装完成事件。如果安装超过 2 秒，按钮会提前恢复可点击状态。建议监听 `plugin:installed` / `mod:installed` 事件来清除状态。
- **删除确认用 `confirm()`**：浏览器原生确认框。与项目其他部分的 UI 风格不一致。建议用自定义确认弹窗。
- **无安装错误提示**：`plugin:install` 如果失败（如 URL 无效），后端 emit `plugin:error`，但前端没有监听这个事件。用户看不到错误信息。

### `client/src/components/ServerControls.jsx`（65 行）

**职责**：服务器控制按钮栏（启动/停止/重启）和 Java 状态显示。

**维护建议**：
- **简洁清晰**：组件职责单一，实现正确。
- **`javaStatus.javas[0]` 可能越界**：如果 `javaStatus.found` 为 true 但 `javas` 数组为空（理论上不应该），会出错。建议加 `javas?.[0]` 保护。

### `client/src/components/WorkspacePanel.jsx`（76 行）

**职责**：工作区文件浏览器面板。

**维护建议**：
- **只显示一级文件**：不支持点击目录进入子目录。功能有限，可能是设计意图（"后续可迁入 Material You 列表"）。
- **`refreshFiles` 用 `fetch` 而非 Socket**：与其他组件使用 Socket.IO 不一致。但因为这是只读操作，REST API 也可以。
- **无错误提示**：`catch` 中只 `console.error`，用户看不到错误。建议加 UI 错误提示。

### `client/src/styles/index.css`

**职责**：全局样式，Tailwind CSS 入口。

**维护建议**：
- 建议检查是否使用了 `@tailwind base` 完整重置，可能与自定义样式冲突。
- 前端同时使用了 `mc-*` 前缀的自定义颜色和 `md-*` 前缀的 Material Design 颜色。建议统一颜色系统。

---

## 配置文件

### `config.local.json`

**职责**：用户本地配置，覆盖默认值。

**维护建议**：
- **包含明文 API Key**：`"apiKey": "sk-..."` 直接存储。虽然是本地文件，但如果不小心提交到 Git 会泄露。`.gitignore` 应包含此文件（需确认）。

### `package.json`

**职责**：项目依赖和脚本定义。

**维护建议**：
- **`postinstall` 脚本**：`cd client && npm install`。如果客户端依赖安装失败，根目录的 `npm install` 也会失败。这是期望行为。
- **版本号仍为 `1.0.0`**：与 `OUTPUT_TO_GITHUB` 中的版本（V0_0_4BETA）不一致。建议同步。

---

## 跨文件架构注意事项

### 1. 重复定义需统一

| 概念 | 定义位置 1 | 定义位置 2 |
|---|---|---|
| 玩家黑名单 | `config.js: agent.blockedCommands` | `rules.js: PLAYER_BLACKLIST` |
| MC→Java 版本映射 | `java-manager.js: MC_JAVA_MAP` | `config.js: java.versionMap` |
| ANSI 正则 | `chat-monitor.js: ANSI_REGEX` | `server-manager.js: ANSI_REGEX` |
| 核心 类型列表 | `deploy-manager.js: getCoreTypes()` | `core-adapter.js: CORE_METADATA` |

### 2. Plugin/Mod 代码重复

后端 `plugin-manager.js` 和 `mod-manager.js` 代码结构完全相同。前端 `PluginManager.jsx` 和 `ModManager.jsx` 也完全相同。应提取：
- 后端：`JarManager` 基类
- 前端：`JarManagerView` 通用组件

### 3. 前端单文件过大

`App.jsx` 2838 行承载了太多功能。建议拆分为：
- `pages/TerminalPage.jsx`
- `pages/ChatPage.jsx`
- `pages/ServerSetupPage.jsx`
- `pages/DownloadBrowserPage.jsx`
- `hooks/useServerStatus.js`
- `hooks/useTerminal.js`
- `hooks/useChat.js`
- `hooks/useDownloads.js`

### 4. 错误处理一致性

后端 Socket.IO 事件处理器已通过 `handle()` 包装器统一捕获异步异常。需确认所有同步异常路径也已覆盖并 emit 错误事件。

### 5. 前端缺少 ErrorBoundary

任何组件抛异常会导致白屏。`KeyRound` 事件就是例子。建议：
- 在 `main.jsx` 加全局 ErrorBoundary
- 在每个懒加载组件外层加局部 ErrorBoundary

### 6. 测试缺失

项目没有任何测试文件。建议优先添加：
- `FileGuard` 的路径校验测试（安全关键）
- `checkPermission` 的权限规则测试（安全关键）
- `TerminalManager` 的环形缓冲区测试（核心数据结构）
- `AgentCore` 的工具调用循环测试（AI 核心）
