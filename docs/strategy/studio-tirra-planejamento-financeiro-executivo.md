# Planejamento Financeiro Executivo - Studio Tirra (Atualizado)

**Data de referencia:** 05/03/2026  
**Escopo:** somente ferramentas (sem preco de servico)  
**Decisoes da reuniao:**
- `LLM`: Tess AI Pro com preco oficial em `https://tess.im/pt-BR/pricing`
- `Infra`: VPS Hostinger (upgrade na mesma conta ja existente)
- `WhatsApp`: API oficial Meta
- `Trinks API`: **R$ 0 incremental** (ja inclusa no plano atual)
- `Dominio e hospedagem`: **R$ 0 incremental** (ja existentes)
- `Cupom`: **10% de desconto na contratacao do VPS KVM2**

## 1) Stack final escolhido

1. Hostinger VPS
2. n8n Community (self-host)
3. Chatwoot Community (self-host)
4. Evolution API (self-host)
5. Tess AI Pro (assinatura oficial)
6. Meta WhatsApp Cloud API oficial

## 2) Custo fixo mensal (sem volume de mensagens)

| Perfil de VPS | VPS base (R$/mes) | Regra de cupom | Tess Pro (R$/mes) | Fixo total (R$/mes) | Fixo anual (R$) |
|---|---:|---|---:|---:|---:|
| KVM2 Contratacao | 38,99 | -10% no fechamento | 79,00* | 114,09 | 1.369,08 |
| KVM2 Renovacao | 77,99 | sem cupom | 79,00* | 156,99 | 1.883,88 |

## 3) Custo variavel Meta (mensagens)

Premissa operacional definida: maioria das mensagens e de **Utility/Service** (agendamento e lembretes), com **Marketing minoritario**.

Formula usada:
`Variavel Meta = (Msg_Utility x Custo_Utility) + (Msg_Marketing x Custo_Marketing)`

Observacao:
- `Service` foi tratado como custo `R$ 0` na planilha.
- Ajuste os unitarios na planilha conforme tarifa oficial vigente do numero/pais.
- `*` O valor da Tess na planilha esta parametrizado e deve ser ajustado para o valor atual exibido no checkout da pagina oficial.

## 4) Simulacao rapida (perfil utilitario)

| Perfil | Msg Utility | Msg Service (0R$) | Msg Marketing | Variavel Meta (R$/mes) |
|---|---:|---:|---:|---:|
| Leve | 1.200 | 600 | 120 | 87,60 |
| Moderado | 2.500 | 1.500 | 250 | 182,50 |
| Alto | 4.000 | 3.000 | 400 | 292,00 |

## 5) Total mensal estimado (fixo + variavel)

| Cenario | Total mensal (R$) |
|---|---:|
| KVM2 Contratacao (cupom) + Perfil Leve | 201,69 |
| KVM2 Renovacao + Perfil Moderado | 339,49 |
| KVM2 Renovacao + Perfil Alto | 448,99 |

---
Planilha detalhada: `docs/strategy/studio-tirra-planejamento-financeiro.csv`
