/**
 * Multilingual label normalization vocabulary for ML telemetry.
 * Maps user-entered labels to canonical terms for aggregation.
 *
 * Supports: English, German (DE), French (FR), Spanish (ES),
 * Dutch (NL), Italian (IT), Portuguese (PT)
 *
 * Privacy: Only canonical terms are stored. Unknown labels are hashed.
 * Versioned to prevent training-serving skew when vocabulary expands.
 */

import { computeEmbeddingBucket } from './labelEmbedding';

export const VOCAB_VERSION = 'v1';

/**
 * Multilingual vocabulary of common gridfinity organizer items.
 * Each canonical term has aliases in multiple languages.
 *
 * Format: canonical_term: [EN aliases, DE aliases, FR aliases, ES aliases, ...]
 */
const VOCABULARY: Record<string, string[]> = {
  // === Tools ===
  screwdriver: [
    // EN
    'screwdriver', 'screwdrivers', 'screw driver', 'phillips', 'flathead', 'torx', 'precision screwdriver',
    // DE
    'schraubenzieher', 'schraubendreher', 'kreuzschlitz', 'schlitzschraubendreher',
    // FR
    'tournevis', 'tournevis cruciforme', 'tournevis plat',
    // ES
    'destornillador', 'destornilladores', 'desarmador',
    // NL
    'schroevendraaier', 'schroevedraaier',
    // IT
    'cacciavite', 'cacciaviti', 'giravite',
    // PT
    'chave de fenda', 'chave phillips',
  ],
  wrench: [
    // EN
    'wrench', 'wrenches', 'spanner', 'spanners', 'socket', 'ratchet', 'socket wrench',
    // DE
    'schraubenschlüssel', 'maulschlüssel', 'ringschlüssel', 'ratsche', 'steckschlüssel',
    // FR
    'clé', 'clé à molette', 'clé plate', 'douille', 'cliquet',
    // ES
    'llave', 'llaves', 'llave inglesa', 'llave de tubo',
    // NL
    'moersleutel', 'steeksleutel', 'ringsleutel', 'dopsleutel',
    // IT
    'chiave', 'chiave inglese', 'chiave a tubo', 'cricchetto',
    // PT
    'chave de boca', 'chave inglesa', 'catraca',
  ],
  pliers: [
    // EN
    'pliers', 'needle nose', 'wire cutter', 'wire cutters', 'snips', 'linesman', 'side cutters',
    // DE
    'zange', 'zangen', 'spitzzange', 'seitenschneider', 'kombizange',
    // FR
    'pince', 'pinces', 'pince coupante', 'pince à bec',
    // ES
    'alicates', 'pinzas', 'cortaalambres', 'alicate de corte',
    // NL
    'tang', 'tangen', 'punttang', 'kniptang',
    // IT
    'pinza', 'pinze', 'tronchese', 'pinza a becco',
    // PT
    'alicate', 'alicates', 'alicate de corte',
  ],
  allen_key: [
    // EN
    'allen', 'allen key', 'allen keys', 'hex key', 'hex keys', 'hex wrench', 'l-key', 'ikea key',
    // DE
    'inbus', 'inbusschlüssel', 'sechskantschlüssel', 'innensechskant',
    // FR
    'clé allen', 'clé hex', 'clé hexagonale', 'clé btc',
    // ES
    'llave allen', 'llave hexagonal', 'llave hex',
    // NL
    'inbussleutel', 'zeskantsleutel',
    // IT
    'chiave allen', 'chiave esagonale', 'brugola',
    // PT
    'chave allen', 'chave hexagonal',
  ],
  drill_bit: [
    // EN
    'drill bit', 'drill bits', 'bits', 'forstner', 'spade bit', 'hole saw',
    // DE
    'bohrer', 'bohrerset', 'spiralbohrer', 'forstnerbohrer', 'lochsäge',
    // FR
    'foret', 'forets', 'mèche', 'scie cloche',
    // ES
    'broca', 'brocas', 'broca de pala',
    // NL
    'boor', 'boren', 'borenset', 'gatenzaag',
    // IT
    'punta', 'punte', 'punta trapano', 'fresa',
    // PT
    'broca', 'brocas', 'serra copo',
  ],
  knife: [
    // EN
    'knife', 'knives', 'utility knife', 'box cutter', 'exacto', 'x-acto', 'xacto', 'blade',
    // DE
    'messer', 'cuttermesser', 'teppichmesser', 'klinge',
    // FR
    'couteau', 'cutter', 'lame', 'canif',
    // ES
    'cuchillo', 'cúter', 'navaja', 'hoja',
    // NL
    'mes', 'stanleymes', 'afbreekmmes',
    // IT
    'coltello', 'taglierino', 'lama',
    // PT
    'faca', 'estilete', 'lâmina',
  ],
  hammer: [
    // EN
    'hammer', 'hammers', 'mallet', 'mallets',
    // DE
    'hammer', 'hämmer', 'gummihammer',
    // FR
    'marteau', 'maillet',
    // ES
    'martillo', 'mazo',
    // NL
    'hamer', 'rubberen hamer',
    // IT
    'martello', 'mazzuolo',
    // PT
    'martelo', 'marreta',
  ],
  tape_measure: [
    // EN
    'tape measure', 'measuring tape', 'ruler', 'rulers', 'scale',
    // DE
    'maßband', 'messband', 'zollstock', 'lineal', 'meterstab',
    // FR
    'mètre ruban', 'règle', 'mètre',
    // ES
    'cinta métrica', 'metro', 'regla', 'flexómetro',
    // NL
    'meetlint', 'rolmaat', 'liniaal', 'duimstok',
    // IT
    'metro', 'flessometro', 'righello',
    // PT
    'trena', 'fita métrica', 'régua',
  ],

  // === Fasteners ===
  screw: [
    // EN
    'screw', 'screws', 'wood screw', 'wood screws', 'machine screw', 'drywall screw', 'self-tapping',
    // DE
    'schraube', 'schrauben', 'holzschraube', 'blechschraube', 'spax',
    // FR
    'vis', 'vis à bois', 'vis auto-taraudeuse',
    // ES
    'tornillo', 'tornillos', 'tornillo para madera',
    // NL
    'schroef', 'schroeven', 'houtschroef',
    // IT
    'vite', 'viti', 'vite per legno',
    // PT
    'parafuso', 'parafusos',
  ],
  bolt: [
    // EN
    'bolt', 'bolts', 'carriage bolt', 'hex bolt', 'lag bolt', 'eye bolt',
    // DE
    'bolzen', 'schraube', 'sechskantschraube', 'gewindestange',
    // FR
    'boulon', 'boulons', 'vis hexagonale',
    // ES
    'perno', 'pernos', 'tornillo hexagonal',
    // NL
    'bout', 'bouten', 'zeskantbout',
    // IT
    'bullone', 'bulloni',
    // PT
    'parafuso sextavado', 'perno',
  ],
  nut: [
    // EN
    'nut', 'nuts', 'lock nut', 'wing nut', 'nyloc', 'nylock', 'acorn nut',
    // DE
    'mutter', 'muttern', 'sicherungsmutter', 'flügelmutter',
    // FR
    'écrou', 'écrous', 'écrou papillon',
    // ES
    'tuerca', 'tuercas', 'tuerca de mariposa',
    // NL
    'moer', 'moeren', 'vleugelmoer', 'borgmoer',
    // IT
    'dado', 'dadi', 'dado a farfalla',
    // PT
    'porca', 'porcas',
  ],
  washer: [
    // EN
    'washer', 'washers', 'lock washer', 'fender washer', 'flat washer',
    // DE
    'unterlegscheibe', 'scheibe', 'beilagscheibe',
    // FR
    'rondelle', 'rondelles',
    // ES
    'arandela', 'arandelas',
    // NL
    'ring', 'sluitring', 'veerring',
    // IT
    'rondella', 'rondelle',
    // PT
    'arruela', 'arruelas',
  ],
  nail: [
    // EN
    'nail', 'nails', 'brad', 'brads', 'finishing nail', 'framing nail', 'tack', 'tacks',
    // DE
    'nagel', 'nägel', 'stift', 'reißnagel',
    // FR
    'clou', 'clous', 'pointe',
    // ES
    'clavo', 'clavos', 'tachuela',
    // NL
    'spijker', 'spijkers', 'nagel',
    // IT
    'chiodo', 'chiodi', 'puntina',
    // PT
    'prego', 'pregos', 'tacha',
  ],

  // === Electronics ===
  battery_aa: [
    // EN
    'aa', 'aa battery', 'aa batteries', 'double a', 'double-a', 'duracell aa',
    // DE
    'aa batterie', 'mignon', 'aa batterien',
    // FR
    'pile aa', 'piles aa', 'lr6',
    // ES
    'pila aa', 'pilas aa', 'batería aa',
    // NL
    'aa batterij', 'penlite',
    // IT
    'batteria aa', 'pile aa', 'stilo',
    // PT
    'pilha aa', 'pilhas aa',
  ],
  battery_aaa: [
    // EN
    'aaa', 'aaa battery', 'aaa batteries', 'triple a', 'triple-a',
    // DE
    'aaa batterie', 'micro', 'aaa batterien',
    // FR
    'pile aaa', 'piles aaa', 'lr03',
    // ES
    'pila aaa', 'pilas aaa',
    // NL
    'aaa batterij', 'potlood batterij',
    // IT
    'batteria aaa', 'pile aaa', 'ministilo',
    // PT
    'pilha aaa', 'pilhas aaa',
  ],
  usb_cable: [
    // EN
    'usb', 'usb cable', 'usb-c', 'usb c', 'micro usb', 'lightning', 'charging cable', 'data cable',
    // DE
    'usb kabel', 'ladekabel', 'datenkabel',
    // FR
    'câble usb', 'câble de charge', 'chargeur',
    // ES
    'cable usb', 'cable de carga', 'cargador',
    // NL
    'usb kabel', 'oplaadkabel',
    // IT
    'cavo usb', 'cavo di ricarica',
    // PT
    'cabo usb', 'cabo de carga',
  ],
  sd_card: [
    // EN
    'sd card', 'sd', 'micro sd', 'microsd', 'memory card', 'tf card',
    // DE
    'sd karte', 'speicherkarte',
    // FR
    'carte sd', 'carte mémoire',
    // ES
    'tarjeta sd', 'tarjeta de memoria',
    // NL
    'sd kaart', 'geheugenkaart',
    // IT
    'scheda sd', 'scheda di memoria',
    // PT
    'cartão sd', 'cartão de memória',
  ],
  resistor: [
    // EN
    'resistor', 'resistors', 'ohm', 'carbon film',
    // DE
    'widerstand', 'widerstände',
    // FR
    'résistance', 'résistances',
    // ES
    'resistencia', 'resistencias',
    // NL
    'weerstand', 'weerstanden',
    // IT
    'resistore', 'resistori', 'resistenza',
    // PT
    'resistor', 'resistores',
  ],
  capacitor: [
    // EN
    'capacitor', 'capacitors', 'cap', 'caps', 'electrolytic',
    // DE
    'kondensator', 'kondensatoren', 'elko',
    // FR
    'condensateur', 'condensateurs',
    // ES
    'condensador', 'capacitor',
    // NL
    'condensator', 'condensatoren',
    // IT
    'condensatore', 'condensatori',
    // PT
    'capacitor', 'capacitores',
  ],
  led: [
    // EN
    'led', 'leds', 'diode', 'diodes', 'light emitting',
    // DE (LED is universal)
    'leuchtdiode',
    // FR
    'del', 'diode électroluminescente',
    // ES
    'diodo', 'diodos',
    // NL
    'ledlamp',
    // IT
    'diodo',
    // PT
    'diodo',
  ],
  wire: [
    // EN
    'wire', 'wires', 'jumper wire', 'hookup wire', 'solid core',
    // DE
    'draht', 'kabel', 'litze', 'ader',
    // FR
    'fil', 'fils', 'câble',
    // ES
    'cable', 'cables', 'alambre',
    // NL
    'draad', 'kabel', 'snoer',
    // IT
    'filo', 'fili', 'cavo',
    // PT
    'fio', 'fios', 'cabo',
  ],
  arduino: [
    // Universal terms
    'arduino', 'arduino uno', 'nano', 'esp32', 'esp8266', 'raspberry pi', 'rpi', 'pico',
    'microcontroller', 'mcu',
    // DE
    'mikrocontroller',
    // FR
    'microcontrôleur',
    // ES
    'microcontrolador',
  ],

  // === Office ===
  pen: [
    // EN
    'pen', 'pens', 'pencil', 'pencils', 'marker', 'markers', 'sharpie', 'highlighter', 'highlighters',
    // DE
    'stift', 'stifte', 'kugelschreiber', 'kuli', 'bleistift', 'marker', 'textmarker', 'filzstift',
    // FR
    'stylo', 'stylos', 'crayon', 'crayons', 'feutre', 'surligneur',
    // ES
    'bolígrafo', 'lápiz', 'lápices', 'rotulador', 'marcador', 'pluma',
    // NL
    'pen', 'pennen', 'potlood', 'stift', 'marker',
    // IT
    'penna', 'penne', 'matita', 'matite', 'pennarello', 'evidenziatore',
    // PT
    'caneta', 'canetas', 'lápis', 'marcador', 'marca texto',
  ],
  scissors: [
    // EN
    'scissors', 'shears',
    // DE
    'schere', 'scheren',
    // FR
    'ciseaux',
    // ES
    'tijeras', 'tijera',
    // NL
    'schaar',
    // IT
    'forbici', 'forbice',
    // PT
    'tesoura', 'tesouras',
  ],
  tape: [
    // EN
    'tape', 'scotch tape', 'masking tape', 'electrical tape', 'duct tape', 'painters tape', 'packing tape',
    // DE
    'klebeband', 'tesafilm', 'isolierband', 'kreppband', 'panzertape',
    // FR
    'ruban adhésif', 'scotch', 'chatterton', 'masquage',
    // ES
    'cinta', 'cinta adhesiva', 'celo', 'cinta aislante',
    // NL
    'plakband', 'tape', 'isolatietape',
    // IT
    'nastro', 'nastro adesivo', 'scotch', 'nastro isolante',
    // PT
    'fita', 'fita adesiva', 'fita isolante', 'durex',
  ],
  clip: [
    // EN
    'clip', 'clips', 'binder clip', 'binder clips', 'paper clip', 'paper clips', 'bulldog clip',
    // DE
    'klammer', 'klammern', 'büroklammer', 'foldback-klammer',
    // FR
    'trombone', 'trombones', 'pince', 'attache',
    // ES
    'clip', 'clips', 'sujetapapeles', 'pinza',
    // NL
    'paperclip', 'klem', 'binder clip',
    // IT
    'graffetta', 'clip', 'fermacarte', 'molletta',
    // PT
    'clipe', 'clips', 'prendedor',
  ],

  // === Craft & Hobby ===
  paint: [
    // EN
    'paint', 'paints', 'acrylic', 'acrylic paint', 'paint pot', 'citadel', 'vallejo', 'miniature paint',
    // DE
    'farbe', 'farben', 'acrylfarbe', 'modellfarbe',
    // FR
    'peinture', 'peintures', 'acrylique', 'pot de peinture',
    // ES
    'pintura', 'pinturas', 'acrílico',
    // NL
    'verf', 'acrylverf', 'verfpot',
    // IT
    'vernice', 'colore', 'colori', 'acrilico',
    // PT
    'tinta', 'tintas', 'acrílica',
  ],
  brush: [
    // EN
    'brush', 'brushes', 'paint brush', 'paintbrush', 'paintbrushes',
    // DE
    'pinsel', 'malerpinsel',
    // FR
    'pinceau', 'pinceaux', 'brosse',
    // ES
    'pincel', 'pinceles', 'brocha',
    // NL
    'penseel', 'kwast',
    // IT
    'pennello', 'pennelli',
    // PT
    'pincel', 'pincéis',
  ],
  glue: [
    // EN
    'glue', 'super glue', 'ca glue', 'wood glue', 'pva', 'gorilla glue', 'epoxy', 'hot glue',
    // DE
    'kleber', 'klebstoff', 'sekundenkleber', 'holzleim', 'uhu',
    // FR
    'colle', 'super glue', 'colle à bois', 'colle chaude',
    // ES
    'pegamento', 'cola', 'super glue', 'cola de madera',
    // NL
    'lijm', 'secondelijm', 'houtlijm',
    // IT
    'colla', 'super colla', 'colla a caldo', 'colla per legno',
    // PT
    'cola', 'super cola', 'cola quente', 'cola de madeira',
  ],

  // === 3D Printing ===
  nozzle: [
    // EN
    'nozzle', 'nozzles', 'hotend', 'hot end', 'print head',
    // DE
    'düse', 'düsen', 'druckkopf',
    // FR
    'buse', 'buses', 'tête d\'impression',
    // ES
    'boquilla', 'boquillas', 'cabezal',
    // NL
    'nozzle', 'spuitmond',
    // IT
    'ugello', 'ugelli', 'testina',
    // PT
    'bico', 'bicos', 'nozzle',
  ],
  filament_sample: [
    // EN
    'filament', 'filament sample', 'pla', 'petg', 'abs', 'tpu', 'filament swatch',
    // DE (filament is universal)
    'filamentprobe',
    // FR
    'échantillon filament',
    // ES
    'muestra filamento',
  ],
  bearing: [
    // EN
    'bearing', 'bearings', '608', '625', 'linear bearing', 'ball bearing',
    // DE
    'lager', 'kugellager', 'linearlager',
    // FR
    'roulement', 'roulements', 'roulement à billes',
    // ES
    'rodamiento', 'rodamientos', 'cojinete',
    // NL
    'lager', 'kogellager',
    // IT
    'cuscinetto', 'cuscinetti',
    // PT
    'rolamento', 'rolamentos',
  ],
  magnet: [
    // EN
    'magnet', 'magnets', 'neodymium', 'rare earth',
    // DE
    'magnet', 'magnete', 'neodym',
    // FR
    'aimant', 'aimants', 'néodyme',
    // ES
    'imán', 'imanes', 'neodimio',
    // NL
    'magneet', 'magneten',
    // IT
    'magnete', 'magneti', 'calamita',
    // PT
    'ímã', 'imã', 'neodímio',
  ],
  heat_insert: [
    // EN
    'heat insert', 'heat inserts', 'threaded insert', 'brass insert',
    // DE
    'einschmelzmutter', 'gewindeeinsatz', 'gewindebuchse',
    // FR
    'insert fileté', 'insert thermique',
    // ES
    'inserto roscado', 'inserto térmico',
  ],

  // === Misc ===
  key: [
    // EN
    'key', 'keys', 'spare key', 'house key', 'car key',
    // DE
    'schlüssel', 'hausschlüssel', 'autoschlüssel',
    // FR
    'clé', 'clés', 'clef',
    // ES
    'llave', 'llaves',
    // NL
    'sleutel', 'sleutels',
    // IT
    'chiave', 'chiavi',
    // PT
    'chave', 'chaves',
  ],
  coin: [
    // EN
    'coin', 'coins', 'change', 'quarters', 'loose change', 'penny', 'pennies',
    // DE
    'münze', 'münzen', 'kleingeld',
    // FR
    'pièce', 'pièces', 'monnaie',
    // ES
    'moneda', 'monedas', 'cambio',
    // NL
    'munt', 'munten', 'kleingeld',
    // IT
    'moneta', 'monete', 'spiccioli',
    // PT
    'moeda', 'moedas', 'troco',
  ],
  medication: [
    // EN
    'medication', 'medicine', 'pills', 'vitamins', 'supplements', 'pill', 'vitamin',
    // DE
    'medikament', 'medikamente', 'tabletten', 'pillen', 'vitamine',
    // FR
    'médicament', 'médicaments', 'pilule', 'vitamines', 'comprimé',
    // ES
    'medicamento', 'medicina', 'pastillas', 'vitaminas', 'píldora',
    // NL
    'medicijn', 'medicijnen', 'pillen', 'vitamines',
    // IT
    'medicina', 'farmaco', 'pillole', 'vitamine',
    // PT
    'medicamento', 'remédio', 'pílulas', 'vitaminas',
  ],
  jewelry: [
    // EN
    'jewelry', 'jewellery', 'ring', 'rings', 'earring', 'earrings', 'necklace', 'bracelet',
    // DE
    'schmuck', 'ring', 'ringe', 'ohrring', 'ohrringe', 'kette', 'armband',
    // FR
    'bijou', 'bijoux', 'bague', 'boucle d\'oreille', 'collier', 'bracelet',
    // ES
    'joya', 'joyas', 'anillo', 'pendiente', 'collar', 'pulsera',
    // NL
    'sieraad', 'sieraden', 'ring', 'oorbel', 'ketting', 'armband',
    // IT
    'gioiello', 'gioielli', 'anello', 'orecchino', 'collana', 'bracciale',
    // PT
    'joia', 'joias', 'anel', 'brinco', 'colar', 'pulseira',
  ],
  flashlight: [
    // EN
    'flashlight', 'flashlights', 'torch', 'torches', 'headlamp',
    // DE
    'taschenlampe', 'taschenlampen', 'stirnlampe',
    // FR
    'lampe de poche', 'torche', 'lampe frontale',
    // ES
    'linterna', 'linternas', 'linterna frontal',
    // NL
    'zaklamp', 'zaklantaarn', 'hoofdlamp',
    // IT
    'torcia', 'torce', 'lampada frontale',
    // PT
    'lanterna', 'lanternas',
  ],
  glasses: [
    // EN
    'glasses', 'sunglasses', 'eyeglasses', 'spectacles',
    // DE
    'brille', 'brillen', 'sonnenbrille',
    // FR
    'lunettes', 'lunettes de soleil',
    // ES
    'gafas', 'lentes', 'anteojos',
    // NL
    'bril', 'brillen', 'zonnebril',
    // IT
    'occhiali', 'occhiali da sole',
    // PT
    'óculos',
  ],
  watch: [
    // EN
    'watch', 'watches', 'wristwatch',
    // DE
    'uhr', 'uhren', 'armbanduhr',
    // FR
    'montre', 'montres',
    // ES
    'reloj', 'relojes',
    // NL
    'horloge', 'horloges',
    // IT
    'orologio', 'orologi',
    // PT
    'relógio', 'relógios',
  ],
};

