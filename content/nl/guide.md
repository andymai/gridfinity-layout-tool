---
title: Een Gridfinity-lade plannen — Handleiding
description: Praktische gids voor het plannen van Gridfinity-lade-layouts. Meet je lade op, bepaal welke bins je nodig hebt en exporteer een printlijst.
keywords: gridfinity planner, gridfinity layout, gridfinity plannen, lade-organizer plannen, gridfinity gids
schema: HowTo
breadcrumbs:
  - name: Start
    url: https://gridfinitylayouttool.com/nl/
  - name: Planningsgids
    url: https://gridfinitylayouttool.com/nl/guide
faqs:
  - q: Hoe meet ik een lade op voor Gridfinity?
    a: Meet de binnenwerkse afmetingen van de lade in millimeters — breedte (links naar rechts), diepte (voor naar achter) en vrije hoogte (van bodem tot bovenkant bij gesloten lade). Meet op meerdere plekken, want lades zijn zelden perfecte rechthoeken, en gebruik per dimensie de kleinste waarde om zeker te zijn.
  - q: Hoe reken ik lade-afmetingen om naar Gridfinity-rastereenheden?
    a: Deel elke afmeting door 42 mm en rond af naar beneden. Een lade van 380 mm × 260 mm past bijvoorbeeld in een 9×6-raster (378 mm × 252 mm), met kleine spelingen aan de randen. Die speling is prima — bodemplaten hoeven niet elke millimeter te vullen.
  - q: Welke bin-formaten gebruik ik voor Gridfinity?
    a: Als uitgangspunt — 1×1 met scheiders voor kleine schroeven en componenten; 1×2 of 2×2 voor pennen, USB-sticks en batterijen; 1×3 of 1×4 voor schroevendraaiers en tangen; 2×2 of 2×3 voor tape en lijm; 3×3 of groter voor groot gereedschap. Je kunt later altijd andere maten printen als iets niet past.
  - q: Hoe hoog mag een Gridfinity-bin zijn?
    a: De hoogte wordt alleen beperkt door de vrije hoogte van je lade en de Z-as van je printer. Hoogtes worden gemeten in eenheden van 7 mm (U). Een 6U-bin is 42 mm hoog binnenwerks, een 9U-bin 63 mm. Controleer je hoogste bin plus 5 mm voor de bodemplaat tegen de vrije hoogte van de gesloten lade voor je print.
  - q: Moet ik meerdere lagen gebruiken in diepe lades?
    a: Ja, als de hoogte het toelaat. Stapel bins verticaal met laag 1 onderaan. Zwaar onderop, vaak gebruikt bovenop. Werkt goed voor platte spullen (kabels) onderin en hoge bins erboven, of voor het scheiden van elektrisch en mechanisch.
  - q: Hoe exporteer ik een Gridfinity-printlijst?
    a: Zodra je layout klaar is, toont de printlijst elk bin-formaat, het aantal, een filamentschatting in grammen en zoeklinks per formaat op Printables, Thangs en MakerWorld. Je kunt ook eigen bins genereren met de ingebouwde bin-generator en STL, STEP of 3MF exporteren.
  - q: Hoeveel lege ruimte moet ik laten in een Gridfinity-lade?
    a: Laat 10-20 % vrij. Een lade die vandaag 100 % is volgepland wordt morgen een probleem als je collectie groeit of je behoeften veranderen. Lege rastervakken kosten niks en geven ruimte om later bins toe te voegen.
  - q: Welke printer is het best voor Gridfinity?
    a: Elke FDM-printer met een printbed van minstens 256 mm × 256 mm print Gridfinity-bins moeiteloos. De Bambu Lab X1, A1 en P1S zijn populair om hun snelheid. Prusa MK4 en Ender 3 V3 KE werken ook goed. Voor lades groter dan 6×6 eenheden splits je de bodemplaten of gebruik je een grootformaat als Bambu X1E of Voron 2.4.
---

# Een Gridfinity-lade plannen — Handleiding

Printen zonder plan verspilt filament. Je herprint bins omdat je formaten verkeerd inschatte, laat gaten die je niet wilde of vergeet wat je nodig had. Deze gids loopt door hoe je meet, plant en vóór het printen een printlijst krijgt.

## Lade opmeten

Pak de binnenwerkse afmetingen in millimeters. Je hebt nodig:

- **Breedte** — van links naar rechts
- **Diepte** — van voor naar achter
- **Hoogte** — van bodem tot bovenkant (vrije hoogte bij gesloten lade)

