import React, { useState, useMemo, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Select, Box } from '@react-three/drei'; // Import Select for outlining
import * as THREE from 'three';

// --- Configuration ---
const CELL_SIZE = 1;
const HEIGHT_MODIFIER = 0.2;
const INITIAL_MAX_HEIGHT = 1.5;
const INITIAL_GRID_WIDTH = 20;
const INITIAL_GRID_HEIGHT = 20;
const COLORS = ['#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#795548'];
const SELECTION_COLOR = '#FF00FF'; // Magenta for selection highlight

// --- Helper Functions ---
const getInitialHeight = (x, z, width, height) => { /* ... no change ... */
    const freqX = 2 * Math.PI / width;
    const freqZ = 2 * Math.PI / height;
    const sinX = Math.sin(x * freqX * 2);
    const sinZ = Math.sin(z * freqZ * 2);
    return (sinX + sinZ + 2) / 4 * INITIAL_MAX_HEIGHT;
};
const gridToWorld = (x, z, currentHeight, gridWidth, gridHeight) => { /* ... no change ... */
    const worldX = (x - gridWidth / 2 + 0.5) * CELL_SIZE;
    const worldZ = (z - gridHeight / 2 + 0.5) * CELL_SIZE;
    const worldY = currentHeight / 2; // Base position calculation
    return [worldX, worldY, worldZ];
};

// --- Object ID Counter ---
let nextObjectId = 1; // Simple counter for unique IDs

// --- Components ---

const GridCell = React.memo(({ x, z, height, color, onClick, gridWidth, gridHeight }) => { /* ... no change ... */
    const position = useMemo(() => gridToWorld(x, z, height, gridWidth, gridHeight), [x, z, height, gridWidth, gridHeight]);
    const scale = useMemo(() => [CELL_SIZE, height <= 0 ? 0.01 : height, CELL_SIZE], [height]);
    const handleClick = useCallback((event) => {
        event.stopPropagation(); // Prevent OrbitControls drag, allow object clicks to pass through if needed
        onClick(x, z, event.shiftKey, event.ctrlKey, event.button); // Pass button for potential future use
    }, [x, z, onClick]);

    return (
        <mesh position={position} scale={scale} onClick={handleClick} castShadow receiveShadow name={`gridcell-${x}-${z}`}> {/* Add name for potential raycasting debug */}
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />
        </mesh>
    );
});

// --- Object Components ---
const Tree = React.memo(({ position, isSelected, onSelect }) => {
    const trunkHeight = 0.8; const foliageRadius = 0.5; const foliageHeight = 1.2;
    const handleClick = useCallback((e) => { e.stopPropagation(); onSelect(); }, [onSelect]);
    return (
        <group position={position} onClick={handleClick} castShadow >
            {/* Simple selection highlight: slightly larger transparent box */}
            {isSelected && <Box args={[foliageRadius * 2.2, foliageHeight + trunkHeight + 0.2, foliageRadius * 2.2]} position={[0, (trunkHeight+foliageHeight)/2, 0]}>
                <meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false}/>
             </Box>}
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

const Shrub = React.memo(({ position, isSelected, onSelect }) => {
    const radius = 0.4;
    const handleClick = useCallback((e) => { e.stopPropagation(); onSelect(); }, [onSelect]);
    return (
         <group position={position} onClick={handleClick} castShadow>
             {isSelected && <Box args={[radius * 2.2, radius * 2.2, radius * 2.2]} position={[0, radius, 0]}>
                <meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false}/>
             </Box>}
            <mesh position={[0, radius, 0]} castShadow>
                <sphereGeometry args={[radius, 16, 12]} />
                <meshStandardMaterial color="#556B2F" roughness={0.9}/> {/* Dark Olive Green */}
            </mesh>
        </group>
    );
});

const Grass = React.memo(({ position, isSelected, onSelect }) => {
    const height = 0.3;
    const width = 0.4;
    const handleClick = useCallback((e) => { e.stopPropagation(); onSelect(); }, [onSelect]);
    return (
        <group position={position} onClick={handleClick}>
             {isSelected && <Box args={[width * 1.2, height * 1.2, width * 1.2]} position={[0, height/2, 0]}>
                <meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false}/>
             </Box>}
            {/* Simple grass tuft using merged boxes */}
             <mesh position={[0, height / 2, 0]}>
                <boxGeometry args={[width * 0.1, height, width * 0.1]}/>
                <meshStandardMaterial color="#7CFC00" side={THREE.DoubleSide}/> {/* Lawn Green */}
             </mesh>
             <mesh position={[0.05, height / 2, 0.05]} rotation={[0, Math.PI / 4, 0]}>
                <boxGeometry args={[width * 0.1, height * 0.8, width * 0.1]}/>
                 <meshStandardMaterial color="#90EE90" side={THREE.DoubleSide}/> {/* Light Green */}
             </mesh>
             <mesh position={[-0.05, height / 2, -0.05]} rotation={[0, -Math.PI / 3, 0]}>
                <boxGeometry args={[width * 0.1, height * 0.9, width * 0.1]}/>
                 <meshStandardMaterial color="#9ACD32" side={THREE.DoubleSide}/> {/* Yellow Green */}
             </mesh>
        </group>
    );
});

