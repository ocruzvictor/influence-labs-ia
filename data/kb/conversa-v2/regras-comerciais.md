# Regras Comerciais — Studio Tirra

> Consultar este arquivo quando o cliente tocar em serviços premium (mechas, visagismo, alisamento), pedir cancelamento/reagendamento, ou quando houver dúvida sobre quando insistir / recuar.

## Serviços com fluxo consultivo obrigatório (NUNCA dar preço direto)

### Visagismo
- **Valor:** R$ 750. Inclui corte + barba + sobrancelha. Parcela em 3x sem juros.
- **Fluxo:** antes de dar o valor, perguntar "o que te fez buscar essa consultoria?" e ouvir. Explicar benefícios (avaliação personalizada, identidade visual, durabilidade do resultado). SÓ ENTÃO informar valor + parcelamento.
- **Profissionais:** Tiago e André (premium).

### Mechas
- **Valor base:** R$ 835 (equipe) / R$ 925 (Tiago premium).
- **Fluxo:** primeiro passo é sempre o **Teste de Mechas gratuito e sem compromisso**. Profissional avalia o cabelo presencialmente e passa o valor exato (depende do comprimento, base de cor atual, etc.).
- Nunca antecipar valor sem teste.

### Alisamento / Progressiva
- Variação grande de preço (R$ 100–390) por tipo e profissional.
- Confirmar tipo desejado antes de dar valor: térmica, vegana, masculina, etc.

### Coloração / Correção de Cor
- Correção de Cor (R$ 1.047) é serviço técnico — só ofertar se cliente menciona problema com coloração prévia.

## Promoções recorrentes

- **Terça e quarta:** preços reduzidos em serviços selecionados. Sempre validar no Trinks (campo de preço) antes de citar valor promo. Formato sugerido: "Sabia que terça e quarta temos preços especiais? O [serviço] sai por R$ [preço promo]."
- **Serviços gratuitos:** Corte de franja, Teste de Mechas, Avaliação, Futura mamãe, Tratamento de retorno de mechas.

## Cross-sell (6 padrões reais)

1. **Add-on durante visita:** cliente já agendado → "Aproveitando que vai estar aqui...". Ex: manicure → sobrancelha, corte → barba, cabelo → franja.
2. **Referência familiar:** cliente menciona familiar → "Seu [familiar] gostaria de agendar também?"
3. **Aniversário:** semana do aniversário → "Feliz aniversário, [Nome]! O Studio Tirra tem um presente: 10% de desconto (limite R$ 30) no serviço que você escolher."
4. **Campanha sazonal:** datas comemorativas → broadcast curto com oferta + CTA.
5. **Upsell premium:** cliente quer mudança visual → abordagem consultiva + portfolio. Ex: corte básico → visagismo; coloração simples → mechas.
6. **Notificação proativa de slot:** cancelamento abriu vaga com profissional disputado → "Abriu um horário com [profissional]. Quer aproveitar?"

## Quando insistir vs recuar

| Situação | Ação |
|----------|------|
| Cliente "tô só vendo, vou ver" | Recuar, deixar porta aberta: "Sem pressa! Qualquer coisa, é só chamar. 😊" |
| Cliente disse não 1x para upsell | NÃO insistir. Mudar de assunto. |
| Cliente fechou agendamento, oferta add-on natural | OK fazer 1 sugestão, não 2. |
| Momento de frustração / reclamação | NUNCA fazer upsell. Escalar para Gabriel. |
| Cliente recorrente conhecido | Pode sugerir serviço novo só se vier a ponte natural na conversa. |

## Win-back (cliente inativo)

- **Janela:** 45–60 dias sem visita.
- **Template:** "Oi, [Nome]! Faz um tempinho que você não aparece. Quer que eu veja horários para [último serviço]?"
- **Sem resposta em 7 dias → não insistir** (anti-pattern Victor).

## Cancelamento e reagendamento — política

### Score do Cliente — como é calculado

Score numérico de 0 a 100 indicando confiabilidade/aderência do cliente.

**Fórmula (peso simples, V1):**
```
score = 100 - (cancellation_rate * 60) - (no_show_rate * 30) - (late_arrival_rate * 10)
```
Onde cada *rate* é a taxa (0.0–1.0) sobre o histórico de agendamentos do cliente.

**Bandas:**
- `score >= 80` → **Cliente bom** — flexibilidade máxima
- `50 <= score < 80` → **Neutro** — política padrão
- `score < 50` → **Cliente em observação** — exigências reforçadas (depósito, tolerância reduzida)

**Onde consultar (ordem de prioridade):**
1. **Trinks API** — campo `clienteScore` ou equivalente no payload do cliente (preferido, single source of truth)
2. **Fallback PostgreSQL `clients.score`** — coluna calculada por job batch noturno se Trinks indisponível
3. **Default novo cliente** — sem histórico = score `70` (neutro/leve confiança, política padrão)

**Atualização:** após cada evento finalizado (booking concluído / no-show / cancelamento) — job batch ou trigger no backend recalcula. NÃO atualizar score em tempo real durante conversa (latência).

**Observação produto:** essa fórmula é V1 e pode ser refinada com data real após 60+ dias de coleta. Documentar mudanças aqui antes de alterar lógica em prod.

### Cliente bom (score > 80%)
- Cancelamento com mais de 24h: "Sem problemas! Agradecemos por avisar. Quer agendar outro horário?"
- Atraso: "Obrigado por avisar! Já notifiquei o profissional. Dirija com segurança!"

### Cliente em observação (score < 50%)
- Cancelamento com menos de 24h: "Conforme nossa política, cancelamentos com menos de 24h implicam perda do sinal."
- Para reagendar, pode ser pedido depósito de 50% via PIX (link válido por 30 min).
- Tolerância de atraso: máx 15 min, depois cancelamento automático.

### Tolerância padrão
- Atraso até 15 min é tratado proativamente, sem cobrança.
- Acima disso, escalar para Gabriel decidir.

## Regras duras de segurança comercial

- Máximo **1 mensagem proativa por semana** por cliente.
- NÃO enviar entre 20h e 8h.
- Respeitar opt-out imediato ("não quero receber", "para", "stop").
- NÃO fazer upsell em momento de frustração.
- NÃO insistir após recusa.
- Confirmação dos 4 pontos obrigatória antes de fechar agendamento: serviço + profissional + dia/hora + valor.
