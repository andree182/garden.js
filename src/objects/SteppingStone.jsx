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
