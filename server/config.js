/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * EasyMC Server Agent - default configuration.
 * Users can override these defaults with config.local.json.
 */
module.exports = {
  port: 3000,

  mc: {
    serverDir: './mc-server',
    jarFile: 'server.jar',
    jvmArgs: ['-Xmx2G', '-Xms1G'],
  },

  ai: {
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2048,
  },

  terminal: {
    historySize: 5000,
    logToFile: true,
  },

  agent: {
    enabled: true,
    trigger: '@agent',
    replyPrefix: '[Agent]',
    maxResponseLength: 60,
    requireApproval: false,
    approvalTimeout: 30000,
    maxToolRounds: 50,
    logAllInteractions: true,
    blockedCommands: [
      'op', 'deop', 'ban', 'pardon',
      'stop', 'whitelist off', 'reload',
    ],
    chatRegex: '^<(\\w{1,16})>\\s+(.+)',
  },

  prompts: {
    admin: '',
    player: '',
  },

  deploy: {
    preferredMirror: 'auto',
    downloadTimeout: 30000,
    autoAcceptEula: true,
  },

  download: {
    enabledSources: ['modrinth', 'core'],
    curseForgeApiKey: process.env.CURSEFORGE_API_KEY || '',
    userAgent: 'EasyMC_Server_Agent/1.0',
    cacheTtlMs: 5 * 60 * 1000,
    maxConcurrentDownloads: 2,
  },

  java: {
    runtimeDir: './java-runtime',
    versionMap: {
      '26.1+': 25,
      '1.20.5-1.21.11': 21,
      '1.18-1.20.4': 17,
      '1.17-1.17.1': 17,
      '1.16.5-': 8,
    },
    adoptiumApiBase: 'https://api.adoptium.net/v3',
  },
};
