// src/objects/House.jsx
import React, { memo, useMemo } from 'react';
import * as THREE from 'three';
import { ObjectBase } from './ObjectBase';
import { Box } from '@react-three/drei'; // Using Box helper

// Helper to create simple saddle roof geometry
function createSaddleRoofGeometry(width, length, height, roofHeight) {
    const shape = new THREE.Shape();
    shape.moveTo(-length * 0.55, height);
    shape.lineTo(length * 0.55, height);
    shape.lineTo(length * 0.55, height + roofHeight * 0.1); // Mid point low
    shape.lineTo(0, height + roofHeight); // Peak
    shape.lineTo(-length * 0.55, height + roofHeight * 0.1); // Mid point low
    shape.lineTo(-length * 0.55, height);

    const extrudeSettings = { depth: width * 1.1, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Adjust geometry position to align with base box
    geometry.translate(0, -height, -width * 0.55); // Center Z, move Y down

    return geometry;
}


export const House = memo(({ position, isSelected, onSelect, onPointerDown, objectId, rotationY = 0,
    width = 3, length = 4, height = 2.5,
    wallColor = "#F5F5DC", // Beige
    roofColor = "#8B4513", // Brown
    roofType = 'saddle' // 'flat' or 'saddle'
}) => {

    // Use height *without* roof peak for base box Y position
    const basePosY = height / 2;
    const roofPeakHeight = roofType === 'saddle' ? height * 0.4 : 0; // Extra height for saddle peak

    const roofGeometry = useMemo(() => {
        if (roofType === 'flat') {
            return new THREE.BoxGeometry(length, 0.1, width); // Thin flat roof
        } else { // saddle
            return createSaddleRoofGeometry(width, length, 0, height * 0.4); // Use helper
        }
    }, [width, length, height, roofType]);


    return (
        <ObjectBase position={[position[0], position[1] + basePosY, position[2]]} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="house" rotationY={rotationY}>
             {/* Walls */}
             <mesh position={[0, 0, 0]} castShadow receiveShadow> {/* Position relative to base center */}
                 <boxGeometry args={[length, height, width]} />
                 <meshStandardMaterial color={wallColor} metalness={0.1} roughness={0.8}/>
             </mesh>
             {/* Roof */}
             <mesh position={[0, height/2, 0]} geometry={roofGeometry} castShadow receiveShadow> {/* Position roof on top of walls */}
                  <meshStandardMaterial color={roofColor} metalness={0.1} roughness={0.7}/>
             </mesh>
        </ObjectBase>
    );
});

House.editorSchema = [
    { name: 'length', label: 'Length (X)', type: 'number', step: 0.1, min: 1, max: 10, defaultValue: 5 },
    { name: 'width', label: 'Width (Z)', type: 'number', step: 0.1, min: 1, max: 10, defaultValue: 6 },
    { name: 'height', label: 'Wall Height', type: 'number', step: 0.1, min: 1, max: 15, defaultValue: 3 },
    { name: 'roofType', label: 'Roof Type', type: 'select', options: ['flat', 'saddle'], defaultValue: 'saddle' },
    { name: 'wallColor', label: 'Wall Color', type: 'color', defaultValue: "#F5F5DC" },
    { name: 'roofColor', label: 'Roof Color', type: 'color', defaultValue: "#8B4513" },
    { name: 'rotationY', label: 'Rotation', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
