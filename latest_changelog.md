# Latest Changelog

> Generated on 2026-07-10

## 后端安全与可维护性维护

本次维护聚焦后端安全加固、启动健壮性与重复规则统一，**未修改任何前端文件**，保持现有功能与界面完全一致。

### 安全加固

- **命令注入防护**
  - `server/managers/server-manager.js`：
    - `sendCommand()` 现在会过滤命令中的 `\r` 和 `\n`，防止恶意输入拆分成多条命令执行。
  - `server/agent/tools.js`：
    - `execute_mc_command` 在执行前检查命令是否包含换行符，若包含则直接拒绝。
  - `server/agent/tools.js`：
    - `server_properties` 写入属性时，先校验 key 只允许 `a-zA-Z0-9._-`，并禁止 value 包含换行符，避免注入额外配置行。

- **高危命令规则统一**
  - `server/permissions/rules.js`：
    - `COMMAND_RULES.commands` 改为 `Set`，匹配语义更清晰。
    - `PLAYER_BLACKLIST` 改为 `Set`，新增 `isBlacklisted()` 函数，正确处理 `whitelist off`、`save-off` 等多词命令。
    - 导出 `isBlacklisted()` 供工具层复用。
  - `server/agent/tools.js`：
    - `DANGEROUS_COMMANDS` 改为从 `permissions/rules.js` 自动生成，避免两处定义不同步。

### 健壮性提升

- **启动脚本**
  - `start.js`：
    - 关闭窗口提示中的端口从硬编码 `3000` 改为读取 `config.port`，避免与实际绑定端口不一致。
    - 浏览器 fallback 定时器改为仅在未收到 `[EasyMC:PORT]` 标记时才触发，并延长至 8 秒，避免过早打开错误端口。

- **服务入口**
  - `server/index.js`：
    - 将 `MAX_UPLOAD_BYTES` 提升到模块级常量。
    - 新增全局 `uncaughtException` / `unhandledRejection` 兜底日志，避免未捕获异常导致进程崩溃。
    - 新增 `handle()` 包装器统一捕获异步 Socket 事件处理器异常，防止服务端崩溃或客户端挂起。
    - 修复 `agent:interrupt` 在 `stopActiveChatRun()` 后访问 `activeChatRun.sessionId` 的潜在空指针问题。
    - `disconnect` 事件中对 `stopActiveChatRun()` 做 try/catch 保护。

- **终端管理器**
  - `server/managers/terminal-manager.js`：
    - 为 `logStream` 添加 `error` 事件处理，磁盘满或权限错误时不会抛出未捕获异常。
    - `clearHistory()` 改为原地重置 ring buffer，避免重新分配大数组触发 GC。
    - `destroy()` 后设置 `destroyed` 标记，后续读取操作返回空数组，避免返回过期数据。

- **服务器管理器**
  - `server/managers/server-manager.js`：
    - 新增 `Loading complete!` 等服务器就绪标记，提高不同核心兼容性。
    - 版本号解析正则更精确，避免捕获尾随标点。
    - `resolveJavaPath()` 在回退到系统 `java` 前先验证其可用性，不可用则抛出清晰错误。

- **下载服务**
  - `server/download/download-service.js`：
    - `.part` 临时文件在最终 `renameSync` 失败时会被清理，避免残留不完整下载。

### 配置与依赖

- `server/config.js`：
  - `ai.apiKey` 默认支持 `EASYMC_API_KEY` 环境变量回退。
  - 补充 `java.customPath: ''` 默认值，避免运行时动态字段写入 `config.local.json`。

- `package.json`：
  - 新增缺失的 `toml` 依赖（`mod-manager.js` 需要）。
  - 移除未使用的 `open` 包。

### 验证

- 已执行 `npm install` 与 `npm run build`，前端构建成功。
- 使用内置浏览器完整验证：Agent Chat、Server Console、Download、Mods、Plugins、Server Basic Setup、Agent Tools、Prompt Settings、@agent Stream 页面均正常加载，明暗主题切换正常。
- 浏览器控制台与服务端日志均无错误，网络请求无失败。
