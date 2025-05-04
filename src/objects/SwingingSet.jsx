// src/objecttype.jsx

import React, { useRef, useState, useCallback, useMemo, useLayoutEffect, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box } from '@react-three/drei';
import * as THREE from 'three';
import { ObjectBase } from './ObjectBase'; // Import base component

// --- Config ---
const lerp = THREE.MathUtils.lerp;


// --- NEW Swinging Set Component ---
export const SwingingSet = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1, // Age unlikely to affect structure
    // Frame dimensions
    height = 2.2,        // Overall height to top bar
    width = 2.5,         // Overall width between A-frame bases
    depth = 1.8,         // Depth of the A-frame base spread
    // Stand Pole Configuration
    standPoles = 'A-frame', // 'A-frame', 'single'
    // Material Configuration
    materialType = 'wood_10cm', // 'iron_round_5cm', 'wood_10cm', 'wood_15cm'
    materialColor = null, // If null, uses default based on type (e.g., grey for iron, brown for wood)
    // Swing Configuration
    numSwings = 2,
    swingSeatColor = "#8B4513", // Brown default
    swingChainColor = "#808080", // Grey default
    rotationY = 0,
}) => {

    // --- Derived Material Properties ---
    const { poleRadius, poleIsRound, defaultColor } = useMemo(() => {
        switch (materialType) {
            case 'wood_15cm': return { poleRadius: 0.075, poleIsRound: false, defaultColor: '#A0522D' }; // Use half-dimension for "radius" of box
            case 'iron_round_5cm': return { poleRadius: 0.025, poleIsRound: true, defaultColor: '#696969' }; // Dim Gray
            case 'wood_10cm': default: return { poleRadius: 0.05, poleIsRound: false, defaultColor: '#A0522D' };
        }
    }, [materialType]);

    const frameColor = materialColor || defaultColor;
    const poleGeo = useMemo(() => (
        poleIsRound
            ? new THREE.CylinderGeometry(poleRadius, poleRadius, 1, 12) // Height 1 for scaling
            : new THREE.BoxGeometry(poleRadius * 2, 1, poleRadius * 2) // Width/Depth based on "radius" * 2
        ).translate(0, 0.5, 0), // Pivot at bottom center
        [poleIsRound, poleRadius]
    );
    const frameMat = useMemo(() => new THREE.MeshStandardMaterial({
        color: frameColor,
        roughness: poleIsRound ? 0.4 : 0.7,
        metalness: poleIsRound ? 0.6 : 0.1
    }), [frameColor, poleIsRound]);

    // --- Frame Geometry Calculations ---
    const topBarY = height;
    const topBarLength = width + poleRadius*2; // Slightly shorter than base width

    // A-Frame Calculations
    const aFrameAngle = Math.atan2(height, depth / 2); // Angle leg makes with ground horizontal
    const legLength = height / Math.sin(aFrameAngle);
    const legAngleZ = Math.PI / 2 - aFrameAngle; // Angle leg makes with vertical Y axis

    // Single Pole Calculations
    const singlePoleLength = height; // Adjust if needed

    // Swing placement
    const numSpaces = numSwings + 1;
    const swingSpacing = topBarLength / numSpaces;
    const swingSeatWidth = 0.4;
    const swingSeatDepth = 0.15;
    const swingSeatHeight = 0.03;
    const swingChainRadius = 0.008;
    const swingDrop = height * 0.7; // How far down the chains hang
    const swingSeatY = height - swingDrop - swingSeatHeight / 2;

    // --- Component Rendering ---
    return (
        <ObjectBase position={position} rotationY={rotationY} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="swing_set">

            {/* Top Bar */}
            <mesh position={[topBarLength / 2, topBarY, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, topBarLength, 1]} geometry={poleGeo} material={frameMat} castShadow receiveShadow/>

            {/* Stand Poles */}
            {standPoles === 'A-frame' ? (
                <>
                    {/* Left A-Frame */}
                    <mesh position={[-width / 2, 0, depth / 2]} rotation={[0, -Math.PI/2, legAngleZ]} scale={[1, legLength, 1]} geometry={poleGeo} material={frameMat} castShadow receiveShadow/>
                    <mesh position={[-width / 2, 0, -depth / 2]} rotation={[0, -Math.PI/2, -legAngleZ]} scale={[1, legLength, 1]} geometry={poleGeo} material={frameMat} castShadow receiveShadow/>
                    {/* Right A-Frame */}
                    <mesh position={[width / 2, 0, depth / 2]} rotation={[0, -Math.PI/2, legAngleZ]} scale={[1, legLength, 1]} geometry={poleGeo} material={frameMat} castShadow receiveShadow/>
                    <mesh position={[width / 2, 0, -depth / 2]} rotation={[0, -Math.PI/2, -legAngleZ]} scale={[1, legLength, 1]} geometry={poleGeo} material={frameMat} castShadow receiveShadow/>
                </>
            ) : ( // Single Poles
                <>
                    <mesh position={[-width / 2, 0, 0]} scale={[1, singlePoleLength, 1]} geometry={poleGeo} material={frameMat} castShadow receiveShadow/>
                    <mesh position={[width / 2, 0, 0]} scale={[1, singlePoleLength, 1]} geometry={poleGeo} material={frameMat} castShadow receiveShadow/>
                </>
            )}

            {/* Swings */}
            {Array.from({ length: Math.max(0, numSwings) }).map((_, index) => {
                const swingX = -topBarLength / 2 + swingSpacing * (index + 1);
                const chainHeight = topBarY - swingSeatY - swingSeatHeight/2; // Height from top bar to seat top
                const chainY = swingSeatY + swingSeatHeight/2 + chainHeight/2; // Center Y for chain cylinders

                return (
                    <group key={index} position={[swingX, 0, 0]}>
                        {/* Seat */}
                        <mesh position={[0, swingSeatY, 0]} scale={[swingSeatWidth, swingSeatHeight, swingSeatDepth]} castShadow receiveShadow>
                            <boxGeometry args={[1,1,1]}/>
                            <meshStandardMaterial color={swingSeatColor} roughness={0.6}/>
                        </mesh>
                        {/* Chains (using thin cylinders) */}
                        <mesh position={[-swingSeatWidth * 0.4, chainY, 0]} scale={[1, chainHeight, 1]} castShadow receiveShadow>
                            <cylinderGeometry args={[swingChainRadius, swingChainRadius, 1, 6]}/>
                            <meshStandardMaterial color={swingChainColor} metalness={0.7} roughness={0.3}/>
                        </mesh>
                        <mesh position={[swingSeatWidth * 0.4, chainY, 0]} scale={[1, chainHeight, 1]} castShadow receiveShadow>
                             <cylinderGeometry args={[swingChainRadius, swingChainRadius, 1, 6]}/>
                             <meshStandardMaterial color={swingChainColor} metalness={0.7} roughness={0.3}/>
                        </mesh>
                    </group>
                );
            })}

        </ObjectBase>
    );
});

