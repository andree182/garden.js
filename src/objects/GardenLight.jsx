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

// Garden Light
export const GardenLight = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1, // Age unlikely to affect light
    postHeight = 0.6, postDiameter = 0.04, fixtureRadius = 0.06,
    lightColor = "#FFFFE0", // Light Yellow
    lightIntensity = 1.5, // PointLight intensity
    lightRange = 3.0 // PointLight distance/range
}) => {
    const lightFixtureY = postHeight + fixtureRadius * 0.5;
    const pointLightY = postHeight + fixtureRadius * 0.2; // Position light source slightly below visual fixture top

    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="garden_light">
            {/* Post */}
            <mesh position={[0, postHeight / 2, 0]} castShadow>
                 <cylinderGeometry args={[postDiameter / 2, postDiameter / 2, postHeight, 8]} />
                 <meshStandardMaterial color="#444444" metalness={0.6} roughness={0.4}/>
            </mesh>
            {/* Fixture */}
             <mesh position={[0, lightFixtureY, 0]} castShadow>
                 <sphereGeometry args={[fixtureRadius, 12, 8]} />
                 <meshStandardMaterial color="#AAAAAA" metalness={0.3} roughness={0.5}/>
            </mesh>
            {/* Point Light Source */}
            <pointLight
                position={[0, pointLightY, 0]} // Position relative to the object group
                color={lightColor}
                intensity={lightIntensity}
                distance={lightRange} // Range of the light
                decay={2} // Realistic decay
                castShadow={false} // Performance: disable shadows for small lights
            />
        </ObjectBase>
    );
});
GardenLight.editorSchema = [
    { name: 'postHeight', label: 'Post Height', type: 'number', step: 0.05, min: 0.2, max: 2.0, defaultValue: 0.6 },
    { name: 'postDiameter', label: 'Post Ø', type: 'number', step: 0.01, min: 0.02, max: 0.15, defaultValue: 0.04 },
    { name: 'fixtureRadius', label: 'Fixture Ø', type: 'number', step: 0.01, min: 0.03, max: 0.2, defaultValue: 0.06 },
    { name: 'lightColor', label: 'Light Color', type: 'color', defaultValue: "#FFFFE0" },
    { name: 'lightIntensity', label: 'Intensity', type: 'number', step: 0.1, min: 0, max: 5, defaultValue: 1.5 },
    { name: 'lightRange', label: 'Range', type: 'number', step: 0.1, min: 0, max: 10, defaultValue: 3.0 },
];
