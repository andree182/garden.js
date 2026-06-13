// src/exampleProjects.js
import * as THREE from 'three';

export const getOrchardExample = () => {
    // 20x20 grid
    const w = 20;
    const h = 20;
    const heightData = Array(h).fill(0).map(() => Array(w).fill(0));
    const colorData = Array(h).fill(0).map(() => Array(w).fill("#557a2b")); // Green grass color
    
    // Add some height variations in the center/sides
    for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
            // A small hill on the left side
            const distToHill = Math.hypot(r - 10, c - 3);
            heightData[r][c] = Math.max(0, 1.2 - distToHill * 0.3);
            
            // Paint path in the middle
            if (c === 10) {
                colorData[r][c] = "#8B7355"; // Brown gravel path
            }
        }
    }
    
    // Add objects
    const objects = [];
    let id = 1;
    
    // Some white oaks and apple trees
    objects.push({
        id: id++,
        type: "deciduous_tree",
        name: "White Oak (Quercus alba)",
        worldX: -3.0,
        worldZ: -3.0,
        trunkHeight: 1.2,
        trunkDiameter: 0.35,
        trunkColor: "#8B5A2B",
        branchiness: 0.4,
        branchDensity: 12,
        branchLevels: 3,
        branchLengthMax: 0.8,
        branchTaperFactor: 0.7,
        branchAngleBias: 5,
        foliageDiameter: 2.2,
        foliageScaleXZ: 1.1,
        foliageScaleY: 1.0,
        foliageOpacity: 0.85,
        foliageColor: "#2E8B57",
        fruitType: "none",
        rotationY: 45
    });

    objects.push({
        id: id++,
        type: "deciduous_tree",
        name: "Apple Tree (Malus domestica)",
        worldX: 3.0,
        worldZ: -3.0,
        trunkHeight: 0.8,
        trunkDiameter: 0.22,
        trunkColor: "#A0522D",
        branchiness: 0.6,
        branchDensity: 15,
        branchLevels: 3,
        branchLengthMax: 0.7,
        branchTaperFactor: 0.65,
        branchAngleBias: 0,
        foliageDiameter: 1.8,
        foliageScaleXZ: 1.0,
        foliageScaleY: 0.9,
        foliageOpacity: 0.85,
        foliageColor: "#559040",
        fruitType: "apple",
        fruitDensity: 40,
        rotationY: 120
    });

    // Add some small fruit bushes
    for (let i = 0; i < 4; i++) {
        objects.push({
            id: id++,
            type: "small_fruit_bush",
            name: "Highbush Blueberry (V. corymbosum)",
            worldX: -2.5 + i * 1.5,
            worldZ: 2.5,
            bushDiameter: 0.7,
            bushHeight: 0.6,
            flattenBottom: 0.25,
            foliageColor: "#2E5A1C",
            fruitColor: "#1F4E79",
            fruitSize: 0.012,
            fruitDensity: 180,
            rotationY: i * 30
        });
    }

    // Add raised beds
    objects.push({
        id: id++,
        type: "raised_bed",
        name: "Raised Bed",
        worldX: 3.5,
        worldZ: 3.5,
        width: 1.2,
        length: 2.0,
        height: 0.4,
        woodColor: "#8B5A2B",
        soilColor: "#4A2F13"
    });

    // Add bench
    objects.push({
        id: id++,
        type: "bench",
        name: "Bench",
        worldX: 0.0,
        worldZ: -1.0,
        length: 1.5,
        width: 0.5,
        color: "#6B4423",
        rotationY: 90
    });
    
    return {
        version: 5,
        heightData,
        colorData,
        objects
    };
};

export const getCourtyardExample = () => {
    // 16x16 grid
    const w = 16;
    const h = 16;
    const heightData = Array(h).fill(0).map(() => Array(w).fill(0));
    const colorData = Array(h).fill(0).map(() => Array(w).fill("#4E6E35"));
    
    // Make a flat courtyard with a stone border
    for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
            // center square is paved
            if (r >= 4 && r <= 11 && c >= 4 && c <= 11) {
                colorData[r][c] = "#808080"; // Stone grey paver color
            }
        }
    }
    
    const objects = [];
    let id = 1;
    
    // Greenhouse in the corner
    objects.push({
        id: id++,
        type: "greenhouse",
        name: "Greenhouse",
        worldX: -3.0,
        worldZ: -3.0,
        length: 2.5,
        width: 1.8,
        height: 2.0,
        frameColor: "#2E5A1C",
        showInterior: true,
        rotationY: 0
    });

    // Pergola
    objects.push({
        id: id++,
        type: "pergola",
        name: "Pergola",
        worldX: 2.5,
        worldZ: 2.5,
        length: 2.2,
        width: 2.2,
        height: 2.2,
        postColor: "#5C3A21",
        beamColor: "#5C3A21",
        rotationY: 0
    });

    // Lights
    objects.push({
        id: id++,
        type: "garden_light",
        name: "Garden Light",
        worldX: -2.0,
        worldZ: 2.0,
        postHeight: 1.2,
        lightColor: "#FFFFE0",
        isOn: true
    });
    objects.push({
        id: id++,
        type: "garden_light",
        name: "Garden Light",
        worldX: 2.0,
        worldZ: -2.0,
        postHeight: 1.2,
        lightColor: "#FFFFE0",
        isOn: true
    });

    // Shrubs and flowers along the borders
    objects.push({
        id: id++,
        type: "shrub",
        name: "Boxwood (Buxus sempervirens)",
        worldX: -3.5,
        worldZ: 3.5,
        maxRadius: 0.5,
        color: "#1E4620",
        rotationY: 10
    });
    objects.push({
        id: id++,
        type: "shrub",
        name: "Boxwood (Buxus sempervirens)",
        worldX: 3.5,
        worldZ: -3.5,
        maxRadius: 0.5,
        color: "#1E4620",
        rotationY: 80
    });

    // Small flower patches
    objects.push({
        id: id++,
        type: "ground_flower",
        name: "Lavender (Lavandula)",
        worldX: -2.5,
        worldZ: 3.5,
        patchDiameter: 0.6,
        flowerColor: "#9370DB",
        flowerShape: "cone",
        flowerSize: 0.025,
        stemHeight: 0.18,
        density: 180,
        rotationY: 0
    });

    objects.push({
        id: id++,
        type: "ground_flower",
        name: "Tulip (Tulipa)",
        worldX: 3.5,
        worldZ: -2.5,
        patchDiameter: 0.5,
        flowerColor: "#FF4500",
        flowerShape: "sphere",
        flowerSize: 0.035,
        stemHeight: 0.15,
        density: 120,
        rotationY: 90
    });
    
    return {
        version: 5,
        heightData,
        colorData,
        objects
    };
};
