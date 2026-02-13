/**
 * Static naming data for suggestion generation.
 *
 * Contains all domain naming configs, subcategory patterns, and lookup tables.
 * Separated from generation logic for maintainability.
 */

import type { LabelDomain } from '@/shared/analytics/labelVocabulary';

// ============================================
// NAMING PATTERNS & TEMPLATES
// ============================================

/**
 * Naming patterns for different contexts.
 * Each pattern produces different "flavors" of names.
 */
export type NamingPattern =
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
 * Each domain has preferred patterns, creative names, casual names, and location names.
 */
export interface DomainNaming {
  /** Base display name */
  name: string;
  /** Preferred naming patterns in order */
  patterns: NamingPattern[];
  /** Specific creative names for this domain */
  creativeNames: string[];
  /** Activity-based names when applicable */
  activityNames?: string[];
  /** Natural-sounding casual names */
  casualNames: string[];
  /** Location-implied names (where the drawer lives) */
  locationNames: string[];
}

export const DOMAIN_NAMING: Record<LabelDomain, DomainNaming> = {
  tools: {
    name: 'Tools',
    patterns: ['drawer', 'organizer', 'essentials', 'box', 'station'],
    creativeNames: [
      'My Tools',
      'Tool Drawer',
      'The Toolbox',
      'Shop Drawer',
      'Workshop Drawer',
      'Hand Tools',
      'Fix-It Drawer',
      'When Things Break',
      'Handy Stuff',
      'The Good Tools',
    ],
    activityNames: ['DIY Station', 'Repair Kit', 'Maintenance Drawer'],
    casualNames: ['For Fixing Things', 'When Stuff Breaks', 'DIY Drawer'],
    locationNames: ['Garage Drawer', 'Workbench Drawer', 'Shed Stuff'],
  },
  fasteners: {
    name: 'Fasteners',
    patterns: ['organizer', 'collection', 'storage', 'box', 'drawer'],
    creativeNames: [
      'Nuts and Bolts',
      'Screws etc',
      'Hardware Drawer',
      'Small Parts',
      'Fasteners',
      'The Screw Drawer',
      'Holding It Together',
      'Assembly Parts',
      "What's That Size?",
      'The Tiny Parts',
    ],
    activityNames: ['Build Kit', 'Assembly Station'],
    casualNames: ['For Assembly', 'Building Stuff', 'When I Need a Screw'],
    locationNames: ['Shop Drawer', 'Workbench Bits', 'Garage Parts'],
  },
  electronics: {
    name: 'Electronics',
    patterns: ['kit', 'organizer', 'station', 'supplies', 'drawer'],
    creativeNames: [
      'Electronics',
      'Components',
      'The Lab',
      'Blinky Things',
      'Project Parts',
      'Circuit Drawer',
      'Tinkering Drawer',
      'Magic Smoke Storage',
      'Arduino Drawer',
      'The Bits That Beep',
    ],
    activityNames: ['Maker Station', 'Tinkerer Kit', 'Project Supplies'],
    casualNames: ['For Projects', 'Tinkering Drawer', 'When I Build Stuff'],
    locationNames: ['Desk Drawer', 'Lab Drawer', 'Workbench Parts'],
  },
  office: {
    name: 'Office',
    patterns: ['drawer', 'organizer', 'supplies', 'essentials', 'tray'],
    creativeNames: [
      'Desk Drawer',
      'Office Supplies',
      'Pens and Things',
      'Stationery',
      'The Work Drawer',
      'Desk Supplies',
      'Paper Clips etc',
      'Meeting Survival Kit',
      'Writing Things',
      'Desk Essentials',
    ],
    activityNames: ['Writing Supplies', 'Desk Station'],
    casualNames: ['For Work', 'Desk Junk', 'Office Junk'],
    locationNames: ['Desk Drawer', 'Home Office', 'Work Desk'],
  },
  craft: {
    name: 'Craft',
    patterns: ['supplies', 'kit', 'station', 'organizer', 'box'],
    creativeNames: [
      'Craft Supplies',
      'Art Supplies',
      'Project Drawer',
      'Making Stuff',
      'Creative Drawer',
      'Art Things',
      'The Fun Drawer',
      'Hobby Drawer',
      'Creating Things',
      'My Happy Place',
    ],
    activityNames: ['Art Station', 'Creative Corner', 'Hobby Kit'],
    casualNames: ['For Projects', 'When I Make Stuff', 'Hobby Drawer'],
    locationNames: ['Craft Room', 'Studio Drawer', 'Craft Table'],
  },
  printing_3d: {
    name: '3D Printing',
    patterns: ['supplies', 'kit', 'station', 'organizer', 'essentials'],
    creativeNames: [
      'Printer Stuff',
      '3D Printing',
      'Print Supplies',
      'Filament Drawer',
      'Nozzles and Things',
      'Printer Parts',
      'Layer by Layer',
      'Print Fails Prevention',
      'The Benchy Drawer',
      'Calibration Cubes',
    ],
    activityNames: ['Print Station', 'Maker Essentials'],
    casualNames: ['For Printing', 'Printer Drawer', 'When I Print'],
    locationNames: ['Printer Desk', 'Print Corner', 'Near the Printer'],
  },
  cosmetics: {
    name: 'Cosmetics',
    patterns: ['organizer', 'drawer', 'collection', 'essentials', 'kit'],
    creativeNames: [
      'Makeup',
      'Beauty Drawer',
      'Cosmetics',
      'The Vanity',
      'Makeup Drawer',
      'Looking Good',
      'Face Things',
      'Getting Ready',
      'Daily Routine',
      'Glow Up Drawer',
    ],
    activityNames: ['Beauty Station', 'Skincare Kit'],
    casualNames: ['Morning Routine', 'Getting Ready', 'Daily Use'],
    locationNames: ['Bathroom Drawer', 'Vanity Drawer', 'Bedroom Drawer'],
  },
  misc: {
    name: 'Mixed',
    patterns: ['drawer', 'organizer', 'storage', 'box', 'tray'],
    creativeNames: [
      'Junk Drawer',
      'Random Stuff',
      'Bits and Bobs',
      'Odds and Ends',
      'The Mystery Drawer',
      'Stuff I Might Need',
      'Things',
      'Who Knows What',
      'Probably Important',
      'Just In Case',
    ],
    casualNames: ['Just In Case', 'Might Need This', 'Who Knows'],
    locationNames: ['Kitchen Drawer', 'That One Drawer', 'The Drawer'],
  },
};

