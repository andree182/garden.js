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

export const Paver = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1,
    width = 0.5, length = 0.5, height = 0.06, color = "#A9A9A9" // Dark Grey
}) => {
    return (
        <ObjectBase position={[position[0], position[1] + height/2, position[2]]} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="paver">
            <mesh scale={[length, height, width]} castShadow={false} receiveShadow>
                 <boxGeometry args={[1, 1, 1]} />
                 <meshStandardMaterial color={color} roughness={0.85} metalness={0.1} />
             </mesh>
        </ObjectBase>
    );
});
Paver.editorSchema = [
    { name: 'length', label: 'Length (X)', type: 'number', step: 0.05, min: 0.1, max: 2.0, defaultValue: 0.5 },
    { name: 'width', label: 'Width (Z)', type: 'number', step: 0.05, min: 0.1, max: 2.0, defaultValue: 0.5 },
    { name: 'height', label: 'Thickness', type: 'number', step: 0.01, min: 0.02, max: 0.15, defaultValue: 0.06 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: "#A9A9A9" },
];