// Define what's editable for SwingingSet
SwingingSet.editorSchema = [
    { name: 'height', label: 'Height', type: 'number', step: 0.1, min: 1.5, max: 3.5, defaultValue: 2.2 },
    { name: 'width', label: 'Width', type: 'number', step: 0.1, min: 1.0, max: 5.0, defaultValue: 2.5 },
    { name: 'depth', label: 'Depth', type: 'number', step: 0.1, min: 1.0, max: 3.0, defaultValue: 1.8 },
    { name: 'numSwings', label: '# Swings', type: 'number', step: 1, min: 0, max: 4, defaultValue: 2 },
    { name: 'standPoles', label: 'Stand Type', type: 'select', options: ['A-frame', 'single'], defaultValue: 'A-frame' },
    { name: 'materialType', label: 'Material', type: 'select', options: ['iron_round_5cm', 'wood_10cm', 'wood_15cm'], defaultValue: 'wood_10cm' },
    { name: 'materialColor', label: 'Frame Color', type: 'color', defaultValue: null }, // Null uses default based on materialType
    { name: 'swingSeatColor', label: 'Seat Color', type: 'color', defaultValue: "#8B4513" },
    { name: 'swingChainColor', label: 'Chain Color', type: 'color', defaultValue: "#808080" },
    { name: 'rotationY', label: 'Rotation Y', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
