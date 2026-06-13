// src/objects/SmallFruitBush.jsx
import React, { memo, useMemo, useRef, useLayoutEffect, useState } from 'react';
import * as THREE from 'three';
import { ObjectBase } from './ObjectBase';
import { createRandom } from '../utils';
import { Sphere } from '@react-three/drei'; // Keep for fruits

const lerp = THREE.MathUtils.lerp;
const tempMatrix = new THREE.Matrix4();
const tempObject = new THREE.Object3D();
const tempVec = new THREE.Vector3();

const MAX_BERRIES = 1000; // Performance limit

export const SmallFruitBush = memo(({ position, isSelected, onSelect, onPointerDown, objectId, rotationY = 0, globalAge = 1, currentMonth = 6,
    // Foliage Shape
    bushDiameter = 0.6, // Base diameter for XZ
    bushHeight = 0.5,
    flattenBottom = 0.2, // 0 = sphere, 1 = hemisphere cut at equator, 0.2 = cut slightly
    // Appearance
    foliageColor = "#3B5323", // Dark green
    fruitColor = "#FF0000", // Default red berry
    fruitSize = 0.015,
    fruitDensity = 150, // Higher density for small berries
    fruitPresenceMonths = [7, 8, 9], // Months when fruit is visible (July-Sep default)
}) => {
    const random = createRandom(objectId || (position ? position.join(',') : 'obj'));

    const fruitMeshRef = useRef();

    // --- Seasonal/State Calculations ---
    const isWinter = useMemo(() => currentMonth >= 12 || currentMonth <= 2, [currentMonth]);
    const hasLeaves = !isWinter;
    const hasFruit = useMemo(() => fruitPresenceMonths.includes(currentMonth), [currentMonth, fruitPresenceMonths]);

    // --- Aged Dimensions ---
    const currentDiameter = lerp(0.1, bushDiameter, globalAge);
    const currentHeight = lerp(0.1, bushHeight, globalAge);
    const radiusXZ = currentDiameter / 2;
    const radiusY = currentHeight / 2;

    // --- Foliage Appearance & Position ---
    const foliageCenterY = radiusY; // Center the foliage mass above ground

    // --- Fruit Geometry/Material ---
    const [fruitGeometry, fruitMaterial] = useMemo(() => {
        const geom = new THREE.SphereGeometry(fruitSize, 5, 4); // Low poly sphere for berries
        const mat = new THREE.MeshStandardMaterial({ color: fruitColor, roughness: 0.7, metalness: 0.1 });
        return [geom, mat];
    }, [fruitSize, fruitColor]); // Depend on editable props

    // --- Fruit Instancing ---
    const fruitCount = useMemo(() => {
        if (!hasFruit) return 0;
        // Approx volume of potentially flattened ellipsoid
        const volumeFactor = (4/3) * Math.PI * radiusXZ * radiusY * radiusXZ * (1 - flattenBottom * 0.5); // Reduce volume based on flattening
        const calculatedCount = Math.floor(fruitDensity * volumeFactor * 15); // Adjust multiplier for visual density
        return Math.min(MAX_BERRIES, Math.max(0, calculatedCount));
    }, [hasFruit, fruitDensity, radiusXZ, radiusY, flattenBottom]);

    useLayoutEffect(() => { // Fruit position effect
        if (!hasFruit || !fruitMeshRef.current || fruitCount === 0 || !fruitGeometry || !fruitMaterial) {
             if(fruitMeshRef.current) fruitMeshRef.current.count = 0; return;
        }
        const mesh = fruitMeshRef.current;
        const minY = -radiusY + radiusY * 2 * (flattenBottom * 0.5); // Minimum Y for fruit placement based on flatten

        for (let i = 0; i < fruitCount; i++) {
            // Position near surface of the potentially flattened ellipsoid
            const phi = Math.acos(2 * random() - 1);
            const theta = random() * Math.PI * 2;
            const offsetFactor = 0.9 + random() * 0.2; // 0.9 to 1.1

            const xSurf = radiusXZ * Math.sin(phi) * Math.cos(theta);
            const ySurfRelative = radiusY * Math.cos(phi); // Y relative to center
            const zSurf = radiusXZ * Math.sin(phi) * Math.sin(theta);

            // Discard points below the flatten line if needed (more accurate but less dense near bottom)
            // Or just place them relative to foliageCenterY
             let finalYRelative = ySurfRelative;
            // Ensure fruits are above the flattened bottom if flattenBottom > 0
            // finalYRelative = Math.max(minY, ySurfRelative); // This might cluster them

            tempObject.position.set(
                xSurf * offsetFactor,
                finalYRelative * offsetFactor + foliageCenterY, // Offset from foliage center
                zSurf * offsetFactor
            );

            tempObject.rotation.set(0,0,0); // Berries likely don't need random rotation
            tempObject.scale.setScalar(1); // Geometry defines size
            tempObject.updateMatrix();
            mesh.setMatrixAt(i, tempObject.matrix);
        }
        mesh.count = fruitCount;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
    }, [hasFruit, fruitCount, radiusXZ, radiusY, foliageCenterY, fruitGeometry, fruitMaterial, flattenBottom]);


    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="small_fruit_bush" rotationY={rotationY}>
             {/* Stems supporting the bush (visible year-round) */}
             <mesh position={[-0.03, foliageCenterY * 0.4, 0.01]} rotation={[0.1, 0, 0.15]} castShadow>
                 <cylinderGeometry args={[0.01 * globalAge, 0.018 * globalAge, foliageCenterY * 0.8, 6]} />
                 <meshStandardMaterial color="#8B5A2B" roughness={0.9} />
             </mesh>
             <mesh position={[0.03, foliageCenterY * 0.45, -0.02]} rotation={[-0.1, 0, -0.15]} castShadow>
                 <cylinderGeometry args={[0.009 * globalAge, 0.016 * globalAge, foliageCenterY * 0.9, 6]} />
                 <meshStandardMaterial color="#8B5A2B" roughness={0.9} />
             </mesh>

             {/* Foliage - Clustered spheres */}
             {hasLeaves && (
                 <group>
                     {/* Left/lower sphere */}
                     <mesh position={[-radiusXZ * 0.2, foliageCenterY, 0]} castShadow receiveShadow>
                         <sphereGeometry args={[radiusXZ * 0.8, 12, 10]} />
                         <meshStandardMaterial color={foliageColor} roughness={0.8} metalness={0.1} />
                     </mesh>
                     {/* Right/lower sphere */}
                     <mesh position={[radiusXZ * 0.25, foliageCenterY * 0.9, 0.05]} castShadow receiveShadow>
                         <sphereGeometry args={[radiusXZ * 0.72, 12, 10]} />
                         <meshStandardMaterial color={foliageColor} roughness={0.8} metalness={0.1} />
                     </mesh>
                     {/* Top center sphere */}
                     <mesh position={[0, foliageCenterY * 1.12, -0.05]} castShadow receiveShadow>
                         <sphereGeometry args={[radiusXZ * 0.75, 12, 10]} />
                         <meshStandardMaterial color={foliageColor} roughness={0.8} metalness={0.1} />
                     </mesh>
                 </group>
             )}
              {/* Fruits */}
              {hasFruit && fruitCount > 0 && fruitGeometry && fruitMaterial && (
                 <instancedMesh ref={fruitMeshRef} args={[fruitGeometry, fruitMaterial, fruitCount]} castShadow />
              )}
        </ObjectBase>
    );
});

SmallFruitBush.editorSchema = [
    { name: 'bushDiameter', label: 'Diameter', type: 'number', step: 0.05, min: 0.2, max: 2.0, defaultValue: 0.6 },
    { name: 'bushHeight', label: 'Height', type: 'number', step: 0.05, min: 0.1, max: 2.0, defaultValue: 0.5 },
    { name: 'flattenBottom', label: 'Flatten Bottom', type: 'number', step: 0.05, min: 0, max: 0.9, defaultValue: 0.2 }, // How much to flatten (0=none, 0.5=hemisphere)
    { name: 'foliageColor', label: 'Foliage Color', type: 'color', defaultValue: "#3B5323" },
    { name: 'fruitColor', label: 'Fruit Color', type: 'color', defaultValue: "#FF0000" },
    { name: 'fruitSize', label: 'Fruit Size', type: 'number', step: 0.001, min: 0.005, max: 0.05, defaultValue: 0.015 },
    { name: 'fruitDensity', label: 'Fruit Density', type: 'number', step: 10, min: 0, max: 500, defaultValue: 150 },
    // fruitPresenceMonths is harder to edit via simple UI, keep fixed for now or use multi-select later
    { name: 'rotationY', label: 'Rotation', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
