# Pesquisa — framework de prompt para agente de recepção WhatsApp

**Data:** 2026-08-18 · @aios-master + fontes externas + leitura Eco Adventure (read-only)

## TL;DR

A suspeita de “prompt grande demais” é **meio certa, no lugar errado**.

O system prompt canônico do 46589 tem **~3,5 mil tokens**. O da Flora v4.2, que **melhorou** no Eco Adventure, tem **~7 mil**. Lá a troca de framework **não foi encurtar** — foi sair do objeto-agente TESS/PACER para Gemini + trip-wires + tabela de vocabulário + **harness com kill-rule** + fatos no runtime/RAG. O prompt até cresceu.

O que o mercado chama de problema em 2025–2026 não é “ter 3 mil tokens de instrução”. É **context rot**: cada turno do Tirrá manda prompt + KB TESS + **119 serviços** + habilitação + 10 dias de slots + 15 turns de memória. Aí sim a atenção dilui — e o modelo obedece o caminho feliz (escrito no topo) e perde as bordas (expediente, não recriar, markdown).

**Não reescrever PACER do zero.** Compactar constituição, filtrar o snapshot por intenção, e montar um harness no molde Flora 9.3 usando o smoke do Gabriel como golden set.

- Relatório: [02-research-report.md](./02-research-report.md)
- Recomendações: [03-recommendations.md](./03-recommendations.md)
