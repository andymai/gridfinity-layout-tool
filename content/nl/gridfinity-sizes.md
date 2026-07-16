---
title: Gridfinity-maten — Bin-afmetingen en eenheden-gids
description: Hoe groot is een Gridfinity-eenheid? 42-mm-raster, hoogtestappen van 7 mm. Snelle referentietabellen voor bins, lade-conversie en wat waar past.
keywords: gridfinity maten, gridfinity afmetingen, gridfinity bin maten, gridfinity hoogte-eenheden, gridfinity 42mm, gridfinity raster
schema: Article
breadcrumbs:
  - name: Start
    url: https://gridfinitylayouttool.com/
  - name: Maatreferentie
    url: https://gridfinitylayouttool.com/nl/gridfinity-sizes
faqs:
  - q: Hoe groot is een Gridfinity-rastereenheid?
    a: Eén Gridfinity-rastereenheid is 42 mm × 42 mm. Een 2×3-bin is 84 mm breed en 126 mm diep. Alle Gridfinity-bins en -bodemplaten gebruiken deze standaard.
  - q: Hoe hoog is een Gridfinity-hoogte-eenheid?
    a: Eén hoogte-eenheid (1U) is 7 mm. Een 3U-bin heeft zo'n 21 mm binnenwerkse hoogte. Gangbare hoogtes lopen van 2U (14 mm) tot 10U (70 mm).
  - q: Hoe bereken ik hoeveel Gridfinity-eenheden in mijn lade passen?
    a: Meet de binnenwerkse breedte en diepte in millimeters. Deel beide door 42 en rond af naar beneden. Een lade van 380 mm × 260 mm omvat bijvoorbeeld 9 × 6 Gridfinity-eenheden.
  - q: Wat is half-bin-modus?
    a: Half-bin-modus laat stappen van 0,5 eenheid (21 mm) toe voor bins die in ruimtes kleiner dan een hele rastereenheid moeten passen. Een 1,5×2-bin is dan 63 mm × 84 mm.
---

# Gridfinity-maten en -afmetingen

**Standaard Gridfinity-maten: één rastereenheid is 42 mm × 42 mm (breedte en diepte), en één hoogte-eenheid (1U) is 7 mm.** Elke bin en elke bodemplaat is een veelvoud van deze twee getallen — een 2×3-bin van 6U meet 84 mm × 126 mm × 42 mm. De halve-bin-modus voegt stappen van 0,5 eenheid (21 mm) toe. Als je deze twee getallen kent, weet je wat in je lade past en welke bins je print.

## Rastereenheden (breedte en diepte)

**1 rastereenheid = 42 mm.** Elke Gridfinity-bin en bodemplaat gebruikt dit. Een "2×3"-bin is 2 eenheden breed (84 mm) en 3 eenheden diep (126 mm).

| Rastergrootte | Millimeters | Inches (ca.) |
| ------------- | ----------- | ------------ |
| 1 eenheid     | 42 mm       | 1,65″        |
| 2 eenheden    | 84 mm       | 3,31″        |
| 3 eenheden    | 126 mm      | 4,96″        |
| 4 eenheden    | 168 mm      | 6,61″        |
| 5 eenheden    | 210 mm      | 8,27″        |
| 6 eenheden    | 252 mm      | 9,92″        |
| 7 eenheden    | 294 mm      | 11,57″       |
| 8 eenheden    | 336 mm      | 13,23″       |

### Half-bin-modus

Voor strakkere pasvorm gebruikt half-bin-modus **stappen van 0,5 eenheid (21 mm)**. Een 1,5×2,5-bin is dan 63 mm × 105 mm. Activeer dit in de layout-tool met `H`.

## Hoogte-eenheden

**1 hoogte-eenheid (1U) = 7 mm.** Dat is de verticale ruimte in de bin. Een 3U-bin houdt spullen tot zo'n 21 mm hoog.

