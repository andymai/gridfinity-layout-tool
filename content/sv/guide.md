---
title: Planera en Gridfinity-låda — Handledning
description: Praktisk guide för att planera Gridfinity-lådlayouts. Mät din låda, bestäm vilka bins du behöver och exportera en utskriftslista.
keywords: gridfinity planerare, gridfinity layout, gridfinity planera, lådorganisatör planera, gridfinity guide
schema: HowTo
breadcrumbs:
  - name: Start
    url: https://gridfinitylayouttool.com/sv/
  - name: Planeringsguide
    url: https://gridfinitylayouttool.com/sv/guide
faqs:
  - q: Hur mäter jag en låda för Gridfinity?
    a: Mät lådans invändiga mått i millimeter — bredd (vänster till höger), djup (fram till bak) och fri höjd (från botten till topp med lådan stängd). Mät på flera ställen eftersom lådor sällan är perfekta rektanglar, och använd det minsta värdet per dimension för att vara säker.
  - q: Hur räknar jag om lådmått till Gridfinity-rutnätsenheter?
    a: Dela varje mått med 42 mm och avrunda nedåt. En låda på 380 mm × 260 mm rymmer till exempel ett 9×6-rutnät (378 mm × 252 mm), med små glapp i kanterna. Glappen är okej — bottenplattor behöver inte fylla varje millimeter.
  - q: Vilka bin-storlekar ska jag använda för Gridfinity?
    a: Som utgångspunkt — 1×1 med avdelare för små skruvar och komponenter; 1×2 eller 2×2 för pennor, USB-stickor och batterier; 1×3 eller 1×4 för skruvmejslar och tänger; 2×2 eller 2×3 för tejp och lim; 3×3 eller större för stora verktyg. Du kan alltid skriva ut andra storlekar senare om något inte passar.
  - q: Hur hög kan en Gridfinity-bin vara?
    a: Höjden begränsas bara av lådans fria höjd och skrivarens Z-höjd. Höjder mäts i enheter om 7 mm (U). En 6U-bin är 42 mm hög invändigt, en 9U-bin 63 mm. Kontrollera din högsta bin plus 5 mm för bottenplattan mot stängd låda före utskrift.
  - q: Bör jag använda flera lager i djupa lådor?
    a: Ja, om höjden tillåter. Stapla bins lodrätt med lager 1 underst. Tungt nederst, ofta använt överst. Funkar bra för att skilja platta saker (kablar) från höga bins, eller för att hålla elektriskt åtskilt från mekaniskt.
  - q: Hur exporterar jag en Gridfinity-utskriftslista?
    a: När din layout är klar visar utskriftslistan varje bin-storlek, antalet som behövs, filamentuppskattningar i gram och söklänkar per storlek på Printables, Thangs och MakerWorld. Du kan också generera egna bins direkt i den inbyggda bin-generatorn och exportera STL, STEP eller 3MF.
  - q: Hur mycket tomt utrymme bör jag lämna i en Gridfinity-låda?
    a: Lämna 10-20 % fritt. En låda som planerats till 100 % idag blir ett problem imorgon när din samling växer eller behoven ändras. Tomma rutnätsrutor kostar inget och ger marginal för att lägga till bins senare.
  - q: Vilken skrivare är bäst för Gridfinity?
    a: Vilken FDM-skrivare som helst med minst 256 mm × 256 mm bädd skriver ut Gridfinity-bins bekvämt. Bambu Lab X1, A1 och P1S är populära för sin snabbhet. Prusa MK4 och Ender 3 V3 KE fungerar också bra. För lådor större än 6×6 enheter delar du upp bottenplattorna eller använder ett större format som Bambu X1E eller Voron 2.4.
---

# Planera en Gridfinity-låda

Att skriva ut utan plan slösar filament. Du skriver ut bins igen för att du gissade fel på storlek, lämnar oönskade luckor eller glömmer vad du behövde. Den här guiden går igenom hur du mäter, planerar och får en utskriftslista innan du börjar.

## Mät lådan

Ta lådans invändiga mått i millimeter. Du behöver:

- **Bredd** — vänster till höger
- **Djup** — fram till bak
- **Höjd** — botten till topp (fri höjd med lådan stängd)

