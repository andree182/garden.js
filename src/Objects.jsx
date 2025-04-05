// src/Objects.jsx
import React, { useRef, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box } from '@react-three/drei';
import * as THREE from 'three';

// --- Config ---
const SELECTION_COLOR = '#FF00FF'; // Keep consistent or pass as prop if needed
const lerp = THREE.MathUtils.lerp;

// --- ObjectBase: Wrapper with common logic (selection, animation, pointer down) ---
export const ObjectBase = ({ children, position, isSelected, onSelect, onPointerDown, objectId, type }) => {
    const groupRef = useRef();
    const [animOffset] = useState(() => Math.random() * Math.PI * 2);
    const [freqMult] = useState(() => 0.8 + Math.random() * 0.4);

    useFrame((state) => {
        const time = state.clock.elapsedTime;
        const baseFrequency = 1.2;
        const baseAmplitude = 0.025;
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
    { name: 'maxTrunkHeight', label: 'Trunk H', type: 'number', step: 0.1, min: 0.1, max: 5 },
    { name: 'maxFoliageHeight', label: 'Foliage H', type: 'number', step: 0.1, min: 0.1, max: 5 },
    { name: 'maxFoliageRadius', label: 'Foliage R', type: 'number', step: 0.1, min: 0.1, max: 3 },
    { name: 'trunkColor', label: 'Trunk Clr', type: 'color' },
    { name: 'foliageColor', label: 'Foliage Clr', type: 'color' },
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
    { name: 'maxRadius', label: 'Radius', type: 'number', step: 0.1, min: 0.1, max: 2.5 },
    { name: 'color', label: 'Color', type: 'color' },
];

export const Grass = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1,
    // Editable properties
    bladeColor1 = "#7CFC00",
    bladeColor2 = "#90EE90",
    bladeColor3 = "#9ACD32",
    maxHeight = 0.3,
    maxWidth = 0.4
 }) => {
    const currentHeight = lerp(0.05, maxHeight, globalAge);
    const scaleY = currentHeight / maxHeight || 0.01;
    const scaleY8 = currentHeight * 0.8 / (maxHeight * 0.8) || 0.01;
    const scaleY9 = currentHeight * 0.9 / (maxHeight * 0.9) || 0.01;

    return (
         <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="grass">
             <mesh position={[0, currentHeight / 2, 0]} scale={[1, scaleY, 1]}><boxGeometry args={[maxWidth * 0.1, maxHeight, maxWidth * 0.1]} /><meshStandardMaterial color={bladeColor1} side={THREE.DoubleSide} /></mesh>
             <mesh position={[0.05, (currentHeight * 0.8) / 2, 0.05]} rotation={[0, Math.PI / 4, 0]} scale={[1, scaleY8, 1]}><boxGeometry args={[maxWidth * 0.1, maxHeight * 0.8, maxWidth * 0.1]}/><meshStandardMaterial color={bladeColor2} side={THREE.DoubleSide}/></mesh>
             <mesh position={[-0.05, (currentHeight*0.9) / 2, -0.05]} rotation={[0, -Math.PI / 3, 0]} scale={[1, scaleY9, 1]}><boxGeometry args={[maxWidth * 0.1, maxHeight * 0.9, maxWidth * 0.1]}/><meshStandardMaterial color={bladeColor3} side={THREE.DoubleSide}/></mesh>
        </ObjectBase>
    );
});
// Define what's editable for Grass
Grass.editorSchema = [
    { name: 'maxHeight', label: 'Height', type: 'number', step: 0.05, min: 0.05, max: 1.5 },
    { name: 'maxWidth', label: 'Width', type: 'number', step: 0.05, min: 0.05, max: 1.5 },
    { name: 'bladeColor1', label: 'Color 1', type: 'color' },
    { name: 'bladeColor2', label: 'Color 2', type: 'color' },
    { name: 'bladeColor3', label: 'Color 3', type: 'color' },
];

// --- Map of Components and Schemas for easy lookup ---
export const ObjectComponents = { tree: Tree, shrub: Shrub, grass: Grass };
export const ObjectEditorSchemas = {
    tree: Tree.editorSchema,
    shrub: Shrub.editorSchema,
    grass: Grass.editorSchema,
};
