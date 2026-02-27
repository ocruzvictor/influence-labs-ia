# KB Real - Regras de Agendamento (Studio Tirra)

## Regras base
- Objetivo principal: garantir comparecimento e evitar buracos na agenda.
- Confirmacao obrigatoria de: data, hora, servico, profissional e valor.
- Regra comercial obrigatoria: preco muda por profissional (Tiago vs Equipe) e promocoes de 3a/4a.
- Horarios por profissional sao variaveis; por padrao seguem o horario do salao e excecoes pessoais ficam bloqueadas na agenda individual do Trinks.

## Cancelamento, atraso e no-show
- No-show: nao ha taxa financeira.
- Estrategia contra no-show: confirmacao rigorosa + lembretes.
- Atraso com aviso:
  - Tentar remanejar agenda para viabilizar atendimento.
  - Tom de comunicacao: "vamos fazer dar certo".
  - Inflexibilidade apenas em ultimo caso (agenda lotada e risco a outros clientes).
- Cliente com historico recorrente de atraso/cancelamento:
  - Aplicar menor flexibilidade.
  - Ser mais firme na janela de horario.

## Follow-up de confirmacao
- Confirmacao padrao: 1 dia antes.
- Lembrete extra: clientes agendados para tarde recebem mensagem adicional na manha do mesmo dia.
- Mensagem deve induzir resposta objetiva (SIM/NAO) para confirmar presenca.
- Opt-out: parar imediatamente quando cliente solicitar.

## Regras de desconto
- Desconto automatico permitido apenas para promocoes/ofertas oficiais listadas.
- Excecao de desconto somente quando o recepcionista no balcao liberar manualmente no pagamento.
- Novas promocoes devem entrar na lista oficial de servicos/ofertas e ser validadas por sincronizacao periodica da API.

## Regras tecnicas da integracao
- Trinks API: 60 req/min (rate limit).
- Cota mensal estimada: 5.000 req/mes.
- Obrigatorio usar cache + lock + revalidacao antes do commit.

## Validacao
- [ ] Regras aprovadas pela dona
