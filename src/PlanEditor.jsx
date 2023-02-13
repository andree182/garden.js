import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- Configuration ---
const GRID_SIZE = { width: 20, height: 20 };
const CELL_SIZE = 1;
const HEIGHT_MODIFIER = 0.2; // How much height changes per click
const INITIAL_MAX_HEIGHT = 1.5;
const COLORS = ['#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#795548']; // Example terrain/feature colors

// --- Helper Functions ---
const getInitialHeight = (x, z, width, height) => {
  // Simple sine wave pattern
  const freqX = 2 * Math.PI / width;
  const freqZ = 2 * Math.PI / height;
  const sinX = Math.sin(x * freqX * 2); // Multiply freq for more waves
  const sinZ = Math.sin(z * freqZ * 2);
  return (sinX + sinZ + 2) / 4 * INITIAL_MAX_HEIGHT; // Normalize to 0-1 range then scale
};

const gridToWorld = (x, z, currentHeight) => {
    const worldX = (x - GRID_SIZE.width / 2 + 0.5) * CELL_SIZE;
    const worldZ = (z - GRID_SIZE.height / 2 + 0.5) * CELL_SIZE;
    const worldY = currentHeight / 2; // Box origin is center, place base at y=0
    return [worldX, worldY, worldZ];
};

// --- Components ---

// Represents a single cell (tile) in the grid
const GridCell = React.memo(({ x, z, height, color, onClick }) => {
  const position = useMemo(() => gridToWorld(x, z, height), [x, z, height]);
  const scale = useMemo(() => [CELL_SIZE, height <= 0 ? 0.01 : height, CELL_SIZE], [height]); // Ensure non-zero height for visibility

  const handleClick = useCallback((event) => {
    event.stopPropagation(); // Prevent triggering OrbitControls drag
    onClick(x, z, event.shiftKey, event.ctrlKey);
  }, [x, z, onClick]);

  return (
    <mesh
      position={position}
      scale={scale}
      onClick={handleClick}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} /> {/* Use 1,1,1 and scale the mesh */}
      <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />
    </mesh>
  );
});

// Represents a simple tree object
const Tree = React.memo(({ position }) => {
    const trunkHeight = 0.8;
    const foliageRadius = 0.5;
    const foliageHeight = 1.2;

    return (
        <group position={position} castShadow>
            {/* Trunk */}
            <mesh position={[0, trunkHeight / 2, 0]} castShadow>
                <cylinderGeometry args={[0.15, 0.2, trunkHeight, 8]} />
                <meshStandardMaterial color="#8B4513" /> {/* Brown */}
            </mesh>
            {/* Foliage */}
            <mesh position={[0, trunkHeight + foliageHeight / 2 - 0.1, 0]} castShadow>
                <coneGeometry args={[foliageRadius, foliageHeight, 16]} />
                <meshStandardMaterial color="#2E7D32" /> {/* Dark Green */}
            </mesh>
        </group>
    );
});


