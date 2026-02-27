#!/usr/bin/env node

/**
 * RAG simples por keyword para uso em n8n Function/Code node e via CLI.
 *
 * Input: query string + indice da KB
 * Output: top trechos relevantes (ate 3) ou null quando baixa confianca
 */

const fs = require('fs');
const path = require('path');

const PT_STOPWORDS = new Set([
  'a', 'ao', 'aos', 'as', 'ate', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'era',
  'essa', 'esse', 'esta', 'estao', 'eu', 'foi', 'ja', 'la', 'mas', 'me', 'mesmo', 'minha', 'na',
  'nas', 'nao', 'nem', 'no', 'nos', 'o', 'os', 'ou', 'para', 'pela', 'pelas', 'pelo', 'pelos',
  'por', 'pra', 'que', 'se', 'sem', 'ser', 'sua', 'suo', 'suas', 'te', 'tem', 'ter', 'um', 'uma',
  'umas', 'uns', 'voces', 'voce'
]);

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(' ')
    .filter((token) => token.length > 1 && !PT_STOPWORDS.has(token));
}

function buildEntryLexicon(entry) {
  const contentTokens = tokenize(entry.content || '');
  const sectionTokens = tokenize(entry.section || '');
  const keywordTokens = (entry.keywords || []).flatMap((k) => tokenize(k));

  return {
    ...entry,
    _contentTokens: new Set(contentTokens),
    _sectionTokens: new Set(sectionTokens),
    _keywordTokens: new Set(keywordTokens),
    _normalizedContent: normalizeText(entry.content || '')
  };
}

function scoreEntry(queryTokens, normalizedQuery, entry) {
  let score = 0;

  for (const token of queryTokens) {
    if (entry._keywordTokens.has(token)) score += 5;
    if (entry._sectionTokens.has(token)) score += 3;
    if (entry._contentTokens.has(token)) score += 2;
  }

  if (normalizedQuery && entry._normalizedContent.includes(normalizedQuery)) {
    score += 8;
  }

  return score;
}

function searchKB(query, kbIndex, options = {}) {
  const minScore = Number.isFinite(options.minScore) ? options.minScore : 6;
  const maxResults = Number.isFinite(options.maxResults) ? options.maxResults : 3;

  if (!kbIndex || !Array.isArray(kbIndex.entries)) {
    throw new Error('kbIndex invalido: esperado objeto com entries[]');
  }

  const queryTokens = tokenize(query);
  const normalizedQuery = normalizeText(query);

  if (queryTokens.length === 0) {
    return {
      query,
      tokens: [],
      matches: [],
      bestScore: 0,
      confident: false
    };
  }

  const scored = kbIndex.entries
    .map(buildEntryLexicon)
    .map((entry) => ({
      source: entry.source,
      section: entry.section,
      content: entry.content,
      keywords: entry.keywords || [],
      score: scoreEntry(queryTokens, normalizedQuery, entry)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, maxResults);
  const bestScore = top[0]?.score || 0;

  return {
    query,
    tokens: queryTokens,
    matches: top,
    bestScore,
    confident: bestScore >= minScore
  };
}

function formatContext(result) {
  if (!result.confident || result.matches.length === 0) return null;

  return result.matches
    .map((m, idx) => `[${idx + 1}] (${m.source} :: ${m.section})\n${m.content}`)
    .join('\n\n');
}

function loadDefaultIndex() {
  const filePath = path.join(__dirname, 'kb-index.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

async function runCli() {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('Uso: node data/rag/search-kb.js "pergunta do cliente"');
    process.exit(1);
  }

  const kbIndex = loadDefaultIndex();
  const result = searchKB(query, kbIndex);
  const context = formatContext(result);

  console.log(JSON.stringify({ ...result, context }, null, 2));
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  tokenize,
  searchKB,
  formatContext,
  loadDefaultIndex
};
