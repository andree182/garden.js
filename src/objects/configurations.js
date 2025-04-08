export const objectConfigurations = [
    // Trees
    {
        name: "Pine Tree (Tall)",
        type: "tree",
        props: {
            maxTrunkHeight: 1.6, maxFoliageHeight: 2.5, maxFoliageRadius: 0.6,
            foliageColor: "#2E6B2F", trunkColor: "#654321"
            // Other props will use defaults from schema if not specified
        }
    },
    {
        name: "Default Conifer",
        type: "tree",
        props: {
            maxTrunkHeight: 0.7, maxFoliageHeight: 1.8, maxFoliageRadius: 1.4,
            foliageColor: "#556B2F", trunkColor: "#8B4513"
        }
    },
    { name: "Apple Tree", type: "deciduous_tree", props: { fruitType: 'apple', foliageColor: "#6B8E23" } },
    { name: "Pear Tree", type: "deciduous_tree", props: { fruitType: 'pear', foliageDiameter: 2.2, trunkHeight: 1.2 } },
    { name: "Tall Pear Tree", type: "deciduous_tree", props: { fruitType: 'pear', foliageScaleY: 1.4, foliageScaleXZ: 0.8, trunkHeight: 1.5, branchDensity: 30 } },
    { name: "Plum Tree", type: "deciduous_tree", props: { fruitType: 'plum', foliageColor: "#8FBC8F" } },
    { name: "Oak Tree", type: "deciduous_tree", props: { trunkDiameter: 0.4, foliageDiameter: 2.5, fruitType: 'apple', fruitDensity: 5 } },    
    { name: "Spreading Oak", type: "deciduous_tree", props: { trunkDiameter: 0.5, trunkHeight: 0.8, foliageScaleXZ: 1.6, foliageScaleY: 0.7, fruitType: 'none', branchDensity: 50, branchLengthMax: 1.0, branchDiameter: 0.1 } },
    {
        name: "Default Tree", // Keep the original default
        type: "tree",
        props: {} // Will use all defaults from schema
    },
    {
        name: "Birch", // Keep the multi-trunk feel via branches
        type: "deciduous_tree",
        props: {
            // Removed numTrunks/trunkSpread
            branchDensity: 60, branchLengthMax: 0.9, branchDiameter: 0.06, // More, longer, thinner branches
            trunkHeight: 1.8, trunkDiameter: 0.18, // Slightly taller/thinner main trunk
            trunkColor: "#FFFFFF", branchColor: "#F0F0F0", // White/off-white
            foliageScaleY: 1.2, foliageScaleXZ: 0.9, // Slightly elongated foliage
            foliageColor: "#98FB98", // Pale green
            fruitType: 'none'
        }
    },
    // Shrubs
    {
        name: "Small Bush",
        type: "shrub",
        props: { maxRadius: 0.3, color: "#4F7942" }
    },
    {
        name: "Large Bush",
        type: "shrub",
        props: { maxRadius: 0.6, color: "#556B2F" }
    },
    // Small Fruit Bushes
    { name: "Blueberry Bush", type: "small_fruit_bush", props: { bushDiameter: 0.7, bushHeight: 0.6, fruitColor: "#4682B4", fruitSize: 0.01, fruitDensity: 200, fruitPresenceMonths: [7, 8] } },
    { name: "Raspberry Bush", type: "small_fruit_bush", props: { bushDiameter: 0.5, bushHeight: 0.8, flattenBottom: 0.1, fruitColor: "#E30B5D", fruitSize: 0.012, fruitDensity: 150, fruitPresenceMonths: [7, 8, 9] } },
    { name: "Red Currant", type: "small_fruit_bush", props: { bushDiameter: 0.6, bushHeight: 0.7, fruitColor: "#C81D11", fruitSize: 0.008, fruitDensity: 250, fruitPresenceMonths: [7] } },
    { name: "Gooseberry Bush", type: "small_fruit_bush", props: { bushDiameter: 0.8, bushHeight: 0.6, flattenBottom: 0.3, foliageColor: "#90EE90", fruitColor: "#BFFF00", fruitSize: 0.02, fruitDensity: 100, fruitPresenceMonths: [7, 8] } },

    // Ground Fruit
    { name: "Strawberry Patch", type: "ground_fruit", props: {} }, // Use defaults
    { name: "Alpine Strawberry", type: "ground_fruit", props: { patchDiameter: 0.3, fruitColor: "#FF4500", fruitSize: 0.01, fruitDensity: 120, leafDensity: 100 } },

    // Small Flowers
    { name: "Pink Flowers", type: "small_flower", props: { flowerColor: "#FFB6C1", patchDiameter: 0.5, density: 180 } }, // Light Pink
    { name: "Tulips (Red)", type: "small_flower", props: { flowerColor: "#FF0000", flowerShape: 'cone', flowerSize: 0.04, stemHeight: 0.25, patchDiameter: 0.3, density: 80, bloomMonths: [4,5] } },
    { name: "Lavender Patch", type: "small_flower", props: { flowerColor: "#E6E6FA", flowerShape: 'cone', flowerSize: 0.015, stemHeight: 0.2, patchDiameter: 0.6, density: 200, stemColor: "#B0C4DE", bloomMonths: [6,7,8] } },
    { name: "Coneflowers", type: "small_flower", props: { flowerColor: "#DA70D6", flowerShape: 'cone', flowerSize: 0.05, stemHeight: 0.3, patchDiameter: 0.4, density: 70, bloomMonths: [7,8,9] } }, // Orchid color

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
    // Stepping Stones
    { name: "Slate Stone", type: "stepping_stone", props: { diameter: 0.5, color: "#708090" } },
    { name: "Sandstone", type: "stepping_stone", props: { diameter: 0.35, color: "#C19A6B" } },
    // Raised Beds
    { name: "Wooden Bed", type: "raised_bed", props: { length: 2.0, width: 0.6, height: 0.25, frameColor: "#A0522D", soilColor: "#6B4423" } },
    { name: "Stone Bed", type: "raised_bed", props: { length: 1.2, width: 1.2, height: 0.4, frameColor: "#778899", soilColor: "#5C4033" } },
    // Cars
    { name: "Red Car", type: "car", props: { color: "#DC143C" } },
    { name: "Blue Car", type: "car", props: { color: "#4682B4" } },
    // Garden Lights
    { name: "Post Light", type: "garden_light", props: {} },
    { name: "Short Bollard", type: "garden_light", props: { postHeight: 0.3, lightIntensity: 1.0, lightRange: 2.0 } },
    
        // Rectangular Stones
    { name: "Paver Stone", type: "rect_stepping_stone", props: { length: 0.6, width: 0.4, color: "#A9A9A9" } },
    { name: "Flagstone Slab", type: "rect_stepping_stone", props: { length: 0.8, width: 0.5, height: 0.06, color: "#778899" } },

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
];
