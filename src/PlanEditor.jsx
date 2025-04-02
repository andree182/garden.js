import React, { useState, useMemo, useCallback, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Box, Plane } from '@react-three/drei';
import * as THREE from 'three';

// --- Configuration ---
const CELL_SIZE = 1;
const HEIGHT_MODIFIER = 0.1; // Base height change per brush application
const INITIAL_MAX_HEIGHT = 1.5;
const INITIAL_GRID_WIDTH = 20;
const INITIAL_GRID_HEIGHT = 20;
const MIN_GRID_DIM = 5;
const MAX_GRID_DIM = 100;
const COLORS = ['#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#795548'];
const SELECTION_COLOR = '#FF00FF';
const DRAG_PLANE_OFFSET = 0.1; // Place drag plane slightly above ground

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
const lerp = THREE.MathUtils.lerp;

// --- Object ID Counter ---
let nextObjectId = 1;

// --- Components ---

// GridCell: Modified onClick to onPointerDown for consistency
const GridCell = React.memo(({ x, z, height, color, onPointerDown, gridWidth, gridHeight }) => {
    const position = useMemo(() => gridToWorld(x, z, height, gridWidth, gridHeight), [x, z, height, gridWidth, gridHeight]);
    const scale = useMemo(() => [CELL_SIZE, height <= 0 ? 0.01 : height, CELL_SIZE], [height]);
    const handlePointerDown = useCallback((event) => {
        // Don't stop propagation here, let PlanEditor handle top-level events
        onPointerDown(event, x, z);
    }, [x, z, onPointerDown]);
    return (<mesh position={position} scale={scale} onPointerDown={handlePointerDown} castShadow receiveShadow name={`gridcell-${x}-${z}`}> <boxGeometry args={[1, 1, 1]} /> <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} /> </mesh>);
});

// Object Components: Added onPointerDown for dragging
const ObjectBase = ({ children, position, isSelected, onSelect, onPointerDown, objectId, type }) => {
    const handlePointerDown = useCallback((e) => {
        // Don't stop propagation here initially.
        // We might let the PlanEditor decide based on mode.
        onPointerDown(e, objectId, type); // Pass ID and type up
        // Select on pointer down, not just click
        onSelect();
    }, [onPointerDown, objectId, type, onSelect]);

    return (
        <group position={position} onPointerDown={handlePointerDown}>
            {children}
        </group>
    );
};

