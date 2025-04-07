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


// --- Map of Components and Schemas for easy lookup ---
export const ObjectComponents = { tree: Tree, shrub: Shrub, grass: Grass };

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
        name: "Oak Tree (Wide)",
        type: "tree",
        props: {
            maxTrunkHeight: 0.7, maxFoliageHeight: 1.8, maxFoliageRadius: 1.4,
            foliageColor: "#556B2F", trunkColor: "#8B4513"
        }
    },
    {
        name: "Default Tree", // Keep the original default
        type: "tree",
        props: {} // Will use all defaults from schema
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
];

export const ObjectEditorSchemas = {
    tree: Tree.editorSchema,
    shrub: Shrub.editorSchema,
    grass: Grass.editorSchema,
};
