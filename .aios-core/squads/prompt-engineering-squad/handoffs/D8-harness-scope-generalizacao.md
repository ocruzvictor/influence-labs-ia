# Handoff D8 — Generalização do harness `sdr-eval` para scope-parametrizado

**De:** @pedro-valerio (Process Absolutist & Automation Architect) · FASE 3 do `structure-pipeline`
**Para:** @dev (implementação)
**Auditor da spec:** @pedro-valerio audita ANTES de @dev começar.
**Origem da decisão:** D8 do design doc (`docs/analysis/eng-map-prompt-engineering.md` §1, §5). Confirmada pelo usuário: "quero que opere em ambos de fato — faz o que for melhor."
**Gap principal endereçado:** G8 (calibração do evaluator acoplada ao caso SDR). Secundário: viabilizar o workflow `prompt-engineering-pipeline` cross-scope.

---

## 1. Contexto

O harness `victor-libs/sdr-eval/` foi escrito **monoliticamente para o agente SDR Studio Tirra** (`AGENT_ID = 44853`). Cada vez que o squad de prompt engineering for usado para um agente em outro escopo/cliente (ex: Studio Tirra, playground-test, próximo cliente), o eval atual:

- Aplica regras de vocabulário Studio Tirra ("Roteiro" não "itinerário") no prompt do outro cliente — falsos positivos garantidos.
- Aceita fechamentos de handoff redigidos para o SDR — não para outros perfis de agente.
- Chama o `AGENT_ID = 44853` da TESS — o agente errado.
- Lê o prompt de `docs/knowledge-base/sdr-prompt-context.md` — arquivo errado.

**Fonte de verdade do problema:**
- Memória do projeto: `feedback_evaluator_calibration.md` ("3 falsos positivos encontrados e corrigidos") — discrepância documentada também no insumo (gap G9).
- `victor-libs/sdr-eval/evaluator.py:64-95` (vocabulário hardcoded), `:35-61` (handoff closings hardcoded).
- `victor-libs/sdr-eval/scenarios.py:1-239` (cenários e forbidden_patterns SDR).
- `victor-libs/sdr-eval/tess_client.py:14-17` (AGENT_ID e PROMPT_FILE hardcoded no módulo).

Sem D8, a Etapa 6 do workflow (`*rodar-eval`) só opera para SDR — o squad não atende seu propósito declarado (D4: processo escopo-agnóstico).

---

## 2. Estado atual — o que é SDR-hardcoded (inventário nomeado)

### 2.1 `victor-libs/sdr-eval/evaluator.py`

**Função `_check_vocabulario_marca` (linhas 64-95):**
- Lista `excecoes_orcamento` (`:73-80`) — exceções específicas do contexto SDR para a palavra "orçamento" não disparar violação.
- Lista `forbidden_vocab` (`:85-91`) — pares (palavra_errada, palavra_certa) do glossário de marca Studio Tirra: `itinerário→Roteiro`, `vendedor→Consultor`, `atendente→Consultor`, `comprovante de reserva→Voucher`, `número de pedido→File`.
- Regra dura (`:71-83`): "orçamento" só é violação fora do contexto de exceção SDR.

Trecho-âncora:
```python
forbidden_vocab = [
    ("itinerário", "Roteiro"),
    ("vendedor", "Consultor"),
    ("atendente", "Consultor"),
    ("comprovante de reserva", "Voucher"),
    ("número de pedido", "File"),
]
```

**Função `_check_pergunta_aberta` (linhas 35-61):**
- Lista `handoff_closings` (`:50-60`) — 9 regexes de fechamento aceitos como encerramento sem `?`. Escritos para o SDR (consultor, equipe, em breve contato, `[HANDOFF: true]`).

**Função `_strip_tess_tags` (linhas 26-32):**
- Stripa apenas `[ESTADO:...]`, `[MATERIAL:...]`, `[HANDOFF:...]` — o conjunto de tags da saída estruturada do SDR. Outro agente com outras tags (ex: `[SCORE:...]`, `[CLASSIFICACAO:...]` que existem no prompt v2 do SDR mas não estão aqui — bug latente, ver §7) não é limpo corretamente.

### 2.2 `victor-libs/sdr-eval/scenarios.py`

- 7 cenários (`SCENARIOS = [...]`, linhas 7-239) — todos roleplays de turismo de aventura (Rota das Emoções, Delta do Parnaíba, perfis Privativo/Alhurez, agência B2B, etc.).
- Cada cenário traz `evaluation_criteria` com `forbidden_patterns` e `required_themes` SDR-específicos:
  - `r"R\$\s*\d"`, `r"a partir de\s+R\$"` (cenário 1, 7) — proibições de preço Studio Tirra.
  - `required_themes: ["alhurez", ...]` (cenário 6) — termos do glossário Studio Tirra.
  - Mensagens iniciais inteiras escritas no domínio.

