// src/Objects.jsx
import React, { useRef, useState, useCallback, useMemo, useLayoutEffect, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box } from '@react-three/drei';
import * as THREE from 'three';

// --- Config ---
const SELECTION_COLOR = '#FF00FF'; // Keep consistent or pass as prop if needed
const lerp = THREE.MathUtils.lerp;

const tempMatrix = new THREE.Matrix4(); // Reusable matrix for calculations
const tempObject = new THREE.Object3D(); // Reusable object for matrix composition
const tempColor = new THREE.Color(); // Reusable color object
const tempVec = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// --- ObjectBase: Wrapper with common logic (selection, animation, pointer down) ---
export const ObjectBase = ({ children, position, isSelected, onSelect, onPointerDown, objectId, type }) => {
    const groupRef = useRef();
    const [animOffset] = useState(() => Math.random() * Math.PI * 2);
    const [freqMult] = useState(() => 0.8 + Math.random() * 0.4);

    const shouldAnimate = useMemo(() =>
        ['tree', 'deciduous_tree', 'shrub', 'grass'].includes(type),
    [type]);

    useFrame((state) => {
        if (!shouldAnimate || !groupRef.current) return;

        const time = state.clock.elapsedTime;
        const baseFrequency = 1;
        const baseAmplitude = 0.05;
        if (groupRef.current) {
            groupRef.current.rotation.x = Math.sin(time * baseFrequency * freqMult + animOffset) * baseAmplitude;
            groupRef.current.rotation.z = Math.cos(time * baseFrequency * freqMult * 0.9 + animOffset * 1.1) * baseAmplitude * 0.8;
            groupRef.current.rotation.y = 0;
        }
    });

    const handlePointerDown = useCallback((e) => {
        // Let event bubble up to Experience/Canvas handler
        onPointerDown(e, objectId, type);
        onSelect();
    }, [onPointerDown, objectId, type, onSelect]);

    // Apply selection highlight conditionally (could be complex geometry later)
    const selectionHighlight = isSelected ? (
         // Simple box based on rough combined height/width for now
         // This might need refinement per object type if bounding boxes differ significantly
        <Box args={[0.8, 1.5, 0.8]} position={[0, 0.75, 0]} >
            <meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false} wireframe={false} />
        </Box>
    ) : null;


    return (
        <group ref={groupRef} position={position} onPointerDown={handlePointerDown}>
             {selectionHighlight}
            {children}
        </group>
    );
};


// --- Specific Object Components ---

export const Tree = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1,
    // Editable properties with defaults
    trunkColor = "#8B4513",
    foliageColor = "#2E7D32",
    maxTrunkHeight = 0.8,
    maxFoliageHeight = 1.2,
    maxFoliageRadius = 0.5
}) => {
    const currentTrunkHeight = lerp(0.1, maxTrunkHeight, globalAge);
    const currentFoliageHeight = lerp(0.1, maxFoliageHeight, globalAge);
    const currentFoliageRadius = lerp(0.05, maxFoliageRadius, globalAge);

    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="tree">
            {/* Trunk */}
            <mesh position={[0, currentTrunkHeight / 2, 0]} scale={[1, currentTrunkHeight / maxTrunkHeight || 0.01, 1]} castShadow>
                <cylinderGeometry args={[0.15, 0.2, maxTrunkHeight, 8]} />
                <meshStandardMaterial color={trunkColor} /> {/* Use prop color */}
            </mesh>
            {/* Foliage */}
            <mesh position={[0, currentTrunkHeight + currentFoliageHeight / 2 - 0.05, 0]} scale={[currentFoliageRadius / maxFoliageRadius || 0.01, currentFoliageHeight / maxFoliageHeight || 0.01, currentFoliageRadius / maxFoliageRadius || 0.01]} castShadow>
                <coneGeometry args={[maxFoliageRadius, maxFoliageHeight, 16]} />
                <meshStandardMaterial color={foliageColor} /> {/* Use prop color */}
            </mesh>
        </ObjectBase>
    );
});

Tree.editorSchema = [
    { name: 'maxTrunkHeight', label: 'Trunk H', type: 'number', step: 0.1, min: 0.1, max: 5, defaultValue: 0.8 },
    { name: 'maxFoliageHeight', label: 'Foliage H', type: 'number', step: 0.1, min: 0.1, max: 5, defaultValue: 1.2 },
    { name: 'maxFoliageRadius', label: 'Foliage R', type: 'number', step: 0.1, min: 0.1, max: 3, defaultValue: 0.5 },
    { name: 'trunkColor', label: 'Trunk Clr', type: 'color', defaultValue: "#8B4513" },
    { name: 'foliageColor', label: 'Foliage Clr', type: 'color', defaultValue: "#2E7D32" },
];

