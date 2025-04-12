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

export const FencePanel = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge=1,
    width = 1.8, height = 1.2, // Use these for geometry size directly
    // Pattern Properties
    pattern = 'vertical_stripes', // 'vertical_stripes', 'horizontal_stripes', 'wire_mesh'
    rotation = 0,          // Degrees (0-45 typically)
    thickness = 0.08,      // Thickness of stripe or wire (relative to pattern repeat)
    spacing = 0.08,       // Spacing between stripes or wires (relative to pattern repeat)
    color1 = "#BC8F8F",    // Stripe/Wire color
    color2 = "#A0522D",    // Second stripe color / Background for stripes (ignored for wire)
    backgroundColor = null // Optional background plane color (null for transparent)
}) => {
    const meshRef = useRef();
    const backgroundRef = useRef();
    const shaderData = useRef({ // Store uniforms in a ref to pass to material
         uniforms: {
            uTime: { value: 0.0 }, // Can be used for effects later
            uResolution: { value: new THREE.Vector2(width, height)}, // Panel dimensions
            uPattern: { value: 0.0 }, // 0: vert, 1: horiz, 2: wire
            uRotationRad: { value: 0.0 },
            uThickness: { value: 0.0 },
            uSpacing: { value: 0.0 },
            uColor1: { value: new THREE.Color(color1) },
            uColor2: { value: new THREE.Color(color2) }
         }
    });

    // Use PlaneGeometry for simpler UV mapping
    const planeGeometry = useMemo(() => new THREE.PlaneGeometry(width, height), [width, height]);

    // Vertex Shader (Passes UVs and Position)
    const vertexShader = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `;

    // Fragment Shader (Generates Pattern)
    const fragmentShader = `
        uniform float uTime;
        uniform vec2 uResolution; // Not strictly needed if using UVs, but good practice
        uniform float uPattern; // 0: vert, 1: horiz, 2: wire
        uniform float uRotationRad;
        uniform float uThickness;
        uniform float uSpacing;
        uniform vec3 uColor1; // Stripe 1 / Wire
        uniform vec3 uColor2; // Stripe 2
        varying vec2 vUv;

        // Function to rotate UVs
        vec2 rotateUV(vec2 uv, float rotation) {
            float mid = 0.5; // Rotation origin (center)
            return vec2(
                cos(rotation) * (uv.x - mid) - sin(rotation) * (uv.y - mid) + mid,
                cos(rotation) * (uv.y - mid) + sin(rotation) * (uv.x - mid) + mid
            );
        }

        void main() {
            vec2 rotatedUv = rotateUV(vUv, uRotationRad);
            float patternWidth = uThickness + uSpacing; // Total width of one pattern cycle

            if (patternWidth < 0.001) { // Avoid division by zero if spacing/thickness are tiny
                 gl_FragColor = vec4(uColor1, 1.0); // Default to color1 if pattern is invalid
                 return;
            }

            float patternValueX = mod(rotatedUv.x, patternWidth);
            float patternValueY = mod(rotatedUv.y, patternWidth);

            bool isStripe1X = patternValueX < uThickness;
            bool isStripe1Y = patternValueY < uThickness;

            vec3 finalColor = vec3(0.0);
            float finalAlpha = 0.0; // Start fully transparent

            if (uPattern == 0.0) { // Vertical Stripes
                finalColor = isStripe1X ? uColor1 : uColor2;
                finalAlpha = 1.0;
            } else if (uPattern == 1.0) { // Horizontal Stripes
                finalColor = isStripe1Y ? uColor1 : uColor2;
                finalAlpha = 1.0;
            } else if (uPattern == 2.0) { // Wire Mesh
                if (isStripe1X || isStripe1Y) {
                    finalColor = uColor1; // Wire color
                    finalAlpha = 1.0;
                } else {
                    // Discard fragment for see-through effect
                    discard; // Or set finalAlpha = 0.0; if blending issues occur
                }
            } else { // Default fallback (shouldn't happen with select)
                 finalColor = uColor1;
                 finalAlpha = 1.0;
            }

            gl_FragColor = vec4(finalColor, finalAlpha);
        }
    `;

    // Memoize the ShaderMaterial
    const shaderMaterial = useMemo(() => new THREE.ShaderMaterial({
        uniforms: shaderData.current.uniforms,
        premultipliedAlpha: false,
        vertexShader,
        fragmentShader,
        side: THREE.DoubleSide,
        transparent: true, // Necessary for wire mesh discard/alpha
        // depthWrite: false // Consider if alpha blending causes issues
    }), [vertexShader, fragmentShader]); // Recreate only if shaders change

    // Effect to update uniforms when props change
    useEffect(() => {
        const uniforms = shaderData.current.uniforms;
        let patternValue = 0.0;
        if (pattern === 'horizontal_stripes') patternValue = 1.0;
        else if (pattern === 'wire_mesh') {
            patternValue = 2.0;
            backgroundColor = null;
        }

        uniforms.uPattern.value = patternValue;
        uniforms.uRotationRad.value = THREE.MathUtils.degToRad(rotation);
        uniforms.uThickness.value = Math.max(0.001, thickness); // Prevent 0 thickness
        uniforms.uSpacing.value = Math.max(0.001, spacing);   // Prevent 0 spacing
        uniforms.uColor1.value.set(color1);
        uniforms.uColor2.value.set(color2);
        uniforms.uResolution.value.set(width, height); // Update resolution if size changes

        if (meshRef.current) meshRef.current.material = shaderMaterial; // Ensure material assigned
        if (backgroundRef.current) backgroundRef.current.visible = backgroundColor !== null && backgroundColor !== undefined;

    }, [pattern, rotation, thickness, spacing, color1, color2, width, height, shaderMaterial]); // Update on prop changes


    return (
        // Position base of fence panel correctly
        <ObjectBase position={[position[0], position[1] + height / 2, position[2]]} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="fence_panel">
            {/* Optional solid background plane */}
            {backgroundColor && (
                 <mesh ref={backgroundRef} geometry={planeGeometry} position={[0,0,-0.005]} receiveShadow> {/* Slightly behind pattern */}
                     <meshStandardMaterial color={backgroundColor} side={THREE.DoubleSide} transparent={false}/>
                 </mesh>
            )}
             {/* Main Pattern Plane */}
             <mesh
                ref={meshRef}
                geometry={planeGeometry}
                material={shaderMaterial}
                castShadow // Let the shader plane cast shadows (can be patchy with transparency)
                receiveShadow
            />
        </ObjectBase>
    );
});

// UPDATE Fence Panel Schema
FencePanel.editorSchema = [
    { name: 'width', label: 'Width (X)', type: 'number', step: 0.1, min: 0.5, max: 4.0, defaultValue: 1.8 },
    { name: 'height', label: 'Height (Y)', type: 'number', step: 0.1, min: 0.3, max: 2.5, defaultValue: 1.2 },
    { name: 'pattern', label: 'Pattern', type: 'select', options: ['vertical_stripes', 'horizontal_stripes', 'wire_mesh'], defaultValue: 'vertical_stripes' },
    { name: 'rotation', label: 'Rotation', type: 'number', step: 1, min: 0, max: 45, defaultValue: 0 }, // Limit rotation for sanity
    { name: 'thickness', label: 'Thickness', type: 'number', step: 0.01, min: 0.01, max: 0.5, defaultValue: 0.08 }, // Relative thickness
    { name: 'spacing', label: 'Spacing', type: 'number', step: 0.01, min: 0.01, max: 0.5, defaultValue: 0.08 }, // Relative spacing
    { name: 'color1', label: 'Color 1 / Wire', type: 'color', defaultValue: "#BC8F8F" },
    { name: 'color2', label: 'Color 2 / BG', type: 'color', defaultValue: "#A0522D" }, // Used for stripes background
    { name: 'backgroundColor', label: 'Solid BG Color', type: 'color', defaultValue: null }, // Optional background plane
];
