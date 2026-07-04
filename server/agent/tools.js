/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Agent Tools - callable tool definitions.
 * All file operations must pass FileGuard validation.
 */
const fs = require('fs');
const path = require('path');
const MAX_INSPECT_BYTES = 12000;

// High-risk commands that require admin confirmation.
const DANGEROUS_COMMANDS = new Set([
  'stop', 'save-off', 'save-on', 'reload', 'defaultgamemode',
  'op', 'deop', 'ban', 'pardon', 'whitelist',
]);

/**
 * Check whether a command is high risk.
 */
function isDangerousCommand(command) {
  const cmdBase = (command || '').replace(/^\/+/, '').split(' ')[0].toLowerCase();
  return DANGEROUS_COMMANDS.has(cmdBase);
}

/**
 * Generate OpenAI function-calling tool definitions.
 */
function getToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'execute_mc_command',
        description: '向 Minecraft 服务器控制台发送命令并获取输出。用于执行游戏命令（如 gamemode、give、tp、weather 等）或服务器管理命令。',
        parameters: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: '要执行的 MC 命令（不含前导 /）。例如: "gamemode creative Steve"、"give @a diamond 64"',
            },
          },
          required: ['command'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_server_status',
        description: '获取 Minecraft 服务器的当前状态，包括运行状态、在线玩家数量等。',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_players',
        description: '列出当前在线的玩家。',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_server_log',
        description: '读取服务器终端的最近输出日志，用于查看服务器运行状况、排查错误。',
        parameters: {
          type: 'object',
          properties: {
            lines: {
              type: 'number',
              description: '要读取的最近行数（默认 50）',
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'read_file',
        description: '读取项目工作区内的文件内容。可以读取服务器配置、插件、mods、日志等文件。路径相对于项目根目录。',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: '相对于项目根目录的文件路径，例如 "mc-server/server.properties" 或 "mc-server/plugins/Essentials/config.yml"',
            },
          },
          required: ['path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: '向项目工作区写入文件。可以创建或修改配置文件、脚本等。路径相对于项目根目录。',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: '相对于项目根目录的文件路径，例如 "mc-server/config/new.yml" 或 "mc-server/plugins/MyPlugin/config.yml"',
            },
            content: {
              type: 'string',
              description: '文件内容',
            },
          },
          required: ['path', 'content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'list_files',
        description: '列出项目工作区内的文件和目录。路径相对于项目根目录。',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: '相对于项目根目录的目录路径，例如 "mc-server/plugins" 或 "mc-server"',
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'inspect_files',
        description: '一次性检查多个工作区路径。目录会返回文件列表，文件会返回内容摘要；用于减少反复 list_files/read_file 消耗 Agent 轮次。',
        parameters: {
          type: 'object',
          properties: {
            paths: {
              type: 'array',
              items: { type: 'string' },
              description: '要检查的相对路径数组，例如 ["mc-server", "mc-server/server.properties", "mc-server/logs"]',
            },
            maxBytes: {
              type: 'number',
              description: `每个文件最多读取的字节数，默认 ${MAX_INSPECT_BYTES}`,
            },
          },
          required: ['paths'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'server_control',
        description: '直接控制 Minecraft 服务器进程：启动、停止、重启或查看状态。stop/restart 会触发高危确认。',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['start', 'stop', 'restart', 'status'],
              description: '要执行的服务器控制动作',
            },
          },
          required: ['action'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'broadcast_reply',
        description: '以 [Agent] 前缀在服务器公共聊天区广播消息，所有玩家可见。用于回复游戏内 @agent 请求。',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: '要广播的消息内容（会自动加上 [Agent] 前缀）',
            },
          },
          required: ['message'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'server_properties',
        description: '读取或修改 Minecraft 服务器的 server.properties 配置文件。不传 value 则为读取，传 value 则为修改指定属性。',
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: '属性名，如 "max-players"、"gamemode"、"motd" 等。留空则读取全部属性。',
            },
            value: {
              type: 'string',
              description: '要设置的属性值。不传则读取当前值。',
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'backup_world',
        description: '备份 Minecraft 服务器的世界存档到 mc-server/backups/ 目录，按时间戳命名。',
        parameters: {
          type: 'object',
          properties: {
            worldName: {
              type: 'string',
              description: '要备份的世界文件夹名称（默认 "world"）',
            },
          },
        },
      },
    },
  ];
}

/**
 * Tool executor.
 * @param {string} toolName
 * @param {object} args
 * @param {object} context - { serverManager, terminalManager, fileGuard, config }
 */
