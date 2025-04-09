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

// --- NEW Grass Component using InstancedMesh ---
const MAX_GRASS_BLADES = 500; // Performance limit

export const Grass = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1,
    // Parameters with defaults
    baseDiameter = 0.5,
    length = 0.3,
    bottomColor = "#224411",
    topColor = "#66AA44",
    colorRatio = 0.5,
    density = 50,
    straightness = 0.7,
    currentMonth = 6
 }) => {

    const instancedMeshRef = useRef();
    const baseBladeWidth = 0.025; // Width of a single blade plane

    // Memoize geometry and material
    const [geometry, material] = useMemo(() => {
        // Use PlaneGeometry for a single blade (width, height)
        const geom = new THREE.PlaneGeometry(baseBladeWidth, 1, 1, 1); // Height is 1 initially, scaled later
        // Translate geometry so the pivot (origin) is at the bottom center
        geom.translate(0, 0.5, 0);

        // Ensure geometry has vertex colors attribute
        if (!geom.attributes.color) {
            const vertexCount = geom.attributes.position.count;
            geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
        }

        // Material that uses vertex colors and is double-sided
        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.8, // More matte appearance for grass
            metalness: 0.05,
            side: THREE.DoubleSide, // Render both sides of the plane
            shadowSide: THREE.DoubleSide // Allow shadows on both sides if needed
        });
        return [geom, mat];
    }, []); // Recreate only if baseBladeWidth changes (which it doesn't here)

    // Calculate instance count based on density
    const count = useMemo(() => {
        return MAX_GRASS_BLADES * density / 100; // Adjust multiplier for visual density
    }, [density, baseDiameter]);

    const [seasonalBottomColor, seasonalTopColor] = useMemo(() => {
        const isWinter = currentMonth >= 11 || currentMonth <= 3;
        if (isWinter) {
            return ["#BDB76B", "#CDC08C"]; // Yellowish/brown winter colors
        } else {
            // Use the editable prop colors for other seasons
            return [bottomColor, topColor];
        }
    }, [currentMonth, bottomColor, topColor]);

    // Effect to update vertex colors when color props change
    useEffect(() => {
        if (!geometry || !geometry.attributes.color) return;

        const colors = geometry.attributes.color.array;
        const positions = geometry.attributes.position.array;
        const bColor = new THREE.Color(seasonalBottomColor);
        const tColor = new THREE.Color(seasonalTopColor);
        const vertexCount = geometry.attributes.position.count;

        // Clamp colorRatio to avoid division by zero or invalid ranges
        const ratio = Math.max(0.01, Math.min(0.99, colorRatio)); // TODO: doesn't do anything

        for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
            const positionIndex = vertexIndex * 3;
            const yPosIndex = positionIndex + 1;
            const normalizedY = positions[yPosIndex]; // 0 (bottom) to 1 (top)

            let lerpFactor;
            if (normalizedY < ratio) {
                lerpFactor = (normalizedY / ratio) * 0.5;
            } else {
                lerpFactor = 0.5 + ((normalizedY - ratio) / (1 - ratio)) * 0.5;
            }
            // Final clamp
            lerpFactor = Math.max(0, Math.min(1, lerpFactor));

            const finalColor = new THREE.Color();
            finalColor.lerpColors(bColor, tColor, lerpFactor);

            const colorIndex = vertexIndex * 3;
            colors[colorIndex] = finalColor.r;
            colors[colorIndex + 1] = finalColor.g;
            colors[colorIndex + 2] = finalColor.b;

            // const logColor = `(${finalColor.r.toFixed(2)}, ${finalColor.g.toFixed(2)}, ${finalColor.b.toFixed(2)})`;
            // if (vertexIndex < 4) console.log(`Vertex ${vertexIndex}: Y=${normalizedY.toFixed(2)}, Lerp=${lerpFactor.toFixed(2)}, Color=${logColor}`);
        }
        geometry.attributes.color.needsUpdate = true;
    }, [geometry, seasonalBottomColor, seasonalTopColor, colorRatio]);


    // Effect to update instance transforms when parameters change
    useLayoutEffect(() => {
        if (!instancedMeshRef.current) return;

        const mesh = instancedMeshRef.current;
        const maxRadius = baseDiameter / 2;
        const currentMaxLength = lerp(0.01, length, globalAge);

        for (let i = 0; i < count; i++) {
            // --- Position ---
            const radius = Math.sqrt(Math.random()) * maxRadius;
            const angle = Math.random() * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            tempObject.position.set(x, 0, z);

            // --- Rotation (Outward Tilt + Random Y) ---
            const randomYRotation = Math.random() * Math.PI * 0.3 - Math.PI * 0.15; // Smaller random twist
            const radialRatio = maxRadius > 0.01 ? radius / maxRadius : 0;
            const maxTilt = Math.PI / 2 * (1 - straightness); // 0 tilt if straightness=1, PI/2 if 0
            const tiltAngle = maxTilt * radialRatio; // Linear interpolation of tilt

            // Axis of tilt is perpendicular to the direction from center (same as before)
            const tiltAxis = tempObject.position.clone().cross(tempObject.up).normalize();
             // Handle case where position is exactly at origin (though unlikely with sqrt(random))
             if (tiltAxis.lengthSq() < 0.001) {
                 tiltAxis.set(1, 0, 0); // Default tilt axis if at center
             }

            // Combine rotations: First apply random Y rotation, then tilt outwards
            const quaternionY = new THREE.Quaternion().setFromAxisAngle(tempObject.up, randomYRotation);
            const quaternionTilt = new THREE.Quaternion().setFromAxisAngle(tiltAxis, -tiltAngle);
            tempObject.quaternion.multiplyQuaternions(quaternionTilt, quaternionY); // Apply Y first, then tilt

            // --- Scale ---
            const lengthFalloff = lerp(1.0, 0.75, radialRatio); // Outer blades are 75% length
            const finalLength = Math.max(0.01, currentMaxLength * lengthFalloff); // Ensure non-zero length
            tempObject.scale.set(1, finalLength, 1); // Scale only Y

            // --- Update Matrix ---
            tempObject.updateMatrix();
            mesh.setMatrixAt(i, tempObject.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();

    }, [count, baseDiameter, length, straightness, globalAge, geometry]); // Dependencies


    return (
         <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="grass">
            <instancedMesh
                ref={instancedMeshRef}
                args={[geometry, material, count]}
                castShadow
                receiveShadow
            />
        </ObjectBase>
    );
});

// Define what's editable for Grass, using new parameters
Grass.editorSchema = [
    { name: 'baseDiameter', label: 'Diameter', type: 'number', step: 0.05, min: 0.1, max: 2.0, defaultValue: 0.5 },
    { name: 'length', label: 'Length', type: 'number', step: 0.05, min: 0.05, max: 1.5, defaultValue: 0.3 },
    { name: 'density', label: 'Density', type: 'number', step: 5, min: 5, max: 100, defaultValue: 50 },
    { name: 'straightness', label: 'Straightness', type: 'number', step: 0.05, min: 0, max: 1, defaultValue: 0.7 },
    { name: 'bottomColor', label: 'Bottom Clr', type: 'color', defaultValue: "#224411" },
    { name: 'topColor', label: 'Top Clr', type: 'color', defaultValue: "#66AA44" },
    { name: 'colorRatio', label: 'Color Ratio', type: 'number', step: 0.05, min: 0.05, max: 1, defaultValue: 0.5 },
];
