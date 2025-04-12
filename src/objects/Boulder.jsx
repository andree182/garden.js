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

// Boulder (Simple displaced sphere)
export const Boulder = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1,
    size = 0.6, roughness = 0.8, color = "#888888"
}) => {
    // Note: True displacement requires more setup (vertex shaders or more complex geometry)
    // This is a simple sphere representing a boulder.
    return (
        <ObjectBase position={[position[0], position[1] + size/2, position[2]]} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="boulder">
            <mesh castShadow receiveShadow>
                 <sphereGeometry args={[size / 2, 12, 8]} />
                 <meshStandardMaterial color={color} roughness={roughness} metalness={0.1}/>
            </mesh>
        </ObjectBase>
    );
});
Boulder.editorSchema = [
    { name: 'size', label: 'Approx Size', type: 'number', step: 0.1, min: 0.2, max: 3.0, defaultValue: 0.6 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: "#888888" },
    { name: 'roughness', label: 'Roughness', type: 'number', step: 0.05, min: 0, max: 1, defaultValue: 0.8 },
];
