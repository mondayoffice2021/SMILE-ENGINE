/**
 * Master List of Product Categories & Related Sourcing Keywords
 * Designed for B2B company searches, international sourcing, and product classification
 * across Google, Bing, Yahoo, and company directories (Alibaba, ThomasNet, Europages, Kompass).
 */

export interface MasterCategoryDefinition {
  id: string;
  name: string;
  icon: string;
  parentIndustry: string;
  relatedKeywords: string[];
  alternativeNames: string[];
  productKeywords: string[];
  classificationTokens: string[];
  sampleQueryTerms: string[];
}

export const MASTER_PRODUCT_CATEGORIES: MasterCategoryDefinition[] = [
  {
    id: 'pharmaceuticals',
    name: 'Pharmaceuticals',
    icon: '💊',
    parentIndustry: 'Healthcare & Life Sciences',
    relatedKeywords: [
      'Medicines',
      'Pharmaceutical products',
      'Drug manufacturers',
      'APIs',
      'Generic medicines',
      'Active pharmaceutical ingredients',
      'Pharmaceutical formulations',
      'Over-the-counter (OTC) drugs',
      'Contract manufacturing pharma',
      'Finished dosage forms (FDF)'
    ],
    alternativeNames: [
      'Pharma',
      'Medicinal products',
      'Biopharmaceuticals',
      'Therapeutics',
      'Formulations',
      'Bulk drug substances'
    ],
    productKeywords: [
      'Tablets',
      'Capsules',
      'Injectables',
      'Syrups',
      'Ointments',
      'Active pharmaceutical ingredients (APIs)',
      'Antibiotics',
      'Vaccines',
      'IV fluids',
      'Biologics'
    ],
    classificationTokens: [
      'pharmaceutical', 'pharma', 'medicine', 'medicines', 'api', 'apis', 'drug', 'drugs',
      'generic medicine', 'formulation', 'bulk drugs', 'biopharma', 'dosage', 'pharmaceuticals',
      'biotech', 'lab', 'therapeutics', 'vaccine'
    ],
    sampleQueryTerms: ['drug manufacturers', 'pharmaceutical products supplier', 'APIs exporter', 'generic medicines factory']
  },
  {
    id: 'medical',
    name: 'Medical',
    icon: '🏥',
    parentIndustry: 'Healthcare & Life Sciences',
    relatedKeywords: [
      'Health',
      'Pharma',
      'Clinic',
      'Hospital',
      'Med',
      'Care',
      'Bio',
      'Dental',
      'Medical equipment',
      'Healthcare solutions'
    ],
    alternativeNames: [
      'Healthcare and medical',
      'Clinical healthcare',
      'Medical sector',
      'Health sciences',
      'Biomedical & health'
    ],
    productKeywords: [
      'Hospital medical supplies',
      'Clinical diagnostic systems',
      'Healthcare pharmaceuticals',
      'Dental clinic apparatus',
      'Biomedical patient care devices',
      'Medical clinic equipment'
    ],
    classificationTokens: [
      'health', 'pharma', 'clinic', 'hospital', 'med', 'care', 'bio', 'dental',
      'medical', 'healthcare', 'clinical', 'lifesciences', 'diagnostics'
    ],
    sampleQueryTerms: ['medical supplies manufacturer', 'healthcare hospital equipment supplier', 'medical clinic products exporter', 'dental clinic supplier']
  },
  {
    id: 'medical-equipment',
    name: 'Medical Equipment',
    icon: '🩺',
    parentIndustry: 'Healthcare & Life Sciences',
    relatedKeywords: [
      'Diagnostic equipment',
      'Hospital equipment',
      'Patient monitors',
      'Surgical instruments',
      'Ultrasound machines',
      'Medical devices',
      'Sterilization equipment',
      'Anesthesia machines',
      'Electrocardiographs (ECG/EKG)',
      'Radiology & X-ray systems'
    ],
    alternativeNames: [
      'Biomedical devices',
      'Hospital apparatus',
      'Clinical diagnostic systems',
      'Surgical systems',
      'Medical technology (MedTech)'
    ],
    productKeywords: [
      'Ultrasound scanners',
      'Defibrillators',
      'Infusion pumps',
      'Operating tables',
      'Surgical lights',
      'Hospital beds',
      'Ventilators',
      'Endoscopes',
      'Autoclaves',
      'Suction units'
    ],
    classificationTokens: [
      'medical equipment', 'medical device', 'medical devices', 'hospital equipment', 'biomedical',
      'surgical equipment', 'diagnostic equipment', 'patient monitor', 'ultrasound', 'ventilator', 'medtech', 'surgical instruments'
    ],
    sampleQueryTerms: ['medical equipment manufacturers', 'hospital devices suppliers', 'surgical instruments exporter', 'diagnostic equipment distributor']
  },
  {
    id: 'laboratory-equipment',
    name: 'Laboratory Equipment',
    icon: '🔬',
    parentIndustry: 'Healthcare & Life Sciences',
    relatedKeywords: [
      'Lab instruments',
      'Centrifuges',
      'Microscopes',
      'Spectrophotometers',
      'Incubators',
      'Laboratory glassware',
      'Chromatography systems',
      'Laboratory autoclaves',
      'Analytical balances',
      'Pipettes and liquid handling'
    ],
    alternativeNames: [
      'Scientific instruments',
      'Lab apparatus',
      'Analytical equipment',
      'Research instruments',
      'Laboratory technology'
    ],
    productKeywords: [
      'Optical microscopes',
      'Refrigerated centrifuges',
      'UV-Vis spectrophotometers',
      'BOD incubators',
      'Fume hoods',
      'Beakers and flasks',
      'HPLC systems',
      'Vortex mixers',
      'Thermal cyclers (PCR)',
      'pH meters'
    ],
    classificationTokens: [
      'laboratory equipment', 'lab instruments', 'lab equipment', 'laboratory', 'centrifuge', 'microscope',
      'spectrophotometer', 'chromatography', 'scientific instruments', 'lab glassware', 'incubator', 'pipette'
    ],
    sampleQueryTerms: ['laboratory equipment manufacturer', 'scientific instruments supplier', 'lab glassware exporter', 'centrifuges distributor']
  },
  {
    id: 'pharmaceutical-equipment',
    name: 'Pharmaceutical Equipment',
    icon: '🏭',
    parentIndustry: 'Manufacturing & Engineering',
    relatedKeywords: [
      'Tablet press machines',
      'Capsule filling machines',
      'Blister packaging machines',
      'Fluid bed dryers',
      'Pharma reactors',
      'Cleanroom equipment',
      'Granulators',
      'Coating machines',
      'Liquid filling lines',
      'Sterilization tunnels'
    ],
    alternativeNames: [
      'Pharma machinery',
      'Pharmaceutical processing machinery',
      'Bio-reactor systems',
      'Cleanroom systems',
      'Solid dosage machinery'
    ],
    productKeywords: [
      'Rotary tablet presses',
      'Automatic capsule fillers',
      'Fluidized bed processors',
      'Ampoule filling & sealing',
      'Pharma stainless steel tanks',
      'High shear mixers',
      'Laminar air flow hoods',
      'Vial washing machines',
      'Pharma packaging lines'
    ],
    classificationTokens: [
      'pharmaceutical equipment', 'pharma equipment', 'pharma machinery', 'tablet press', 'capsule filling',
      'blister packaging', 'fluid bed dryer', 'cleanroom equipment', 'granulator', 'coating machine'
    ],
    sampleQueryTerms: ['pharmaceutical equipment manufacturers', 'pharma machinery exporter', 'tablet press machine supplier', 'cleanroom systems factory']
  },
  {
    id: 'medical-consumables',
    name: 'Medical Consumables',
    icon: '🧤',
    parentIndustry: 'Healthcare & Life Sciences',
    relatedKeywords: [
      'Gloves',
      'Syringes',
      'Needles',
      'Dressings',
      'Masks',
      'Disposable medical products',
      'Gauze rolls and swabs',
      'IV cannula and infusion sets',
      'Surgical drapes',
      'Medical adhesives'
    ],
    alternativeNames: [
      'Single-use medical supplies',
      'Disposable hospital supplies',
      'Medical disposables',
      'Clinical consumables',
      'Surgical sundries'
    ],
    productKeywords: [
      'Nitrile examination gloves',
      'Latex surgical gloves',
      'Disposable hypodermic syringes',
      'Sterile wound dressings',
      '3-ply surgical masks',
      'N95 particulate respirators',
      'Blood collection tubes',
      'Foley catheters',
      'Adhesive surgical tape',
      'Alcohol prep pads'
    ],
    classificationTokens: [
      'medical consumable', 'medical consumables', 'disposable medical', 'medical gloves', 'syringes',
      'surgical masks', 'wound dressing', 'sterile dressings', 'disposable hospital', 'iv cannula', 'dressings'
    ],
    sampleQueryTerms: ['medical consumables manufacturers', 'disposable medical products supplier', 'nitrile gloves exporter', 'sterile syringes factory']
  },
  {
    id: 'dental-equipment',
    name: 'Dental Equipment',
    icon: '🦷',
    parentIndustry: 'Healthcare & Life Sciences',
    relatedKeywords: [
      'Dental instruments',
      'Dental chairs',
      'Dental imaging',
      'Dental laboratory equipment',
      'Dental handpieces',
      'Autoclaves for dentistry',
      'Orthodontic supplies',
      'Dental curing lights',
      'Dental suction units',
      'Intraoral cameras'
    ],
    alternativeNames: [
      'Dentistry apparatus',
      'Oral surgery instruments',
      'Prosthodontic supplies',
      'Dental operatory units',
      'Dental tech'
    ],
    productKeywords: [
      'High-speed dental handpieces',
      'Ergonomic dental chair units',
      'Dental X-ray sensors',
      'Cone beam CT (CBCT) dental',
      'Dental scalers and polishers',
      'Dental laboratory micromotors',
      'Orthodontic brackets and wires',
      'Dental composite materials',
      'Dental impression trays'
    ],
    classificationTokens: [
      'dental equipment', 'dental instruments', 'dental chair', 'dental imaging', 'dental handpiece',
      'orthodontic', 'dental lab', 'dentistry supplies', 'intraoral', 'dental', 'dentistry'
    ],
    sampleQueryTerms: ['dental equipment manufacturers', 'dental instruments exporter', 'dental chairs factory', 'orthodontic supplies supplier']
  },
  {
    id: 'veterinary',
    name: 'Veterinary',
    icon: '🐾',
    parentIndustry: 'Agriculture & Animal Health',
    relatedKeywords: [
      'Veterinary instruments',
      'Animal health products',
      'Veterinary diagnostic equipment',
      'Vet surgical tools',
      'Veterinary pharmaceuticals',
      'Veterinary anesthesia',
      'Animal feed supplements',
      'Veterinary ultrasound',
      'Livestock management supplies',
      'Pet care medical equipment'
    ],
    alternativeNames: [
      'Animal healthcare',
      'Veterinary supplies',
      'Livestock healthcare',
      'Vet Med equipment',
      'Veterinary clinical diagnostics'
    ],
    productKeywords: [
      'Veterinary orthopedic kits',
      'Animal patient monitors',
      'Equine diagnostic tools',
      'Veterinary hematology analyzers',
      'Bovine artificial insemination tools',
      'Pet vaccination supplies',
      'Veterinary dental equipment',
      'Grooming and care tables',
      'Animal microchip scanners'
    ],
    classificationTokens: [
      'veterinary', 'vet instruments', 'animal health', 'veterinary equipment', 'veterinary diagnostics',
      'livestock health', 'vet surgical', 'animal clinic', 'veterinary pharma', 'veterinarian'
    ],
    sampleQueryTerms: ['veterinary instruments manufacturers', 'animal health products supplier', 'veterinary diagnostic equipment exporter', 'vet supplies factory']
  },
  {
    id: 'cosmetics',
    name: 'Cosmetics',
    icon: '💄',
    parentIndustry: 'Consumer Goods & Personal Care',
    relatedKeywords: [
      'Cosmetics manufacturing',
      'Skincare products',
      'Beauty equipment',
      'Personal care products',
      'Haircare formulations',
      'Contract cosmetics manufacturer',
      'Makeup OEM/ODM',
      'Color cosmetics',
      'Organic and vegan cosmetics',
      'Cosmetic raw ingredients'
    ],
    alternativeNames: [
      'Beauty products',
      'Toiletries',
      'Cosmeceuticals',
      'Aesthetics equipment',
      'Dermatological skincare'
    ],
    productKeywords: [
      'Anti-aging face serums',
      'Moisturizing face creams',
      'Lipsticks and lip glosses',
      'Liquid foundations',
      'Botanical shampoos & conditioners',
      'Sunscreen lotions (SPF)',
      'Laser hair removal devices',
      'Facial steamers and microdermabrasion',
      'Essential oils',
      'Cosmetic packaging jars and bottles'
    ],
    classificationTokens: [
      'cosmetics', 'cosmetic', 'skincare', 'beauty equipment', 'personal care', 'makeup',
      'haircare', 'cosmetics manufacturing', 'cosmeceutical', 'beauty products', 'toiletries'
    ],
    sampleQueryTerms: ['cosmetics manufacturing factory', 'skincare products supplier', 'beauty equipment exporter', 'OEM cosmetics manufacturer']
  },
  {
    id: 'textiles',
    name: 'Textiles',
    icon: '🧵',
    parentIndustry: 'Manufacturing & Materials',
    relatedKeywords: [
      'Fabrics',
      'Yarn',
      'Technical textiles',
      'Textile machinery',
      'Garment accessories',
      'Knitted fabrics',
      'Woven textiles',
      'Non-woven fabrics',
      'Spun yarn manufacturers',
      'Textile dyeing and finishing'
    ],
    alternativeNames: [
      'Textile materials',
      'Fabric mills',
      'Industrial fabrics',
      'Spinning and weaving',
      'Apparel textiles'
    ],
    productKeywords: [
      '100% Cotton combed yarn',
      'Polyester filament yarn',
      'Spunbond non-woven fabric',
      'Circular knitting machines',
      'Shuttleless looms',
      'Buttons, zippers, and trims',
      'Fire-retardant technical textiles',
      'Denim fabric rolls',
      'Organic linen and silk',
      'Home textile bed linens'
    ],
    classificationTokens: [
      'textile', 'textiles', 'fabrics', 'fabric', 'yarn', 'technical textiles', 'textile machinery',
      'garment accessories', 'weaving', 'spinning mill', 'knitted fabric'
    ],
    sampleQueryTerms: ['textile machinery manufacturers', 'fabrics supplier wholesale', 'technical textiles exporter', 'yarn spinning factory']
  },
  {
    id: 'footwear',
    name: 'Footwear',
    icon: '👟',
    parentIndustry: 'Consumer Goods & Manufacturing',
    relatedKeywords: [
      'Shoes',
      'Footwear components',
      'Shoe manufacturing machinery',
      'Leather products',
      'Outsoles and insoles',
      'Shoe lasts and molds',
      'Safety shoes and boots',
      'Athletic footwear OEM',
      'Shoe upper materials',
      'Tannery and leather finishing'
    ],
    alternativeNames: [
      'Footwear industry',
      'Shoe manufacturing',
      'Leather goods',
      'Footwear materials',
      'Safety footwear'
    ],
    productKeywords: [
      'Rubber outsoles',
      'EVA midsoles',
      'PU leather shoe uppers',
      'Steel toe safety work boots',
      'Sneakers and running shoes',
      'Leather dress shoes',
      'Shoe stitching machines',
      'Sole pressing machines',
      'Orthopedic shoe insoles',
      'Leather bags and belts'
    ],
    classificationTokens: [
      'footwear', 'shoes', 'shoe', 'shoe manufacturing', 'leather products', 'outsole',
      'insoles', 'safety boots', 'footwear components', 'shoe machinery'
    ],
    sampleQueryTerms: ['shoe manufacturing machinery factory', 'footwear components supplier', 'safety shoes exporter', 'leather products manufacturer']
  },
  {
    id: 'furniture',
    name: 'Furniture',
    icon: '🪑',
    parentIndustry: 'Consumer Goods & Commercial',
    relatedKeywords: [
      'Office furniture',
      'Hotel furniture',
      'Industrial furniture',
      'Furniture components',
      'Ergonomic chairs',
      'Modular workstations',
      'Hospitality contract furniture',
      'Solid wood furniture',
      'Metal furniture frames',
      'Furniture hardware & fittings'
    ],
    alternativeNames: [
      'Furnishings',
      'Contract furniture',
      'Commercial cabinetry',
      'Office seating',
      'Architectural millwork'
    ],
    productKeywords: [
      'Height-adjustable standing desks',
      'Mesh ergonomic office chairs',
      'Conference room tables',
      'Hotel bedroom suites',
      'Industrial metal workbenches',
      'Drawer slides and hinges',
      'Acoustic office pods',
      'Outdoor patio furniture',
      'Restaurant dining chairs & tables',
      'Storage cabinets and lockers'
    ],
    classificationTokens: [
      'furniture', 'office furniture', 'hotel furniture', 'industrial furniture', 'furniture components',
      'ergonomic chair', 'workstation', 'modular furniture', 'commercial furniture', 'cabinetry', 'furnishing'
    ],
    sampleQueryTerms: ['office furniture manufacturer', 'hotel furniture supplier', 'furniture components exporter', 'ergonomic chairs factory']
  },
  {
    id: 'paper-products',
    name: 'Paper Products',
    icon: '📦',
    parentIndustry: 'Manufacturing & Packaging',
    relatedKeywords: [
      'Paper rolls',
      'Packaging paper',
      'Tissue products',
      'Paperboard',
      'Paper machinery',
      'Kraft paper',
      'Corrugated carton rolls',
      'Thermal receipt paper',
      'Pulp and paper manufacturing',
      'Specialty coated papers'
    ],
    alternativeNames: [
      'Pulp & paper',
      'Paper converting',
      'Paper goods',
      'Cardboard materials',
      'Hygienic tissue paper'
    ],
    productKeywords: [
      'Brown kraft paper rolls',
      'Fluting medium paper',
      'Duplex board with grey back',
      'Jumbo parent tissue rolls',
      'Facial tissue and toilet paper',
      'Paper slitting and rewinding machines',
      'Paper cup forming machines',
      'Biodegradable paper straws',
      'Coated art paper sheets',
      'Honeycombed paperboard'
    ],
    classificationTokens: [
      'paper product', 'paper products', 'paper roll', 'packaging paper', 'tissue product',
      'paperboard', 'paper machinery', 'kraft paper', 'corrugated paper', 'pulp and paper', 'paper'
    ],
    sampleQueryTerms: ['paper rolls manufacturer', 'packaging paper supplier', 'tissue products factory', 'paper machinery exporter']
  },
  {
    id: 'consumer-electronics',
    name: 'Consumer Electronics',
    icon: '📱',
    parentIndustry: 'Technology & Hardware',
    relatedKeywords: [
      'Home appliances',
      'Electronic devices',
      'Consumer electronics components',
      'Smart home devices',
      'Audio equipment',
      'Mobile phone accessories',
      'PCB assembly and PCBA',
      'Power adapters and chargers',
      'Small kitchen appliances',
      'Wearable electronics'
    ],
    alternativeNames: [
      'Appliances & electronics',
      'Gadgets',
      'Consumer tech',
      'Home tech',
      'Electronic consumer goods'
    ],
    productKeywords: [
      'Wireless Bluetooth earbuds',
      'Smart LED television sets',
      'Robot vacuum cleaners',
      'Air fryers and induction cookers',
      'Fast GaN wall chargers',
      'Smart home sensors and plugs',
      'Portable power banks',
      'Printed circuit boards (PCBA)',
      'Smart fitness watches',
      'Electric kettles and blenders'
    ],
    classificationTokens: [
      'consumer electronics', 'electronic device', 'electronic devices', 'home appliances', 'electronics components',
      'smart home', 'audio equipment', 'pcba', 'power adapter', 'home electronics', 'electronics'
    ],
    sampleQueryTerms: ['consumer electronics manufacturer', 'home appliances supplier', 'electronic devices exporter', 'smart home devices factory']
  },
  {
    id: 'security',
    name: 'Security & Safety',
    icon: '🛡️',
    parentIndustry: 'Technology & Defense',
    relatedKeywords: [
      'Surveillance systems',
      'Access control',
      'Industrial safety',
      'Fire protection',
      'CCTV cameras and NVRs',
      'Personal protective equipment (PPE)',
      'Intrusion alarm systems',
      'Biometric access readers',
      'Fire suppression systems',
      'Perimeter security fencing'
    ],
    alternativeNames: [
      'Security systems',
      'Life safety',
      'Occupational safety',
      'Surveillance & alarms',
      'Fire and safety'
    ],
    productKeywords: [
      'IP CCTV surveillance cameras',
      'Facial recognition access terminals',
      'Automatic fire sprinkler nozzles',
      'Fire extinguisher cylinders',
      'Safety helmets and harnesses',
      'High-visibility safety vests',
      'Metal detector security gates',
      'Smart electronic door locks',
      'Smoke and gas detectors',
      'Explosion-proof safety enclosures'
    ],
    classificationTokens: [
      'security system', 'surveillance', 'access control', 'industrial safety', 'fire protection',
      'cctv', 'alarm systems', 'fire suppression', 'biometric access', 'ppe safety', 'security'
    ],
    sampleQueryTerms: ['surveillance systems manufacturer', 'access control supplier', 'industrial safety equipment exporter', 'fire protection factory']
  },
  {
    id: 'cleaning-hygiene',
    name: 'Cleaning and Hygiene',
    icon: '🧼',
    parentIndustry: 'Chemicals & Sanitation',
    relatedKeywords: [
      'Industrial cleaning machines',
      'Detergents',
      'Hygiene products',
      'Sanitation equipment',
      'Floor scrubbers and sweepers',
      'Commercial disinfectants',
      'Janitorial cleaning supplies',
      'Hand sanitizers and soaps',
      'High pressure washers',
      'Cleanroom cleaning tools'
    ],
    alternativeNames: [
      'Sanitation and hygiene',
      'Cleaning supplies',
      'Janitorial equipment',
      'Industrial sanitation',
      'Chemical cleaning products'
    ],
    productKeywords: [
      'Ride-on floor scrubbers',
      'Commercial vacuum cleaners',
      'Industrial degreasers',
      'Chlorine disinfectant concentrates',
      'Touchless soap dispensers',
      'Microfiber cleaning mops and cloths',
      'Steam cleaning machines',
      'Waste bins and janitorial carts',
      'Air purifiers and ozone generators',
      'Surface sanitizing wipes'
    ],
    classificationTokens: [
      'cleaning machine', 'cleaning machines', 'detergent', 'detergents', 'hygiene products',
      'sanitation equipment', 'floor scrubber', 'disinfectant', 'janitorial', 'industrial cleaning', 'cleaning', 'hygiene', 'sanitation'
    ],
    sampleQueryTerms: ['industrial cleaning machines manufacturer', 'detergents supplier wholesale', 'hygiene products exporter', 'sanitation equipment factory']
  },
  {
    id: 'water-systems',
    name: 'Water Systems',
    icon: '💧',
    parentIndustry: 'Environmental & Engineering',
    relatedKeywords: [
      'Water pumps',
      'Filtration',
      'Treatment plants',
      'Pipes',
      'Water meters',
      'Reverse osmosis (RO) systems',
      'Industrial valves and fittings',
      'Wastewater treatment equipment',
      'Water desalination units',
      'Water purification membranes'
    ],
    alternativeNames: [
      'Water treatment',
      'Water engineering',
      'Hydraulic systems',
      'Pumping systems',
      'Wastewater management'
    ],
    productKeywords: [
      'Submersible water pumps',
      'Centrifugal booster pumps',
      'Commercial reverse osmosis units',
      'HDPE and PVC water pipes',
      'Ultrasonic smart water meters',
      'Ductile iron gate and ball valves',
      'UV water sterilizers',
      'Sand and carbon media filters',
      'Sewage treatment aeration diffusers',
      'Filter cartridge housings'
    ],
    classificationTokens: [
      'water systems', 'water pump', 'water pumps', 'water filtration', 'treatment plants',
      'water pipes', 'water meters', 'reverse osmosis', 'wastewater treatment', 'water purification', 'water treatment'
    ],
    sampleQueryTerms: ['water pumps manufacturer', 'water filtration systems supplier', 'water treatment plants exporter', 'pipes and valves factory']
  },
  {
    id: 'marine-supplies',
    name: 'Marine Supplies',
    icon: '⚓',
    parentIndustry: 'Maritime & Logistics',
    relatedKeywords: [
      'Ship equipment',
      'Marine electronics',
      'Engines',
      'Deck machinery',
      'Navigation',
      'Marine safety equipment',
      'Boat accessories',
      'Ship chandlery',
      'Mooring and anchor equipment',
      'Offshore marine supplies'
    ],
    alternativeNames: [
      'Maritime equipment',
      'Ship supplies',
      'Naval architecture components',
      'Marine hardware',
      'Boat parts and rigging'
    ],
    productKeywords: [
      'Marine diesel inboard engines',
      'VHF marine radios and radar',
      'GPS chartplotters and sonar',
      'Anchor windlasses and capstans',
      'Inflatable life rafts and lifejackets',
      'Marine mooring ropes and chains',
      'Stainless steel boat cleats and shackles',
      'Marine bilge pumps and impellers',
      'Shipboard fire suppression systems',
      'Marine propellers and shafts'
    ],
    classificationTokens: [
      'marine supply', 'marine supplies', 'ship equipment', 'marine electronics', 'marine engine',
      'deck machinery', 'marine navigation', 'ship chandler', 'boat accessories', 'maritime equipment',
      'marine', 'maritime', 'ship', 'boat'
    ],
    sampleQueryTerms: ['ship equipment manufacturer', 'marine electronics supplier', 'deck machinery exporter', 'marine supplies factory']
  },
  {
    id: 'packaging-materials',
    name: 'Packaging Materials',
    icon: '🏷️',
    parentIndustry: 'Packaging & Manufacturing',
    relatedKeywords: [
      'Cartons',
      'Plastic packaging',
      'Glass bottles',
      'Flexible packaging',
      'Labels',
      'Corrugated shipping boxes',
      'Pouches and stand-up bags',
      'Bottle caps and closures',
      'Stretch film and shrink wrap',
      'Biodegradable packaging'
    ],
    alternativeNames: [
      'Packaging solutions',
      'Industrial packaging',
      'Containers and closures',
      'Protective packaging',
      'Packaging converters'
    ],
    productKeywords: [
      'Custom printed corrugated boxes',
      'PET plastic cosmetic bottles',
      'Amber pharmaceutical glass bottles',
      'Aluminum foil laminated pouches',
      'Self-adhesive barcode labels',
      'Pallet stretch wrap film',
      'Aerosol spray cans and valves',
      'Tinplate food cans',
      'Biodegradable PLA packaging',
      'Tamper-evident shrink bands'
    ],
    classificationTokens: [
      'packaging material', 'packaging materials', 'cartons', 'plastic packaging', 'glass bottles',
      'flexible packaging', 'packaging labels', 'corrugated boxes', 'pouches', 'packaging supplier', 'packaging'
    ],
    sampleQueryTerms: ['packaging materials manufacturer', 'corrugated cartons supplier', 'glass bottles factory', 'flexible packaging exporter']
  },
  {
    id: 'sporting-goods',
    name: 'Sporting Goods',
    icon: '⚽',
    parentIndustry: 'Consumer Goods & Recreation',
    relatedKeywords: [
      'Sports equipment',
      'Fitness machines',
      'Gym equipment',
      'Outdoor products',
      'Athletic gear',
      'Exercise accessories',
      'Sportswear and activewear',
      'Camping and hiking gear',
      'Ball sports equipment',
      'Water sports gear'
    ],
    alternativeNames: [
      'Athletic equipment',
      'Fitness gear',
      'Recreation products',
      'Gym & sports supplies',
      'Sports goods'
    ],
    productKeywords: [
      'Commercial cardio treadmills',
      'Adjustable dumbbells and barbells',
      'Multi-gym strength stations',
      'FIFA-standard soccer balls',
      'Yoga mats and resistance bands',
      'Inflatable stand-up paddleboards (SUP)',
      'Waterproof camping tents',
      'Carbon fiber tennis rackets',
      'Cycling helmets and accessories',
      'Quick-dry performance sportswear'
    ],
    classificationTokens: [
      'sporting goods', 'sports equipment', 'fitness machines', 'gym equipment', 'outdoor products',
      'athletic gear', 'exercise machines', 'fitness equipment', 'sportswear manufacturer', 'fitness', 'sporting'
    ],
    sampleQueryTerms: ['sports equipment manufacturer', 'fitness machines supplier', 'gym equipment factory', 'outdoor products exporter']
  },
  {
    id: 'oil-and-gas',
    name: 'Oil and Gas',
    icon: '🛢️',
    parentIndustry: 'Energy & Natural Resources',
    relatedKeywords: [
      'Oil', 'Gas', 'Petro', 'Energy', 'Refinery', 'Drilling', 'Offshore', 'Petroleum', 'Pipeline', 'LNG'
    ],
    alternativeNames: [
      'Petroleum industry', 'Upstream oil and gas', 'Downstream petrochemicals', 'Hydrocarbon processing', 'Offshore drilling'
    ],
    productKeywords: [
      'Drilling rigs', 'Petroleum valves', 'Refinery distillation columns', 'Offshore platform components', 'Crude oil pumps', 'Gas turbines', 'Subsea pipelines'
    ],
    classificationTokens: [
      'oil', 'gas', 'petro', 'energy', 'refinery', 'drilling', 'offshore', 'petroleum', 'pipeline', 'lng', 'crude', 'hydrocarbon', 'rig'
    ],
    sampleQueryTerms: ['oil and gas equipment manufacturers', 'drilling tools supplier', 'petroleum valves exporter', 'refinery equipment factory']
  },
  {
    id: 'logistics',
    name: 'Logistics',
    icon: '🚚',
    parentIndustry: 'Transportation & Logistics',
    relatedKeywords: [
      'Logistics', 'Freight', 'Cargo', 'Shipping', 'Transport', 'Supply', 'Warehouse', 'Courier', 'Supply chain'
    ],
    alternativeNames: [
      'Freight forwarding', 'Supply chain management', 'Intermodal transport', 'Warehousing and fulfillment', 'Cargo management'
    ],
    productKeywords: [
      'Pallet racks', 'Conveyor systems', 'Forklifts', 'Shipping containers', 'RFID tracking tags', 'GPS fleet trackers', 'Barcode scanners'
    ],
    classificationTokens: [
      'logistics', 'freight', 'cargo', 'shipping', 'transport', 'supply', 'warehouse', 'courier', '3pl', 'intermodal', 'freightforwarding'
    ],
    sampleQueryTerms: ['freight forwarding company', 'logistics services supplier', 'warehouse equipment manufacturer', 'cargo transport provider']
  },
  {
    id: 'finance',
    name: 'Finance',
    icon: '🏦',
    parentIndustry: 'Banking & Financial Services',
    relatedKeywords: [
      'Bank', 'Finance', 'Loan', 'Credit', 'Capital', 'Investment', 'Insurance', 'Wealth', 'Fintech'
    ],
    alternativeNames: [
      'Financial services', 'Corporate banking', 'Asset management', 'Private equity', 'Risk underwriting'
    ],
    productKeywords: [
      'Payment gateways', 'POS card terminals', 'Banking software', 'Financial advisory', 'Commercial credit lines', 'Risk management software'
    ],
    classificationTokens: [
      'bank', 'finance', 'loan', 'credit', 'capital', 'investment', 'insurance', 'wealth', 'fintech', 'lending', 'underwriting', 'asset management'
    ],
    sampleQueryTerms: ['fintech payment solutions provider', 'commercial banking services', 'investment fund', 'insurance underwriter']
  },
  {
    id: 'technology',
    name: 'Technology',
    icon: '💻',
    parentIndustry: 'Information Technology',
    relatedKeywords: [
      'Tech', 'Software', 'Cloud', 'AI', 'IT', 'Hardware', 'Cyber', 'Data', 'SaaS'
    ],
    alternativeNames: [
      'Information technology', 'Enterprise software', 'Artificial intelligence', 'Cloud computing', 'Cybersecurity'
    ],
    productKeywords: [
      'Cloud server hosting', 'AI machine learning models', 'Cybersecurity firewalls', 'Enterprise ERP software', 'Network switches', 'SaaS applications'
    ],
    classificationTokens: [
      'tech', 'software', 'cloud', 'ai', 'it', 'hardware', 'cyber', 'data', 'saas', 'cybersecurity', 'developer', 'platform'
    ],
    sampleQueryTerms: ['enterprise software development company', 'cloud infrastructure provider', 'cybersecurity software supplier', 'AI data analytics vendor']
  },
  {
    id: 'education',
    name: 'Education',
    icon: '🎓',
    parentIndustry: 'Education & Training',
    relatedKeywords: [
      'Edu', 'School', 'University', 'College', 'Academy', 'Training', 'Learning', 'Curriculum', 'E-learning'
    ],
    alternativeNames: [
      'Educational institutions', 'Academic learning', 'Vocational training', 'Corporate education', 'EdTech'
    ],
    productKeywords: [
      'Learning management systems (LMS)', 'Classroom smartboards', 'School laboratory furniture', 'Educational books and kits', 'Online courses'
    ],
    classificationTokens: [
      'edu', 'school', 'university', 'college', 'academy', 'training', 'learning', 'curriculum', 'campus', 'elearning', 'edtech'
    ],
    sampleQueryTerms: ['educational equipment manufacturer', 'e-learning platform provider', 'school laboratory supplies exporter', 'training academy']
  },
  {
    id: 'manufacturing-industrial',
    name: 'Manufacturing',
    icon: '🏭',
    parentIndustry: 'Manufacturing & Engineering',
    relatedKeywords: [
      'Manufacture', 'Factory', 'Industrial', 'Production', 'Assembly', 'Machining', 'Fabrication', 'Precision', 'OEM'
    ],
    alternativeNames: [
      'Industrial production', 'Contract manufacturing', 'Precision engineering', 'Tooling and fabrication', 'Assembly plants'
    ],
    productKeywords: [
      'CNC machining centers', 'Metal stamping presses', 'Hydraulic cylinders', 'Assembly automation lines', 'Die casting molds', 'Industrial robots'
    ],
    classificationTokens: [
      'manufacture', 'manufacturing', 'factory', 'industrial', 'production', 'assembly', 'machining', 'stamping', 'casting', 'precision', 'oem'
    ],
    sampleQueryTerms: ['manufacturing plant OEM', 'industrial equipment manufacturer', 'precision machining supplier', 'assembly factory exporter']
  },
  {
    id: 'retail',
    name: 'Retail',
    icon: '🛍️',
    parentIndustry: 'Consumer Commerce',
    relatedKeywords: [
      'Retail', 'Shop', 'Store', 'Ecommerce', 'Merchandise', 'Mall', 'Fashion', 'Apparel', 'Boutique'
    ],
    alternativeNames: [
      'Digital commerce', 'Direct-to-consumer (D2C)', 'Omnichannel retail', 'Storefront merchandising', 'Fashion retail'
    ],
    productKeywords: [
      'Store display racks', 'Retail POS checkout counters', 'Garment hangers', 'Price tag printers', 'Shopping carts and baskets'
    ],
    classificationTokens: [
      'retail', 'shop', 'store', 'ecommerce', 'merchandise', 'mall', 'fashion', 'boutique', 'apparel', 'd2c', 'storefront'
    ],
    sampleQueryTerms: ['retail display fixtures manufacturer', 'e-commerce wholesale supplier', 'apparel fashion distributor', 'merchandise supplier']
  },
  {
    id: 'construction',
    name: 'Construction',
    icon: '🏗️',
    parentIndustry: 'Building & Infrastructure',
    relatedKeywords: [
      'Construct', 'Building', 'Architecture', 'Civil', 'Contractor', 'Engineering', 'Roofing', 'Concrete', 'Scaffolding'
    ],
    alternativeNames: [
      'Civil engineering', 'General contracting', 'Commercial building', 'Structural engineering', 'Infrastructure development'
    ],
    productKeywords: [
      'Ready-mix concrete', 'Steel rebar and beams', 'Scaffolding towers', 'Hydraulic excavators', 'Roofing tiles and shingles', 'HVAC ducting'
    ],
    classificationTokens: [
      'construct', 'construction', 'building', 'architecture', 'civil', 'contractor', 'engineering', 'roofing', 'concrete', 'scaffolding'
    ],
    sampleQueryTerms: ['construction materials manufacturer', 'civil engineering contractor', 'structural steel supplier', 'building supplies exporter']
  },
  {
    id: 'automotive',
    name: 'Automotive',
    icon: '🚗',
    parentIndustry: 'Automotive & Transportation',
    relatedKeywords: [
      'Auto', 'Car', 'Vehicle', 'Motor', 'Garage', 'Dealer', 'Repair', 'Powertrain', 'Chassis', 'Tires', 'EV'
    ],
    alternativeNames: [
      'Motor vehicles', 'Automotive aftermarket', 'Automobile OEM', 'Electric vehicles (EV)', 'Fleet mobility'
    ],
    productKeywords: [
      'Brake pads and rotors', 'Automotive alternators', 'Lithium EV battery packs', 'Tires and alloy rims', 'Diagnostic scan tools', 'Shock absorbers'
    ],
    classificationTokens: [
      'auto', 'automotive', 'car', 'vehicle', 'motor', 'garage', 'dealer', 'repair', 'powertrain', 'chassis', 'autoparts', 'tires'
    ],
    sampleQueryTerms: ['autoparts manufacturer OEM', 'car parts wholesale supplier', 'automotive aftermarket exporter', 'electric vehicle components factory']
  },
  {
    id: 'food-and-beverage',
    name: 'Food and Beverage',
    icon: '🍽️',
    parentIndustry: 'Food & Agribusiness',
    relatedKeywords: [
      'Food', 'Beverage', 'Drink', 'Cafe', 'Restaurant', 'Brewery', 'Dining', 'Bakery', 'Dairy', 'Confectionery'
    ],
    alternativeNames: [
      'Food processing', 'Packaged food and drink', 'Commercial food service', 'Beverage production', 'Culinary ingredients'
    ],
    productKeywords: [
      'Commercial baking ovens', 'Food pasteurizers', 'Dairy processing tanks', 'Beer brewing equipment', 'Spices and seasonings', 'Snack food packaging'
    ],
    classificationTokens: [
      'food', 'beverage', 'drink', 'cafe', 'restaurant', 'brewery', 'dining', 'bakery', 'confectionery', 'dairy', 'culinary', 'distillery'
    ],
    sampleQueryTerms: ['food processing equipment manufacturer', 'beverage production machinery supplier', 'bulk food ingredients exporter', 'bakery equipment factory']
  },
  {
    id: 'telecommunications',
    name: 'Telecommunications',
    icon: '📡',
    parentIndustry: 'Communications & Networks',
    relatedKeywords: [
      'Telecom', 'Network', 'Mobile', 'Wireless', 'Satellite', 'Broadband', 'Cellular', '5G', 'Fiber', 'VoIP'
    ],
    alternativeNames: [
      'Telecom network operators', 'Wireless infrastructure', 'Satellite communications', 'Optical fiber networks', 'Mobile broadband'
    ],
    productKeywords: [
      'Fiber optic cables', '5G base station antennas', 'Network routers and switches', 'Satellite ground transceivers', 'Telecom server racks'
    ],
    classificationTokens: [
      'telecom', 'network', 'mobile', 'wireless', 'satellite', 'broadband', 'cellular', 'fiber', '5g', 'voip', 'telephony'
    ],
    sampleQueryTerms: ['telecommunications equipment manufacturer', 'fiber optic cable supplier', '5G wireless network exporter', 'broadband equipment distributor']
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: '🎬',
    parentIndustry: 'Media & Entertainment',
    relatedKeywords: [
      'Entertainment', 'Media', 'Film', 'TV', 'Music', 'Gaming', 'Production', 'Broadcasting', 'Streaming', 'Cinema'
    ],
    alternativeNames: [
      'Film and video production', 'Broadcast media', 'Digital gaming', 'Music recording', 'Creative studio production'
    ],
    productKeywords: [
      'Studio cinema cameras', 'Stage lighting trusses', 'Audio mixing consoles', 'Broadcast transmitters', 'LED video wall panels'
    ],
    classificationTokens: [
      'entertainment', 'media', 'film', 'tv', 'music', 'gaming', 'production', 'broadcasting', 'cinema', 'streaming', 'animation'
    ],
    sampleQueryTerms: ['studio broadcast equipment manufacturer', 'stage lighting supplier', 'film production equipment exporter', 'audio gear distributor']
  },
  {
    id: 'travel-and-hospitality',
    name: 'Travel and Hospitality',
    icon: '🏨',
    parentIndustry: 'Travel & Tourism',
    relatedKeywords: [
      'Travel', 'Hotel', 'Tour', 'Vacation', 'Cruise', 'Resort', 'Hospitality', 'Tourism', 'Airlines', 'Booking'
    ],
    alternativeNames: [
      'Hotel management', 'Resort lodging', 'Luxury tourism', 'Cruise line operations', 'Hospitality supply'
    ],
    productKeywords: [
      'Commercial hotel linens', 'Keycard door lock systems', 'Resort patio furniture', 'Hotel banquet tables', 'Guestroom amenities'
    ],
    classificationTokens: [
      'travel', 'hotel', 'tour', 'vacation', 'cruise', 'resort', 'hospitality', 'tourism', 'airline', 'booking', 'lodging'
    ],
    sampleQueryTerms: ['hotel supplies manufacturer', 'hospitality equipment supplier', 'resort furniture exporter', 'tour operator services']
  },
  {
    id: 'legal',
    name: 'Legal',
    icon: '⚖️',
    parentIndustry: 'Professional Services',
    relatedKeywords: [
      'Law', 'Legal', 'Attorney', 'Firm', 'Justice', 'Court', 'Compliance', 'Lawyer', 'Litigation', 'Counsel'
    ],
    alternativeNames: [
      'Legal advisory', 'Corporate law firms', 'Regulatory compliance', 'Intellectual property law', 'Litigation practice'
    ],
    productKeywords: [
      'Legal document management software', 'Contract automation tools', 'Court reporting equipment', 'Compliance audit platforms'
    ],
    classificationTokens: [
      'law', 'legal', 'attorney', 'firm', 'justice', 'court', 'compliance', 'lawyer', 'litigation', 'counsel', 'patent law'
    ],
    sampleQueryTerms: ['legal compliance software provider', 'corporate law services', 'intellectual property attorney firm', 'legal management tools']
  },
  {
    id: 'real-estate',
    name: 'Real Estate',
    icon: '🏢',
    parentIndustry: 'Property & Real Estate',
    relatedKeywords: [
      'Realestate', 'Property', 'Realtor', 'Broker', 'Land', 'Housing', 'Construction', 'Realty', 'Leasing'
    ],
    alternativeNames: [
      'Commercial real estate', 'Property development', 'Residential housing', 'Land acquisition', 'Estate brokerage'
    ],
    productKeywords: [
      'Property management software', 'Architectural 3D renderings', 'Smart building access controllers', 'Real estate signage'
    ],
    classificationTokens: [
      'realestate', 'real estate', 'property', 'realtor', 'broker', 'land', 'housing', 'realty', 'leasing', 'condominium'
    ],
    sampleQueryTerms: ['commercial real estate broker', 'property development company', 'real estate investment trust', 'property management software vendor']
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    icon: '🌾',
    parentIndustry: 'Agriculture & Farming',
    relatedKeywords: [
      'Agriculture', 'Farm', 'Crop', 'Harvest', 'Livestock', 'Dairy', 'Agribusiness', 'Seeds', 'Fertilizer', 'Poultry'
    ],
    alternativeNames: [
      'Farming and crops', 'Agricultural technology (AgTech)', 'Animal husbandry', 'Irrigation engineering', 'Grain production'
    ],
    productKeywords: [
      'Agricultural tractors and combines', 'Drip irrigation drip lines', 'Organic bio-fertilizers', 'Grain storage silos', 'Livestock milking machines'
    ],
    classificationTokens: [
      'agriculture', 'agri', 'farm', 'crop', 'harvest', 'livestock', 'dairy', 'agribusiness', 'seeds', 'fertilizer', 'poultry'
    ],
    sampleQueryTerms: ['agricultural machinery manufacturer', 'irrigation systems supplier', 'organic fertilizer exporter', 'farm equipment factory']
  },
  {
    id: 'energy',
    name: 'Energy',
    icon: '⚡',
    parentIndustry: 'Power & Utilities',
    relatedKeywords: [
      'Energy', 'Solar', 'Wind', 'Renewable', 'Power', 'Electric', 'Grid', 'Photovoltaic', 'Battery', 'Clean Energy'
    ],
    alternativeNames: [
      'Electric power generation', 'Renewable energy systems', 'Solar photovoltaic', 'Wind energy turbines', 'Electrical grid infrastructure'
    ],
    productKeywords: [
      'Solar PV monocrystalline panels', 'Grid-tie inverters', 'Wind turbine generators', 'High voltage power transformers', 'Industrial lithium batteries'
    ],
    classificationTokens: [
      'energy', 'solar', 'wind', 'renewable', 'power', 'electric', 'grid', 'photovoltaic', 'battery', 'inverter', 'clean energy'
    ],
    sampleQueryTerms: ['solar panels manufacturer OEM', 'wind turbine supplier', 'power transformers exporter', 'renewable energy systems factory']
  },
  {
    id: 'government',
    name: 'Government',
    icon: '🏛️',
    parentIndustry: 'Public Administration',
    relatedKeywords: [
      'Gov', 'Policy', 'Public', 'Administration', 'Council', 'Municipal', 'State', 'Federal', 'Civic'
    ],
    alternativeNames: [
      'Public administration', 'Municipal services', 'Government agencies', 'Civic public policy', 'State and federal contracting'
    ],
    productKeywords: [
      'Municipal voting hardware', 'Public safety dispatch systems', 'Gov ERP databases', 'Civic identity biometric readers'
    ],
    classificationTokens: [
      'gov', 'policy', 'public', 'administration', 'council', 'municipal', 'state', 'federal', 'civic', 'ministry', 'municipality'
    ],
    sampleQueryTerms: ['government procurement supplier', 'municipal equipment contractor', 'public administration software provider', 'civic infrastructure vendor']
  },
  {
    id: 'non-profit',
    name: 'Non-Profit',
    icon: '🤝',
    parentIndustry: 'NGO & Philanthropy',
    relatedKeywords: [
      'Nonprofit', 'NGO', 'Charity', 'Foundation', 'Aid', 'Mission', 'Volunteer', 'Humanitarian', 'Philanthropy'
    ],
    alternativeNames: [
      'Non-governmental organizations', 'Charitable foundations', 'Humanitarian aid', 'Philanthropic trusts', 'Voluntary aid missions'
    ],
    productKeywords: [
      'Disaster relief emergency tents', 'Water purification disaster tablets', 'Charity donation software', 'Humanitarian aid kits'
    ],
    classificationTokens: [
      'nonprofit', 'ngo', 'charity', 'foundation', 'aid', 'mission', 'volunteer', 'humanitarian', 'philanthropy', 'fundraising'
    ],
    sampleQueryTerms: ['humanitarian aid supplies manufacturer', 'disaster relief shelter supplier', 'NGO foundation partner', 'nonprofit supplies exporter']
  },
  {
    id: 'aerospace',
    name: 'Aerospace',
    icon: '🚀',
    parentIndustry: 'Aerospace & Defense',
    relatedKeywords: [
      'Aero', 'Space', 'Aircraft', 'Aviation', 'Defense', 'Satellite', 'Flight', 'Avionics', 'Aerospace'
    ],
    alternativeNames: [
      'Aviation manufacturing', 'Commercial aerospace', 'Military defense contracting', 'Satellite space tech', 'Unmanned aerial systems (UAS)'
    ],
    productKeywords: [
      'Aircraft jet engine turbine blades', 'Cockpit avionics displays', 'Carbon composite fuselage parts', 'Satellite transponders', 'Flight simulators'
    ],
    classificationTokens: [
      'aero', 'space', 'aircraft', 'aviation', 'defense', 'satellite', 'flight', 'aerospace', 'airliner', 'avionics', 'uav'
    ],
    sampleQueryTerms: ['aerospace components manufacturer', 'aircraft avionics supplier', 'aviation parts exporter', 'satellite defense contractor']
  },
  {
    id: 'sports',
    name: 'Sports',
    icon: '🏆',
    parentIndustry: 'Sports & Athletics',
    relatedKeywords: [
      'Sports', 'Fitness', 'Gym', 'Athletics', 'Team', 'League', 'Stadium', 'Workout', 'Trainer', 'Sportswear'
    ],
    alternativeNames: [
      'Athletic recreation', 'Fitness training', 'Professional team athletics', 'Stadium venue operations', 'Sports conditioning'
    ],
    productKeywords: [
      'Gym weightlifting plates', 'Commercial indoor treadmills', 'Turf soccer pitches', 'Performance athletic jerseys', 'Sports timing systems'
    ],
    classificationTokens: [
      'sports', 'fitness', 'gym', 'athletics', 'team', 'league', 'stadium', 'workout', 'trainer', 'sportswear', 'activewear'
    ],
    sampleQueryTerms: ['sports equipment manufacturer', 'gym fitness machines supplier', 'athletic sportswear exporter', 'stadium equipment factory']
  },
  {
    id: 'beauty-and-cosmetics',
    name: 'Beauty and Cosmetics',
    icon: '💄',
    parentIndustry: 'Beauty & Personal Care',
    relatedKeywords: [
      'Beauty', 'Cosmetic', 'Makeup', 'Spa', 'Salon', 'Skincare', 'Wellness', 'Personal care', 'Aesthetics'
    ],
    alternativeNames: [
      'Cosmetics formulation', 'Skincare aesthetics', 'Professional salon equipment', 'Medical spa supplies', 'Personal care goods'
    ],
    productKeywords: [
      'Hydrating hyaluronic face serum', 'Salon hair steamers', 'Spa facial beds', 'Organic mineral makeup', 'Essential oil diffusers'
    ],
    classificationTokens: [
      'beauty', 'cosmetic', 'cosmetics', 'makeup', 'spa', 'salon', 'skincare', 'wellness', 'aesthetics', 'personal care', 'toiletries'
    ],
    sampleQueryTerms: ['beauty skincare products manufacturer', 'spa equipment supplier', 'cosmetics OEM factory', 'salon equipment exporter']
  },
  {
    id: 'chemicals',
    name: 'Chemicals',
    icon: '🧪',
    parentIndustry: 'Chemicals & Materials',
    relatedKeywords: [
      'Chemical', 'Chemicals', 'Petrochemical', 'Polymer', 'Resins', 'Solvents', 'Coatings', 'Specialty Chemicals'
    ],
    alternativeNames: [
      'Industrial chemistry', 'Polymer synthesis', 'Specialty chemical formulations', 'Basic organic chemicals', 'Composite materials'
    ],
    productKeywords: [
      'Industrial solvents (IPA, Acetone)', 'Epoxy resin hardeners', 'Polyethylene polymer granules', 'Polyurethane coatings', 'Catalysts'
    ],
    classificationTokens: [
      'chemical', 'chemicals', 'petrochemical', 'polymer', 'polymers', 'resins', 'solvents', 'coating', 'coatings', 'biochemical'
    ],
    sampleQueryTerms: ['specialty chemicals manufacturer', 'industrial resins supplier', 'polymer compounds exporter', 'chemical raw materials factory']
  }
];

