---
title: Eine Gridfinity-Schublade planen — Anleitung
description: Praktischer Leitfaden zum Planen von Gridfinity-Schubladenlayouts. Schublade ausmessen, passende Bins bestimmen und eine Druckliste exportieren.
keywords: gridfinity planer, gridfinity layout, gridfinity planen, schubladeneinsatz planen, gridfinity anleitung
schema: HowTo
breadcrumbs:
  - name: Start
    url: https://gridfinitylayouttool.com/
  - name: Planungsleitfaden
    url: https://gridfinitylayouttool.com/de/guide
faqs:
  - q: Wie messe ich eine Schublade für Gridfinity aus?
    a: Miss die Innenmaße der Schublade in Millimetern — Breite (links nach rechts), Tiefe (vorn nach hinten) und Höhe (vom Boden bis zur geschlossenen Decke). Miss an mehreren Stellen, weil Schubladen selten exakte Rechtecke sind, und nimm pro Dimension den kleinsten Wert, um sicherzugehen.
  - q: Wie rechne ich Schubladenmaße in Gridfinity-Rastereinheiten um?
    a: Teile jede Dimension durch 42 mm und runde ab. Eine 380 mm × 260 mm große Schublade fasst zum Beispiel ein 9×6-Raster (378 mm × 252 mm) — kleine Lücken am Rand bleiben. Das ist in Ordnung, Grundplatten müssen nicht jeden Millimeter füllen.
  - q: Welche Bin-Größen sollte ich für Gridfinity nehmen?
    a: Als Ausgangspunkt — 1×1 mit Trennstegen für kleine Schrauben und Bauteile; 1×2 oder 2×2 für Stifte, USB-Sticks und Batterien; 1×3 oder 1×4 für Schraubendreher und Zangen; 2×2 oder 2×3 für Klebeband und Kleber; 3×3 oder größer für großes Werkzeug. Du kannst später jederzeit andere Größen drucken, falls etwas nicht passt.
  - q: Wie hoch kann ein Gridfinity-Bin sein?
    a: Die Höhe ist nur durch die Schubladenhöhe und den Z-Aufbauraum deines Druckers begrenzt. Höhen werden in 7-mm-Einheiten (U) gemessen. Ein 6U-Bin ist innen 42 mm hoch, ein 9U-Bin 63 mm. Prüfe vor dem Druck deinen höchsten Bin plus 5 mm für die Grundplatte gegen die Schubladenhöhe im geschlossenen Zustand.
  - q: Sollte ich mehrere Ebenen in tiefen Schubladen nutzen?
    a: Ja, falls Höhe zur Verfügung steht. Stapele Bins vertikal mit Ebene 1 unten. Schweres unten, häufig Genutztes oben. Funktioniert gut, um Flaches (Kabel) von hohen Bins zu trennen oder Elektrik und Mechanik auseinanderzuhalten.
  - q: Wie exportiere ich eine Gridfinity-Druckliste?
    a: Sobald dein Layout fertig ist, zeigt die Druckliste jede Bin-Größe, die benötigte Anzahl, Filamentschätzungen in Gramm und Such-Links für jede Größe auf Printables, Thangs und MakerWorld. Du kannst auch Custom-Bins direkt im integrierten Bin-Generator erzeugen und als STL-, STEP- oder 3MF-Datei exportieren.
  - q: Wie viel Leerraum sollte ich in einer Gridfinity-Schublade lassen?
    a: Lass 10–20 % frei. Eine heute zu 100 % verplante Schublade wird zum Problem, sobald deine Sammlung wächst oder sich der Bedarf ändert. Leere Rasterfelder kosten nichts und geben Spielraum für später.
  - q: Welcher Drucker ist der beste für Gridfinity?
    a: Jeder FDM-Drucker mit mindestens 256 mm × 256 mm Druckbett druckt Gridfinity-Bins problemlos. Bambu Lab X1, A1 und P1S sind wegen ihrer Geschwindigkeit beliebt. Prusa MK4 und Ender 3 V3 KE funktionieren ebenfalls gut. Für Schubladen größer als 6×6 Einheiten kachelst du entweder die Grundplatten oder nimmst einen Drucker mit größerem Format wie Bambu X1E oder Voron 2.4.
---

# Eine Gridfinity-Schublade planen — Anleitung

Drucken ohne Plan verschwendet Filament. Du druckst Bins nach, weil du Größen falsch geschätzt hast, lässt ungewollte Lücken oder vergisst, was du eigentlich brauchst. Diese Anleitung zeigt, wie du vor dem Druck misst, planst und eine Druckliste bekommst.

## Schublade ausmessen

Hol dir die Innenmaße in Millimetern. Du brauchst:

- **Breite** — links nach rechts
- **Tiefe** — vorn nach hinten
- **Höhe** — Boden bis Decke (Freiraum bei geschlossener Schublade)

