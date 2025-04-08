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

// Car (Simplified Box Model)
export const Car = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1, // Age doesn't affect car
    bodyLength = 5, bodyWidth = 2, bodyHeight = 1.5,
    roofHeight = 0.5, roofOffset = 0.1,
    wheelRadius = 0.4, wheelWidth = 0.3,
    color = "#B0C4DE", // Light Steel Blue
    rotationY = 0,
}) => {
    const wheelY = wheelRadius; // Place wheels touching ground
    const bodyY = wheelRadius + bodyHeight / 2;
    const roofY = wheelRadius + bodyHeight + roofHeight / 2;
    const wheelOffsetX = bodyLength * 0.35;
    const wheelOffsetZ = (bodyWidth / 2);

    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} rotationY={rotationY} objectId={objectId} type="car">
            {/* Body */}
            <mesh position={[0, bodyY, 0]} castShadow receiveShadow>
                <boxGeometry args={[bodyLength, bodyHeight, bodyWidth]} />
                <meshStandardMaterial color={color} metalness={0.3} roughness={0.4}/>
            </mesh>
            {/* Roof */}
            <mesh position={[roofOffset, roofY, 0]} castShadow receiveShadow>
                 <boxGeometry args={[bodyLength * 0.6, roofHeight, bodyWidth * 0.9]} />
                 <meshStandardMaterial color={color} metalness={0.3} roughness={0.4}/>
            </mesh>
             {/* Wheels */}
             {[
                {x: wheelOffsetX, z: wheelOffsetZ}, {x: wheelOffsetX, z: -wheelOffsetZ},
                {x: -wheelOffsetX, z: wheelOffsetZ}, {x: -wheelOffsetX, z: -wheelOffsetZ}
             ].map((pos, i) => (
                 <mesh key={i} position={[pos.x, wheelY, pos.z]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
                    <cylinderGeometry args={[wheelRadius, wheelRadius, wheelWidth, 16]} />
                    <meshStandardMaterial color="#333333" metalness={0.1} roughness={0.6}/>
                </mesh>
             ))}
        </ObjectBase>
    );
});
Car.editorSchema = [
    { name: 'color', label: 'Color', type: 'color', defaultValue: "#B0C4DE" },
    { name: 'bodyLength', label: 'Length', type: 'number', step: 0.1, min: 3, max: 6, defaultValue: 4.5 },
    { name: 'bodyWidth', label: 'Width', type: 'number', step: 0.1, min: 1.5, max: 3, defaultValue: 1.8 },
    { name: 'bodyHeight', label: 'Body Height', type: 'number', step: 0.05, min: 0.3, max: 1.0, defaultValue: 0.6 },
    { name: 'rotationY', label: 'Rotation', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
