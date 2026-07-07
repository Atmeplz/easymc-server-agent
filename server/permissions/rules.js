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
    commands: ['list', 'time query', 'weather', 'seed', 'difficulty', 'help', 'me'],
    description: '查询类操作，所有玩家可用',
  },
  BASIC: {
    level: 1,
    commands: ['spawnpoint', 'setworldspawn', 'tp', 'teleport'],
    description: '基础操作，需要 OP 1+',
  },
  GAMEPLAY: {
    level: 2,
    commands: [
      'gamemode', 'give', 'effect', 'summon', 'fill', 'clear', 'kill',
      'enchant', 'xp', 'experience', 'attribute',
    ],
    description: '游戏操作，需要 OP 2+',
  },
  ADMIN: {
    level: 3,
    commands: [
      'ban', 'kick', 'pardon', 'whitelist', 'say', 'tell', 'msg',
      'title', 'bossbar', 'scoreboard', 'team',
    ],
    description: '管理命令，需要 OP 3+',
  },
  DANGEROUS: {
    level: 4,
    commands: ['stop', 'save-off', 'save-on', 'reload', 'defaultgamemode', 'gamerule'],
    description: '危险命令，需要 OP 4+',
  },
};

// Commands that players may never trigger through @agent.
const PLAYER_BLACKLIST = [
  'op', 'deop', 'ban', 'pardon', 'stop', 'whitelist off', 'reload',
  'save-off', 'defaultgamemode',
];

/**
 * Check whether a player may execute a command.
 * @param {string} command - Command string without a leading slash.
 * @param {object} playerPermission - { level, isOp, description }
 * @returns {{ allowed: boolean, reason?: string }}
 */
function checkPermission(command, playerPermission) {
  const cmdBase = command.split(' ')[0].toLowerCase();

  // The blacklist is always denied.
  if (PLAYER_BLACKLIST.includes(cmdBase)) {
    return { allowed: false, reason: '该操作需要管理员在控制台执行' };
  }

  // Match rules in order.
  for (const [, rule] of Object.entries(COMMAND_RULES)) {
    if (rule.commands.includes(cmdBase)) {
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
};
