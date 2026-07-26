---
title: Jak naplánovat rozvržení zásuvky Gridfinity
description: Praktický průvodce plánováním rozvržení zásuvek Gridfinity. Změř zásuvku, urči, jaké Biny potřebuješ, a vyexportuj seznam pro tisk.
keywords: gridfinity plánovač, gridfinity rozvržení, jak naplánovat gridfinity, plánování organizéru do zásuvky, gridfinity průvodce
schema: HowTo
breadcrumbs:
  - name: Domů
    url: https://gridfinitylayouttool.com/
  - name: Průvodce plánováním
    url: https://gridfinitylayouttool.com/cs/guide
faqs:
  - q: Jak změřit zásuvku pro Gridfinity?
    a: Změř vnitřní rozměry zásuvky v milimetrech — šířku (zleva doprava), hloubku (zepředu dozadu) a světlou výšku (odspodu nahoru při zavřené zásuvce). Měř na několika místech, protože zásuvky bývají málokdy dokonalé obdélníky, a pro jistotu u každého rozměru použij nejmenší hodnotu.
  - q: Jak převést rozměry zásuvky na jednotky mřížky Gridfinity?
    a: Vyděl každý rozměr 42 mm a zaokrouhli dolů. Například zásuvka 380 mm × 260 mm pojme mřížku 9×6 (378 mm × 252 mm) a u okrajů zůstanou malé mezery. Mezery nevadí — základní desky nemusí vyplnit každý milimetr.
  - q: Jaké velikosti Binů použít pro Gridfinity?
    a: Pro začátek — 1×1 s příčkami na malé šrouby a součástky; 1×2 nebo 2×2 na pera, USB disky a baterie; 1×3 nebo 1×4 na šroubováky a kleště; 2×2 nebo 2×3 na lepicí pásky a lepidla; 3×3 nebo větší na velké nářadí. Jiné velikosti můžeš vždy vytisknout později, pokud něco úplně nesedí.
  - q: Jak vysoký může být Bin Gridfinity?
    a: Výšku Binu omezuje jen světlá výška zásuvky a výška osy Z tvé tiskárny. Výšky se měří v jednotkách po 7 mm (U). Bin 6U má uvnitř 42 mm, Bin 9U 63 mm. Před tiskem porovnej svůj nejvyšší Bin plus 5 mm na základní desku se světlou výškou zavřené zásuvky.
  - q: Vyplatí se v hlubokých zásuvkách používat více vrstev?
    a: Ano, pokud máš výškovou rezervu. Skládej Biny na sebe svisle, s vrstvou 1 dole. Těžké věci drž dole, často používané nahoře. Dobře to funguje pro oddělení plochých věcí (kabely) od vysokých Binů nebo pro oddělení elektro od mechaniky.
  - q: Jak vyexportovat seznam pro tisk Gridfinity?
    a: Jakmile máš rozvržení v nástroji hotové, seznam pro tisk ukáže každou velikost Binu, potřebné množství, odhady filamentu v gramech a vyhledávací odkazy pro každou velikost na Printables, Thangs a MakerWorld. Vlastní Biny můžeš také vygenerovat přímo vestavěným generátorem Binů a vyexportovat soubory STL, STEP nebo 3MF.
  - q: Kolik volného místa nechat v zásuvce Gridfinity?
    a: Nech 10–20 % volného místa. Zásuvka dnes naplánovaná na 100 % se zítra stane problémem, až tvoje sbírka poroste nebo se změní tvoje potřeby. Prázdná pole mřížky nic nestojí a dávají prostor přidat Biny později.
  - q: Jaká je nejlepší tiskárna na Gridfinity?
    a: Jakákoli FDM tiskárna s podložkou aspoň 256 mm × 256 mm pohodlně vytiskne Biny Gridfinity. Bambu Lab X1, A1 a P1S jsou oblíbené díky rychlosti. Prusa MK4 a Ender 3 V3 KE fungují také dobře. U zásuvek větších než 6×6 jednotek mřížky budeš chtít buď skládat základní desky jako dlaždice, nebo použít tiskárnu většího formátu, jako Bambu X1E či Voron 2.4.
---

# Jak naplánovat rozvržení zásuvky Gridfinity

Tisk bez plánu plýtvá filamentem. Skončíš u přetiskování Binů, protože jsi špatně odhadl velikosti, u nechtěných mezer nebo u zapomínání, co jsi vlastně potřeboval. Tento průvodce ukazuje, jak změřit, naplánovat a získat seznam pro tisk, ještě než začneš.

## Změř zásuvku

Získej vnitřní rozměry v milimetrech. Potřebuješ:

- **Šířka** — zleva doprava
- **Hloubka** — zepředu dozadu
- **Výška** — odspodu nahoru (světlá výška při zavřené zásuvce)

Měř na několika místech. Zásuvky bývají málokdy dokonalé obdélníky, zvlášť u staršího nábytku. Pro jistotu použij nejmenší naměřenou hodnotu.