export const Shrub = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1,
    // Editable properties
    color = "#556B2F",
    maxRadius = 0.4,
    currentMonth = 6
}) => {
    const currentRadius = lerp(0.1, maxRadius, globalAge);
    
    const isWinter = useMemo(() => currentMonth >= 11 || currentMonth <= 3, [currentMonth]);
    const isSpring = useMemo(() => currentMonth >= 4 && currentMonth <= 5, [currentMonth]);

    const materialProps = useMemo(() => {
        if (isWinter) {
            return { color: "#A08C7B", transparent: true, opacity: 0.35 }; // Bare branches look
        } else if (isSpring) {
            return { color: "#E57373", transparent: false, opacity: 1.0 }; // Reddish spring foliage
        } else {
            return { color: color, transparent: false, opacity: 1.0 }; // Default color
        }
    }, [isWinter, isSpring, color]);

    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="shrub">
            <mesh position={[0, currentRadius, 0]} scale={[currentRadius / maxRadius || 0.01, currentRadius / maxRadius || 0.01, currentRadius / maxRadius || 0.01]} castShadow>
                <sphereGeometry args={[maxRadius, 16, 12]} />
                <meshStandardMaterial color={color} roughness={0.9} {...materialProps} /> {/* Use prop color */}
            </mesh>
        </ObjectBase>
    );
});

// Define what's editable for a Shrub
Shrub.editorSchema = [
    { name: 'maxRadius', label: 'Radius', type: 'number', step: 0.1, min: 0.1, max: 2.5, defaultValue: 0.4 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: "#556B2F" },
];


// --- NEW Grass Component using InstancedMesh ---
const MAX_GRASS_BLADES = 100; // Performance limit

export const Grass = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1,
    // Parameters with defaults
    baseDiameter = 0.5,
    length = 0.3,
    bottomColor = "#224411",
    topColor = "#66AA44",
    colorRatio = 0.5,
    density = 50,
    straightness = 0.7,
    currentMonth = 6
 }) => {

    const instancedMeshRef = useRef();
    const baseBladeWidth = 0.025; // Width of a single blade plane

    // Memoize geometry and material
    const [geometry, material] = useMemo(() => {
        // Use PlaneGeometry for a single blade (width, height)
        const geom = new THREE.PlaneGeometry(baseBladeWidth, 1, 1, 1); // Height is 1 initially, scaled later
        // Translate geometry so the pivot (origin) is at the bottom center
        geom.translate(0, 0.5, 0);

        // Ensure geometry has vertex colors attribute
        if (!geom.attributes.color) {
            const vertexCount = geom.attributes.position.count;
            geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
        }

        // Material that uses vertex colors and is double-sided
        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8, // More matte appearance for grass
            metalness: 0.05,
            side: THREE.DoubleSide, // Render both sides of the plane
            shadowSide: THREE.DoubleSide // Allow shadows on both sides if needed
        });
        return [geom, mat];
    }, []); // Recreate only if baseBladeWidth changes (which it doesn't here)

    // Calculate instance count based on density
    const count = useMemo(() => {
        const area = Math.PI * (baseDiameter / 2) ** 2;
        return Math.min(MAX_GRASS_BLADES, Math.max(1, Math.floor(density * area * 150))); // Adjust multiplier for visual density
    }, [density, baseDiameter]);

    const [seasonalBottomColor, seasonalTopColor] = useMemo(() => {
        const isWinter = currentMonth >= 11 || currentMonth <= 3;
        if (isWinter) {
            return ["#BDB76B", "#CDC08C"]; // Yellowish/brown winter colors
        } else {
            // Use the editable prop colors for other seasons
            return [bottomColor, topColor];
        }
    }, [currentMonth, bottomColor, topColor]);

    // Effect to update vertex colors when color props change
    useEffect(() => {
        if (!geometry || !geometry.attributes.color) return;

        const colors = geometry.attributes.color.array;
        const positions = geometry.attributes.position.array;
        const bColor = tempColor.set(seasonalBottomColor);
        const tColor = tempColor.set(seasonalTopColor);
        const finalColor = new THREE.Color();
        const vertexCount = geometry.attributes.position.count;

        for (let i = 0; i < vertexCount; i++) {
            const yPosIndex = i * 3 + 1; // Index for the Y coordinate
            // Normalized Y position (0 at bottom, 1 at top because base geometry height is 1)
            const normalizedY = positions[yPosIndex];

            // Adjust lerp factor based on colorRatio (power makes transition sharper/softer)
            const lerpFactor = Math.pow(normalizedY, 1.0 / (Math.max(0.1, colorRatio)));
            finalColor.lerpColors(bColor, tColor, lerpFactor);

            const colorIndex = i * 3;
            colors[colorIndex] = finalColor.r;
            colors[colorIndex + 1] = finalColor.g;
            colors[colorIndex + 2] = finalColor.b;
        }
        geometry.attributes.color.needsUpdate = true;
        // console.log("Updated grass vertex colors");

    }, [geometry, seasonalBottomColor, seasonalTopColor, colorRatio]);


    // Effect to update instance transforms when parameters change
    useLayoutEffect(() => {
        if (!instancedMeshRef.current) return;

        const mesh = instancedMeshRef.current;
        const maxRadius = baseDiameter / 2;
        const currentMaxLength = lerp(0.01, length, globalAge);

        for (let i = 0; i < count; i++) {
            // --- Position ---
            const radius = Math.sqrt(Math.random()) * maxRadius;
            const angle = Math.random() * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            tempObject.position.set(x, 0, z);

            // --- Rotation (Outward Tilt + Random Y) ---
            const randomYRotation = Math.random() * Math.PI * 0.3 - Math.PI * 0.15; // Smaller random twist
            const radialRatio = maxRadius > 0.01 ? radius / maxRadius : 0;
            const maxTilt = Math.PI / 2 * (1 - straightness); // 0 tilt if straightness=1, PI/2 if 0
            const tiltAngle = maxTilt * radialRatio; // Linear interpolation of tilt

            // Axis of tilt is perpendicular to the direction from center (same as before)
            const tiltAxis = tempObject.position.clone().cross(tempObject.up).normalize();
             // Handle case where position is exactly at origin (though unlikely with sqrt(random))
             if (tiltAxis.lengthSq() < 0.001) {
                 tiltAxis.set(1, 0, 0); // Default tilt axis if at center
             }

            // Combine rotations: First apply random Y rotation, then tilt outwards
            const quaternionY = new THREE.Quaternion().setFromAxisAngle(tempObject.up, randomYRotation);
            const quaternionTilt = new THREE.Quaternion().setFromAxisAngle(tiltAxis, -tiltAngle);
            tempObject.quaternion.multiplyQuaternions(quaternionTilt, quaternionY); // Apply Y first, then tilt

            // --- Scale ---
            const lengthFalloff = lerp(1.0, 0.75, radialRatio); // Outer blades are 75% length
            const finalLength = Math.max(0.01, currentMaxLength * lengthFalloff); // Ensure non-zero length
            tempObject.scale.set(1, finalLength, 1); // Scale only Y

            // --- Update Matrix ---
            tempObject.updateMatrix();
            mesh.setMatrixAt(i, tempObject.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();

    }, [count, baseDiameter, length, straightness, globalAge, geometry]); // Dependencies


    return (
         <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="grass">
            <instancedMesh
                ref={instancedMeshRef}
                args={[geometry, material, count]}
                castShadow
                receiveShadow
            />
        </ObjectBase>
    );
});

