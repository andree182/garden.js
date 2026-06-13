// src/objects/SmallFlower.jsx
import React, { memo, useMemo, useRef, useLayoutEffect, useState } from 'react';
import * as THREE from 'three';
import { ObjectBase } from './ObjectBase';
import { createRandom } from '../utils';
import { Cylinder, Sphere, Cone } from '@react-three/drei'; // Use basic shapes

const lerp = THREE.MathUtils.lerp;
const tempMatrix = new THREE.Matrix4();
const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();
const tempQuaternion = new THREE.Quaternion();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const MAX_FLOWERS_PER_PATCH = 300;

// // Simple reusable geometries
const stemGeometry = new THREE.CylinderGeometry(0.008, 0.01, 1, 5); // radiusTop, radiusBottom, height, segments
stemGeometry.translate(0, 0.5, 0); // Pivot at bottom
const leafGeometry = new THREE.BoxGeometry(0.03, 0.004, 0.012);
leafGeometry.translate(0.015, 0, 0); // Pivot at leaf base
const headGeometrySphere = new THREE.SphereGeometry(1, 8, 6); // Base radius 1, scaled later
const headGeometryCone = new THREE.ConeGeometry(1, 1, 6); // Base radius 1, height 1, scaled later
headGeometryCone.translate(0, 0.5, 0); // Pivot cone base

