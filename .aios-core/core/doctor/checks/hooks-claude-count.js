/**
 * Doctor Check: Hooks Claude Count
 *
 * Counts .cjs files in .claude/hooks/ and verifies registration
 * in settings.local.json.
 * PASS: >=2 + all registered, WARN: files present but not registered or <2,
 * FAIL: 0 or directory missing.
 *
 * @module aios-core/doctor/checks/hooks-claude-count
 * @story INS-4.8
 */

const path = require('path');
const fs = require('fs');

const name = 'hooks-claude-count';

async function run(context) {
  const hooksDir = path.join(context.projectRoot, '.claude', 'hooks');

  if (!fs.existsSync(hooksDir)) {
    return {
      check: name,
      status: 'FAIL',
      message: 'Hooks directory not found (.claude/hooks/)',
      fixCommand: 'npx aios-core install --force',
    };
  }

  let entries;
  try {
    entries = fs.readdirSync(hooksDir, { withFileTypes: true });
  } catch {
    return {
      check: name,
      status: 'FAIL',
      message: 'Cannot read hooks directory',
      fixCommand: 'npx aios-core install --force',
    };
  }

  const hookFiles = entries.filter(
    (e) => e.isFile() && e.name.endsWith('.cjs'),
  );
  const hookCount = hookFiles.length;

  if (hookCount === 0) {
    return {
      check: name,
      status: 'FAIL',
      message: 'No hook files found (.cjs)',
      fixCommand: 'npx aios-core install --force',
    };
  }

  // Check registration in settings.local.json
  const settingsLocalPath = path.join(context.projectRoot, '.claude', 'settings.local.json');
  let registered = false;

  if (fs.existsSync(settingsLocalPath)) {
    try {
      const settingsLocal = JSON.parse(fs.readFileSync(settingsLocalPath, 'utf8'));
      const hooks = settingsLocal.hooks || {};
      const allHookCommands = Object.values(hooks).flat().map((h) => {
        if (typeof h === 'string') return h;
        return h.command || h.matcher || '';
      });
      const hooksStr = allHookCommands.join('\n');

      // Check if at least some hook files are referenced in settings
      const referencedCount = hookFiles.filter(
        (f) => hooksStr.includes(f.name) || hooksStr.includes(f.name.replace('.cjs', '')),
      ).length;

      registered = referencedCount > 0;
    } catch {
      registered = false;
    }
  }

  if (hookCount >= 2 && registered) {
    return {
      check: name,
      status: 'PASS',
      message: `${hookCount} hook files found and registered`,
      fixCommand: null,
    };
  }

  if (hookCount >= 2 && !registered) {
    return {
      check: name,
      status: 'WARN',
      message: `${hookCount} hook files found but not registered in settings.local.json`,
      fixCommand: 'npx aios-core install --force',
    };
  }

  return {
    check: name,
    status: 'WARN',
    message: `Only ${hookCount}/2 hook files found`,
    fixCommand: 'npx aios-core install --force',
  };
}

module.exports = { name, run };