// Define what's editable for Grass, using new parameters
Grass.editorSchema = [
    { name: 'baseDiameter', label: 'Diameter', type: 'number', step: 0.05, min: 0.1, max: 2.0, defaultValue: 0.5 },
    { name: 'length', label: 'Length', type: 'number', step: 0.05, min: 0.05, max: 1.5, defaultValue: 0.3 },
    { name: 'density', label: 'Density', type: 'number', step: 5, min: 5, max: 200, defaultValue: 50 },
    { name: 'straightness', label: 'Straightness', type: 'number', step: 0.05, min: 0, max: 1, defaultValue: 0.7 },
    { name: 'bottomColor', label: 'Bottom Clr', type: 'color', defaultValue: "#224411" },
    { name: 'topColor', label: 'Top Clr', type: 'color', defaultValue: "#66AA44" },
    { name: 'colorRatio', label: 'Color Ratio', type: 'number', step: 0.05, min: 0.05, max: 1, defaultValue: 0.5 },
];

const MAX_BRANCHES = 10;
const MAX_FRUITS = 50;

export const DeciduousTree = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1, currentMonth = 6,
   // Trunk Properties
    trunkHeight = 1.0,
    trunkDiameter = 0.25,
    trunkColor = "#A0522D",
    // Branch Properties
    branchDensity = 40,  // Controls number of side branches
    branchLengthMax = 0.8, // Max length relative to foliage size
    branchDiameter = 0.08,
    branchColor = null,  // Optional different color (null uses trunkColor)
    // Foliage Properties
    foliageDiameter = 1.8, // Base diameter used for XZ scale
    foliageScaleXZ = 1.0, // Multiplier for X/Z foliage shape (1.0 = sphere)
    foliageScaleY = 1.0,  // Multiplier for Y foliage shape (1.0 = sphere)
    foliageColor = "#559040",
    foliageOpacity = 0.85,
    // Fruit Properties
    fruitType = 'apple',
    fruitDensity = 30,
}) => {

    const fruitMeshRef = useRef();
    const branchMeshRef = useRef();

    // --- Seasonal Calculations ---
    const isWinter = useMemo(() => currentMonth >= 12 || currentMonth <= 2, [currentMonth]); // Dec-Feb
    const isSpring = useMemo(() => currentMonth >= 3 && currentMonth <= 5, [currentMonth]); // Mar-May
    const isFall = useMemo(() => currentMonth >= 9 && currentMonth <= 11, [currentMonth]); // Sep-Nov
    const hasLeaves = !isWinter;
    const showFruit = useMemo(() => fruitType !== 'none' && isFall, [fruitType, isFall]);

    // --- Aged Dimensions ---
    const currentTrunkHeight = lerp(0.2, trunkHeight, globalAge);
    const currentTrunkDiameter = lerp(0.05, trunkDiameter, globalAge);
    // Base radius for calculating bounds, before scaling
    const baseFoliageRadius = foliageDiameter / 2;
    const currentFoliageRadiusXZ = lerp(0.15, baseFoliageRadius * foliageScaleXZ, globalAge);
    const currentFoliageRadiusY = lerp(0.15, baseFoliageRadius * foliageScaleY, globalAge);
    const currentBranchLengthMax = lerp(0.1, branchLengthMax, globalAge);
    const currentBranchDiameter = lerp(0.01, branchDiameter, globalAge);

    // --- Foliage Appearance ---
    const currentFoliageColor = useMemo(() => {
        if (isSpring) return "#90EE90"; // Light green
        if (isFall) return "#FFA500"; // Orange/Yellow
        return foliageColor; // Summer or default
    }, [isSpring, isFall, foliageColor]);
    const foliageCenterY = currentTrunkHeight * 0.8 + currentFoliageRadiusY;

        // --- Branch Geometry & Material ---
    const [branchGeometry, branchMaterial] = useMemo(() => {
        // Cylinder: radiusTop, radiusBottom, height, radialSegments
        const geom = new THREE.CylinderGeometry(branchDiameter * 0.5, branchDiameter * 0.7, 1, 5); // Height=1 for scaling
        geom.translate(0, 0.5, 0); // Pivot at bottom center
        const mat = new THREE.MeshStandardMaterial({ color: branchColor || trunkColor });
        return [geom, mat];
    }, [branchDiameter, branchColor, trunkColor]); // Recreate if base diameter/colors change

    // --- Branch Instancing ---
    const branchCount = useMemo(() => {
        // Density relates to approximate foliage surface area
        const approxSurfaceArea = 4 * Math.PI * Math.pow((currentFoliageRadiusXZ + currentFoliageRadiusY) / 2, 2); // Avg radius sphere area
        return Math.min(MAX_BRANCHES, Math.max(0, Math.floor(branchDensity * approxSurfaceArea * 0.5))); // Adjust multiplier
    }, [branchDensity, currentFoliageRadiusXZ, currentFoliageRadiusY]);

    useLayoutEffect(() => {
        if (!branchMeshRef.current || !branchGeometry || branchCount === 0) return;
        const mesh = branchMeshRef.current;

        // Branches start near the top part of the trunk
        const branchStartY = currentTrunkHeight * 0.7;
        const branchHeightRange = currentTrunkHeight * 0.25; // Vertical range along trunk where branches originate

        for (let i = 0; i < branchCount; i++) {
            // --- Starting Position on Trunk ---
            const yStart = branchStartY + Math.random() * branchHeightRange;
            // Slight offset from center for start point (less for thinner trunks)
            const startOffsetRadius = currentTrunkDiameter * 0.1 * Math.random();
            const startAngle = Math.random() * Math.PI * 2;
            const xStart = Math.cos(startAngle) * startOffsetRadius;
            const zStart = Math.sin(startAngle) * startOffsetRadius;
            tempObject.position.set(xStart, yStart, zStart);

            // --- Direction & Length ---
            // Point towards a random spot on the surface of the scaled foliage ellipsoid
            const phi = Math.acos(2 * Math.random() - 1); // Elevation angle
            const theta = Math.random() * Math.PI * 2;   // Azimuth angle

            // Calculate point on surface of ellipsoid (radius varies with angle phi)
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);
            const rXZ = currentFoliageRadiusXZ; // Radius in XZ plane at height y
            const rY = currentFoliageRadiusY;   // Radius along Y axis

            // Simplified target point calculation (can be improved for perfect ellipsoid)
            const targetX = rXZ * sinPhi * Math.cos(theta);
            const targetY = rY * cosPhi; // Relative to foliage center
            const targetZ = rXZ * sinPhi * Math.sin(theta);

            // Direction vector from branch start to target point (relative to tree origin)
            const direction = tempVec.set(targetX, targetY + foliageCenterY - yStart, targetZ).normalize();

            // Calculate length: extend towards target, max length based on prop, add randomness
            const branchLength = currentBranchLengthMax * (0.6 + Math.random() * 0.4);
            tempObject.scale.set(1, branchLength, 1); // Scale height

            // --- Rotation ---
            // Align branch (Y-axis of geometry) with the calculated direction
            tempObject.quaternion.setFromUnitVectors(Y_AXIS, direction);
            // Add slight random roll around branch axis (optional)
            const rollAngle = Math.random() * Math.PI * 0.2 - Math.PI * 0.1;
            tempQuaternion.setFromAxisAngle(direction, rollAngle);
            tempObject.quaternion.multiply(tempQuaternion);


            // --- Update Matrix ---
            tempObject.updateMatrix();
            mesh.setMatrixAt(i, tempObject.matrix);
        }
        mesh.count = branchCount;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        // Update material color
        if (mesh.material) { mesh.material.color.set(branchColor || trunkColor); }

    }, [branchCount, currentTrunkHeight, currentTrunkDiameter, currentFoliageRadiusXZ, currentFoliageRadiusY, foliageCenterY, currentBranchLengthMax, branchGeometry, branchColor, trunkColor]); // Dependencies

    // --- Fruit Appearance ---
    const [fruitGeometry, fruitMaterial, fruitScale] = useMemo(() => {
        let geom;
        let color;
        let scale = 1.0;
        switch (fruitType) {
            case 'pear':
                // Pear shape is hard with primitives, use sphere + maybe small cone? Or just sphere.
                geom = new THREE.SphereGeometry(0.05, 8, 6); // Small sphere for pear
                color = "#D1E231"; // Yellow-green
                scale = 1;
                break;
            case 'plum':
                geom = new THREE.SphereGeometry(0.04, 8, 6); // Slightly smaller sphere for plum
                color = "#6A0DAD"; // Purple
                scale = 0.5;
                break;
            case 'apple':
            default:
                geom = new THREE.SphereGeometry(0.045, 8, 6); // Sphere for apple
                color = "#FF6347"; // Tomato red
                scale = 1.5;
                break;
        }
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
        return [geom, mat, scale];
    }, [fruitType]);

    // --- Fruit Instancing ---
    const fruitCount = useMemo(() => {
        // Only calculate if fruits should be shown based on props and season
         if (!showFruit) return 0;

         // Approximate the volume of the foliage ellipsoid
         // Volume of ellipsoid = (4/3) * PI * a * b * c
         // Here, a = c = currentFoliageRadiusXZ, b = currentFoliageRadiusY
         const volume = (4 / 3) * Math.PI * currentFoliageRadiusXZ * currentFoliageRadiusY * currentFoliageRadiusXZ;

         // Calculate count based on density and volume
         // Adjust the final multiplier (e.g., 0.5) to get the desired visual density
         const calculatedCount = Math.floor(fruitDensity * volume * 0.5);

         // Clamp the count between 0 and MAX_FRUITS
         return Math.min(MAX_FRUITS, Math.max(0, calculatedCount));

    // Depend on parameters affecting fruit presence and volume
    }, [showFruit, fruitDensity, currentFoliageRadiusXZ, currentFoliageRadiusY]);

    useLayoutEffect(() => { // Fruit position effect
        if (!showFruit || !fruitMeshRef.current || fruitCount === 0) { if(fruitMeshRef.current) fruitMeshRef.current.count = 0; return; };
        const mesh = fruitMeshRef.current;

        for (let i = 0; i < fruitCount; i++) {
            // Position randomly near the surface of the foliage ellipsoid
            const phi = Math.acos(2 * Math.random() - 1); const theta = Math.random() * Math.PI * 2;
            // Point on surface
            const rSurfaceXZ = currentFoliageRadiusXZ;
            const rSurfaceY = currentFoliageRadiusY;
            const xSurf = rSurfaceXZ * Math.sin(phi) * Math.cos(theta);
            const ySurf = rSurfaceY * Math.cos(phi);
            const zSurf = rSurfaceXZ * Math.sin(phi) * Math.sin(theta);
             // Add slight random offset inwards/outwards from surface
             const offsetFactor = 1.0 + (Math.random() * 0.2 - 0.1); // e.g., 0.9 to 1.1

            tempObject.position.set(
                xSurf * offsetFactor,
                ySurf * offsetFactor + foliageCenterY, // Offset from foliage center
                zSurf * offsetFactor
            );

            tempObject.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            tempObject.scale.setScalar(fruitScale);
            tempObject.updateMatrix(); mesh.setMatrixAt(i, tempObject.matrix);
        }
        mesh.count = fruitCount; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();

    }, [showFruit, fruitCount, currentFoliageRadiusXZ, currentFoliageRadiusY, foliageCenterY, fruitGeometry, fruitScale]); // Use scaled radii

    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="deciduous_tree">
            {/* Single Main Trunk */}
            <mesh position={[0, currentTrunkHeight / 2, 0]} scale={[currentTrunkDiameter / trunkDiameter || 0.01, currentTrunkHeight / trunkHeight || 0.01, currentTrunkDiameter / trunkDiameter || 0.01]} castShadow>
                <cylinderGeometry args={[trunkDiameter * 0.4, trunkDiameter * 0.5, trunkHeight, 8]} />
                <meshStandardMaterial color={trunkColor} />
            </mesh>

            {branchCount > 0 && (
                 <instancedMesh ref={branchMeshRef} args={[branchGeometry, branchMaterial, branchCount]} castShadow receiveShadow />
            )}

            {/* Foliage - Scaled sphere (ellipsoid) */}
            {hasLeaves && (
                 <mesh position={[0, foliageCenterY, 0]} scale={[currentFoliageRadiusXZ*2, currentFoliageRadiusY*2, currentFoliageRadiusXZ*2]} castShadow> {/* Scale sphere geometry */}
                    <sphereGeometry args={[0.5, 12, 8]} />{/* Base radius 0.5 */}
                    <meshStandardMaterial color={currentFoliageColor} roughness={0.8} metalness={0.1} transparent={true} opacity={foliageOpacity} depthWrite={foliageOpacity > 0.95} />
                </mesh>
            )}
             {/* Fruits - Instanced Mesh */}
             {showFruit && fruitCount > 0 && (
                <instancedMesh
                    ref={fruitMeshRef}
                    args={[fruitGeometry, fruitMaterial, fruitCount]}
                    castShadow
                />
             )}
        </ObjectBase>
    );
});

