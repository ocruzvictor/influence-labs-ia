# MCP Ecosystem presets (AIOX)

Fonte: [SynkraAI/mcp-ecosystem](https://github.com/SynkraAI/mcp-ecosystem).
Este projeto **não substitui** o `.cursor/mcp.json` de produção (Tess + MCP_DOCKER).

## Presets oficiais

| Preset | Servers | Tokens | Chave | Uso aqui |
|--------|---------|--------|-------|----------|
| `aios-dev` | context7, desktop-commander, playwright | 25–40k | não | stories / PRs |
| `aios-research` | context7, exa, playwright | 40–60k | `EXA_API_KEY` | docs Syncra / pesquisa |
| `aios-full` | todos | 60–80k | Exa | evitar no dia a dia Tess |

## O que já está ativo

`.cursor/mcp.json` continua com:

- `tess` — MCP remoto Tess (obrigatório para ops)
- `MCP_DOCKER` — gateway Docker

## Como ligar um preset (manual)

1. Copie o server de `.cursor/mcp-presets/servers/<nome>.json`.
2. Mescle em `.cursor/mcp.json` **sem remover** `tess` / `MCP_DOCKER`.
3. Reinicie o Cursor MCP.

**Não ligue `desktop-commander` sem necessidade** — acesso amplo a filesystem/terminal.

`playwright` oficial do preset sobrepõe em parte o browser nativo do Cursor. Só ative se precisar do MCP Anthropic.

## Exa

```bash
export EXA_API_KEY=...
```

Depois adicione o bloco de `.cursor/mcp-presets/servers/exa.json`.