Miss an mehreren Stellen. Schubladen sind selten exakte Rechtecke, besonders bei älteren Möbeln. Nimm zur Sicherheit den kleinsten Wert.

### In Rastereinheiten umrechnen

Gridfinity nutzt 42-mm-Einheiten. Teilen und abrunden:

```text
Breite: 380 mm ÷ 42 = 9,04 → 9 Einheiten
Tiefe:  260 mm ÷ 42 = 6,19 → 6 Einheiten
```

Ein 9×6-Raster sind 378 mm × 252 mm. Du hast kleine Lücken am Rand — das ist okay. Grundplatten müssen nicht jeden Millimeter füllen.

## Klären, was reinkommt

Den Schritt überspringen die meisten — und bereuen es.

Nimm alles aus der Schublade. Gruppieren:

- Tägliche Sachen
- Wöchentliche Sachen
- Zeug, das du vergessen hattest

Das Tägliche muss greifbar sein. Das Wöchentliche kann nach hinten. Das Vergessene braucht vielleicht gar keinen Bin.

### Gegenstände den Bin-Größen zuordnen

Grobe Richtwerte:

| Inhalt                        | Bin-Größe         |
| ----------------------------- | ----------------- |
| M3-Schrauben, Kleinteile      | 1×1 mit Trennsteg |
| Stifte, USB-Sticks, Batterien | 1×2 oder 2×2      |
| Schraubendreher, Zangen       | 1×3 oder 1×4      |
| Klebeband, Klebeflaschen      | 2×2 oder 2×3      |
| Großes Werkzeug               | 3×3 oder größer   |

Verbeiß dich nicht — du kannst später immer andere Bins drucken.

## Das Layout planen

Öffne das Tool und stelle die Rastergröße ein. Ziehe Bins auf. Das Tool verhindert Überlappung und Überlauf.

**Häufig Benutztes nach vorn.** Was greifst du beim Öffnen zuerst? Das gehört nach vorn.

**Zusammengehöriges gruppieren.** Schraubendreher an einer Stelle, Messwerkzeug an einer anderen. Du erinnerst dich später leichter.

**Etwas Leerraum lassen.** Deine Sammlung wächst. Eine heute zu 100 % verplante Schublade ist morgen ein Problem.

### Ebenen für tiefe Schubladen

Bei genug Höhe kannst du Bins vertikal stapeln. Ebene 1 ist unten.

Funktioniert gut für:

- Flaches unten (Kabel, Kleinteile), höhere Bins darüber
- Elektrik und Mechanik trennen

Schweres unten, häufig Genutztes oben.

## Druckliste exportieren

Wenn das Layout sitzt, exportierst du eine Druckliste:

- Jede Bin-Größe mit Stückzahl
- Filamentschätzung in Gramm
- Such-Links pro Größe

### STL-Dateien finden

Du kannst [Custom-Bins generieren](/de/gridfinity-bin-generator) — direkt im integrierten Bin-Generator: Maße wählen, Boden, Kompartimente, dann als STL, STEP oder 3MF exportieren.

Für Spezialbins (werkzeugspezifische Halter, komplexe Formen) durchsuche die Community-Quellen:

- [Printables](https://www.printables.com/search/models?q=gridfinity) — größte Auswahl
- [Thangs](https://thangs.com/search/gridfinity) — gut für ähnliche Designs
- [MakerWorld](https://makerworld.com/en/search/models?keyword=gridfinity) — Bambu-Lab-Community

Beispielsuche: „gridfinity 2x2 3U“ findet 2×2-Bins mit 3 Höheneinheiten.

## Vor dem Druck

### Erst mit Pappe testen

> Schneide Pappe auf deine Bin-Größen (42 mm pro Rastereinheit) und ordne sie in der Schublade an. Fühlt sich etwas falsch an, hast du noch kein Filament verbraucht.

### Erst einen Bin drucken

Druck einen Bin, bevor du 20 druckst. Prüfe Passung, Höhe und Designgefühl. Passe Druckereinstellungen bei Bedarf an.

### Höhe prüfen

Dein höchster Bin plus Grundplatte (etwa 5 mm) muss in die geschlossene Schublade passen. Vor dem Druck hoher Bins prüfen.

## Häufige Fehler

**Zu viele winzige Bins.** Ein Raster aus 1×1-Bins sieht ordentlich aus, ist aber im Alltag nervig. Größere Bins mit Trennstegen sind meist besser.

**Jedes Feld füllen.** Lässt keinen Platz für Neues. Plane 10–20 % Leerraum ein.

**Ignorieren, was du tatsächlich nutzt.** Organisiere nicht nach Wunschvorstellung, sondern nach dem, was du wirklich greifst.

[CTA: Layout-Tool öffnen](/)