// Define what's editable for DeciduousTree
DeciduousTree.editorSchema = [
    { name: 'trunkHeight', label: 'Trunk H', type: 'number', step: 0.1, min: 0.2, max: 5, defaultValue: 1.0 },
    { name: 'trunkDiameter', label: 'Trunk Ø', type: 'number', step: 0.05, min: 0.05, max: 1.5, defaultValue: 0.25 },
    { name: 'branchDensity', label: 'Branch Density', type: 'number', step: 1, min: 0, max: 100, defaultValue: 40 },
    { name: 'branchLengthMax', label: 'Branch Length', type: 'number', step: 0.05, min: 0.1, max: 1.5, defaultValue: 0.8 },
    { name: 'branchDiameter', label: 'Branch Ø', type: 'number', step: 0.01, min: 0.01, max: 0.5, defaultValue: 0.08 },
    { name: 'foliageDiameter', label: 'Foliage Base Ø', type: 'number', step: 0.1, min: 0.3, max: 6, defaultValue: 1.8 },
    { name: 'foliageScaleXZ', label: 'Foliage Scale XZ', type: 'number', step: 0.05, min: 0.2, max: 2.0, defaultValue: 1.0 },
    { name: 'foliageScaleY', label: 'Foliage Scale Y', type: 'number', step: 0.05, min: 0.2, max: 2.0, defaultValue: 1.0 },
    { name: 'foliageOpacity', label: 'Foliage Opacity', type: 'number', step: 0.05, min: 0.1, max: 1.0, defaultValue: 0.85 },
    { name: 'fruitDensity', label: 'Fruit Density', type: 'number', step: 1, min: 0, max: 100, defaultValue: 30 },
    { name: 'trunkColor', label: 'Trunk Clr', type: 'color', defaultValue: "#A0522D" },
    { name: 'branchColor', label: 'Branch Clr', type: 'color', defaultValue: null }, // Allow separate branch color
    { name: 'foliageColor', label: 'Summer Clr', type: 'color', defaultValue: "#559040" },
    { name: 'fruitType', label: 'Fruit Type', type: 'select', options: ['apple', 'pear', 'plum', 'none'], defaultValue: 'apple' },
];

