---
title: Jak zaplanować układ szuflady Gridfinity
description: Praktyczny przewodnik po planowaniu układów szuflad Gridfinity. Zmierz szufladę, dobierz potrzebne Biny i wyeksportuj listę druku.
keywords: gridfinity planer, gridfinity układ, jak zaplanować gridfinity, planowanie organizera do szuflady, gridfinity przewodnik
schema: HowTo
breadcrumbs:
  - name: Strona główna
    url: https://gridfinitylayouttool.com/
  - name: Przewodnik po planowaniu
    url: https://gridfinitylayouttool.com/pl/guide
faqs:
  - q: Jak zmierzyć szufladę pod Gridfinity?
    a: Zmierz wewnętrzne wymiary szuflady w milimetrach — szerokość (od lewej do prawej), głębokość (od przodu do tyłu) i prześwit na wysokość (od dna do góry przy zamkniętej szufladzie). Mierz w kilku miejscach, bo szuflady rzadko są idealnymi prostokątami, i dla każdego wymiaru przyjmij najmniejszą wartość, żeby mieć pewność.
  - q: Jak przeliczyć wymiary szuflady na jednostki siatki Gridfinity?
    a: Podziel każdy wymiar przez 42 mm i zaokrąglij w dół. Na przykład szuflada 380 mm × 260 mm mieści siatkę 9×6 (378 mm × 252 mm), zostawiając niewielkie luki przy krawędziach. Luki są w porządku — płyty bazowe nie muszą wypełniać każdego milimetra.
  - q: Jakich rozmiarów Binów użyć w Gridfinity?
    a: Na start — 1×1 z przegródkami na małe śruby i elementy; 1×2 lub 2×2 na długopisy, pendrive'y i baterie; 1×3 lub 1×4 na wkrętaki i szczypce; 2×2 lub 2×3 na taśmy i kleje; 3×3 lub większe na duże narzędzia. Zawsze możesz później wydrukować inne rozmiary, jeśli coś nie pasuje.
  - q: Jak wysoki może być Bin Gridfinity?
    a: Wysokość Bina ogranicza tylko prześwit szuflady i wysokość Z twojej drukarki. Wysokości mierzy się w jednostkach 7 mm (U). Bin 6U ma wewnątrz 42 mm, Bin 9U — 63 mm. Przed drukiem sprawdź swój najwyższy Bin plus 5 mm na płytę bazową względem prześwitu zamkniętej szuflady.
  - q: Czy w głębokich szufladach warto używać kilku warstw?
    a: Tak, jeśli masz zapas wysokości. Ustaw Biny w pionie, z warstwą 1 na dole. Ciężkie rzeczy trzymaj na dole, często używane na górze. Dobrze się to sprawdza przy oddzielaniu płaskich rzeczy (kable) od wysokich Binów albo przy trzymaniu osobno elektryki od mechaniki.
  - q: Jak wyeksportować listę druku Gridfinity?
    a: Gdy układ jest gotowy w narzędziu, lista druku pokazuje każdy rozmiar Bina, potrzebną liczbę, szacunki filamentu w gramach oraz linki wyszukiwania każdego rozmiaru na Printables, Thangs i MakerWorld. Możesz też wygenerować własne Biny wbudowanym generatorem i wyeksportować pliki STL, STEP lub 3MF.
  - q: Ile pustej przestrzeni zostawić w szufladzie Gridfinity?
    a: Zostaw 10–20% wolnego miejsca. Szuflada zaplanowana dziś w 100% jutro staje się problemem, gdy twoja kolekcja urośnie albo zmienią się potrzeby. Puste pola siatki nic nie kosztują i dają miejsce na dokładanie Binów później.
  - q: Jaka jest najlepsza drukarka do Gridfinity?
    a: Każda drukarka FDM z co najmniej stołem 256 mm × 256 mm bez problemu drukuje Biny Gridfinity. Bambu Lab X1, A1 i P1S są popularne ze względu na prędkość. Prusa MK4 i Ender 3 V3 KE też działają dobrze. Przy szufladach większych niż 6×6 jednostek albo poukładasz płyty bazowe jak kafelki, albo sięgniesz po drukarkę większego formatu, jak Bambu X1E czy Voron 2.4.
---

# Jak zaplanować układ szuflady Gridfinity

Druk bez planu marnuje filament. Skończysz na przedrukowywaniu Binów, bo źle zgadłeś rozmiary, na niechcianych lukach albo na zapominaniu, czego potrzebowałeś. Ten przewodnik pokazuje, jak zmierzyć, zaplanować i uzyskać listę druku, zanim zaczniesz.

## Zmierz szufladę

Zdobądź wewnętrzne wymiary w milimetrach. Potrzebujesz:

- **Szerokość** — od lewej do prawej
- **Głębokość** — od przodu do tyłu
- **Wysokość** — od dna do góry (prześwit przy zamkniętej szufladzie)

Mierz w kilku miejscach. Szuflady rzadko są idealnymi prostokątami, zwłaszcza w starszych meblach. Dla pewności przyjmij najmniejszy wynik.

### Przelicz na jednostki siatki