Mät på flera ställen. Lådor är sällan perfekta rektanglar, särskilt äldre möbler. Använd det minsta värdet för säkerhets skull.

### Räkna om till rutnätsenheter

Gridfinity använder enheter om 42 mm. Dela och avrunda nedåt:

```text
Bredd: 380 mm ÷ 42 = 9,04 → 9 enheter
Djup:  260 mm ÷ 42 = 6,19 → 6 enheter
```

Ett 9×6-rutnät är 378 mm × 252 mm. Du får små glapp i kanterna — det är okej. Bottenplattor behöver inte täcka varje millimeter.

## Bestäm vad som ska in

Det här steget hoppar de flesta över — och ångrar det.

Tag ut allt ur lådan. Gruppera:

- Dagliga saker
- Veckovis använda saker
- Saker du glömt bort att du hade

Det dagliga måste vara åtkomligt. Det veckovisa kan ligga längre bak. Det glömda behöver kanske ingen bin alls.

### Matcha föremål med bin-storlek

Riktlinjer:

| Innehåll                       | Bin-storlek      |
| ------------------------------ | ---------------- |
| M3-skruvar, små komponenter    | 1×1 med avdelare |
| Pennor, USB-stickor, batterier | 1×2 eller 2×2    |
| Skruvmejslar, tänger           | 1×3 eller 1×4    |
| Tejp, limflaskor               | 2×2 eller 2×3    |
| Stora verktyg                  | 3×3 eller större |

Bli inte besatt — du kan alltid skriva ut andra bins senare.

## Planera layouten

Öppna verktyget och ställ in rutnätsstorlek. Dra för att skapa bins. Verktyget tillåter inte överlapp eller överskridning.

**Ofta använt fram.** Vad griper du efter först när du öppnar lådan? Det hör hemma fram.

**Gruppera relaterade saker.** Skruvmejslar på ett ställe, mätverktyg på ett annat. Du minns lättare var saker finns.

**Lämna lite tomt.** Din samling växer. En låda som planerats till 100 % idag är ett problem imorgon.

### Lager för djupa lådor

Med höjd kan du stapla bins lodrätt. Lager 1 är nederst.

Funkar bra för:

- Platt nederst (kablar, smådelar), höga bins ovanpå
- Skilja elektriskt från mekaniskt

Tungt nederst, ofta använt överst.

## Exportera utskriftslistan

När layouten sitter exporterar du en utskriftslista:

- Varje bin-storlek med antal
- Filamentuppskattningar i gram
- Söklänkar per storlek

### Hitta STL-filer

Du kan [generera egna bins](/sv/gridfinity-bin-generator) direkt i den inbyggda bin-generatorn — välj mått, basstil, fack och exportera som STL, STEP eller 3MF.

För specialbins (verktygsspecifika hållare, komplexa former) söker du i community-arkiven:

- [Printables](https://www.printables.com/search/models?q=gridfinity) — största urvalet
- [Thangs](https://thangs.com/search/gridfinity) — bra för att hitta liknande designer
- [MakerWorld](https://makerworld.com/en/search/models?keyword=gridfinity) — Bambu Lab community

Exempelsökning: "gridfinity 2x2 3U" hittar 2×2-bins med 3 höjdenheter.

## Innan du skriver ut

### Testa först med kartong

> Klipp kartong i bin-storlek (42 mm per rutnätsenhet) och lägg i lådan. Känns något fel har du inte slösat filament.

### Skriv ut en bin först

Innan du skriver ut 20, skriv ut en. Kontrollera passform, höjd och om du gillar designen. Justera skrivarinställningar om det behövs.

### Kontrollera fri höjd

Din högsta bin plus bottenplatta (cirka 5 mm) måste få plats med lådan stängd. Mät detta innan du satsar på höga bins.

## Vanliga misstag

**För många små bins.** Ett rutnät av 1×1-bins ser organiserat ut men är jobbigt i bruk. Större bins med avdelare fungerar oftast bättre.

**Fyll varje ruta.** Lämnar inget utrymme för nya saker. Planera 10-20 % tomt.

**Strunta i vad du faktiskt använder.** Organisera inte efter vad du tror att du borde ha. Organisera efter vad du faktiskt griper efter.

[CTA: Öppna layout-verktyget](/sv/)
