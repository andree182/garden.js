// src/objects/RectSteppingStone.jsx
import React, { memo } from 'react';
import * as THREE from 'three';
import { ObjectBase } from './ObjectBase';
import { Box } from '@react-three/drei';

export const RectSteppingStone = memo(({ position, isSelected, onSelect, onPointerDown, objectId, rotationY = 0,
    width = 0.3, length = 0.5, height = 0.05, color = "#909090" // Lighter Grey
}) => {
    return (
        <ObjectBase position={[position[0], position[1] + height/2, position[2]]} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="rect_stepping_stone" rotationY={rotationY}>
            <mesh castShadow={false} receiveShadow scale={[length, height, width]}> {/* Map L,H,W */}
                 <boxGeometry args={[1, 1, 1]} />
                 <meshStandardMaterial color={color} roughness={0.8} metalness={0.1}/>
             </mesh>
        </ObjectBase>
    );
});

RectSteppingStone.editorSchema = [
    { name: 'length', label: 'Length (X)', type: 'number', step: 0.05, min: 0.1, max: 2.0, defaultValue: 0.5 },
    { name: 'width', label: 'Width (Z)', type: 'number', step: 0.05, min: 0.1, max: 2.0, defaultValue: 0.3 },
    { name: 'height', label: 'Thickness', type: 'number', step: 0.01, min: 0.02, max: 0.2, defaultValue: 0.05 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: "#909090" },
    { name: 'rotationY', label: 'Rotation', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
