import React, { useState, useMemo, useCallback, useRef, forwardRef, useImperativeHandle, useEffect } from 'react'; // <-- Fixed import
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Box } from '@react-three/drei';
import * as THREE from 'three';

// --- Configuration ---
const CELL_SIZE = 1;
const HEIGHT_MODIFIER = 0.2;
const INITIAL_MAX_HEIGHT = 1.5; // For terrain generation
const INITIAL_GRID_WIDTH = 20;
const INITIAL_GRID_HEIGHT = 20;
const MIN_GRID_DIM = 5;
const MAX_GRID_DIM = 100;
const COLORS = ['#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#795548'];
const SELECTION_COLOR = '#FF00FF';

// --- Helper Functions ---
const getInitialHeight = (x, z, width, height) => {
    const freqX = 2 * Math.PI / width; const freqZ = 2 * Math.PI / height;
    const sinX = Math.sin(x * freqX * 2); const sinZ = Math.sin(z * freqZ * 2);
    return (sinX + sinZ + 2) / 4 * INITIAL_MAX_HEIGHT;
};
const gridToWorld = (x, z, currentHeight, gridWidth, gridHeight) => {
    const worldX = (x - gridWidth / 2 + 0.5) * CELL_SIZE; const worldZ = (z - gridHeight / 2 + 0.5) * CELL_SIZE;
    const worldY = currentHeight / 2; return [worldX, worldY, worldZ];
};
const lerp = THREE.MathUtils.lerp; // Shortcut

// --- Object ID Counter ---
let nextObjectId = 1;

// --- Components ---

const GridCell = React.memo(({ x, z, height, color, onClick, gridWidth, gridHeight }) => {
    const position = useMemo(() => gridToWorld(x, z, height, gridWidth, gridHeight), [x, z, height, gridWidth, gridHeight]);
    const scale = useMemo(() => [CELL_SIZE, height <= 0 ? 0.01 : height, CELL_SIZE], [height]);
    const handleClick = useCallback((event) => { event.stopPropagation(); onClick(x, z, event.shiftKey, event.ctrlKey, event.button); }, [x, z, onClick]);
    return (<mesh position={position} scale={scale} onClick={handleClick} castShadow receiveShadow name={`gridcell-${x}-${z}`}> <boxGeometry args={[1, 1, 1]} /> <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} /> </mesh>);
});

// --- Object Components --- (Now accept age and max size props)
const Tree = React.memo(({ position, isSelected, onSelect, globalAge = 1, maxTrunkHeight = 0.8, maxFoliageHeight = 1.2, maxFoliageRadius = 0.5 }) => {
    const handleClick = useCallback((e) => { e.stopPropagation(); onSelect(); }, [onSelect]);
    const currentTrunkHeight = lerp(0.1, maxTrunkHeight, globalAge);
    const currentFoliageHeight = lerp(0.1, maxFoliageHeight, globalAge);
    const currentFoliageRadius = lerp(0.05, maxFoliageRadius, globalAge);
    const totalCurrentHeight = currentTrunkHeight + currentFoliageHeight;

    return (
        <group position={position} onClick={handleClick} castShadow >
            {isSelected && <Box args={[currentFoliageRadius * 2.2, totalCurrentHeight + 0.2, currentFoliageRadius * 2.2]} position={[0, totalCurrentHeight / 2, 0]}>
                <meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false} />
            </Box>}
            <mesh position={[0, currentTrunkHeight / 2, 0]} scale={[1, currentTrunkHeight / maxTrunkHeight, 1]} castShadow>
                <cylinderGeometry args={[0.15, 0.2, maxTrunkHeight, 8]} />
                <meshStandardMaterial color="#8B4513" />
            </mesh>
            <mesh position={[0, currentTrunkHeight + currentFoliageHeight / 2 - 0.05, 0]} scale={[currentFoliageRadius / maxFoliageRadius, currentFoliageHeight / maxFoliageHeight, currentFoliageRadius / maxFoliageRadius]} castShadow>
                <coneGeometry args={[maxFoliageRadius, maxFoliageHeight, 16]} />
                <meshStandardMaterial color="#2E7D32" />
            </mesh>
        </group>
    );
});