### Převeď na jednotky mřížky

Gridfinity používá jednotky 42 mm. Vyděl a zaokrouhli dolů:

```text
Šířka:  380 mm ÷ 42 = 9,04 → 9 jednotek
Hloubka: 260 mm ÷ 42 = 6,19 → 6 jednotek
```

Mřížka 9×6 je 378 mm × 252 mm. U okrajů budeš mít malé mezery. To nevadí. Základní desky nemusí vyplnit každý milimetr.

## Urči, co do ní přijde

Většina lidí tento krok přeskočí a pak toho lituje.

Vyndej všechno ze zásuvky. Rozděl to do skupin:

- Věci na denní použití
- Věci na týdenní použití
- Věci, o kterých jsi zapomněl, že je máš

To, co používáš denně, musí být po ruce. Týdenní může přijít dozadu. Zapomenuté možná vůbec Bin nepotřebuje.

### Přiřaď věci k velikostem Binů

Hrubé vodítko:

| Obsah                       | Rozměr Binu    |
| --------------------------- | -------------- |
| Šrouby M3, drobné součástky | 1×1 s příčkami |
| Pera, USB disky, baterie    | 1×2 nebo 2×2   |
| Šroubováky, kleště          | 1×3 nebo 1×4   |
| Lepicí pásky, lepidla       | 2×2 nebo 2×3   |
| Velké nářadí                | 3×3 nebo větší |

Nepřikládej tomu přehnanou váhu. Jiné Biny můžeš vždy vytisknout později.

## Naplánuj rozvržení

Otevři nástroj a nastav rozměr mřížky. Přetahováním vytváříš Biny. Nástroj ti nedovolí, aby se překrývaly nebo vyjely mimo obrys.

**Často používané věci blízko předku.** Po čem sáhneš první, když otevřeš zásuvku? To patří dopředu.

**Seskupuj související věci.** Šroubováky na jednom místě, měřicí nástroje na druhém. Snáz si zapamatuješ, kde co je.

**Nech trochu volného místa.** Tvoje sbírka poroste. Zásuvka dnes naplánovaná na 100 % je zítra problém.

### Vrstvy do vysokých zásuvek

Pokud má zásuvka výškovou rezervu, můžeš skládat Biny na sebe svisle. Vrstva 1 je dole.

Dobře se to hodí pro:

- Ploché věci dole (kabely, drobné díly), vyšší Biny nahoře
- Oddělení elektro od mechaniky

Těžké věci drž dole, často používané nahoře.

## Vyexportuj seznam pro tisk

Až ti rozvržení sedne, vyexportuj seznam pro tisk:

- Každou velikost Binu a počet kusů
- Odhady filamentu v gramech
- Vyhledávací odkazy pro každou velikost

### Hledání souborů STL

Vlastní Biny můžeš [vygenerovat](/cs/gridfinity-bin-generator) přímo ve vestavěném generátoru — vyber rozměry, styl podstavy, přihrádky a vyexportuj jako STL, STEP nebo 3MF.

Pro specializované Biny (držáky na konkrétní nářadí, složité tvary) prohledej komunitní repozitáře:

- [Printables](https://www.printables.com/search/models?q=gridfinity) — největší výběr
- [Thangs](https://thangs.com/search/gridfinity) — dobré na hledání podobných návrhů
- [MakerWorld](https://makerworld.com/en/search/models?keyword=gridfinity) — komunita Bambu Lab

Příklad vyhledávání: „gridfinity 2x2 3U“ najde Biny 2×2 o výšce 3 jednotky.

## Než začneš tisknout

### Nejdřív to vyzkoušej na kartonu

> Nastříhej karton na velikosti svých Binů (42 mm na jednotku mřížky) a rozlož ho v zásuvce. Pokud něco nesedí, nepřišel jsi o jediný gram filamentu.

### Nejdřív vytiskni jeden Bin

Než vytiskneš 20 Binů, vytiskni jeden. Zkontroluj uložení, zkontroluj výšku a ujisti se, že se ti návrh líbí. V případě potřeby dolaď nastavení tiskárny.

### Zkontroluj světlou výšku

Tvůj nejvyšší Bin plus základní deska (asi 5 mm) se musí vejít při zavírání zásuvky. Změř to, než se rozhodneš pro vysoké Biny.

## Časté chyby

**Příliš mnoho maličkých Binů.** Mřížka Binů 1×1 vypadá uspořádaně, ale v každodenním používání bývá otravná. Větší Biny s příčkami jsou obvykle lepší.

**Vyplnění každého pole.** To nenechá místo na nové věci. Naplánuj 10–20 % volného místa.

**Ignorování toho, co reálně používáš.** Neorganizuj podle toho, co si myslíš, že bys měl mít. Organizuj podle toho, po čem reálně saháš.

[CTA: Otevři nástroj pro rozvržení](/)
