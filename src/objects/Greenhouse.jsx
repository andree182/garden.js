// src/objects/Greenhouse.jsx
import React, { memo, useMemo } from 'react';
import * as THREE from 'three';
import { ObjectBase } from './ObjectBase';

// Helper to create simple saddle roof geometry for the glass roof
function createSaddleRoofGeometry(width, length, height, roofHeight) {
    const shape = new THREE.Shape();
    shape.moveTo(-width * 0.5, height);
    shape.lineTo(width * 0.5, height);
    shape.lineTo(0, height + roofHeight); // Peak
    shape.lineTo(-width * 0.5, height);

    const extrudeSettings = { depth: length, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Extrude builds along Z axis, so we rotate/translate to align
    geometry.rotateY(Math.PI / 2); // Rotate to align with length (X axis)
    geometry.translate(-length / 2, 0, 0); // Center translation in X

    return geometry;
}

export const Greenhouse = memo(({ position, isSelected, onSelect, onPointerDown, objectId, rotationY = 0,
    width = 2.0, length = 3.0, height = 1.8, roofHeight = 0.7,
    frameColor = "#2E5A27", // Dark Green Metal
    glassColor = "#E0F7FA", // Light Cyan Glass
    glassOpacity = 0.35,
    showInterior = true
}) => {
    // Base Y offset for centering
    const basePosY = height / 2;

    // Roof glass geometry
    const roofGeometry = useMemo(() => {
        // Create geometry with origin at the base (Y = 0) of the roof
        // Depth parameter is length (which runs along X-axis after rotation)
        const geo = createSaddleRoofGeometry(width, length, 0, roofHeight);
        return geo;
    }, [width, length, roofHeight]);

    // Rafter calculations
    const rafterAngle = Math.atan2(width / 2, roofHeight);
    const rafterLength = Math.sqrt(roofHeight * roofHeight + (width / 2) * (width / 2));

    // Internal benches & plants
    const interiorElements = useMemo(() => {
        if (!showInterior) return null;
        const elements = [];
        const benchWidth = 0.35;
        const benchHeight = 0.5;
        const benchLength = length * 0.8;
        
        // Z positions for left & right benches
        const zPositions = [-(width / 2 - benchWidth / 2 - 0.05), (width / 2 - benchWidth / 2 - 0.05)];

        zPositions.forEach((zPos, bIdx) => {
            // Bench top
            elements.push(
                <mesh key={`bench-top-${bIdx}`} position={[0, benchHeight - 0.025, zPos]} castShadow receiveShadow>
                    <boxGeometry args={[benchLength, 0.04, benchWidth]} />
                    <meshStandardMaterial color="#8B5A2B" roughness={0.9} />
                </mesh>
            );

            // Bench legs (2 legs per bench)
            const legOffsets = [-benchLength / 3, benchLength / 3];
            legOffsets.forEach((xOffset, lIdx) => {
                elements.push(
                    <mesh key={`bench-leg-${bIdx}-${lIdx}`} position={[xOffset, (benchHeight - 0.05) / 2, zPos]} castShadow receiveShadow>
                        <boxGeometry args={[0.04, benchHeight - 0.05, 0.04]} />
                        <meshStandardMaterial color="#5C3A21" roughness={0.9} />
                    </mesh>
                );
            });

            // Potted Plants on benches
            const plantOffsets = [-benchLength / 4, 0, benchLength / 4];
            plantOffsets.forEach((xOffset, pIdx) => {
                const potHeight = 0.08;
                const potRadius = 0.05;
                const plantRadius = 0.07 + Math.random() * 0.03;
                const plantHeight = benchHeight + potHeight;

                elements.push(
                    <group key={`plant-${bIdx}-${pIdx}`} position={[xOffset, 0, zPos]}>
                        {/* Pot */}
                        <mesh position={[0, benchHeight + potHeight / 2, 0]} castShadow>
                            <cylinderGeometry args={[potRadius, potRadius * 0.7, potHeight, 8]} />
                            <meshStandardMaterial color="#CD853F" roughness={0.8} /> {/* Terracotta */}
                        </mesh>
                        {/* Leafy Sphere */}
                        <mesh position={[0, benchHeight + potHeight + plantRadius * 0.6, 0]} castShadow>
                            <sphereGeometry args={[plantRadius, 8, 8]} />
                            <meshStandardMaterial color={pIdx % 2 === 0 ? "#4E9F3D" : "#1E5128"} roughness={0.9} />
                        </mesh>
                    </group>
                );
            });
        });

        return elements;
    }, [showInterior, length, width]);

    return (
        <ObjectBase position={[position[0], position[1] + basePosY, position[2]]} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="greenhouse" rotationY={rotationY}>
            
            {/* --- Glass Panes --- */}
            {/* Wall Glass */}
            <mesh position={[0, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[length - 0.01, height - 0.01, width - 0.01]} />
                <meshStandardMaterial color={glassColor} transparent opacity={glassOpacity} roughness={0.1} metalness={0.9} side={THREE.DoubleSide} />
            </mesh>

            {/* Roof Glass */}
            <mesh position={[0, height / 2, 0]} geometry={roofGeometry} castShadow receiveShadow>
                <meshStandardMaterial color={glassColor} transparent opacity={glassOpacity} roughness={0.1} metalness={0.9} side={THREE.DoubleSide} />
            </mesh>

            {/* --- Metal Framing --- */}
            {/* Corner Columns (4 Vertical Pillars) */}
            <mesh position={[-length / 2, 0, -width / 2]} castShadow>
                <boxGeometry args={[0.04, height, 0.04]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>
            <mesh position={[length / 2, 0, -width / 2]} castShadow>
                <boxGeometry args={[0.04, height, 0.04]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>
            <mesh position={[-length / 2, 0, width / 2]} castShadow>
                <boxGeometry args={[0.04, height, 0.04]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>
            <mesh position={[length / 2, 0, width / 2]} castShadow>
                <boxGeometry args={[0.04, height, 0.04]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>

            {/* Horizontal Base Frame (4 bars at bottom) */}
            <mesh position={[0, -height / 2 + 0.02, -width / 2]} castShadow>
                <boxGeometry args={[length, 0.04, 0.04]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>
            <mesh position={[0, -height / 2 + 0.02, width / 2]} castShadow>
                <boxGeometry args={[length, 0.04, 0.04]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>
            <mesh position={[-length / 2, -height / 2 + 0.02, 0]} castShadow>
                <boxGeometry args={[0.04, 0.04, width]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>
            <mesh position={[length / 2, -height / 2 + 0.02, 0]} castShadow>
                <boxGeometry args={[0.04, 0.04, width]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>

            {/* Horizontal Top-Wall Frame (4 bars at wall height) */}
            <mesh position={[0, height / 2 - 0.02, -width / 2]} castShadow>
                <boxGeometry args={[length, 0.04, 0.04]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>
            <mesh position={[0, height / 2 - 0.02, width / 2]} castShadow>
                <boxGeometry args={[length, 0.04, 0.04]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>
            <mesh position={[-length / 2, height / 2 - 0.02, 0]} castShadow>
                <boxGeometry args={[0.04, 0.04, width]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>
            <mesh position={[length / 2, height / 2 - 0.02, 0]} castShadow>
                <boxGeometry args={[0.04, 0.04, width]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>

            {/* Intermediate vertical framing studs (at middle of long walls) */}
            <mesh position={[0, 0, -width / 2]} castShadow>
                <boxGeometry args={[0.03, height, 0.03]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>
            <mesh position={[0, 0, width / 2]} castShadow>
                <boxGeometry args={[0.03, height, 0.03]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>

            {/* Roof Ridge Pole (Peak Horizontal Bar) */}
            <mesh position={[0, height / 2 + roofHeight - 0.02, 0]} castShadow>
                <boxGeometry args={[length, 0.04, 0.04]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>

            {/* Gable Diagonal Rafters (Front/Back Triangles) */}
            {/* Front Gable */}
            <mesh 
                position={[length / 2, height / 2 + roofHeight / 2, -width / 4]} 
                rotation={[rafterAngle, 0, 0]}
                castShadow
            >
                <boxGeometry args={[0.04, rafterLength, 0.04]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>
            <mesh 
                position={[length / 2, height / 2 + roofHeight / 2, width / 4]} 
                rotation={[-rafterAngle, 0, 0]}
                castShadow
            >
                <boxGeometry args={[0.04, rafterLength, 0.04]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>

            {/* Back Gable */}
            <mesh 
                position={[-length / 2, height / 2 + roofHeight / 2, -width / 4]} 
                rotation={[rafterAngle, 0, 0]}
                castShadow
            >
                <boxGeometry args={[0.04, rafterLength, 0.04]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>
            <mesh 
                position={[-length / 2, height / 2 + roofHeight / 2, width / 4]} 
                rotation={[-rafterAngle, 0, 0]}
                castShadow
            >
                <boxGeometry args={[0.04, rafterLength, 0.04]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>

            {/* Middle Rafters for reinforcement */}
            <mesh 
                position={[0, height / 2 + roofHeight / 2, -width / 4]} 
                rotation={[rafterAngle, 0, 0]}
                castShadow
            >
                <boxGeometry args={[0.03, rafterLength, 0.03]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>
            <mesh 
                position={[0, height / 2 + roofHeight / 2, width / 4]} 
                rotation={[-rafterAngle, 0, 0]}
                castShadow
            >
                <boxGeometry args={[0.03, rafterLength, 0.03]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} metalness={0.5} />
            </mesh>

            {/* --- Interior Benches & Plants --- */}
            <group position={[0, -height / 2, 0]}>
                {interiorElements}
            </group>

        </ObjectBase>
    );
});

Greenhouse.editorSchema = [
    { name: 'length', label: 'Length (X)', type: 'number', step: 0.1, min: 1.0, max: 10.0, defaultValue: 3.0 },
    { name: 'width', label: 'Width (Z)', type: 'number', step: 0.1, min: 1.0, max: 8.0, defaultValue: 2.0 },
    { name: 'height', label: 'Wall Height', type: 'number', step: 0.1, min: 0.8, max: 5.0, defaultValue: 1.8 },
    { name: 'roofHeight', label: 'Roof Height', type: 'number', step: 0.05, min: 0.2, max: 3.0, defaultValue: 0.7 },
    { name: 'frameColor', label: 'Frame Color', type: 'color', defaultValue: "#2E5A27" },
    { name: 'glassColor', label: 'Glass Color', type: 'color', defaultValue: "#E0F7FA" },
    { name: 'glassOpacity', label: 'Glass Opacity', type: 'number', step: 0.05, min: 0.1, max: 0.9, defaultValue: 0.35 },
    { name: 'showInterior', label: 'Show Interior', type: 'select', options: [true, false], defaultValue: true },
    { name: 'rotationY', label: 'Rotation', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