// Map object types to components
const ObjectComponents = {
    tree: Tree,
    shrub: Shrub,
    grass: Grass,
};

// --- Scene Component (Manages R3F State and Logic) ---
const SceneWithLogic = forwardRef(({ addModeObjectType, selectedObjectId, onObjectSelect, onInteractionEnd }, ref) => {
    // --- State ---
    const [heightData, setHeightData] = useState(() => getInitialHeightData(INITIAL_GRID_WIDTH, INITIAL_GRID_HEIGHT));
    const [colorData, setColorData] = useState(() => getInitialColorData(heightData));
    const [objects, setObjects] = useState([
        { id: nextObjectId++, type: 'tree', gridX: 5, gridZ: 5 },
        { id: nextObjectId++, type: 'tree', gridX: 15, gridZ: 8 },
        { id: nextObjectId++, type: 'shrub', gridX: 8, gridZ: 14 },
    ]);

    // Derive grid dimensions from state
    const gridHeight = useMemo(() => heightData.length, [heightData]);
    const gridWidth = useMemo(() => (heightData[0] ? heightData[0].length : 0), [heightData]);

    // Initial data helpers
    function getInitialHeightData(width, height) { /* ... no change ... */
        const data = [];
        for (let z = 0; z < height; z++) { data[z] = []; for (let x = 0; x < width; x++) { data[z][x] = getInitialHeight(x, z, width, height); } }
        return data;
    }
    function getInitialColorData(hData) { /* ... no change ... */
        const data = []; const height = hData.length; if (height === 0) return []; const width = hData[0].length;
        for (let z = 0; z < height; z++) {
            data[z] = [];
            for (let x = 0; x < width; x++) {
                const h = hData[z][x]; const heightRatio = h / INITIAL_MAX_HEIGHT;
                const colorIndex = Math.min(COLORS.length - 1, Math.max(0, Math.floor(heightRatio * (COLORS.length - 2)) + 1));
                data[z][x] = h < 0.05 ? COLORS[0] : COLORS[colorIndex];
            }
        } return data;
    }


    // --- Interaction Logic ---
    const handleGridClick = useCallback((x, z, isShift, isCtrl) => {
        if (addModeObjectType) {
            // Add object mode
            const newObject = {
                id: nextObjectId++,
                type: addModeObjectType,
                gridX: x,
                gridZ: z,
            };
            setObjects(prev => [...prev, newObject]);
            onInteractionEnd(); // Signal to parent to clear the add mode
        } else if (selectedObjectId !== null) {
            // Move selected object mode
            setObjects(prev => prev.map(obj =>
                obj.id === selectedObjectId ? { ...obj, gridX: x, gridZ: z } : obj
            ));
            onInteractionEnd(); // Signal to parent to clear the selection
        } else {
            // Edit terrain mode
            if (isCtrl) { // Cycle Color
                setColorData(prevData => { /* ... no change ... */
                    const newData = prevData.map(row => [...row]); const ci = COLORS.indexOf(newData[z][x]); newData[z][x] = COLORS[(ci + 1) % COLORS.length]; return newData;
                });
            } else { // Modify Height
                setHeightData(prevData => { /* ... no change ... */
                    const newData = prevData.map(row => [...row]); const ch = newData[z][x]; const nh = ch + (isShift ? -HEIGHT_MODIFIER : HEIGHT_MODIFIER); newData[z][x] = Math.max(0, nh); return newData;
                });
            }
            // No need to call onInteractionEnd for terrain edits
        }
    }, [addModeObjectType, selectedObjectId, onInteractionEnd, gridWidth, gridHeight]); // Include dimensions in deps? Maybe not needed if logic inside is sound


    const internalHandleObjectSelect = useCallback((id) => {
        onObjectSelect(id); // Notify parent
    }, [onObjectSelect]);


    // --- Imperative API ---
    useImperativeHandle(ref, () => ({
        save: () => ({ version: 2, heightData, colorData, objects }), // Return data for parent to handle file IO
        load: (loadedData) => { // Accept parsed data from parent
             // Basic Validation (expand as needed)
            if (!loadedData || typeof loadedData !== 'object') throw new Error("Invalid data: not an object");
            if (loadedData.version !== 2 && loadedData.version !== 1) console.warn("Loading data from an unknown version."); // Allow loading older versions for now
            if (!Array.isArray(loadedData.heightData)) throw new Error("Invalid data: missing/invalid heightData");
            if (!Array.isArray(loadedData.colorData)) throw new Error("Invalid data: missing/invalid colorData");
            if (!Array.isArray(loadedData.objects)) throw new Error("Invalid data: missing/invalid objects");

            setHeightData(loadedData.heightData);
            setColorData(loadedData.colorData);
            setObjects(loadedData.objects);

            // Reset nextObjectId based on loaded data
            const maxId = loadedData.objects.reduce((max, obj) => Math.max(max, obj.id), 0);
            nextObjectId = maxId + 1;

            onInteractionEnd(); // Clear any active selection/mode after load
        },
        removeObject: (id) => {
            setObjects(prev => prev.filter(obj => obj.id !== id));
        },
        // Add/Move are now handled internally based on props, no need to expose them?
        // Let's keep them internal for now as the logic is tied to grid clicks.
    }), [heightData, colorData, objects, onInteractionEnd]); // Dependencies for save/load


    // --- Render Logic ---
    const gridCells = useMemo(() => { /* ... no change ... */
        if (gridWidth === 0 || gridHeight === 0) return []; const cells = [];
        for (let z = 0; z < gridHeight; z++) { for (let x = 0; x < gridWidth; x++) {
            cells.push(<GridCell key={`${x}-${z}`} x={x} z={z} height={heightData[z]?.[x] ?? 0} color={colorData[z]?.[x] ?? '#ffffff'} onClick={handleGridClick} gridWidth={gridWidth} gridHeight={gridHeight} />);
        } } return cells;
    }, [heightData, colorData, gridWidth, gridHeight, handleGridClick]); // handleGridClick changes with mode!

    const renderedObjects = useMemo(() => {
         if (gridWidth === 0 || gridHeight === 0) return [];
        return objects.map(obj => {
            const ObjectComponent = ObjectComponents[obj.type];
            if (!ObjectComponent) return null; // Skip unknown types

            const clampedX = Math.max(0, Math.min(obj.gridX, gridWidth - 1));
            const clampedZ = Math.max(0, Math.min(obj.gridZ, gridHeight - 1));
            const groundHeight = heightData[clampedZ]?.[clampedX] ?? 0;
            const [worldX, , worldZ] = gridToWorld(clampedX, clampedZ, groundHeight, gridWidth, gridHeight);
            const worldY = groundHeight; // Place base of the object ON the ground cell's top surface

            return (
                 <ObjectComponent
                    key={obj.id}
                    position={[worldX, worldY, worldZ]}
                    isSelected={obj.id === selectedObjectId}
                    onSelect={() => internalHandleObjectSelect(obj.id)}
                 />
            );
        })
    }, [objects, heightData, gridWidth, gridHeight, selectedObjectId, internalHandleObjectSelect]); // Recalculate if selection changes

    const controlsTarget = useMemo(() => [0, 0, 0], []);
    const groundPlaneSize = useMemo(() => [gridWidth * CELL_SIZE + 4, gridHeight * CELL_SIZE + 4], [gridWidth, gridHeight]);

    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight position={[gridWidth * 0.5, 15, gridHeight * 0.5]} intensity={1.0} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
            <PerspectiveCamera makeDefault position={[15, 20, 25]} fov={60} />
            <OrbitControls target={controlsTarget} enablePan={true} enableZoom={true} enableRotate={true}/> {/* Ensure controls enabled */}
            <group>{gridCells}</group>
            <group>{renderedObjects}</group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
                <planeGeometry args={groundPlaneSize} />
                <meshStandardMaterial color="#555" side={THREE.DoubleSide} />
            </mesh>
        </>
    );
});