async function executeTool(toolName, args, context) {
  const { serverManager, terminalManager, fileGuard, config, onConfirm } = context;

  switch (toolName) {
    case 'execute_mc_command': {
      if (!args.command) {
        return { success: false, error: '缺少 command 参数' };
      }
      const cmd = args.command.replace(/^\/+/, '');
      const cmdBase = cmd.split(' ')[0].toLowerCase();

      // High-risk command confirmation flow.
      if (isDangerousCommand(cmd)) {
        if (onConfirm) {
          const confirmed = await onConfirm({
            command: cmd,
            reason: DANGEROUS_COMMANDS.has(cmdBase)
              ? `"${cmd}" 属于高危操作（如停止服务器、修改白名单等），可能影响服务器运行。`
              : `"${cmd}" 可能有破坏性影响。`,
          });
          if (!confirmed) {
            return {
              success: false,
              error: `⚠ 高危命令 "${cmd}" 已被拒绝。如需执行，请在确认提示中选择"继续执行"。`,
              confirmationDenied: true,
            };
          }
        }
      }

      const sent = serverManager.sendCommand(cmd);
      if (!sent) {
        return { success: false, error: '服务器未运行，无法执行命令' };
      }
      // Wait briefly to collect command output.
      await new Promise(r => setTimeout(r, 1500));
      const recent = terminalManager.getRecentLines(10);
      return { success: true, command: cmd, recentOutput: recent };
    }

    case 'get_server_status': {
      const status = serverManager.getStatus();
      const mcVersion = serverManager.getMcVersion();
      return {
        status,
        mcVersion: mcVersion || '未知',
        running: status === 'running',
      };
    }

    case 'list_players': {
      if (serverManager.getStatus() !== 'running') {
        return { success: false, error: '服务器未运行' };
      }
      // Use the list command to fetch online players.
      serverManager.sendCommand('list');
      await new Promise(r => setTimeout(r, 1500));
      const recent = terminalManager.getRecentLines(5);
      // Parse "There are X of a max of Y players online: player1, player2".
      const listLine = recent.find(l => l.includes('There are') && l.includes('players online'));
      return { raw: listLine || '无法获取玩家列表', recentOutput: recent };
    }

    case 'read_server_log': {
      const lines = args.lines || 50;
      return { lines: terminalManager.getRecentLines(lines) };
    }

    case 'read_file': {
      const check = fileGuard.validate(args.path, 'read');
      if (!check.allowed) {
        return { success: false, error: `拒绝访问: ${check.reason}` };
      }
      const content = fs.readFileSync(check.resolvedPath, 'utf-8');
      return { success: true, path: args.path, content };
    }

    case 'write_file': {
      const check = fileGuard.validate(args.path, 'write');
      if (!check.allowed) {
        return { success: false, error: `拒绝写入: ${check.reason}` };
      }
      // Ensure the parent directory exists.
      const parentDir = path.dirname(check.resolvedPath);
      fs.mkdirSync(parentDir, { recursive: true });
      fs.writeFileSync(check.resolvedPath, args.content, 'utf-8');
      return { success: true, path: args.path };
    }

    case 'list_files': {
      const check = fileGuard.validate(args.path || '.', 'read');
      if (!check.allowed) {
        return { success: false, error: `拒绝访问: ${check.reason}` };
      }
      const entries = fs.readdirSync(check.resolvedPath, { withFileTypes: true });
      return {
        success: true,
        files: entries.map(e => ({
          name: e.name,
          type: e.isDirectory() ? 'dir' : 'file',
        })),
      };
    }

    case 'inspect_files': {
      const paths = Array.isArray(args.paths) ? args.paths.slice(0, 12) : [];
      const maxBytes = Math.max(1000, Math.min(Number(args.maxBytes) || MAX_INSPECT_BYTES, 50000));
      if (paths.length === 0) {
        return { success: false, error: '缺少 paths 参数' };
      }

      const results = paths.map(inputPath => {
        const safePath = inputPath || '.';
        const check = fileGuard.validate(safePath, 'read');
        if (!check.allowed) {
          return { path: safePath, success: false, error: `拒绝访问: ${check.reason}` };
        }

        const stat = fs.statSync(check.resolvedPath);
        if (stat.isDirectory()) {
          const entries = fs.readdirSync(check.resolvedPath, { withFileTypes: true }).slice(0, 100);
          return {
            path: safePath,
            success: true,
            type: 'dir',
            files: entries.map(entry => ({
              name: entry.name,
              type: entry.isDirectory() ? 'dir' : 'file',
            })),
            truncated: entries.length >= 100,
          };
        }

        const buffer = fs.readFileSync(check.resolvedPath);
        const slice = buffer.subarray(0, maxBytes);
        return {
          path: safePath,
          success: true,
          type: 'file',
          size: stat.size,
          content: slice.toString('utf-8'),
          truncated: stat.size > slice.length,
        };
      });

      return { success: true, results };
    }

    case 'server_control': {
      const action = args.action || 'status';
      if (action === 'status') {
        return {
          success: true,
          status: serverManager.getStatus(),
          mcVersion: serverManager.getMcVersion() || '未知',
        };
      }

      if (!['start', 'stop', 'restart'].includes(action)) {
        return { success: false, error: `未知服务器控制动作: ${action}` };
      }

      if (['stop', 'restart'].includes(action) && onConfirm) {
        const confirmed = await onConfirm({
          command: `server_control:${action}`,
          reason: `${action} 会影响当前 Minecraft 服务器进程，请确认是否继续。`,
        });
        if (!confirmed) {
          return { success: false, error: '服务器控制已取消', confirmationDenied: true };
        }
      }

      if (action === 'start') {
        await serverManager.start();
      } else if (action === 'stop') {
        await serverManager.stop();
      } else if (action === 'restart') {
        await serverManager.restart();
      }

      return {
        success: true,
        action,
        status: serverManager.getStatus(),
      };
    }

    case 'broadcast_reply': {
      const prefix = config.agent?.replyPrefix || '[Agent]';
      const fullMessage = `say ${prefix} ${args.message}`;
      const sent = serverManager.sendCommand(fullMessage);
      if (!sent) {
        return { success: false, error: '服务器未运行，无法广播' };
      }
      return { success: true, broadcast: args.message };
    }

    case 'server_properties': {
      const serverDir = path.resolve(config.mc?.serverDir || './mc-server');
      const propsPath = path.join(serverDir, 'server.properties');

      // Read mode.
      if (!args.key) {
        if (!fs.existsSync(propsPath)) {
          return { success: false, error: 'server.properties 文件不存在' };
        }
        const check = fileGuard.validate(propsPath, 'read');
        if (!check.allowed) {
          return { success: false, error: `拒绝访问: ${check.reason}` };
        }
        const content = fs.readFileSync(check.resolvedPath, 'utf-8');
        const properties = {};
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            properties[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
          }
        }
        return { success: true, properties };
      }

      // Read the current value when only key is provided.
      if (args.value === undefined || args.value === null) {
        if (!fs.existsSync(propsPath)) {
          return { success: false, error: 'server.properties 文件不存在' };
        }
        const check = fileGuard.validate(propsPath, 'read');
        if (!check.allowed) {
          return { success: false, error: `拒绝访问: ${check.reason}` };
        }
        const content = fs.readFileSync(check.resolvedPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith(args.key + '=')) {
            return { success: true, key: args.key, value: trimmed.slice(args.key.length + 1) };
          }
        }
        return { success: false, error: `属性 "${args.key}" 不存在` };
      }

      // Write mode.
      const writeCheck = fileGuard.validate(propsPath, 'write');
      if (!writeCheck.allowed) {
        return { success: false, error: `拒绝写入: ${writeCheck.reason}` };
      }

      let content = '';
      if (fs.existsSync(propsPath)) {
        content = fs.readFileSync(propsPath, 'utf-8');
      }

      const newLine = `${args.key}=${args.value}`;
      const lines = content.split('\n');
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith(args.key + '=')) {
          lines[i] = newLine;
          found = true;
          break;
        }
      }
      if (!found) {
        lines.push(newLine);
      }

      fs.writeFileSync(propsPath, lines.join('\n'), 'utf-8');
      return { success: true, key: args.key, value: args.value, action: found ? 'updated' : 'added' };
    }

    case 'backup_world': {
      const serverDir = path.resolve(config.mc?.serverDir || './mc-server');
      const worldName = args.worldName || 'world';
      const worldPath = path.join(serverDir, worldName);

      if (!fs.existsSync(worldPath)) {
        return { success: false, error: `世界目录 "${worldName}" 不存在` };
      }

      const outputDir = path.join(serverDir, 'backups');
      fs.mkdirSync(outputDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupName = `${worldName}-backup-${timestamp}`;
      const backupPath = path.join(outputDir, backupName);

      // Recursively copy the directory.
      fs.cpSync(worldPath, backupPath, { recursive: true });

      // Calculate backup size.
      let totalSize = 0;
      const countSize = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            countSize(fullPath);
          } else {
            totalSize += fs.statSync(fullPath).size;
          }
        }
      };
      countSize(backupPath);

      const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      return {
        success: true,
        backupName,
        backupPath: `mc-server/backups/${backupName}`,
        sizeMB: parseFloat(sizeMB),
        message: `世界 "${worldName}" 已备份到 mc-server/backups/${backupName}（${sizeMB} MB）`,
      };
    }

    default:
      return { success: false, error: `未知工具: ${toolName}` };
  }
}

module.exports = {
  getToolDefinitions,
  executeTool,
  isDangerousCommand,
  DANGEROUS_COMMANDS,
};
