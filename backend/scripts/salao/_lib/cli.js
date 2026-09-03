const fs = require('fs');
const path = require('path');

function loadBackendEnv() {
  const envPath = path.join(__dirname, '..', '..', '..', '.env');
  try {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim();
      }
    });
  } catch {
    // container injeta env
  }
}

function parseArgs(argv = process.argv.slice(2)) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      rest.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return { flags, rest };
}

function requireDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL ausente. Rode no container backend ou exporte a URL.');
  }
  return require('../../../db');
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

module.exports = {
  loadBackendEnv,
  parseArgs,
  requireDb,
  printJson,
};
