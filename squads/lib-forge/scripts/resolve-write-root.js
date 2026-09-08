"use strict";

const DEFAULT_THIS_REPO = "../victor-libs/";

function trim(value) {
  if (value == null) {
    return "";
  }
  return String(value).trim();
}

function resolveWriteRoot(opts = {}) {
  const destination = trim(opts.destination);
  if (destination) {
    return { root: destination, source: "destination", mustAsk: false };
  }

  const env = trim(
    Object.prototype.hasOwnProperty.call(opts, "env")
      ? opts.env
      : process.env.LIB_FORGE_WRITE_ROOT,
  );
  if (env) {
    return { root: env, source: "env", mustAsk: false };
  }

  if (opts.foreign === true) {
    return { root: null, source: "unset", mustAsk: true };
  }

  return {
    root: trim(opts.repoDefault) || DEFAULT_THIS_REPO,
    source: "default",
    mustAsk: false,
  };
}

module.exports = { resolveWriteRoot, DEFAULT_THIS_REPO };

if (require.main === module) {
  const args = process.argv.slice(2);
  const foreign = args.includes("--foreign");
  const destination = args.find((arg) => arg !== "--foreign");
  const result = resolveWriteRoot({ destination, foreign });
  if (result.mustAsk) {
    console.error(
      "WRITE_ROOT unset. Pass destination or set LIB_FORGE_WRITE_ROOT.",
    );
    process.exit(2);
  }
  process.stdout.write(`${result.root}\n`);
}
