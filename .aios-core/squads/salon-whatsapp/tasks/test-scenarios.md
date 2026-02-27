# Cenarios de Teste - Agente WhatsApp Salao

## Cenarios de Agendamento (20)
1. Agendar corte simples para amanha
2. Agendar coloracao com profissional especifico
3. Reagendar horario existente
4. Cancelar agendamento
5. Horario solicitado nao disponivel -> oferecer alternativa
6. Agendar combo (corte + barba)
7. Agendar para outra pessoa
8. Perguntar horarios disponiveis sem escolher
9. Agendar fora do horario de funcionamento
10. Agendar em dia de folga do profissional
11. Duas pessoas agendando mesmo horario (concorrencia)
12. Cliente tenta agendar servico que nao existe
13. Cliente envia audio (nao texto)
14. Cliente envia imagem de referencia
15. Cliente envia localizacao
16. Agendar para "semana que vem" (sem data especifica)
17. Agendar para "hoje a tarde" (vago)
18. Confirmar agendamento existente
19. Perguntar se tem encaixe
20. Agendar 3 servicos em sequencia

## Cenarios FAQ (10)
21. Perguntar preco de servico
22. Perguntar endereco/como chegar
23. Perguntar formas de pagamento
24. Perguntar horario de funcionamento
25. Perguntar se aceita pix
26. Perguntar sobre servico que nao existe no salao
27. Perguntar nome do profissional especialista em X
28. Perguntar se tem estacionamento
29. Perguntar se atende criancas
30. Perguntar sobre produto a venda

## Cenarios Vendas (10)
31. Follow-up pos-atendimento (satisfacao)
32. Reativacao cliente inativo 30 dias
33. Reativacao cliente inativo 60 dias
34. Sugestao servico complementar apos agendamento
35. Promocao sazonal (Black Friday, Dia das Maes)
36. Cliente responde "nao quero" a promocao -> parar
37. Cliente responde "me conte mais" a promocao
38. Lembrete 24h antes do agendamento
39. Aniversario do cliente
40. Indicacao (cliente satisfeito -> pedir indicacao)

## Cenarios Human Takeover (10)
41. Cliente reclama de servico anterior
42. Cliente quer falar com a dona
43. Cliente faz pergunta que IA nao sabe
44. Cliente esta irritado/usa palavras grosseiras
45. Cliente pede desconto
46. Cliente quer negociar pagamento parcelado
47. Situacao ambigua que IA nao tem confianca
48. Cliente fala em outro idioma
49. Cliente envia msg muito longa e complexa
50. Tres tentativas de IA sem resolver -> escalar automatico

## Criterios de aprovacao
- [ ] 90%+ dos cenarios resolvidos corretamente
- [ ] Tempo medio de resposta < 5 segundos
- [ ] Zero respostas inventadas (alucinacao)
- [ ] Tom de voz consistente em todas as respostas
- [ ] Human takeover funciona em 100% dos cenarios criticos
