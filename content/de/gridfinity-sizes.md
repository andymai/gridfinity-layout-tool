---
title: Gridfinity-Größen — Bin-Maße und Einheiten-Übersicht
description: Wie groß ist eine Gridfinity-Einheit? 42-mm-Raster, 7-mm-Höhenstufen. Schnellreferenz für Bin-Größen, Schubladenumrechnung und was wohin passt.
keywords: gridfinity größen, gridfinity maße, gridfinity bin größen, gridfinity höheneinheiten, gridfinity 42mm, gridfinity rastergröße
schema: Article
breadcrumbs:
  - name: Start
    url: https://gridfinitylayouttool.com/
  - name: Größenübersicht
    url: https://gridfinitylayouttool.com/de/gridfinity-sizes
faqs:
  - q: Wie groß ist eine Gridfinity-Rastereinheit?
    a: Eine Gridfinity-Rastereinheit ist 42 mm × 42 mm. Ein 2×3-Bin ist 84 mm breit und 126 mm tief. Alle Gridfinity-Bins und -Grundplatten nutzen diesen Standard.
  - q: Wie hoch ist eine Gridfinity-Höheneinheit?
    a: Eine Höheneinheit (1U) ist 7 mm. Ein 3U-Bin hat etwa 21 mm Innenhöhe. Gängige Höhen reichen von 2U (14 mm) bis 10U (70 mm).
  - q: Wie berechne ich, wie viele Gridfinity-Einheiten in meine Schublade passen?
    a: Miss die Innenbreite und -tiefe deiner Schublade in Millimetern. Teile jeweils durch 42 und runde ab. Eine 380 mm × 260 mm große Schublade fasst zum Beispiel 9 × 6 Gridfinity-Einheiten.
  - q: Was ist der Halb-Bin-Modus?
    a: Der Halb-Bin-Modus erlaubt 0,5-Einheit-Schritte (21 mm) für Bins, die in Bereiche kleiner als eine volle Rastereinheit passen müssen. Ein 1,5×2-Bin wäre 63 mm × 84 mm.
---

# Gridfinity-Größen und Maße

**Die Standard-Gridfinity-Maße: eine Rastereinheit ist 42 mm × 42 mm (Breite und Tiefe), eine Höheneinheit (1U) ist 7 mm.** Jeder Bin und jede Grundplatte ist ein Vielfaches dieser zwei Zahlen — ein 2×3-Bin mit 6U misst 84 mm × 126 mm × 42 mm. Der Halb-Bin-Modus ergänzt 0,5er-Schritte (21 mm). Sobald du diese zwei Zahlen kennst, weißt du, was in deine Schublade passt und welche Bins du drucken solltest.

## Rastereinheiten (Breite und Tiefe)

**1 Rastereinheit = 42 mm.** Jeder Gridfinity-Bin und jede Grundplatte nutzt das. Ein „2×3"-Bin ist 2 Einheiten breit (84 mm) und 3 Einheiten tief (126 mm).

| Rastergröße | Millimeter | Zoll (ca.) |
| ----------- | ---------- | ---------- |
| 1 Einheit   | 42 mm      | 1,65″      |
| 2 Einheiten | 84 mm      | 3,31″      |
| 3 Einheiten | 126 mm     | 4,96″      |
| 4 Einheiten | 168 mm     | 6,61″      |
| 5 Einheiten | 210 mm     | 8,27″      |
| 6 Einheiten | 252 mm     | 9,92″      |
| 7 Einheiten | 294 mm     | 11,57″     |
| 8 Einheiten | 336 mm     | 13,23″     |

### Halb-Bin-Modus

Für engere Passungen nutzt der Halb-Bin-Modus **0,5-Einheit-Schritte (21 mm)**. Ein 1,5×2,5-Bin wäre 63 mm × 105 mm. Im Layout-Tool mit `H` aktivieren.

## Höheneinheiten

**1 Höheneinheit (1U) = 7 mm.** So viel vertikalen Platz hast du im Bin. Ein 3U-Bin hält Teile bis ca. 21 mm Höhe.

