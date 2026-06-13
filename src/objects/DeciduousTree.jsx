// src/objects/DeciduousTree.jsx

import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ObjectBase } from './ObjectBase';
import { createRandom } from '../utils';

// --- Constants ---
const lerp = THREE.MathUtils.lerp;
const tempMatrix = new THREE.Matrix4();
const tempObject = new THREE.Object3D(); // Use Object3D for easier matrix composition
const tempColor = new THREE.Color();
const tempVec = new THREE.Vector3();
const tempVec2 = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const UP_VECTOR = new THREE.Vector3(0, 0, 1);

const MAX_BRANCH_SEGMENTS = 500; // Max total instances for branches
const MAX_LEAF_CLUSTERS = 1000; // Max instances for leaf clusters
const MAX_FRUITS = 500; // Keep fruit limit
const MAX_BRANCH_LEVELS = 4; // How many times branches can split

// --- Helper ---
function getRandomPointInCone(baseDir, angleDeg, random) {
    const angleRad = THREE.MathUtils.degToRad(angleDeg);
    const z = random() * (1 - Math.cos(angleRad)) + Math.cos(angleRad); // Cosine-weighted distribution
    const phi = random() * Math.PI * 2;
    const x = Math.sqrt(1 - z * z) * Math.cos(phi);
    const y = Math.sqrt(1 - z * z) * Math.sin(phi);

    const point = new THREE.Vector3(x, y, z);

    // Align the cone direction with the base direction
    const quat = new THREE.Quaternion().setFromUnitVectors(UP_VECTOR, baseDir.clone().normalize());
    return point.applyQuaternion(quat).normalize();
}