const Shrub = React.memo(({ position, isSelected, onSelect, globalAge = 1, maxRadius = 0.4 }) => {
    const handleClick = useCallback((e) => { e.stopPropagation(); onSelect(); }, [onSelect]);
    const currentRadius = lerp(0.1, maxRadius, globalAge);

    return (
        <group position={position} onClick={handleClick} castShadow>
            {isSelected && <Box args={[currentRadius * 2.2, currentRadius * 2.2, currentRadius * 2.2]} position={[0, currentRadius, 0]}>
                <meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false} />
            </Box>}
            <mesh position={[0, currentRadius, 0]} scale={[currentRadius / maxRadius, currentRadius / maxRadius, currentRadius / maxRadius]} castShadow>
                <sphereGeometry args={[maxRadius, 16, 12]} />
                <meshStandardMaterial color="#556B2F" roughness={0.9} />
            </mesh>
        </group>
    );
});

const Grass = React.memo(({ position, isSelected, onSelect, globalAge = 1, maxHeight = 0.3, maxWidth = 0.4 }) => {
    const handleClick = useCallback((e) => { e.stopPropagation(); onSelect(); }, [onSelect]);
    const currentHeight = lerp(0.05, maxHeight, globalAge);
    const scaleY = currentHeight / maxHeight;

    return (
        <group position={position} onClick={handleClick}>
            {isSelected && <Box args={[maxWidth * 1.2, currentHeight * 1.2, maxWidth * 1.2]} position={[0, currentHeight / 2, 0]}>
                <meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false} />
            </Box>}
            <mesh position={[0, currentHeight / 2, 0]} scale={[1, scaleY, 1]}>
                <boxGeometry args={[maxWidth * 0.1, maxHeight, maxWidth * 0.1]} />
                <meshStandardMaterial color="#7CFC00" side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0.05, (currentHeight * 0.8) / 2, 0.05]} rotation={[0, Math.PI / 4, 0]} scale={[1, scaleY * 0.8, 1]}> {/* Corrected scale logic */}
                 <boxGeometry args={[maxWidth * 0.1, maxHeight * 0.8, maxWidth * 0.1]}/> {/* Use scaled geometry height */}
                 <meshStandardMaterial color="#90EE90" side={THREE.DoubleSide}/>
             </mesh>
             <mesh position={[-0.05, (currentHeight*0.9) / 2, -0.05]} rotation={[0, -Math.PI / 3, 0]} scale={[1, scaleY * 0.9, 1]}> {/* Corrected scale logic */}
                <boxGeometry args={[maxWidth * 0.1, maxHeight * 0.9, maxWidth * 0.1]}/> {/* Use scaled geometry height */}
                 <meshStandardMaterial color="#9ACD32" side={THREE.DoubleSide}/>
             </mesh>
        </group>
    );
});

// Map object types to components
const ObjectComponents = { tree: Tree, shrub: Shrub, grass: Grass };

