---
title: Gridfinity-storlekar — Bin-mått och enhetsguide
description: Hur stor är en Gridfinity-enhet? 42-mm-rutnät, höjdsteg om 7 mm. Snabba referenstabeller för bins, lådomvandling och vad som passar var.
keywords: gridfinity storlekar, gridfinity mått, gridfinity bin-storlekar, gridfinity höjdenheter, gridfinity 42mm, gridfinity rutnät
schema: Article
breadcrumbs:
  - name: Start
    url: https://gridfinitylayouttool.com/sv/
  - name: Storleksreferens
    url: https://gridfinitylayouttool.com/sv/gridfinity-sizes
faqs:
  - q: Hur stor är en Gridfinity-rutnätsenhet?
    a: En Gridfinity-rutnätsenhet mäter 42 mm × 42 mm. En 2×3-bin är 84 mm bred och 126 mm djup. Alla Gridfinity-bins och -bottenplattor använder denna standard.
  - q: Hur hög är en Gridfinity-höjdenhet?
    a: En höjdenhet (1U) är 7 mm. En 3U-bin har cirka 21 mm invändig höjd. Vanliga höjder är från 2U (14 mm) till 10U (70 mm).
  - q: Hur räknar jag ut hur många Gridfinity-enheter som ryms i min låda?
    a: Mät lådans invändiga bredd och djup i millimeter. Dela vardera med 42 och avrunda nedåt. En låda på 380 mm × 260 mm rymmer till exempel 9 × 6 Gridfinity-enheter.
  - q: Vad är halv-bin-läge?
    a: Halv-bin-läge tillåter steg om 0,5 enheter (21 mm) för bins som måste passa i utrymmen mindre än en hel rutnätsenhet. En 1,5×2-bin blir då 63 mm × 84 mm.
---

# Gridfinity-storlekar och -mått

Gridfinity använder två tal: **rutnätsenheter** för bin:ens bredd och djup och **höjdenheter** för höjden. När du känner dem vet du vad som ryms i din låda och vilka bins du ska skriva ut.

## Rutnätsenheter (bredd och djup)

**1 rutnätsenhet = 42 mm.** Varje Gridfinity-bin och bottenplatta använder detta. En "2×3"-bin är 2 enheter bred (84 mm) och 3 enheter djup (126 mm).

| Rutnätsstorlek | Millimeter | Tum (ca) |
| -------------- | ---------- | -------- |
| 1 enhet        | 42 mm      | 1,65″    |
| 2 enheter      | 84 mm      | 3,31″    |
| 3 enheter      | 126 mm     | 4,96″    |
| 4 enheter      | 168 mm     | 6,61″    |
| 5 enheter      | 210 mm     | 8,27″    |
| 6 enheter      | 252 mm     | 9,92″    |
| 7 enheter      | 294 mm     | 11,57″   |
| 8 enheter      | 336 mm     | 13,23″   |

### Halv-bin-läge

För tätare passform använder halv-bin-läget **steg om 0,5 enheter (21 mm)**. En 1,5×2,5-bin blir 63 mm × 105 mm. Aktivera i layout-verktyget med `H`.

## Höjdenheter

**1 höjdenhet (1U) = 7 mm.** Det är det vertikala utrymmet inuti bin. En 3U-bin rymmer föremål upp till cirka 21 mm höga.

| Höjd | Invändigt (mm) | Typisk användning                   |
| ---- | -------------- | ----------------------------------- |
| 2U   | 14 mm          | SD-kort, små skruvar, gem           |
| 3U   | 21 mm          | USB-stickor, AA-batterier, bultar   |
| 4U   | 28 mm          | Pennor, märkpennor, borrar          |
| 5U   | 35 mm          | Saxar, tejprullar, små verktyg      |
| 6U   | 42 mm          | Skruvmejslar, tänger (standarddjup) |
| 7U   | 49 mm          | Sprejburkar, större handverktyg     |
| 8U   | 56 mm          | Limflaskor, höga behållare          |
| 10U  | 70 mm          | Djup förvaring, skrymmande föremål  |

> **Höjdkontroll:** Din högsta bin plus bottenplattan (~5 mm) måste få plats med lådan stängd. Mät lådans invändiga höjd i stängt läge innan du satsar på höga bins.

## Räkna om lådans mått

Ta lådans invändiga mått i millimeter. Sedan:

1. Mät invändig bredd och djup i millimeter
2. Dela vardera med 42
3. Avrunda nedåt till närmaste hela tal (eller halva i halv-bin-läge)

### Exempel

```text
Lådbredd: 380 mm ÷ 42 = 9,04 → 9 enheter
Lådjup:   520 mm ÷ 42 = 12,38 → 12 enheter
Layoutstorlek: 9 × 12 (378 mm × 504 mm)
Kantglapp: 2 mm bredd, 16 mm djup
```

Små glapp i kanterna är normalt. Bottenplattor behöver inte täcka varje millimeter. De flesta centrerar bottenplattorna och ignorerar glappet.

## Vanliga bin-storlekar

Det här skriver de flesta ut. Du kan skapa alla (eller en anpassad storlek) i [bin-generatorn](/sv/gridfinity-bin-generator).

| Bin | Mått (mm) | Vanliga användningar                       |
| --- | --------- | ------------------------------------------ |
| 1×1 | 42 × 42   | Enskilda skruvar, muttrar, små komponenter |
| 1×2 | 42 × 84   | Pennor, USB-kablar, batterier i rad        |
| 1×3 | 42 × 126  | Skruvmejslar, linjaler, långa verktyg      |
| 2×2 | 84 × 84   | Tejp, limstift, måttband                   |
| 2×3 | 84 × 126  | Tänger, kabelklippare, medelstora verktyg  |
| 3×3 | 126 × 126 | Borrset, stora tillbehör                   |
| 4×2 | 168 × 84  | Hylsor, skjutmått                          |

## Får det plats på din skrivarbädd?

De flesta FDM-skrivare har en 220–256 mm bädd, vilket hanterar bins upp till cirka 5×5 eller 6×6 enheter. Större måste delas eller skrivas ut i sektioner. Layout-verktyget utgår från 256 mm och markerar bins som inte ryms.

## Snabbreferens

| Mått                  | Värde           |
| --------------------- | --------------- |
| Rutnätsenhet          | 42 mm × 42 mm   |
| Halv rutnätsenhet     | 21 mm           |
| Höjdenhet (1U)        | 7 mm            |
| Bottenplatta-tjocklek | ~5 mm           |
| Standardbädd          | 256 mm          |
| Max rutnät (verktyg)  | 50 × 50 enheter |

## Nästa steg

Nu när du kan storlekarna kan du [generera en egen bin](/sv/gridfinity-bin-generator) eller öppna [layout-planeraren](/sv/) för att se hur bins passar i din låda.

Ny på Gridfinity? [Här är en snabbintroduktion](/sv/what-is-gridfinity) till systemet.

[CTA: Planera min layout](/)
