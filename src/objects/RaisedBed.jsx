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

// Raised Bed
export const RaisedBed = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1,
    width = 0.8, length = 1.5, height = 0.3,
    frameColor = "#8B4513", // Brown wood color
    soilColor = "#5C4033" // Dark brown soil
}) => {
    const frameThickness = 0.05; // Thickness of the bed walls
    const soilHeightOffset = -0.03; // How far below the top edge the soil starts

    // Calculate inner dimensions for soil
    const soilLength = length - frameThickness * 2;
    const soilWidth = width - frameThickness * 2;
    const soilHeight = height + soilHeightOffset; // Make soil slightly shorter than frame

    return (
        // Use ObjectBase for selection/interaction, position base correctly
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="raised_bed">
            {/* Frame using Box helper for simplicity? Or manual mesh */}
             {/* We need 4 walls and potentially a bottom, Box helper isn't ideal. Let's use meshes. */}
             {/* Front/Back Walls */}
             <mesh position={[0, height/2, width/2 - frameThickness/2]} scale={[length, height, frameThickness]} castShadow receiveShadow>
                <boxGeometry args={[1,1,1]}/>
                <meshStandardMaterial color={frameColor} />
             </mesh>
             <mesh position={[0, height/2, -width/2 + frameThickness/2]} scale={[length, height, frameThickness]} castShadow receiveShadow>
                <boxGeometry args={[1,1,1]}/>
                <meshStandardMaterial color={frameColor} />
             </mesh>
             {/* Left/Right Walls */}
              <mesh position={[length/2 - frameThickness/2, height/2, 0]} scale={[frameThickness, height, width - frameThickness*2]} castShadow receiveShadow> {/* Adjusted width */}
                <boxGeometry args={[1,1,1]}/>
                <meshStandardMaterial color={frameColor} />
             </mesh>
             <mesh position={[-length/2 + frameThickness/2, height/2, 0]} scale={[frameThickness, height, width - frameThickness*2]} castShadow receiveShadow> {/* Adjusted width */}
                <boxGeometry args={[1,1,1]}/>
                <meshStandardMaterial color={frameColor} />
             </mesh>

            {/* Soil */}
            {soilHeight > 0.01 && soilLength > 0 && soilWidth > 0 && ( // Only render if dimensions are valid
                <mesh position={[0, soilHeight / 2, 0]} scale={[soilLength, soilHeight, soilWidth]} receiveShadow> {/* Position slightly below top */}
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color={soilColor} roughness={0.9} metalness={0.05} />
                </mesh>
            )}
        </ObjectBase>
    );
});
RaisedBed.editorSchema = [
    { name: 'length', label: 'Length (X)', type: 'number', step: 0.1, min: 0.3, max: 5, defaultValue: 1.5 },
    { name: 'width', label: 'Width (Z)', type: 'number', step: 0.1, min: 0.3, max: 3, defaultValue: 0.8 },
    { name: 'height', label: 'Height (Y)', type: 'number', step: 0.05, min: 0.1, max: 1, defaultValue: 0.3 },
    { name: 'frameColor', label: 'Frame Color', type: 'color', defaultValue: "#8B4513" },
    { name: 'soilColor', label: 'Soil Color', type: 'color', defaultValue: "#5C4033" },
];