// --- Scene Component (Manages R3F State and Logic) ---
const SceneWithLogic = forwardRef(({ addModeObjectType, selectedObjectId, globalAge, onObjectSelect, onInteractionEnd }, ref) => {
    // --- State ---
    const [heightData, setHeightData] = useState(() => getInitialHeightData(INITIAL_GRID_WIDTH, INITIAL_GRID_HEIGHT));
    const [colorData, setColorData] = useState(() => getInitialColorData(heightData));
    const [objects, setObjects] = useState([
        { id: nextObjectId++, type: 'tree', gridX: 5, gridZ: 5, maxTrunkHeight: 0.8, maxFoliageHeight: 1.2, maxFoliageRadius: 0.5 },
        { id: nextObjectId++, type: 'tree', gridX: 15, gridZ: 8, maxTrunkHeight: 1.2, maxFoliageHeight: 1.8, maxFoliageRadius: 0.7 },
        { id: nextObjectId++, type: 'shrub', gridX: 8, gridZ: 14, maxRadius: 0.5 },
        { id: nextObjectId++, type: 'grass', gridX: 10, gridZ: 10, maxHeight: 0.4, maxWidth: 0.5 },
    ]);

    // Derive grid dimensions from state
    const gridHeight = useMemo(() => heightData.length, [heightData]);
    const gridWidth = useMemo(() => (heightData[0] ? heightData[0].length : 0), [heightData]);

    // Initial data helpers
    function getInitialHeightData(width, height) {
        const data = []; for (let z = 0; z < height; z++) { data[z] = []; for (let x = 0; x < width; x++) { data[z][x] = getInitialHeight(x, z, width, height); } } return data;
    }
    function getInitialColorData(hData) {
        const data = []; const height = hData.length; if (height === 0) return []; const width = hData[0].length;
        for (let z = 0; z < height; z++) { data[z] = []; for (let x = 0; x < width; x++) { const h = hData[z][x]; const hr = h / INITIAL_MAX_HEIGHT; const ci = Math.min(COLORS.length - 1, Math.max(0, Math.floor(hr * (COLORS.length - 2)) + 1)); data[z][x] = h < 0.05 ? COLORS[0] : COLORS[ci]; } } return data;
    }

    // --- Interaction Logic ---
    const handleGridClick = useCallback((x, z, isShift, isCtrl) => {
        if (addModeObjectType) {
            const baseProps = { id: nextObjectId++, type: addModeObjectType, gridX: x, gridZ: z };
            const typeProps = { tree: { maxTrunkHeight: 0.8, maxFoliageHeight: 1.2, maxFoliageRadius: 0.5 }, shrub: { maxRadius: 0.4 }, grass: { maxHeight: 0.3, maxWidth: 0.4 }, }[addModeObjectType] || {};
            setObjects(prev => [...prev, { ...baseProps, ...typeProps }]);
            onInteractionEnd();
        } else if (selectedObjectId !== null) {
            setObjects(prev => prev.map(obj => obj.id === selectedObjectId ? { ...obj, gridX: x, gridZ: z } : obj));
            onInteractionEnd();
        } else {
             if (isCtrl) { setColorData(prevData => { const n = prevData.map(r => [...r]); const ci = COLORS.indexOf(n[z][x]); n[z][x] = COLORS[(ci + 1) % COLORS.length]; return n; }); }
             else { setHeightData(prevData => { const n = prevData.map(r => [...r]); const ch = n[z][x]; const nh = ch + (isShift ? -HEIGHT_MODIFIER : HEIGHT_MODIFIER); n[z][x] = Math.max(0, nh); return n; }); }
        }
    }, [addModeObjectType, selectedObjectId, onInteractionEnd]);

    const internalHandleObjectSelect = useCallback((id) => { onObjectSelect(id); }, [onObjectSelect]);

    // --- Imperative API ---
    useImperativeHandle(ref, () => ({
        save: () => ({ version: 3, heightData, colorData, objects }),
        load: (loadedData) => {
            if (!loadedData || typeof loadedData !== 'object') throw new Error("Invalid data: not an object");
            const version = loadedData.version ?? 1;
            if (!Array.isArray(loadedData.heightData)) throw new Error("Invalid data: missing/invalid heightData");
            if (!Array.isArray(loadedData.colorData)) throw new Error("Invalid data: missing/invalid colorData");
            if (!Array.isArray(loadedData.objects)) throw new Error("Invalid data: missing/invalid objects");

            setHeightData(loadedData.heightData);
            setColorData(loadedData.colorData);
            const processedObjects = loadedData.objects.map(obj => {
                if (version < 3) {
                    const defaults = { tree: { maxTrunkHeight: 0.8, maxFoliageHeight: 1.2, maxFoliageRadius: 0.5 }, shrub: { maxRadius: 0.4 }, grass: { maxHeight: 0.3, maxWidth: 0.4 }, };
                    return { ...obj, ...(defaults[obj.type] || {}) };
                } return obj;
             });
            setObjects(processedObjects);
            const maxId = processedObjects.reduce((max, obj) => Math.max(max, obj.id), 0);
            nextObjectId = maxId + 1;
            onInteractionEnd();
            // Return new size for parent to update UI state
            return { newWidth: loadedData.heightData[0]?.length ?? 0, newHeight: loadedData.heightData.length ?? 0 };
        },
        removeObject: (id) => { setObjects(prev => prev.filter(obj => obj.id !== id)); },
        resizeGrid: (newWidth, newHeight) => {
             const oldWidth = gridWidth; const oldHeight = gridHeight; const oldHeightData = heightData; const oldColorData = colorData;
             const newHData = []; const newCData = [];
             for (let z = 0; z < newHeight; z++) {
                newHData[z] = []; newCData[z] = [];
                for (let x = 0; x < newWidth; x++) {
                    if (x < oldWidth && z < oldHeight) { newHData[z][x] = oldHeightData[z][x]; newCData[z][x] = oldColorData[z][x]; }
                    else { const h = getInitialHeight(x, z, newWidth, newHeight); newHData[z][x] = h; const hr = h / INITIAL_MAX_HEIGHT; const ci = Math.min(COLORS.length - 1, Math.max(0, Math.floor(hr * (COLORS.length - 2)) + 1)); newCData[z][x] = h < 0.05 ? COLORS[0] : COLORS[ci]; }
                }
             }
             setHeightData(newHData); setColorData(newCData);
             setObjects(prev => prev.filter(obj => obj.gridX < newWidth && obj.gridZ < newHeight));
             onInteractionEnd();
        }
    }), [heightData, colorData, objects, gridWidth, gridHeight, onInteractionEnd]);


    // --- Render Logic ---
    const gridCells = useMemo(() => {
        if (gridWidth === 0 || gridHeight === 0) return []; const cells = [];
        for (let z = 0; z < gridHeight; z++) { for (let x = 0; x < gridWidth; x++) { cells.push(<GridCell key={`${x}-${z}`} x={x} z={z} height={heightData[z]?.[x] ?? 0} color={colorData[z]?.[x] ?? '#ffffff'} onClick={handleGridClick} gridWidth={gridWidth} gridHeight={gridHeight} />); } } return cells;
    }, [heightData, colorData, gridWidth, gridHeight, handleGridClick]);

    const renderedObjects = useMemo(() => {
         if (gridWidth === 0 || gridHeight === 0) return [];
        return objects.map(obj => {
            const ObjectComponent = ObjectComponents[obj.type];
            if (!ObjectComponent) return null;
            const clampedX = Math.max(0, Math.min(obj.gridX, gridWidth - 1));
            const clampedZ = Math.max(0, Math.min(obj.gridZ, gridHeight - 1));
            const groundHeight = heightData[clampedZ]?.[clampedX] ?? 0;
            const [worldX, , worldZ] = gridToWorld(clampedX, clampedZ, groundHeight, gridWidth, gridHeight);
            const worldY = groundHeight;
            return ( <ObjectComponent key={obj.id} position={[worldX, worldY, worldZ]} isSelected={obj.id === selectedObjectId} onSelect={() => internalHandleObjectSelect(obj.id)} globalAge={globalAge} {...obj} /> );
        })
    }, [objects, heightData, gridWidth, gridHeight, selectedObjectId, globalAge, internalHandleObjectSelect]);

    const controlsTarget = useMemo(() => [0, 0, 0], []);
    const groundPlaneSize = useMemo(() => [gridWidth * CELL_SIZE + 4, gridHeight * CELL_SIZE + 4], [gridWidth, gridHeight]);
    const avgHeight = useMemo(() => {
        if (gridWidth === 0 || gridHeight === 0) return 0; let totalHeight = 0;
        for (let z = 0; z < gridHeight; z++) { for (let x = 0; x < gridWidth; x++) { totalHeight += heightData[z]?.[x] ?? 0; } }
        return totalHeight / (gridWidth * gridHeight);
    }, [heightData, gridWidth, gridHeight]);

    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight position={[gridWidth * 0.5, 15 + avgHeight, gridHeight * 0.5]} intensity={1.0} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
            <PerspectiveCamera makeDefault position={[15, 20, 25]} fov={60} />
            <OrbitControls target={controlsTarget} enablePan={true} enableZoom={true} enableRotate={true}/>
            <group>{gridCells}</group>
            <group>{renderedObjects}</group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                <planeGeometry args={groundPlaneSize} />
                <meshStandardMaterial color="#444" side={THREE.DoubleSide} />
            </mesh>
        </>
    );
});


