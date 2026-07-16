---
title: Tamanhos Gridfinity — Dimensões dos bins e guia de unidades
description: Qual é o tamanho de uma unidade Gridfinity? Grade de 42 mm, incrementos de altura de 7 mm. Tabelas de referência para bins, conversão de gaveta e o que cabe onde.
keywords: tamanhos gridfinity, dimensões gridfinity, tamanhos bin gridfinity, unidades altura gridfinity, gridfinity 42mm, grade gridfinity
schema: Article
breadcrumbs:
  - name: Início
    url: https://gridfinitylayouttool.com/
  - name: Referência de tamanhos
    url: https://gridfinitylayouttool.com/pt-BR/gridfinity-sizes
faqs:
  - q: Qual é o tamanho de uma unidade de grade Gridfinity?
    a: Uma unidade de grade Gridfinity mede 42 mm × 42 mm. Um bin 2×3 tem 84 mm de largura e 126 mm de profundidade. Todos os bins e placas Gridfinity usam esse padrão.
  - q: Qual é a altura de uma unidade Gridfinity?
    a: Uma unidade de altura (1U) é 7 mm. Um bin 3U tem cerca de 21 mm de altura interna. As alturas comuns vão de 2U (14 mm) a 10U (70 mm).
  - q: Como calculo quantas unidades Gridfinity cabem na minha gaveta?
    a: Meça a largura e a profundidade internas da gaveta em milímetros. Divida cada uma por 42 e arredonde para baixo. Por exemplo, uma gaveta de 380 mm × 260 mm comporta 9 × 6 unidades Gridfinity.
  - q: O que é o modo meio-bin?
    a: O modo meio-bin permite incrementos de 0,5 unidade (21 mm) para bins que precisam caber em espaços menores que uma unidade completa. Um bin 1,5×2 ficaria 63 mm × 84 mm.
---

# Tamanhos e dimensões Gridfinity

**Tamanhos padrão do Gridfinity: uma unidade de grade mede 42mm × 42mm (largura e profundidade), e uma unidade de altura (1U) mede 7mm.** Todo bin e toda placa-base é um múltiplo desses dois números — um bin 2×3 de 6U mede 84mm × 126mm × 42mm. O modo meio bin adiciona passos de 0,5 unidade (21mm). Conhecendo esses dois números, você sabe o que cabe na sua gaveta e quais bins imprimir.

## Unidades de grade (largura e profundidade)

**1 unidade de grade = 42 mm.** Todo bin e placa-base Gridfinity usa isso. Um bin "2×3" tem 2 unidades de largura (84 mm) e 3 de profundidade (126 mm).

| Unidades  | Milímetros | Polegadas (aprox.) |
| --------- | ---------- | ------------------ |
| 1 unidade | 42 mm      | 1,65″              |
| 2         | 84 mm      | 3,31″              |
| 3         | 126 mm     | 4,96″              |
| 4         | 168 mm     | 6,61″              |
| 5         | 210 mm     | 8,27″              |
| 6         | 252 mm     | 9,92″              |
| 7         | 294 mm     | 11,57″             |
| 8         | 336 mm     | 13,23″             |

### Modo meio-bin

Para encaixes mais apertados, o modo meio-bin usa **incrementos de 0,5 unidade (21 mm)**. Um bin 1,5×2,5 ficaria 63 mm × 105 mm. Ative-o na ferramenta de layout pressionando `H`.

## Unidades de altura

**1 unidade de altura (1U) = 7 mm.** É o espaço vertical disponível dentro do bin. Um bin 3U comporta itens de até cerca de 21 mm de altura.

| Altura | Interno (mm) | Uso típico                                      |
| ------ | ------------ | ----------------------------------------------- |
| 2U     | 14 mm        | Cartões SD, parafusos pequenos, clipes          |
| 3U     | 21 mm        | Pen drives, pilhas AA, parafusos                |
| 4U     | 28 mm        | Canetas, marcadores, brocas                     |
| 5U     | 35 mm        | Tesouras, rolos de fita, ferramentas pequenas   |
| 6U     | 42 mm        | Chaves de fenda, alicates (profundidade padrão) |
| 7U     | 49 mm        | Aerossóis, ferramentas grandes                  |
| 8U     | 56 mm        | Bisnagas de cola, recipientes altos             |
| 10U    | 70 mm        | Armazenamento profundo, itens volumosos         |

> **Verifique a folga:** Seu bin mais alto somado à placa-base (~5 mm) precisa caber com a gaveta fechada. Meça a altura interna da gaveta fechada antes de optar por bins altos.

## Converter as medidas da gaveta

Pegue uma trena e tire as dimensões internas da gaveta em milímetros. Depois:

1. Meça largura e profundidade internas em milímetros
2. Divida cada uma por 42
3. Arredonde para baixo até o inteiro (ou meio, no modo meio-bin)

### Exemplo

```text
Largura da gaveta:     380 mm ÷ 42 = 9,04 → 9 unidades
Profundidade da gaveta: 520 mm ÷ 42 = 12,38 → 12 unidades
Tamanho de layout:     9 × 12 (378 mm × 504 mm)
Folga nas bordas:      2 mm de largura, 16 mm de profundidade
```

Pequenas folgas nas bordas são normais. As placas-base não precisam cobrir cada milímetro. Geralmente as pessoas centralizam as placas e ignoram a folga.

## Tamanhos comuns de bin

São os mais impressos. Você pode criar qualquer um (ou um tamanho personalizado) no [gerador de bins](/pt-BR/gridfinity-bin-generator).

| Bin | Dimensões (mm) | Usos comuns                                 |
| --- | -------------- | ------------------------------------------- |
| 1×1 | 42 × 42        | Parafusos avulsos, porcas, componentes mini |
| 1×2 | 42 × 84        | Canetas, cabos USB, pilhas em fila          |
| 1×3 | 42 × 126       | Chaves de fenda, réguas, ferramentas longas |
| 2×2 | 84 × 84        | Fita, bastões de cola, trenas               |
| 2×3 | 84 × 126       | Alicates, cortadores, ferramentas médias    |
| 3×3 | 126 × 126      | Kits de brocas, acessórios grandes          |
| 4×2 | 168 × 84       | Soquetes, paquímetros                       |

## Cabe na sua mesa de impressão?

A maioria das impressoras FDM tem mesa de 220–256 mm, que comporta bins até cerca de 5×5 ou 6×6 unidades. Para algo maior é preciso dividir ou imprimir em seções. A ferramenta de layout assume por padrão mesa de 256 mm e sinaliza bins que não cabem.

## Referência rápida

| Medida                   | Valor            |
| ------------------------ | ---------------- |
| Unidade de grade         | 42 mm × 42 mm    |
| Meia unidade de grade    | 21 mm            |
| Unidade de altura (1U)   | 7 mm             |
| Espessura da placa-base  | ~5 mm            |
| Mesa de impressão padrão | 256 mm           |
| Grade máx. (ferramenta)  | 50 × 50 unidades |

## Próximos passos

Agora que você conhece os tamanhos, [gere um bin personalizado](/pt-BR/gridfinity-bin-generator) ou abra o [planejador de layout](/) para ver como os bins cabem na sua gaveta.

Novo no Gridfinity? [Aqui está uma visão geral](/pt-BR/what-is-gridfinity) de como o sistema funciona.

[CTA: Planejar meu layout](/)
