---
title: Como planejar uma gaveta Gridfinity
description: Guia prático para planejar layouts de gaveta Gridfinity. Meça a gaveta, escolha os bins certos e exporte uma lista de impressão.
keywords: planejador gridfinity, layout gridfinity, como planejar gridfinity, organizar gaveta, guia gridfinity
schema: HowTo
breadcrumbs:
  - name: Início
    url: https://gridfinitylayouttool.com/pt-BR/
  - name: Guia de planejamento
    url: https://gridfinitylayouttool.com/pt-BR/guide
faqs:
  - q: Como medir uma gaveta para Gridfinity?
    a: Meça as dimensões internas da gaveta em milímetros — largura (esquerda para direita), profundidade (frente para trás) e altura livre (do fundo ao teto com a gaveta fechada). Tire várias medidas, já que gavetas raramente são retângulos perfeitos, e use o menor valor em cada dimensão para garantir.
  - q: Como converter as dimensões da gaveta em unidades de grade Gridfinity?
    a: Divida cada dimensão por 42 mm e arredonde para baixo. Por exemplo, uma gaveta de 380 mm × 260 mm comporta uma grade 9×6 (378 mm × 252 mm), deixando pequenas folgas nas bordas. As folgas são aceitáveis — as placas-base não precisam preencher cada milímetro.
  - q: Quais tamanhos de bin usar no Gridfinity?
    a: Como ponto de partida — 1×1 com divisórias para parafusos pequenos e componentes; 1×2 ou 2×2 para canetas, pen drives e pilhas; 1×3 ou 1×4 para chaves de fenda e alicates; 2×2 ou 2×3 para fita e cola; 3×3 ou maior para ferramentas grandes. Sempre dá para imprimir outros tamanhos depois se algo não encaixar.
  - q: Qual é a altura máxima de um bin Gridfinity?
    a: A altura é limitada apenas pela altura livre da gaveta e pelo curso Z da impressora. As alturas são medidas em unidades de 7 mm (U). Um bin 6U tem 42 mm de altura interna; um 9U, 63 mm. Antes de imprimir, confira a altura do seu bin mais alto, somando 5 mm da placa-base, contra a altura livre da gaveta fechada.
  - q: Vale a pena usar várias camadas em gavetas profundas?
    a: Sim, se houver altura disponível. Empilhe bins verticalmente, com a camada 1 embaixo. O pesado fica embaixo; o de uso frequente, em cima. Funciona bem para separar itens planos (cabos) de bins altos, ou para isolar o elétrico do mecânico.
  - q: Como exporto uma lista de impressão Gridfinity?
    a: Quando o layout estiver pronto, a lista de impressão mostra cada tamanho de bin, a quantidade necessária, as estimativas de filamento em gramas e links de busca por tamanho no Printables, Thangs e MakerWorld. Você também pode gerar bins personalizados direto no gerador integrado e exportar STL, STEP ou 3MF.
  - q: Quanto espaço vazio devo deixar numa gaveta Gridfinity?
    a: Deixe entre 10 e 20 % de espaço livre. Uma gaveta planejada a 100 % hoje vira um problema amanhã quando a sua coleção crescer ou as suas necessidades mudarem. Casas vazias da grade não custam nada e dão margem para incluir bins depois.
  - q: Qual é a melhor impressora para Gridfinity?
    a: Qualquer impressora FDM com mesa de pelo menos 256 mm × 256 mm imprime bins Gridfinity com folga. As Bambu Lab X1, A1 e P1S são populares pela velocidade. Prusa MK4 e Ender 3 V3 KE também funcionam bem. Para gavetas acima de 6×6 unidades, ou você divide as placas-base em peças, ou usa um formato grande tipo Bambu X1E ou Voron 2.4.
---

# Como planejar uma gaveta Gridfinity

Imprimir sem plano desperdiça filamento. Você acaba reimprimindo bins porque errou os tamanhos, deixa lacunas indesejadas ou esquece do que precisava. Este guia cobre como medir, planejar e tirar uma lista de impressão antes de começar.

## Meça a gaveta

Pegue as dimensões internas em milímetros. Você precisa de:

- **Largura** — da esquerda para a direita
- **Profundidade** — da frente para o fundo
- **Altura** — do fundo ao teto (espaço livre com a gaveta fechada)