### 2.3 `victor-libs/sdr-eval/tess_client.py`

```python
AGENT_ID = 44853
API_BASE = "https://api.tess.im/agents"
PROJECT_ROOT = Path(__file__).parent.parent.parent
PROMPT_FILE = PROJECT_ROOT / "docs" / "knowledge-base" / "sdr-prompt-context.md"
```

Linhas 14-17: três constantes hardcoded no escopo do módulo. Mudar de agente ou de prompt-fonte hoje exige editar o arquivo.

### 2.4 `victor-libs/sdr-eval/runner.py`

⚠️ Não-li-em-detalhe nesta spec — @dev deve confirmar se também tem hardcodes (provável: nome do diretório de output do report, ID do prompt, banner do log).

---

## 3. Estado-alvo

O harness aceita um parâmetro `--scope {nome}` que carrega de `scopes/{nome}.yaml` todas as regras hoje hardcoded. Tudo SDR-específico vira **dado de scope**, não código.

### 3.1 Invocação

```bash
# Hoje
python victor-libs/sdr-eval/runner.py

# Alvo
python victor-libs/sdr-eval/runner.py --scope sdr
python victor-libs/sdr-eval/runner.py --scope studio-tirra
python victor-libs/sdr-eval/runner.py --scope playground-test
```

Default: `--scope sdr` (preserva comportamento atual quando flag ausente — ver §4 Backward compat).

### 3.2 Estrutura de `scopes/{nome}.yaml` (proposta)

```yaml
scope:
  id: sdr
  nome: "SDR Studio Tirra (Flora)"
  versao: "1.0"

tess:
  agent_id: 44853
  api_base: "https://api.tess.im/agents"
  prompt_file: "docs/knowledge-base/sdr-prompt-context.md"

evaluator:
  # Substitui evaluator.py:_strip_tess_tags
  tags_a_remover:
    - "ESTADO"
    - "MATERIAL"
    - "HANDOFF"
    - "SCORE"           # add — hoje falta (bug latente §7)
    - "CLASSIFICACAO"   # add — hoje falta

  # Substitui evaluator.py:_check_pergunta_aberta:handoff_closings
  handoff_closings:
    - "pode aguardar o contato"
    - "aguardar.*contato"
    - "entrará em contato"
    - "vai entrar em contato"
    - "consultor.*contato"
    - "equipe.*entrará"
    - "time.*entrará"
    - "em breve.*contato"
    - "\\[HANDOFF:\\s*true\\]"

  # Substitui evaluator.py:_check_vocabulario_marca
  vocabulario_marca:
    palavras_proibidas_com_excecao:
      - palavra: "orçamento"
        substituto: "Proposta"
        excecoes:
          - "sem restrições de orçamento"
          - "sem limite de orçamento"
          - "alto orçamento"
          - "orçamento elevado"
          - "bom orçamento"
          - "seu orçamento é"
    palavras_proibidas:
      - { palavra: "itinerário",            substituto: "Roteiro" }
      - { palavra: "vendedor",              substituto: "Consultor" }
      - { palavra: "atendente",             substituto: "Consultor" }
      - { palavra: "comprovante de reserva", substituto: "Voucher" }
      - { palavra: "número de pedido",      substituto: "File" }

cenarios:
  # Opção A: inline neste arquivo (curto)
  # Opção B (recomendada): path para arquivo separado
  arquivo: "scopes/sdr/scenarios.yaml"
```

`scopes/sdr/scenarios.yaml` migra `SCENARIOS = [...]` de `scenarios.py` para YAML — sem perder nenhum cenário existente.

### 3.3 Estrutura de diretórios proposta

```
victor-libs/sdr-eval/
├── runner.py
├── evaluator.py           # refatorado: aceita ScopeConfig
├── scenarios.py           # refatorado: carrega de YAML
├── tess_client.py         # refatorado: aceita ScopeConfig
├── scope_loader.py        # NOVO — carrega scopes/{nome}.yaml e valida
└── scopes/
    ├── sdr.yaml
    ├── sdr/scenarios.yaml
    ├── studio-tirra.yaml       (futuro)
    └── playground-test.yaml    (futuro — pode nascer vazio para teste)
```

