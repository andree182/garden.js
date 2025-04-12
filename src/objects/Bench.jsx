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


// Bench (Simple)
export const Bench = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1,
    length = 1.2, width = 0.4, height = 0.4, backHeight = 0.4, color = "#D2B48C", // Tan wood
    rotationY = 0,
}) => {
    const seatY = height / 2;
    const backY = height + backHeight / 2;
    const legHeight = height * 0.9;
    const legThickness = 0.06;
    const legX = length * 0.45;
    const legZ = width * 0.4;

    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} rotationY={rotationY} objectId={objectId} type="bench">
            {/* Seat */}
            <mesh position={[0, seatY, 0]} scale={[length, legThickness * 1.5, width]} castShadow receiveShadow>
                <boxGeometry args={[1,1,1]}/> <meshStandardMaterial color={color}/>
            </mesh>
            {/* Back */}
            {backHeight > 0.01 && (
                <mesh position={[0, backY, -width/2 + legThickness]} scale={[length, backHeight, legThickness]} castShadow receiveShadow>
                    <boxGeometry args={[1,1,1]}/> <meshStandardMaterial color={color}/>
                </mesh>
            )}
             {/* Legs */}
             {[ {x: legX, z: legZ}, {x: legX, z: -legZ}, {x: -legX, z: legZ}, {x: -legX, z: -legZ} ].map((pos, i) => (
                 <mesh key={i} position={[pos.x, legHeight/2, pos.z]} scale={[legThickness, legHeight, legThickness]} castShadow receiveShadow>
                    <boxGeometry args={[1,1,1]}/> <meshStandardMaterial color={color}/>
                 </mesh>
             ))}
        </ObjectBase>
    );
});
Bench.editorSchema = [
    { name: 'length', label: 'Length (X)', type: 'number', step: 0.1, min: 0.5, max: 3.0, defaultValue: 1.2 },
    { name: 'width', label: 'Width (Z)', type: 'number', step: 0.05, min: 0.2, max: 0.8, defaultValue: 0.4 },
    { name: 'height', label: 'Seat Height', type: 'number', step: 0.05, min: 0.2, max: 0.8, defaultValue: 0.4 },
    { name: 'backHeight', label: 'Back Height', type: 'number', step: 0.05, min: 0.0, max: 0.8, defaultValue: 0.4 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: "#D2B48C" },
    { name: 'rotationY', label: 'Rotation', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