// --- App Entry Point (Manages Layout, UI Buttons, Modes) ---
export default function PlanEditor() {
    const sceneLogicRef = useRef();
    const fileInputRef = useRef(null);

    // --- Modes & Global State ---
    const [addModeObjectType, setAddModeObjectType] = useState(null);
    const [selectedObjectId, setSelectedObjectId] = useState(null);
    const [globalAge, setGlobalAge] = useState(1.0);
    const [desiredWidth, setDesiredWidth] = useState(INITIAL_GRID_WIDTH);
    const [desiredHeight, setDesiredHeight] = useState(INITIAL_GRID_HEIGHT);
    const [currentGridSize, setCurrentGridSize] = useState({w: INITIAL_GRID_WIDTH, h: INITIAL_GRID_HEIGHT});

    const currentMode = useMemo(() => {
        if (addModeObjectType) return `add-${addModeObjectType}`; if (selectedObjectId !== null) return 'move'; return 'edit-terrain';
    }, [addModeObjectType, selectedObjectId]);

    // Note: The useEffect here was causing the error.
    // We update currentGridSize directly after resize and load instead.
    // useEffect(() => {
    //    // This approach was flawed anyway. Better to update after actions.
    // }, [desiredWidth, desiredHeight]);


    // --- Button Styles ---
    const getButtonStyle = (modeOrAction, disabled = false) => ({
        margin: '2px', padding: '4px 8px', border: currentMode === modeOrAction ? '2px solid #eee' : '2px solid transparent',
        backgroundColor: disabled ? '#666' : (currentMode === modeOrAction ? '#555' : '#333'),
        color: disabled ? '#aaa' : 'white', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
    });


     // --- Handlers ---
    const onSaveClick = useCallback(() => {
        const saveData = sceneLogicRef.current?.save(); if (!saveData) return; const jsonString = JSON.stringify(saveData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = 'plan_data_v3.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }, []);

    const onLoadClick = useCallback(() => { fileInputRef.current?.click(); }, []);

    const onFileSelected = useCallback((event) => {
        const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonString = e.target.result; const loadedData = JSON.parse(jsonString);
                // Load returns the new size
                const newSize = sceneLogicRef.current?.load(loadedData);
                if (newSize) {
                    setDesiredWidth(newSize.newWidth); setDesiredHeight(newSize.newHeight);
                    setCurrentGridSize({w: newSize.newWidth, h: newSize.newHeight});
                }
            } catch (error) { console.error("Error loading/parsing:", error); alert(`Failed to load: ${error.message}`); }
            finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
        }; reader.onerror = (e) => { console.error("Read error:", e); alert("Error reading file."); if (fileInputRef.current) fileInputRef.current.value = ""; }; reader.readAsText(file);
    }, []); // Dependency array is okay, relies on ref.current

    const handleSetMode = (type) => { setAddModeObjectType(type); setSelectedObjectId(null); };
    const handleSelectObject = (id) => { setSelectedObjectId(id); setAddModeObjectType(null); };
    const handleRemoveSelected = () => { if (selectedObjectId !== null) { sceneLogicRef.current?.removeObject(selectedObjectId); setSelectedObjectId(null); } };
    const handleInteractionEnd = () => { setSelectedObjectId(null); setAddModeObjectType(null); };

    const handleResize = () => {
        const w = parseInt(desiredWidth, 10); const h = parseInt(desiredHeight, 10);
        if (isNaN(w) || isNaN(h) || w < MIN_GRID_DIM || h < MIN_GRID_DIM || w > MAX_GRID_DIM || h > MAX_GRID_DIM) {
            alert(`Invalid size. Dimensions must be between ${MIN_GRID_DIM} and ${MAX_GRID_DIM}.`);
            setDesiredWidth(currentGridSize.w); setDesiredHeight(currentGridSize.h); return;
        }
         sceneLogicRef.current?.resizeGrid(w, h);
         setCurrentGridSize({ w: w, h: h }); // Update UI state after calling resize
    };

    const instructions = useMemo(() => {
        switch(currentMode) {
            case 'add-tree': return "Click grid to add Tree."; case 'add-shrub': return "Click grid to add Shrub."; case 'add-grass': return "Click grid to add Grass.";
            case 'move': return "Click grid to move. Click object to select.";
            default: return "Click: Raise | Shift+Click: Lower | Ctrl+Click: Color | Click object to select.";
        }
    }, [currentMode]);

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#282c34' }}>
            {/* UI Overlay */}
             <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1, color: 'white', background: 'rgba(0,0,0,0.75)', padding: '10px', borderRadius: '5px', fontSize: '12px', maxWidth: '220px' }}>
                 {/* Mode Selection */}
                <div style={{ marginBottom: '8px' }}>
                     <strong>Mode:</strong><br/>
                     <button style={getButtonStyle('edit-terrain')} onClick={() => handleSetMode(null)}>Pointer/Edit</button>
                     <button style={getButtonStyle('add-tree')} onClick={() => handleSetMode('tree')}>Add Tree</button>
                     <button style={getButtonStyle('add-shrub')} onClick={() => handleSetMode('shrub')}>Add Shrub</button>
                     <button style={getButtonStyle('add-grass')} onClick={() => handleSetMode('grass')}>Add Grass</button>
                </div>
                 {/* Actions */}
                <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}>
                     <strong>Actions:</strong><br/>
                    <button onClick={onLoadClick} style={getButtonStyle('load')}>Load</button>
                    <button onClick={onSaveClick} style={getButtonStyle('save')}>Save</button>
                    <button onClick={handleRemoveSelected} disabled={selectedObjectId === null} style={getButtonStyle('remove', selectedObjectId === null)}>Remove Sel.</button>
                </div>
                 {/* Grid Resize */}
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}>
                    <strong>Grid ({currentGridSize.w} x {currentGridSize.h}):</strong><br/>
                    <input type="number" value={desiredWidth} onChange={(e) => setDesiredWidth(e.target.value)} min={MIN_GRID_DIM} max={MAX_GRID_DIM} style={{ width: '40px', marginRight: '3px' }}/>
                     x
                    <input type="number" value={desiredHeight} onChange={(e) => setDesiredHeight(e.target.value)} min={MIN_GRID_DIM} max={MAX_GRID_DIM} style={{ width: '40px', marginLeft: '3px', marginRight: '5px' }}/>
                    <button onClick={handleResize} style={getButtonStyle('resize')}>Resize</button>
                 </div>
                {/* Aging Slider */}
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}>
                    <strong>Global Age:</strong> {globalAge.toFixed(2)}<br/>
                    <input type="range" min="0" max="1" step="0.01" value={globalAge} onChange={(e) => setGlobalAge(parseFloat(e.target.value))} style={{ width: '100%' }} />
                 </div>
                 {/* Instructions */}
                <div style={{ borderTop: '1px solid #555', paddingTop: '8px' }}>
                    <strong>How To:</strong><br/> {instructions}
                </div>
            </div>

            {/* Hidden File Input */}
            <input type="file" ref={fileInputRef} onChange={onFileSelected} accept=".json,application/json" style={{ display: 'none' }} />

            {/* Canvas Container */}
            <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                <Canvas shadows camera={{ position: [15, 20, 25], fov: 60 }}>
                    <SceneWithLogic
                        ref={sceneLogicRef}
                        addModeObjectType={addModeObjectType}
                        selectedObjectId={selectedObjectId}
                        globalAge={globalAge}
                        onObjectSelect={handleSelectObject}
                        onInteractionEnd={handleInteractionEnd}
                     />
                </Canvas>
            </div>
        </div>
    );
}
