# MCP Ecosystem

> MCP Tools and Configurations for AIOS

## Overview

This repository contains Model Context Protocol (MCP) server configurations, presets, and IDE configurations for use with AIOS and Claude Code.

## Structure

```
mcp-ecosystem/
├── presets/           # Preset configurations
│   ├── aios-dev.json      # Development preset
│   ├── aios-research.json # Research preset
│   └── aios-full.json     # Full preset
├── servers/           # MCP server configurations
│   ├── context7.json
│   ├── desktop-commander.json
│   ├── playwright.json
│   └── exa.json
└── ide-configs/       # IDE-specific configurations
    ├── claude/
    └── cursor/
```

## Presets

| Preset | MCPs | Token Budget | Use For |
|--------|------|--------------|---------|
| **aios-dev** | context7, desktop-commander, playwright | ~25-40k | Story implementation, PRs |
| **aios-research** | context7, exa, playwright | ~40-60k | Research, documentation |
| **aios-full** | All configured | ~60-80k | Complex multi-domain tasks |

## Quick Start

### Claude Code

Copy the sample configuration to your Claude Code config:

```bash
# View sample config
cat ide-configs/claude/sample-config.json

# Apply (merge with your existing ~/.claude.json)
```

### Cursor

Copy the sample configuration to your Cursor settings:

```bash
# View sample config
cat ide-configs/cursor/sample-config.json

# Apply to .cursor/settings.json
```

## Available MCP Servers

### context7
Up-to-date library documentation for LLMs.
- **Type:** SSE
- **API Key Required:** No

### desktop-commander
File management, terminal commands, and system operations.
- **Type:** stdio
- **API Key Required:** No

### playwright
Browser automation for testing and web interaction.
- **Type:** stdio
- **API Key Required:** No

### exa
AI-powered web search and content extraction.
- **Type:** stdio
- **API Key Required:** Yes (EXA_API_KEY)

## Documentation

For detailed documentation, visit [AIOS Core Discussions](https://github.com/allfluence/aios-core/discussions).

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/allfluence/aios-core/blob/main/CONTRIBUTING.md).

## License

Apache 2.0 License - see [LICENSE](./LICENSE)

---

Part of the [AIOS Framework](https://github.com/allfluence/aios-core)
