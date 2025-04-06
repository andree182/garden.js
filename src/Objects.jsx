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

// --- ObjectBase: Wrapper with common logic (selection, animation, pointer down) ---
export const ObjectBase = ({ children, position, isSelected, onSelect, onPointerDown, objectId, type }) => {
    const groupRef = useRef();
    const [animOffset] = useState(() => Math.random() * Math.PI * 2);
    const [freqMult] = useState(() => 0.8 + Math.random() * 0.4);

    useFrame((state) => {
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
    maxRadius = 0.4
}) => {
    const currentRadius = lerp(0.1, maxRadius, globalAge);
    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="shrub">
            <mesh position={[0, currentRadius, 0]} scale={[currentRadius / maxRadius || 0.01, currentRadius / maxRadius || 0.01, currentRadius / maxRadius || 0.01]} castShadow>
                <sphereGeometry args={[maxRadius, 16, 12]} />
                <meshStandardMaterial color={color} roughness={0.9} /> {/* Use prop color */}
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
    // New parameters with defaults
    baseDiameter = 0.5, // Overall width of the grass patch
    length = 0.3,       // Max length of blades (center)
    bottomColor = "#224411", // Darker green base
    topColor = "#66AA44",   // Lighter green tip
    colorRatio = 0.5,   // 0 = mostly bottom, 1 = mostly top
    density = 50,       // Arbitrary density factor (adjust multiplier below)
    straightness = 0.7  // 0 = flat outwards, 1 = straight up
 }) => {

    const instancedMeshRef = useRef();
    const baseBladeWidth = 0.02; // Width of a single blade box

    // Memoize geometry and material
    const [geometry, material] = useMemo(() => {
        // Simple box geometry for a single blade
        const geom = new THREE.BoxGeometry(baseBladeWidth, 1, baseBladeWidth); // Height is 1 initially, scaled later
        geom.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.5, 0)); // Pivot at bottom center
        // Material that uses vertex colors
        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.7,
            metalness: 0.1,
            side: THREE.DoubleSide // Render both sides
        });
        return [geom, mat];
    }, []);

    // Calculate instance count based on density
    const count = useMemo(() => {
        const area = Math.PI * (baseDiameter / 2) ** 2;
        // Adjust the multiplier '150' based on desired visual density
        return Math.min(MAX_GRASS_BLADES, Math.max(1, Math.floor(density * area * 150)));
    }, [density, baseDiameter]);

    // Effect to update vertex colors when color props change
    useEffect(() => {
        if (!geometry) return;

        const colorAttrib = geometry.attributes.position.clone(); // Use position attribute structure
        geometry.setAttribute('color', colorAttrib); // Add color attribute if not present

        const colors = geometry.attributes.color.array;
        const positions = geometry.attributes.position.array;
        const bColor = tempColor.set(bottomColor);
        const tColor = tempColor.set(topColor);
        const finalColor = new THREE.Color();

        for (let i = 0; i < positions.length; i += 3) {
            // Y position is at index i+1, normalized (0 to 1 because base geometry height is 1)
            const normalizedY = positions[i + 1];
            // Lerp color based on normalized height and colorRatio
            // Adjust lerp factor: 0 means use bottomColor, 1 means use topColor
            const lerpFactor = Math.pow(normalizedY, 1.0 / (Math.max(0.1, colorRatio))); // Exponential interpolation based on ratio
            finalColor.lerpColors(bColor, tColor, lerpFactor);

            colors[i] = finalColor.r;
            colors[i + 1] = finalColor.g;
            colors[i + 2] = finalColor.b;
        }
        geometry.attributes.color.needsUpdate = true;
        console.log("Updated grass vertex colors");

    }, [geometry, bottomColor, topColor, colorRatio]);


    // Effect to update instance transforms when parameters change
    useLayoutEffect(() => {
        if (!instancedMeshRef.current) return;

        const mesh = instancedMeshRef.current;
        const maxRadius = baseDiameter / 2;
        const currentMaxLength = lerp(0.01, length, globalAge); // Apply aging to max length

        for (let i = 0; i < count; i++) {
            // --- Position ---
            const radius = Math.sqrt(Math.random()) * maxRadius; // Distribute within circle area
            const angle = Math.random() * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            tempObject.position.set(x, 0, z); // Position relative to the group center

            // --- Rotation ---
            const randomYRotation = Math.random() * Math.PI * 0.5 - Math.PI * 0.25; // Slight random twist
            // Calculate tilt based on straightness and distance from center
            const radialRatio = maxRadius > 0.01 ? radius / maxRadius : 0; // Avoid division by zero
            const maxTilt = Math.PI / 2 * (1 - straightness); // 0 tilt if straightness=1, PI/2 if straightness=0
            const tiltAngle = maxTilt * radialRatio; // Linear interpolation of tilt

            // Calculate tilt axis (perpendicular to the direction from center)
            const tiltAxis = new THREE.Vector3(-z, 0, x).normalize(); // Axis is perpendicular to (x,0,z) vector

            // Combine random Y rotation and tilt
            const quaternionY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), randomYRotation);
            const quaternionTilt = new THREE.Quaternion().setFromAxisAngle(tiltAxis, tiltAngle);
            tempObject.quaternion.multiplyQuaternions(quaternionY, quaternionTilt); // Apply tilt first, then random Y? Or vice versa? Let's try Y first.
            // tempObject.quaternion.multiplyQuaternions(quaternionTilt, quaternionY); // Apply random Y first

            // --- Scale ---
            const lengthFalloff = lerp(1.0, 0.75, radialRatio); // Outer blades are shorter
            const finalLength = currentMaxLength * lengthFalloff;
            tempObject.scale.set(1, finalLength, 1); // Scale only Y based on calculated length (base geometry height is 1)

            // --- Update Matrix ---
            tempObject.updateMatrix();
            mesh.setMatrixAt(i, tempObject.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere(); // Update bounds after transforms change

    }, [count, baseDiameter, length, straightness, globalAge, geometry]); // Dependencies that affect transforms


    return (
         <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="grass">
            <instancedMesh
                ref={instancedMeshRef}
                args={[geometry, material, count]} // Use memoized geom/mat
                castShadow // Blades can cast shadows
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


// --- Map of Components and Schemas for easy lookup ---
export const ObjectComponents = { tree: Tree, shrub: Shrub, grass: Grass };
export const ObjectEditorSchemas = {
    tree: Tree.editorSchema,
    shrub: Shrub.editorSchema,
    grass: Grass.editorSchema,
};
