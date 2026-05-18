---
title: Cómo planificar un cajón Gridfinity
description: Guía práctica para planificar layouts de cajón Gridfinity. Mide tu cajón, decide qué bins necesitas y exporta una lista de impresión.
keywords: planificador gridfinity, layout gridfinity, cómo planificar gridfinity, organizar cajón, guía gridfinity
schema: HowTo
breadcrumbs:
  - name: Inicio
    url: https://gridfinitylayouttool.com/es/
  - name: Guía de planificación
    url: https://gridfinitylayouttool.com/es/guide
faqs:
  - q: ¿Cómo mido un cajón para Gridfinity?
    a: Mide las dimensiones interiores del cajón en milímetros — ancho (izquierda a derecha), profundidad (delante a detrás) y altura libre (del fondo al techo con el cajón cerrado). Toma varias mediciones, ya que los cajones rara vez son rectángulos perfectos, y usa el valor más pequeño de cada dimensión para ir seguro.
  - q: ¿Cómo convierto las dimensiones del cajón a unidades de cuadrícula Gridfinity?
    a: Divide cada dimensión entre 42 mm y redondea hacia abajo. Por ejemplo, un cajón de 380 mm × 260 mm admite una cuadrícula 9×6 (378 mm × 252 mm), dejando pequeños huecos en los bordes. Los huecos están bien — las placas base no necesitan cubrir cada milímetro.
  - q: ¿Qué tamaños de bin usar para Gridfinity?
    a: Como punto de partida — 1×1 con separadores para tornillos pequeños y componentes; 1×2 o 2×2 para bolígrafos, USBs y pilas; 1×3 o 1×4 para destornilladores y alicates; 2×2 o 2×3 para cinta y pegamento; 3×3 o más para herramientas grandes. Siempre puedes imprimir otros tamaños más adelante si algo no encaja.
  - q: ¿Hasta qué altura puede tener un bin Gridfinity?
    a: La altura solo está limitada por la altura libre de tu cajón y el eje Z de tu impresora. Las alturas se miden en unidades de 7 mm (U). Un bin 6U mide 42 mm de alto por dentro; un 9U, 63 mm. Comprueba el bin más alto más 5 mm para la placa base contra la altura libre con el cajón cerrado antes de imprimir.
  - q: ¿Conviene usar varias capas en cajones profundos?
    a: Sí, si tienes altura suficiente. Apila bins verticalmente con la capa 1 abajo. Lo pesado abajo, lo de uso frecuente arriba. Funciona bien para separar objetos planos (cables) de bins altos, o para mantener lo eléctrico apartado de lo mecánico.
  - q: ¿Cómo exporto una lista de impresión Gridfinity?
    a: Cuando termines el layout, la lista de impresión muestra cada tamaño de bin, la cantidad necesaria, las estimaciones de filamento en gramos y enlaces de búsqueda por tamaño en Printables, Thangs y MakerWorld. También puedes generar bins personalizados directamente con el generador integrado y exportar STL, STEP o 3MF.
  - q: ¿Cuánto espacio vacío debo dejar en un cajón Gridfinity?
    a: Deja entre un 10 y un 20 % de espacio libre. Un cajón planificado al 100 % hoy se convierte en problema mañana cuando tu colección crezca o cambien tus necesidades. Las casillas vacías no cuestan nada y dan margen para añadir bins más tarde.
  - q: ¿Cuál es la mejor impresora para Gridfinity?
    a: Cualquier impresora FDM con cama de al menos 256 mm × 256 mm imprime bins Gridfinity sin problema. Las Bambu Lab X1, A1 y P1S son populares por su velocidad. Prusa MK4 y Ender 3 V3 KE también funcionan bien. Para cajones por encima de 6×6 unidades, o teselas las placas base o pasas a un formato grande como Bambu X1E o Voron 2.4.
---

# Cómo planificar un cajón Gridfinity

Imprimir sin un plan es desperdiciar filamento. Acabas reimprimiendo bins porque acertaste mal con los tamaños, dejando huecos no buscados u olvidando lo que querías. Esta guía cubre cómo medir, planificar y obtener una lista de impresión antes de empezar.

## Mide tu cajón

Saca las dimensiones interiores en milímetros. Necesitas:

- **Ancho** — de izquierda a derecha
- **Profundidad** — de delante a atrás
- **Altura** — del fondo al techo (espacio libre con el cajón cerrado)

