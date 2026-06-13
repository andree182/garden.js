// src/objects/Hedge.jsx

import React from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { ObjectBase } from './ObjectBase';

const lerp = THREE.MathUtils.lerp;

export const Hedge = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1,
    width = 0.5, length = 1.5, height = 0.8, color = "#3A5F0B", // Dark Hedge Green
    rotationY = 0,
}) => {
    const currentHeight = lerp(0.1, height, globalAge);
    const currentWidth = lerp(0.1, width, globalAge);
    const currentLength = lerp(0.2, length, globalAge);

    // Calculate a nice corner radius based on the smallest dimension
    const cornerRadius = Math.min(currentLength, currentHeight, currentWidth) * 0.2;

    return (
        <ObjectBase position={position} rotationY={rotationY} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="hedge">
            <RoundedBox
                args={[currentLength, currentHeight, currentWidth]}
                position={[0, currentHeight / 2, 0]}
                radius={cornerRadius}
                smoothness={4} // Number of curve segments
                castShadow
                receiveShadow
            >
                <meshStandardMaterial color={color} roughness={0.9} />
            </RoundedBox>
        </ObjectBase>
    );
});

Hedge.editorSchema = [
    { name: 'length', label: 'Length (X)', type: 'number', step: 0.1, min: 0.2, max: 10, defaultValue: 1.5 },
    { name: 'width', label: 'Width (Z)', type: 'number', step: 0.1, min: 0.2, max: 5, defaultValue: 0.5 },
    { name: 'height', label: 'Height (Y)', type: 'number', step: 0.1, min: 0.1, max: 3, defaultValue: 0.8 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: "#3A5F0B" },
    { name: 'rotationY', label: 'Rotation Y', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
