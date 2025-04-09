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

const MAX_BRANCHES = 20;
const MAX_FRUITS = 500;

export const DeciduousTree = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1, currentMonth = 6,
   // Trunk Properties
    trunkHeight = 1.0,
    trunkDiameter = 0.25,
    trunkColor = "#A0522D",
    // Branch Properties
    branchDensity = 40,  // Controls number of side branches
    branchLengthMax = 0.8, // Max length relative to foliage size
    branchDiameter = 0.08,
    branchColor = null,  // Optional different color (null uses trunkColor)
    // Foliage Properties
    foliageDiameter = 1.8, // Base diameter used for XZ scale
    foliageScaleXZ = 1.0, // Multiplier for X/Z foliage shape (1.0 = sphere)
    foliageScaleY = 1.0,  // Multiplier for Y foliage shape (1.0 = sphere)
    foliageColor = "#559040",
    foliageOpacity = 0.85,
    // Fruit Properties
    fruitType = 'apple',
    fruitDensity = 30,
}) => {

    const fruitMeshRef = useRef();
    const branchMeshRef = useRef();

    // --- Seasonal Calculations ---
    const isWinter = useMemo(() => currentMonth >= 12 || currentMonth <= 2, [currentMonth]); // Dec-Feb
    const isSpring = useMemo(() => currentMonth >= 3 && currentMonth <= 5, [currentMonth]); // Mar-May
    const isFall = useMemo(() => currentMonth >= 9 && currentMonth <= 11, [currentMonth]); // Sep-Nov
    const hasLeaves = !isWinter;
    const showFruit = useMemo(() => fruitType !== 'none' && isFall, [fruitType, isFall]);

    // --- Aged Dimensions ---
    const currentTrunkHeight = lerp(0.2, trunkHeight, globalAge);
    const currentTrunkDiameter = lerp(0.05, trunkDiameter, globalAge);
    // Base radius for calculating bounds, before scaling
    const baseFoliageRadius = foliageDiameter / 2;
    const currentFoliageRadiusXZ = lerp(0.15, baseFoliageRadius * foliageScaleXZ, globalAge);
    const currentFoliageRadiusY = lerp(0.15, baseFoliageRadius * foliageScaleY, globalAge);
    const currentBranchLengthMax = lerp(0.1, branchLengthMax, globalAge);
    const currentBranchDiameter = lerp(0.01, branchDiameter, globalAge);

    // --- Foliage Appearance ---
    const currentFoliageColor = useMemo(() => {
        if (isSpring) return "#90EE90"; // Light green
        if (isFall) return "#FFA500"; // Orange/Yellow
        return foliageColor; // Summer or default
    }, [isSpring, isFall, foliageColor]);
    const foliageCenterY = currentTrunkHeight * 0.8 + currentFoliageRadiusY;

        // --- Branch Geometry & Material ---
    const [branchGeometry, branchMaterial] = useMemo(() => {
        // Cylinder: radiusTop, radiusBottom, height, radialSegments
        const geom = new THREE.CylinderGeometry(branchDiameter * 0.5, branchDiameter * 0.7, 1, 5); // Height=1 for scaling
        geom.translate(0, 0.5, 0); // Pivot at bottom center
        const mat = new THREE.MeshStandardMaterial({ color: branchColor || trunkColor });
        return [geom, mat];
    }, [branchDiameter, branchColor, trunkColor]); // Recreate if base diameter/colors change

    // --- Branch Instancing ---
    const branchCount = useMemo(() => {
        // Density relates to approximate foliage surface area
        const approxSurfaceArea = 4 * Math.PI * Math.pow((currentFoliageRadiusXZ + currentFoliageRadiusY) / 2, 2); // Avg radius sphere area
        return Math.min(MAX_BRANCHES, Math.max(0, Math.floor(branchDensity * approxSurfaceArea * 0.5))); // Adjust multiplier
    }, [branchDensity, currentFoliageRadiusXZ, currentFoliageRadiusY]);

    useLayoutEffect(() => {
        if (!branchMeshRef.current || !branchGeometry || branchCount === 0) return;
        const mesh = branchMeshRef.current;

        // Branches start near the top part of the trunk
        const branchStartY = currentTrunkHeight * 0.7;
        const branchHeightRange = currentTrunkHeight * 0.25; // Vertical range along trunk where branches originate

        for (let i = 0; i < branchCount; i++) {
            // --- Starting Position on Trunk ---
            const yStart = branchStartY + Math.random() * branchHeightRange;
            // Slight offset from center for start point (less for thinner trunks)
            const startOffsetRadius = currentTrunkDiameter * 0.1 * Math.random();
            const startAngle = Math.random() * Math.PI * 2;
            const xStart = Math.cos(startAngle) * startOffsetRadius;
            const zStart = Math.sin(startAngle) * startOffsetRadius;
            tempObject.position.set(xStart, yStart, zStart);

            // --- Direction & Length ---
            // Point towards a random spot on the surface of the scaled foliage ellipsoid
            const phi = Math.acos(2 * Math.random() - 1); // Elevation angle
            const theta = Math.random() * Math.PI * 2;   // Azimuth angle

            // Calculate point on surface of ellipsoid (radius varies with angle phi)
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);
            const rXZ = currentFoliageRadiusXZ; // Radius in XZ plane at height y
            const rY = currentFoliageRadiusY;   // Radius along Y axis

            // Simplified target point calculation (can be improved for perfect ellipsoid)
            const targetX = rXZ * sinPhi * Math.cos(theta);
            const targetY = rY * cosPhi; // Relative to foliage center
            const targetZ = rXZ * sinPhi * Math.sin(theta);

            // Direction vector from branch start to target point (relative to tree origin)
            const direction = tempVec.set(targetX, targetY + foliageCenterY - yStart, targetZ).normalize();

            // Calculate length: extend towards target, max length based on prop, add randomness
            const branchLength = currentBranchLengthMax * (0.6 + Math.random() * 0.4);
            tempObject.scale.set(1, branchLength, 1); // Scale height

            // --- Rotation ---
            // Align branch (Y-axis of geometry) with the calculated direction
            tempObject.quaternion.setFromUnitVectors(Y_AXIS, direction);
            // Add slight random roll around branch axis (optional)
            const rollAngle = Math.random() * Math.PI * 0.2 - Math.PI * 0.1;
            tempQuaternion.setFromAxisAngle(direction, rollAngle);
            tempObject.quaternion.multiply(tempQuaternion);


            // --- Update Matrix ---
            tempObject.updateMatrix();
            mesh.setMatrixAt(i, tempObject.matrix);
        }
        mesh.count = branchCount;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        // Update material color
        if (mesh.material) { mesh.material.color.set(branchColor || trunkColor); }

    }, [branchCount, currentTrunkHeight, currentTrunkDiameter, currentFoliageRadiusXZ, currentFoliageRadiusY, foliageCenterY, currentBranchLengthMax, branchGeometry, branchColor, trunkColor]); // Dependencies

    // --- Fruit Appearance ---
    const [fruitGeometry, fruitMaterial, fruitScale] = useMemo(() => {
        let geom;
        let color;
        let scale = 1.0;
        switch (fruitType) {
            case 'pear':
                // Pear shape is hard with primitives, use sphere + maybe small cone? Or just sphere.
                geom = new THREE.SphereGeometry(0.05, 8, 6); // Small sphere for pear
                color = "#D1E231"; // Yellow-green
                scale = 1;
                break;
            case 'plum':
                geom = new THREE.SphereGeometry(0.04, 8, 6); // Slightly smaller sphere for plum
                color = "#6A0DAD"; // Purple
                scale = 0.5;
                break;
            case 'apple':
            default:
                geom = new THREE.SphereGeometry(0.045, 8, 6); // Sphere for apple
                color = "#FF6347"; // Tomato red
                scale = 1.5;
                break;
        }
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
        return [geom, mat, scale];
    }, [fruitType]);

    // --- Fruit Instancing ---
    const fruitCount = useMemo(() => {
        // Only calculate if fruits should be shown based on props and season
         if (!showFruit) return 0;

         // Approximate the volume of the foliage ellipsoid
         // Volume of ellipsoid = (4/3) * PI * a * b * c
         // Here, a = c = currentFoliageRadiusXZ, b = currentFoliageRadiusY
         const volume = (4 / 3) * Math.PI * currentFoliageRadiusXZ * currentFoliageRadiusY * currentFoliageRadiusXZ;

         // Calculate count based on density and volume
         // Adjust the final multiplier (e.g., 0.5) to get the desired visual density
         const calculatedCount = Math.floor(fruitDensity * volume * 0.5);

         // Clamp the count between 0 and MAX_FRUITS
         return Math.min(MAX_FRUITS, Math.max(0, calculatedCount));

    // Depend on parameters affecting fruit presence and volume
    }, [showFruit, fruitDensity, currentFoliageRadiusXZ, currentFoliageRadiusY]);

    useLayoutEffect(() => { // Fruit position effect
        if (!showFruit || !fruitMeshRef.current || fruitCount === 0) { if(fruitMeshRef.current) fruitMeshRef.current.count = 0; return; };
        const mesh = fruitMeshRef.current;

        for (let i = 0; i < fruitCount; i++) {
            // Position randomly near the surface of the foliage ellipsoid
            const phi = Math.acos(2 * Math.random() - 1); const theta = Math.random() * Math.PI * 2;
            // Point on surface
            const rSurfaceXZ = currentFoliageRadiusXZ;
            const rSurfaceY = currentFoliageRadiusY;
            const xSurf = rSurfaceXZ * Math.sin(phi) * Math.cos(theta);
            const ySurf = rSurfaceY * Math.cos(phi);
            const zSurf = rSurfaceXZ * Math.sin(phi) * Math.sin(theta);
             // Add slight random offset inwards/outwards from surface
             const offsetFactor = 1.0 + (Math.random() * 0.2 - 0.1); // e.g., 0.9 to 1.1

            tempObject.position.set(
                xSurf * offsetFactor,
                ySurf * offsetFactor + foliageCenterY, // Offset from foliage center
                zSurf * offsetFactor
            );

            tempObject.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            tempObject.scale.setScalar(fruitScale);
            tempObject.updateMatrix(); mesh.setMatrixAt(i, tempObject.matrix);
        }
        mesh.count = fruitCount; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();

    }, [showFruit, fruitCount, currentFoliageRadiusXZ, currentFoliageRadiusY, foliageCenterY, fruitGeometry, fruitScale]); // Use scaled radii

    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="deciduous_tree">
            {/* Single Main Trunk */}
            <mesh position={[0, currentTrunkHeight / 2, 0]} scale={[currentTrunkDiameter / trunkDiameter || 0.01, currentTrunkHeight / trunkHeight || 0.01, currentTrunkDiameter / trunkDiameter || 0.01]} castShadow>
                <cylinderGeometry args={[trunkDiameter * 0.4, trunkDiameter * 0.5, trunkHeight, 8]} />
                <meshStandardMaterial color={trunkColor} />
            </mesh>

            {branchCount > 0 && (
                 <instancedMesh ref={branchMeshRef} args={[branchGeometry, branchMaterial, branchCount]} castShadow receiveShadow />
            )}

            {/* Foliage - Scaled sphere (ellipsoid) */}
            {hasLeaves && (
                 <mesh position={[0, foliageCenterY, 0]} scale={[currentFoliageRadiusXZ*2, currentFoliageRadiusY*2, currentFoliageRadiusXZ*2]} castShadow> {/* Scale sphere geometry */}
                    <sphereGeometry args={[0.5, 12, 8]} />{/* Base radius 0.5 */}
                    <meshStandardMaterial color={currentFoliageColor} roughness={0.8} metalness={0.1} transparent={true} opacity={foliageOpacity} depthWrite={foliageOpacity > 0.95} />
                </mesh>
            )}
             {/* Fruits - Instanced Mesh */}
             {showFruit && fruitCount > 0 && (
                <instancedMesh
                    ref={fruitMeshRef}
                    args={[fruitGeometry, fruitMaterial, fruitCount]}
                    castShadow
                />
             )}
        </ObjectBase>
    );
});

