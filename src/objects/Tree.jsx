// src/objecttype.jsx

import React, { useRef, useState, useCallback, useMemo, useLayoutEffect, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box } from '@react-three/drei';
import * as THREE from 'three';
import { ObjectBase } from './ObjectBase'; // Import base component

// --- Config ---
const lerp = THREE.MathUtils.lerp;

const tempMatrix = new THREE.Matrix4(); // Reusable matrix for calculations
const tempObject = new THREE.Object3D(); // Reusable object for matrix composition
const tempColor = new THREE.Color(); // Reusable color object
const tempVec = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

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

    // Stacked pine tree foliage layers (3 overlapping cones)
    const layer1Height = currentFoliageHeight * 0.5;
    const layer1Radius = currentFoliageRadius;
    const layer1Y = currentTrunkHeight + layer1Height / 2;

    const layer2Height = currentFoliageHeight * 0.45;
    const layer2Radius = currentFoliageRadius * 0.75;
    const layer2Y = currentTrunkHeight + layer1Height * 0.6 + layer2Height / 2;

    const layer3Height = currentFoliageHeight * 0.4;
    const layer3Radius = currentFoliageRadius * 0.55;
    const layer3Y = currentTrunkHeight + layer1Height * 0.6 + layer2Height * 0.6 + layer3Height / 2;

    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="tree">
            {/* Trunk */}
            <mesh position={[0, currentTrunkHeight / 2, 0]} castShadow>
                <cylinderGeometry args={[0.04 * globalAge, 0.12 * globalAge, currentTrunkHeight, 8]} />
                <meshStandardMaterial color={trunkColor} roughness={0.9} />
            </mesh>
            
            {/* Foliage - Bottom Layer */}
            <mesh position={[0, layer1Y, 0]} castShadow receiveShadow>
                <coneGeometry args={[layer1Radius, layer1Height, 5]} />
                <meshStandardMaterial color={foliageColor} roughness={0.8} />
            </mesh>
            
            {/* Foliage - Middle Layer */}
            <mesh position={[0, layer2Y, 0]} castShadow receiveShadow>
                <coneGeometry args={[layer2Radius, layer2Height, 5]} />
                <meshStandardMaterial color={foliageColor} roughness={0.8} />
            </mesh>
            
            {/* Foliage - Top Layer */}
            <mesh position={[0, layer3Y, 0]} castShadow receiveShadow>
                <coneGeometry args={[layer3Radius, layer3Height, 5]} />
                <meshStandardMaterial color={foliageColor} roughness={0.8} />
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