const Tree = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1, maxTrunkHeight = 0.8, maxFoliageHeight = 1.2, maxFoliageRadius = 0.5 }) => {
    const currentTrunkHeight = lerp(0.1, maxTrunkHeight, globalAge);
    const currentFoliageHeight = lerp(0.1, maxFoliageHeight, globalAge);
    const currentFoliageRadius = lerp(0.05, maxFoliageRadius, globalAge);
    const totalCurrentHeight = currentTrunkHeight + currentFoliageHeight;
    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="tree">
            {isSelected && <Box args={[currentFoliageRadius * 2.2, totalCurrentHeight + 0.2, currentFoliageRadius * 2.2]} position={[0, totalCurrentHeight / 2, 0]}><meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false} /></Box>}
            <mesh position={[0, currentTrunkHeight / 2, 0]} scale={[1, currentTrunkHeight / maxTrunkHeight, 1]} castShadow><cylinderGeometry args={[0.15, 0.2, maxTrunkHeight, 8]} /><meshStandardMaterial color="#8B4513" /></mesh>
            <mesh position={[0, currentTrunkHeight + currentFoliageHeight / 2 - 0.05, 0]} scale={[currentFoliageRadius / maxFoliageRadius, currentFoliageHeight / maxFoliageHeight, currentFoliageRadius / maxFoliageRadius]} castShadow><coneGeometry args={[maxFoliageRadius, maxFoliageHeight, 16]} /><meshStandardMaterial color="#2E7D32" /></mesh>
        </ObjectBase>
    );
});
// Shrub and Grass components similarly wrapped in ObjectBase
const Shrub = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1, maxRadius = 0.4 }) => {
    const currentRadius = lerp(0.1, maxRadius, globalAge);
    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="shrub">
            {isSelected && <Box args={[currentRadius * 2.2, currentRadius * 2.2, currentRadius * 2.2]} position={[0, currentRadius, 0]}><meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false} /></Box>}
            <mesh position={[0, currentRadius, 0]} scale={[currentRadius / maxRadius, currentRadius / maxRadius, currentRadius / maxRadius]} castShadow><sphereGeometry args={[maxRadius, 16, 12]} /><meshStandardMaterial color="#556B2F" roughness={0.9} /></mesh>
        </ObjectBase>
    );
});
const Grass = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1, maxHeight = 0.3, maxWidth = 0.4 }) => {
    const currentHeight = lerp(0.05, maxHeight, globalAge); const scaleY = currentHeight / maxHeight;
    return (
         <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="grass">
             {isSelected && <Box args={[maxWidth * 1.2, currentHeight * 1.2, maxWidth * 1.2]} position={[0, currentHeight / 2, 0]}><meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false} /></Box>}
             <mesh position={[0, currentHeight / 2, 0]} scale={[1, scaleY, 1]}><boxGeometry args={[maxWidth * 0.1, maxHeight, maxWidth * 0.1]} /><meshStandardMaterial color="#7CFC00" side={THREE.DoubleSide} /></mesh>
             <mesh position={[0.05, (currentHeight * 0.8) / 2, 0.05]} rotation={[0, Math.PI / 4, 0]} scale={[1, scaleY * 0.8, 1]}><boxGeometry args={[maxWidth * 0.1, maxHeight * 0.8, maxWidth * 0.1]}/><meshStandardMaterial color="#90EE90" side={THREE.DoubleSide}/></mesh>
             <mesh position={[-0.05, (currentHeight*0.9) / 2, -0.05]} rotation={[0, -Math.PI / 3, 0]} scale={[1, scaleY * 0.9, 1]}><boxGeometry args={[maxWidth * 0.1, maxHeight * 0.9, maxWidth * 0.1]}/><meshStandardMaterial color="#9ACD32" side={THREE.DoubleSide}/></mesh>
        </ObjectBase>
    );
});

const ObjectComponents = { tree: Tree, shrub: Shrub, grass: Grass };

