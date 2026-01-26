/**
 * Core suggestion generation logic.
 *
 * Pure function that analyzes layout data and generates name suggestions.
 * Leverages existing labelVocabulary.ts for domain detection and
 * purposeInference.ts for drawer purpose analysis.
 */

import type { SuggestionInput, SuggestionResult, NameSuggestion, CategoryCount } from '../types';
import { processLabel, type LabelDomain } from '@/shared/analytics/labelVocabulary';

// ============================================
// NAMING PATTERNS & TEMPLATES
// ============================================

/**
 * Naming patterns for different contexts.
 * Each pattern produces different "flavors" of names.
 */
type NamingPattern =
  | 'drawer' // "Tools Drawer"
  | 'organizer' // "Tool Organizer"
  | 'station' // "Soldering Station"
  | 'kit' // "Electronics Kit"
  | 'collection' // "Screw Collection"
  | 'essentials' // "Workshop Essentials"
  | 'storage' // "Battery Storage"
  | 'supplies' // "Art Supplies"
  | 'box' // "Hardware Box"
  | 'tray'; // "Parts Tray"

/**
 * Domain-specific naming configurations.
 * Each domain has preferred patterns and specific names.
 */
interface DomainNaming {
  /** Base display name */
  name: string;
  /** Preferred naming patterns in order */
  patterns: NamingPattern[];
  /** Specific creative names for this domain */
  creativeNames: string[];
  /** Activity-based names when applicable */
  activityNames?: string[];
}

const DOMAIN_NAMING: Record<LabelDomain, DomainNaming> = {
  tools: {
    name: 'Tools',
    patterns: ['drawer', 'organizer', 'essentials', 'box', 'station'],
    creativeNames: [
      'Workshop Drawer',
      'Tool Station',
      'Workbench Organizer',
      'Hand Tool Collection',
      'Tool Chest',
      'Garage Essentials',
    ],
    activityNames: ['DIY Station', 'Repair Kit', 'Maintenance Drawer'],
  },
  fasteners: {
    name: 'Fasteners',
    patterns: ['organizer', 'collection', 'storage', 'box', 'drawer'],
    creativeNames: [
      'Hardware Organizer',
      'Screw Organizer',
      'Fastener Collection',
      'Hardware Box',
      'Nuts & Bolts',
      'Assembly Hardware',
    ],
    activityNames: ['Build Kit', 'Assembly Station'],
  },
  electronics: {
    name: 'Electronics',
    patterns: ['kit', 'organizer', 'station', 'supplies', 'drawer'],
    creativeNames: [
      'Electronics Kit',
      'Component Organizer',
      'Parts Drawer',
      'Circuit Supplies',
      'Tech Drawer',
      'Gadget Organizer',
    ],
    activityNames: ['Maker Station', 'Tinkerer Kit', 'Project Supplies'],
  },
  office: {
    name: 'Office',
    patterns: ['drawer', 'organizer', 'supplies', 'essentials', 'tray'],
    creativeNames: [
      'Desk Drawer',
      'Office Supplies',
      'Desk Organizer',
      'Stationery Drawer',
      'Desktop Essentials',
      'Work Supplies',
    ],
    activityNames: ['Writing Supplies', 'Desk Station'],
  },
  craft: {
    name: 'Craft',
    patterns: ['supplies', 'kit', 'station', 'organizer', 'box'],
    creativeNames: [
      'Craft Supplies',
      'Art Station',
      'Creative Kit',
      'Hobby Organizer',
      'Maker Supplies',
      'Project Box',
    ],
    activityNames: ['Art Station', 'Creative Corner', 'Hobby Kit'],
  },
  printing_3d: {
    name: '3D Printing',
    patterns: ['supplies', 'kit', 'station', 'organizer', 'essentials'],
    creativeNames: [
      '3D Printing Supplies',
      'Printer Station',
      'Print Supplies',
      'Maker Kit',
      'Printer Essentials',
      'Filament & Parts',
    ],
    activityNames: ['Print Station', 'Maker Essentials'],
  },
  cosmetics: {
    name: 'Cosmetics',
    patterns: ['organizer', 'drawer', 'collection', 'essentials', 'kit'],
    creativeNames: [
      'Makeup Organizer',
      'Beauty Drawer',
      'Cosmetics Collection',
      'Beauty Essentials',
      'Vanity Organizer',
      'Beauty Station',
    ],
    activityNames: ['Beauty Station', 'Skincare Kit'],
  },
  misc: {
    name: 'Mixed',
    patterns: ['drawer', 'organizer', 'storage', 'box', 'tray'],
    creativeNames: [
      'Utility Drawer',
      'Junk Drawer',
      'Misc Storage',
      'Catch-All Drawer',
      'Everyday Essentials',
      'Random Bits',
    ],
  },
};

/**
 * Purpose display names for suggestion formatting.
 */
const PURPOSE_NAMES: Record<string, string> = {
  workshop: 'Workshop',
  electronics: 'Electronics',
  office: 'Office',
  craft: 'Craft',
  bathroom: 'Bathroom',
  kitchen: 'Kitchen',
  garage: 'Garage',
  general: 'Storage',
};

// ============================================
// SUBCATEGORY & ACTIVITY DETECTION
// ============================================

/**
 * Subcategory patterns for more specific naming.
 * Detected by matching label patterns.
 */
interface SubcategoryPattern {
  /** Regex patterns to match against labels */
  patterns: RegExp[];
  /** Keywords to look for in labels */
  keywords: string[];
  /** Suggested names when this subcategory is detected */
  names: string[];
  /** Minimum matches required */
  minMatches: number;
  /** Confidence boost when detected */
  confidenceBoost: number;
}

