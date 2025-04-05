// src/PlanEditor.jsx
import React, { useState, useMemo, useCallback, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber'; // useFrame might be needed by Objects.jsx via ObjectBase
import { OrbitControls, PerspectiveCamera, Box, Plane } from '@react-three/drei';
import * as THREE from 'three';

// Import object components AND their editor schemas
import { ObjectComponents, ObjectEditorSchemas } from './Objects.jsx';

// --- Configuration ---
const CELL_SIZE = 1;
const HEIGHT_MODIFIER = 0.1; // Base height change per brush application
const INITIAL_MAX_HEIGHT = 1.5; // For terrain generation
const INITIAL_GRID_WIDTH = 20;
const INITIAL_GRID_HEIGHT = 20;
const MIN_GRID_DIM = 5;
const MAX_GRID_DIM = 100;
const COLORS = ['#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#795548']; // Terrain Colors
const DRAG_PLANE_OFFSET = 0.1; // Place drag plane slightly above ground

// --- Helper Functions ---
const getInitialHeight = (x, z, width, height) => {
    const freqX = 2 * Math.PI / width; const freqZ = 2 * Math.PI / height;
    const sinX = Math.sin(x * freqX * 2); const sinZ = Math.sin(z * freqZ * 2);
    return (sinX + sinZ + 2) / 4 * INITIAL_MAX_HEIGHT;
};
// For loading old saves or placing initial grid items
const gridToWorldCenter = (gridX, gridZ, currentHeight, gridWidth, gridHeight) => {
    const worldX = (gridX - gridWidth / 2 + 0.5) * CELL_SIZE;
    const worldZ = (gridZ - gridHeight / 2 + 0.5) * CELL_SIZE;
    const worldY = currentHeight / 2; // Center Y for grid cell box
    return [worldX, worldY, worldZ];
};
// Calculate base Y position for an object placed *on* the ground
const getWorldYBase = (groundHeight) => groundHeight;
const lerp = THREE.MathUtils.lerp; // Shortcut

// --- Object ID Counter ---
let nextObjectId = 1; // Simple counter for unique IDs

// --- Components ---

// GridCell remains here as it's part of the terrain base
const GridCell = React.memo(({ x, z, height, color, onPointerDown, gridWidth, gridHeight }) => {
    // Calculate world position for the center of the grid cell box
    const position = useMemo(() => {
        const worldX = (x - gridWidth / 2 + 0.5) * CELL_SIZE;
        const worldZ = (z - gridHeight / 2 + 0.5) * CELL_SIZE;
        const worldY = (height <= 0 ? 0.01 : height) / 2; // Center Y based on actual height
        return [worldX, worldY, worldZ];
    }, [x, z, height, gridWidth, gridHeight]);

    const scale = useMemo(() => [CELL_SIZE, height <= 0 ? 0.01 : height, CELL_SIZE], [height]);

    const handlePointerDown = useCallback((event) => {
        // Allow event to bubble up to the Canvas/Experience handler
        onPointerDown(event, x, z);
    }, [x, z, onPointerDown]);

    return (
        <mesh
            position={position}
            scale={scale}
            onPointerDown={handlePointerDown}
            castShadow
            receiveShadow
            name={`gridcell-${x}-${z}`}
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} />
        </mesh>
    );
});