// --- Scene Component (Manages R3F State and Logic, Less Event Handling) ---
const SceneWithLogic = forwardRef(({ addModeObjectType, selectedObjectId, globalAge, brushSize, onObjectSelect, onInteractionEnd, onObjectPointerDown, onGridPointerDown }, ref) => {
    // --- State ---
    const [heightData, setHeightData] = useState(() => getInitialHeightData(INITIAL_GRID_WIDTH, INITIAL_GRID_HEIGHT));
    const [colorData, setColorData] = useState(() => getInitialColorData(heightData));
    const [objects, setObjects] = useState([
        { id: nextObjectId++, type: 'tree', gridX: 5, gridZ: 5, maxTrunkHeight: 0.8, maxFoliageHeight: 1.2, maxFoliageRadius: 0.5 },
        { id: nextObjectId++, type: 'tree', gridX: 15, gridZ: 8, maxTrunkHeight: 1.2, maxFoliageHeight: 1.8, maxFoliageRadius: 0.7 },
        { id: nextObjectId++, type: 'shrub', gridX: 8, gridZ: 14, maxRadius: 0.5 },
        { id: nextObjectId++, type: 'grass', gridX: 10, gridZ: 10, maxHeight: 0.4, maxWidth: 0.5 },
    ]);
    const gridHeight = useMemo(() => heightData.length, [heightData]);
    const gridWidth = useMemo(() => (heightData[0] ? heightData[0].length : 0), [heightData]);

    // Initial data helpers...
        // Initial data helpers
    function getInitialHeightData(width, height) {
        const data = []; for (let z = 0; z < height; z++) { data[z] = []; for (let x = 0; x < width; x++) { data[z][x] = getInitialHeight(x, z, width, height); } } return data;
    }
    function getInitialColorData(hData) {
        const data = []; const height = hData.length; if (height === 0) return []; const width = hData[0].length;
        for (let z = 0; z < height; z++) { data[z] = []; for (let x = 0; x < width; x++) { const h = hData[z][x]; const hr = h / INITIAL_MAX_HEIGHT; const ci = Math.min(COLORS.length - 1, Math.max(0, Math.floor(hr * (COLORS.length - 2)) + 1)); data[z][x] = h < 0.05 ? COLORS[0] : COLORS[ci]; } } return data;
    }

    // --- Terrain Brush Logic ---
    const applyTerrainBrush = useCallback((centerX, centerZ, deltaHeight) => {
        setHeightData(prevData => {
            const newData = prevData.map(row => [...row]); // Deep copy
            const radius = brushSize -1; // Brush size 1 affects 1 cell, 2 affects 3x3, etc.
            const radiusSq = radius * radius;

            const startX = Math.max(0, Math.floor(centerX - radius));
            const endX = Math.min(gridWidth - 1, Math.floor(centerX + radius));
            const startZ = Math.max(0, Math.floor(centerZ - radius));
            const endZ = Math.min(gridHeight - 1, Math.floor(centerZ + radius));

            for (let z = startZ; z <= endZ; z++) {
                for (let x = startX; x <= endX; x++) {
                    const distX = x - centerX;
                    const distZ = z - centerZ;
                    const distSq = distX * distX + distZ * distZ;

                    if (distSq <= radiusSq) {
                         // Cosine falloff: intensity = (cos(dist/radius * PI/2) + 1) / 2
                         // Simpler linear falloff for now: intensity = 1 - sqrt(distSq) / radius
                         // Using cosine:
                         let intensity = 0;
                         if (radius > 0.1) { // Avoid division by zero for size 1
                             const dist = Math.sqrt(distSq);
                             intensity = (Math.cos((dist / radius) * Math.PI * 0.5) + 1) / 2.0;
                         } else {
                             intensity = (distSq < 0.1) ? 1.0 : 0.0; // Affect only center cell if radius is small
                         }

                         const currentHeight = newData[z][x];
                         const modifiedHeight = currentHeight + deltaHeight * intensity;
                         newData[z][x] = Math.max(0, modifiedHeight); // Clamp height >= 0
                    }
                }
            }
            return newData;
        });
        // Note: Applying color brush would be similar, modifying colorData
    }, [brushSize, gridWidth, gridHeight]); // Dependencies

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
        },
    
        // NEW Methods for external control
        applyTerrainBrush: applyTerrainBrush, // Expose brush function
        updateObjectPosition: (id, newGridX, newGridZ) => { // Update during drag
             setObjects(prev => prev.map(obj =>
                obj.id === id ? { ...obj, gridX: newGridX, gridZ: newGridZ } : obj
            ));
        },
        getObjectById: (id) => objects.find(obj => obj.id === id),
        getGroundHeight: (gridX, gridZ) => {
            const x = Math.floor(gridX);
            const z = Math.floor(gridZ);
            if(x >= 0 && x < gridWidth && z >= 0 && z < gridHeight) {
                return heightData[z][x];
            }
            return 0; // Default height if outside grid
        },
         // Pass back current grid dims for raycasting helpers
         getGridDimensions: () => ({ gridWidth, gridHeight }),
    }), [heightData, colorData, objects, gridWidth, gridHeight, applyTerrainBrush]); // Add dependencies


    // --- Render Logic ---
    const gridCells = useMemo(() => { /* ... Render GridCells with onPointerDown={onGridPointerDown} ... */
         if (gridWidth === 0 || gridHeight === 0) return []; const cells = [];
        for (let z = 0; z < gridHeight; z++) { for (let x = 0; x < gridWidth; x++) { cells.push(<GridCell key={`${x}-${z}`} x={x} z={z} height={heightData[z]?.[x] ?? 0} color={colorData[z]?.[x] ?? '#ffffff'} onPointerDown={onGridPointerDown} gridWidth={gridWidth} gridHeight={gridHeight} />); } } return cells;
    }, [heightData, colorData, gridWidth, gridHeight, onGridPointerDown]); // Pass callback down

    const renderedObjects = useMemo(() => { /* ... Render ObjectComponents with onPointerDown={onObjectPointerDown} ... */
         if (gridWidth === 0 || gridHeight === 0) return [];
        return objects.map(obj => {
            const ObjectComponent = ObjectComponents[obj.type]; if (!ObjectComponent) return null;
            const clampedX = Math.max(0, Math.min(obj.gridX, gridWidth - 1)); const clampedZ = Math.max(0, Math.min(obj.gridZ, gridHeight - 1));
            const groundHeight = heightData[clampedZ]?.[clampedX] ?? 0;
            const [worldX, , worldZ] = gridToWorld(clampedX, clampedZ, groundHeight, gridWidth, gridHeight); const worldY = groundHeight;
            return ( <ObjectComponent key={obj.id} objectId={obj.id} position={[worldX, worldY, worldZ]} isSelected={obj.id === selectedObjectId} onSelect={() => onObjectSelect(obj.id)} onPointerDown={onObjectPointerDown} globalAge={globalAge} {...obj} /> );
        })
    }, [objects, heightData, gridWidth, gridHeight, selectedObjectId, globalAge, onObjectSelect, onObjectPointerDown]); // Pass callbacks down

     // --- Invisible Plane for Drag Raycasting ---
     // We will create this plane in PlanEditor where pointer events are handled

     // --- Rest of Scene Rendering ---
    const controlsTarget = useMemo(() => [0, 0, 0], []);
    const groundPlaneSize = useMemo(() => [gridWidth * CELL_SIZE + 4, gridHeight * CELL_SIZE + 4], [gridWidth, gridHeight]);
    const avgHeight = useMemo(() => {
        if (gridWidth === 0 || gridHeight === 0) return 0; let totalHeight = 0;
        for (let z = 0; z < gridHeight; z++) { for (let x = 0; x < gridWidth; x++) { totalHeight += heightData[z]?.[x] ?? 0; } }
        return totalHeight / (gridWidth * gridHeight);
    }, [heightData, gridWidth, gridHeight]);
    return ( <> {/* Lights, Camera, Controls, Ground Plane */} </> ); // Render structure remains same
});