export const Hedge = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1,
    width = 0.5, length = 1.5, height = 0.8, color = "#3A5F0B" // Dark Hedge Green
}) => {
    // Apply aging to height/width/length? Maybe just height for simplicity.
    const currentHeight = lerp(0.1, height, globalAge);
    const currentWidth = lerp(0.1, width, globalAge);
    const currentLength = lerp(0.2, length, globalAge);

    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="hedge">
             <mesh position={[0, currentHeight / 2, 0]} scale={[currentLength, currentHeight, currentWidth]} castShadow receiveShadow> {/* Map L,H,W to X,Y,Z scale */}
                 <boxGeometry args={[1, 1, 1]} />
                 <meshStandardMaterial color={color} roughness={0.9} />
             </mesh>
        </ObjectBase>
    );
});
Hedge.editorSchema = [
    { name: 'length', label: 'Length (X)', type: 'number', step: 0.1, min: 0.2, max: 10, defaultValue: 1.5 },
    { name: 'width', label: 'Width (Z)', type: 'number', step: 0.1, min: 0.2, max: 5, defaultValue: 0.5 },
    { name: 'height', label: 'Height (Y)', type: 'number', step: 0.1, min: 0.1, max: 3, defaultValue: 0.8 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: "#3A5F0B" },
];