// --- Scene Component (Manages Data State and 3D Primitives) ---
const SceneWithLogic = forwardRef(({
    selectedObjectId, globalAge, brushSize, // Props
    onObjectSelect, onObjectPointerDown, onGridPointerDown, onInteractionEnd // Callbacks
}, ref) => {
    // --- State ---
    const [heightData, setHeightData] = useState(() => getInitialHeightData(INITIAL_GRID_WIDTH, INITIAL_GRID_HEIGHT));
    const [colorData, setColorData] = useState(() => getInitialColorData(heightData));
    const [objects, setObjects] = useState(() => { // Initial objects with worldX/Z and properties
        const initialGridObjects = [
            { id: 1, type: 'tree', gridX: 5, gridZ: 5 },
            { id: 2, type: 'tree', gridX: 15, gridZ: 8 },
            { id: 3, type: 'shrub', gridX: 8, gridZ: 14 },
            { id: 4, type: 'grass', gridX: 10, gridZ: 10 },
        ];
        nextObjectId = 5;
        const hData = getInitialHeightData(INITIAL_GRID_WIDTH, INITIAL_GRID_HEIGHT);
        return initialGridObjects.map(obj => {
            // Add defaults based on schema for initial objects
            const defaults = {};
            const schema = ObjectEditorSchemas[obj.type];
            if (schema) {
                schema.forEach(propInfo => {
                    defaults[propInfo.name] = propInfo.defaultValue ?? (propInfo.type === 'color' ? '#CCCCCC' : (propInfo.min ?? 0.5));
                 });
            }
             // Convert grid pos to world pos
             const groundHeight = hData[obj.gridZ]?.[obj.gridX] ?? 0;
             const [worldX, , worldZ] = gridToWorldCenter(obj.gridX, obj.gridZ, groundHeight, INITIAL_GRID_WIDTH, INITIAL_GRID_HEIGHT);
             const { gridX, gridZ, ...rest } = obj;
             return { ...defaults, ...rest, worldX, worldZ }; // Apply defaults, then obj data
        });
     });
    const gridHeight = useMemo(() => heightData.length, [heightData]);
    const gridWidth = useMemo(() => (heightData[0] ? heightData[0].length : 0), [heightData]);

    // Initial data helpers
    function getInitialHeightData(width, height) {
        const data = []; for (let z = 0; z < height; z++) { data[z] = []; for (let x = 0; x < width; x++) { data[z][x] = getInitialHeight(x, z, width, height); } } return data;
    }
    function getInitialColorData(hData) {
        const data = []; const height = hData.length; if (height === 0) return []; const width = hData[0].length;
        for (let z = 0; z < height; z++) { data[z] = []; for (let x = 0; x < width; x++) { const h = hData[z]?.[x] ?? 0; const hr = h / INITIAL_MAX_HEIGHT; const ci = Math.min(COLORS.length - 1, Math.max(0, Math.floor(hr * (COLORS.length - 2)) + 1)); data[z][x] = h < 0.05 ? COLORS[0] : COLORS[ci]; } } return data;
    }

    // --- Terrain & Height Lookup ---
    const applyTerrainBrush = useCallback((centerX, centerZ, deltaHeight) => {
         setHeightData(prevData => {
            const newData = prevData.map(row => [...row]);
            const radius = brushSize - 1;
            const radiusSq = radius * radius;
            const startX = Math.max(0, Math.floor(centerX - radius));
            const endX = Math.min(gridWidth - 1, Math.ceil(centerX + radius));
            const startZ = Math.max(0, Math.floor(centerZ - radius));
            const endZ = Math.min(gridHeight - 1, Math.ceil(centerZ + radius));

            for (let z = startZ; z <= endZ; z++) {
                for (let x = startX; x <= endX; x++) {
                    const distX = x - centerX; const distZ = z - centerZ; const distSq = distX * distX + distZ * distZ;
                    if (distSq <= (radius + 0.5) * (radius + 0.5)) {
                         let intensity = 0;
                         if (radius > 0.1) { const dist = Math.sqrt(distSq); const ratio = Math.min(1.0, dist / radius); intensity = Math.pow(Math.cos(ratio * Math.PI * 0.5), 2); } // Squared Cosine falloff
                         else { intensity = (distSq < 0.1) ? 1.0 : 0.0; }
                         const currentHeight = newData[z][x]; const modifiedHeight = currentHeight + deltaHeight * intensity;
                         newData[z][x] = Math.max(0, modifiedHeight);
                    }
                }
            } return newData;
        });
    }, [brushSize, gridWidth, gridHeight]);

    const getGroundHeightAtWorld = useCallback((worldX, worldZ) => {
        if (!heightData || gridWidth === 0 || gridHeight === 0) return 0;
        const fractionalGridX = worldX / CELL_SIZE + gridWidth / 2 - 0.5; const fractionalGridZ = worldZ / CELL_SIZE + gridHeight / 2 - 0.5;
        const gridX = Math.floor(fractionalGridX); const gridZ = Math.floor(fractionalGridZ);
        // Basic: Use cell height
        if (gridX >= 0 && gridX < gridWidth && gridZ >= 0 && gridZ < gridHeight) { return heightData[gridZ][gridX]; }
        // TODO: Bilinear interpolation for smoother height
        return 0;
    }, [heightData, gridWidth, gridHeight]);

     // --- Imperative API ---
    useImperativeHandle(ref, () => ({
        save: () => ({ version: 5, heightData, colorData, objects }),
        load: (loadedData) => {
            if (!loadedData || typeof loadedData !== 'object') throw new Error("Invalid data");
            const version = loadedData.version ?? 1;
            if (!Array.isArray(loadedData.heightData) || !Array.isArray(loadedData.colorData) || !Array.isArray(loadedData.objects)) throw new Error("Invalid data format");

            setHeightData(loadedData.heightData);
            setColorData(loadedData.colorData);
            const currentW = loadedData.heightData[0]?.length ?? 0;
            const currentH = loadedData.heightData.length ?? 0;
            const hDataForConvert = loadedData.heightData;

            const processedObjects = loadedData.objects.map(obj => {
                 let baseObj = { ...obj };
                 // Convert grid coords from older versions
                 if (version < 4 && baseObj.gridX !== undefined && baseObj.gridZ !== undefined) {
                     const groundHeight = hDataForConvert[baseObj.gridZ]?.[baseObj.gridX] ?? 0;
                     const [wX, , wZ] = gridToWorldCenter(baseObj.gridX, baseObj.gridZ, groundHeight, currentW, currentH);
                     baseObj.worldX = wX; baseObj.worldZ = wZ;
                     delete baseObj.gridX; delete baseObj.gridZ;
                 }
                 // Add defaults based on SCHEMAS for robustness
                 const schema = ObjectEditorSchemas[baseObj.type];
                 if (schema) {
                     schema.forEach(propInfo => {
                         if (baseObj[propInfo.name] === undefined) {
                             baseObj[propInfo.name] = propInfo.defaultValue ?? (propInfo.type === 'color' ? '#CCCCCC' : (propInfo.min ?? 0));
                         }
                     });
                 }
                  // Ensure core position exists
                  baseObj.worldX = baseObj.worldX ?? 0;
                  baseObj.worldZ = baseObj.worldZ ?? 0;
                 return baseObj;
             });
            setObjects(processedObjects);
            const maxId = processedObjects.reduce((max, obj) => Math.max(max, obj.id || 0), 0);
            nextObjectId = maxId + 1;
            return { newWidth: currentW, newHeight: currentH };
        },
        resizeGrid: (newWidth, newHeight) => {
             const oldWidth = gridWidth; const oldHeight = gridHeight; const oldHData = heightData; const oldCData = colorData;
             const newHData = []; const newCData = [];
             for (let z = 0; z < newHeight; z++) {
                newHData[z] = []; newCData[z] = [];
                for (let x = 0; x < newWidth; x++) {
                    if (x < oldWidth && z < oldHeight) { newHData[z][x] = oldHData[z][x]; newCData[z][x] = oldCData[z][x]; }
                    else { const h = getInitialHeight(x, z, newWidth, newHeight); newHData[z][x] = h; const hr = h / INITIAL_MAX_HEIGHT; const ci = Math.min(COLORS.length - 1, Math.max(0, Math.floor(hr * (COLORS.length - 2)) + 1)); newCData[z][x] = h < 0.05 ? COLORS[0] : COLORS[ci]; }
                }
             }
             setHeightData(newHData); setColorData(newCData);
             const minWorldX = -newWidth / 2 * CELL_SIZE; const maxWorldX = newWidth / 2 * CELL_SIZE; const minWorldZ = -newHeight / 2 * CELL_SIZE; const maxWorldZ = newHeight / 2 * CELL_SIZE;
             setObjects(prev => prev.filter(obj => obj.worldX >= minWorldX && obj.worldX < maxWorldX && obj.worldZ >= minWorldZ && obj.worldZ < maxWorldZ ));
             if (onInteractionEnd) onInteractionEnd(); // Notify parent
        },
        addObject: (newObjectData) => {
            const defaults = {}; const schema = ObjectEditorSchemas[newObjectData.type];
            if (schema) { schema.forEach(propInfo => { defaults[propInfo.name] = propInfo.defaultValue ?? (propInfo.type === 'color' ? '#CCCCCC' : (propInfo.min ?? 0.5)); }); }
            const fullData = { ...defaults, ...newObjectData };
            setObjects(prev => [...prev, fullData]);
        },
        removeObject: (id) => { setObjects(prev => prev.filter(obj => obj.id !== id)); },
        updateObjectPositionWorld: (id, newWorldX, newWorldZ) => { setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, worldX: newWorldX, worldZ: newWorldZ } : obj )); },
        getObjectProperties: (id) => { const obj = objects.find(o => o.id === id); return obj ? { ...obj } : null; },
        updateObjectProperty: (id, propName, value) => { setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, [propName]: value } : obj )); },
        getGroundHeightAtWorld: getGroundHeightAtWorld,
        getGridDimensions: () => ({ gridWidth, gridHeight }),
        applyTerrainBrush: applyTerrainBrush,
    }), [ heightData, colorData, objects, gridWidth, gridHeight, brushSize, applyTerrainBrush, getGroundHeightAtWorld, onInteractionEnd ]);


    // --- Render Logic ---
    const gridCells = useMemo(() => {
        if (gridWidth === 0 || gridHeight === 0) return []; const cells = [];
        for (let z = 0; z < gridHeight; z++) { for (let x = 0; x < gridWidth; x++) { cells.push(<GridCell key={`${x}-${z}`} x={x} z={z} height={heightData[z]?.[x] ?? 0} color={colorData[z]?.[x] ?? '#ffffff'} onPointerDown={onGridPointerDown} gridWidth={gridWidth} gridHeight={gridHeight} />); } } return cells;
    }, [heightData, colorData, gridWidth, gridHeight, onGridPointerDown]);

    const renderedObjects = useMemo(() => {
         if (gridWidth === 0 || gridHeight === 0) return [];
         return objects.map(obj => {
            const ObjectComponent = ObjectComponents[obj.type]; // Use imported map
            if (!ObjectComponent) { console.warn(`Unknown object type: ${obj.type}`); return null; }
            const groundHeight = getGroundHeightAtWorld(obj.worldX, obj.worldZ);
            const worldYBase = getWorldYBase(groundHeight);
            const position = [obj.worldX, worldYBase, obj.worldZ];
            return ( <ObjectComponent key={obj.id} objectId={obj.id} position={position} isSelected={obj.id === selectedObjectId} onSelect={() => onObjectSelect(obj.id)} onPointerDown={onObjectPointerDown} globalAge={globalAge} {...obj} /> );
        })
    }, [objects, selectedObjectId, globalAge, onObjectSelect, onObjectPointerDown, getGroundHeightAtWorld]); // Removed gridWidth/Height


     // --- Base Scene Elements ---
    const groundPlaneSize = useMemo(() => [gridWidth * CELL_SIZE + 4, gridHeight * CELL_SIZE + 4], [gridWidth, gridHeight]);
    const avgHeight = useMemo(() => { if (gridWidth === 0 || gridHeight === 0) return 0; let t = 0; let c = 0; for (let z = 0; z < gridHeight; z++) { for (let x = 0; x < gridWidth; x++) { t += heightData[z]?.[x] ?? 0; c++; } } return c > 0 ? t / c : 0; }, [heightData, gridWidth, gridHeight]);

    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight position={[gridWidth * 0.5, 15 + avgHeight, gridHeight * 0.5]} intensity={1.0} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
            <group>{gridCells}</group>
            <group>{renderedObjects}</group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow name="base-ground">
                <planeGeometry args={groundPlaneSize} />
                <meshStandardMaterial color="#444" side={THREE.DoubleSide} />
            </mesh>
        </>
    );
});