export const SmallFlower = memo(({ position, isSelected, onSelect, onPointerDown, objectId, rotationY = 0, globalAge = 1, currentMonth = 6,
    patchDiameter = 0.4,
    stemColor = "#556B2F", // Dark Olive Green
    flowerColor = "#FF69B4", // Hot Pink default
    flowerShape = 'sphere', // 'sphere', 'cone'
    flowerSize = 0.03,
    stemHeight = 0.15,
    density = 150,
    bloomMonths = [4, 5, 6, 7, 8], // Apr-Aug default bloom
}) => {
    const random = createRandom(objectId || (position ? position.join(',') : 'obj'));

    const stemMeshRef = useRef();
    const leafMeshRef = useRef();
    const headMeshRef = useRef();

    // --- Seasonal/State Calculations ---
    const isBlooming = useMemo(() => bloomMonths.includes(currentMonth), [currentMonth, bloomMonths]);
    // Leaves/stems generally present unless deep winter?
    const hasStems = true; // !(currentMonth >= 12 || currentMonth <= 2);

    // --- Aged Dimensions ---
    const currentDiameter = lerp(0.1, patchDiameter, globalAge);
    const patchRadius = currentDiameter / 2;
    const currentStemHeight = lerp(0.02, stemHeight, globalAge);
    const currentFlowerSize = lerp(0.005, flowerSize, globalAge * (isBlooming ? 1 : 0.5)); // Smaller if not blooming

    // --- Materials ---
    const stemMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: stemColor, roughness: 0.8 }), [stemColor]);
    const headMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: flowerColor, roughness: 0.7 }), [flowerColor]);

    // --- Geometry Selection ---
    const selectedHeadGeometry = useMemo(() => {
        return flowerShape === 'cone' ? headGeometryCone : headGeometrySphere;
    }, [flowerShape]);

    // --- Instancing Counts ---
    const instanceCount = useMemo(() => {
        if (!hasStems) return 0;
        const area = Math.PI * patchRadius ** 2;
        const calculatedCount = Math.floor(density * area * 10); // Adjust multiplier
        return Math.min(MAX_FLOWERS_PER_PATCH, Math.max(0, calculatedCount));
    }, [hasStems, density, patchRadius]);


    // --- Instance Effects (Stems & Heads) ---
    useLayoutEffect(() => {
        if (!hasStems || !stemMeshRef.current || !leafMeshRef.current || !headMeshRef.current || instanceCount === 0) {
             if(stemMeshRef.current) stemMeshRef.current.count = 0;
             if(leafMeshRef.current) leafMeshRef.current.count = 0;
             if(headMeshRef.current) headMeshRef.current.count = 0;
             return;
        }
        const stemMesh = stemMeshRef.current;
        const leafMesh = leafMeshRef.current;
        const headMesh = headMeshRef.current;

        for (let i = 0; i < instanceCount; i++) {
            // Position within patch
            const radius = Math.sqrt(random()) * patchRadius;
            const angle = random() * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            // --- Stem Transform ---
            tempObject.position.set(x, 0, z); // Start stem at base Y
            tempObject.rotation.set(random()*0.1 - 0.05, 0, random()*0.1 - 0.05); // Slight random lean
            tempObject.scale.set(1, currentStemHeight, 1);
            tempObject.updateMatrix();
            stemMesh.setMatrixAt(i, tempObject.matrix);

            // --- Leaf 1 Transform ---
            tempObject.position.set(x, currentStemHeight * 0.35, z);
            tempObject.rotation.set(0.15, random() * Math.PI * 2, 0.25);
            tempObject.scale.set(1.0 * globalAge, 1.0, 1.0);
            tempObject.updateMatrix();
            leafMesh.setMatrixAt(i * 2, tempObject.matrix);

            // --- Leaf 2 Transform ---
            tempObject.position.set(x, currentStemHeight * 0.6, z);
            tempObject.rotation.set(-0.15, random() * Math.PI * 2, -0.25);
            tempObject.scale.set(0.75 * globalAge, 1.0, 1.0);
            tempObject.updateMatrix();
            leafMesh.setMatrixAt(i * 2 + 1, tempObject.matrix);

            // --- Head Transform ---
            // Position head at the top of the scaled stem
            tempObject.position.set(x, currentStemHeight, z);
            // Inherit stem lean, maybe add slight droop?
            tempObject.rotation.x += random() * 0.1 - 0.05;
            tempObject.rotation.z += random() * 0.1 - 0.05;
            tempObject.scale.setScalar(currentFlowerSize); // Scale head based on blooming/age
            tempObject.updateMatrix();
            headMesh.setMatrixAt(i, tempObject.matrix);
        }
        stemMesh.count = instanceCount;
        leafMesh.count = instanceCount * 2;
        headMesh.count = isBlooming ? instanceCount : 0; // Only show heads if blooming

        stemMesh.instanceMatrix.needsUpdate = true;
        leafMesh.instanceMatrix.needsUpdate = true;
        headMesh.instanceMatrix.needsUpdate = true;
        stemMesh.computeBoundingSphere();
        leafMesh.computeBoundingSphere();
        headMesh.computeBoundingSphere();

    }, [hasStems, isBlooming, instanceCount, patchRadius, currentStemHeight, currentFlowerSize, stemGeometry, selectedHeadGeometry]); // Add geom dependencies


    return (
        // Position base at ground level
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="small_flower" rotationY={rotationY}>
             {/* Stems */}
             {hasStems && instanceCount > 0 && (
                  <instancedMesh ref={stemMeshRef} args={[stemGeometry, stemMaterial, instanceCount]} castShadow receiveShadow />
             )}
             {/* Leaves */}
             {hasStems && instanceCount > 0 && (
                  <instancedMesh ref={leafMeshRef} args={[leafGeometry, stemMaterial, instanceCount * 2]} castShadow receiveShadow />
             )}
             {/* Flower Heads (conditionally rendered by count) */}
             {instanceCount > 0 && (
                  <instancedMesh ref={headMeshRef} args={[selectedHeadGeometry, headMaterial, instanceCount]} castShadow />
             )}
        </ObjectBase>
    );
});

SmallFlower.editorSchema = [
    { name: 'patchDiameter', label: 'Patch Diameter', type: 'number', step: 0.05, min: 0.1, max: 1.5, defaultValue: 0.4 },
    { name: 'density', label: 'Density', type: 'number', step: 10, min: 10, max: 500, defaultValue: 150 },
    { name: 'stemHeight', label: 'Stem Height', type: 'number', step: 0.01, min: 0.05, max: 0.5, defaultValue: 0.15 },
    { name: 'flowerSize', label: 'Flower Size', type: 'number', step: 0.005, min: 0.01, max: 0.1, defaultValue: 0.03 },
    { name: 'stemColor', label: 'Stem Color', type: 'color', defaultValue: "#556B2F" },
    { name: 'flowerColor', label: 'Flower Color', type: 'color', defaultValue: "#FF69B4" },
    { name: 'flowerShape', label: 'Flower Shape', type: 'select', options: ['sphere', 'cone'], defaultValue: 'sphere' },
    // bloomMonths maybe not easily editable
    { name: 'rotationY', label: 'Rotation', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