// Stepping Stone
export const SteppingStone = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1, // Age unlikely to affect stone
    diameter = 0.4, height = 0.05, color = "#808080" // Grey
}) => {
    // No aging applied to dimensions
    return (
        <ObjectBase position={[position[0], position[1] + height/2, position[2]]} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="stepping_stone">
            <mesh castShadow={false} receiveShadow> {/* Stones often don't cast strong shadows */}
                 <cylinderGeometry args={[diameter / 2, diameter / 2, height, 12]} /> {/* TopRad, BotRad, H, Segs */}
                 <meshStandardMaterial color={color} roughness={0.8} metalness={0.1}/>
             </mesh>
        </ObjectBase>
    );
});
SteppingStone.editorSchema = [
    { name: 'diameter', label: 'Diameter', type: 'number', step: 0.05, min: 0.1, max: 1.5, defaultValue: 0.4 },
    { name: 'height', label: 'Thickness', type: 'number', step: 0.01, min: 0.02, max: 0.2, defaultValue: 0.05 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: "#808080" },
];

// Raised Bed
export const RaisedBed = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1,
    width = 0.8, length = 1.5, height = 0.3,
    frameColor = "#8B4513", // Brown wood color
    soilColor = "#5C4033" // Dark brown soil
}) => {
    const frameThickness = 0.05; // Thickness of the bed walls
    const soilHeightOffset = -0.03; // How far below the top edge the soil starts

    // Calculate inner dimensions for soil
    const soilLength = length - frameThickness * 2;
    const soilWidth = width - frameThickness * 2;
    const soilHeight = height + soilHeightOffset; // Make soil slightly shorter than frame

    return (
        // Use ObjectBase for selection/interaction, position base correctly
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="raised_bed">
            {/* Frame using Box helper for simplicity? Or manual mesh */}
             {/* We need 4 walls and potentially a bottom, Box helper isn't ideal. Let's use meshes. */}
             {/* Front/Back Walls */}
             <mesh position={[0, height/2, width/2 - frameThickness/2]} scale={[length, height, frameThickness]} castShadow receiveShadow>
                <boxGeometry args={[1,1,1]}/>
                <meshStandardMaterial color={frameColor} />
             </mesh>
             <mesh position={[0, height/2, -width/2 + frameThickness/2]} scale={[length, height, frameThickness]} castShadow receiveShadow>
                <boxGeometry args={[1,1,1]}/>
                <meshStandardMaterial color={frameColor} />
             </mesh>
             {/* Left/Right Walls */}
              <mesh position={[length/2 - frameThickness/2, height/2, 0]} scale={[frameThickness, height, width - frameThickness*2]} castShadow receiveShadow> {/* Adjusted width */}
                <boxGeometry args={[1,1,1]}/>
                <meshStandardMaterial color={frameColor} />
             </mesh>
             <mesh position={[-length/2 + frameThickness/2, height/2, 0]} scale={[frameThickness, height, width - frameThickness*2]} castShadow receiveShadow> {/* Adjusted width */}
                <boxGeometry args={[1,1,1]}/>
                <meshStandardMaterial color={frameColor} />
             </mesh>

            {/* Soil */}
            {soilHeight > 0.01 && soilLength > 0 && soilWidth > 0 && ( // Only render if dimensions are valid
                <mesh position={[0, soilHeight / 2, 0]} scale={[soilLength, soilHeight, soilWidth]} receiveShadow> {/* Position slightly below top */}
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color={soilColor} roughness={0.9} metalness={0.05} />
                </mesh>
            )}
        </ObjectBase>
    );
});
RaisedBed.editorSchema = [
    { name: 'length', label: 'Length (X)', type: 'number', step: 0.1, min: 0.3, max: 5, defaultValue: 1.5 },
    { name: 'width', label: 'Width (Z)', type: 'number', step: 0.1, min: 0.3, max: 3, defaultValue: 0.8 },
    { name: 'height', label: 'Height (Y)', type: 'number', step: 0.05, min: 0.1, max: 1, defaultValue: 0.3 },
    { name: 'frameColor', label: 'Frame Color', type: 'color', defaultValue: "#8B4513" },
    { name: 'soilColor', label: 'Soil Color', type: 'color', defaultValue: "#5C4033" },
];