// --- Experience Component (Handles R3F Context and Interactions) ---
function Experience({
    currentMode, addModeObjectType, selectedObjectId, globalAge, brushSize,
    sceneLogicRef, onSelectObject, onInteractionEnd, getInitialObjectId
}) {
    const { raycaster, pointer, camera, gl } = useThree();
    const orbitControlsRef = useRef();
    const dragPlaneRef = useRef();
    const [draggingInfo, setDraggingInfo] = useState(null);
    const [isPaintingTerrain, setIsPaintingTerrain] = useState(false);
    const [paintDirection, setPaintDirection] = useState(1);
    const pointerRef = useRef({ x: 0, y: 0 });

    // --- Event Handlers ---
    const handleObjectPointerDown = useCallback((event, objectId, objectType) => {
        event.stopPropagation();
        if (currentMode === 'edit-terrain' || currentMode === 'move') {
            onSelectObject(objectId);
            const clickedObject = sceneLogicRef.current?.getObjectProperties(objectId);
            if (clickedObject) {
                const groundHeight = sceneLogicRef.current?.getGroundHeightAtWorld(clickedObject.worldX, clickedObject.worldZ) ?? 0;
                setDraggingInfo({ id: objectId, initialY: getWorldYBase(groundHeight) + DRAG_PLANE_OFFSET });
                if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
                event.target?.setPointerCapture(event.pointerId);
            }
        }
    }, [currentMode, onSelectObject, sceneLogicRef]);

    const handleGridPointerDown = useCallback((event, gridX, gridZ) => {
        if (draggingInfo || !sceneLogicRef.current) return;
        raycaster.setFromCamera(pointer, camera);
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectionPoint = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) return;
        const worldX = intersectionPoint.x; const worldZ = intersectionPoint.z;

        if (addModeObjectType) {
             const baseProps = { id: getInitialObjectId(), type: addModeObjectType, worldX, worldZ };
             sceneLogicRef.current.addObject(baseProps); // AddObject handles defaults
             onSelectObject(null); onInteractionEnd();
        } else if (selectedObjectId !== null && currentMode === 'move') {
            sceneLogicRef.current.updateObjectPositionWorld(selectedObjectId, worldX, worldZ);
            onInteractionEnd();
        } else if (currentMode === 'edit-terrain') {
            event.stopPropagation(); setIsPaintingTerrain(true); const dir = event.shiftKey ? -1 : 1; setPaintDirection(dir);
            sceneLogicRef.current.applyTerrainBrush(gridX, gridZ, HEIGHT_MODIFIER * dir); // Use grid coords for brush center
            event.target?.setPointerCapture(event.pointerId); if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
        } else { onSelectObject(null); }
    }, [currentMode, addModeObjectType, selectedObjectId, draggingInfo, brushSize, sceneLogicRef, onInteractionEnd, onSelectObject, getInitialObjectId, raycaster, pointer, camera]);

    const handlePointerMove = useCallback((event) => {
        pointerRef.current.x = (event.clientX / window.innerWidth) * 2 - 1; pointerRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
        if (!sceneLogicRef.current) return; raycaster.setFromCamera(pointerRef.current, camera);

        if (draggingInfo && dragPlaneRef.current) {
            const intersects = raycaster.intersectObject(dragPlaneRef.current);
            if (intersects.length > 0) { const point = intersects[0].point; sceneLogicRef.current.updateObjectPositionWorld(draggingInfo.id, point.x, point.z); }
        } else if (isPaintingTerrain) {
            const { gridWidth, gridHeight } = sceneLogicRef.current.getGridDimensions(); const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const intersectionPoint = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
                 const gridX = Math.floor(intersectionPoint.x / CELL_SIZE + gridWidth / 2); const gridZ = Math.floor(intersectionPoint.z / CELL_SIZE + gridHeight / 2);
                 if (gridX >= 0 && gridX < gridWidth && gridZ >= 0 && gridZ < gridHeight) { sceneLogicRef.current.applyTerrainBrush(gridX, gridZ, HEIGHT_MODIFIER * paintDirection); }
            }
        }
    }, [draggingInfo, isPaintingTerrain, paintDirection, raycaster, camera, sceneLogicRef]);

    const handlePointerUp = useCallback((event) => {
        // No need to check event target if using listeners on gl.domElement
        if (draggingInfo) { setDraggingInfo(null); if (orbitControlsRef.current) orbitControlsRef.current.enabled = true; }
        if (isPaintingTerrain) { setIsPaintingTerrain(false); if (orbitControlsRef.current) orbitControlsRef.current.enabled = true; }
    }, [draggingInfo, isPaintingTerrain]);

     // Effect to add/remove global listeners on the canvas element
     useEffect(() => {
        const domElement = gl.domElement;
        const moveHandler = (event) => handlePointerMove(event);
        const upHandler = (event) => handlePointerUp(event);
        if (draggingInfo || isPaintingTerrain) {
            domElement.addEventListener('pointermove', moveHandler);
            domElement.addEventListener('pointerup', upHandler);
            domElement.addEventListener('pointerleave', upHandler); // End interaction if pointer leaves canvas
        }
        return () => {
            domElement.removeEventListener('pointermove', moveHandler);
            domElement.removeEventListener('pointerup', upHandler);
            domElement.removeEventListener('pointerleave', upHandler);
            // Ensure controls re-enabled on cleanup
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
        };
    }, [draggingInfo, isPaintingTerrain, handlePointerMove, handlePointerUp, gl]);

    // Deselection logic can be handled via onPointerMissed on Canvas in PlanEditor
    // Or add a full screen plane here with low render order and onPointerDown={handleBackgroundClick}

    return (
        <>
            <PerspectiveCamera makeDefault position={[15, 20, 25]} fov={60} />
            <SceneWithLogic
                ref={sceneLogicRef} selectedObjectId={selectedObjectId} globalAge={globalAge} brushSize={brushSize}
                onObjectSelect={onSelectObject} onObjectPointerDown={handleObjectPointerDown} onGridPointerDown={handleGridPointerDown}
                onInteractionEnd={onInteractionEnd}
            />
            {draggingInfo && (<Plane ref={dragPlaneRef} args={[10000, 10000]} rotation={[-Math.PI / 2, 0, 0]} position={[0, draggingInfo.initialY, 0]} visible={false} />)}
            <OrbitControls ref={orbitControlsRef} enabled={!draggingInfo && !isPaintingTerrain} makeDefault/>
        </>
    );
}