Meça em vários pontos. Gavetas raramente são retângulos perfeitos, sobretudo em móveis antigos. Use o menor valor para garantir.

### Converta para unidades de grade

Gridfinity usa unidades de 42 mm. Divida e arredonde para baixo:

```text
Largura:      380 mm ÷ 42 = 9,04 → 9 unidades
Profundidade: 260 mm ÷ 42 = 6,19 → 6 unidades
```

Uma grade 9×6 é 378 mm × 252 mm. Você terá pequenas folgas nas bordas — tudo bem. As placas-base não precisam cobrir cada milímetro.

## Defina o que vai dentro

É o passo que quase todo mundo pula — e se arrepende.

Tire tudo da gaveta. Agrupe:

- Itens de uso diário
- Itens de uso semanal
- Coisas que você tinha esquecido

O diário precisa estar acessível. O semanal pode ir para o fundo. O esquecido talvez nem precise de bin.

### Associe itens a tamanhos de bin

Referências:

| Conteúdo                       | Tamanho de bin     |
| ------------------------------ | ------------------ |
| Parafusos M3, componentes mini | 1×1 com divisórias |
| Canetas, pen drives, pilhas    | 1×2 ou 2×2         |
| Chaves de fenda, alicates      | 1×3 ou 1×4         |
| Fita, cola                     | 2×2 ou 2×3         |
| Ferramentas grandes            | 3×3 ou maior       |

Sem obsessão — sempre dá para imprimir outros bins depois.

## Planeje o layout

Abra a ferramenta e defina o tamanho da grade. Arraste para criar bins. A ferramenta impede sobreposição e estouro de área.

**O de uso frequente, à frente.** Ao abrir a gaveta, o que você pega primeiro? Vai na frente.

**Agrupe o que tem a ver.** Chaves de fenda num ponto, ferramentas de medida em outro. Você se lembra mais fácil.

**Deixe espaço vazio.** Sua coleção vai crescer. Uma gaveta planejada a 100 % hoje vira um problema amanhã.

### Camadas para gavetas profundas

Se sobra altura, empilhe bins na vertical. A camada 1 fica embaixo.

Funciona bem para:

- Plano embaixo (cabos, peças pequenas), bins altos em cima
- Separar elétrico de mecânico

Pesado embaixo; uso frequente em cima.

## Exporte a lista de impressão

Quando o layout estiver bom, exporte uma lista de impressão:

- Cada tamanho de bin com quantidade
- Estimativas de filamento em gramas
- Links de busca por tamanho

### Encontrar arquivos STL

Você pode [gerar bins personalizados](/pt-BR/gridfinity-bin-generator) diretamente no gerador integrado — escolha as dimensões, o estilo da base, os compartimentos e exporte para STL, STEP ou 3MF.

Para bins especializados (suportes específicos, formas complexas), procure nos repositórios da comunidade:

- [Printables](https://www.printables.com/search/models?q=gridfinity) — maior seleção
- [Thangs](https://thangs.com/search/gridfinity) — bom para encontrar designs parecidos
- [MakerWorld](https://makerworld.com/en/search/models?keyword=gridfinity) — comunidade Bambu Lab

Exemplo de busca: "gridfinity 2x2 3U" encontra bins 2×2 com 3 unidades de altura.

## Antes de imprimir

### Faça um teste com papelão primeiro

> Recorte papelão no tamanho dos bins (42 mm por unidade de grade) e arrume na gaveta. Se algo parecer errado, você não gastou filamento.

### Imprima um bin antes

Antes de imprimir 20, imprima um. Confira o encaixe, a altura e se gosta do design. Ajuste a configuração da impressora se necessário.

### Verifique a folga

Seu bin mais alto, somado à placa-base (cerca de 5 mm), precisa caber com a gaveta fechada. Confira antes de partir para bins altos.

## Erros comuns

**Bins miudinhos demais.** Uma grade de bins 1×1 parece organizada, mas é chato no dia a dia. Bins maiores com divisórias costumam funcionar melhor.

**Preencher cada casa.** Não sobra espaço para novidades. Planeje 10–20 % de espaço vazio.

**Ignorar o que você realmente usa.** Não organize com base no que você acha que deveria ter. Organize com base no que realmente pega.

[CTA: Abrir a ferramenta de layout](/pt-BR/)