⚠️ Nome do diretório-pai `sdr-eval` fica ambíguo após D8 (não é mais só SDR). Renomear é fora do escopo desta task — registrar como tech debt. Sugestão futura: `victor-libs/prompt-eval/`.

---

## 4. Backward compat

**Regra dura:** o scope `sdr` deve produzir **comportamento bit-a-bit idêntico** ao atual.

- `python victor-libs/sdr-eval/runner.py` (sem flag) → equivale a `--scope sdr`.
- `scopes/sdr.yaml` carrega TODAS as constantes hoje hardcoded — `AGENT_ID=44853`, `PROMPT_FILE=docs/knowledge-base/sdr-prompt-context.md`, vocabulário marca, handoff_closings, exceções, cenários — sem alterar valores.
- Reports gerados pelo scope `sdr` devem ser idênticos (mesmo formato, mesmo nome de arquivo) aos atuais para um mesmo prompt + mesma response.

**Critério de validação automática:** rodar a suite atual antes do refactor, salvar report. Rodar `--scope sdr` depois do refactor com mesmas responses mockadas. Diff = 0.

> Quebrar prod para esta task = veto. O agente TESS 44853 está em uso em contexto de demonstração comercial (restrição do insumo §6).

---

## 5. Migração (plano de 5 passos, cada um verificável)

Cada passo é um PR independente. Critério de pronto explícito.

### Passo 1 — Extrair `ScopeConfig` (dataclass) e `scope_loader.py`

- Criar `scope_loader.py` com função `load_scope(name: str) -> ScopeConfig`.
- `ScopeConfig` é dataclass com campos: `agent_id`, `prompt_file`, `tags_a_remover`, `handoff_closings`, `vocabulario_marca` (estrutura aninhada), `scenarios` (lista carregada do YAML referenciado).
- Validação dura no loader: campos obrigatórios; YAML malformado → erro nomeado.
- Nenhum outro arquivo é alterado neste passo.
- **Pronto quando:** `python -c "from victor_libs.sdr_eval.scope_loader import load_scope; print(load_scope('sdr'))"` funciona, e teste unitário do loader valida happy path + 2 cenários de erro.

### Passo 2 — Criar `scopes/sdr.yaml` + `scopes/sdr/scenarios.yaml`

- Materializar TODO o estado hardcoded de hoje no YAML. Copiar literal — sem otimizar, sem renomear, sem "melhorar".
- Diff manual contra os arquivos `.py` para confirmar paridade.
- **Pronto quando:** todas as constantes/listas hoje em `evaluator.py` e `tess_client.py` e `scenarios.py` estão refletidas em `scopes/sdr.yaml` + `scopes/sdr/scenarios.yaml`, e um teste de paridade compara `load_scope('sdr').vocabulario_marca.palavras_proibidas` com a lista atual em `evaluator.py` — devem ser iguais elemento a elemento.

### Passo 3 — Refatorar `evaluator.py` para receber `ScopeConfig`

- `evaluate_response(response_text, scenario, scope: ScopeConfig)` — novo parâmetro.
- `_check_vocabulario_marca`, `_check_pergunta_aberta`, `_strip_tess_tags` passam a ler do `scope` em vez de constantes locais.
- Constantes locais são REMOVIDAS (não duplicar fonte de verdade).
- **Pronto quando:** todos os testes existentes do evaluator passam com `scope=load_scope('sdr')` passado explicitamente; nenhum string SDR-específico permanece em `evaluator.py`.

### Passo 4 — Refatorar `tess_client.py` e `scenarios.py`

- `tess_client.py`: `execute_agent` aceita `scope: ScopeConfig`. `AGENT_ID` e `PROMPT_FILE` removidos do top-level; lidos do scope.
- `scenarios.py`: vira loader fino (`def load_scenarios(scope: ScopeConfig) -> list[dict]`) que retorna o `scope.scenarios`. Lista hardcoded `SCENARIOS = [...]` removida.
- **Pronto quando:** nenhum literal SDR-específico (`44853`, `"sdr-prompt-context.md"`, mensagens de cenário) permanece nos arquivos `.py`.

### Passo 5 — Refatorar `runner.py` para flag `--scope`

- `argparse` com `--scope` (default `"sdr"`).
- Loader chamado no início; `ScopeConfig` propagado para client/evaluator/scenarios.
- Output paths/nomes de report devem incluir o `scope.id` (para que rodar dois scopes não sobrescreva relatórios).
- **Pronto quando:** `runner.py --scope sdr` produz report idêntico ao runner antigo (validação contra snapshot do passo 0); `runner.py --scope test-empty` (com `scopes/test-empty.yaml` mínimo) roda sem crashar e produz report esqueleto.