export const B2B_TRADE_ROLES = [
  { id: 'all', label: 'All B2B Roles', queryModifier: 'manufacturers OR suppliers OR exporters OR distributors' },
  { id: 'manufacturers', label: 'Manufacturers & OEM/ODM', queryModifier: 'manufacturer OR factory OR "OEM" OR "ODM"' },
  { id: 'exporters', label: 'Exporters & Trading', queryModifier: 'exporter OR "export company" OR "international trading"' },
  { id: 'suppliers', label: 'Wholesale Suppliers', queryModifier: 'supplier OR "wholesale supplier" OR "bulk supply"' },
  { id: 'distributors', label: 'Authorized Distributors', queryModifier: 'distributor OR "authorized distributor" OR stockist OR dealer' }
];

export const SOURCING_SEARCH_ENGINES = [
  { id: 'google', name: 'Google Search', icon: '🔍', urlPattern: 'https://www.google.com/search?q=' },
  { id: 'bing', name: 'Bing Search', icon: '🌐', urlPattern: 'https://www.bing.com/search?q=' },
  { id: 'yahoo', name: 'Yahoo Search', icon: '🟣', urlPattern: 'https://search.yahoo.com/search?p=' },
  { id: 'duckduckgo', name: 'DuckDuckGo', icon: '🦆', urlPattern: 'https://duckduckgo.com/?q=' },
  { id: 'thomasnet', name: 'ThomasNet (USA B2B)', icon: '🇺🇸', urlPattern: 'https://www.thomasnet.com/search.html?cov=NA&which=prod&what=' },
  { id: 'europages', name: 'Europages (EU B2B)', icon: '🇪🇺', urlPattern: 'https://www.europages.co.uk/search?q=' },
  { id: 'kompass', name: 'Kompass Global', icon: '🌍', urlPattern: 'https://www.kompass.com/searchCompanies?acKw=' },
  { id: 'alibaba', name: 'Alibaba Global', icon: '📦', urlPattern: 'https://www.alibaba.com/trade/search?SearchText=' }
];