// Car (Simplified Box Model)
export const Car = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1, // Age doesn't affect car
    bodyLength = 5, bodyWidth = 2, bodyHeight = 1.5,
    roofHeight = 0.5, roofOffset = 0.1,
    wheelRadius = 0.18, wheelWidth = 0.1,
    color = "#B0C4DE" // Light Steel Blue
}) => {
    const wheelY = wheelRadius; // Place wheels touching ground
    const bodyY = wheelRadius + bodyHeight / 2;
    const roofY = wheelRadius + bodyHeight + roofHeight / 2;
    const wheelOffsetX = bodyLength * 0.35;
    const wheelOffsetZ = (bodyWidth / 2) + (wheelWidth / 2);

    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="car">
            {/* Body */}
            <mesh position={[0, bodyY, 0]} castShadow receiveShadow>
                <boxGeometry args={[bodyLength, bodyHeight, bodyWidth]} />
                <meshStandardMaterial color={color} metalness={0.3} roughness={0.4}/>
            </mesh>
            {/* Roof */}
            <mesh position={[roofOffset, roofY, 0]} castShadow receiveShadow>
                 <boxGeometry args={[bodyLength * 0.6, roofHeight, bodyWidth * 0.9]} />
                 <meshStandardMaterial color={color} metalness={0.3} roughness={0.4}/>
            </mesh>
             {/* Wheels */}
             {[
                {x: wheelOffsetX, z: wheelOffsetZ}, {x: wheelOffsetX, z: -wheelOffsetZ},
                {x: -wheelOffsetX, z: wheelOffsetZ}, {x: -wheelOffsetX, z: -wheelOffsetZ}
             ].map((pos, i) => (
                 <mesh key={i} position={[pos.x, wheelY, pos.z]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
                    <cylinderGeometry args={[wheelRadius, wheelRadius, wheelWidth, 16]} />
                    <meshStandardMaterial color="#333333" metalness={0.1} roughness={0.6}/>
                </mesh>
             ))}
        </ObjectBase>
    );
});
Car.editorSchema = [
    { name: 'color', label: 'Color', type: 'color', defaultValue: "#B0C4DE" },
    { name: 'bodyLength', label: 'Length', type: 'number', step: 0.1, min: 3, max: 6, defaultValue: 4.5 },
    { name: 'bodyWidth', label: 'Width', type: 'number', step: 0.1, min: 1.5, max: 3, defaultValue: 1.8 },
    { name: 'bodyHeight', label: 'Body Height', type: 'number', step: 0.05, min: 0.3, max: 1.0, defaultValue: 0.6 },
    // Add other car params if needed (wheel size etc.)
];