/**
 * Domain categories for vocabulary terms.
 * Allows broader aggregation when normalized term not available.
 */
export type LabelDomain =
  | 'tools'
  | 'fasteners'
  | 'electronics'
  | 'office'
  | 'craft'
  | 'printing_3d'
  | 'cosmetics'
  | 'misc';

/**
 * Map canonical terms to their domain.
 */
const TERM_DOMAINS: Record<string, LabelDomain> = {
  // Tools
  screwdriver: 'tools',
  wrench: 'tools',
  pliers: 'tools',
  allen_key: 'tools',
  drill_bit: 'tools',
  knife: 'tools',
  hammer: 'tools',
  tape_measure: 'tools',
  // Fasteners
  screw: 'fasteners',
  bolt: 'fasteners',
  nut: 'fasteners',
  washer: 'fasteners',
  nail: 'fasteners',
  // Electronics
  battery_aa: 'electronics',
  battery_aaa: 'electronics',
  usb_cable: 'electronics',
  sd_card: 'electronics',
  resistor: 'electronics',
  capacitor: 'electronics',
  led: 'electronics',
  wire: 'electronics',
  arduino: 'electronics',
  // Office
  pen: 'office',
  scissors: 'office',
  tape: 'office',
  clip: 'office',
  // Craft
  paint: 'craft',
  brush: 'craft',
  glue: 'craft',
  // 3D Printing
  nozzle: 'printing_3d',
  filament_sample: 'printing_3d',
  bearing: 'printing_3d',
  magnet: 'printing_3d',
  heat_insert: 'printing_3d',
  // Misc
  key: 'misc',
  coin: 'misc',
  medication: 'misc',
  jewelry: 'misc',
  flashlight: 'misc',
  glasses: 'misc',
  watch: 'misc',
};