// Main Scene Component
function Scene() {
  // --- State ---
  const [heightData, setHeightData] = useState(() => {
    const data = [];
    for (let z = 0; z < GRID_SIZE.height; z++) {
      data[z] = [];
      for (let x = 0; x < GRID_SIZE.width; x++) {
        data[z][x] = getInitialHeight(x, z, GRID_SIZE.width, GRID_SIZE.height);
      }
    }
    return data;
  });

  const [colorData, setColorData] = useState(() => {
      const data = [];
      for (let z = 0; z < GRID_SIZE.height; z++) {
        data[z] = [];
        for (let x = 0; x < GRID_SIZE.width; x++) {
          // Initial color based on height, for example
          const heightRatio = heightData[z][x] / INITIAL_MAX_HEIGHT;
          const colorIndex = Math.min(COLORS.length -1, Math.max(0, Math.floor(heightRatio * (COLORS.length -2)) + 1)); // Simple mapping, skip first color unless height is 0
          data[z][x] = heightData[z][x] < 0.05 ? COLORS[0] : COLORS[colorIndex];
        }
      }
      return data;
    });

  const [objects, setObjects] = useState([
      // Initial object positions (grid coordinates x, z)
      { id: 'tree1', type: 'tree', gridX: 5, gridZ: 5 },
      { id: 'tree2', type: 'tree', gridX: 15, gridZ: 8 },
      { id: 'tree3', type: 'tree', gridX: 8, gridZ: 14 },
  ]);

  // --- Interaction Logic ---
  const handleCellClick = useCallback((x, z, isShift, isCtrl) => {
    if (isCtrl) {
        // Cycle color
        setColorData(prevData => {
            const newData = prevData.map(row => [...row]); // Deep copy
            const currentColorIndex = COLORS.indexOf(newData[z][x]);
            const nextColorIndex = (currentColorIndex + 1) % COLORS.length;
            newData[z][x] = COLORS[nextColorIndex];
            return newData;
        });
    } else {
        // Modify height
        setHeightData(prevData => {
            const newData = prevData.map(row => [...row]); // Deep copy
            const currentHeight = newData[z][x];
            const newHeight = currentHeight + (isShift ? -HEIGHT_MODIFIER : HEIGHT_MODIFIER);
            newData[z][x] = Math.max(0, newHeight); // Clamp height >= 0
            return newData;
        });
     }
  }, []); // Dependencies: none, as it only uses setters

  // --- Render Logic ---
  const gridCells = useMemo(() => {
    const cells = [];
    for (let z = 0; z < GRID_SIZE.height; z++) {
      for (let x = 0; x < GRID_SIZE.width; x++) {
        cells.push(
          <GridCell
            key={`${x}-${z}`}
            x={x}
            z={z}
            height={heightData[z][x]}
            color={colorData[z][x]}
            onClick={handleCellClick}
          />
        );
      }
    }
    return cells;
  }, [heightData, colorData, handleCellClick]); // Re-render grid only if data changes

  const renderedObjects = useMemo(() => {
    return objects.map(obj => {
        if (obj.type === 'tree') {
            // Get ground height below the object
            const groundHeight = heightData[obj.gridZ]?.[obj.gridX] ?? 0;
             // Calculate world position based on grid coords and ground height
            const worldX = (obj.gridX - GRID_SIZE.width / 2 + 0.5) * CELL_SIZE;
            const worldZ = (obj.gridZ - GRID_SIZE.height / 2 + 0.5) * CELL_SIZE;
            const worldY = groundHeight; // Place base of the tree ON the ground cell's top surface

            return <Tree key={obj.id} position={[worldX, worldY, worldZ]} />;
        }
        return null;
    })
  }, [objects, heightData]); // Re-render objects if they move or ground height changes

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <PerspectiveCamera makeDefault position={[15, 20, 25]} fov={60} />
      <OrbitControls target={[0, 0, 0]}/>

      <group>
        {gridCells}
      </group>

      <group>
        {renderedObjects}
      </group>

      {/* Optional: Add a visual plane below everything */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
          <planeGeometry args={[GRID_SIZE.width * CELL_SIZE + 4, GRID_SIZE.height * CELL_SIZE + 4]} />
          <meshStandardMaterial color="#555" side={THREE.DoubleSide}/>
      </mesh>

      {/* <gridHelper args={[GRID_SIZE.width * CELL_SIZE, GRID_SIZE.width]} position={[0,0.01,0]}/> */}
    </>
  );
}

// --- App Entry Point ---
export default function PlanEditor() {
  return (
    <div style={{ height: '100vh', width: '100vw', background: '#282c34' }}>
      <Canvas shadows>
        <Scene />
      </Canvas>
       <div style={{ position: 'absolute', top: '10px', left: '10px', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '5px', borderRadius: '3px', fontSize: '12px' }}>
            Click: Raise Height<br/>
            Shift+Click: Lower Height<br/>
            Ctrl+Click: Cycle Color
        </div>
    </div>
  );
}
