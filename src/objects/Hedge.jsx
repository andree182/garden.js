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