/**
 * Build reverse lookup map for O(1) matching.
 * Maps each alias to its canonical term.
 */
const ALIAS_MAP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(VOCABULARY)) {
  for (const alias of aliases) {
    ALIAS_MAP.set(alias.toLowerCase(), canonical);
  }
}

// ============================================
// LABEL PROCESSING CACHE
// ============================================

/**
 * Cache for processLabel results.
 * Avoids repeated expensive partial matching for the same labels.
 * Max size prevents unbounded memory growth.
 */
const LABEL_CACHE_MAX_SIZE = 500;
const labelCache = new Map<string, LabelData>();

/**
 * Clear the label cache.
 * Useful for testing or when vocabulary changes.
 */
export function clearLabelCache(): void {
  labelCache.clear();
}

/**
 * Simple hash function for labels.
 * Returns first 8 chars of a basic hash - enough for grouping, not reversible.
 *
 * This is the PRIMARY identifier for labels - vocabulary is just enrichment.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to hex and take first 8 chars
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

export interface LabelData {
  /**
   * Hash of the label - ALWAYS populated.
   * This is the primary grouping key that works for ANY label in ANY language.
   * Identical labels will have identical hashes, enabling aggregation.
   */
  hash: string;

  /**
   * Canonical term from vocabulary, or null if not recognized.
   * This is optional enrichment - absence doesn't mean the label is invalid.
   */
  normalized: string | null;

  /**
   * Domain category for the label, or null if not recognized.
   * Useful for broader aggregation (e.g., "all tools" vs specific tool).
   */
  domain: LabelDomain | null;

  /**
   * Confidence of the vocabulary match.
   * 1.0 = exact match, 0.8 = partial match (label contains alias),
   * 0.7 = reverse partial (alias contains label), 0 = no match
   */
  confidence: number;

  /**
   * Embedding bucket for semantic similarity grouping.
   * 4-char hex encoding structural features (length, char class, pattern, n-gram).
   * Enables ML to learn "labels like this tend to be in bins of size X".
   */
  embedding_bucket: string;
}