// --- App Entry Point (Manages Layout, UI Buttons, Modes) ---
export default function PlanEditor() {
    const sceneLogicRef = useRef();
    const fileInputRef = useRef(null);

    // --- Modes ---
    const [addModeObjectType, setAddModeObjectType] = useState(null); // 'tree', 'shrub', 'grass', or null
    const [selectedObjectId, setSelectedObjectId] = useState(null); // ID of the selected object or null

    const currentMode = useMemo(() => {
        if (addModeObjectType) return `add-${addModeObjectType}`;
        if (selectedObjectId !== null) return 'move';
        return 'edit-terrain'; // Default pointer mode
    }, [addModeObjectType, selectedObjectId]);

    // --- Button Styles ---
    const getButtonStyle = (mode) => ({
        margin: '2px',
        padding: '4px 8px',
        border: currentMode === mode ? '2px solid #eee' : '2px solid transparent',
        backgroundColor: currentMode === mode ? '#555' : '#333',
        color: 'white',
        cursor: 'pointer'
    });

     // --- Handlers ---
    const onSaveClick = useCallback(() => {
        const saveData = sceneLogicRef.current?.save();
        if (!saveData) return; // Handle case where ref isn't ready

        const jsonString = JSON.stringify(saveData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plan_data_v2.json'; // Indicate version might change
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []); // No deps needed if sceneLogicRef.current.save handles its own state

    const onLoadClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const onFileSelected = useCallback((event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonString = e.target.result;
                const loadedData = JSON.parse(jsonString);
                sceneLogicRef.current?.load(loadedData); // Pass parsed data to Scene logic
            } catch (error) {
                console.error("Error loading or parsing file:", error);
                alert(`Failed to load file: ${error.message}`);
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.onerror = (e) => { /* ... error handling ... */
             console.error("Error reading file:", e); alert("Error reading file."); if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsText(file);
    }, []); // No deps needed if sceneLogicRef.current.load handles state


    const handleSetMode = (type) => {
        setAddModeObjectType(type);
        setSelectedObjectId(null); // Clear selection when entering add mode
    };

    const handleSelectObject = (id) => {
        setSelectedObjectId(id);
        setAddModeObjectType(null); // Clear add mode when selecting
    };

     const handleRemoveSelected = () => {
        if (selectedObjectId !== null) {
            sceneLogicRef.current?.removeObject(selectedObjectId);
            setSelectedObjectId(null); // Clear selection after removal
        }
    };

    // Called by SceneWithLogic after an add or move action is completed via grid click
    const handleInteractionEnd = () => {
         setSelectedObjectId(null);
         setAddModeObjectType(null);
    };

    // Determine instructions text based on mode
    const instructions = useMemo(() => {
        switch(currentMode) {
            case 'add-tree': return "Click grid to add Tree.";
            case 'add-shrub': return "Click grid to add Shrub.";
            case 'add-grass': return "Click grid to add Grass.";
            case 'move': return "Click grid to move selected object. Click another object to select it.";
            case 'edit-terrain':
            default: return "Click: Raise Height | Shift+Click: Lower Height | Ctrl+Click: Cycle Color | Click object to select/move.";
        }
    }, [currentMode]);

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#282c34' }}>
            {/* UI Overlay */}
            <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1, color: 'white', background: 'rgba(0,0,0,0.7)', padding: '8px', borderRadius: '5px', fontSize: '12px', maxWidth: '200px' }}>
                {/* Mode Selection */}
                <div style={{ marginBottom: '5px' }}>
                     <strong>Mode:</strong><br/>
                     <button style={getButtonStyle('edit-terrain')} onClick={() => handleSetMode(null)}>Pointer/Edit</button>
                     <button style={getButtonStyle('add-tree')} onClick={() => handleSetMode('tree')}>Add Tree</button>
                     <button style={getButtonStyle('add-shrub')} onClick={() => handleSetMode('shrub')}>Add Shrub</button>
                     <button style={getButtonStyle('add-grass')} onClick={() => handleSetMode('grass')}>Add Grass</button>
                </div>
                 {/* Actions */}
                <div style={{ marginBottom: '5px', borderTop: '1px solid #555', paddingTop: '5px' }}>
                     <strong>Actions:</strong><br/>
                    <button onClick={onLoadClick} style={{ marginRight: '5px', ...getButtonStyle('load') }}>Load</button>
                    <button onClick={onSaveClick} style={{ marginRight: '5px', ...getButtonStyle('save') }}>Save</button>
                    <button onClick={handleRemoveSelected} disabled={selectedObjectId === null} style={getButtonStyle('remove')}>Remove Selected</button>
                </div>
                 {/* Instructions */}
                <div style={{ borderTop: '1px solid #555', paddingTop: '5px' }}>
                    <strong>How To:</strong><br/>
                    {instructions}
                </div>
            </div>

            {/* Hidden File Input */}
            <input type="file" ref={fileInputRef} onChange={onFileSelected} accept=".json,application/json" style={{ display: 'none' }} />

            {/* Canvas Container */}
            <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                <Canvas shadows camera={{ position: [15, 20, 25], fov: 60 }}> {/* Set camera props directly */}
                    {/* Pass mode state and handlers down */}
                    <SceneWithLogic
                        ref={sceneLogicRef}
                        addModeObjectType={addModeObjectType}
                        selectedObjectId={selectedObjectId}
                        onObjectSelect={handleSelectObject}
                        onInteractionEnd={handleInteractionEnd}
                     />
                </Canvas>
            </div>
        </div>
    );
}
