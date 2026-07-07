# EasyMC Server Agent

> An AI-powered Minecraft server management tool built with vibe coding.

[![Vibe Coding](https://img.shields.io/badge/built%20with-vibe%20coding-purple)](https://en.wikipedia.org/wiki/Vibe_coding)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

## What is this?

EasyMC Server Agent is a **vibe coding** project: an AI-assisted Minecraft server management interface that lets you control, configure, and interact with your Minecraft server through natural language. It combines a React frontend with an Express + Socket.IO backend, and plugs into an LLM agent capable of executing server commands, managing files, and monitoring chat.

Most of this codebase was shaped through iterative, conversational development rather than upfront architecture. The goal is functional, playful, and continuously improving.

## Features

- 🤖 **AI Agent Chat** — talk to your server in natural language
- 🎮 **Minecraft Console Control** — execute commands, manage properties, restart/stop the server
- 💬 **Chat Monitoring** — watch in-game chat and reply as `[Agent]`
- 🛠️ **File & Workspace Manager** — inspect and edit server files safely
- 📦 **Deployment Wizard** — download and set up Paper/Forge/Spigot servers
- 🧩 **Mod / Plugin Manager** — browse and install add-ons
- 🖥️ **Live Terminal** — embedded xterm.js terminal for server output
- 🎨 **Material You UI** — Tailwind CSS with Material Design 3 color tokens

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS, Socket.IO Client, xterm.js, lucide-react |
| Backend | Node.js, Express, Socket.IO, OpenAI SDK |
| Server | Minecraft Java Edition (Paper / Forge / Spigot) |

## Quick Start

### Requirements

- [Node.js](https://nodejs.org/) >= 18.0.0
- Java Runtime (for Minecraft server)

### Run

**Windows:**

```bat
start.bat
```

**Linux / macOS:**

```bash
./start.sh
```

Or directly with Node:

```bash
npm install
npm start
```

The launcher will install dependencies, build the frontend, check Java, generate configs, and start the server.

## Development

```bash
# Run backend + frontend dev server concurrently
npm run dev

# Build frontend only
npm run build

# Start backend only
npm run server
```

## Project Structure

```
.
├── client/          # React + Vite frontend
├── server/          # Express backend, agent logic, managers
├── mc-server/       # Minecraft server directory (created at runtime, gitignored)
├── java-runtime/    # Bundled Java runtime (gitignored)
├── start.js         # Cross-platform Node launcher
├── start.bat        # Windows launcher
└── start.sh         # POSIX launcher
```

## Vibe Coding

This project is intentionally built in a **vibe coding** style:

- Iterative, conversation-driven development
- Working features over perfect abstractions
- Heavy use of AI assistance for code, debugging, and design
- Code that evolves alongside the project's needs

Expect rough edges, experimental features, and frequent refactors.

## License

MIT
