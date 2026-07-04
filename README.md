# EasyMC Server Agent

一个专门面向 Minecraft 服务器的 AI Agent。它在你本地运行一个 Web 管理界面，让你通过对话来管理服务器——执行命令、部署服务端、管理插件和 Mod，甚至让玩家在游戏里通过 `@agent` 直接和 AI 对话。所有高危操作都会弹出确认，AI 无法绕过你的授权。

## 快速开始

**前提：** 需要安装 [Node.js 18+](https://nodejs.org/)。

```bash
# Windows — 双击 start.bat
# Linux / macOS
chmod +x start.sh && ./start.sh
```

启动脚本会自动完成依赖安装、前端构建和 Java 环境检测，然后在浏览器打开管理界面（默认 `http://localhost:3000`）。

首次使用需要在设置中填写 AI API Key（支持 OpenAI 及所有 OpenAI 兼容接口），然后通过部署向导下载服务端核心即可开服。

## 关于本项目

这是一个个人项目，目前处于早期阶段（v0.0.2 Beta）。我计划持续开发，后续会加入更多实用功能。

本项目采用 **Vibe Coding** 方式开发——由我描述需求和设计方向，AI 辅助完成代码实现，我再审查和调整。如果你对这种开发模式或项目本身感兴趣，欢迎提 Issue 或 PR。

## 技术栈

前端 React + Vite + Tailwind CSS + xterm.js，后端 Express + Socket.IO，AI 层使用 OpenAI SDK（兼容 DeepSeek、通义千问等）。

## License

MIT。字体文件 Roboto 遵循 SIL Open Font License 1.1。
