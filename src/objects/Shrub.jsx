// src/objects/Shrub.jsx

import React, { useRef, useMemo, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { ObjectBase } from './ObjectBase';
import { createRandom } from '../utils';

const lerp = THREE.MathUtils.lerp;
const tempObject = new THREE.Object3D();
const UP_VECTOR = new THREE.Vector3(0, 1, 0);

export const Shrub = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1,
    color = "#556B2F", maxRadius = 0.4, currentMonth = 6, rotationY = 0,
}) => {
    const random = createRandom(objectId || (position ? position.join(',') : 'obj'));

    const currentRadius = lerp(0.1, maxRadius, globalAge);
    
    const leafMeshRef = useRef();
    const branchMeshRef = useRef();

    const isWinter = useMemo(() => currentMonth >= 11 || currentMonth <= 3, [currentMonth]);
    const isSpring = useMemo(() => currentMonth >= 4 && currentMonth <= 5, [currentMonth]);

    const leafColor = useMemo(() => {
        if (isSpring) return "#8FBC8F"; // Brighter green for spring
        return color;
    }, [isSpring, color]);

    const [leafGeo, leafMat] = useMemo(() => [
        new THREE.SphereGeometry(1, 8, 6),
        new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.9, depthWrite: false })
    ], [leafColor]);

    const [branchGeo, branchMat] = useMemo(() => [
        new THREE.CylinderGeometry(0.5, 0.5, 1, 5).translate(0, 0.5, 0),
        new THREE.MeshStandardMaterial({ color: "#5C4033", roughness: 1.0 })
    ], []);

    const numLeaves = 25;
    const numBranches = 12;

    useLayoutEffect(() => {
        if (!leafMeshRef.current || !branchMeshRef.current) return;

        // --- Generate Leaves ---
        const leafMesh = leafMeshRef.current;
        if (!isWinter) {
            for (let i = 0; i < numLeaves; i++) {
                // Random position within a sphere, biased slightly upwards
                const u = random();
                const v = random();
                const theta = u * 2 * Math.PI;
                const phi = Math.acos(2 * v - 1);
                // Distribute more towards the outer shell
                const r = Math.pow(random(), 1/3) * currentRadius * 0.8;

                const x = r * Math.sin(phi) * Math.cos(theta);
                const y = r * Math.cos(phi) + currentRadius * 0.8; // Center slightly up
                const z = r * Math.sin(phi) * Math.sin(theta);

                // Flatten the bottom so it sits nicely on the ground
                const adjustedY = Math.max(currentRadius * 0.2, y);

                tempObject.position.set(x, adjustedY, z);
                tempObject.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
                const scale = currentRadius * (0.4 + random() * 0.5); // Varying sizes
                tempObject.scale.setScalar(scale);
                tempObject.updateMatrix();
                leafMesh.setMatrixAt(i, tempObject.matrix);
            }
            leafMesh.count = numLeaves;
            leafMesh.instanceMatrix.needsUpdate = true;
            leafMesh.visible = true;
        } else {
            leafMesh.visible = false;
        }

        // --- Generate Branches ---
        const branchMesh = branchMeshRef.current;
        for (let i = 0; i < numBranches; i++) {
            // Radiate outwards from the bottom center
            const angle = random() * Math.PI * 2;
            const spread = random() * 0.7 + 0.1; // Spread factor: 0=up, 1=flat
            const dir = new THREE.Vector3(Math.cos(angle) * spread, 1 - spread * 0.5, Math.sin(angle) * spread).normalize();
            
            const length = currentRadius * (0.8 + random() * 0.6);
            const thickness = currentRadius * 0.05 * (0.6 + random() * 0.6);

            tempObject.position.set(0, 0, 0);
            tempObject.scale.set(thickness, length, thickness);
            tempObject.quaternion.setFromUnitVectors(UP_VECTOR, dir);
            tempObject.updateMatrix();
            branchMesh.setMatrixAt(i, tempObject.matrix);
        }
        branchMesh.count = numBranches;
        branchMesh.instanceMatrix.needsUpdate = true;

    }, [currentRadius, isWinter, leafGeo, leafMat, branchGeo, branchMat]);

    return (
        <ObjectBase position={position} rotationY={rotationY} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="shrub">
            <instancedMesh ref={branchMeshRef} args={[branchGeo, branchMat, numBranches]} castShadow receiveShadow />
            <instancedMesh ref={leafMeshRef} args={[leafGeo, leafMat, numLeaves]} castShadow receiveShadow />
        </ObjectBase>
    );
});

// Define what's editable for a Shrub
Shrub.editorSchema = [
    { name: 'maxRadius', label: 'Radius', type: 'number', step: 0.1, min: 0.1, max: 2.5, defaultValue: 0.4 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: "#556B2F" },
    { name: 'rotationY', label: 'Rotation Y', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
