---
title: Tamaños Gridfinity — Dimensiones de bins y guía de unidades
description: ¿Cuánto mide una unidad Gridfinity? Cuadrícula de 42 mm, incrementos de altura de 7 mm. Tablas de referencia para bins, conversión de cajón y qué entra dónde.
keywords: tamaños gridfinity, dimensiones gridfinity, tamaños bin gridfinity, unidades altura gridfinity, gridfinity 42mm, cuadrícula gridfinity
schema: Article
breadcrumbs:
  - name: Inicio
    url: https://gridfinitylayouttool.com/es/
  - name: Referencia de tamaños
    url: https://gridfinitylayouttool.com/es/gridfinity-sizes
faqs:
  - q: ¿Cuánto mide una unidad de cuadrícula Gridfinity?
    a: Una unidad de cuadrícula Gridfinity mide 42 mm × 42 mm. Un bin 2×3 mide 84 mm de ancho y 126 mm de profundidad. Todos los bins y placas Gridfinity usan este estándar.
  - q: ¿Cuánto mide una unidad de altura Gridfinity?
    a: Una unidad de altura (1U) son 7 mm. Un bin 3U tiene unos 21 mm de altura interior. Las alturas habituales van de 2U (14 mm) a 10U (70 mm).
  - q: ¿Cómo calculo cuántas unidades Gridfinity caben en mi cajón?
    a: Mide el ancho y la profundidad interiores del cajón en milímetros. Divide cada uno entre 42 y redondea hacia abajo. Por ejemplo, un cajón de 380 mm × 260 mm caben 9 × 6 unidades Gridfinity.
  - q: ¿Qué es el modo medio-bin?
    a: El modo medio-bin permite incrementos de 0,5 unidad (21 mm) para bins que deben caber en espacios menores que una unidad completa. Un bin 1,5×2 sería 63 mm × 84 mm.
---

# Tamaños y dimensiones Gridfinity

Gridfinity usa dos números: **unidades de cuadrícula** para el ancho y la profundidad de un bin, y **unidades de altura** para la altura. Conociéndolas, sabes qué cabe en tu cajón y qué bins imprimir.

## Unidades de cuadrícula (ancho y profundidad)

**1 unidad de cuadrícula = 42 mm.** Todos los bins y placas Gridfinity lo usan. Un bin «2×3» mide 2 unidades de ancho (84 mm) y 3 de profundidad (126 mm).

| Unidades | Milímetros | Pulgadas (aprox.) |
| -------- | ---------- | ----------------- |
| 1 unidad | 42 mm      | 1,65″             |
| 2        | 84 mm      | 3,31″             |
| 3        | 126 mm     | 4,96″             |
| 4        | 168 mm     | 6,61″             |
| 5        | 210 mm     | 8,27″             |
| 6        | 252 mm     | 9,92″             |
| 7        | 294 mm     | 11,57″            |
| 8        | 336 mm     | 13,23″            |

### Modo medio-bin

Para encajes más ajustados, el modo medio-bin usa **incrementos de 0,5 unidad (21 mm)**. Un bin 1,5×2,5 sería 63 mm × 105 mm. Actívalo en la herramienta de layout pulsando `H`.

## Unidades de altura

**1 unidad de altura (1U) = 7 mm.** Es el espacio vertical disponible dentro del bin. Un bin 3U admite objetos de hasta unos 21 mm de alto.

| Altura | Interior (mm) | Uso típico                                        |
| ------ | ------------- | ------------------------------------------------- |
| 2U     | 14 mm         | Tarjetas SD, tornillos pequeños, clips            |
| 3U     | 21 mm         | Memorias USB, pilas AA, pernos                    |
| 4U     | 28 mm         | Bolígrafos, rotuladores, brocas                   |
| 5U     | 35 mm         | Tijeras, rollos de cinta, herramientas pequeñas   |
| 6U     | 42 mm         | Destornilladores, alicates (profundidad estándar) |
| 7U     | 49 mm         | Aerosoles, herramientas de mano grandes           |
| 8U     | 56 mm         | Botes de pegamento, contenedores altos            |
| 10U    | 70 mm         | Almacenamiento profundo, objetos voluminosos      |

> **Comprueba la altura libre:** Tu bin más alto más la placa (~5 mm) debe entrar con el cajón cerrado. Mide la altura interior del cajón cerrado antes de optar por bins altos.

## Convertir las medidas de tu cajón

Coge un metro y saca las dimensiones interiores del cajón en milímetros. Luego:

1. Mide ancho y profundidad interiores en milímetros
2. Divide cada uno entre 42
3. Redondea hacia abajo a la unidad (o media unidad, en modo medio-bin)

### Ejemplo

```text
Ancho del cajón:        380 mm ÷ 42 = 9,04 → 9 unidades
Profundidad del cajón:  520 mm ÷ 42 = 12,38 → 12 unidades
Tamaño de layout:       9 × 12 (378 mm × 504 mm)
Huecos en los bordes:   2 mm de ancho, 16 mm de profundidad
```

Es normal tener pequeños huecos en los bordes. Las placas base no necesitan cubrir cada milímetro. Lo más común es centrar las placas e ignorar el hueco.

## Tamaños de bin habituales

Estos son los que más se imprimen. Puedes crear cualquiera (o un tamaño a medida) en el [generador de bins](/es/gridfinity-bin-generator).

| Bin | Dimensiones (mm) | Usos comunes                                  |
| --- | ---------------- | --------------------------------------------- |
| 1×1 | 42 × 42          | Tornillos sueltos, tuercas, componentes mini  |
| 1×2 | 42 × 84          | Bolígrafos, cables USB, pilas en fila         |
| 1×3 | 42 × 126         | Destornilladores, reglas, herramientas largas |
| 2×2 | 84 × 84          | Cinta, barras de pegamento, flexómetros       |
| 2×3 | 84 × 126         | Alicates, cortacables, herramientas medianas  |
| 3×3 | 126 × 126        | Juegos de brocas, accesorios grandes          |
| 4×2 | 168 × 84         | Llaves de vaso, calibres                      |

## ¿Cabe en tu cama de impresión?

La mayoría de las impresoras FDM tienen una cama de 220–256 mm, que admite bins de hasta 5×5 o 6×6 unidades. Para algo mayor hay que dividir o imprimir en secciones. La herramienta de layout asume por defecto una cama de 256 mm y marca los bins que no caben.

## Referencia rápida

| Medida                     | Valor            |
| -------------------------- | ---------------- |
| Unidad de cuadrícula       | 42 mm × 42 mm    |
| Media unidad de cuadrícula | 21 mm            |
| Unidad de altura (1U)      | 7 mm             |
| Grosor de placa base       | ~5 mm            |
| Cama de impresión defecto  | 256 mm           |
| Cuadrícula máx. (herr.)    | 50 × 50 unidades |

## Siguientes pasos

Ahora que conoces los tamaños, [genera un bin personalizado](/es/gridfinity-bin-generator) o abre el [planificador de layout](/es/) para ver cómo encajan los bins en tu cajón.

¿Nuevo en Gridfinity? [Aquí tienes una visión general](/es/what-is-gridfinity) del sistema.

[CTA: Planificar mi layout](/)