Gridfinity używa jednostek 42 mm. Podziel i zaokrąglij w dół:

```text
Szerokość: 380 mm ÷ 42 = 9,04 → 9 jednostek
Głębokość: 260 mm ÷ 42 = 6,19 → 6 jednostek
```

Siatka 9×6 to 378 mm × 252 mm. Będziesz mieć niewielkie luki przy krawędziach. To w porządku. Płyty bazowe nie muszą wypełniać każdego milimetra.

## Ustal, co ma się w niej znaleźć

Większość ludzi pomija ten krok i tego żałuje.

Wyjmij wszystko z szuflady. Pogrupuj:

- Rzeczy codzienne
- Rzeczy cotygodniowe
- Rzeczy, o których zapomniałeś, że je masz

To, co codzienne, musi być pod ręką. Cotygodniowe może iść do tyłu. Zapomniane być może wcale nie potrzebuje Bina.

### Dopasuj przedmioty do rozmiarów Binów

Zgrubne wskazówki:

| Zawartość                      | Rozmiar Bina       |
| ------------------------------ | ------------------ |
| Śruby M3, drobne elementy      | 1×1 z przegródkami |
| Długopisy, pendrive'y, baterie | 1×2 lub 2×2        |
| Wkrętaki, szczypce             | 1×3 lub 1×4        |
| Taśmy, butelki kleju           | 2×2 lub 2×3        |
| Duże narzędzia                 | 3×3 lub większe    |

Nie przywiązuj się do tego zanadto. Zawsze możesz później wydrukować inne Biny.

## Zaplanuj układ

Otwórz narzędzie i ustaw rozmiar siatki. Przeciągaj, żeby tworzyć Biny. Narzędzie nie pozwoli ci nachodzić na siebie ani wyjść poza obszar.

**Często używane rzeczy blisko przodu.** Po co sięgasz najpierw, gdy otwierasz szufladę? To idzie do przodu.

**Grupuj powiązane rzeczy.** Wkrętaki w jednym miejscu, narzędzia pomiarowe w innym. Łatwiej zapamiętasz, gdzie co jest.

**Zostaw trochę wolnego miejsca.** Twoja kolekcja urośnie. Szuflada zaplanowana dziś w 100% jutro jest problemem.

### Warstwy w wysokich szufladach

Jeśli szuflada ma zapas wysokości, możesz układać Biny w pionie. Warstwa 1 jest na dole.

Dobrze sprawdza się to przy:

- Płaskich rzeczach na dole (kable, drobne części), wyższych Binach na górze
- Trzymaniu osobno elektryki od mechaniki

Ciężkie rzeczy trzymaj na dole, często używane na górze.

## Wyeksportuj listę druku

Gdy układ ci odpowiada, wyeksportuj listę druku:

- Każdy rozmiar Bina i liczbę sztuk
- Szacunki filamentu w gramach
- Linki wyszukiwania dla każdego rozmiaru

### Znajdowanie plików STL

Możesz [wygenerować własne Biny](/pl/gridfinity-bin-generator) wprost we wbudowanym generatorze — wybierz wymiary, styl podstawy, przegródki i wyeksportuj jako STL, STEP lub 3MF.

Po wyspecjalizowane Biny (uchwyty pod konkretne narzędzia, złożone kształty) przeszukaj repozytoria społeczności:

- [Printables](https://www.printables.com/search/models?q=gridfinity) — największy wybór
- [Thangs](https://thangs.com/search/gridfinity) — dobre do znajdowania podobnych projektów
- [MakerWorld](https://makerworld.com/en/search/models?keyword=gridfinity) — społeczność Bambu Lab

Przykładowe wyszukiwanie: „gridfinity 2x2 3U" znajduje Biny 2×2 o wysokości 3 jednostek.

## Zanim wydrukujesz

### Najpierw przetestuj na kartonie

> Wytnij karton na rozmiary swoich Binów (42 mm na jednostkę siatki) i ułóż go w szufladzie. Jeśli coś się nie zgadza, nie zmarnowałeś ani grama filamentu.

### Najpierw wydrukuj jeden Bin

Zanim wydrukujesz 20 Binów, wydrukuj jeden. Sprawdź dopasowanie, sprawdź wysokość i upewnij się, że projekt ci odpowiada. W razie potrzeby dostrój ustawienia drukarki.

### Sprawdź prześwit

Twój najwyższy Bin plus płyta bazowa (około 5 mm) musi się zmieścić przy zamykaniu szuflady. Zmierz to, zanim zdecydujesz się na wysokie Biny.

## Częste błędy

**Zbyt wiele malutkich Binów.** Siatka Binów 1×1 wygląda schludnie, ale w codziennym użyciu bywa irytująca. Większe Biny z przegródkami są zwykle lepsze.

**Wypełnianie każdego pola.** To nie zostawia miejsca na nowe rzeczy. Zaplanuj 10–20% wolnej przestrzeni.

**Ignorowanie tego, czego naprawdę używasz.** Nie organizuj wokół tego, co wydaje ci się, że powinieneś mieć. Organizuj wokół tego, po co realnie sięgasz.

[CTA: Otwórz narzędzie do układów](/)