Mide en varios puntos. Los cajones rara vez son rectángulos perfectos, sobre todo en muebles antiguos. Usa el valor más pequeño para ir sobre seguro.

### Convierte a unidades de cuadrícula

Gridfinity usa unidades de 42 mm. Divide y redondea hacia abajo:

```text
Ancho:        380 mm ÷ 42 = 9,04 → 9 unidades
Profundidad:  260 mm ÷ 42 = 6,19 → 6 unidades
```

Una cuadrícula 9×6 es 378 mm × 252 mm. Tendrás pequeños huecos en los bordes — está bien. Las placas base no necesitan cubrir cada milímetro.

## Decide qué guardar dentro

Es el paso que casi todo el mundo se salta — y lamenta.

Saca todo del cajón. Agrupa:

- Cosas de uso diario
- Cosas de uso semanal
- Cosas que habías olvidado

Lo diario tiene que estar accesible. Lo semanal puede ir al fondo. Lo olvidado quizá ni necesite bin.

### Asocia objetos a tamaños de bin

Pautas:

| Contenido                      | Tamaño de bin       |
| ------------------------------ | ------------------- |
| Tornillos M3, componentes mini | 1×1 con separadores |
| Bolígrafos, USB, pilas         | 1×2 o 2×2           |
| Destornilladores, alicates     | 1×3 o 1×4           |
| Cinta, pegamento               | 2×2 o 2×3           |
| Herramientas grandes           | 3×3 o más           |

No obsesionarse — siempre puedes imprimir otros bins después.

## Planifica el layout

Abre la herramienta y fija el tamaño de la cuadrícula. Arrastra para crear bins. La herramienta no te deja solapar ni salirte.

**Lo de uso frecuente, delante.** Cuando abres el cajón, ¿qué coges primero? Eso va delante.

**Agrupa lo relacionado.** Destornilladores en un sitio, herramientas de medida en otro. Recordarás dónde está cada cosa.

**Deja algo de espacio vacío.** Tu colección crecerá. Un cajón planificado al 100 % hoy es un problema mañana.

### Capas para cajones profundos

Si tienes altura, puedes apilar bins en vertical. La capa 1 es la de abajo.

Funciona bien para:

- Plano abajo (cables, piezas pequeñas), bins altos encima
- Separar lo eléctrico de lo mecánico

Lo pesado abajo, lo de uso frecuente arriba.

## Exporta tu lista de impresión

Cuando tengas el layout listo, exporta una lista de impresión:

- Cada tamaño de bin y cantidad
- Estimaciones de filamento en gramos
- Enlaces de búsqueda por tamaño

### Encontrar archivos STL

Puedes [generar bins personalizados](/es/gridfinity-bin-generator) directamente con el generador integrado — eliges dimensiones, estilo de base, compartimentos y exportas a STL, STEP o 3MF.

Para bins especializados (soportes específicos, formas complejas), busca en los repositorios comunitarios:

- [Printables](https://www.printables.com/search/models?q=gridfinity) — la mayor selección
- [Thangs](https://thangs.com/search/gridfinity) — bueno para encontrar diseños similares
- [MakerWorld](https://makerworld.com/en/search/models?keyword=gridfinity) — comunidad Bambu Lab

Búsqueda de ejemplo: «gridfinity 2x2 3U» encuentra bins 2×2 de 3 unidades de altura.

## Antes de imprimir

### Prueba primero con cartón

> Recorta cartón al tamaño de tus bins (42 mm por unidad de cuadrícula) y disponlos en el cajón. Si algo no encaja, no has gastado filamento.

### Imprime un bin primero

Antes de imprimir 20, imprime uno. Comprueba el ajuste, la altura y que te gusta el diseño. Ajusta la configuración de impresión si hace falta.

### Verifica la altura libre

El bin más alto más la placa base (unos 5 mm) tiene que entrar con el cajón cerrado. Mídelo antes de comprometerte con bins altos.

## Errores comunes

**Demasiados bins diminutos.** Una cuadrícula de bins 1×1 parece ordenada pero es incómoda en el uso diario. Bins más grandes con separadores suelen funcionar mejor.

**Llenar cada casilla.** No deja sitio para cosas nuevas. Planifica un 10–20 % de espacio vacío.

**Ignorar lo que usas de verdad.** No organices alrededor de lo que crees que «deberías» tener. Organiza alrededor de lo que realmente coges.

[CTA: Abrir la herramienta de layout](/es/)
