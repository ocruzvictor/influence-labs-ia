# Atlas — padrão de negócio dos erros da nova versão

**Data:** 2026-09-02  
**Recorte válido:** backend iniciado em `2026-09-02T15:02:37Z`; evidência coletada até `2026-09-03 ~02:50Z`. O recorte anterior a 15:02Z é histórico e não sustenta a causa dominante desta versão.  
**Confiança:** alta para contagens, P0 `…0101` e ausência de drift de deploy; média para a necessidade final de intervenção em cada handoff, pois o evento prova a passagem, não o fechamento humano.

## padrao

- **A agenda segura o erro, mas tarde demais:** houve 11 bloqueios; a Tess chegou a propor inícios fora da grade livre ou uma janela de 30 minutos para serviço de 60. O guard protegeu a Trinks, porém o cliente já percorreu uma promessa inviável e precisou recomeçar ou cair no humano. É quebra de I3 na conversa, mesmo sem reserva errada.
- **Cliente novo pode ficar sem atendimento no último passo:** em `…0101`, o cadastro foi recusado pela Trinks porque o telefone saiu sem `TipoId`; o CREATE falhou, a continuação caiu em FULL, os créditos chegaram a zero e veio resposta vazia. Em linguagem de salão: o atendimento chegou à tentativa de reservar, mas a cliente ficou no silêncio porque o cadastro não entrou.
- **Handoff ainda cobre exceções legítimas e falhas evitáveis:** sete eventos envolveram encaixe, consulta anterior, pedido explícito de humano, conflito de habilitação, multi-serviço e dado indisponível. Encaixe/pedido humano podem ser corretos; horário inválido, dado ausente e combo simples só deveriam chegar à recepção depois de uma tentativa segura e objetiva.
- **A autonomia existe, mas é instável:** duas reservas foram criadas com sucesso e houve um reagendamento 2xx; portanto o caminho fecha sozinho quando contexto, cadastro e slot convergem. Ao mesmo tempo, 48 turnos FULL mostram que a conversa ainda expande demais, inclusive depois de falhar, e pode consumir a capacidade necessária para se recuperar.
- **Não é versão antiga no ar:** os arquivos e marcadores A/B/C conferem byte a byte com o live, sem o crash anterior de profissional. O padrão atual é desalinhamento em runtime entre o que a Tess oferece, o que o guard aceita e o que a Trinks exige.

## intervencao_humana

- `…5668` — handoff `encaixe`; motivo de negócio: horário desejado não passou na grade. Humano é adequado somente se o cliente realmente pede exceção; antes disso, a Tess deveria oferecer um início válido.
- `…5704` — handoff `consulta_agendamentos_anteriores`; motivo: consulta de histórico de agenda. Passagem potencialmente legítima; conclusão humana não observada.
- `…3848` — handoffs `cliente_pediu_humano` e `multi_servico`; motivo: pedido explícito justifica passagem, mas não foi observado se o combo sozinho também exigia humano.
- `…7163` — handoff `conflito_habilitacao_profissional`; motivo: preservar a regra de quem executa o serviço. A Tess deveria corrigir a oferta com profissional habilitado antes de escalar, quando houver alternativa.
- `…8995` — handoff `cliente_pediu_humano`; motivo: escolha explícita do cliente, intervenção correta.
- `…8134` — handoff `dado_indisponivel`; motivo: a automação não reuniu dado suficiente para fechar. Não observado se era falta real da Trinks ou contexto incompleto.
- `…0101` — rede humana necessária após `booking.failed` + FULL sem crédito, embora não haja `handoff.human` registrado. Motivo: cliente nova ficou sem reserva e sem resposta depois da falha de cadastro.

## causa_dominante

**Desalinhamento entre a promessa feita no WhatsApp e a capacidade transacional disponível naquele turno, com confiança alta.** Em volume, domina a Tess oferecer um horário que o guard recusa (11 bloqueios). Em gravidade, domina a cadeia `cadastro Trinks sem TipoId → CREATE falha → FULL → crédito zero → silêncio` em `…0101`. Não é “código antigo no ar” nem falha primária do time humano.

### causas_secundarias

1. **Contrato Trinks incompleto para cliente novo:** telefone sem `TipoId` impede cadastrar e, por consequência, impede reservar.
2. **Fidelidade da Tess ao bloco HORARIOS:** mesmo com filtragem no backend, a Tess ainda transforma em pedido de reserva um início ausente ou curto demais.
3. **Recuperação cara após falha:** 48 turnos FULL e o caso `…0101` mostram que uma falha operacional pode ampliar o contexto até esgotar crédito, em vez de emitir resposta curta e acionável.
4. **Ops:** o time humano continua sendo a rede de segurança. Isso contém dano ao cliente, mas não deve mascarar quantos casos poderiam terminar sozinhos.

## o_que_parar_de_errar

- **I1 — não deixar falha virar silêncio ou frase de sucesso:** só dizer “confirmado” depois do 2xx. Se cadastro/CREATE falhar, dizer em linguagem simples que a reserva ainda não entrou e acionar a recepção sem nova rodada FULL. Nesta janela, falsa confirmação pós-15:02Z não foi provada; preservar o gate.
- **I2 — fazer o caso simples terminar:** cliente novo também precisa fechar sozinho. Cadastro aceito, SKU de tabela, profissional habilitado e início válido devem resultar em reserva; erro de `TipoId`, dado indisponível evitável ou crédito zerado não podem empurrar o cliente para o time.
- **I3 — oferecer apenas o que cabe de verdade:** não apresentar início fora da grade nem encaixar 60 minutos em 30. O guard continuar bloqueando é correto, mas a Tess deve receber e repetir somente 1–2 inícios que o guard aprovaria.
- **Piso:** confirmar ao cliente somente olhando a reserva efetiva; assumir encaixe, histórico antigo, pedido explícito de humano e recuperação de silêncio. Não compensar manualmente slot inventado como rotina sem marcar o motivo.
- **Infra/produto:** corrigir o contrato de cadastro do telefone, alinhar a oferta ao guard e manter a recuperação pós-falha em BOOKING curto, com copy honesta e handoff imediato se não houver fechamento.

## fora_de_escopo

- Não foi observado o conteúdo integral de cada fio; não classificamos os sete handoffs como todos corretos ou todos evitáveis.
- Não foi provado se os 48 turnos FULL correspondem a 48 clientes distintos nem qual fração era legítima.
- Não há evidência pós-15:02Z suficiente para atribuir falsa confirmação a esta versão; isso permanece gate de vigilância, não achado atual.
- Sem POST/PATCH Trinks, resume de cliente, alteração de prompt, patch, deploy, orçamento de créditos ou identificação além de last4.

## fontes

- `docs/handoffs/2026-09-02-dex-live-evidence.md`
- `docs/ops/plano-correcao-go-live-tess-2026-09-02.md`
- `docs/ops/nightwatch-log.md` (histórico pré-15:02Z, usado apenas para contraste)
- `squads/tess-nightwatch/data/incident-taxonomy.md`