/**
 * Process a user-entered label for ML telemetry.
 *
 * HASH-FIRST STRATEGY:
 * - Hash is ALWAYS computed and is the primary grouping mechanism
 * - Vocabulary matching is optional enrichment
 * - Unknown labels still contribute to the data via their hash
 *
 * This approach works for:
 * - Any language (hash groups identical labels regardless of language)
 * - Any domain (makeup, hardware, fishing, etc.)
 * - Specialized terminology (M3x8 SHCS, MAC Ruby Woo, etc.)
 *
 * Results are cached to avoid repeated expensive partial matching.
 * Cache size is bounded to prevent unbounded memory growth.
 *
 * @param raw - Raw user input
 * @returns Label data with hash (always) and optional enrichment
 *
 * @example
 * // Known vocabulary term
 * processLabel("Phillips Head Screwdriver")
 * // → { hash: "a3f2b1c4", normalized: "screwdriver", domain: "tools", confidence: 0.8 }
 *
 * @example
 * // Unknown specialized term - still tracked via hash!
 * processLabel("M3x8 SHCS")
 * // → { hash: "d4e5f6a7", normalized: null, domain: null, confidence: 0 }
 *
 * @example
 * // Non-English term that matches vocabulary
 * processLabel("Schraubenzieher")
 * // → { hash: "b2c3d4e5", normalized: "screwdriver", domain: "tools", confidence: 1.0 }
 */
