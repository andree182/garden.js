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

// Pot/Planter
export const Pot = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1,
    topDiameter = 0.4, bottomDiameter = 0.3, height = 0.35, color = "#CD853F" // Peru (Terracotta-ish)
}) => {
    return (
        <ObjectBase position={[position[0], position[1] + height/2, position[2]]} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="pot">
            <mesh castShadow receiveShadow>
                 <cylinderGeometry args={[topDiameter / 2, bottomDiameter / 2, height, 16]} />
                 <meshStandardMaterial color={color}/>
            </mesh>
        </ObjectBase>
    );
});
Pot.editorSchema = [
    { name: 'topDiameter', label: 'Top Ø', type: 'number', step: 0.05, min: 0.1, max: 1.5, defaultValue: 0.4 },
    { name: 'bottomDiameter', label: 'Bottom Ø', type: 'number', step: 0.05, min: 0.05, max: 1.4, defaultValue: 0.3 },
    { name: 'height', label: 'Height', type: 'number', step: 0.05, min: 0.1, max: 1.0, defaultValue: 0.35 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: "#CD853F" },
];