// Define what's editable for DeciduousTree
DeciduousTree.editorSchema = [
    { name: 'trunkHeight', label: 'Trunk H', type: 'number', step: 0.1, min: 0.2, max: 5, defaultValue: 1.0 },
    { name: 'trunkDiameter', label: 'Trunk Ø', type: 'number', step: 0.05, min: 0.05, max: 1.5, defaultValue: 0.25 },
    { name: 'branchDensity', label: 'Branch Density', type: 'number', step: 1, min: 0, max: 100, defaultValue: 40 },
    { name: 'branchLengthMax', label: 'Branch Length', type: 'number', step: 0.05, min: 0.1, max: 1.5, defaultValue: 0.8 },
    { name: 'branchDiameter', label: 'Branch Ø', type: 'number', step: 0.01, min: 0.01, max: 0.5, defaultValue: 0.08 },
    { name: 'foliageDiameter', label: 'Foliage Base Ø', type: 'number', step: 0.1, min: 0.3, max: 6, defaultValue: 1.8 },
    { name: 'foliageScaleXZ', label: 'Foliage Scale XZ', type: 'number', step: 0.05, min: 0.2, max: 2.0, defaultValue: 1.0 },
    { name: 'foliageScaleY', label: 'Foliage Scale Y', type: 'number', step: 0.05, min: 0.2, max: 2.0, defaultValue: 1.0 },
    { name: 'foliageOpacity', label: 'Foliage Opacity', type: 'number', step: 0.05, min: 0.1, max: 1.0, defaultValue: 0.85 },
    { name: 'fruitDensity', label: 'Fruit Density', type: 'number', step: 1, min: 0, max: 100, defaultValue: 30 },
    { name: 'trunkColor', label: 'Trunk Clr', type: 'color', defaultValue: "#A0522D" },
    { name: 'branchColor', label: 'Branch Clr', type: 'color', defaultValue: null }, // Allow separate branch color
    { name: 'foliageColor', label: 'Summer Clr', type: 'color', defaultValue: "#559040" },
    { name: 'fruitType', label: 'Fruit Type', type: 'select', options: ['apple', 'pear', 'plum', 'none'], defaultValue: 'apple' },
];
