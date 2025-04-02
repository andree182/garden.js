import React, { useState, useMemo, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- Configuration ---
const CELL_SIZE = 1;
const HEIGHT_MODIFIER = 0.2;
const INITIAL_MAX_HEIGHT = 1.5;
const INITIAL_GRID_WIDTH = 20;
const INITIAL_GRID_HEIGHT = 20;
const COLORS = ['#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#795548'];

// --- Helper Functions ---
const getInitialHeight = (x, z, width, height) => {
    const freqX = 2 * Math.PI / width;
    const freqZ = 2 * Math.PI / height;
    const sinX = Math.sin(x * freqX * 2);
    const sinZ = Math.sin(z * freqZ * 2);
    return (sinX + sinZ + 2) / 4 * INITIAL_MAX_HEIGHT;
};

const gridToWorld = (x, z, currentHeight, gridWidth, gridHeight) => {
    const worldX = (x - gridWidth / 2 + 0.5) * CELL_SIZE;
    const worldZ = (z - gridHeight / 2 + 0.5) * CELL_SIZE;
    const worldY = currentHeight / 2;
    return [worldX, worldY, worldZ];
};

// --- Components ---
const GridCell = React.memo(({ x, z, height, color, onClick, gridWidth, gridHeight }) => {
    const position = useMemo(() => gridToWorld(x, z, height, gridWidth, gridHeight), [x, z, height, gridWidth, gridHeight]);
    const scale = useMemo(() => [CELL_SIZE, height <= 0 ? 0.01 : height, CELL_SIZE], [height]);
    const handleClick = useCallback((event) => {
        event.stopPropagation();
        onClick(x, z, event.shiftKey, event.ctrlKey);
    }, [x, z, onClick]);

    return (
        <mesh position={position} scale={scale} onClick={handleClick} castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />
        </mesh>
    );
});

const Tree = React.memo(({ position }) => {
    const trunkHeight = 0.8; const foliageRadius = 0.5; const foliageHeight = 1.2;
    return (
        <group position={position} castShadow>
            <mesh position={[0, trunkHeight / 2, 0]} castShadow>
                <cylinderGeometry args={[0.15, 0.2, trunkHeight, 8]} />
                <meshStandardMaterial color="#8B4513" />
            </mesh>
            <mesh position={[0, trunkHeight + foliageHeight / 2 - 0.1, 0]} castShadow>
                <coneGeometry args={[foliageRadius, foliageHeight, 16]} />
                <meshStandardMaterial color="#2E7D32" />
            </mesh>
        </group>
    );
});

// --- Scene Component (Manages R3F State and Logic) ---
// Use forwardRef to receive the ref from PlanEditor
const SceneWithLogic = forwardRef((props, ref) => {
    // --- State ---
    const [heightData, setHeightData] = useState(() => { /* ... initial state generation ... */
        const data = [];
        for (let z = 0; z < INITIAL_GRID_HEIGHT; z++) {
            data[z] = [];
            for (let x = 0; x < INITIAL_GRID_WIDTH; x++) {
                data[z][x] = getInitialHeight(x, z, INITIAL_GRID_WIDTH, INITIAL_GRID_HEIGHT);
            }
        }
        return data;
    });
    const [colorData, setColorData] = useState(() => { /* ... initial state generation ... */
        const data = [];
        const initialHeightData = getInitialHeightData(); // Helper or regenerate
        for (let z = 0; z < INITIAL_GRID_HEIGHT; z++) {
            data[z] = [];
            for (let x = 0; x < INITIAL_GRID_WIDTH; x++) {
                const h = initialHeightData[z][x];
                const heightRatio = h / INITIAL_MAX_HEIGHT;
                const colorIndex = Math.min(COLORS.length - 1, Math.max(0, Math.floor(heightRatio * (COLORS.length - 2)) + 1));
                data[z][x] = h < 0.05 ? COLORS[0] : COLORS[colorIndex];
            }
        }
        return data;
    });

    // Helper to avoid regenerating initial height data twice
     function getInitialHeightData() {
        const data = [];
        for (let z = 0; z < INITIAL_GRID_HEIGHT; z++) {
            data[z] = [];
            for (let x = 0; x < INITIAL_GRID_WIDTH; x++) {
                data[z][x] = getInitialHeight(x, z, INITIAL_GRID_WIDTH, INITIAL_GRID_HEIGHT);
            }
        }
        return data;
    }

    const [objects, setObjects] = useState([
        { id: 'tree1', type: 'tree', gridX: 5, gridZ: 5 }, { id: 'tree2', type: 'tree', gridX: 15, gridZ: 8 }, { id: 'tree3', type: 'tree', gridX: 8, gridZ: 14 },
    ]);

    // Derive grid dimensions from state
    const gridHeight = useMemo(() => heightData.length, [heightData]);
    const gridWidth = useMemo(() => (heightData[0] ? heightData[0].length : 0), [heightData]);

    // --- Interaction Logic ---
    const handleCellClick = useCallback((x, z, isShift, isCtrl) => {
        if (isCtrl) {
            setColorData(prevData => { /* ... cycle color logic ... */
                const newData = prevData.map(row => [...row]);
                const currentColorIndex = COLORS.indexOf(newData[z][x]);
                const nextColorIndex = (currentColorIndex + 1) % COLORS.length;
                newData[z][x] = COLORS[nextColorIndex];
                return newData;
            });
        } else {
            setHeightData(prevData => { /* ... modify height logic ... */
                const newData = prevData.map(row => [...row]);
                const currentHeight = newData[z][x];
                const newHeight = currentHeight + (isShift ? -HEIGHT_MODIFIER : HEIGHT_MODIFIER);
                newData[z][x] = Math.max(0, newHeight);
                return newData;
            });
        }
    }, []); // Empty dependency array okay if only using setters

    // --- Load/Save Logic ---
    const handleSave = useCallback(() => {
        const saveData = { version: 1, heightData, colorData, objects };
        const jsonString = JSON.stringify(saveData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plan_data.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [heightData, colorData, objects]);

    // This function now processes the file *event* passed from the parent
    const handleFileSelected = useCallback((event, fileInputRef) => { // Receive ref to reset it
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonString = e.target.result;
                const loadedData = JSON.parse(jsonString);

                // Basic Validation
                if (!loadedData || typeof loadedData !== 'object') throw new Error("Invalid file: not an object");
                if (!Array.isArray(loadedData.heightData)) throw new Error("Invalid file: missing/invalid heightData");
                if (!Array.isArray(loadedData.colorData)) throw new Error("Invalid file: missing/invalid colorData");
                if (!Array.isArray(loadedData.objects)) throw new Error("Invalid file: missing/invalid objects");
                // Add more validation as needed (dimensions match, types correct etc.)

                setHeightData(loadedData.heightData);
                setColorData(loadedData.colorData);
                setObjects(loadedData.objects);

            } catch (error) {
                console.error("Error loading or parsing file:", error);
                alert(`Failed to load file: ${error.message}`);
            } finally {
                 // Reset file input value in the parent component
                if (fileInputRef?.current) {
                    fileInputRef.current.value = "";
                }
            }
        };
        reader.onerror = (e) => {
            console.error("Error reading file:", e);
            alert("Error reading file.");
             if (fileInputRef?.current) { // Also reset on read error
                fileInputRef.current.value = "";
             }
        };
        reader.readAsText(file);
    }, []); // Empty dependency array okay if only using setters

    // Expose save and load handler via ref
    useImperativeHandle(ref, () => ({
        save: handleSave,
        handleFileSelected: handleFileSelected // Expose the handler that takes the event
    }), [handleSave, handleFileSelected]);

    // --- Render Logic ---
    const gridCells = useMemo(() => { /* ... grid cell generation ... */
        if (gridWidth === 0 || gridHeight === 0) return [];
        const cells = [];
        for (let z = 0; z < gridHeight; z++) {
            for (let x = 0; x < gridWidth; x++) {
                cells.push(
                    <GridCell
                        key={`${x}-${z}`} x={x} z={z}
                        height={heightData[z]?.[x] ?? 0}
                        color={colorData[z]?.[x] ?? '#ffffff'}
                        onClick={handleCellClick}
                        gridWidth={gridWidth} gridHeight={gridHeight}
                    />);
            }
        }
        return cells;
    }, [heightData, colorData, handleCellClick, gridWidth, gridHeight]);

    const renderedObjects = useMemo(() => { /* ... object generation ... */
        if (gridWidth === 0 || gridHeight === 0) return [];
        return objects.map(obj => {
            if (obj.type === 'tree') {
                const clampedX = Math.max(0, Math.min(obj.gridX, gridWidth - 1));
                const clampedZ = Math.max(0, Math.min(obj.gridZ, gridHeight - 1));
                const groundHeight = heightData[clampedZ]?.[clampedX] ?? 0;
                const [worldX, , worldZ] = gridToWorld(clampedX, clampedZ, groundHeight, gridWidth, gridHeight);
                const worldY = groundHeight;
                return <Tree key={obj.id} position={[worldX, worldY, worldZ]} />;
            } return null;
        })
    }, [objects, heightData, gridWidth, gridHeight]);

    const controlsTarget = useMemo(() => [0, 0, 0], []);
    const groundPlaneSize = useMemo(() => [gridWidth * CELL_SIZE + 4, gridHeight * CELL_SIZE + 4], [gridWidth, gridHeight]);

    // Actual R3F rendering - NO DOM elements here
    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight position={[gridWidth * 0.5, 15, gridHeight * 0.5]} intensity={1.0} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
            <PerspectiveCamera makeDefault position={[15, 20, 25]} fov={60} />
            <OrbitControls target={controlsTarget} />
            <group>{gridCells}</group>
            <group>{renderedObjects}</group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
                <planeGeometry args={groundPlaneSize} />
                <meshStandardMaterial color="#555" side={THREE.DoubleSide} />
            </mesh>
        </>
    );
});

