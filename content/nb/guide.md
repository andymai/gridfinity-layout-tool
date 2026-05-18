---
title: Planlegge en Gridfinity-skuff — Veiledning
description: Praktisk veiledning for å planlegge Gridfinity-skuffeoppsett. Mål skuffen, finn ut hvilke bins du trenger og eksporter en utskriftsliste.
keywords: gridfinity planlegger, gridfinity layout, gridfinity planlegge, skuffeorganisator planlegge, gridfinity veiledning
schema: HowTo
breadcrumbs:
  - name: Start
    url: https://gridfinitylayouttool.com/
  - name: Planleggingsveiledning
    url: https://gridfinitylayouttool.com/nb/guide
faqs:
  - q: Hvordan måler jeg en skuff for Gridfinity?
    a: Mål skuffens innvendige mål i millimeter — bredde (venstre til høyre), dybde (front til bak) og fri høyde (fra bunn til topp med skuffen lukket). Mål flere steder fordi skuffer sjelden er perfekte rektangler, og bruk den minste verdien per dimensjon for å være sikker.
  - q: Hvordan regner jeg om skuffemål til Gridfinity-rutenettsenheter?
    a: Del hvert mål på 42 mm og rund ned. En skuff på 380 mm × 260 mm rommer for eksempel et 9×6-rutenett (378 mm × 252 mm), med små glipper i kantene. Glippene er greit — grunnplater trenger ikke fylle hver millimeter.
  - q: Hvilke bin-størrelser bør jeg bruke for Gridfinity?
    a: Som utgangspunkt — 1×1 med skillevegger for små skruer og komponenter; 1×2 eller 2×2 for penner, USB-pinner og batterier; 1×3 eller 1×4 for skrutrekkere og tenger; 2×2 eller 2×3 for tape og lim; 3×3 eller større for store verktøy. Du kan alltid skrive ut andre størrelser senere hvis noe ikke passer.
  - q: Hvor høy kan en Gridfinity-bin være?
    a: Høyden begrenses bare av skuffens frie høyde og skriverens Z-høyde. Høyder måles i enheter på 7 mm (U). En 6U-bin er 42 mm høy innvendig, en 9U-bin 63 mm. Sjekk din høyeste bin pluss 5 mm for grunnplaten mot lukket skuff før du skriver ut.
  - q: Bør jeg bruke flere lag i dype skuffer?
    a: Ja, hvis høyden tillater det. Stable bins vertikalt med lag 1 nederst. Tungt nederst, ofte brukt øverst. Funker bra for å skille flate ting (kabler) fra høye bins, eller for å holde elektrisk adskilt fra mekanisk.
  - q: Hvordan eksporterer jeg en Gridfinity-utskriftsliste?
    a: Når layouten er klar, viser utskriftslisten hver bin-størrelse, antallet, filamentestimater i gram og søkelenker per størrelse på Printables, Thangs og MakerWorld. Du kan også generere egne bins direkte i den innebygde bin-generatoren og eksportere STL, STEP eller 3MF.
  - q: Hvor mye tomrom bør jeg la stå i en Gridfinity-skuff?
    a: La 10-20 % stå tomt. En skuff som er 100 % planlagt i dag blir et problem i morgen når samlingen vokser eller behovene endrer seg. Tomme rutenettsruter koster ingenting og gir slingringsmonn for å legge til bins senere.
  - q: Hvilken skriver er best for Gridfinity?
    a: Enhver FDM-skriver med minst 256 mm × 256 mm bord skriver ut Gridfinity-bins komfortabelt. Bambu Lab X1, A1 og P1S er populære for hastigheten. Prusa MK4 og Ender 3 V3 KE fungerer også godt. For skuffer over 6×6 enheter deler du grunnplatene eller bruker et storformat som Bambu X1E eller Voron 2.4.
---

# Planlegge en Gridfinity-skuff

Å skrive ut uten plan sløser filament. Du må skrive ut bins på nytt fordi du gjettet feil på størrelser, lar uønskede glipper bli stående eller glemmer hva du trengte. Denne veiledningen går gjennom hvordan du måler, planlegger og får en utskriftsliste før du starter.

## Mål skuffen

Få skuffens innvendige mål i millimeter. Du trenger:

