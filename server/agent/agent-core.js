/*
 * AI maintenance note: Keep all code comments in English.
 */
const OpenAI = require('openai');
const { getToolDefinitions, executeTool } = require('./tools');
const { getAdminPrompt, getPlayerPrompt } = require('./prompts');
const { checkPermission, PLAYER_BLACKLIST } = require('../permissions/rules');

class AgentInterruptedError extends Error {
  constructor() {
    super('Agent run interrupted by user');
    this.name = 'AgentInterruptedError';
    this.code = 'AGENT_INTERRUPTED';
  }
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new AgentInterruptedError();
}

class AgentCore {
  constructor(config, managers) {
    this.config = config;
    this.serverManager = managers.serverManager;
    this.terminalManager = managers.terminalManager;
    this.fileGuard = managers.fileGuard;
    this.client = null;
    this.tools = getToolDefinitions();
    this.conversationHistory = [];
    this.initClient();
  }

  initClient() {
    const aiConfig = this.config.ai;
    if (!aiConfig?.apiKey) {
      console.warn('[AgentCore] AI API key is not configured. Agent features are disabled.');
      this.client = null;
      return;
    }

    this.client = new OpenAI({
      apiKey: aiConfig.apiKey,
      baseURL: aiConfig.baseUrl || 'https://api.openai.com/v1',
    });

    console.log(`[AgentCore] Initialized with model: ${aiConfig.model}`);
  }

  isAvailable() {
    return this.client !== null;
  }

  getContext(onConfirm) {
    return {
      serverManager: this.serverManager,
      terminalManager: this.terminalManager,
      fileGuard: this.fileGuard,
      config: this.config,
      onConfirm: onConfirm || null,
    };
  }

