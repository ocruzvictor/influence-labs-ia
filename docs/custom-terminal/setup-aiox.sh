#!/bin/bash
# Setup AIOX + Claude Code para macOS M1

echo "🚀 Instalando AIOX + Claude Code customizado..."

# 1. Roboto Mono
if ! fc-list | grep -q "Roboto Mono"; then
    echo "🎨 Instalando Roboto Mono..."
    brew tap homebrew/cask-fonts
    brew install --cask font-roboto-mono
fi

# 2. Config
echo "📋 Copiando configuração..."
CONFIG_DIR="$HOME/Library/Application Support/Claude Code"
mkdir -p "$CONFIG_DIR"
cp aiox-claude-code-config.json "$CONFIG_DIR/"

# 3. .zshrc
echo "⚡ Adicionando ao .zshrc..."
cat aiox-zshrc-additions.sh >> ~/.zshrc

echo "✅ Setup completo!"
echo "→ Abra Claude Code e importe aiox-claude-code-config.json em Settings"