/**
 * Builds a search query for international sourcing based on category, role, engine, country, and extra terms.
 */
export function buildSourcingSearchQuery(
  category: MasterCategoryDefinition,
  roleId: string = 'all',
  country?: string,
  extraKeywords?: string
): string {
  const role = B2B_TRADE_ROLES.find(r => r.id === roleId) || B2B_TRADE_ROLES[0];
  const primaryKw = category.relatedKeywords[0] || category.name;
  const secondaryKw = category.relatedKeywords[1] || '';

  const countryPart = country && country !== 'all' && country !== 'Global' ? `"${country}"` : '';
  const extraPart = extraKeywords?.trim() ? `"${extraKeywords.trim()}"` : '';

  // E.g.: "Medicines" "pharmaceutical products" (manufacturer OR factory OR "OEM") "Germany" "contact@"
  const parts = [
    `"${primaryKw}"`,
    secondaryKw ? `"${secondaryKw}"` : '',
    `(${role.queryModifier})`,
    countryPart,
    extraPart,
    '("contact" OR "email" OR "inquiry" OR "info@")'
  ].filter(Boolean);

  return parts.join(' ');
}

/**
 * Builds simple, natural keyword query suitable for directory search bars (ThomasNet, Europages, Kompass, Alibaba)
 */
