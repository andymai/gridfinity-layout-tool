---
title: Gridfinity-Grundplatten-Generator — Kostenloser Online-STL-Creator
description: Gridfinity-Grundplatten-Generator mit Echtzeit-3D-Vorschau. Rastergröße, Magnetlöcher, Verbindungsnoppen und Randabstand konfigurieren. Export als STL, STEP oder 3MF. Kostenloses Browser-Tool.
keywords: gridfinity grundplatte generator, gridfinity baseplate, individuelle gridfinity grundplatte, gridfinity STL, schubladen grundplatte, magnet grundplatte
schema: HowTo
breadcrumbs:
  - name: Start
    url: https://gridfinitylayouttool.com/
  - name: Grundplatten-Generator
    url: https://gridfinitylayouttool.com/de/gridfinity-baseplate-generator
howTo:
  name: So erzeugst du eine individuelle Gridfinity-Grundplatte
  description: Rastergröße festlegen, Funktionen konfigurieren, in 3D ansehen und deine individuelle Gridfinity-Grundplatte als STL, STEP oder 3MF herunterladen.
  totalTime: PT3M
  tools:
    - Webbrowser
  steps:
    - name: Grundplatten-Maße festlegen
      text: Wähle Breite und Tiefe in Gridfinity-Rastereinheiten oder synchronisiere mit deinem bestehenden Layout, um die Schubladengröße automatisch zu übernehmen.
    - name: Funktionen konfigurieren
      text: Magnetlöcher für magnetische Bin-Befestigung aktivieren, Verbindungsnoppen für Halbzellen-Ausrichtung ergänzen und Randabstand pro Seite einstellen, damit es in die Schublade passt.
    - name: In 3D ansehen
      text: Die Echtzeit-3D-Vorschau aktualisiert sich, sobald du Parameter änderst. Drehe und zoome, um die Grundplatte aus jedem Winkel zu prüfen.
    - name: Exportieren und drucken
      text: Lade deine Grundplatte als STL, STEP oder 3MF herunter. Große Grundplatten werden automatisch in druckbettgerechte Teile aufgeteilt.
softwareApplication:
  name: Gridfinity-Grundplatten-Generator
  description: Parametrischer Gridfinity-Grundplatten-Generator mit Echtzeit-3D-Vorschau. Rastergröße einstellen, Magnetlöcher und Verbindungsnoppen ergänzen, Randabstand konfigurieren und als STL, STEP oder 3MF exportieren. Kostenloses Browser-Tool.
  applicationCategory: DesignApplication
  applicationSubCategory: 3D Printing Tools
  operatingSystem: Any
  browserRequirements: Requires JavaScript. Requires HTML5.
  offers:
    price: '0'
    priceCurrency: USD
  featureList:
    - Parametrische Grundplatten-Maße synchronisiert mit dem Layout
    - Export als STL, STEP und 3MF
    - Magnetloch-Vertiefungen (6 mm × 2 mm)
    - Halbzellen-Verbindungsnoppen
    - Randabstand pro Seite einstellbar
    - An-Schublade-anpassen-Modus mit automatischer Größenwahl
    - Automatische Aufteilung bei Überschreitung des Druckbetts
    - Echtzeit-3D-Vorschau
    - Läuft im Browser, keine Installation nötig
faqs:
  - q: Welche Dateiformate kann ich für Grundplatten exportieren?
    a: Der Generator exportiert STL (Standard für 3D-Druck), STEP (für CAD-Bearbeitung) und 3MF (modernes Format mit Farbe und Materialdaten). Die meisten Slicer unterstützen alle drei.
  - q: Kann die Grundplatte Magnetlöcher enthalten?
    a: Ja. Aktiviere Magnetlöcher, um 6 mm × 2 mm Vertiefungen an jeder Rasterkreuzung zu erzeugen. Sie halten Neodym-Standardmagnete, damit Bins sicher auf der Grundplatte einrasten.
  - q: Was passiert, wenn meine Grundplatte zu groß für mein Druckbett ist?
    a: Der Generator erkennt automatisch, wenn eine Grundplatte das Druckbett überschreitet, und teilt sie in druckbare Stücke. Du erhältst eine ZIP-Datei mit allen Teilen, bereit zum Drucken und Zusammensetzen.
  - q: Kann ich die Grundplatte exakt auf meine Schubladenmaße anpassen?
    a: Ja. Synchronisiere die Grundplatte mit deinem Layout, damit sie deine Schublade exakt abdeckt. Per-Seite-Randabstand erlaubt Feintuning, damit die Grundplatte bündig sitzt.
  - q: Wie unterscheidet sich das vom Herunterladen von Printables oder Thangs?
    a: Vorgefertigte Grundplatten kommen in festen Größen. Dieser Generator erstellt eine Grundplatte, die exakt zu deinen Schubladenmaßen passt — mit genau den Funktionen, die du brauchst. Läuft im Browser mit visueller Oberfläche und Echtzeit-3D-Vorschau.
  - q: Funktionieren diese Grundplatten mit Standard-Gridfinity-Bins?
    a: Ja. Sie nutzen das Standard-42-mm-Raster und Sockelprofil. Kompatibel mit jedem Gridfinity-Bin beliebiger Herkunft.