- **Bredde** — venstre til høyre
- **Dybde** — front til bak
- **Høyde** — bunn til topp (fri høyde med skuffen lukket)

Mål flere steder. Skuffer er sjelden perfekte rektangler, særlig i eldre møbler. Bruk den minste verdien for å være sikker.

### Regn om til rutenettsenheter

Gridfinity bruker enheter på 42 mm. Del og rund ned:

```text
Bredde: 380 mm ÷ 42 = 9,04 → 9 enheter
Dybde:  260 mm ÷ 42 = 6,19 → 6 enheter
```

Et 9×6-rutenett er 378 mm × 252 mm. Du får små glipper i kantene — det er greit. Grunnplater trenger ikke dekke hver millimeter.

## Finn ut hva som skal inn

Dette trinnet hopper de fleste over — og angrer.

Ta alt ut av skuffen. Grupper:

- Daglige ting
- Ukentlige ting
- Ting du hadde glemt at du eide

Det daglige må være tilgjengelig. Det ukentlige kan stå bak. Det glemte trenger kanskje ikke bin i det hele tatt.

### Match ting med bin-størrelse

Retningslinjer:

| Innhold                       | Bin-størrelse        |
| ----------------------------- | -------------------- |
| M3-skruer, små komponenter    | 1×1 med skillevegger |
| Penner, USB-pinner, batterier | 1×2 eller 2×2        |
| Skrutrekkere, tenger          | 1×3 eller 1×4        |
| Tape, limflasker              | 2×2 eller 2×3        |
| Store verktøy                 | 3×3 eller større     |

Ikke bli besatt — du kan alltid skrive ut andre bins senere.

## Planlegg layouten

Åpne verktøyet og still inn rutenettstørrelse. Dra for å lage bins. Verktøyet hindrer overlapp eller overflyt.

**Ofte brukt fremst.** Hva tar du først når du åpner skuffen? Det hører hjemme foran.

**Grupper sammen.** Skrutrekkere på ett sted, måleverktøy på et annet. Du husker lettere hvor ting ligger.

**La litt være ledig.** Samlingen din vokser. En skuff som er 100 % planlagt i dag er et problem i morgen.

### Lag for dype skuffer

Med høyde kan du stable bins vertikalt. Lag 1 er nederst.

Funker bra for:

- Flatt nederst (kabler, smådeler), høye bins over
- Skille elektrisk fra mekanisk

Tungt nederst, ofte brukt øverst.

## Eksporter utskriftslisten

Når layouten er som du vil, eksporterer du en utskriftsliste:

- Hver bin-størrelse med antall
- Filamentestimater i gram
- Søkelenker per størrelse

### Finn STL-filer

Du kan [generere egne bins](/nb/gridfinity-bin-generator) direkte i den innebygde bin-generatoren — velg mål, bunnstil, rom og eksporter som STL, STEP eller 3MF.

For spesialbins (verktøyspesifikke holdere, komplekse former) søk i community-arkivene:

- [Printables](https://www.printables.com/search/models?q=gridfinity) — største utvalg
- [Thangs](https://thangs.com/search/gridfinity) — bra for å finne lignende design
- [MakerWorld](https://makerworld.com/en/search/models?keyword=gridfinity) — Bambu Lab community

Eksempelsøk: "gridfinity 2x2 3U" finner 2×2-bins med 3 høydeenheter.

## Før du skriver ut

### Test først med papp

> Klipp papp i bin-størrelse (42 mm per rutenettsenhet) og legg i skuffen. Føles noe feil, har du ikke sløst filament.

### Skriv ut én bin først

Før du skriver ut 20, skriv ut én. Sjekk passform, høyde og om du liker designet. Juster skriverinnstillinger ved behov.

### Sjekk klaringen

Din høyeste bin pluss grunnplaten (~5 mm) må få plass med skuffen lukket. Mål dette før du satser på høye bins.

## Vanlige feil

**For mange bittesmå bins.** Et rutenett med 1×1-bins ser organisert ut, men er irriterende i bruk. Større bins med skillevegger funker som regel bedre.

**Fyll hver rute.** Lar ingen plass være til nytt. Planlegg 10-20 % tomt.

**Ignorer hva du faktisk bruker.** Ikke organiser etter hva du tror du burde ha. Organiser etter hva du faktisk griper etter.

[CTA: Åpne layout-verktøyet](/)
