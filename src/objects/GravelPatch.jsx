// src/objects/GravelPatch.jsx
import React, { memo, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { ObjectBase } from './ObjectBase';
import { shaderMaterial } from '@react-three/drei';
import { extend, useFrame } from '@react-three/fiber';

// Simple procedural gravel shader (adjust as needed)
const GravelMaterial = shaderMaterial(
  // Uniforms
  {
    uTime: 0,
    uColor1: new THREE.Color("#AAAAAA"),
    uColor2: new THREE.Color("#888888"),
    uScale: 15.0, // Noise scale
  },
  // Vertex Shader (pass uv)
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment Shader (basic noise-like pattern)
  `
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform float uScale;
    varying vec2 vUv;

    // Basic pseudo-random function
    float rand(vec2 co){
        return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    float noise (vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = rand(i);
        float b = rand(i + vec2(1.0, 0.0));
        float c = rand(i + vec2(0.0, 1.0));
        float d = rand(i + vec2(1.0, 1.0));
        vec2 u = f*f*(3.0-2.0*f); // Smoothstep
        return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
      vec2 scaledUv = vUv * uScale;
      // Simple variation based on uv and a noise-like function
      float pattern = fract(noise(scaledUv) * 5.0); // Create some hard edges
      // Mix colors based on pattern
      vec3 color = mix(uColor1, uColor2, step(0.5, pattern));

      gl_FragColor = vec4(color, 1.0);
    }
  `
);
extend({ GravelMaterial }); // Make it available as <gravelMaterial />

export const GravelPatch = memo(({ position, isSelected, onSelect, onPointerDown, objectId, rotationY = 0,
    width = 1.0, length = 1.5,
    color1 = "#AAAAAA", // Base gravel color
    color2 = "#888888", // Variation color
    noiseScale = 15.0
}) => {
    const materialRef = useRef();
    useFrame((state) => {
        // Optional: Animate time uniform slightly for shimmering effect
        // if (materialRef.current) materialRef.current.uTime = state.clock.elapsedTime * 0.1;
    });

    const height = 0.02; // Very thin patch

    return (
        // Position base Y slightly above ground to avoid z-fighting
        <ObjectBase position={[position[0], position[1] + height/2 + 0.005, position[2]]} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="gravel_patch" rotationY={rotationY}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow> {/* Plane needs rotation */}
                 <planeGeometry args={[length, width]} />
                 {/* Use custom shader material */}
                 <gravelMaterial
                    ref={materialRef}
                    key={color1 + color2 + noiseScale} // Recreate material on prop change
                    uColor1={new THREE.Color(color1)}
                    uColor2={new THREE.Color(color2)}
                    uScale={noiseScale}
                 />
             </mesh>
        </ObjectBase>
    );
});

GravelPatch.editorSchema = [
    { name: 'length', label: 'Length (X)', type: 'number', step: 0.1, min: 0.2, max: 10, defaultValue: 1.5 },
    { name: 'width', label: 'Width (Z)', type: 'number', step: 0.1, min: 0.2, max: 10, defaultValue: 1.0 },
    { name: 'noiseScale', label: 'Texture Scale', type: 'number', step: 1, min: 1, max: 50, defaultValue: 15 },
    { name: 'color1', label: 'Color 1', type: 'color', defaultValue: "#AAAAAA" },
    { name: 'color2', label: 'Color 2', type: 'color', defaultValue: "#888888" },
    { name: 'rotationY', label: 'Rotation', type: 'number', step: 1, min: 0, max: 360, defaultValue: 0 },
];