  async chat(userMessage, onStream, onConfirm, options = {}) {
    if (!this.isAvailable()) {
      return {
        reply: 'AI Agent is not configured. Add an API key in settings or config.local.json.',
        toolCalls: [],
      };
    }

    const externalHistory = Array.isArray(options.history) ? options.history : null;
    const signal = options.signal || null;
    const maxToolRounds = Number(this.config.agent?.maxToolRounds) || 50;

    if (!externalHistory) {
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });
    }

    const messages = [
      { role: 'system', content: getAdminPrompt(this.config) },
      ...(externalHistory || this.conversationHistory).slice(-20),
    ];

    const toolCallsLog = [];
    const context = this.getContext(onConfirm);
    const usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
    const addUsage = (nextUsage) => {
      if (!nextUsage) return;
      usage.prompt_tokens += Number(nextUsage.prompt_tokens || 0);
      usage.completion_tokens += Number(nextUsage.completion_tokens || 0);
      usage.total_tokens += Number(nextUsage.total_tokens || 0);
    };

    try {
      for (let round = 0; round < maxToolRounds; round += 1) {
        throwIfAborted(signal);

        const response = await this._callWithRetry(() =>
          this.client.chat.completions.create({
            model: this.config.ai.model,
            messages,
            tools: this.tools,
            tool_choice: 'auto',
            temperature: this.config.ai.temperature || 0.7,
            max_tokens: this.config.ai.maxTokens || 2048,
          }, signal ? { signal } : undefined)
        );

        throwIfAborted(signal);
        addUsage(response.usage);

        const choice = response.choices?.[0];
        if (!choice) break;

        const assistantMessage = choice.message;
        if (assistantMessage.tool_calls?.length) {
          messages.push(assistantMessage);

          for (const toolCall of assistantMessage.tool_calls) {
            throwIfAborted(signal);

            const funcName = toolCall.function.name;
            let funcArgs;
            try {
              funcArgs = JSON.parse(toolCall.function.arguments);
            } catch {
              funcArgs = {};
            }

            console.log(`[AgentCore] Tool call: ${funcName}`, funcArgs);
            toolCallsLog.push({ tool: funcName, args: funcArgs });
            onStream?.({ type: 'tool_call', tool: funcName, args: funcArgs });

            const result = await executeTool(funcName, funcArgs, context);
            throwIfAborted(signal);

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          }

          continue;
        }

        const reply = assistantMessage.content || '';
        if (!externalHistory) {
          this.conversationHistory.push({
            role: 'assistant',
            content: reply,
          });
        }

        return { reply, toolCalls: toolCallsLog, usage };
      }

      return {
        reply: `The operation ran ${toolCallsLog.length} tool call(s), but the Agent reached the maximum loop limit. Try splitting the task into smaller steps.`,
        toolCalls: toolCallsLog,
        usage,
      };
    } catch (error) {
      if (error?.code === 'AGENT_INTERRUPTED' || error?.name === 'AbortError') {
        return {
          reply: 'Agent run stopped by user.',
          toolCalls: toolCallsLog,
          usage,
          interrupted: true,
        };
      }

      console.error('[AgentCore] Chat failed:', error.message);

      if (error.status === 401) {
        return { reply: 'API key is invalid. Please check the configuration.', toolCalls: [] };
      }
      if (error.status === 429) {
        return { reply: 'API rate limit reached. Please try again later.', toolCalls: [] };
      }

      return { reply: `AI call failed: ${error.message}`, toolCalls: [] };
    }
  }

  async handlePlayerRequest(playerName, request, permission) {
    if (!this.isAvailable()) {
      return {
        reply: 'AI is not online yet.',
        executed: false,
        commands: [],
        denied: true,
        reason: 'Agent is not configured',
      };
    }

    const messages = [
      { role: 'system', content: getPlayerPrompt(playerName, permission.level, permission.description, this.config) },
      { role: 'user', content: request },
    ];

    const executedCommands = [];
    const onConfirmPlayer = async ({ command }) => {
      const prefix = this.config.agent?.replyPrefix || '[Agent]';
      this.serverManager.sendCommand(`say ${prefix}: Dangerous task "${command}" needs server admin approval.`);
      return false;
    };
    const context = this.getContext(onConfirmPlayer);

    try {
      for (let round = 0; round < 3; round += 1) {
        const response = await this._callWithRetry(() =>
          this.client.chat.completions.create({
            model: this.config.ai.model,
            messages,
            tools: this.tools,
            tool_choice: 'auto',
            temperature: 0.5,
            max_tokens: 256,
          })
        );

        const choice = response.choices?.[0];
        if (!choice) break;

        const assistantMessage = choice.message;
        if (assistantMessage.tool_calls?.length) {
          messages.push(assistantMessage);

          for (const toolCall of assistantMessage.tool_calls) {
            const funcName = toolCall.function.name;
            let funcArgs;
            try {
              funcArgs = JSON.parse(toolCall.function.arguments);
            } catch {
              funcArgs = {};
            }

            if (funcName === 'execute_mc_command') {
              const cmd = (funcArgs.command || '').replace(/^\/+/, '');
              const cmdBase = cmd.split(' ')[0];

              if (PLAYER_BLACKLIST.includes(cmdBase)) {
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({
                    success: false,
                    error: 'This operation must be run by an administrator from the server console.',
                  }),
                });
                continue;
              }

              const permCheck = checkPermission(cmd, permission);
              if (!permCheck.allowed) {
                messages.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({
                    success: false,
                    error: `Permission denied: ${permCheck.reason}`,
                  }),
                });
                continue;
              }

              executedCommands.push(cmd);
            }

            if (funcName === 'server_manager' && funcArgs.action !== 'status') {
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  error: '玩家只能查看服务器状态，不能执行启动/停止/重启操作。',
                }),
              });
              continue;
            }

            if (funcName === 'broadcast_reply') {
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  error: 'Player chat is already broadcast by the server. Do not call broadcast_reply.',
                }),
              });
              continue;
            }

            if (['file_manager', 'server_properties'].includes(funcName)) {
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  error: 'Players cannot use file-management tools.',
                }),
              });
              continue;
            }

            const result = await executeTool(funcName, funcArgs, context);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          }

          continue;
        }

        let reply = assistantMessage.content || '';
        const maxLen = this.config.agent?.maxResponseLength || 30;
        if (reply.length > maxLen) {
          reply = `${reply.slice(0, maxLen - 3)}...`;
        }

        return {
          reply,
          executed: executedCommands.length > 0,
          commands: executedCommands,
          denied: false,
        };
      }

      return {
        reply: 'Request processed.',
        executed: executedCommands.length > 0,
        commands: executedCommands,
        denied: false,
      };
    } catch (error) {
      console.error('[AgentCore] Player request failed:', error.message);
      return {
        reply: 'AI had a problem. Please try again later.',
        executed: false,
        commands: [],
        denied: true,
        reason: error.message,
      };
    }
  }

  async _callWithRetry(apiCall) {
    const maxRetries = 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        if (error?.name === 'AbortError' || error?.code === 'AGENT_INTERRUPTED') {
          throw error;
        }

        const isRetryable = !error.status || error.status >= 500
          || error.status === 429 || error.code === 'ECONNRESET'
          || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND';

        console.warn(`[AgentCore] API call failed (${attempt}/${maxRetries}): ${error.message}`);

        if (!isRetryable || attempt >= maxRetries) {
          throw error;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  reinit() {
    this.conversationHistory = [];
    this.initClient();
  }
}

module.exports = AgentCore;
