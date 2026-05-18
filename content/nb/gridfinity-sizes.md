---
title: Gridfinity-størrelser — Bin-mål og enhetsveiledning
description: Hvor stor er en Gridfinity-enhet? 42-mm-rutenett, høydeintervaller på 7 mm. Raske referansetabeller for bins, skuffeomregning og hva som passer hvor.
keywords: gridfinity størrelser, gridfinity mål, gridfinity bin-størrelser, gridfinity høydeenheter, gridfinity 42mm, gridfinity rutenett
schema: Article
breadcrumbs:
  - name: Start
    url: https://gridfinitylayouttool.com/nb/
  - name: Størrelsesreferanse
    url: https://gridfinitylayouttool.com/nb/gridfinity-sizes
faqs:
  - q: Hvor stor er en Gridfinity-rutenettsenhet?
    a: Én Gridfinity-rutenettsenhet er 42 mm × 42 mm. En 2×3-bin er 84 mm bred og 126 mm dyp. Alle Gridfinity-bins og -grunnplater bruker denne standarden.
  - q: Hvor høy er en Gridfinity-høydeenhet?
    a: Én høydeenhet (1U) er 7 mm. En 3U-bin har omtrent 21 mm innvendig høyde. Vanlige høyder går fra 2U (14 mm) til 10U (70 mm).
  - q: Hvordan regner jeg ut hvor mange Gridfinity-enheter som får plass i skuffen min?
    a: Mål skuffens innvendige bredde og dybde i millimeter. Del hver på 42 og rund ned. En skuff på 380 mm × 260 mm rommer for eksempel 9 × 6 Gridfinity-enheter.
  - q: Hva er halv-bin-modus?
    a: Halv-bin-modus tillater steg på 0,5 enhet (21 mm) for bins som må passe i mindre plass enn en hel rutenettsenhet. En 1,5×2-bin blir 63 mm × 84 mm.
---

# Gridfinity-størrelser og -mål

Gridfinity bruker to tall: **rutenettsenheter** for binens bredde og dybde, og **høydeenheter** for høyden. Når du kjenner dem, vet du hva som passer i skuffen og hvilke bins du skal skrive ut.

## Rutenettsenheter (bredde og dybde)

**1 rutenettsenhet = 42 mm.** Hver Gridfinity-bin og grunnplate bruker dette. En "2×3"-bin er 2 enheter bred (84 mm) og 3 enheter dyp (126 mm).

| Rutenettstørrelse | Millimeter | Tommer (ca.) |
| ----------------- | ---------- | ------------ |
| 1 enhet           | 42 mm      | 1,65″        |
| 2 enheter         | 84 mm      | 3,31″        |
| 3 enheter         | 126 mm     | 4,96″        |
| 4 enheter         | 168 mm     | 6,61″        |
| 5 enheter         | 210 mm     | 8,27″        |
| 6 enheter         | 252 mm     | 9,92″        |
| 7 enheter         | 294 mm     | 11,57″       |
| 8 enheter         | 336 mm     | 13,23″       |

### Halv-bin-modus

For tettere passform bruker halv-bin-modus **steg på 0,5 enhet (21 mm)**. En 1,5×2,5-bin blir 63 mm × 105 mm. Aktiver i layout-verktøyet med `H`.

## Høydeenheter

**1 høydeenhet (1U) = 7 mm.** Det er den vertikale plassen i binen. En 3U-bin rommer ting opp til omtrent 21 mm høye.

| Høyde | Innvendig (mm) | Typisk bruk                          |
| ----- | -------------- | ------------------------------------ |
| 2U    | 14 mm          | SD-kort, små skruer, binders         |
| 3U    | 21 mm          | USB-pinner, AA-batterier, bolter     |
| 4U    | 28 mm          | Penner, tusjer, bor                  |
| 5U    | 35 mm          | Sakser, tape-ruller, små verktøy     |
| 6U    | 42 mm          | Skrutrekkere, tenger (standarddybde) |
| 7U    | 49 mm          | Sprayboks, større håndverktøy        |
| 8U    | 56 mm          | Limflasker, høye beholdere           |
| 10U   | 70 mm          | Dyp oppbevaring, omfangsrike ting    |

> **Klaringssjekk:** Den høyeste binen din pluss grunnplaten (~5 mm) må få plass med skuffen lukket. Mål skuffens innvendige høyde i lukket tilstand før du satser på høye bins.

## Regn om skuffens mål

Få skuffens innvendige mål i millimeter. Så:

1. Mål innvendig bredde og dybde i millimeter
2. Del hver på 42
3. Rund ned til nærmeste hele tall (eller halvt i halv-bin-modus)

### Eksempel

```text
Skuffbredde: 380 mm ÷ 42 = 9,04 → 9 enheter
Skuffdybde:  520 mm ÷ 42 = 12,38 → 12 enheter
Layoutmål:   9 × 12 (378 mm × 504 mm)
Kantglipp:   2 mm bredde, 16 mm dybde
```

Små glipper i kantene er normale. Grunnplater trenger ikke dekke hver millimeter. De fleste sentrerer grunnplatene og ignorerer glippen.

## Vanlige bin-størrelser

Dette skriver de fleste ut. Du kan lage alle (eller en egendefinert størrelse) i [bin-generatoren](/nb/gridfinity-bin-generator).

| Bin | Mål (mm)  | Vanlig bruk                            |
| --- | --------- | -------------------------------------- |
| 1×1 | 42 × 42   | Enkeltskruer, muttere, små komponenter |
| 1×2 | 42 × 84   | Penner, USB-kabler, batterier på rad   |
| 1×3 | 42 × 126  | Skrutrekkere, linjaler, lange verktøy  |
| 2×2 | 84 × 84   | Tape, limstifter, målebånd             |
| 2×3 | 84 × 126  | Tenger, kuttere, mellomstore verktøy   |
| 3×3 | 126 × 126 | Borsett, store tilbehør                |
| 4×2 | 168 × 84  | Pipenøkler, skyvelærer                 |

## Får det plass på skriverbordet?

De fleste FDM-skrivere har 220-256 mm bord, som håndterer bins opp til cirka 5×5 eller 6×6 enheter. Større må deles eller skrives ut i seksjoner. Layout-verktøyet bruker standardmål 256 mm og markerer bins som ikke passer.

## Hurtigreferanse

| Mål                     | Verdi           |
| ----------------------- | --------------- |
| Rutenettsenhet          | 42 mm × 42 mm   |
| Halv rutenettsenhet     | 21 mm           |
| Høydeenhet (1U)         | 7 mm            |
| Grunnplate-tykkelse     | ~5 mm           |
| Standard skriverbord    | 256 mm          |
| Maks rutenett (verktøy) | 50 × 50 enheter |

## Neste trinn

Nå som du kan størrelsene, kan du [generere en egen bin](/nb/gridfinity-bin-generator) eller åpne [layout-planleggeren](/nb/) for å se hvordan bins passer i skuffen.

Ny på Gridfinity? [Her er en kort oversikt](/nb/what-is-gridfinity) over systemet.

[CTA: Planlegg layouten min](/)