| Höhe | Innen (mm) | Typische Nutzung                          |
| ---- | ---------- | ----------------------------------------- |
| 2U   | 14 mm      | SD-Karten, kleine Schrauben, Büroklammern |
| 3U   | 21 mm      | USB-Sticks, AA-Batterien, Bolzen          |
| 4U   | 28 mm      | Stifte, Marker, Bohrer                    |
| 5U   | 35 mm      | Scheren, Klebebandrollen, Kleinwerkzeug   |
| 6U   | 42 mm      | Schraubendreher, Zangen (Standardtiefe)   |
| 7U   | 49 mm      | Spraydosen, größeres Handwerkzeug         |
| 8U   | 56 mm      | Klebeflaschen, hohe Behälter              |
| 10U  | 70 mm      | Tiefe Lagerung, sperrige Teile            |

> **Höhenprüfung:** Dein höchster Bin plus Grundplatte (~5 mm) muss in die geschlossene Schublade passen. Miss die Innenhöhe der geschlossenen Schublade, bevor du hohe Bins planst.

## Schubladenmaße umrechnen

Mit dem Maßband die Innenmaße der Schublade in Millimetern erfassen. Dann:

1. Innenbreite und -tiefe in Millimetern messen
2. Jeweils durch 42 teilen
3. Auf die nächste ganze Zahl abrunden (oder halbe Zahl im Halb-Bin-Modus)

### Beispiel

```text
Schubladenbreite: 380 mm ÷ 42 = 9,04 → 9 Einheiten
Schubladentiefe:  520 mm ÷ 42 = 12,38 → 12 Einheiten
Layout-Größe:     9 × 12 (378 mm × 504 mm)
Lücke am Rand:    2 mm Breite, 16 mm Tiefe
```

Kleine Lücken am Rand sind normal. Grundplatten müssen nicht jeden Millimeter abdecken. Meistens wird die Grundplatte mittig platziert und die Lücke ignoriert.

## Gängige Bin-Größen

Diese werden am häufigsten gedruckt. Alle (oder eine beliebige andere Größe) lassen sich im [Bin-Generator](/de/gridfinity-bin-generator) erstellen.

| Bin-Größe | Maße (mm) | Typische Nutzung                            |
| --------- | --------- | ------------------------------------------- |
| 1×1       | 42 × 42   | Einzelne Schrauben, Muttern, Kleinteile     |
| 1×2       | 42 × 84   | Stifte, USB-Kabel, Batterien in einer Reihe |
| 1×3       | 42 × 126  | Schraubendreher, Lineale, lange Werkzeuge   |
| 2×2       | 84 × 84   | Klebeband, Klebestifte, Maßbänder           |
| 2×3       | 84 × 126  | Zangen, Drahtschneider, mittleres Werkzeug  |
| 3×3       | 126 × 126 | Bohrer-Sets, große Zubehörteile             |
| 4×2       | 168 × 84  | Steckschlüssel, Messschieber                |

## Passt es auf dein Druckbett?

Die meisten FDM-Drucker haben ein 220–256 mm Bett, das Bins bis ca. 5×5 oder 6×6 Einheiten handhabt. Größere werden geteilt oder in Abschnitten gedruckt. Das Layout-Tool nutzt standardmäßig 256 mm und markiert Bins, die nicht passen.

## Schnellreferenz

| Maß                 | Wert              |
| ------------------- | ----------------- |
| Rastereinheit       | 42 mm × 42 mm     |
| Halbe Rastereinheit | 21 mm             |
| Höheneinheit (1U)   | 7 mm              |
| Grundplattendicke   | ~5 mm             |
| Standard-Druckbett  | 256 mm            |
| Maximales Raster    | 50 × 50 Einheiten |

## Nächste Schritte

Jetzt, wo du die Größen kennst, kannst du einen [individuellen Bin generieren](/de/gridfinity-bin-generator) oder den [Layout-Planer](/) öffnen, um zu sehen, wie Bins in deine Schublade passen.

Neu bei Gridfinity? [Hier ist die Kurzfassung](/de/what-is-gridfinity) zum System.

[CTA: Layout planen](/)