navCta:
  label: Generator öffnen
  href: /baseplate?standalone=1
---

# Gridfinity-Grundplatten-Generator

Ein parametrischer Grundplatten-Generator, der in deinem Browser läuft. Rastergröße festlegen, Magnetlöcher und Randabstand konfigurieren, 3D-Vorschau prüfen und als STL-, STEP- oder 3MF-Datei herunterladen. Nichts zu installieren. Teil der [Gridfinity-Generator-Suite](/de/gridfinity-generator), zu der auch der Bin-Generator und der Layout-Planer gehören.

[CTA: Grundplatte generieren](/baseplate?standalone=1)

## So funktioniert es

1. **Größe festlegen.** Wähle Breite und Tiefe in Rastereinheiten oder synchronisiere mit deinem bestehenden Layout, um die Schubladengröße automatisch zu übernehmen.
2. **Funktionen konfigurieren.** Aktiviere Magnetlöcher für magnetische Befestigung, ergänze Verbindungsnoppen für Halbzellen-Ausrichtung und stelle den Randabstand pro Seite ein.
3. **Vorschau prüfen.** Die 3D-Ansicht aktualisiert sich sofort, wenn du Einstellungen änderst. Drehe und zoome aus jedem Winkel.
4. **Herunterladen und drucken.** Export als STL für deinen Slicer, STEP für CAD-Bearbeitung oder 3MF für Farb- und Materialunterstützung. Große Grundplatten teilen sich automatisch.

> Alle Berechnungen laufen lokal. Deine Designs bleiben auf deinem Gerät, außer du teilst sie.

## Funktionen

**Rastergröße.** Stelle die Grundplatte auf beliebige Breite und Tiefe in Standard-Gridfinity-Rastereinheiten (je 42 mm) ein. Synchronisiere mit deinem Layout, um Schubladenmaße automatisch zu übernehmen.

**Magnetlöcher.** Ergänze 6 mm × 2 mm Vertiefungen an jeder Rasterkreuzung für Standard-Neodym-Magnete. Bins rasten sicher auf der Grundplatte ein, ohne zu verrutschen.

**Verbindungsnoppen.** Halbzellen-Stifte an Rasterkreuzungen helfen, Bins präzise auszurichten — besonders nützlich mit dem Halb-Bin-Modus für 0,5-Einheit-Präzision.

**Randabstand.** Konfiguriere den Randabstand pro Seite unabhängig — links, rechts, vorn und hinten. Feinjustierung, damit die Grundplatte bündig in deiner Schublade sitzt, ohne Lücken oder Klemmen.

**Automatische Aufteilung.** Grundplatten, die dein Druckbett überschreiten, werden automatisch in druckbare Teile aufgeteilt. Lade eine ZIP-Datei mit allen Teilen herunter, bereit zum Drucken und Zusammensetzen.

## Exportformate

| Format   | Wann sinnvoll                                                                              |
| -------- | ------------------------------------------------------------------------------------------ |
| **STL**  | Direkt in deinen Slicer. Funktioniert mit PrusaSlicer, Cura, OrcaSlicer und allen anderen. |
| **STEP** | In Fusion 360, FreeCAD oder SolidWorks öffnen, um vor dem Druck weiter zu bearbeiten.      |
| **3MF**  | Enthält Farb- und Materialdaten. Gut für Multi-Material-Drucker.                           |

## Nächste Schritte

Brauchst du individuelle Bins zur Grundplatte? Nutze den [Bin-Generator](/de/gridfinity-bin-generator), um Bins mit Kompartimenten, Aussparungen und Beschriftungslaschen zu erstellen. Plane deine gesamte Schublade mit dem [Layout-Planer](/) oder schau in die [Größenübersicht](/de/gridfinity-sizes), um deine Maße zu finden.

[CTA: Grundplatte generieren](/baseplate?standalone=1)