export const DeciduousTree = React.memo(({
    position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1, currentMonth = 6,
    // Trunk Properties
    trunkHeight = 1.0,
    trunkDiameter = 0.25,
    trunkColor = "#A0522D",
    // --- NEW Branching Params ---
    branchiness = 0.5,     // 0: Strong central trunk, 1: Branches early/low & thick
    branchDensity = 15,    // Base number of branches per level (adjust multiplier inside)
    branchLevels = 3,      // Max branching iterations (clamped by MAX_BRANCH_LEVELS)
    branchLengthMax = 0.8, // Base length factor
    branchTaperFactor = 0.7,// Diameter multiplier per level (0.1=thin tips, 1=uniform)
    branchAngleBias = 0,   // Degrees: -45 (down) to 45 (up) bias from parent
    branchColor = null,    // Use trunk color if null
    // --- Foliage Params ---
    foliageDiameter = 1.8, // Still used for overall volume conceptualization (fruit, bounds)
    foliageScaleXZ = 1.0,
    foliageScaleY = 1.0,
    foliageColor = "#559040", // Base summer color
    foliageOpacity = 0.85, // Opacity if using 'volume' or 'both'
    leafDistribution = 'volume', // 'volume', 'tips'
    leafClusterSize = 0.15, // Size of individual leaf clusters if leafDistribution = 'tips'
    // --- Fruit Properties ---
    fruitType = 'apple',
    fruitDensity = 30, // Density relative to conceptual volume
    rotationY = 0,
}) => {
    const random = createRandom(objectId || (position ? position.join(',') : 'obj'));


    const branchMeshRef = useRef();
    const leafClusterMeshRef = useRef();
    const fruitMeshRef = useRef(); // Keep fruit separate

    // --- Seasonal Calculations ---
    const isWinter = useMemo(() => currentMonth >= 12 || currentMonth <= 2, [currentMonth]);
    const isSpring = useMemo(() => currentMonth >= 3 && currentMonth <= 5, [currentMonth]);
    const isFall = useMemo(() => currentMonth >= 9 && currentMonth <= 11, [currentMonth]);
    const hasLeaves = !isWinter;
    const showFruit = useMemo(() => fruitType !== 'none' && (isFall || currentMonth === 8), [fruitType, isFall, currentMonth]); // Example: Show fruit in late summer/fall

    const currentFoliageColor = useMemo(() => {
        if (isSpring) return "#90EE90"; // Light green
        if (isFall) return "#FFA500"; // Orange/Yellow
        return foliageColor;
    }, [isSpring, isFall, foliageColor]);


    // --- Aged Dimensions ---
    // Age affects overall scale and potentially number of branches implicitly
    const ageScale = lerp(0.2, 1.0, globalAge);
    const currentTrunkHeight = trunkHeight * ageScale;
    const currentTrunkDiameter = trunkDiameter * ageScale;
    const currentBranchLengthMax = branchLengthMax * ageScale;
    // Conceptual volume for fruits/bounds
    const baseFoliageRadius = foliageDiameter / 2;
    const currentFoliageRadiusXZ = lerp(0.15, baseFoliageRadius * foliageScaleXZ, globalAge);
    const currentFoliageRadiusY = lerp(0.15, baseFoliageRadius * foliageScaleY, globalAge);
    const foliageCenterY = currentTrunkHeight * (1 - branchiness * 0.4) + currentFoliageRadiusY * 0.5; // Center adjusted by branchiness


    // --- Geometries & Materials (Memoized) ---
    const [trunkGeo, trunkMat] = useMemo(() => [
        new THREE.CylinderGeometry(0.5, 0.5, 1, 8), // Base radius 0.5, height 1
        new THREE.MeshStandardMaterial({ color: trunkColor })
    ], [trunkColor]);

    const [branchGeo, branchMat] = useMemo(() => [
        new THREE.CylinderGeometry(0.5, 0.5, 1, 5).translate(0, 0.5, 0),
        new THREE.MeshStandardMaterial({ color: branchColor || trunkColor })
    ], [branchColor, trunkColor]);

    const [leafClusterGeo, leafClusterMat] = useMemo(() => [
        // Simple sphere cluster
        new THREE.SphereGeometry(1, 7, 5), // Base radius 1 for scaling, slightly more detail
        new THREE.MeshStandardMaterial({
            color: currentFoliageColor,
            roughness: 0.8,
            metalness: 0.1,
            transparent: true,
            opacity: leafDistribution === 'volume' ? foliageOpacity : 0.9,
            depthWrite: false // Often looks better for foliage clusters
        })
    ], [leafDistribution, foliageOpacity, currentFoliageColor]); // Recreate if opacity/distribution changes

    // --- Fruit Definitions ---
    const fruitCount = useMemo(() => {
        if (!showFruit || fruitDensity <= 0) return 0;
        const volume = (4 / 3) * Math.PI * currentFoliageRadiusXZ * currentFoliageRadiusY * currentFoliageRadiusXZ;
        const calculatedCount = Math.floor(fruitDensity * volume * 0.5 * globalAge); // Age affects fruit
        return Math.min(MAX_FRUITS, Math.max(0, calculatedCount));
    }, [showFruit, fruitDensity, currentFoliageRadiusXZ, currentFoliageRadiusY, globalAge]);

    const [fruitGeometry, fruitMaterial, fruitScale] = useMemo(() => {
         let geom, color, scale = 1.0;
         switch (fruitType) {
            case 'pear': geom = new THREE.SphereGeometry(0.05*ageScale, 8, 6); color = "#D1E231"; scale = 1.0; break;
            case 'plum': geom = new THREE.SphereGeometry(0.04*ageScale, 8, 6); color = "#6A0DAD"; scale = 0.8; break;
            case 'apple': default: geom = new THREE.SphereGeometry(0.045*ageScale, 8, 6); color = "#FF6347"; scale = 1.0; break;
         }
         const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
         return [geom, mat, scale * ageScale]; // Scale fruit with age too
    }, [fruitType, ageScale]);

    // --- Branch & Leaf Cluster Generation ---
    useLayoutEffect(() => {
        const branches = []; // Array to hold { matrix, endPoint, direction, diameter, length, level, isTerminal }
        const leafClusters = []; // Array to hold { matrix } for tips/volume
        const branchMesh = branchMeshRef.current;
        const leafMesh = leafClusterMeshRef.current;
        
        if (!branchMesh) return;

        // Update materials that change with season/props
        branchMat.color.set(branchColor || trunkColor);
        if (leafMesh) {
            leafClusterMat.color.set(currentFoliageColor);
        }

        // Initial "branch" is the trunk segment from which others sprout
        const trunkTopY = currentTrunkHeight;
        const firstBranchStartY = lerp(trunkTopY * 0.6, trunkTopY * 0.2, branchiness); // Lower start for higher branchiness
        const effectiveTrunkHeightForBranching = trunkTopY - firstBranchStartY;

        let branchesInLevel = [{
            startPoint: new THREE.Vector3(0, firstBranchStartY, 0),
            direction: new THREE.Vector3(0, 1, 0),
            diameter: currentTrunkDiameter,
            length: effectiveTrunkHeightForBranching, // Conceptual length
            level: 0,
            isTerminal: false // Trunk itself isn't terminal
        }];

        const numLevels = Math.min(MAX_BRANCH_LEVELS, Math.max(1, Math.floor(branchLevels * globalAge))); // Age affects levels

        // Calculate ellipsoid bounds for branch clipping
        const baseClusterSize = leafDistribution === 'volume' ? currentFoliageRadiusXZ * 0.5 : leafClusterSize * ageScale;
        const innerRadiusXZ = Math.max(0.1, currentFoliageRadiusXZ - baseClusterSize * 0.4);
        const innerRadiusY = Math.max(0.1, currentFoliageRadiusY - baseClusterSize * 0.4);
        const center = new THREE.Vector3(0, foliageCenterY, 0);

        for (let level = 1; level <= numLevels; level++) {
            const nextLevelBranches = [];
            if (branchesInLevel.length === 0) break;

            for (const parent of branchesInLevel) {
                if (parent.isTerminal) continue; // Don't branch from terminal

                // How many children? More for lower levels & higher density/branchiness
                const baseChildren = branchDensity * lerp(1.5, 0.5, (level -1) / numLevels); // Fewer branches at higher levels
                const numChildren = Math.max(1, Math.floor(baseChildren * (0.5 + random() * 1.0))); // Add randomness

                for (let i = 0; i < numChildren; i++) {
                    if (branches.length >= MAX_BRANCH_SEGMENTS) break;

                    // --- Child Properties ---
                    const childLevel = parent.level + 1;
                    const levelFactor = (numLevels - childLevel + 1) / numLevels; // 1 for first level, small for last

                    // Start point is parent's end point
                    const startPoint = parent.startPoint.clone().addScaledVector(parent.direction, parent.length);

                    // Direction: Start with parent dir, add bias, add randomness within a cone
                    let baseDir = parent.direction.clone();
                    // Bias towards vertical based on branchiness (less vertical for high branchiness)
                    baseDir.lerp(UP_VECTOR, lerp(0.1, -0.1, branchiness)).normalize();
                    // Apply angle bias (relative to horizontal plane maybe?) - simplified: bias up/down
                    const biasQuat = new THREE.Quaternion().setFromAxisAngle(
                        tempVec.set(parent.direction.z, 0, -parent.direction.x).normalize(), // Axis perpendicular to parent dir in XZ
                        THREE.MathUtils.degToRad(branchAngleBias * (0.5 + random() * 0.5)) // Randomize bias slightly
                    );
                    baseDir.applyQuaternion(biasQuat);
                    // Add random deviation within a cone (wider cone for lower levels/high branchiness)
                    const randomAngle = lerp(60, 30, levelFactor) * lerp(1.2, 0.8, branchiness);
                    const direction = getRandomPointInCone(baseDir, randomAngle, random);

                    // Length: Based on max, level, randomness. Shorter for higher levels.
                    let length = currentBranchLengthMax * lerp(0.3, 1.0, levelFactor) * (0.7 + random() * 0.6);

                    // --- Clip branch to foliage ellipsoid ---
                    const startLocal = startPoint.clone().sub(center);
                    startLocal.x /= innerRadiusXZ;
                    startLocal.y /= innerRadiusY;
                    startLocal.z /= innerRadiusXZ;

                    const dirLocal = direction.clone();
                    dirLocal.x /= innerRadiusXZ;
                    dirLocal.y /= innerRadiusY;
                    dirLocal.z /= innerRadiusXZ;

                    const A = dirLocal.lengthSq();
                    const B = startLocal.dot(dirLocal);
                    const C = startLocal.lengthSq() - 1.0;

                    let tIntersect = length;
                    let hitBoundary = false;
                    if (C > 0) {
                        tIntersect = 0.02; // Start point already outside, keep it very short
                        hitBoundary = true;
                    } else {
                        const discriminant = B * B - A * C;
                        if (discriminant >= 0) {
                            const t = (-B + Math.sqrt(discriminant)) / A;
                            if (t > 0 && t < length) {
                                tIntersect = t;
                                hitBoundary = true;
                            }
                        }
                    }
                    
                    length = Math.max(0.02, tIntersect);

                    // Diameter: Taper based on factor and level
                    const diameter = parent.diameter * lerp(branchTaperFactor, 1.0, 0.2) * (0.8 + random() * 0.4); // Taper more aggresively initially
                    const clampedDiameter = Math.max(0.01, diameter); // Ensure minimum thickness

                    // Is Terminal? Based on level, random chance, or hitting the boundary
                    let isTerminal = childLevel >= numLevels || random() > lerp(0.8, 0.2, levelFactor) || hitBoundary; 

                    // --- Create Matrix ---
                    tempObject.position.copy(startPoint);
                    tempObject.scale.set(clampedDiameter, length, clampedDiameter);
                    // Align cylinder's Y axis with the calculated direction
                    tempObject.quaternion.setFromUnitVectors(Y_AXIS, direction);
                    tempObject.updateMatrix();

                    const branchData = {
                        matrix: tempObject.matrix.clone(),
                        startPoint: startPoint,
                        endPoint: startPoint.clone().addScaledVector(direction, length),
                        direction: direction.clone(),
                        diameter: clampedDiameter,
                        length: length,
                        level: childLevel,
                        isTerminal: isTerminal
                    };
                    branches.push(branchData);

                    if (!isTerminal) {
                        nextLevelBranches.push(branchData);
                    }

                    // --- Add Leaf Cluster(s) ---
                    if (hasLeaves && leafClusters.length < MAX_LEAF_CLUSTERS) {
                        const isCanopyBranch = leafDistribution === 'volume' && (childLevel >= numLevels - 1 || isTerminal);
                        const isTip = leafDistribution === 'tips' && isTerminal;
                        
                        if (isCanopyBranch || isTip) {
                             // Place cluster at endPoint
                             tempObject.position.copy(branchData.endPoint);
                             tempObject.rotation.set(random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2);
                             const cSize = baseClusterSize * (0.8 + random() * 0.4);
                             tempObject.scale.setScalar(cSize);
                             tempObject.updateMatrix();
                             leafClusters.push({ matrix: tempObject.matrix.clone() });
                             
                             // If it's a canopy branch and it's long, place one at midpoint too for density
                             if (isCanopyBranch && branchData.length > cSize * 1.5 && leafClusters.length < MAX_LEAF_CLUSTERS) {
                                 tempObject.position.lerpVectors(branchData.startPoint, branchData.endPoint, 0.5);
                                 tempObject.rotation.set(random() * Math.PI * 2, random() * Math.PI * 2, random() * Math.PI * 2);
                                 tempObject.scale.setScalar(cSize * 0.9);
                                 tempObject.updateMatrix();
                                 leafClusters.push({ matrix: tempObject.matrix.clone() });
                             }
                        }
                    }
                }
                if (branches.length >= MAX_BRANCH_SEGMENTS) break;
            }
            branchesInLevel = nextLevelBranches;
            if (branches.length >= MAX_BRANCH_SEGMENTS) break;
        }

        // --- Update Instanced Meshes ---
        branchMesh.count = branches.length;
        branches.forEach((b, i) => branchMesh.setMatrixAt(i, b.matrix));
        branchMesh.instanceMatrix.needsUpdate = true;
        branchMesh.computeBoundingSphere(); // Important for frustum culling

        if (leafMesh) {
            leafMesh.count = leafClusters.length;
            leafClusters.forEach((l, i) => leafMesh.setMatrixAt(i, l.matrix));
            leafMesh.instanceMatrix.needsUpdate = true;
            leafMesh.computeBoundingSphere();
            leafMesh.visible = hasLeaves; // Hide clusters in winter
        }

        const fruitMesh = fruitMeshRef.current;
        if (fruitMesh) {
            if (showFruit && fruitCount > 0 && leafClusters.length > 0) {
                const actualFruitCount = Math.min(fruitCount, leafClusters.length * 3); // Limit per cluster
                for (let i = 0; i < actualFruitCount; i++) {
                    // Pick a random leaf cluster to hang from
                    const clusterIndex = Math.floor(random() * leafClusters.length);
                    const cluster = leafClusters[clusterIndex];
                    
                    // Extract position and scale from cluster matrix
                    tempVec.setFromMatrixPosition(cluster.matrix);
                    tempVec2.setFromMatrixScale(cluster.matrix);
                    const cRadius = tempVec2.x; // assuming uniform scale
                    
                    // Calculate outward direction from the center of the tree canopy
                    const treeCenter = new THREE.Vector3(0, foliageCenterY, 0);
                    const dirFromCenter = tempVec.clone().sub(treeCenter).normalize();
                    
                    // Add some noise to the direction so they scatter naturally around the outer edge
                    const randomSpread = new THREE.Vector3((random() - 0.5), (random() - 0.5), (random() - 0.5)).multiplyScalar(1.5);
                    const fruitDir = dirFromCenter.add(randomSpread).normalize();
                    
                    // Push the fruit to the very border of the cluster (or slightly outside)
                    const r = cRadius * (0.9 + random() * 0.25); 
                    
                    const offsetX = fruitDir.x * r;
                    const offsetY = fruitDir.y * r;
                    const offsetZ = fruitDir.z * r;
                    
                    tempObject.position.set(tempVec.x + offsetX, tempVec.y + offsetY, tempVec.z + offsetZ);
                    tempObject.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
                    tempObject.scale.setScalar(fruitScale);
                    tempObject.updateMatrix();
                    fruitMesh.setMatrixAt(i, tempObject.matrix);
                }
                fruitMesh.count = actualFruitCount;
                fruitMesh.instanceMatrix.needsUpdate = true;
                fruitMesh.computeBoundingSphere();
            } else {
                fruitMesh.count = 0;
            }
        }
    }, [
        // Include ALL props that affect geometry/appearance
        globalAge, currentMonth, trunkHeight, trunkDiameter, trunkColor,
        branchiness, branchDensity, branchLevels, branchLengthMax, branchTaperFactor,
        branchAngleBias, branchColor, foliageDiameter, foliageScaleXZ, foliageScaleY,
        foliageColor, foliageOpacity, leafDistribution, leafClusterSize, hasLeaves,
        // Also fruit properties
        showFruit, fruitCount, fruitScale,
        // Memoized geometry/material refs are stable, but include if needed
        branchGeo, branchMat, leafClusterGeo, leafClusterMat
    ]);

    return (
        <ObjectBase position={position} rotationY={rotationY} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="deciduous_tree">
            {/* Trunk */}
            <mesh
                geometry={trunkGeo}
                material={trunkMat}
                // Scale the base geometry
                scale={[currentTrunkDiameter, currentTrunkHeight, currentTrunkDiameter]}
                position={[0, currentTrunkHeight / 2, 0]} // Position base at origin
                castShadow
                receiveShadow
            />

            {/* Branches */}
            <instancedMesh
                ref={branchMeshRef}
                args={[null, null, MAX_BRANCH_SEGMENTS]} // Geometry/Material set dynamically if needed, or use memoized ones
                geometry={branchGeo}
                material={branchMat}
                castShadow
                receiveShadow
            />

             {/* Leaf Clusters */}
             <instancedMesh
                 ref={leafClusterMeshRef}
                 args={[null, null, MAX_LEAF_CLUSTERS]}
                 geometry={leafClusterGeo}
                 material={leafClusterMat}
                 castShadow
                 visible={false} // Visibility controlled by effect
             />

            {/* Fruits (Conditional) */}
             {showFruit && fruitCount > 0 && (
                <instancedMesh
                    ref={fruitMeshRef}
                    args={[null, null, fruitCount]}
                    geometry={fruitGeometry}
                    material={fruitMaterial}
                    castShadow
                 />
             )}

        </ObjectBase>
    );
});