export function processLabel(raw: string): LabelData {
  const cleaned = raw.toLowerCase().trim();

  // Check cache first
  const cached = labelCache.get(cleaned);
  if (cached) {
    return cached;
  }

  const hash = simpleHash(cleaned);
  const embedding_bucket = computeEmbeddingBucket(raw); // Use original casing for embedding

  if (!cleaned) {
    const result: LabelData = { hash, normalized: null, domain: null, confidence: 0, embedding_bucket };
    cacheResult(cleaned, result);
    return result;
  }

  // 1. Exact match
  const exactMatch = ALIAS_MAP.get(cleaned);
  if (exactMatch) {
    const result: LabelData = {
      hash,
      normalized: exactMatch,
      domain: TERM_DOMAINS[exactMatch] ?? null,
      confidence: 1.0,
      embedding_bucket,
    };
    cacheResult(cleaned, result);
    return result;
  }

  // 2. Partial match - label contains an alias (e.g., "my phillips screwdriver")
  for (const [alias, canonical] of ALIAS_MAP) {
    if (alias.length >= 3 && cleaned.includes(alias)) {
      const result: LabelData = {
        hash,
        normalized: canonical,
        domain: TERM_DOMAINS[canonical] ?? null,
        confidence: 0.8,
        embedding_bucket,
      };
      cacheResult(cleaned, result);
      return result;
    }
  }

  // 3. Partial match - alias contains the label (e.g., "screw" matches "screwdriver")
  if (cleaned.length >= 4) {
    for (const [alias, canonical] of ALIAS_MAP) {
      if (alias.includes(cleaned)) {
        const result: LabelData = {
          hash,
          normalized: canonical,
          domain: TERM_DOMAINS[canonical] ?? null,
          confidence: 0.7,
          embedding_bucket,
        };
        cacheResult(cleaned, result);
        return result;
      }
    }
  }

  // 4. Unknown label - hash is still valid for grouping!
  const result: LabelData = { hash, normalized: null, domain: null, confidence: 0, embedding_bucket };
  cacheResult(cleaned, result);
  return result;
}

