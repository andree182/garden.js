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