// --- Updated Editor Schema ---
DeciduousTree.editorSchema = [
    { section: 'Trunk', type: 'section' },
    { name: 'trunkHeight', label: 'Trunk H', type: 'number', step: 0.1, min: 0.2, max: 5, defaultValue: 1.0 },
    { name: 'trunkDiameter', label: 'Trunk Ø', type: 'number', step: 0.05, min: 0.05, max: 1.5, defaultValue: 0.25 },
    { name: 'trunkColor', label: 'Trunk Clr', type: 'color', defaultValue: "#A0522D" },

    { section: 'Branching', type: 'section' },
    { name: 'branchiness', label: 'Branchiness', type: 'number', step: 0.05, min: 0, max: 1, defaultValue: 0.5, tooltip: '0=Tall/Central, 1=Low/Spreading' },
    { name: 'branchDensity', label: 'Branch Density', type: 'number', step: 1, min: 1, max: 50, defaultValue: 15, tooltip: 'Avg branches per split' },
    { name: 'branchLevels', label: 'Branch Levels', type: 'number', step: 1, min: 1, max: MAX_BRANCH_LEVELS, defaultValue: 3, tooltip: 'Max branching iterations' },
    { name: 'branchLengthMax', label: 'Branch Length', type: 'number', step: 0.05, min: 0.1, max: 1.5, defaultValue: 0.8, tooltip: 'Base length factor' },
    { name: 'branchTaperFactor', label: 'Branch Taper', type: 'number', step: 0.05, min: 0.1, max: 1.0, defaultValue: 0.7, tooltip: 'Thickness reduction per level' },
    { name: 'branchAngleBias', label: 'Branch Angle Bias', type: 'number', step: 5, min: -45, max: 45, defaultValue: 0, tooltip: 'Upward (+) / Downward (-) tendency' },
    { name: 'branchColor', label: 'Branch Clr', type: 'color', defaultValue: null, tooltip: 'Optional (uses Trunk Clr if null)' },

    { section: 'Foliage & Fruit', type: 'section' },
    { name: 'leafDistribution', label: 'Leaf Location', type: 'select', options: ['volume', 'tips'], defaultValue: 'volume', tooltip: 'Overall volume or only on branch tips' },
    { name: 'leafClusterSize', label: 'Leaf Cluster Size', type: 'number', step: 0.01, min: 0.01, max: 0.5, defaultValue: 0.15, if: { leafDistribution: 'tips' }, tooltip: 'Size of clusters at branch tips' },
    { name: 'foliageDiameter', label: 'Foliage Base Ø', type: 'number', step: 0.1, min: 0.3, max: 6, defaultValue: 1.8, tooltip: 'Conceptual overall width' },
    { name: 'foliageScaleXZ', label: 'Foliage Scale XZ', type: 'number', step: 0.05, min: 0.2, max: 2.0, defaultValue: 1.0, tooltip: 'Width/Depth aspect' },
    { name: 'foliageScaleY', label: 'Foliage Scale Y', type: 'number', step: 0.05, min: 0.2, max: 2.0, defaultValue: 1.0, tooltip: 'Height aspect' },
    { name: 'foliageOpacity', label: 'Foliage Opacity', type: 'number', step: 0.05, min: 0.1, max: 1.0, defaultValue: 0.85, if: { leafDistribution: 'volume' }, tooltip: 'Opacity for volume foliage' },
    { name: 'foliageColor', label: 'Summer Clr', type: 'color', defaultValue: "#559040", tooltip: 'Base color for leaves (Summer)' },
    { name: 'fruitType', label: 'Fruit Type', type: 'select', options: ['apple', 'pear', 'plum', 'none'], defaultValue: 'apple' },
    { name: 'fruitDensity', label: 'Fruit Density', type: 'number', step: 1, min: 0, max: 100, defaultValue: 30, if: { fruitType: ['apple', 'pear', 'plum'] }, tooltip: 'Density within conceptual volume' },

    { section: 'Other', type: 'section' },
    { name: 'rotationY', label: 'Rotation Y', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