---

## 6. Critério de aceite (Definition of Done)

A task está pronta quando **todos** os abaixo passam:

1. **Paridade SDR:** suite atual roda com `--scope sdr` e produz output funcionalmente idêntico ao antes do refactor. Diff de report = 0 (ou diferenças só em timestamps/paths esperados).
2. **Scope novo viável:** criar `scopes/test-empty.yaml` com regras mínimas vazias (0 palavras proibidas, 0 handoff_closings, agent_id = um mock ou outro agent TESS de teste, 1 cenário trivial). `runner.py --scope test-empty` roda sem crashar e produz report esqueleto. Confirma que nada SDR vaza para outros scopes.
3. **README atualizado:** `victor-libs/sdr-eval/README.md` (criar se não existir) documenta: (a) como invocar `--scope`, (b) schema do `scopes/{nome}.yaml`, (c) como adicionar um scope novo (passo a passo), (d) tabela mapeando seções do YAML às responsabilidades do evaluator.
4. **Sem strings SDR em `.py`:** `grep -E "sdr-prompt-context|44853|Roteiro|itinerário|Alhurez" victor-libs/sdr-eval/*.py` retorna vazio. Tudo migrado para YAML.
5. **Code review por @pedro-valerio:** spec foi seguida; passos de migração foram entregues como PRs separados (não 1 PR gigante); backward compat foi validada com evidência (snapshot diff).

---

## 7. Não-objetivos (fora do escopo desta task)

- **Não plugar eval em CI** — G4 do insumo é gap separado, fora desta task. Esta entrega torna a plugagem em CI **viável**, mas não a executa.
- **Não consolidar `victor-libs/sdr-eval/` com `docs/qa/eval-runs/`** — G12 é gap separado (dois sistemas paralelos). Esta task generaliza só o `sdr-eval`. O `eval-runs` (multi-turn benchmark) fica como está.
- **Não renomear `victor-libs/sdr-eval/` para algo mais genérico** — registrar como tech debt; rename ortogonal à generalização.
- **Não escrever scope `studio-tirra` ou outro real além de SDR** — `test-empty` basta para validar a generalização. Scopes reais nascem quando o squad de prompt for usado para um novo cliente.
- **Não corrigir bugs latentes do evaluator atual** — exceto o do `_strip_tess_tags` (que falta `[SCORE:...]` e `[CLASSIFICACAO:...]`, e o prompt v2 emite essas tags): este pode ser corrigido na migração para YAML (adicionar à `tags_a_remover` do scope `sdr`), porque a migração mexe nesse ponto. Sinalizar no PR.

---

## 8. Ambiguidades / pontos de atenção (para @pedro-valerio auditar antes do go)

- **A8.1 — Discrepância FP3 vs FP4:** o gap G9 do insumo cita inconsistência entre o índice do MEMORY ("3 falsos positivos") e o arquivo de memória ("4"). Esta task não resolve essa inconsistência — só migra o estado atual do código (que reflete os FP de fato implementados). Resolução do registro de FP é trabalho separado (provavelmente do `prompt-evaluator` agent).
- **A8.2 — `_strip_tess_tags` está incompleto.** Hoje cobre 3 tags (`ESTADO`, `MATERIAL`, `HANDOFF`); o prompt v2 declara 5 (`ESTADO`, `SCORE`, `CLASSIFICACAO`, `MATERIAL`, `HANDOFF` — `sdr-prompt-v2-tess-ready.md:228-238`). Bug pré-existente. Recomendado corrigir durante a migração (adicionar `SCORE` e `CLASSIFICACAO` ao `tags_a_remover` do scope SDR). Decisão final: @pedro-valerio + @dev.
- **A8.3 — `runner.py` não foi lido em detalhe.** A spec acima assume que `runner.py` é orquestrador fino. Se descobrir hardcodes adicionais (output dir, formato de report, IDs de cenário), incluir no Passo 5.
- **A8.4 — Nome do diretório `sdr-eval`.** Após generalizar, o nome vira mentira. Fora do escopo, mas registrar.
- **A8.5 — Multi-cliente em produção.** A spec aceita `agent_id` por scope, mas o token TESS é único (`TESS_API_TOKEN` env). Se um cliente futuro exigir token próprio, expandir o schema para `tess.token_env_var: TESS_API_TOKEN_TIRRA` (cada scope nomeia sua env var). Fora do escopo de v1; declarar.

---

*Handoff scaffold da FASE 3 — `prompt-engineering-squad` v0.1.0. Spec técnica e executável. @pedro-valerio audita antes do @dev começar.*