export function buildSimpleSourcingKeywords(
  category: MasterCategoryDefinition,
  roleId: string = 'all',
  country?: string,
  extraKeywords?: string
): string {
  const roleLabelMap: Record<string, string> = {
    all: 'manufacturers suppliers',
    manufacturers: 'manufacturer factory OEM',
    exporters: 'exporter export trading',
    suppliers: 'wholesale supplier',
    distributors: 'distributor dealer'
  };
  const roleTerm = roleLabelMap[roleId] || 'manufacturer';
  const primaryKw = category.relatedKeywords[0] || category.name;
  const secondaryKw = category.relatedKeywords[1] || '';
  const countryPart = country && country !== 'all' && country !== 'Global' ? country : '';
  const extraPart = extraKeywords?.trim() || '';

  return [primaryKw, secondaryKw, roleTerm, countryPart, extraPart].filter(Boolean).join(' ');
}

/**
 * Generates the target search engine or directory URL for international B2B sourcing
 */
export function getSourcingEngineUrl(
  engineId: string,
  booleanQuery: string,
  simpleQuery: string
): string {
  const engine = SOURCING_SEARCH_ENGINES.find(e => e.id === engineId) || SOURCING_SEARCH_ENGINES[0];
  const queryToUse = ['thomasnet', 'europages', 'kompass', 'alibaba'].includes(engineId)
    ? simpleQuery
    : booleanQuery;
  return `${engine.urlPattern}${encodeURIComponent(queryToUse)}`;
}