const SUBCATEGORY_PATTERNS: SubcategoryPattern[] = [
  // Metric hardware (M2, M3, M4, M5, M6, M8 screws)
  {
    patterns: [/^m[2-8](?:x\d+)?$/i, /^m\d+\s*(x|×)\s*\d+/i],
    keywords: ['metric', 'hex', 'socket head', 'shcs', 'bhcs', 'fhcs'],
    names: ['Metric Hardware', 'Metric Screws', 'Metric Fasteners', 'Socket Head Collection'],
    minMatches: 3,
    confidenceBoost: 0.15,
  },
  // Imperial hardware (#4, #6, #8, 1/4", etc.)
  {
    patterns: [/^#\d+/i, /^\d+\/\d+["-]/i, /^\d+-\d+\s*(unc|unf)/i],
    keywords: ['imperial', 'sae', 'inch'],
    names: ['Imperial Hardware', 'SAE Fasteners', 'American Hardware'],
    minMatches: 3,
    confidenceBoost: 0.15,
  },
  // Microcontrollers / Maker
  {
    patterns: [/arduino/i, /esp32/i, /esp8266/i, /raspberry/i, /rpi/i, /pico/i, /teensy/i],
    keywords: ['mcu', 'microcontroller', 'devboard', 'sensor', 'module'],
    names: ['Maker Station', 'Microcontroller Kit', 'Dev Board Collection', 'IoT Supplies'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Soldering supplies
  {
    patterns: [/solder/i, /flux/i, /iron\s*tip/i, /desoldering/i],
    keywords: ['solder', 'flux', 'tip', 'wick', 'paste', 'station'],
    names: ['Soldering Station', 'Solder Supplies', 'Soldering Kit'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Miniature painting
  {
    patterns: [/citadel/i, /vallejo/i, /army\s*painter/i, /contrast/i, /wash/i],
    keywords: ['paint', 'mini', 'miniature', 'warhammer', 'brush', 'primer'],
    names: ['Miniature Painting', 'Paint Station', 'Mini Painting Kit', 'Hobby Paints'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Sewing / Textiles
  {
    patterns: [/thread/i, /bobbin/i, /needle/i, /seam/i],
    keywords: ['thread', 'needle', 'pin', 'button', 'fabric', 'sewing', 'stitch'],
    names: ['Sewing Kit', 'Sewing Supplies', 'Notions Drawer', 'Textile Supplies'],
    minMatches: 3,
    confidenceBoost: 0.2,
  },
  // Batteries
  {
    patterns: [/^aa+$/i, /^aaa$/i, /^cr\d+/i, /^lr\d+/i, /^18650/i, /^cr123/i],
    keywords: ['battery', 'batteries', 'cell', 'rechargeable'],
    names: ['Battery Organizer', 'Battery Storage', 'Power Cell Collection'],
    minMatches: 3,
    confidenceBoost: 0.15,
  },
  // Cables / Connectivity
  {
    patterns: [/usb/i, /hdmi/i, /ethernet/i, /lightning/i, /type-?c/i, /displayport/i],
    keywords: ['cable', 'cord', 'adapter', 'dongle', 'charger', 'connector'],
    names: ['Cable Drawer', 'Cable Organizer', 'Connectivity Kit', 'Tech Cables'],
    minMatches: 3,
    confidenceBoost: 0.15,
  },
  // First Aid / Medical
  {
    patterns: [/bandage/i, /gauze/i, /antiseptic/i, /aspirin/i, /ibuprofen/i],
    keywords: ['bandaid', 'medicine', 'pill', 'vitamin', 'first aid', 'medical'],
    names: ['First Aid Kit', 'Medicine Drawer', 'Health Supplies'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Bearings & Motion
  {
    patterns: [/^608/i, /^625/i, /^6[02]\d{2}/i, /lm\d+uu/i],
    keywords: ['bearing', 'linear', 'rod', 'rail', 'motion'],
    names: ['Motion Parts', 'Bearing Collection', 'Linear Motion Kit'],
    minMatches: 2,
    confidenceBoost: 0.15,
  },
  // Jewelry / Beading
  {
    patterns: [/bead/i, /clasp/i, /findings/i, /crimp/i],
    keywords: ['bead', 'jewelry', 'charm', 'wire', 'chain', 'pendant'],
    names: ['Jewelry Supplies', 'Beading Kit', 'Jewelry Making'],
    minMatches: 3,
    confidenceBoost: 0.2,
  },
  // Fishing
  {
    patterns: [/hook/i, /lure/i, /sinker/i, /swivel/i, /bobber/i],
    keywords: ['fishing', 'tackle', 'bait', 'line', 'fly'],
    names: ['Tackle Box', 'Fishing Supplies', 'Fishing Kit'],
    minMatches: 3,
    confidenceBoost: 0.2,
  },
  // Woodworking
  {
    patterns: [/dowel/i, /biscuit/i, /pocket\s*hole/i],
    keywords: ['wood', 'dowel', 'plug', 'biscuit', 'joinery', 'chisel'],
    names: ['Woodworking Supplies', 'Joinery Kit', 'Wood Shop Drawer'],
    minMatches: 2,
    confidenceBoost: 0.15,
  },
  // Plumbing
  {
    patterns: [/pvc/i, /cpvc/i, /pex/i, /fitting/i],
    keywords: ['pipe', 'fitting', 'plumbing', 'valve', 'coupling', 'elbow'],
    names: ['Plumbing Parts', 'Pipe Fittings', 'Plumbing Supplies'],
    minMatches: 3,
    confidenceBoost: 0.2,
  },
  // RC / Drone
  {
    patterns: [/lipo/i, /esc/i, /servo/i, /propeller/i, /motor\s*\d+/i],
    keywords: ['rc', 'drone', 'quadcopter', 'helicopter', 'transmitter'],
    names: ['RC Supplies', 'Drone Parts', 'RC Kit', 'Flight Supplies'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Audio/Music
  {
    patterns: [/xlr/i, /1\/4"/i, /guitar/i, /pick/i],
    keywords: ['audio', 'music', 'cable', 'pick', 'string', 'amp'],
    names: ['Music Supplies', 'Audio Gear', 'Guitar Accessories'],
    minMatches: 2,
    confidenceBoost: 0.15,
  },
  // Kitchen
  {
    patterns: [/spice/i, /herb/i, /utensil/i],
    keywords: ['spice', 'herb', 'utensil', 'kitchen', 'cooking', 'baking', 'measuring'],
    names: ['Kitchen Drawer', 'Spice Organizer', 'Kitchen Essentials', 'Cooking Supplies'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Bathroom/Toiletries
  {
    patterns: [/toothbrush/i, /razor/i, /cotton/i, /q-?tip/i],
    keywords: ['bathroom', 'toiletry', 'hygiene', 'grooming', 'skincare', 'soap'],
    names: ['Bathroom Organizer', 'Toiletry Drawer', 'Grooming Kit', 'Bathroom Essentials'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Hardware store / General hardware
  {
    patterns: [/anchor/i, /drywall/i, /hanger/i, /hook/i],
    keywords: ['anchor', 'hanger', 'hook', 'mount', 'bracket', 'hardware'],
    names: ['Hardware Drawer', 'Mounting Supplies', 'Wall Hardware', 'Home Hardware'],
    minMatches: 2,
    confidenceBoost: 0.15,
  },
  // Photography
  {
    patterns: [/lens/i, /filter/i, /memory\s*card/i, /tripod/i],
    keywords: ['camera', 'lens', 'filter', 'photography', 'photo', 'flash'],
    names: ['Camera Gear', 'Photography Kit', 'Photo Supplies', 'Camera Accessories'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Stationery / Writing
  {
    patterns: [/fountain/i, /ballpoint/i, /gel\s*pen/i, /mechanical\s*pencil/i],
    keywords: ['pen', 'pencil', 'ink', 'refill', 'stationery', 'writing'],
    names: ['Writing Supplies', 'Pen Collection', 'Stationery Drawer', 'Writing Instruments'],
    minMatches: 3,
    confidenceBoost: 0.15,
  },
  // Leather working
  {
    patterns: [/awl/i, /punch/i, /rivet/i, /snap/i, /grommet/i],
    keywords: ['leather', 'punch', 'rivet', 'snap', 'dye', 'stitch'],
    names: ['Leatherworking Kit', 'Leather Supplies', 'Leathercraft Tools'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Model building / Scale models
  {
    patterns: [/1\/\d+/i, /scale/i, /decal/i, /sprue/i],
    keywords: ['model', 'scale', 'decal', 'airbrush', 'enamel', 'weathering'],
    names: ['Model Building Kit', 'Scale Model Supplies', 'Modeling Station'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Gardening
  {
    patterns: [/seed/i, /pot/i, /pruner/i, /trowel/i],
    keywords: ['seed', 'garden', 'plant', 'soil', 'fertilizer', 'pruning'],
    names: ['Garden Supplies', 'Seed Organizer', 'Gardening Kit', 'Plant Care'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Automotive
  {
    patterns: [/spark\s*plug/i, /fuse/i, /bulb/i, /oil\s*filter/i],
    keywords: ['automotive', 'car', 'vehicle', 'oil', 'filter', 'fuse'],
    names: ['Auto Parts', 'Car Supplies', 'Vehicle Maintenance', 'Automotive Kit'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Cycling
  {
    patterns: [/spoke/i, /tube/i, /valve/i, /brake\s*pad/i],
    keywords: ['bike', 'bicycle', 'cycling', 'spoke', 'tire', 'chain'],
    names: ['Bike Parts', 'Cycling Kit', 'Bicycle Maintenance', 'Bike Repair'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Watch making / Repair
  {
    patterns: [/spring\s*bar/i, /crown/i, /crystal/i, /movement/i],
    keywords: ['watch', 'strap', 'band', 'movement', 'crystal', 'horolog'],
    names: ['Watch Parts', 'Watch Repair Kit', 'Horologist Supplies'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Eyewear
  {
    patterns: [/lens/i, /frame/i, /nose\s*pad/i, /temple/i],
    keywords: ['glasses', 'eyewear', 'lens', 'frame', 'sunglasses', 'optical'],
    names: ['Eyewear Supplies', 'Glasses Repair', 'Optical Parts'],
    minMatches: 2,
    confidenceBoost: 0.15,
  },
  // Resin / Epoxy crafting
  {
    patterns: [/resin/i, /epoxy/i, /mold/i, /pigment/i],
    keywords: ['resin', 'epoxy', 'mold', 'silicone', 'pigment', 'casting'],
    names: ['Resin Supplies', 'Epoxy Kit', 'Casting Supplies', 'Resin Art'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Candle making
  {
    patterns: [/wick/i, /wax/i, /fragrance/i],
    keywords: ['candle', 'wick', 'wax', 'fragrance', 'scent', 'melt'],
    names: ['Candle Making Supplies', 'Candle Kit', 'Wax Crafting'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Tabletop gaming / D&D
  {
    patterns: [/d\d+/i, /dice/i, /mini/i, /token/i],
    keywords: ['dice', 'mini', 'miniature', 'token', 'figure', 'dnd', 'rpg', 'warhammer'],
    names: ['Gaming Supplies', 'Tabletop Kit', 'D&D Accessories', 'RPG Organizer'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Trading cards / Collectibles
  {
    patterns: [/mtg/i, /pokemon/i, /yugioh/i, /sleeve/i],
    keywords: ['card', 'sleeve', 'deck', 'trading', 'pokemon', 'magic', 'collectible'],
    names: ['Card Collection', 'TCG Organizer', 'Card Storage', 'Deck Box'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Hair / Styling
  {
    patterns: [/hair\s*tie/i, /bobby/i, /clip/i, /barrette/i],
    keywords: ['hair', 'bobby', 'barrette', 'scrunchie', 'elastic', 'headband'],
    names: ['Hair Accessories', 'Hair Styling Kit', 'Hair Drawer'],
    minMatches: 2,
    confidenceBoost: 0.15,
  },
  // Nail art / Manicure
  {
    patterns: [/nail\s*polish/i, /gel/i, /cuticle/i, /nail\s*art/i],
    keywords: ['nail', 'polish', 'manicure', 'cuticle', 'gel', 'lacquer'],
    names: ['Nail Art Supplies', 'Manicure Kit', 'Nail Polish Organizer'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Pet supplies
  {
    patterns: [/collar/i, /leash/i, /treat/i, /toy/i],
    keywords: ['pet', 'dog', 'cat', 'treat', 'collar', 'leash', 'toy'],
    names: ['Pet Supplies', 'Pet Accessories', 'Pet Drawer'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Kids / Toys
  {
    patterns: [/lego/i, /brick/i, /playmobil/i],
    keywords: ['lego', 'brick', 'toy', 'playmobil', 'building', 'block'],
    names: ['LEGO Organizer', 'Brick Storage', 'Building Blocks', 'Toy Drawer'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Outdoor / Camping
  {
    patterns: [/carabiner/i, /paracord/i, /firestarter/i],
    keywords: ['camping', 'outdoor', 'hiking', 'survival', 'carabiner', 'compass'],
    names: ['Camping Gear', 'Outdoor Kit', 'Survival Supplies', 'Adventure Drawer'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Vaping / E-cigarette
  {
    patterns: [/coil/i, /atomizer/i, /pod/i, /vape/i],
    keywords: ['vape', 'coil', 'pod', 'juice', 'atomizer', 'mod'],
    names: ['Vape Supplies', 'Vape Kit', 'Vaping Accessories'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Knitting / Crochet
  {
    patterns: [/yarn/i, /needle/i, /hook/i, /stitch/i],
    keywords: ['yarn', 'knitting', 'crochet', 'needle', 'hook', 'wool'],
    names: ['Knitting Supplies', 'Yarn Organizer', 'Crochet Kit', 'Fiber Arts'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Calligraphy / Lettering
  {
    patterns: [/nib/i, /ink\s*bottle/i, /calligraphy/i],
    keywords: ['calligraphy', 'nib', 'ink', 'lettering', 'brush pen'],
    names: ['Calligraphy Supplies', 'Lettering Kit', 'Ink & Nibs'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Stamps / Scrapbooking
  {
    patterns: [/stamp/i, /die\s*cut/i, /emboss/i],
    keywords: ['stamp', 'scrapbook', 'emboss', 'die', 'punch', 'sticker'],
    names: ['Scrapbook Supplies', 'Stamping Kit', 'Paper Crafts'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Airsoft / Paintball
  {
    patterns: [/bb/i, /pellet/i, /mag/i, /airsoft/i],
    keywords: ['airsoft', 'paintball', 'bb', 'pellet', 'magazine', 'ammo'],
    names: ['Airsoft Gear', 'Tactical Supplies', 'Ammo Storage'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Aquarium / Fish keeping
  {
    patterns: [/filter/i, /airline/i, /aqua/i],
    keywords: ['aquarium', 'fish', 'tank', 'filter', 'plant', 'substrate'],
    names: ['Aquarium Supplies', 'Fish Tank Kit', 'Aquatic Gear'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Gun / Shooting
  {
    patterns: [/ammo/i, /caliber/i, /magazine/i, /holster/i],
    keywords: ['ammo', 'ammunition', 'cleaning', 'magazine', 'caliber'],
    names: ['Range Supplies', 'Shooting Gear', 'Gun Cleaning Kit'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Vex / Robotics
  {
    patterns: [/vex/i, /shaft/i, /gear/i, /axle/i],
    keywords: ['robotics', 'vex', 'motor', 'gear', 'shaft', 'sensor'],
    names: ['Robotics Parts', 'VEX Organizer', 'Robot Kit'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Embroidery
  {
    patterns: [/floss/i, /hoop/i, /embroidery/i, /aida/i],
    keywords: ['embroidery', 'floss', 'hoop', 'cross stitch', 'thread'],
    names: ['Embroidery Supplies', 'Cross Stitch Kit', 'Needlework Organizer'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Pottery / Ceramics
  {
    patterns: [/clay/i, /glaze/i, /kiln/i],
    keywords: ['pottery', 'clay', 'ceramic', 'glaze', 'kiln', 'sculpt'],
    names: ['Pottery Supplies', 'Ceramics Kit', 'Clay Tools'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
  // Lock picking / Security
  {
    patterns: [/pick/i, /tension/i, /lock/i, /padlock/i],
    keywords: ['lock', 'pick', 'tension', 'security', 'padlock'],
    names: ['Lock Picking Kit', 'Security Tools', 'Lock Sport'],
    minMatches: 2,
    confidenceBoost: 0.2,
  },
];

/**
 * Size descriptor based on drawer dimensions.
 */
function getSizeDescriptor(width: number, depth: number): string {
  const area = width * depth;

  if (area <= 16) return 'Compact';
  if (area <= 40) return 'Medium';
  if (area <= 80) return 'Large';
  return 'Extra Large';
}

/**
 * Get a size-based adjective for variety.
 */
function getSizeAdjective(width: number, depth: number): string {
  const area = width * depth;
  if (area <= 16) return 'Small';
  if (area <= 40) return 'Standard';
  if (area <= 80) return 'Full-Size';
  return 'XL';
}

// ============================================
// CREATIVE NAMING
// ============================================

/**
 * Natural-sounding names by domain.
 * These should sound like what a real person would name their drawer.
 * Avoid: marketing speak, "HQ/Command/Station", forced alliteration, buzzwords
 */
const CREATIVE_NAMES: Record<LabelDomain, string[]> = {
  tools: [
    'My Tools',
    'Tool Drawer',
    'The Toolbox',
    'Shop Stuff',
    'Workshop Drawer',
    'Hand Tools',
    'Fix-It Drawer',
    'Project Tools',
    'Repair Stuff',
    'Tool Stash',
  ],
  fasteners: [
    'Nuts and Bolts',
    'Screws',
    'Hardware',
    'Small Parts',
    'Fasteners',
    'The Screw Drawer',
    'Assembly Bits',
    'Build Parts',
    'Metric Stuff',
    'Hardware Bits',
  ],
  electronics: [
    'Electronics',
    'Components',
    'Project Parts',
    'The Lab',
    'Maker Stuff',
    'Circuit Bits',
    'Tinkering',
    'Tech Stuff',
    'Arduino Drawer',
    'Spare Parts',
  ],
  office: [
    'Desk Drawer',
    'Office Stuff',
    'Pens and Things',
    'Stationery',
    'Work Stuff',
    'Desk Supplies',
    'Paper Clips etc',
    'Office Bits',
    'Writing Stuff',
    'Desk Things',
  ],
  craft: [
    'Craft Stuff',
    'Art Supplies',
    'Project Drawer',
    'Crafting',
    'My Hobbies',
    'Art Stuff',
    'Maker Drawer',
    'Creative Stuff',
    'Hobby Supplies',
    'Craft Bits',
  ],
  printing_3d: [
    'Printer Stuff',
    '3D Printing',
    'Print Supplies',
    'Filament Drawer',
    'Maker Parts',
    'Printer Parts',
    'Build Supplies',
    'Nozzles etc',
    'Printing Bits',
    '3D Bits',
  ],
  cosmetics: [
    'Makeup',
    'Beauty Stuff',
    'Cosmetics',
    'The Vanity',
    'Makeup Drawer',
    'Beauty Drawer',
    'Face Stuff',
    'Getting Ready',
    'Daily Routine',
    'Beauty Bits',
  ],
  misc: [
    'Junk Drawer',
    'Random Stuff',
    'Bits and Bobs',
    'Misc',
    'Odds and Ends',
    'Stuff',
    'Things',
    'Miscellaneous',
    'Random Things',
    'Whatever',
  ],
};

/**
 * Simple, practical alternative names.
 * How someone might casually refer to the drawer.
 */
const CASUAL_NAMES: Record<LabelDomain, string[]> = {
  tools: ['For Fixing Things', 'When Stuff Breaks', 'DIY Drawer'],
  fasteners: ['For Assembly', 'Building Stuff', 'When I Need a Screw'],
  electronics: ['For Projects', 'Tinkering Drawer', 'When I Build Stuff'],
  office: ['For Work', 'Desk Junk', 'Office Junk'],
  craft: ['For Projects', 'When I Make Stuff', 'Hobby Drawer'],
  printing_3d: ['For Printing', 'Printer Drawer', 'When I Print'],
  cosmetics: ['Morning Routine', 'Getting Ready', 'Daily Use'],
  misc: ['Just In Case', 'Might Need This', 'Who Knows'],
};

/**
 * Location-implied names (where the drawer lives).
 */
const LOCATION_NAMES: Record<LabelDomain, string[]> = {
  tools: ['Garage Drawer', 'Workbench Drawer', 'Shed Stuff'],
  fasteners: ['Shop Drawer', 'Workbench Bits', 'Garage Parts'],
  electronics: ['Desk Drawer', 'Lab Drawer', 'Workbench Parts'],
  office: ['Desk Drawer', 'Home Office', 'Work Desk'],
  craft: ['Craft Room', 'Studio Drawer', 'Craft Table'],
  printing_3d: ['Printer Desk', 'Print Corner', 'Near the Printer'],
  cosmetics: ['Bathroom Drawer', 'Vanity Drawer', 'Bedroom Drawer'],
  misc: ['Kitchen Drawer', 'That One Drawer', 'The Drawer'],
};

/**
 * Simple suffixes that sound natural.
 */
const SIMPLE_SUFFIXES: string[] = [
  'Drawer',
  'Stuff',
  'Things',
  'Bits',
  'Collection',
  'Stash',
  'Box',
  'Storage',
];

/**
 * Quantity-based names that sound natural.
 */
function getQuantityName(binCount: number): string | null {
  if (binCount >= 30) {
    const options = ['Everything', 'The Full Set', 'All of It', 'Complete Set'];
    return options[binCount % options.length];
  }
  if (binCount >= 20) {
    const options = ['Well Stocked', 'Fully Loaded', 'The Works'];
    return options[binCount % options.length];
  }
  if (binCount <= 5 && binCount > 0) {
    const options = ['The Basics', 'Essentials', 'Just What I Need', 'Starter Set'];
    return options[binCount % options.length];
  }
  return null;
}

/**
 * Get a deterministic "random" creative name based on input hash.
 * Uses label count as a simple seed for variety.
 */
function pickCreativeName(names: string[], seed: number): string {
  return names[seed % names.length];
}

// ============================================
// ANALYSIS FUNCTIONS
// ============================================

/**
 * Result of analyzing labels for domains.
 */
interface DomainAnalysis {
  /** Most common domain */
  primaryDomain: LabelDomain | null;
  /** Second most common domain (if significant) */
  secondaryDomain: LabelDomain | null;
  /** Concentration of primary domain (0-1) */
  concentration: number;
  /** Number of labels analyzed */
  totalLabels: number;
  /** Normalized terms found (for specific naming) */
  normalizedTerms: string[];
}

/**
 * Result of detecting subcategories.
 */
interface SubcategoryMatch {
  /** Suggested names from the subcategory */
  names: string[];
  /** Confidence boost */
  confidenceBoost: number;
  /** Number of matches */
  matchCount: number;
}

/**
 * Analyze labels to find the dominant domain(s).
 */
function analyzeLabels(labels: string[]): DomainAnalysis {
  const domainCounts = new Map<LabelDomain, number>();
  const normalizedTerms: string[] = [];
  let totalWithDomain = 0;

  for (const label of labels) {
    const processed = processLabel(label);
    if (processed.domain) {
      domainCounts.set(processed.domain, (domainCounts.get(processed.domain) ?? 0) + 1);
      totalWithDomain++;
    }
    if (processed.normalized) {
      normalizedTerms.push(processed.normalized);
    }
  }

  // Sort domains by count
  const sorted = Array.from(domainCounts.entries()).sort((a, b) => b[1] - a[1]);

  const primaryDomain = sorted[0]?.[0] ?? null;
  const primaryCount = sorted[0]?.[1] ?? 0;
  const secondaryDomain = sorted[1]?.[0] ?? null;
  const secondaryCount = sorted[1]?.[1] ?? 0;

  // Calculate concentration (how dominant the primary domain is)
  const concentration = totalWithDomain > 0 ? primaryCount / totalWithDomain : 0;

  // Only include secondary if it's at least 20% of total
  const hasSignificantSecondary =
    secondaryCount > 0 && totalWithDomain > 0 && secondaryCount / totalWithDomain >= 0.2;

  return {
    primaryDomain,
    secondaryDomain: hasSignificantSecondary ? secondaryDomain : null,
    concentration,
    totalLabels: labels.length,
    normalizedTerms,
  };
}

/**
 * Detect subcategories from labels for more specific naming.
 */
function detectSubcategories(labels: string[]): SubcategoryMatch | null {
  const lowercaseLabels = labels.map((l) => l.toLowerCase());

  for (const subcategory of SUBCATEGORY_PATTERNS) {
    let matchCount = 0;

    // Check pattern matches
    for (const label of labels) {
      for (const pattern of subcategory.patterns) {
        if (pattern.test(label)) {
          matchCount++;
          break; // Only count each label once
        }
      }
    }

    // Check keyword matches
    for (const label of lowercaseLabels) {
      for (const keyword of subcategory.keywords) {
        if (label.includes(keyword)) {
          matchCount++;
          break; // Only count each label once
        }
      }
    }

    if (matchCount >= subcategory.minMatches) {
      return {
        names: subcategory.names,
        confidenceBoost: subcategory.confidenceBoost,
        matchCount,
      };
    }
  }

  return null;
}

/**
 * Get the most common specific term for naming.
 * E.g., if there are many "screw" items, use "Screw" in the name.
 */
function getMostCommonTerm(normalizedTerms: string[]): string | null {
  if (normalizedTerms.length === 0) return null;

  const counts = new Map<string, number>();
  for (const term of normalizedTerms) {
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const [topTerm, topCount] = sorted[0] ?? [null, 0];

  // Only return if it's dominant (at least 40% of terms)
  if (topTerm && topCount >= normalizedTerms.length * 0.4) {
    // Convert snake_case to Title Case
    return topTerm
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return null;
}

/**
 * Location/room inference patterns.
 * Matches labels that suggest where the drawer lives.
 */
interface LocationPattern {
  keywords: string[];
  location: string;
}

const LOCATION_PATTERNS: LocationPattern[] = [
  { keywords: ['kitchen', 'spice', 'utensil', 'cooking', 'baking'], location: 'Kitchen' },
  { keywords: ['bathroom', 'toiletry', 'toothbrush', 'razor', 'hygiene'], location: 'Bathroom' },
  { keywords: ['garage', 'automotive', 'car', 'oil', 'workshop'], location: 'Garage' },
  { keywords: ['office', 'desk', 'paperclip', 'staple', 'stationery'], location: 'Office' },
  { keywords: ['bedroom', 'nightstand', 'jewelry', 'watch'], location: 'Bedroom' },
  { keywords: ['craft room', 'studio', 'art', 'paint', 'canvas'], location: 'Studio' },
  { keywords: ['laundry', 'sewing', 'thread', 'button', 'needle'], location: 'Laundry' },
  { keywords: ['shed', 'garden', 'seed', 'plant', 'fertilizer'], location: 'Shed' },
];

/**
 * Detect location/room from labels.
 */
function detectLocation(labels: string[]): string | null {
  const lowercaseLabels = labels.map((l) => l.toLowerCase()).join(' ');

  for (const pattern of LOCATION_PATTERNS) {
    const matchCount = pattern.keywords.filter((kw) => lowercaseLabels.includes(kw)).length;
    if (matchCount >= 2) {
      return pattern.location;
    }
  }

  return null;
}

/**
 * Get quantity descriptor based on bin count.
 */
function getQuantityDescriptor(binCount: number): string | null {
  if (binCount >= 30) return 'Complete';
  if (binCount >= 20) return 'Full';
  if (binCount >= 15) return 'Comprehensive';
  if (binCount >= 10) return 'Standard';
  if (binCount <= 5) return 'Starter';
  return null;
}

/**
 * Analyze categories to find dominant theme.
 */
function analyzeCategories(categories: CategoryCount[]): {
  primaryCategory: string | null;
  secondaryCategory: string | null;
  concentration: number;
  categoryNames: string[];
} {
  if (categories.length === 0) {
    return { primaryCategory: null, secondaryCategory: null, concentration: 0, categoryNames: [] };
  }

  const sorted = [...categories].sort((a, b) => b.count - a.count);
  const totalBins = categories.reduce((sum, c) => sum + c.count, 0);

  const primaryCategory = sorted[0]?.name ?? null;
  const primaryCount = sorted[0]?.count ?? 0;
  const secondaryCategory = sorted[1]?.name ?? null;
  const concentration = totalBins > 0 ? primaryCount / totalBins : 0;

  // Collect all meaningful category names (excluding default color names)
  const defaultColors = ['Coral', 'Sky', 'Green', 'Cloud', 'Charcoal', 'Purple', 'Orange'];
  const categoryNames = categories
    .filter((c) => !defaultColors.includes(c.name))
    .map((c) => c.name);

  return { primaryCategory, secondaryCategory, concentration, categoryNames };
}

/**
 * Generate a pattern-based name from domain.
 */
function generatePatternName(domain: LabelDomain, pattern: NamingPattern): string {
  const naming = DOMAIN_NAMING[domain];
  const base = naming.name;

  switch (pattern) {
    case 'drawer':
      return `${base} Drawer`;
    case 'organizer':
      return `${base} Organizer`;
    case 'station':
      return `${base} Station`;
    case 'kit':
      return `${base} Kit`;
    case 'collection':
      return `${base} Collection`;
    case 'essentials':
      return `${base} Essentials`;
    case 'storage':
      return `${base} Storage`;
    case 'supplies':
      return `${base} Supplies`;
    case 'box':
      return `${base} Box`;
    case 'tray':
      return `${base} Tray`;
  }
}

/**
 * Generate name suggestions from layout data.
 *
 * Strategies (in order of preference):
 * 1. Subcategory detection - most specific (Metric Hardware, Soldering Station, etc.)
 * 2. Label domain analysis - strongest signal from actual bin contents
 * 3. Specific term naming - uses most common item (Screw Organizer)
 * 4. Purpose inference - from existing purposeInference.ts
 * 5. Category-based - uses custom category names if significant
 * 6. Creative domain names - variety of patterns
 * 7. Dimensions-based - fallback using drawer size
 *
 * @param input - Layout data to analyze
 * @returns Ranked suggestions with confidence scores
 */
export function generateSuggestions(input: SuggestionInput): SuggestionResult {
  const suggestions: NameSuggestion[] = [];
  const { labels, categories, drawer, purpose } = input;

  const sizeDesc = getSizeDescriptor(drawer.width, drawer.depth);
  const sizeAdj = getSizeAdjective(drawer.width, drawer.depth);

  // Analyze labels for domains and specific terms
  const domainAnalysis = analyzeLabels(labels);
  const subcategoryMatch = detectSubcategories(labels);
  const specificTerm = getMostCommonTerm(domainAnalysis.normalizedTerms);

  // Strategy 1: Subcategory detection (highest confidence - most specific)
  if (subcategoryMatch && subcategoryMatch.names.length > 0) {
    const baseConfidence = 0.85 + subcategoryMatch.confidenceBoost;

    // Add all subcategory names with decreasing confidence
    subcategoryMatch.names.forEach((name, index) => {
      suggestions.push({
        name,
        source: 'labels',
        confidence: Math.max(0.5, baseConfidence - index * 0.1),
      });
    });
  }

  // Strategy 2: Label domain analysis
  if (domainAnalysis.primaryDomain && domainAnalysis.concentration >= 0.3) {
    const domain = domainAnalysis.primaryDomain;
    const naming = DOMAIN_NAMING[domain];
    const baseConfidence = 0.5 + domainAnalysis.concentration * 0.35;
    const seed = labels.length + drawer.width * drawer.depth; // Deterministic variety

    // Primary pattern-based names (standard)
    naming.patterns.slice(0, 2).forEach((pattern, index) => {
      suggestions.push({
        name: generatePatternName(domain, pattern),
        source: 'labels',
        confidence: baseConfidence - index * 0.05,
      });
    });

    // Creative/playful names (more interesting!)
    const creativeNames = CREATIVE_NAMES[domain];
    if (creativeNames.length > 0) {
      suggestions.push({
        name: pickCreativeName(creativeNames, seed),
        source: 'labels',
        confidence: baseConfidence + 0.02, // Slight boost for creativity
      });
      suggestions.push({
        name: pickCreativeName(creativeNames, seed + 3),
        source: 'labels',
        confidence: baseConfidence - 0.03,
      });
    }

    // Casual names (how someone might refer to it)
    const casualNames = CASUAL_NAMES[domain];
    if (casualNames.length > 0) {
      suggestions.push({
        name: pickCreativeName(casualNames, seed),
        source: 'labels',
        confidence: baseConfidence - 0.05,
      });
    }

    // Location-implied names
    const locationNames = LOCATION_NAMES[domain];
    if (locationNames.length > 0) {
      suggestions.push({
        name: pickCreativeName(locationNames, seed),
        source: 'labels',
        confidence: baseConfidence - 0.08,
      });
    }

    // Simple suffix variant
    const suffix = pickCreativeName(SIMPLE_SUFFIXES, seed);
    suggestions.push({
      name: `${naming.name} ${suffix}`,
      source: 'labels',
      confidence: baseConfidence - 0.1,
    });

    // Size-prefixed variant
    suggestions.push({
      name: `${sizeDesc} ${naming.name} ${naming.patterns[0] === 'drawer' ? 'Drawer' : 'Organizer'}`,
      source: 'labels',
      confidence: baseConfidence - 0.12,
    });

    // Activity-based names from domain config
    if (naming.activityNames && naming.activityNames.length > 0) {
      suggestions.push({
        name: pickCreativeName(naming.activityNames, seed),
        source: 'labels',
        confidence: baseConfidence - 0.1,
      });
    }

    // Multi-domain suggestion
    if (domainAnalysis.secondaryDomain) {
      const secondaryNaming = DOMAIN_NAMING[domainAnalysis.secondaryDomain];
      suggestions.push({
        name: `${naming.name} & ${secondaryNaming.name}`,
        source: 'labels',
        confidence: baseConfidence - 0.15,
      });
    }
  }

  // Strategy 3: Specific term naming (e.g., "Screw Organizer" if mostly screws)
  if (specificTerm) {
    suggestions.push({
      name: `${specificTerm} Organizer`,
      source: 'labels',
      confidence: 0.75,
    });
    suggestions.push({
      name: `${specificTerm} Collection`,
      source: 'labels',
      confidence: 0.7,
    });
    suggestions.push({
      name: `${specificTerm} Storage`,
      source: 'labels',
      confidence: 0.65,
    });
  }

  // Strategy 4: Purpose inference (from purposeInference.ts result)
  if (purpose) {
    const purposeName = PURPOSE_NAMES[purpose] ?? purpose;

    suggestions.push({
      name: `${purposeName} Organizer`,
      source: 'purpose',
      confidence: 0.65,
    });
    suggestions.push({
      name: `${purposeName} Drawer`,
      source: 'purpose',
      confidence: 0.6,
    });
    suggestions.push({
      name: `${purposeName} Essentials`,
      source: 'purpose',
      confidence: 0.55,
    });
    suggestions.push({
      name: `${sizeAdj} ${purposeName}`,
      source: 'purpose',
      confidence: 0.5,
    });
  }

  // Strategy 5: Category-based (if user has custom categories)
  const categoryAnalysis = analyzeCategories(categories);

  if (categoryAnalysis.categoryNames.length > 0) {
    const primaryCat = categoryAnalysis.categoryNames[0];

    if (categoryAnalysis.concentration >= 0.5) {
      suggestions.push({
        name: `${primaryCat} Drawer`,
        source: 'categories',
        confidence: 0.6 + categoryAnalysis.concentration * 0.2,
      });
      suggestions.push({
        name: `${primaryCat} Organizer`,
        source: 'categories',
        confidence: 0.55 + categoryAnalysis.concentration * 0.2,
      });
    }

    // Multi-category name
    if (categoryAnalysis.categoryNames.length >= 2) {
      const secondaryCat = categoryAnalysis.categoryNames[1];
      suggestions.push({
        name: `${primaryCat} & ${secondaryCat}`,
        source: 'categories',
        confidence: 0.5,
      });
    }

    // If there are many categories, suggest a general name
    if (categoryAnalysis.categoryNames.length >= 4) {
      suggestions.push({
        name: 'Multi-Category Organizer',
        source: 'categories',
        confidence: 0.45,
      });
    }
  }

  // Strategy 6: Location-based suggestions
  const detectedLocation = detectLocation(labels);
  if (detectedLocation) {
    suggestions.push({
      name: `${detectedLocation} Drawer`,
      source: 'labels',
      confidence: 0.6,
    });
    suggestions.push({
      name: `${detectedLocation} Organizer`,
      source: 'labels',
      confidence: 0.55,
    });
  }

  // Strategy 7: Quantity-based suggestions
  const quantityDesc = getQuantityDescriptor(labels.length);
  if (quantityDesc && domainAnalysis.primaryDomain) {
    const naming = DOMAIN_NAMING[domainAnalysis.primaryDomain];
    suggestions.push({
      name: `${quantityDesc} ${naming.name} Set`,
      source: 'labels',
      confidence: 0.5,
    });
  }

  // Strategy 8: Quantity-based names (based on how full/complete)
  const quantityName = getQuantityName(labels.length);
  if (quantityName) {
    suggestions.push({
      name: quantityName,
      source: 'labels',
      confidence: 0.45,
    });
  }

  // Strategy 9: Bin count based suggestions
  if (labels.length >= 25) {
    suggestions.push({
      name: 'Everything',
      source: 'dimensions',
      confidence: 0.38,
    });
  } else if (labels.length >= 15) {
    suggestions.push({
      name: 'Lots of Stuff',
      source: 'dimensions',
      confidence: 0.36,
    });
  } else if (labels.length >= 10) {
    suggestions.push({
      name: 'Various Things',
      source: 'dimensions',
      confidence: 0.35,
    });
  } else if (labels.length <= 4 && labels.length > 0) {
    suggestions.push({
      name: 'The Basics',
      source: 'dimensions',
      confidence: 0.35,
    });
  }

  // Strategy 10: Dimensions-based fallback (always available)
  // Simple, natural-sounding names
  const fallbacks = [
    { name: `${sizeDesc} Drawer`, confidence: 0.3 },
    { name: 'My Drawer', confidence: 0.28 },
    { name: 'Stuff', confidence: 0.27 },
    { name: 'My Stuff', confidence: 0.26 },
    { name: 'Things', confidence: 0.25 },
    { name: 'Bits and Pieces', confidence: 0.24 },
    { name: 'Misc', confidence: 0.23 },
    { name: 'Storage', confidence: 0.22 },
    { name: `${drawer.width}×${drawer.depth}`, confidence: 0.21 },
    { name: 'Drawer', confidence: 0.2 },
  ];

  // Add size-specific names
  const area = drawer.width * drawer.depth;
  if (area <= 20) {
    fallbacks.unshift({ name: 'Small Drawer', confidence: 0.29 });
    fallbacks.unshift({ name: 'Little Things', confidence: 0.28 });
  } else if (area >= 100) {
    fallbacks.unshift({ name: 'Big Drawer', confidence: 0.29 });
    fallbacks.unshift({ name: 'The Big One', confidence: 0.28 });
  }

  for (const fallback of fallbacks) {
    suggestions.push({
      name: fallback.name,
      source: 'dimensions',
      confidence: fallback.confidence,
    });
  }

  // Sort by confidence (highest first) and deduplicate
  const sorted = suggestions.sort((a, b) => b.confidence - a.confidence);
  const seen = new Set<string>();
  const unique = sorted.filter((s) => {
    const normalized = s.name.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  // Take top 5 suggestions (increased from 4 for more variety)
  const [primary, ...rest] = unique.slice(0, 5);

  return {
    primary: primary ?? null,
    alternatives: rest,
    timestamp: Date.now(),
  };
}