/**
 * Add a result to the cache, evicting oldest entries if full.
 * Uses simple FIFO eviction for simplicity.
 */
function cacheResult(key: string, value: LabelData): void {
  // Evict oldest entries if cache is full
  if (labelCache.size >= LABEL_CACHE_MAX_SIZE) {
    // Delete first 10% of entries (FIFO eviction)
    const toDelete = Math.ceil(LABEL_CACHE_MAX_SIZE * 0.1);
    const keys = labelCache.keys();
    for (let i = 0; i < toDelete; i++) {
      const next = keys.next();
      if (!next.done) {
        labelCache.delete(next.value);
      }
    }
  }
  labelCache.set(key, value);
}

/**
 * @deprecated Use processLabel() instead - renamed for clarity
 */
export function normalizeLabel(raw: string): LabelData {
  return processLabel(raw);
}

/**
 * Get all canonical terms in the vocabulary.
 * Useful for debugging or UI display.
 */
export function getCanonicalTerms(): string[] {
  return Object.keys(VOCABULARY).sort();
}

/**
 * Check if a canonical term exists in the vocabulary.
 */
export function isKnownTerm(term: string): boolean {
  return term in VOCABULARY;
}

/**
 * Get the domain for a canonical term.
 */
export function getTermDomain(term: string): LabelDomain | null {
  return TERM_DOMAINS[term] ?? null;
}