| Hoogte | Binnen (mm) | Typisch gebruik                             |
| ------ | ----------- | ------------------------------------------- |
| 2U     | 14 mm       | SD-kaarten, kleine schroeven, paperclips    |
| 3U     | 21 mm       | USB-sticks, AA-batterijen, bouten           |
| 4U     | 28 mm       | Pennen, markers, boortjes                   |
| 5U     | 35 mm       | Scharen, tape-rollen, klein gereedschap     |
| 6U     | 42 mm       | Schroevendraaiers, tangen (standaarddiepte) |
| 7U     | 49 mm       | Spuitbussen, groter handgereedschap         |
| 8U     | 56 mm       | Lijmflessen, hoge containers                |
| 10U    | 70 mm       | Diepe opslag, omvangrijke spullen           |

> **Vrije-hoogte-check:** Je hoogste bin plus bodemplaat (~5 mm) moet passen bij gesloten lade. Meet de binnenwerkse hoogte van de gesloten lade voor je je vastlegt op hoge bins.

## Lade-afmetingen omrekenen

Pak een rolmaat en haal de binnenwerkse afmetingen in millimeters. Dan:

1. Meet binnenwerkse breedte en diepte in millimeters
2. Deel beide door 42
3. Rond af naar beneden naar het hele getal (of half in half-bin-modus)

### Voorbeeld

```text
Ladebreedte:  380 mm ÷ 42 = 9,04 → 9 eenheden
Ladediepte:   520 mm ÷ 42 = 12,38 → 12 eenheden
Layoutmaat:   9 × 12 (378 mm × 504 mm)
Speling rand: 2 mm breedte, 16 mm diepte
```

Kleine spelingen aan de randen zijn normaal. Bodemplaten hoeven niet elke millimeter te vullen. Meestal worden de bodemplaten gecentreerd en wordt de speling genegeerd.

## Gangbare bin-formaten

Dit is wat de meeste mensen printen. Je kunt alle (of een eigen maat) maken in de [bin-generator](/nl/gridfinity-bin-generator).

| Bin | Afmetingen (mm) | Veelvoorkomende gebruiken                      |
| --- | --------------- | ---------------------------------------------- |
| 1×1 | 42 × 42         | Losse schroeven, moeren, mini-componenten      |
| 1×2 | 42 × 84         | Pennen, USB-kabels, batterijen op een rij      |
| 1×3 | 42 × 126        | Schroevendraaiers, linialen, lang gereedschap  |
| 2×2 | 84 × 84         | Tape, lijmstiften, meetlinten                  |
| 2×3 | 84 × 126        | Tangen, draadknippers, middelgroot gereedschap |
| 3×3 | 126 × 126       | Boorbits-sets, grote accessoires               |
| 4×2 | 168 × 84        | Doppen, schuifmaten                            |

## Past het op je printbed?

De meeste FDM-printers hebben een bed van 220-256 mm, geschikt voor bins tot ongeveer 5×5 of 6×6 eenheden. Groter splits je of print je in secties. De layout-tool gaat standaard uit van 256 mm en signaleert bins die niet passen.

## Snelle referentie

| Maat                | Waarde           |
| ------------------- | ---------------- |
| Rastereenheid       | 42 mm × 42 mm    |
| Halve rastereenheid | 21 mm            |
| Hoogte-eenheid (1U) | 7 mm             |
| Bodemplaat-dikte    | ~5 mm            |
| Standaard printbed  | 256 mm           |
| Max raster (tool)   | 50 × 50 eenheden |

## Volgende stappen

Nu je de maten kent, kun je een [eigen bin genereren](/nl/gridfinity-bin-generator) of de [layout-planner](/) openen om te zien hoe bins in je lade passen.

Nieuw bij Gridfinity? [Hier is een kort overzicht](/nl/what-is-gridfinity) van het systeem.

[CTA: Mijn layout plannen](/)
