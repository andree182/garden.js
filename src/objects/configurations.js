export const objectConfigurations = [
    // Data sourced from public domain databases including USDA PLANTS Database and Wikipedia (CC-BY-SA)
    
    // --- Deciduous Trees ---
    { name: "White Oak (Quercus alba)", type: "deciduous_tree", props: { trunkDiameter: 0.6, trunkHeight: 1.5, foliageDiameter: 4.5, foliageScaleXZ: 1.2, foliageScaleY: 0.8, foliageColor: "#4A7023", branchDensity: 40, branchiness: 0.6, branchLengthMax: 1.2, branchAngleBias: -5, fruitType: 'none' } },
    { name: "Weeping Willow (Salix babylonica)", type: "deciduous_tree", props: { trunkDiameter: 0.5, trunkHeight: 1.2, foliageDiameter: 3.5, foliageScaleXZ: 1.1, foliageScaleY: 1.3, foliageColor: "#7CB342", branchDensity: 60, branchiness: 0.4, branchLengthMax: 1.5, branchAngleBias: -30, fruitType: 'none' } }, // Branches droop down
    { name: "Japanese Maple (Acer palmatum)", type: "deciduous_tree", props: { trunkDiameter: 0.15, trunkHeight: 0.8, foliageDiameter: 2.2, foliageScaleXZ: 1.3, foliageScaleY: 0.6, foliageColor: "#8B0000", branchDensity: 30, branchiness: 0.8, branchAngleBias: 5, fruitType: 'none' } }, // Red foliage, spreading
    { name: "Silver Birch (Betula pendula)", type: "deciduous_tree", props: { trunkDiameter: 0.2, trunkHeight: 2.0, trunkColor: "#E8E8E8", branchColor: "#D3D3D3", foliageDiameter: 1.8, foliageScaleY: 1.4, foliageColor: "#81C784", branchDensity: 45, branchAngleBias: 10, fruitType: 'none' } },
    
    // --- Fruit Trees ---
    { name: "Apple Tree (Malus domestica)", type: "deciduous_tree", props: { trunkDiameter: 0.25, trunkHeight: 1.0, foliageDiameter: 2.5, foliageScaleXZ: 1.0, foliageScaleY: 1.0, foliageColor: "#4CAF50", fruitType: 'apple', fruitDensity: 40, branchiness: 0.5, branchAngleBias: 10 } },
    { name: "European Pear (Pyrus communis)", type: "deciduous_tree", props: { trunkDiameter: 0.2, trunkHeight: 1.3, foliageDiameter: 2.0, foliageScaleXZ: 0.9, foliageScaleY: 1.3, foliageColor: "#558B2F", fruitType: 'pear', fruitDensity: 35, branchiness: 0.4, branchAngleBias: 15 } },
    { name: "Plum Tree (Prunus domestica)", type: "deciduous_tree", props: { trunkDiameter: 0.2, trunkHeight: 1.1, foliageDiameter: 2.2, foliageScaleXZ: 1.1, foliageScaleY: 0.9, foliageColor: "#689F38", fruitType: 'plum', fruitDensity: 50, branchiness: 0.6 } },

    // --- Conifers ---
    { name: "Eastern White Pine (Pinus strobus)", type: "tree", props: { maxTrunkHeight: 1.8, maxFoliageHeight: 3.5, maxFoliageRadius: 1.0, foliageColor: "#2E5C32", trunkColor: "#4E342E" } },
    { name: "Norway Spruce (Picea abies)", type: "tree", props: { maxTrunkHeight: 0.5, maxFoliageHeight: 4.0, maxFoliageRadius: 1.5, foliageColor: "#1B5E20", trunkColor: "#3E2723" } },
    { name: "Default Conifer", type: "tree", props: {} },

    // --- Shrubs & Hedges ---
    { name: "Boxwood (Buxus sempervirens)", type: "hedge", props: { length: 1.0, width: 1.0, height: 0.8, color: "#33691E" } },
    { name: "Hydrangea (H. macrophylla)", type: "shrub", props: { maxRadius: 0.6, color: "#388E3C" } },
    { name: "Lilac (Syringa vulgaris)", type: "shrub", props: { maxRadius: 0.9, color: "#4CAF50" } },

    // --- Small Fruit Bushes ---
    { name: "Highbush Blueberry (V. corymbosum)", type: "small_fruit_bush", props: { bushDiameter: 1.0, bushHeight: 1.2, fruitColor: "#4682B4", fruitSize: 0.012, fruitDensity: 250, fruitPresenceMonths: [6, 7] } },
    { name: "Red Raspberry (Rubus idaeus)", type: "small_fruit_bush", props: { bushDiameter: 0.8, bushHeight: 1.0, flattenBottom: 0.1, fruitColor: "#E30B5D", fruitSize: 0.015, fruitDensity: 150, fruitPresenceMonths: [7, 8, 9] } },
    { name: "Red Currant (Ribes rubrum)", type: "small_fruit_bush", props: { bushDiameter: 0.7, bushHeight: 0.8, fruitColor: "#C81D11", fruitSize: 0.01, fruitDensity: 300, fruitPresenceMonths: [6, 7] } },

    // --- Ground Fruit ---
    { name: "Garden Strawberry (F. × ananassa)", type: "ground_fruit", props: { patchDiameter: 0.4, fruitColor: "#FF4500", fruitSize: 0.015, fruitDensity: 100, leafDensity: 120 } },

    // --- Flowers ---
    { name: "Lavender (Lavandula angustifolia)", type: "small_flower", props: { flowerColor: "#967BB6", flowerShape: 'cone', flowerSize: 0.015, stemHeight: 0.3, patchDiameter: 0.6, density: 250, stemColor: "#8D9E8D", bloomMonths: [6,7,8] } },
    { name: "Common Sunflower (H. annuus)", type: "small_flower", props: { flowerColor: "#FDD835", flowerShape: 'cone', flowerSize: 0.08, stemHeight: 1.8, patchDiameter: 0.3, density: 15, stemColor: "#7CB342", bloomMonths: [7,8,9] } },
    { name: "Tulip (Tulipa)", type: "small_flower", props: { flowerColor: "#F44336", flowerShape: 'cone', flowerSize: 0.04, stemHeight: 0.35, patchDiameter: 0.3, density: 60, bloomMonths: [4,5] } },

    // Grass
    {
        name: "Default Grass",
        type: "grass",
        props: {} // Uses defaults from schema
    },
     {
        name: "Dry Grass Patch",
        type: "grass",
        props: { bottomColor: "#8B8B5A", topColor: "#C4C482", colorRatio: 0.6, length: 0.2 }
    },
    
    { name: "Long Hedge", type: "hedge", props: { length: 3.0, height: 0.7, color: "#2F4F2F" } },
    { name: "Square Hedge", type: "hedge", props: { length: 0.8, width: 0.8, height: 0.6 } },
    
    { name: "Wood Panel (Vert)", type: "fence_panel", props: { pattern: 'vertical_stripes', color1: "#BC8F8F", color2: "#A0522D", thickness: 0.1, spacing: 0.02 } },
    { name: "Wood Panel (Horiz)", type: "fence_panel", props: { pattern: 'horizontal_stripes', color1: "#BC8F8F", color2: "#A0522D", thickness: 0.1, spacing: 0.02 } },
    { name: "Wire Mesh Fence", type: "fence_panel", props: { pattern: 'wire_mesh', color1: "#555555", thickness: 0.015, spacing: 0.08, backgroundColor: '#AAAAAA44' } }, // Semi-transparent BG
    { name: "Diagonal Slats", type: "fence_panel", props: { pattern: 'vertical_stripes', rotation: 45, color1: "#D2B48C", color2: "#CD853F", thickness: 0.06, spacing: 0.06 } },

    // Raised Beds
    { name: "Wooden Bed", type: "raised_bed", props: { length: 2.0, width: 0.6, height: 0.25, frameColor: "#A0522D", soilColor: "#6B4423" } },
    { name: "Stone Bed", type: "raised_bed", props: { length: 1.2, width: 1.2, height: 0.4, frameColor: "#778899", soilColor: "#5C4033" } },
    { name: "Park Bench", type: "bench", props: {} },
    { name: "Wood Bench", type: "bench", props: { color: "#8B4513" } },
    { name: "Terracotta Pot", type: "pot", props: {} },
    { name: "Large Stone Pot", type: "pot", props: { topDiameter: 0.8, bottomDiameter: 0.6, height: 0.6, color: "#778899"} },
    { name: "Small Boulder", type: "boulder", props: { size: 0.4, color: "#A0A0A0"} },
    { name: "Large Boulder", type: "boulder", props: { size: 1.0, color: "#696969"} },
    // Cars
    { name: "Red Car", type: "car", props: { color: "#DC143C" } },
    { name: "Blue Car", type: "car", props: { color: "#4682B4" } },
    // Garden Lights
    { name: "Post Light", type: "garden_light", props: {} },
    { name: "Short Bollard", type: "garden_light", props: { postHeight: 0.3, lightIntensity: 1.0, lightRange: 2.0 } },
    
        // Rectangular Stones
    // Stepping Stones
    { name: "Slate Stone", type: "stepping_stone", props: { diameter: 0.5, color: "#708090" } },
    { name: "Sandstone", type: "stepping_stone", props: { diameter: 0.35, color: "#C19A6B" } },
    { name: "Paver Stone", type: "rect_stepping_stone", props: { length: 0.6, width: 0.4, color: "#A9A9A9" } },
    { name: "Flagstone Slab", type: "rect_stepping_stone", props: { length: 0.8, width: 0.5, height: 0.06, color: "#778899" } },
    { name: "Square Paver", type: "paver", props: {} },
    { name: "Rect Paver", type: "paver", props: { length: 0.8, width: 0.4, color: "#B0A492"} },

    // Pergolas
    { name: "Wooden Pergola", type: "pergola", props: {} }, // Use defaults
    { name: "Large Pergola", type: "pergola", props: { length: 3, width: 4, height: 2.4, postDiameter: 0.15 } },
    { name: "Pergola (Solid Cover)", type: "pergola", props: { coverOpacity: 1.0, coverColor: "#E0E0E0" } },

    // Gravel Patches
    { name: "Grey Gravel", type: "gravel_patch", props: {} }, // Use defaults
    { name: "Pea Gravel", type: "gravel_patch", props: { length: 2, width: 2, color1: "#D2B48C", color2: "#BC8F8F", noiseScale: 25 } },

    // Houses
    { name: "Simple House (Saddle)", type: "house", props: {} }, // Use defaults
    { name: "Long House (Flat)", type: "house", props: { length: 6, width: 2.5, height: 2.8, roofType: 'flat', wallColor: '#C0C0C0', roofColor: '#555555' } },
    { name: "Red Brick House", type: "house", props: { wallColor: "#8B0000", roofColor: "#444444"} },
    
    // Play Structures
    { name: "Wooden Swing Set", type: "swing_set", props: { materialType: 'wood_10cm'} },
    { name: "Metal Swing Set", type: "swing_set", props: { materialType: 'iron_round_5cm', materialColor: '#4682B4', numSwings: 3, width: 3.0 } }, // Blue Metal
    { name: "A-Frame Wood Set", type: "swing_set", props: { materialType: 'wood_15cm', standPoles: 'A-frame', depth: 2.0 } },
    { name: "Single Pole Metal", type: "swing_set", props: { materialType: 'iron_round_5cm', standPoles: 'single', width: 2.0, numSwings: 1 } },

    // Greenhouses
    { name: "Glass Greenhouse", type: "greenhouse", props: {} },
    { name: "Large Greenhouse", type: "greenhouse", props: { length: 4.5, width: 3.0, height: 2.0, roofHeight: 0.9, frameColor: "#333333" } },
];
