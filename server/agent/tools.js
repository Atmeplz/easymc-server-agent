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
        description: '向 Minecraft 服务器控制台发送命令并获取输出。用于执行游戏命令（如 gamemode、give、tp、weather、list 等）或服务器管理命令。',
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
        name: 'server_manager',
        description: '统一管理 Minecraft 服务器：查看状态、启动、停止或重启。stop/restart 会触发高危确认。',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['status', 'start', 'stop', 'restart'],
              description: '操作类型：status（查看状态）、start（启动）、stop（停止）、restart（重启）',
            },
          },
          required: ['action'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'file_manager',
        description: '统一管理项目工作区内的文件与日志：读取服务器终端日志、读取文件、写入文件、列出目录、批量检查多个路径。通过 action 参数选择具体操作。',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['read_log', 'read_file', 'write_file', 'list_files', 'inspect_files'],
              description: '操作类型：read_log（读日志）、read_file（读文件）、write_file（写文件）、list_files（列目录）、inspect_files（批量检查）',
            },
            path: {
              type: 'string',
              description: '文件或目录路径（用于 read_file / write_file / list_files）',
            },
            content: {
              type: 'string',
              description: '要写入的文件内容（用于 write_file）',
            },
            paths: {
              type: 'array',
              items: { type: 'string' },
              description: '要批量检查的路径数组（用于 inspect_files）',
            },
            lines: {
              type: 'number',
              description: '读取日志的最近行数（用于 read_log，默认 50）',
            },
            maxBytes: {
              type: 'number',
              description: '每个文件最多读取的字节数（用于 inspect_files，默认 12000）',
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

      // Record the history length before sending so we can capture only new lines.
      const historyBefore = terminalManager.getHistory().length;
      const sent = serverManager.sendCommand(cmd);
      if (!sent) {
        return { success: false, error: '服务器未运行，无法执行命令' };
      }
      // Poll for new output — up to 2 seconds, checking every 100ms.
      const output = [];
      const deadline = Date.now() + 2000;
      let lastLen = historyBefore;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 100));
        const curHistory = terminalManager.getHistory();
        if (curHistory.length > lastLen) {
          for (let i = lastLen; i < curHistory.length; i++) {
            const line = curHistory[i];
            // Skip the command echo line that sendCommand adds.
            if (!line.startsWith(`> ${cmd}`)) {
              output.push(line);
            }
          }
          lastLen = curHistory.length;
        }
        // Stop early once we have meaningful feedback.
        if (output.length >= 3) break;
      }
      return { success: true, command: cmd, recentOutput: output.slice(-10) };
    }

    case 'server_manager': {
      const action = args.action || 'status';
      if (action === 'status') {
        const status = serverManager.getStatus();
        const mcVersion = serverManager.getMcVersion();
        return {
          success: true,
          status,
          mcVersion: mcVersion || '未知',
          running: status === 'running',
        };
      }

      if (!['start', 'stop', 'restart'].includes(action)) {
        return { success: false, error: `未知服务器操作: ${action}` };
      }

      if (['stop', 'restart'].includes(action) && onConfirm) {
        const confirmed = await onConfirm({
          command: `server_manager:${action}`,
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
    case 'file_manager': {
      const action = args.action;
      switch (action) {
        case 'read_log': {
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

        default:
          return { success: false, error: `未知的文件操作: ${action}` };
      }
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
      if (fs.existsSync(writeCheck.resolvedPath)) {
        content = fs.readFileSync(writeCheck.resolvedPath, 'utf-8');
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

      // Always write to the validated resolved path, not the raw input path.
      fs.writeFileSync(writeCheck.resolvedPath, lines.join('\n'), 'utf-8');
      return { success: true, key: args.key, value: args.value, action: found ? 'updated' : 'added' };
    }

    case 'backup_world': {
      const serverDir = path.resolve(config.mc?.serverDir || './mc-server');
      const worldName = args.worldName || 'world';
      const worldPath = path.join(serverDir, worldName);

      if (!fs.existsSync(worldPath)) {
        return { success: false, error: `世界目录 "${worldName}" 不存在` };
      }

      // If the server is running, flush world data to disk before copying
      // to avoid capturing a partially-written chunk.
      if (serverManager && serverManager.getStatus() === 'running') {
        serverManager.sendCommand('save-all');
        // Wait for the save to complete.
        await new Promise(r => setTimeout(r, 2000));
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
