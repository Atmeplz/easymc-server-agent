/*
 * AI maintenance note: Keep all code comments in English.
 */
/**
 * Permission Rules - player permission rule definitions.
 * OP-level permission system based on Minecraft ops.json.
 */

// Command permission level mapping.
const COMMAND_RULES = {
  QUERY: {
    level: 0,
    commands: new Set(['list', 'time query', 'weather', 'seed', 'difficulty', 'help', 'me']),
    description: '查询类操作，所有玩家可用',
  },
  BASIC: {
    level: 1,
    commands: new Set(['spawnpoint', 'setworldspawn', 'tp', 'teleport']),
    description: '基础操作，需要 OP 1+',
  },
  GAMEPLAY: {
    level: 2,
    commands: new Set([
      'gamemode', 'give', 'effect', 'summon', 'fill', 'clear', 'kill',
      'enchant', 'xp', 'experience', 'attribute',
    ]),
    description: '游戏操作，需要 OP 2+',
  },
  ADMIN: {
    level: 3,
    commands: new Set([
      'ban', 'kick', 'pardon', 'whitelist', 'say', 'tell', 'msg',
      'title', 'bossbar', 'scoreboard', 'team',
    ]),
    description: '管理命令，需要 OP 3+',
  },
  DANGEROUS: {
    level: 4,
    commands: new Set(['stop', 'save-off', 'save-on', 'reload', 'defaultgamemode', 'gamerule']),
    description: '危险命令，需要 OP 4+',
  },
};

// Commands that players may never trigger through @agent.
// The list contains both exact commands ('save-off') and command prefixes
// ('whitelist off'). Matching logic below handles both forms.
const PLAYER_BLACKLIST = new Set([
  'op', 'deop', 'ban', 'pardon', 'stop', 'whitelist off', 'reload',
  'save-off', 'defaultgamemode',
]);

/**
 * Check whether a command string matches a blacklist entry.
 * Exact commands are matched exactly. Multi-word entries such as
 * 'whitelist off' are matched by comparing the first N words of the
 * input command, where N is the number of words in the entry.
 */
function isBlacklisted(command) {
  const normalized = command.trim().toLowerCase();
  for (const entry of PLAYER_BLACKLIST) {
    if (entry === normalized) return true;
    const entryWords = entry.split(' ');
    if (entryWords.length > 1) {
      const inputWords = normalized.split(' ').slice(0, entryWords.length);
      if (inputWords.join(' ') === entry) return true;
    }
  }
  return false;
}

/**
 * Check whether a player may execute a command.
 * @param {string} command - Command string without a leading slash.
 * @param {object} playerPermission - { level, isOp, description }
 * @returns {{ allowed: boolean, reason?: string }}
 */
function checkPermission(command, playerPermission) {
  const normalized = (command || '').replace(/^\/+/, '').trim().toLowerCase();
  const cmdBase = normalized.split(' ')[0];

  // The blacklist is always denied.
  if (isBlacklisted(normalized)) {
    return { allowed: false, reason: '该操作需要管理员在控制台执行' };
  }

  // Match rules in order.
  for (const [, rule] of Object.entries(COMMAND_RULES)) {
    if (rule.commands.has(cmdBase)) {
      if (playerPermission.level >= rule.level) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `需要 OP ${rule.level}+（当前等级: ${playerPermission.level}）`,
      };
    }
  }

  // Unmatched commands require OP 2+ by default.
  return {
    allowed: playerPermission.level >= 2,
    reason: '未知命令，需要 OP 2+',
  };
}

module.exports = {
  COMMAND_RULES,
  PLAYER_BLACKLIST,
  checkPermission,
  isBlacklisted,
};
