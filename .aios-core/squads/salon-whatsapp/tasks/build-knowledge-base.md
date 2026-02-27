# Construir Knowledge Base do Salao

## Objetivo
Criar a base de conhecimento estruturada que alimenta o RAG dos agentes.

## Estrutura da KB

### Arquivo: `kb/salon-info.md`
- Nome e endereco do salao
- Horario de funcionamento
- Formas de pagamento aceitas
- Como chegar (referencia)
- Estacionamento

### Arquivo: `kb/services.md`
- Tabela: servico | preco | duracao | profissionais habilitados
- Combos e pacotes com precos

### Arquivo: `kb/professionals.md`
- Tabela: nome | especialidades | horarios | dias
- Observacoes especificas

### Arquivo: `kb/scheduling-rules.md`
- Regras de agendamento
- Politica cancelamento
- Intervalo entre servicos
- Lista de espera

### Arquivo: `kb/faq.md`
- Top 20 perguntas frequentes com respostas aprovadas pela dona

### Arquivo: `kb/sales.md`
- Promocoes ativas
- Regras de sugestao de servicos complementares
- Templates de mensagens de reativacao (tom aprovado)

## Validacao
- [ ] Dona do salao revisou e aprovou CADA arquivo
- [ ] Precos conferidos
- [ ] Horarios conferidos
- [ ] Tom de voz validado
