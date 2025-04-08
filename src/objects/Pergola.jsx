// src/objects/Pergola.jsx
import React, { memo } from 'react';
import * as THREE from 'three';
import { ObjectBase } from './ObjectBase';
import { Box, Plane } from '@react-three/drei';

export const Pergola = memo(({ position, isSelected, onSelect, onPointerDown, objectId, rotationY = 0,
    width = 2, length = 2, height = 2.2,
    postDiameter = 0.1,
    postColor = "#8B4513",
    coverColor = "#FFFFFF",
    coverOpacity = 0.5
}) => {

    const postHeight = height - 0.05; // Posts slightly shorter than total height
    const coverY = height;
    const halfL = length / 2;
    const halfW = width / 2;
    const postRadius = postDiameter / 2;

    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="pergola" rotationY={rotationY}>
            {/* Posts */}
            {[
                [halfL - postRadius, halfW - postRadius], [-halfL + postRadius, halfW - postRadius],
                [halfL - postRadius, -halfW + postRadius], [-halfL + postRadius, -halfW + postRadius]
            ].map(([x, z], i) => (
                <mesh key={`post-${i}`} position={[x, postHeight/2, z]} castShadow receiveShadow>
                    <cylinderGeometry args={[postRadius, postRadius, postHeight, 8]} />
                    <meshStandardMaterial color={postColor} />
                </mesh>
            ))}
             {/* Top Cover Plane */}
             <mesh position={[0, coverY, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                 <planeGeometry args={[length, width]} />
                 <meshStandardMaterial
                    color={coverColor}
                    opacity={coverOpacity}
                    transparent={coverOpacity < 1.0}
                    side={THREE.DoubleSide}
                    depthWrite={coverOpacity > 0.95}
                 />
             </mesh>
             {/* Optional: Add top beams/rafters */}
        </ObjectBase>
    );
});

Pergola.editorSchema = [
    { name: 'length', label: 'Length (X)', type: 'number', step: 0.1, min: 0.5, max: 10, defaultValue: 2 },
    { name: 'width', label: 'Width (Z)', type: 'number', step: 0.1, min: 0.5, max: 10, defaultValue: 2 },
    { name: 'height', label: 'Height (Y)', type: 'number', step: 0.1, min: 1.5, max: 4, defaultValue: 2.2 },
    { name: 'postDiameter', label: 'Post Ø', type: 'number', step: 0.01, min: 0.03, max: 0.3, defaultValue: 0.1 },
    { name: 'coverOpacity', label: 'Cover Opacity', type: 'number', step: 0.05, min: 0, max: 1, defaultValue: 0.5 },
    { name: 'postColor', label: 'Post Color', type: 'color', defaultValue: "#8B4513" },
    { name: 'coverColor', label: 'Cover Color', type: 'color', defaultValue: "#FFFFFF" },
    { name: 'rotationY', label: 'Rotation', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
