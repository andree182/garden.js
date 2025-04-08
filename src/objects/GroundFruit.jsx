// src/objects/GroundFruit.jsx
import React, { memo, useMemo, useRef, useLayoutEffect, useState } from 'react';
import * as THREE from 'three';
import { ObjectBase } from './ObjectBase';
import { Sphere } from '@react-three/drei';

const lerp = THREE.MathUtils.lerp;
const tempMatrix = new THREE.Matrix4();
const tempObject = new THREE.Object3D();

const MAX_GROUND_FRUITS = 500;

export const GroundFruit = memo(({ position, isSelected, onSelect, onPointerDown, objectId, rotationY = 0, globalAge = 1, currentMonth = 6,
    patchDiameter = 0.5,
    fruitColor = "#DC143C", // Crimson red for strawberries
    fruitSize = 0.02,
    fruitDensity = 100,
    leafColor = "#6B8E23", // Olive drab leaves
    leafDensity = 80,
    fruitPresenceMonths = [6, 7], // June/July for strawberries
}) => {
    const fruitMeshRef = useRef();
    const leafMeshRef = useRef(); // Instanced mesh for leaves

    // --- Seasonal/State Calculations ---
    const hasFruit = useMemo(() => fruitPresenceMonths.includes(currentMonth), [currentMonth, fruitPresenceMonths]);
    // Assume leaves are always present unless it's deep winter? Or always present.
    const hasLeaves = true; // Or: useMemo(() => !(currentMonth >= 12 || currentMonth <= 2), [currentMonth]);

    // --- Aged Dimensions ---
    const currentDiameter = lerp(0.1, patchDiameter, globalAge);
    const patchRadius = currentDiameter / 2;
    const currentFruitSize = lerp(0.005, fruitSize, globalAge);
    const currentLeafSize = lerp(0.01, 0.04, globalAge); // Leaves also scale with age

    // --- Fruit Geometry/Material ---
    const [fruitGeometry, fruitMaterial] = useMemo(() => {
        const geom = new THREE.SphereGeometry(currentFruitSize, 5, 4); // Low poly sphere
        const mat = new THREE.MeshStandardMaterial({ color: fruitColor, roughness: 0.6 });
        return [geom, mat];
    }, [currentFruitSize, fruitColor]);

    // --- Leaf Geometry/Material ---
    const [leafGeometry, leafMaterial] = useMemo(() => {
        // Simple plane for a leaf
        const geom = new THREE.PlaneGeometry(currentLeafSize, currentLeafSize * 0.6); // Rectangular leaf
        const mat = new THREE.MeshStandardMaterial({ color: leafColor, side: THREE.DoubleSide, roughness: 0.8 });
        return [geom, mat];
    }, [currentLeafSize, leafColor]);


    // --- Instancing Counts ---
    const fruitCount = useMemo(() => {
        if (!hasFruit) return 0;
        const area = Math.PI * patchRadius ** 2;
        const calculatedCount = Math.floor(fruitDensity * area * 3); // Adjust multiplier
        return Math.min(MAX_GROUND_FRUITS, Math.max(0, calculatedCount));
    }, [hasFruit, fruitDensity, patchRadius]);

    const leafCount = useMemo(() => {
        if (!hasLeaves) return 0;
        const area = Math.PI * patchRadius ** 2;
        const calculatedCount = Math.floor(leafDensity * area * 5); // Adjust multiplier
        return Math.min(MAX_GROUND_FRUITS * 2, Math.max(0, calculatedCount)); // Allow more leaves
    }, [hasLeaves, leafDensity, patchRadius]);


    // --- Instance Effects (Fruits & Leaves) ---
    useLayoutEffect(() => { // Fruit positions
        if (!hasFruit || !fruitMeshRef.current || fruitCount === 0 || !fruitGeometry || !fruitMaterial) { if(fruitMeshRef.current) fruitMeshRef.current.count = 0; return; }
        const mesh = fruitMeshRef.current;
        for (let i = 0; i < fruitCount; i++) {
            const radius = Math.sqrt(Math.random()) * patchRadius;
            const angle = Math.random() * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            // Position slightly above ground plane
            tempObject.position.set(x, currentFruitSize * 0.5 + 0.005, z);
            tempObject.rotation.set(Math.random() * 0.2, Math.random() * Math.PI * 2, Math.random() * 0.2); // Slight random tilt
            tempObject.scale.setScalar(1);
            tempObject.updateMatrix(); mesh.setMatrixAt(i, tempObject.matrix);
        }
        mesh.count = fruitCount; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    }, [hasFruit, fruitCount, patchRadius, fruitGeometry, fruitMaterial, currentFruitSize]);

    useLayoutEffect(() => { // Leaf positions
        if (!hasLeaves || !leafMeshRef.current || leafCount === 0 || !leafGeometry || !leafMaterial) { if(leafMeshRef.current) leafMeshRef.current.count = 0; return; }
        const mesh = leafMeshRef.current;
        for (let i = 0; i < leafCount; i++) {
            const radius = Math.sqrt(Math.random()) * patchRadius;
            const angle = Math.random() * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            // Position flat on ground plane, slightly above to avoid z-fighting
            tempObject.position.set(x, 0.006, z);
            tempObject.rotation.set(-Math.PI / 2 + (Math.random() * 0.4 - 0.2), Math.random() * Math.PI * 2, 0); // Lay flat with random twist/tilt
            tempObject.scale.setScalar(1);
            tempObject.updateMatrix(); mesh.setMatrixAt(i, tempObject.matrix);
        }
        mesh.count = leafCount; mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere();
    }, [hasLeaves, leafCount, patchRadius, leafGeometry, leafMaterial]);


    return (
        // Position base at ground level
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="ground_fruit" rotationY={rotationY}>
             {/* Leaves */}
             {hasLeaves && leafCount > 0 && leafGeometry && leafMaterial && (
                 <instancedMesh ref={leafMeshRef} args={[leafGeometry, leafMaterial, leafCount]} receiveShadow /> // Leaves receive shadow
             )}
             {/* Fruits */}
             {hasFruit && fruitCount > 0 && fruitGeometry && fruitMaterial && (
                <instancedMesh ref={fruitMeshRef} args={[fruitGeometry, fruitMaterial, fruitCount]} castShadow />
             )}
        </ObjectBase>
    );
});

GroundFruit.editorSchema = [
    { name: 'patchDiameter', label: 'Patch Diameter', type: 'number', step: 0.05, min: 0.1, max: 2.0, defaultValue: 0.5 },
    { name: 'fruitColor', label: 'Fruit Color', type: 'color', defaultValue: "#DC143C" },
    { name: 'fruitSize', label: 'Fruit Size', type: 'number', step: 0.001, min: 0.005, max: 0.05, defaultValue: 0.02 },
    { name: 'fruitDensity', label: 'Fruit Density', type: 'number', step: 10, min: 0, max: 500, defaultValue: 100 },
    { name: 'leafColor', label: 'Leaf Color', type: 'color', defaultValue: "#6B8E23" },
    { name: 'leafDensity', label: 'Leaf Density', type: 'number', step: 10, min: 0, max: 500, defaultValue: 80 },
    // fruitPresenceMonths maybe not easily editable
    { name: 'rotationY', label: 'Rotation', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