/**
 * Purpose display names for suggestion formatting.
 * Maps purpose values from inferDrawerPurpose to display names.
 */
export const PURPOSE_NAMES: Record<string, string> = {
  workshop: 'Workshop',
  electronics: 'Electronics',
  office: 'Office',
  craft: 'Craft',
  bathroom: 'Bathroom',
  general: 'Storage',
};

// ============================================
// SUBCATEGORY & ACTIVITY DETECTION
// ============================================

/**
 * Subcategory patterns for more specific naming.
 * Detected by matching label patterns.
 */
export interface SubcategoryPattern {
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

/**
 * Builder for SubcategoryPattern with sensible defaults.
 * Most patterns use minMatches: 2 and confidenceBoost: 0.2.
 */
function subcategory(
  patterns: RegExp[],
  keywords: string[],
  names: string[],
  overrides?: { minMatches?: number; confidenceBoost?: number }
): SubcategoryPattern {
  return {
    patterns,
    keywords,
    names,
    minMatches: overrides?.minMatches ?? 2,
    confidenceBoost: overrides?.confidenceBoost ?? 0.2,
  };
}

export const SUBCATEGORY_PATTERNS: SubcategoryPattern[] = [
  // Metric hardware (M2, M3, M4, M5, M6, M8 screws)
  subcategory(
    [/^m[2-8](?:x\d+)?$/i, /^m\d+\s*(x|×)\s*\d+/i],
    ['metric', 'hex', 'socket head', 'shcs', 'bhcs', 'fhcs'],
    ['Metric Hardware', 'Metric Screws', 'Metric Fasteners', 'Socket Head Collection'],
    { minMatches: 3, confidenceBoost: 0.15 }
  ),
  // Imperial hardware (#4, #6, #8, 1/4", 1/4, etc.)
  subcategory(
    [/^#\d+/i, /^\d+\/\d+["-]?/i, /^\d+-\d+\s*(unc|unf)/i],
    ['imperial', 'sae', 'inch'],
    ['Imperial Hardware', 'SAE Fasteners', 'American Hardware'],
    { minMatches: 3, confidenceBoost: 0.15 }
  ),
  // Microcontrollers / Maker
  subcategory(
    [/arduino/i, /esp32/i, /esp8266/i, /raspberry/i, /rpi/i, /pico/i, /teensy/i],
    ['mcu', 'microcontroller', 'devboard', 'sensor', 'module'],
    ['Maker Station', 'Microcontroller Kit', 'Dev Board Collection', 'IoT Supplies']
  ),
  // Soldering supplies
  subcategory(
    [/solder/i, /flux/i, /iron\s*tip/i, /desoldering/i],
    ['solder', 'flux', 'tip', 'wick', 'paste', 'station'],
    ['Soldering Station', 'Solder Supplies', 'Soldering Kit']
  ),
  // Miniature painting
  subcategory(
    [/citadel/i, /vallejo/i, /army\s*painter/i, /contrast/i, /wash/i],
    ['paint', 'mini', 'miniature', 'warhammer', 'brush', 'primer'],
    ['Miniature Painting', 'Paint Station', 'Mini Painting Kit', 'Hobby Paints']
  ),
  // Sewing / Textiles
  subcategory(
    [/thread/i, /bobbin/i, /needle/i, /seam/i],
    ['thread', 'needle', 'pin', 'button', 'fabric', 'sewing', 'stitch'],
    ['Sewing Kit', 'Sewing Supplies', 'Notions Drawer', 'Textile Supplies'],
    { minMatches: 3 }
  ),
  // Batteries
  subcategory(
    [/^aa+$/i, /^aaa$/i, /^cr\d+/i, /^lr\d+/i, /^18650/i, /^cr123/i],
    ['battery', 'batteries', 'cell', 'rechargeable'],
    ['Battery Organizer', 'Battery Storage', 'Power Cell Collection'],
    { minMatches: 3, confidenceBoost: 0.15 }
  ),
  // Cables / Connectivity
  subcategory(
    [/usb/i, /hdmi/i, /ethernet/i, /lightning/i, /type-?c/i, /displayport/i],
    ['cable', 'cord', 'adapter', 'dongle', 'charger', 'connector'],
    ['Cable Drawer', 'Cable Organizer', 'Connectivity Kit', 'Tech Cables'],
    { minMatches: 3, confidenceBoost: 0.15 }
  ),
  // First Aid / Medical
  subcategory(
    [/bandage/i, /gauze/i, /antiseptic/i, /aspirin/i, /ibuprofen/i],
    ['bandaid', 'medicine', 'pill', 'vitamin', 'first aid', 'medical'],
    ['First Aid Kit', 'Medicine Drawer', 'Health Supplies']
  ),
  // Bearings & Motion
  subcategory(
    [/^608/i, /^625/i, /^6[02]\d{2}/i, /lm\d+uu/i],
    ['bearing', 'linear', 'rod', 'rail', 'motion'],
    ['Motion Parts', 'Bearing Collection', 'Linear Motion Kit'],
    { confidenceBoost: 0.15 }
  ),
  // Jewelry / Beading
  subcategory(
    [/bead/i, /clasp/i, /findings/i, /crimp/i],
    ['bead', 'jewelry', 'charm', 'wire', 'chain', 'pendant'],
    ['Jewelry Supplies', 'Beading Kit', 'Jewelry Making'],
    { minMatches: 3 }
  ),
  // Fishing
  subcategory(
    [/hook/i, /lure/i, /sinker/i, /swivel/i, /bobber/i],
    ['fishing', 'tackle', 'bait', 'line', 'fly'],
    ['Tackle Box', 'Fishing Supplies', 'Fishing Kit'],
    { minMatches: 3 }
  ),
  // Woodworking
  subcategory(
    [/dowel/i, /biscuit/i, /pocket\s*hole/i],
    ['wood', 'dowel', 'plug', 'biscuit', 'joinery', 'chisel'],
    ['Woodworking Supplies', 'Joinery Kit', 'Wood Shop Drawer'],
    { confidenceBoost: 0.15 }
  ),
  // Plumbing
  subcategory(
    [/pvc/i, /cpvc/i, /pex/i, /fitting/i],
    ['pipe', 'fitting', 'plumbing', 'valve', 'coupling', 'elbow'],
    ['Plumbing Parts', 'Pipe Fittings', 'Plumbing Supplies'],
    { minMatches: 3 }
  ),
  // RC / Drone
  subcategory(
    [/lipo/i, /esc/i, /servo/i, /propeller/i, /motor\s*\d+/i],
    ['rc', 'drone', 'quadcopter', 'helicopter', 'transmitter'],
    ['RC Supplies', 'Drone Parts', 'RC Kit', 'Flight Supplies']
  ),
  // Audio/Music
  subcategory(
    [/xlr/i, /1\/4"/i, /guitar/i, /pick/i],
    ['audio', 'music', 'cable', 'pick', 'string', 'amp'],
    ['Music Supplies', 'Audio Gear', 'Guitar Accessories'],
    { confidenceBoost: 0.15 }
  ),
  // Kitchen
  subcategory(
    [/spice/i, /herb/i, /utensil/i],
    ['spice', 'herb', 'utensil', 'kitchen', 'cooking', 'baking', 'measuring'],
    ['Kitchen Drawer', 'Spice Organizer', 'Kitchen Essentials', 'Cooking Supplies']
  ),
  // Bathroom/Toiletries
  subcategory(
    [/toothbrush/i, /razor/i, /cotton/i, /q-?tip/i],
    ['bathroom', 'toiletry', 'hygiene', 'grooming', 'skincare', 'soap'],
    ['Bathroom Organizer', 'Toiletry Drawer', 'Grooming Kit', 'Bathroom Essentials']
  ),
  // Hardware store / General hardware
  subcategory(
    [/anchor/i, /drywall/i, /hanger/i, /hook/i],
    ['anchor', 'hanger', 'hook', 'mount', 'bracket', 'hardware'],
    ['Hardware Drawer', 'Mounting Supplies', 'Wall Hardware', 'Home Hardware'],
    { confidenceBoost: 0.15 }
  ),
  // Photography
  subcategory(
    [/lens/i, /filter/i, /memory\s*card/i, /tripod/i],
    ['camera', 'lens', 'filter', 'photography', 'photo', 'flash'],
    ['Camera Gear', 'Photography Kit', 'Photo Supplies', 'Camera Accessories']
  ),
  // Stationery / Writing
  subcategory(
    [/fountain/i, /ballpoint/i, /gel\s*pen/i, /mechanical\s*pencil/i],
    ['pen', 'pencil', 'ink', 'refill', 'stationery', 'writing'],
    ['Writing Supplies', 'Pen Collection', 'Stationery Drawer', 'Writing Instruments'],
    { minMatches: 3, confidenceBoost: 0.15 }
  ),
  // Leather working
  subcategory(
    [/awl/i, /punch/i, /rivet/i, /snap/i, /grommet/i],
    ['leather', 'punch', 'rivet', 'snap', 'dye', 'stitch'],
    ['Leatherworking Kit', 'Leather Supplies', 'Leathercraft Tools']
  ),
  // Model building / Scale models
  subcategory(
    [/1\/\d+/i, /scale/i, /decal/i, /sprue/i],
    ['model', 'scale', 'decal', 'airbrush', 'enamel', 'weathering'],
    ['Model Building Kit', 'Scale Model Supplies', 'Modeling Station']
  ),
  // Gardening
  subcategory(
    [/seed/i, /pot/i, /pruner/i, /trowel/i],
    ['seed', 'garden', 'plant', 'soil', 'fertilizer', 'pruning'],
    ['Garden Supplies', 'Seed Organizer', 'Gardening Kit', 'Plant Care']
  ),
  // Automotive
  subcategory(
    [/spark\s*plug/i, /fuse/i, /bulb/i, /oil\s*filter/i],
    ['automotive', 'car', 'vehicle', 'oil', 'filter', 'fuse'],
    ['Auto Parts', 'Car Supplies', 'Vehicle Maintenance', 'Automotive Kit']
  ),
  // Cycling
  subcategory(
    [/spoke/i, /tube/i, /valve/i, /brake\s*pad/i],
    ['bike', 'bicycle', 'cycling', 'spoke', 'tire', 'chain'],
    ['Bike Parts', 'Cycling Kit', 'Bicycle Maintenance', 'Bike Repair']
  ),
  // Watch making / Repair
  subcategory(
    [/spring\s*bar/i, /crown/i, /crystal/i, /movement/i],
    ['watch', 'strap', 'band', 'movement', 'crystal', 'horolog'],
    ['Watch Parts', 'Watch Repair Kit', 'Horologist Supplies']
  ),
  // Eyewear
  subcategory(
    [/lens/i, /frame/i, /nose\s*pad/i, /temple/i],
    ['glasses', 'eyewear', 'lens', 'frame', 'sunglasses', 'optical'],
    ['Eyewear Supplies', 'Glasses Repair', 'Optical Parts'],
    { confidenceBoost: 0.15 }
  ),
  // Resin / Epoxy crafting
  subcategory(
    [/resin/i, /epoxy/i, /mold/i, /pigment/i],
    ['resin', 'epoxy', 'mold', 'silicone', 'pigment', 'casting'],
    ['Resin Supplies', 'Epoxy Kit', 'Casting Supplies', 'Resin Art']
  ),
  // Candle making
  subcategory(
    [/wick/i, /wax/i, /fragrance/i],
    ['candle', 'wick', 'wax', 'fragrance', 'scent', 'melt'],
    ['Candle Making Supplies', 'Candle Kit', 'Wax Crafting']
  ),
  // Tabletop gaming / D&D
  // Note: /\bd\d+\b/i could match vitamins like D3, so require dice-related context
  subcategory(
    [/\bd(?:4|6|8|10|12|20|100)\b/i, /dice/i, /\bmini(?:ature)?s?\b/i, /token/i],
    ['dice', 'mini', 'miniature', 'token', 'figure', 'dnd', 'rpg', 'warhammer', 'pathfinder'],
    ['Dice & Minis', 'Tabletop Kit', 'D&D Stuff', 'Game Night Drawer']
  ),
  // Trading cards / Collectibles
  subcategory(
    [/mtg/i, /pokemon/i, /yugioh/i, /sleeve/i],
    ['card', 'sleeve', 'deck', 'trading', 'pokemon', 'magic', 'collectible'],
    ['Card Collection', 'TCG Organizer', 'Card Storage', 'Deck Box']
  ),
  // Hair / Styling
  subcategory(
    [/hair\s*tie/i, /bobby/i, /clip/i, /barrette/i],
    ['hair', 'bobby', 'barrette', 'scrunchie', 'elastic', 'headband'],
    ['Hair Accessories', 'Hair Styling Kit', 'Hair Drawer'],
    { confidenceBoost: 0.15 }
  ),
  // Nail art / Manicure
  subcategory(
    [/nail\s*polish/i, /gel/i, /cuticle/i, /nail\s*art/i],
    ['nail', 'polish', 'manicure', 'cuticle', 'gel', 'lacquer'],
    ['Nail Art Supplies', 'Manicure Kit', 'Nail Polish Organizer']
  ),
  // Pet supplies
  subcategory(
    [/collar/i, /leash/i, /treat/i, /toy/i],
    ['pet', 'dog', 'cat', 'treat', 'collar', 'leash', 'toy'],
    ['Pet Supplies', 'Pet Accessories', 'Pet Drawer']
  ),
  // Kids / Toys
  subcategory(
    [/lego/i, /brick/i, /playmobil/i],
    ['lego', 'brick', 'toy', 'playmobil', 'building', 'block'],
    ['LEGO Organizer', 'Brick Storage', 'Building Blocks', 'Toy Drawer']
  ),
  // Outdoor / Camping
  subcategory(
    [/carabiner/i, /paracord/i, /firestarter/i],
    ['camping', 'outdoor', 'hiking', 'survival', 'carabiner', 'compass'],
    ['Camping Gear', 'Outdoor Kit', 'Survival Supplies', 'Adventure Drawer']
  ),
  // Vaping / E-cigarette
  subcategory(
    [/coil/i, /atomizer/i, /pod/i, /vape/i],
    ['vape', 'coil', 'pod', 'juice', 'atomizer', 'mod'],
    ['Vape Supplies', 'Vape Kit', 'Vaping Accessories']
  ),
  // Knitting / Crochet
  subcategory(
    [/yarn/i, /needle/i, /hook/i, /stitch/i],
    ['yarn', 'knitting', 'crochet', 'needle', 'hook', 'wool'],
    ['Knitting Supplies', 'Yarn Organizer', 'Crochet Kit', 'Fiber Arts']
  ),
  // Calligraphy / Lettering
  subcategory(
    [/nib/i, /ink\s*bottle/i, /calligraphy/i],
    ['calligraphy', 'nib', 'ink', 'lettering', 'brush pen'],
    ['Calligraphy Supplies', 'Lettering Kit', 'Ink & Nibs']
  ),
  // Stamps / Scrapbooking
  subcategory(
    [/stamp/i, /die\s*cut/i, /emboss/i],
    ['stamp', 'scrapbook', 'emboss', 'die', 'punch', 'sticker'],
    ['Scrapbook Supplies', 'Stamping Kit', 'Paper Crafts']
  ),
  // Airsoft / Paintball
  subcategory(
    [/\bbbs?\b/i, /pellet/i, /\bmag\b/i, /airsoft/i, /paintball/i],
    ['airsoft', 'paintball', 'pellet', 'magazine', 'ammo'],
    ['Airsoft Gear', 'Tactical Supplies', 'Ammo Storage']
  ),
  // Aquarium / Fish keeping
  subcategory(
    [/filter/i, /airline/i, /aqua/i],
    ['aquarium', 'fish', 'tank', 'filter', 'plant', 'substrate'],
    ['Aquarium Supplies', 'Fish Tank Kit', 'Aquatic Gear']
  ),
  // Gun / Shooting
  subcategory(
    [/ammo/i, /caliber/i, /magazine/i, /holster/i],
    ['ammo', 'ammunition', 'cleaning', 'magazine', 'caliber'],
    ['Range Supplies', 'Shooting Gear', 'Gun Cleaning Kit']
  ),
  // Vex / Robotics
  subcategory(
    [/vex/i, /shaft/i, /gear/i, /axle/i],
    ['robotics', 'vex', 'motor', 'gear', 'shaft', 'sensor'],
    ['Robotics Parts', 'VEX Organizer', 'Robot Kit']
  ),
  // Embroidery
  subcategory(
    [/floss/i, /hoop/i, /embroidery/i, /aida/i],
    ['embroidery', 'floss', 'hoop', 'cross stitch', 'thread'],
    ['Embroidery Supplies', 'Cross Stitch Kit', 'Needlework Organizer']
  ),
  // Pottery / Ceramics
  subcategory(
    [/clay/i, /glaze/i, /kiln/i],
    ['pottery', 'clay', 'ceramic', 'glaze', 'kiln', 'sculpt'],
    ['Pottery Supplies', 'Ceramics Kit', 'Clay Tools']
  ),
  // Lock picking / Security
  subcategory(
    [/pick/i, /tension/i, /lock/i, /padlock/i],
    ['lock', 'pick', 'tension', 'security', 'padlock'],
    ['Lock Picking Kit', 'Security Tools', 'Lock Sport']
  ),
  // Vitamins / Supplements (to avoid false positive with dice D6, etc.)
  subcategory(
    [/vitamin/i, /\b(?:d3|b12|b6|c|e|k2|omega)\b/i, /supplement/i, /probiotic/i],
    ['vitamin', 'supplement', 'omega', 'probiotic', 'mineral', 'multivitamin'],
    ['Vitamins', 'Daily Supplements', 'Health Drawer', 'Wellness Kit'],
    { confidenceBoost: 0.25 } // Higher to beat dice false positive
  ),
  // Cleaning supplies
  subcategory(
    [/sponge/i, /brush/i, /wipe/i, /cleaner/i, /detergent/i],
    ['cleaning', 'sponge', 'brush', 'wipe', 'spray', 'polish', 'cloth'],
    ['Cleaning Supplies', 'Cleaning Drawer', 'Tidy Up Kit'],
    { confidenceBoost: 0.15 }
  ),
  // EDC / Everyday Carry
  subcategory(
    [/flashlight/i, /multitool/i, /leatherman/i, /wallet/i],
    ['edc', 'everyday', 'carry', 'pocket', 'flashlight', 'multitool'],
    ['EDC Gear', 'Pocket Essentials', 'Everyday Carry', 'Daily Carry']
  ),
  // Nerf / Toy blasters
  subcategory(
    [/nerf/i, /dart/i, /blaster/i, /rival/i],
    ['nerf', 'dart', 'blaster', 'foam', 'rival', 'elite'],
    ['Nerf Arsenal', 'Blaster Drawer', 'Dart Storage', 'Nerf Stuff']
  ),
  // Smart home / Home automation
  subcategory(
    [/zigbee/i, /z-?wave/i, /sensor/i, /smart\s*(plug|bulb|switch)/i],
    ['smart', 'sensor', 'zigbee', 'automation', 'iot', 'home assistant'],
    ['Smart Home Parts', 'Home Automation', 'Sensor Drawer', 'IoT Stuff']
  ),
  // Phone/Device repair
  subcategory(
    [/screen/i, /battery/i, /spudger/i, /suction/i, /ifixit/i],
    ['repair', 'screen', 'battery', 'spudger', 'pry', 'replacement'],
    ['Repair Kit', 'Device Repair', 'Fix-It Drawer', 'Phone Parts']
  ),
  // Board games (non-RPG)
  subcategory(
    [/meeple/i, /card\s*sleeve/i, /token/i, /cube/i],
    ['board game', 'meeple', 'token', 'cube', 'sleeve', 'component'],
    ['Board Game Bits', 'Game Night', 'Gaming Drawer', 'Game Components']
  ),
  // ============================================
  // COMMUNITY-REQUESTED PATTERNS (HIGH PRIORITY)
  // Based on real Gridfinity usage research
  // ============================================

  // Kitchen utensils & cooking (very popular use case)
  subcategory(
    [/spatula/i, /whisk/i, /ladle/i, /tongs/i, /utensil/i],
    ['kitchen', 'utensil', 'spatula', 'spoon', 'cooking', 'ladle', 'tongs'],
    ['Kitchen Utensils', 'Cooking Drawer', 'Kitchen Drawer', 'Utensil Organizer']
  ),
  // Cutlery & silverware
  subcategory(
    [/fork/i, /spoon/i, /knife/i, /chopstick/i, /cutlery/i],
    ['cutlery', 'silverware', 'fork', 'spoon', 'knife', 'chopstick', 'flatware'],
    ['Cutlery Drawer', 'Silverware', 'Flatware Organizer', 'Dining Drawer'],
    { minMatches: 3 }
  ),
  // Spices & seasonings
  subcategory(
    [/spice/i, /oregano/i, /paprika/i, /cumin/i, /cinnamon/i, /seasoning/i],
    ['spice', 'spices', 'seasoning', 'herb', 'herbs', 'paprika', 'cumin'],
    ['Spice Drawer', 'Spice Organizer', 'Seasoning Rack', 'Spice Collection'],
    { confidenceBoost: 0.25 }
  ),
  // Coffee & tea
  subcategory(
    [/k-?cup/i, /nespresso/i, /coffee\s*pod/i, /tea\s*bag/i, /espresso/i],
    ['coffee', 'tea', 'pod', 'kcup', 'nespresso', 'espresso', 'caffeine'],
    ['Coffee Station', 'Tea Drawer', 'Coffee & Tea', 'Caffeine Corner']
  ),
  // Baking supplies
  subcategory(
    [/cookie\s*cutter/i, /piping\s*tip/i, /measuring\s*cup/i, /baking/i],
    ['baking', 'cookie', 'piping', 'decorating', 'measuring', 'fondant'],
    ['Baking Supplies', 'Baking Drawer', 'Cookie Decorating', "Baker's Drawer"]
  ),
  // LEGO bricks (expanded - popular use case)
  subcategory(
    [/\b\d+x\d+\b/i, /technic/i, /minifig/i, /baseplate/i, /bricklink/i],
    ['lego', 'brick', 'plate', 'tile', 'slope', 'technic', 'minifig', 'stud'],
    ['LEGO Bricks', 'Brick Organizer', 'LEGO Parts', 'Building Blocks'],
    { confidenceBoost: 0.25 }
  ),
  // Grooming & hair care
  subcategory(
    [/clipper/i, /trimmer/i, /wahl/i, /philips/i, /oneblade/i, /guard/i],
    ['clipper', 'trimmer', 'hair', 'grooming', 'guard', 'comb', 'attachment'],
    ['Grooming Kit', 'Hair Clippers', 'Grooming Drawer', 'Haircut Supplies']
  ),
  // Beard care
  subcategory(
    [/beard/i, /mustache/i, /shave/i, /razor/i, /aftershave/i],
    ['beard', 'shave', 'razor', 'aftershave', 'balm', 'oil', 'brush'],
    ['Beard Care', 'Shaving Kit', 'Grooming Essentials', 'Shave Drawer']
  ),
  // Dental & oral care
  subcategory(
    [/toothbrush/i, /sonicare/i, /oral-?b/i, /floss/i, /waterpik/i],
    ['dental', 'toothbrush', 'floss', 'toothpaste', 'mouthwash', 'retainer'],
    ['Dental Supplies', 'Oral Care', 'Toothbrush Drawer', 'Dental Kit']
  ),
  // CNC & router bits
  subcategory(
    [/router\s*bit/i, /end\s*mill/i, /v-?bit/i, /collet/i, /er\d+/i],
    ['router', 'bit', 'collet', 'endmill', 'cnc', 'shank', 'carbide'],
    ['Router Bits', 'CNC Tooling', 'Milling Bits', 'CNC Supplies']
  ),
  // Sandpaper & abrasives
  subcategory(
    [/\d+\s*grit/i, /sandpaper/i, /sanding\s*disc/i, /abrasive/i],
    ['sandpaper', 'grit', 'sanding', 'abrasive', 'polish', 'finishing'],
    ['Sanding Supplies', 'Sandpaper Drawer', 'Abrasives', 'Finishing Supplies']
  ),
  // Automotive fluids & filters
  subcategory(
    [/oil\s*filter/i, /air\s*filter/i, /spark\s*plug/i, /brake\s*pad/i],
    ['automotive', 'filter', 'fluid', 'brake', 'coolant', 'transmission'],
    ['Auto Parts', 'Car Maintenance', 'Vehicle Supplies', 'Automotive Drawer']
  ),
  // Car fuses & electrical
  subcategory(
    [/\bfuse\b/i, /relay/i, /obd2?/i, /connector/i, /terminal/i],
    ['fuse', 'relay', 'automotive', 'electrical', 'connector', 'obd'],
    ['Car Electrical', 'Fuses & Relays', 'Auto Electrical', 'Wiring Supplies']
  ),
  // Resin 3D printing (distinct from FDM)
  subcategory(
    [/resin/i, /fep/i, /ipa/i, /cure/i, /wash\s*station/i, /lcd/i],
    ['resin', 'fep', 'ipa', 'cure', 'wash', 'vat', 'lcd', 'msla'],
    ['Resin Printing', 'SLA Supplies', 'Resin Station', 'Print Supplies']
  ),
  // FPV & drone
  subcategory(
    [/propeller/i, /fpv/i, /quadcopter/i, /flight\s*controller/i, /vtx/i],
    ['fpv', 'drone', 'propeller', 'quad', 'motor', 'esc', 'goggles'],
    ['Drone Parts', 'FPV Gear', 'Quad Supplies', 'Flight Kit']
  ),
  // Fountain pens & ink
  subcategory(
    [/fountain\s*pen/i, /\bnib\b/i, /ink\s*bottle/i, /lamy/i, /twsbi/i, /pilot/i],
    ['fountain', 'pen', 'nib', 'ink', 'converter', 'cartridge'],
    ['Pen Collection', 'Ink Supplies', 'Fountain Pens', 'Writing Instruments']
  ),
  // Washi tape & journaling
  subcategory(
    [/washi/i, /bullet\s*journal/i, /planner/i, /sticker/i, /wax\s*seal/i],
    ['washi', 'journal', 'planner', 'sticker', 'scrapbook', 'bujo'],
    ['Journal Supplies', 'Planner Drawer', 'Washi & Stickers', 'Bujo Kit']
  ),
  // Model trains
  subcategory(
    [/\b(?:ho|n|o|g)\s*scale/i, /locomotive/i, /boxcar/i, /caboose/i, /dcc/i],
    ['train', 'railroad', 'locomotive', 'scale', 'track', 'scenery'],
    ['Model Trains', 'Railroad Parts', 'Train Supplies', 'Layout Accessories']
  ),
  // Gundam & model kits
  subcategory(
    [/gundam/i, /gunpla/i, /bandai/i, /\b(?:hg|mg|pg|rg)\b/i, /runner/i],
    ['gundam', 'gunpla', 'model kit', 'bandai', 'plastic model', 'runner'],
    ['Gunpla Supplies', 'Model Kit Parts', 'Gundam Builder', 'Kit Bash']
  ),
  // Mechanical keyboards
  subcategory(
    [/keycap/i, /switch/i, /stabilizer/i, /\b(?:cherry|gateron|kailh)\b/i, /pcb/i],
    ['keycap', 'switch', 'keyboard', 'mechanical', 'stabilizer', 'lube'],
    ['Keyboard Parts', 'Keycap Collection', 'Mech Keyboard', 'Switch Drawer']
  ),
];

/**
 * Simple suffixes that sound natural.
 */
export const SIMPLE_SUFFIXES: string[] = [
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
 * Location/room inference patterns.
 * Matches labels that suggest where the drawer lives.
 */
export interface LocationPattern {
  keywords: string[];
  location: string;
}

export const LOCATION_PATTERNS: LocationPattern[] = [
  { keywords: ['kitchen', 'spice', 'utensil', 'cooking', 'baking'], location: 'Kitchen' },
  { keywords: ['bathroom', 'toiletry', 'toothbrush', 'razor', 'hygiene'], location: 'Bathroom' },
  { keywords: ['garage', 'automotive', 'car', 'oil', 'workshop'], location: 'Garage' },
  { keywords: ['office', 'desk', 'paperclip', 'staple', 'stationery'], location: 'Office' },
  { keywords: ['bedroom', 'nightstand', 'jewelry', 'watch'], location: 'Bedroom' },
  { keywords: ['craft room', 'studio', 'art', 'paint', 'canvas'], location: 'Studio' },
  { keywords: ['laundry', 'sewing', 'thread', 'button', 'needle'], location: 'Laundry' },
  { keywords: ['shed', 'garden', 'seed', 'plant', 'fertilizer'], location: 'Shed' },
];