const CUSTOM_CATEGORIES_STORAGE_KEY = 'custom_taxonomy_categories';

/**
 * Retrieve user-defined custom product/industry categories from localStorage
 */
export function getCustomCategories(): MasterCategoryDefinition[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persist a user-defined custom category to localStorage
 */
export function saveCustomCategory(cat: MasterCategoryDefinition): MasterCategoryDefinition[] {
  if (typeof window === 'undefined') return [];
  const existing = getCustomCategories();
  const filtered = existing.filter(c => c.id !== cat.id);
  const updated = [...filtered, cat];
  try {
    localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Could not save custom category:", err);
  }
  return updated;
}

/**
 * Delete a user-defined custom category by ID
 */
export function deleteCustomCategory(id: string): MasterCategoryDefinition[] {
  if (typeof window === 'undefined') return [];
  const existing = getCustomCategories();
  const updated = existing.filter(c => c.id !== id);
  try {
    localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Could not delete custom category:", err);
  }
  return updated;
}

/**
 * Returns all categories: built-in standard categories plus user-tailored custom categories
 */
export function getAllCategories(): MasterCategoryDefinition[] {
  const custom = getCustomCategories();
  return [...MASTER_PRODUCT_CATEGORIES, ...custom];
}

/**
 * Match text or domain against the master product taxonomy to identify candidate categories
 */
export function matchMasterCategory(text: string): { category: MasterCategoryDefinition; score: number; matchedToken: string } | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  const normalized = lower.replace(/[-_./]+/g, ' ');
  const tokens = normalized.split(/\s+/).filter(Boolean);

  let bestMatch: { category: MasterCategoryDefinition; score: number; matchedToken: string } | null = null;
  const allCategories = getAllCategories();

  // High priority exact short tokens
  const SHORT_EXACT_TOKENS = new Set([
    'ai', 'it', 'oil', 'gas', 'med', 'bio', 'law', 'spa', 'gym', 'ngo', 'edu', 'car', 'tv', 'rig', 'uav', '5g'
  ]);

  for (const cat of allCategories) {
    for (const token of cat.classificationTokens) {
      const cleanToken = token.toLowerCase().trim();
      const compactedToken = cleanToken.replace(/\s+/g, '');
      
      let matched = false;
      let scoreBonus = 0;

      // Direct word token match
      if (tokens.includes(cleanToken)) {
        matched = true;
        scoreBonus = cleanToken.length >= 4 ? 12 : (SHORT_EXACT_TOKENS.has(cleanToken) ? 10 : 4);
      } else if (normalized.includes(cleanToken) || lower.includes(cleanToken)) {
        if (cleanToken.length >= 4 || SHORT_EXACT_TOKENS.has(cleanToken)) {
          matched = true;
        }
      } else if (cleanToken.length >= 4 && (normalized.includes(compactedToken) || lower.includes(compactedToken))) {
        matched = true;
      }

      if (matched) {
        // Prefer longer token matches to avoid greedy short tokens
        const score = cleanToken.length * 2 + scoreBonus + (cat.name.toLowerCase() === cleanToken ? 10 : 0);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { category: cat, score, matchedToken: cleanToken };
        }
      }
    }
  }

  return bestMatch;
}

export interface EnterpriseClassificationResult {
  industry: string;
  productCategory: string;
  subCategory: string;
  confidence: number;
  matchedTokens: string[];
  category: MasterCategoryDefinition;
  primaryProducts: string[];
}

/**
 * High-precision two-tier enterprise classifier for B2B intelligence
 */
export function classifyEnterprise(textOrDomain: string): EnterpriseClassificationResult | null {
  if (!textOrDomain) return null;
  const match = matchMasterCategory(textOrDomain);
  if (!match) return null;

  return {
    industry: match.category.parentIndustry || match.category.name,
    productCategory: match.category.name,
    subCategory: match.category.relatedKeywords.slice(0, 3).join(', '),
    confidence: Math.min(100, Math.max(70, match.score * 3)),
    matchedTokens: [match.matchedToken],
    category: match.category,
    primaryProducts: match.category.productKeywords.slice(0, 5)
  };
}
