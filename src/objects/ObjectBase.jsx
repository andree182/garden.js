// src/Objects.jsx
import React, { useRef, useState, useCallback, useMemo, useLayoutEffect, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box } from '@react-three/drei';
import * as THREE from 'three';

// --- Config ---
const SELECTION_COLOR = '#FF00FF'; // Keep consistent or pass as prop if needed

// --- ObjectBase: Wrapper with common logic (selection, animation, pointer down) ---
export const ObjectBase = ({ children, position, isSelected, onSelect, onPointerDown, objectId, type, rotationY }) => {
    const groupRef = useRef();
    const [animOffset] = useState(() => Math.random() * Math.PI * 2);
    const [freqMult] = useState(() => 0.8 + Math.random() * 0.4);

    const shouldAnimate = useMemo(() =>
        ['tree', 'deciduous_tree', 'shrub', 'grass', 'hedge'].includes(type),
    [type]);

    useLayoutEffect(() => {
        if (groupRef.current) {
            groupRef.current.rotation.y = THREE.MathUtils.degToRad(rotationY);
        }
    }, [rotationY]);

    useFrame((state) => {
        if (!groupRef.current) return;

        const baseRotY = THREE.MathUtils.degToRad(rotationY ?? 0);
        groupRef.current.rotation.y = baseRotY;
        if (shouldAnimate) {
            const time = state.clock.elapsedTime;
            const baseFrequency = 1;
            const baseAmplitude = 0.05;
            groupRef.current.rotation.x = Math.sin(time * baseFrequency * freqMult + animOffset) * baseAmplitude;
            groupRef.current.rotation.z = Math.cos(time * baseFrequency * freqMult * 0.9 + animOffset * 1.1) * baseAmplitude * 0.8;
            groupRef.current.rotation.y = 0;
        } else {
            groupRef.current.rotation.x = 0;
            groupRef.current.rotation.z = 0;
        }
    });

    const handlePointerDown = useCallback((e) => {
        // Let event bubble up to Experience/Canvas handler
        onPointerDown(e, objectId, type);
        onSelect();
    }, [onPointerDown, objectId, type, onSelect]);

    // Apply selection highlight conditionally (could be complex geometry later)
    const selectionHighlight = isSelected ? (
         // Simple box based on rough combined height/width for now
         // This might need refinement per object type if bounding boxes differ significantly
        <Box args={[0.8, 1.5, 0.8]} position={[0, 0.75, 0]} >
            <meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false} wireframe={false} />
        </Box>
    ) : null;


    return (
        <group ref={groupRef} position={position} onPointerDown={handlePointerDown}>
             {selectionHighlight}
            {children}
        </group>
    );
};