Meet op meerdere plekken. Lades zijn zelden perfecte rechthoeken, zeker bij oudere meubels. Neem voor de zekerheid de kleinste waarde.

### Omrekenen naar rastereenheden

Gridfinity gebruikt eenheden van 42 mm. Delen en afronden naar beneden:

```text
Breedte: 380 mm ÷ 42 = 9,04 → 9 eenheden
Diepte:  260 mm ÷ 42 = 6,19 → 6 eenheden
```

Een 9×6-raster is 378 mm × 252 mm. Je krijgt kleine spelingen aan de randen — dat is prima. Bodemplaten hoeven niet elke millimeter te vullen.

## Bepaal wat erin gaat

Iedereen slaat deze stap over — en krijgt er spijt van.

Haal alles uit de lade. Groepeer:

- Dagelijkse spullen
- Wekelijkse spullen
- Spullen die je vergeten was

Het dagelijkse moet bereikbaar zijn. Het wekelijkse kan naar achteren. Het vergetene heeft misschien geen bin nodig.

### Items aan bin-formaten koppelen

Richtlijnen:

| Inhoud                           | Bin-formaat       |
| -------------------------------- | ----------------- |
| M3-schroeven, kleine componenten | 1×1 met scheiders |
| Pennen, USB-sticks, batterijen   | 1×2 of 2×2        |
| Schroevendraaiers, tangen        | 1×3 of 1×4        |
| Tape, lijm                       | 2×2 of 2×3        |
| Groot gereedschap                | 3×3 of groter     |

Niet te diep nadenken — je kunt later altijd andere bins printen.

## Layout plannen

Open de tool en stel je rastergrootte in. Sleep om bins te maken. De tool laat geen overlap of overschrijding toe.

**Vaak gebruikt naar voren.** Wat pak je als eerste bij het openen? Dat hoort vooraan.

**Gerelateerde dingen groeperen.** Schroevendraaiers op één plek, meetgereedschap op een andere. Je onthoudt makkelijker waar dingen liggen.

**Laat wat ruimte over.** Je collectie groeit. Een lade die vandaag voor 100 % is volgepland is morgen een probleem.

### Lagen voor diepe lades

Heb je hoogte, stapel bins dan verticaal. Laag 1 zit onderop.

Werkt goed voor:

- Plat onderop (kabels, kleine onderdelen), hoge bins erboven
- Elektrisch scheiden van mechanisch

Zwaar onderop, vaak gebruikt bovenop.

## Printlijst exporteren

Als je layout klaar is, exporteer je een printlijst:

- Elk bin-formaat met aantal
- Filamentschatting in grammen
- Zoeklinks per formaat

### STL-bestanden vinden

Je kunt [eigen bins genereren](/nl/gridfinity-bin-generator) met de ingebouwde bin-generator — kies afmetingen, basisstijl, vakken en exporteer als STL, STEP of 3MF.

Voor specialistische bins (gereedschap-specifieke houders, complexe vormen) zoek je in de community-bronnen:

- [Printables](https://www.printables.com/search/models?q=gridfinity) — grootste selectie
- [Thangs](https://thangs.com/search/gridfinity) — handig voor gelijkende designs
- [MakerWorld](https://makerworld.com/en/search/models?keyword=gridfinity) — Bambu Lab community

Voorbeeldzoekopdracht: "gridfinity 2x2 3U" vindt 2×2-bins van 3 hoogte-eenheden.

## Voor het printen

### Test eerst met karton

> Knip karton op bin-formaat (42 mm per rastereenheid) en leg het in de lade. Voelt iets verkeerd, dan heb je nog geen filament verspild.

### Print eerst één bin

Voor je er 20 print, print er één. Controleer pasvorm, hoogte en design-gevoel. Pas printerinstellingen aan als nodig.

### Controleer de vrije hoogte

Je hoogste bin plus bodemplaat (~5 mm) moet passen bij gesloten lade. Meet dit voor je hoge bins gaat printen.

## Veelgemaakte fouten

**Te veel mini-bins.** Een raster van 1×1-bins ziet er georganiseerd uit maar is irritant in gebruik. Grotere bins met scheiders werken meestal beter.

**Elk vak vullen.** Geen ruimte voor nieuwe spullen. Plan 10-20 % lege ruimte in.

**Negeren wat je echt gebruikt.** Organiseer niet rond wat je dénkt te bezitten. Organiseer rond wat je echt pakt.

[CTA: Layout-tool openen](/nl/)
