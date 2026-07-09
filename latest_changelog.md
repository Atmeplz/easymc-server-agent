# Latest Changelog

> Generated on 2026-07-09

## fix: make in-game @agent chat actually work

### Bug 修复 & 核心功能

- **重写 chat-monitor 解析器**
  - 剥离 Minecraft 日志前缀，正确检测真实控制台输出中的 `@agent`。
  - 移除 `[` 跳过逻辑（该逻辑曾导致所有真实 MC 行被忽略）。
  - 增加 `[Agent]` 广播的自循环防护，避免 Agent 回复触发自身。

- **统一 socket 事件名称**
  - 后端现在统一使用 `agent:player_request` 事件名，前后端对齐。

- **maxResponseLength 默认值对齐**
  - 默认值统一为 30，修复截断逻辑确保响应永远不超过限制。

- **屏蔽 broadcast_reply 工具**
  - 在玩家聊天场景中禁用 `broadcast_reply` 工具，避免双重广播。

- **server-manager stdout/stderr 处理优化**
  - 使用 readline + ANSI 剥离，实现更健壮的进程输出处理。

### 前端改动

- 提取新的 `AgentStreamPage` 组件，增加连接/离线/最大消息数状态管理。
- 使用稳定的 ref-based ID 管理流消息，历史消息上限 100 条。
- 服务器控制台中高亮 `@agent` 和 `[Agent]` 行，提升可读性。

### 清理

- 移除遗留的废弃组件：`AgentActivityPanel`、`ChatPanel`、`TerminalPanel`、`useChat`。
- 清除调试日志。
# Latest Changelog

> Generated on 2026-07-08

## Server Basic Setup 页面重构

### 新增功能

- **核心信息卡片**
  - 通过读取 `server.jar` 内容自动检测核心类型、版本、Mod/Plugin 支持情况。
  - 检测逻辑位于 `server/managers/core-detector.js`。
  - 后端提供 `GET /api/server/core`，前端卡片实时展示核心名称、版本、Mods/Plugins 支持状态指示灯。

- **核心更换**
  - 点击核心卡片的“更换>”打开 Material You 风格弹窗。
  - 通过隐藏文件选择器选取新的服务端 jar，以 base64 上传。
  - 后端 `POST /api/server/core/jar` 接收后自动备份原 jar 并替换。
  - **待完善（明日继续）**：实现逻辑需要是拷贝一份用户最终选中的 `.jar` 到 `mc-server` 文件夹中，将旧核心重命名为 `OLD_SERVER.jar.unused`，新的命名为 `server.jar`。这个过程需要在 Save 之后再做。

- **JDK 信息卡片**
  - 展示当前检测到的 Java 主版本号。
  - 点击“更换>”打开 JDK 选择弹窗，支持：
    - 从文件资源管理器选择 Java 可执行文件。
    - 一键扫描系统可用 JDK（`GET /api/java/scan`），列出路径、版本、来源。

- **游戏配置项**
  - 游戏默认模式：生存 / 创造 / 极限 / 冒险（极限自动设置 `hardcore=true`）。
  - 世界难度：和平 / 简单 / 普通 / 困难。
  - 正版验证开关。
  - 允许飞行开关。

- **配置持久化**
  - Save 按钮将游戏配置写入 `mc-server/server.properties`。
  - JDK 自定义路径保存到 `config.local.json` 的 `java.customPath`。

### 后端改动

- `server/index.js`
  - `express.json` 限制提升到 `200mb`，支持 base64 jar 上传。
- `server/routes/api.js`
  - 新增 `GET /api/server/core`。
  - 新增 `POST /api/server/core/jar`。
  - 新增 `GET /api/java/scan`。
  - `POST /api/config` 支持 `mc.javaPath` 映射到 `config.java.customPath`。
- `server/managers/core-detector.js`（新增）
  - 读取 jar 内的 `META-INF/MANIFEST.MF`、`version.json`、`paper.yml`、`bukkit.yml`、`fabric.mod.json`、`META-INF/mods.toml` 等文件进行核心识别。
  - 无法识别时回退到 `java -jar server.jar --version`。
- `server/managers/java-manager.js`
  - 新增 `scanForJavas()`，扫描 PATH、JAVA_HOME、Windows 常见 JDK 目录、macOS `/Library/Java`、Linux `/usr/lib/jvm` 等位置。

### 前端改动

- `client/src/App.jsx`
  - 重写 `BasicSetupPage` 的标题栏、Save 按钮、核心/JDK 卡片、游戏模式/难度 pill 组、开关项。
  - 新增核心更换弹窗、JDK 选择弹窗，风格与 Prompt 页面确认弹窗统一。
  - 所有弹窗添加淡淡背景高斯模糊（`backdrop-blur-sm`）和淡入缩放动画。
- `client/src/styles/index.css`
  - 新增 `.dialog-backdrop` 和 `.dialog-content` 动画关键帧。

### 问题修复

- **“更换>”按钮无法点击**
  - 原因：`client/dist` 构建产物未更新，DOM 中渲染为不可点击的 `<span>`。
  - 解决：删除旧 `dist`，重新执行 `npm run build`。
- **`/api/java/scan` 返回 HTML 导致 JSON 解析失败**
  - 原因：浏览器访问的是 `localhost:3001`，该端口对应一个在我添加 `/api/java/scan` 路由之前就已启动的旧后端进程。
  - 解决：终止旧进程，重新启动 `node server/index.js`，现在服务运行在 `localhost:3000`。
- **PayloadTooLargeError**
  - 原因：默认 `express.json` 限制太小，base64 jar 上传超出限制。
  - 解决：将限制提升至 `200mb`。

### 清理

- 删除临时脚本 `.claude/replace-basic-setup.js`。