// --- App Entry Point (Manages Layout and DOM Elements) ---
export default function PlanEditor() {
    const sceneLogicRef = useRef(); // Ref to access SceneWithLogic's exposed methods
    const fileInputRef = useRef(null); // Ref for the *actual* file input DOM element

    const onSaveClick = () => {
        sceneLogicRef.current?.save();
    };

    // Trigger the click on the hidden file input
    const onLoadClick = () => {
        fileInputRef.current?.click();
    };

    // This is called when the user selects a file in the hidden input
    const onFileSelected = (event) => {
        // Call the handler inside SceneWithLogic, passing the event and the ref
        sceneLogicRef.current?.handleFileSelected(event, fileInputRef);
    };

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#282c34' }}>
            {/* UI Overlay - Buttons and Instructions */}
            <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1, color: 'white', background: 'rgba(0,0,0,0.7)', padding: '8px', borderRadius: '5px', fontSize: '12px' }}>
                <div>
                    Click: Raise Height<br />
                    Shift+Click: Lower Height<br />
                    Ctrl+Click: Cycle Color
                </div>
                <div style={{ marginTop: '10px' }}>
                    {/* Button triggers the hidden input click */}
                    <button onClick={onLoadClick} style={{ marginRight: '5px' }}>Load</button>
                    <button onClick={onSaveClick}>Save</button>
                </div>
            </div>

            {/* Hidden File Input - Lives in the regular DOM */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={onFileSelected} // Call our handler when a file is chosen
                accept=".json,application/json"
                style={{ display: 'none' }} // Keep it hidden
            />

            {/* Canvas Container */}
            <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                <Canvas shadows>
                    {/* Pass the ref to the component handling the R3F logic */}
                    <SceneWithLogic ref={sceneLogicRef} />
                </Canvas>
            </div>
        </div>
    );
}
