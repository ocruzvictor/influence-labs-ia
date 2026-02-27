# Matriz de Testes Manuais - Salao WhatsApp

Objetivo: validar comportamento funcional antes do piloto com clientes reais.

## Como usar
- Execute cada cenario com dados reais da KB em `data/client/kb/`.
- Marque status: `PASS`, `FAIL`, `BLOCKED`.
- Em `FAIL`, registrar causa e acao corretiva.

## Tabela de execucao
| ID | Categoria | Cenario | Esperado | Status | Evidencia | Observacoes |
|---:|---|---|---|---|---|---|
| 1 | Agendamento | Agendar corte simples para amanha | Slot valido + confirmacao |  |  |  |
| 2 | Agendamento | Agendar coloracao com profissional especifico | Disponibilidade por profissional |  |  |  |
| 3 | Agendamento | Reagendar horario existente | Novo horario confirmado |  |  |  |
| 4 | Agendamento | Cancelar agendamento | Status cancelado + confirmacao |  |  |  |
| 5 | Agendamento | Horario indisponivel | Alternativas oferecidas |  |  |  |
| 6 | Agendamento | Agendar combo | Duracao e preco corretos |  |  |  |
| 7 | Agendamento | Agendar para terceiro | Dados do cliente preservados |  |  |  |
| 8 | Agendamento | Consultar horarios disponiveis | Lista coerente de slots |  |  |  |
| 9 | Agendamento | Pedido fora do horario | Rejeicao com alternativa |  |  |  |
| 10 | Agendamento | Dia de folga do profissional | Redirecionamento correto |  |  |  |
| 11 | Agendamento | Concorrencia mesmo horario | Um confirma, outro recebe alternativa |  |  |  |
| 12 | Agendamento | Servico inexistente | Nao inventa, orienta corretamente |  |  |  |
| 13 | Agendamento | Mensagem em audio | Fallback/humano quando necessario |  |  |  |
| 14 | Agendamento | Imagem de referencia | Encaminhamento adequado |  |  |  |
| 15 | Agendamento | Localizacao enviada | Nao quebra fluxo de atendimento |  |  |  |
| 16 | Agendamento | "Semana que vem" | Solicita data objetiva |  |  |  |
| 17 | Agendamento | "Hoje a tarde" | Oferece opcoes especificas |  |  |  |
| 18 | Agendamento | Confirmar agendamento existente | Retorno correto do cadastro |  |  |  |
| 19 | Agendamento | Pedido de encaixe | Lista de espera oferecida |  |  |  |
| 20 | Agendamento | 3 servicos em sequencia | Agenda valida com intervalo |  |  |  |
| 21 | FAQ | Perguntar preco | Resposta da KB sem alucinacao |  |  |  |
| 22 | FAQ | Perguntar endereco | Endereco correto + referencia |  |  |  |
| 23 | FAQ | Formas de pagamento | Lista correta |  |  |  |
| 24 | FAQ | Horario de funcionamento | Horario correto |  |  |  |
| 25 | FAQ | Aceita Pix | Resposta correta |  |  |  |
| 26 | FAQ | Servico nao existente | Nao inventa e aciona humano se preciso |  |  |  |
| 27 | FAQ | Profissional especialista em X | Resposta coerente da KB |  |  |  |
| 28 | FAQ | Estacionamento | Resposta correta |  |  |  |
| 29 | FAQ | Atende criancas | Resposta conforme politica real |  |  |  |
| 30 | FAQ | Produto a venda | Resposta conforme KB |  |  |  |
| 31 | Vendas | Follow-up 48h | Mensagem cordial e objetiva |  |  |  |
| 32 | Vendas | Reativacao 30 dias | Mensagem adequada |  |  |  |
| 33 | Vendas | Reativacao 60 dias | Oferta apropriada |  |  |  |
| 34 | Vendas | Cross-sell apos agendamento | Oferta relevante |  |  |  |
| 35 | Vendas | Promocao sazonal | Template aprovado |  |  |  |
| 36 | Vendas | Cliente diz "nao quero" | Opt-out respeitado |  |  |  |
| 37 | Vendas | Cliente diz "me conte mais" | Explicacao curta + CTA |  |  |  |
| 38 | Vendas | Lembrete 24h | Mensagem enviada no horario certo |  |  |  |
| 39 | Vendas | Aniversario do cliente | Mensagem adequada |  |  |  |
| 40 | Vendas | Pedido de indicacao | Tom natural sem pressao |  |  |  |
| 41 | Human | Reclamacao de servico anterior | Handoff imediato |  |  |  |
| 42 | Human | Pedido explicito para dona | Handoff imediato |  |  |  |
| 43 | Human | Pergunta sem resposta na KB | Handoff com transparencia |  |  |  |
| 44 | Human | Cliente agressivo | Handoff e resposta segura |  |  |  |
| 45 | Human | Pedido de desconto | Escalacao conforme politica |  |  |  |
| 46 | Human | Negociacao de parcelamento | Escalacao |  |  |  |
| 47 | Human | Situacao ambigua baixa confianca | Escalacao por confidence |  |  |  |
| 48 | Human | Outro idioma | Escalacao |  |  |  |
| 49 | Human | Mensagem longa complexa | Escalacao |  |  |  |
| 50 | Human | 3 tentativas sem resolver | Escalacao automatica |  |  |  |

## Criterios de aprovacao
- >=90% cenarios com PASS
- Tempo medio de resposta < 5 segundos
- Zero resposta inventada validada no lote
- Human takeover com 100% em cenarios criticos