// --- App Entry Point (Manages Layout, UI, Global Events, Modes) ---
export default function PlanEditor() {
    const sceneLogicRef = useRef();
    const fileInputRef = useRef(null);
    const orbitControlsRef = useRef(); // Ref to disable/enable controls

    // --- Modes & Global State ---
    const [addModeObjectType, setAddModeObjectType] = useState(null);
    const [selectedObjectId, setSelectedObjectId] = useState(null);
    const [globalAge, setGlobalAge] = useState(1.0);
    const [brushSize, setBrushSize] = useState(3); // Default brush size (e.g., 3x3 ish)
    const [desiredWidth, setDesiredWidth] = useState(INITIAL_GRID_WIDTH);
    const [desiredHeight, setDesiredHeight] = useState(INITIAL_GRID_HEIGHT);
    const [currentGridSize, setCurrentGridSize] = useState({w: INITIAL_GRID_WIDTH, h: INITIAL_GRID_HEIGHT});
    // Interaction State
    const [draggingInfo, setDraggingInfo] = useState(null); // { id: number, initialY: number } | null
    const [isPaintingTerrain, setIsPaintingTerrain] = useState(false);
    const [paintDirection, setPaintDirection] = useState(1); // 1 for raise, -1 for lower

    const currentMode = useMemo(() => {
        if (addModeObjectType) return `add-${addModeObjectType}`; if (selectedObjectId !== null) return 'move'; return 'edit-terrain';
    }, [addModeObjectType, selectedObjectId]);

    // --- Raycasting Setup ---
    const { raycaster, pointer, camera } = useThree(); // Get these from canvas context
    const dragPlaneRef = useRef(); // Ref to the invisible plane used for dragging

    // --- Button Styles ---
    const getButtonStyle = (modeOrAction, disabled = false) => ({
        margin: '2px', padding: '4px 8px', border: currentMode === modeOrAction ? '2px solid #eee' : '2px solid transparent',
        backgroundColor: disabled ? '#666' : (currentMode === modeOrAction ? '#555' : '#333'),
        color: disabled ? '#aaa' : 'white', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
    });

     // --- Event Handlers ---
    const handleObjectPointerDown = useCallback((event, objectId, objectType) => {
        event.stopPropagation(); // Prevent grid pointer down when clicking object
        if (currentMode === 'edit-terrain' || currentMode === 'move') { // Allow selecting/starting drag
             setSelectedObjectId(objectId);
             setAddModeObjectType(null);

             // Start Dragging
             const clickedObject = sceneLogicRef.current?.getObjectById(objectId);
             if (clickedObject) {
                 const groundHeight = sceneLogicRef.current?.getGroundHeight(clickedObject.gridX, clickedObject.gridZ) ?? 0;
                 setDraggingInfo({ id: objectId, initialY: groundHeight + DRAG_PLANE_OFFSET });
                 if (orbitControlsRef.current) orbitControlsRef.current.enabled = false; // Disable camera controls
                 (event.target)?.setPointerCapture(event.pointerId); // Capture pointer
             }
        }
     }, [currentMode]); // Check mode

    const handleGridPointerDown = useCallback((event, gridX, gridZ) => {
         if (draggingInfo) return; // Don't interact with grid if dragging object

         if (addModeObjectType) {
             // Add object logic (now needs to be called from SceneWithLogic ref)
             const baseProps = { id: nextObjectId++, type: addModeObjectType, gridX, gridZ };
             const typeProps = { /* ... default props ... */ }[addModeObjectType] || {};
             // This direct state update should be replaced by calling an imperative handler
             // sceneLogicRef.current?.addObject({ ...baseProps, ...typeProps }); // Need to add this method
             // For now, keep the simpler add-on-click logic (will be refactored if needed)
              setSelectedObjectId(null); // Deselect any previous object
              handleInteractionEnd(); // Reset mode potentially
         } else if (selectedObjectId !== null && currentMode === 'move') {
             // Move selected object to clicked location (instant move, not drag start)
             sceneLogicRef.current?.updateObjectPosition(selectedObjectId, gridX, gridZ);
             handleInteractionEnd(); // Deselect after move
         } else if (currentMode === 'edit-terrain') {
             // Start Painting Terrain
             event.stopPropagation(); // Prevent OrbitControls potentially
             setIsPaintingTerrain(true);
             setPaintDirection(event.shiftKey ? -1 : 1); // Raise or lower
             // Apply initial brush stroke
             sceneLogicRef.current?.applyTerrainBrush(gridX, gridZ, HEIGHT_MODIFIER * (event.shiftKey ? -1 : 1));
             (event.target)?.setPointerCapture(event.pointerId); // Capture pointer
             if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
         } else {
             // If pointer mode and click grid, deselect object
             setSelectedObjectId(null);
         }
    }, [currentMode, addModeObjectType, selectedObjectId, draggingInfo]);

    const handlePointerMove = useCallback((event) => {
         if (draggingInfo && dragPlaneRef.current) {
            // Update pointer coordinates for raycasting
            // pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
             // Use event.point which might be available if the event is intercepted correctly, otherwise raycast
             raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObject(dragPlaneRef.current);

            if (intersects.length > 0) {
                const point = intersects[0].point;
                // Convert world point back to grid coordinates
                const { gridWidth, gridHeight } = sceneLogicRef.current?.getGridDimensions() ?? { gridWidth: 0, gridHeight: 0 };
                const gridX = Math.floor(point.x / CELL_SIZE + gridWidth / 2);
                const gridZ = Math.floor(point.z / CELL_SIZE + gridHeight / 2);

                // Clamp coordinates within grid bounds
                 const clampedX = Math.max(0, Math.min(gridX, gridWidth - 1));
                 const clampedZ = Math.max(0, Math.min(gridZ, gridHeight - 1));

                // Update object position via ref
                sceneLogicRef.current?.updateObjectPosition(draggingInfo.id, clampedX, clampedZ);
             }
         } else if (isPaintingTerrain) {
            // Update pointer coords...
            raycaster.setFromCamera(pointer, camera);
             // Raycast against grid cells (or terrain mesh if optimized later)
             // For now, let's assume raycasting against potentially many grid cells might be slow.
             // Alternative: raycast against the ground plane used for visuals.
             // Simplification: For now, let's just get the grid cell under mouse using a similar plane intersection as drag
             const { gridWidth, gridHeight } = sceneLogicRef.current?.getGridDimensions() ?? { gridWidth: 0, gridHeight: 0 };
             const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Assume ground near Y=0 for intersection
             const intersectionPoint = new THREE.Vector3();
             raycaster.ray.intersectPlane(groundPlane, intersectionPoint);

             if (intersectionPoint) {
                 const gridX = Math.floor(intersectionPoint.x / CELL_SIZE + gridWidth / 2);
                 const gridZ = Math.floor(intersectionPoint.z / CELL_SIZE + gridHeight / 2);
                 // Check if pointer is within grid bounds before applying brush
                 if (gridX >= 0 && gridX < gridWidth && gridZ >= 0 && gridZ < gridHeight) {
                     sceneLogicRef.current?.applyTerrainBrush(gridX, gridZ, HEIGHT_MODIFIER * paintDirection);
                 }
             }
         }
    }, [draggingInfo, isPaintingTerrain, paintDirection, raycaster, pointer, camera]); // Add raycaster deps

    const handlePointerUp = useCallback((event) => {
         if (draggingInfo) {
            (event.target)?.releasePointerCapture?.(event.pointerId);
            setDraggingInfo(null);
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
             // Final position is already set by last pointerMove
            handleInteractionEnd(); // Deselect object after drag
         }
        if (isPaintingTerrain) {
             (event.target)?.releasePointerCapture?.(event.pointerId);
            setIsPaintingTerrain(false);
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
        }
    }, [draggingInfo, isPaintingTerrain]); // Add dependencies

    const handlePointerMissed = useCallback(() => {
        // Clicked background - deselect object if not adding/dragging/painting
        if (!addModeObjectType && !draggingInfo && !isPaintingTerrain) {
             setSelectedObjectId(null);
        }
    }, [addModeObjectType, draggingInfo, isPaintingTerrain]);


    // Other handlers (Save, Load, Resize, SetMode, Remove, etc.) - need minor adjustments if any
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
     const handleSetMode = (type) => { setAddModeObjectType(type); setSelectedObjectId(null); setDraggingInfo(null); setIsPaintingTerrain(false); }; // Ensure interactions stop on mode change
     const handleSelectObject = (id) => { setSelectedObjectId(id); setAddModeObjectType(null); };
     const handleRemoveSelected = () => { if (selectedObjectId !== null) { sceneLogicRef.current?.removeObject(selectedObjectId); setSelectedObjectId(null); } };
     const handleInteractionEnd = () => { setSelectedObjectId(null); setAddModeObjectType(null); /* Don't reset dragging/painting here */ };
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
            {/* UI Overlay - Add Brush Size Slider */}
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
                {/* Brush Size Slider */}
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}>
                    <strong>Brush Size:</strong> {brushSize}<br/>
                    <input type="range" min="1" max="10" step="1" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} style={{ width: '100%' }}/>
                 </div>
                {/* ... Aging Slider, Instructions ... */}
            </div>

            {/* Hidden File Input */}
            <input type="file" ref={fileInputRef} onChange={onFileSelected} accept=".json,application/json" style={{ display: 'none' }} />

            {/* Canvas Container - Add global pointer handlers */}
            <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                <Canvas
                    shadows
                    camera={{ position: [15, 20, 25], fov: 60 }}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerMissed={handlePointerMissed} // Handle clicks on background
                    // Raycaster needs to be managed correctly, useThree provides one bound to canvas events
                >
                    {/* Scene Content */}
                    <SceneWithLogic
                        ref={sceneLogicRef}
                        addModeObjectType={addModeObjectType}
                        selectedObjectId={selectedObjectId}
                        globalAge={globalAge}
                        brushSize={brushSize} // Pass brush size down
                        onObjectSelect={handleSelectObject}
                        onInteractionEnd={handleInteractionEnd}
                        onObjectPointerDown={handleObjectPointerDown} // Pass down handlers
                        onGridPointerDown={handleGridPointerDown}    // Pass down handlers
                     />

                     {/* Invisible plane for drag raycasting */}
                     {draggingInfo && (
                         <Plane
                             ref={dragPlaneRef}
                             args={[1000, 1000]} // Make it large
                             rotation={[-Math.PI / 2, 0, 0]}
                             position={[0, draggingInfo.initialY, 0]} // Position at object's starting height
                             visible={false} // Keep it invisible
                         />
                     )}

                     {/* OrbitControls managed via ref */}
                    <OrbitControls ref={orbitControlsRef} enabled={!draggingInfo && !isPaintingTerrain} /> {/* Conditionally enable */}

                </Canvas>
            </div>
        </div>
    );
}