// Garden Light
export const GardenLight = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1, // Age unlikely to affect light
    postHeight = 0.6, postDiameter = 0.04, fixtureRadius = 0.06,
    lightColor = "#FFFFE0", // Light Yellow
    lightIntensity = 1.5, // PointLight intensity
    lightRange = 3.0 // PointLight distance/range
}) => {
    const lightFixtureY = postHeight + fixtureRadius * 0.5;
    const pointLightY = postHeight + fixtureRadius * 0.2; // Position light source slightly below visual fixture top

    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="garden_light">
            {/* Post */}
            <mesh position={[0, postHeight / 2, 0]} castShadow>
                 <cylinderGeometry args={[postDiameter / 2, postDiameter / 2, postHeight, 8]} />
                 <meshStandardMaterial color="#444444" metalness={0.6} roughness={0.4}/>
            </mesh>
            {/* Fixture */}
             <mesh position={[0, lightFixtureY, 0]} castShadow>
                 <sphereGeometry args={[fixtureRadius, 12, 8]} />
                 <meshStandardMaterial color="#AAAAAA" metalness={0.3} roughness={0.5}/>
            </mesh>
            {/* Point Light Source */}
            <pointLight
                position={[0, pointLightY, 0]} // Position relative to the object group
                color={lightColor}
                intensity={lightIntensity}
                distance={lightRange} // Range of the light
                decay={2} // Realistic decay
                castShadow={false} // Performance: disable shadows for small lights
            />
        </ObjectBase>
    );
});
GardenLight.editorSchema = [
    { name: 'postHeight', label: 'Post Height', type: 'number', step: 0.05, min: 0.2, max: 2.0, defaultValue: 0.6 },
    { name: 'postDiameter', label: 'Post Ø', type: 'number', step: 0.01, min: 0.02, max: 0.15, defaultValue: 0.04 },
    { name: 'fixtureRadius', label: 'Fixture Ø', type: 'number', step: 0.01, min: 0.03, max: 0.2, defaultValue: 0.06 },
    { name: 'lightColor', label: 'Light Color', type: 'color', defaultValue: "#FFFFE0" },
    { name: 'lightIntensity', label: 'Intensity', type: 'number', step: 0.1, min: 0, max: 5, defaultValue: 1.5 },
    { name: 'lightRange', label: 'Range', type: 'number', step: 0.1, min: 0, max: 10, defaultValue: 3.0 },
];

// --- Map of Components and Schemas for easy lookup ---
export const ObjectComponents = {
    tree: Tree,
    deciduous_tree: DeciduousTree,
    shrub: Shrub,
    grass: Grass,
    
    hedge: Hedge,
    stepping_stone: SteppingStone,
    raised_bed: RaisedBed,
    car: Car,
    garden_light: GardenLight,
};

    
export const ObjectEditorSchemas = {
    tree: Tree.editorSchema,
    deciduous_tree: DeciduousTree.editorSchema,
    shrub: Shrub.editorSchema,
    grass: Grass.editorSchema,
    
    hedge: Hedge.editorSchema,
    stepping_stone: SteppingStone.editorSchema,
    raised_bed: RaisedBed.editorSchema,
    car: Car.editorSchema,
    garden_light: GardenLight.editorSchema,
};

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
];