// --- App Entry Point (Manages Layout, UI, Modes, File IO) ---
export default function PlanEditor() {
    const sceneLogicRef = useRef();
    const fileInputRef = useRef(null);
    const [addModeObjectType, setAddModeObjectType] = useState(null);
    const [selectedObjectId, setSelectedObjectId] = useState(null);
    const [selectedObjectProps, setSelectedObjectProps] = useState(null);
    const [globalAge, setGlobalAge] = useState(1.0);
    const [brushSize, setBrushSize] = useState(3);
    const [desiredWidth, setDesiredWidth] = useState(INITIAL_GRID_WIDTH);
    const [desiredHeight, setDesiredHeight] = useState(INITIAL_GRID_HEIGHT);
    const [currentGridSize, setCurrentGridSize] = useState({w: INITIAL_GRID_WIDTH, h: INITIAL_GRID_HEIGHT});

    const currentMode = useMemo(() => { if (addModeObjectType) return `add-${addModeObjectType}`; if (selectedObjectId !== null) return 'move'; return 'edit-terrain'; }, [addModeObjectType, selectedObjectId]);
    const getNextObjectId = useCallback(() => nextObjectId++, []);
    const getButtonStyle = (modeOrAction, disabled = false) => ({ margin: '2px', padding: '4px 8px', border: currentMode === modeOrAction ? '2px solid #eee' : '2px solid transparent', backgroundColor: disabled ? '#666' : (currentMode === modeOrAction ? '#555' : '#333'), color: disabled ? '#aaa' : 'white', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 });

    useEffect(() => {
        if (selectedObjectId !== null && sceneLogicRef.current) { const props = sceneLogicRef.current.getObjectProperties(selectedObjectId); setSelectedObjectProps(props); }
        else { setSelectedObjectProps(null); }
    }, [selectedObjectId]);

    const onSaveClick = useCallback(() => {
         const saveData = sceneLogicRef.current?.save(); if (!saveData) return;
         const jsonString = JSON.stringify(saveData, null, 2); const blob = new Blob([jsonString], { type: 'application/json' });
         const url = URL.createObjectURL(blob); const a = document.createElement('a');
         a.href = url; a.download = `plan_data_v${saveData.version}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }, []);
    const onLoadClick = useCallback(() => { fileInputRef.current?.click(); }, []);
    const onFileSelected = useCallback((event) => {
        const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
        reader.onload = (e) => {
            try { const jsonString = e.target.result; const loadedData = JSON.parse(jsonString); const newSize = sceneLogicRef.current?.load(loadedData); if (newSize) { setDesiredWidth(newSize.newWidth); setDesiredHeight(newSize.newHeight); setCurrentGridSize({w: newSize.newWidth, h: newSize.newHeight}); } setSelectedObjectId(null); setAddModeObjectType(null); }
            catch (error) { console.error("Load Error:", error); alert(`Failed to load: ${error.message}`); }
            finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
        }; reader.onerror = (e) => { console.error("Read Error:", e); alert("Error reading file."); if (fileInputRef.current) fileInputRef.current.value = ""; }; reader.readAsText(file);
    }, []);
    const handleSetMode = (type) => { setAddModeObjectType(type); setSelectedObjectId(null); };
    const handleSelectObject = useCallback((id) => { setSelectedObjectId(id); setAddModeObjectType(null); }, []);
    const handleRemoveSelected = () => { if (selectedObjectId !== null) { sceneLogicRef.current?.removeObject(selectedObjectId); setSelectedObjectId(null); } };
    const handleInteractionEnd = useCallback(() => { setAddModeObjectType(null); setSelectedObjectId(null); }, []); // Deselect object on interaction end (e.g., after add, instant move, resize)
    const handleResize = () => {
        const w = parseInt(desiredWidth, 10); const h = parseInt(desiredHeight, 10);
        if (isNaN(w) || isNaN(h) || w < MIN_GRID_DIM || h < MIN_GRID_DIM || w > MAX_GRID_DIM || h > MAX_GRID_DIM) { alert(`Invalid size. Dimensions: ${MIN_GRID_DIM}-${MAX_GRID_DIM}.`); setDesiredWidth(currentGridSize.w); setDesiredHeight(currentGridSize.h); return; }
        sceneLogicRef.current?.resizeGrid(w, h); setCurrentGridSize({ w: w, h: h });
        // Interaction end callback handles deselect
    };
    const handlePropertyChange = (propName, value) => {
        if (selectedObjectId === null || !selectedObjectProps) return; let parsedValue = value; const schema = ObjectEditorSchemas[selectedObjectProps.type]; const propInfo = schema?.find(p => p.name === propName);
        if (propInfo?.type === 'number') { parsedValue = parseFloat(value); if (isNaN(parsedValue)) parsedValue = propInfo.min ?? 0; parsedValue = Math.max(propInfo.min ?? -Infinity, Math.min(propInfo.max ?? Infinity, parsedValue)); } // Clamp number values
        sceneLogicRef.current?.updateObjectProperty(selectedObjectId, propName, parsedValue); setSelectedObjectProps(prevProps => ({ ...prevProps, [propName]: parsedValue }));
    };
    const instructions = useMemo(() => { switch(currentMode) { case 'add-tree': case 'add-shrub': case 'add-grass': return `Click terrain to add ${addModeObjectType}.`; case 'move': return "Drag object. Click terrain for instant move. Click bg/obj to select."; default: return "Brush: Click/Drag grid (Shift=Lower). Drag object. Click obj/bg to select."; } }, [currentMode, addModeObjectType]);

    const renderPropertyEditors = () => {
        if (!selectedObjectProps) return null; const editorSchema = ObjectEditorSchemas[selectedObjectProps.type];
        if (!editorSchema) return (<div style={{ marginTop: '10px' }}>No editor defined for type: {selectedObjectProps.type}</div>);
        const commonPropsStyle = { marginBottom: '5px' }; const labelStyle = { display: 'inline-block', width: '90px', marginRight: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }; const inputStyle = { width: 'calc(100% - 100px)', boxSizing: 'border-box', verticalAlign: 'middle' };
        return (
             <div style={{ borderTop: '1px solid #555', paddingTop: '8px', marginTop: '8px' }}>
                <strong>Edit {selectedObjectProps.type} (ID: {selectedObjectProps.id})</strong>
                {editorSchema.map(propInfo => (
                    <div key={propInfo.name} style={commonPropsStyle}>
                        <label style={labelStyle} htmlFor={propInfo.name} title={propInfo.label}>{propInfo.label}:</label>
                        <input style={inputStyle} id={propInfo.name} type={propInfo.type} step={propInfo.step} min={propInfo.min} max={propInfo.max} value={selectedObjectProps[propInfo.name] ?? (propInfo.type === 'color' ? '#000000' : (propInfo.min ?? 0))} onChange={(e) => handlePropertyChange(propInfo.name, e.target.value)} />
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#282c34' }}>
             <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1, color: 'white', background: 'rgba(0,0,0,0.8)', padding: '10px', borderRadius: '5px', fontSize: '12px', width: '220px', maxHeight: 'calc(100vh - 20px)', overflowY: 'auto', boxSizing: 'border-box' }}>
                 <div style={{ marginBottom: '8px' }}> <strong>Mode:</strong><br/> <button style={getButtonStyle('edit-terrain')} onClick={() => handleSetMode(null)}>Ptr/Brush</button> <button style={getButtonStyle('add-tree')} onClick={() => handleSetMode('tree')}>Add Tree</button> <button style={getButtonStyle('add-shrub')} onClick={() => handleSetMode('shrub')}>Add Shrub</button> <button style={getButtonStyle('add-grass')} onClick={() => handleSetMode('grass')}>Add Grass</button> </div>
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}> <strong>Actions:</strong><br/> <button onClick={onLoadClick} style={getButtonStyle('load')}>Load</button> <button onClick={onSaveClick} style={getButtonStyle('save')}>Save</button> <button onClick={handleRemoveSelected} disabled={selectedObjectId === null} style={getButtonStyle('remove', selectedObjectId === null)}>Remove</button> </div>
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}> <strong>Grid ({currentGridSize.w}x{currentGridSize.h}):</strong><br/> <input type="number" value={desiredWidth} onChange={(e) => setDesiredWidth(e.target.value)} min={MIN_GRID_DIM} max={MAX_GRID_DIM} style={{ width: '40px', marginRight: '3px' }}/> x <input type="number" value={desiredHeight} onChange={(e) => setDesiredHeight(e.target.value)} min={MIN_GRID_DIM} max={MAX_GRID_DIM} style={{ width: '40px', marginLeft: '3px', marginRight: '5px' }}/> <button onClick={handleResize} style={getButtonStyle('resize')}>Resize</button> </div>
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}> <strong>Brush Size:</strong> {brushSize}<br/> <input type="range" min="1" max="10" step="1" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} style={{ width: '100%' }}/> </div>
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}> <strong>Global Age:</strong> {globalAge.toFixed(2)}<br/> <input type="range" min="0" max="1" step="0.01" value={globalAge} onChange={(e) => setGlobalAge(parseFloat(e.target.value))} style={{ width: '100%' }} /> </div>
                 {renderPropertyEditors()}
                 <div style={{ borderTop: '1px solid #555', paddingTop: '8px', marginTop: '8px' }}> <strong>How To:</strong><br/> {instructions} </div>
            </div>
            <input type="file" ref={fileInputRef} onChange={onFileSelected} accept=".json,application/json" style={{ display: 'none' }} />
             <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                <Canvas shadows onPointerMissed={() => { if (!addModeObjectType && selectedObjectId !== null) { handleSelectObject(null); } }}>
                    <Experience
                         currentMode={currentMode} addModeObjectType={addModeObjectType} selectedObjectId={selectedObjectId}
                         globalAge={globalAge} brushSize={brushSize} sceneLogicRef={sceneLogicRef}
                         onSelectObject={handleSelectObject} onInteractionEnd={handleInteractionEnd} getInitialObjectId={getNextObjectId}
                    />
                </Canvas>
            </div>
        </div>
    );
}
