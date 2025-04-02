import React, { useState, useMemo, useCallback, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Box, Plane } from '@react-three/drei';
import * as THREE from 'three';

// --- Configuration ---
const CELL_SIZE = 1;
const HEIGHT_MODIFIER = 0.1; // Base height change per brush application
const INITIAL_MAX_HEIGHT = 1.5; // For terrain generation
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
    // Calculate Y position for the *center* of the box geometry used in GridCell
    const worldY = currentHeight / 2;
    return [worldX, worldY, worldZ];
};
// Helper to calculate world Y for placing object *base* on terrain
const getWorldYBase = (groundHeight) => groundHeight;

const lerp = THREE.MathUtils.lerp; // Shortcut

// --- Object ID Counter ---
let nextObjectId = 1; // Simple counter for unique IDs

// --- Components ---

// GridCell: Uses onPointerDown
const GridCell = React.memo(({ x, z, height, color, onPointerDown, gridWidth, gridHeight }) => {
    const position = useMemo(() => gridToWorld(x, z, height, gridWidth, gridHeight), [x, z, height, gridWidth, gridHeight]);
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

// Base wrapper for objects to handle common interactions
const ObjectBase = ({ children, position, onSelect, onPointerDown, objectId, type }) => {
    const handlePointerDown = useCallback((e) => {
        // Allow event to bubble up
        onPointerDown(e, objectId, type); // Pass ID and type up
        onSelect(); // Select on pointer down
    }, [onPointerDown, objectId, type, onSelect]);

    return (
        <group position={position} onPointerDown={handlePointerDown}>
            {children}
        </group>
    );
};

// Specific Object Components
const Tree = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1, maxTrunkHeight = 0.8, maxFoliageHeight = 1.2, maxFoliageRadius = 0.5 }) => {
    const currentTrunkHeight = lerp(0.1, maxTrunkHeight, globalAge);
    const currentFoliageHeight = lerp(0.1, maxFoliageHeight, globalAge);
    const currentFoliageRadius = lerp(0.05, maxFoliageRadius, globalAge);
    const totalCurrentHeight = currentTrunkHeight + currentFoliageHeight;
    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="tree">
            {/* Selection Highlight */}
            {isSelected && <Box args={[currentFoliageRadius * 2.2, totalCurrentHeight + 0.2, currentFoliageRadius * 2.2]} position={[0, totalCurrentHeight / 2, 0]}><meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false} /></Box>}
            {/* Trunk */}
            <mesh position={[0, currentTrunkHeight / 2, 0]} scale={[1, currentTrunkHeight / maxTrunkHeight || 0.01, 1]} castShadow> {/* Prevent zero scale */}
                <cylinderGeometry args={[0.15, 0.2, maxTrunkHeight, 8]} />
                <meshStandardMaterial color="#8B4513" />
            </mesh>
            {/* Foliage */}
            <mesh position={[0, currentTrunkHeight + currentFoliageHeight / 2 - 0.05, 0]} scale={[currentFoliageRadius / maxFoliageRadius || 0.01, currentFoliageHeight / maxFoliageHeight || 0.01, currentFoliageRadius / maxFoliageRadius || 0.01]} castShadow>
                <coneGeometry args={[maxFoliageRadius, maxFoliageHeight, 16]} />
                <meshStandardMaterial color="#2E7D32" />
            </mesh>
        </ObjectBase>
    );
});

const Shrub = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1, maxRadius = 0.4 }) => {
    const currentRadius = lerp(0.1, maxRadius, globalAge);
    return (
        <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="shrub">
            {isSelected && <Box args={[currentRadius * 2.2, currentRadius * 2.2, currentRadius * 2.2]} position={[0, currentRadius, 0]}><meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false} /></Box>}
            <mesh position={[0, currentRadius, 0]} scale={[currentRadius / maxRadius || 0.01, currentRadius / maxRadius || 0.01, currentRadius / maxRadius || 0.01]} castShadow>
                <sphereGeometry args={[maxRadius, 16, 12]} />
                <meshStandardMaterial color="#556B2F" roughness={0.9} />
            </mesh>
        </ObjectBase>
    );
});

const Grass = React.memo(({ position, isSelected, onSelect, onPointerDown, objectId, globalAge = 1, maxHeight = 0.3, maxWidth = 0.4 }) => {
    const currentHeight = lerp(0.05, maxHeight, globalAge);
    const scaleY = currentHeight / maxHeight || 0.01; // Prevent zero scale
    const scaleY8 = currentHeight * 0.8 / (maxHeight * 0.8) || 0.01;
    const scaleY9 = currentHeight * 0.9 / (maxHeight * 0.9) || 0.01;

    return (
         <ObjectBase position={position} isSelected={isSelected} onSelect={onSelect} onPointerDown={onPointerDown} objectId={objectId} type="grass">
             {isSelected && <Box args={[maxWidth * 1.2, currentHeight * 1.2, maxWidth * 1.2]} position={[0, currentHeight / 2, 0]}><meshStandardMaterial color={SELECTION_COLOR} transparent opacity={0.3} depthWrite={false} /></Box>}
             <mesh position={[0, currentHeight / 2, 0]} scale={[1, scaleY, 1]}><boxGeometry args={[maxWidth * 0.1, maxHeight, maxWidth * 0.1]} /><meshStandardMaterial color="#7CFC00" side={THREE.DoubleSide} /></mesh>
             <mesh position={[0.05, (currentHeight * 0.8) / 2, 0.05]} rotation={[0, Math.PI / 4, 0]} scale={[1, scaleY8, 1]}><boxGeometry args={[maxWidth * 0.1, maxHeight * 0.8, maxWidth * 0.1]}/><meshStandardMaterial color="#90EE90" side={THREE.DoubleSide}/></mesh>
             <mesh position={[-0.05, (currentHeight*0.9) / 2, -0.05]} rotation={[0, -Math.PI / 3, 0]} scale={[1, scaleY9, 1]}><boxGeometry args={[maxWidth * 0.1, maxHeight * 0.9, maxWidth * 0.1]}/><meshStandardMaterial color="#9ACD32" side={THREE.DoubleSide}/></mesh>
        </ObjectBase>
    );
});

const ObjectComponents = { tree: Tree, shrub: Shrub, grass: Grass };

// --- Scene Component (Manages Data State and 3D Primitives) ---
const SceneWithLogic = forwardRef(({
    // Props for rendering
    selectedObjectId,
    globalAge,
    // Callbacks for components
    onObjectSelect,
    onObjectPointerDown,
    onGridPointerDown,
    // Props needed for imperative API
    brushSize
}, ref) => {
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

    // --- Terrain Brush Logic ---
    const applyTerrainBrush = useCallback((centerX, centerZ, deltaHeight) => {
        setHeightData(prevData => {
            const newData = prevData.map(row => [...row]);
            const radius = brushSize - 1; // Correct radius calculation for size N affecting N*N cells roughly centered
            const radiusSq = radius * radius;

            // Calculate bounds carefully based on brush center and radius
             const startX = Math.max(0, Math.floor(centerX - radius));
             const endX = Math.min(gridWidth - 1, Math.ceil(centerX + radius)); // Use ceil for end
             const startZ = Math.max(0, Math.floor(centerZ - radius));
             const endZ = Math.min(gridHeight - 1, Math.ceil(centerZ + radius));

            for (let z = startZ; z <= endZ; z++) {
                for (let x = startX; x <= endX; x++) {
                    const distX = x - centerX;
                    const distZ = z - centerZ;
                    const distSq = distX * distX + distZ * distZ;

                     // Use slightly larger radius for falloff check to ensure edges are included
                    if (distSq <= (radius + 0.5) * (radius + 0.5)) {
                         let intensity = 0;
                         if (radius > 0.1) {
                             const dist = Math.sqrt(distSq);
                              // Clamp dist/radius to max 1 for cosine calculation
                             const ratio = Math.min(1.0, dist / radius);
                             intensity = (Math.cos(ratio * Math.PI * 0.5)); // Cosine falloff (0 at radius, 1 at center)
                             intensity = intensity * intensity; // Optional: Make falloff steeper (square of cosine)
                         } else {
                             intensity = (distSq < 0.1) ? 1.0 : 0.0;
                         }

                         const currentHeight = newData[z][x];
                         const modifiedHeight = currentHeight + deltaHeight * intensity;
                         newData[z][x] = Math.max(0, modifiedHeight);
                    }
                }
            }
            return newData;
        });
    }, [brushSize, gridWidth, gridHeight]); // Dependencies

     // --- Imperative API ---
    useImperativeHandle(ref, () => ({
        // Data Management
        save: () => ({ version: 3, heightData, colorData, objects }),
        load: (loadedData) => {
            if (!loadedData || typeof loadedData !== 'object') throw new Error("Invalid data: not an object");
            const version = loadedData.version ?? 1;
            if (!Array.isArray(loadedData.heightData)) throw new Error("Invalid data: heightData");
            if (!Array.isArray(loadedData.colorData)) throw new Error("Invalid data: colorData");
            if (!Array.isArray(loadedData.objects)) throw new Error("Invalid data: objects");

            setHeightData(loadedData.heightData);
            setColorData(loadedData.colorData);
            const processedObjects = loadedData.objects.map(obj => {
                if (version < 3) { /* ... add default max size props ... */ }
                return obj;
             });
            setObjects(processedObjects);
            const maxId = processedObjects.reduce((max, obj) => Math.max(max, obj.id || 0), 0); // Ensure obj.id exists
            nextObjectId = maxId + 1;
            // Return new size for parent UI update
             return { newWidth: loadedData.heightData[0]?.length ?? 0, newHeight: loadedData.heightData.length ?? 0 };
        },
        resizeGrid: (newWidth, newHeight) => {
             const oldWidth = gridWidth; const oldHeight = gridHeight; const oldH = heightData; const oldC = colorData;
             const newHData = []; const newCData = [];
             for (let z = 0; z < newHeight; z++) {
                newHData[z] = []; newCData[z] = [];
                for (let x = 0; x < newWidth; x++) {
                    if (x < oldWidth && z < oldHeight) { newHData[z][x] = oldH[z][x]; newCData[z][x] = oldC[z][x]; }
                    else { const h = getInitialHeight(x, z, newWidth, newHeight); newHData[z][x] = h; /* ... set color ... */ }
                }
             }
             setHeightData(newHData); setColorData(newCData);
             setObjects(prev => prev.filter(obj => obj.gridX < newWidth && obj.gridZ < newHeight));
        },
        // Object Manipulation
        addObject: (newObjectData) => {
            setObjects(prev => [...prev, newObjectData]);
        },
        removeObject: (id) => { setObjects(prev => prev.filter(obj => obj.id !== id)); },
        updateObjectPosition: (id, newGridX, newGridZ) => {
             setObjects(prev => prev.map(obj =>
                obj.id === id ? { ...obj, gridX: newGridX, gridZ: newGridZ } : obj
            ));
        },
        // Data Accessors
        getObjectById: (id) => objects.find(obj => obj.id === id),
        getGroundHeight: (gridX, gridZ) => {
            const x = Math.floor(gridX); const z = Math.floor(gridZ);
            if(x >= 0 && x < gridWidth && z >= 0 && z < gridHeight) { return heightData[z][x]; }
            return 0;
        },
        getGridDimensions: () => ({ gridWidth, gridHeight }),
        // Terrain Modification
        applyTerrainBrush: applyTerrainBrush,

    }), [heightData, colorData, objects, gridWidth, gridHeight, brushSize, applyTerrainBrush]); // Include brushSize and applyTerrainBrush


    // --- Render Logic ---
    const gridCells = useMemo(() => {
        if (gridWidth === 0 || gridHeight === 0) return []; const cells = [];
        for (let z = 0; z < gridHeight; z++) { for (let x = 0; x < gridWidth; x++) { cells.push(<GridCell key={`${x}-${z}`} x={x} z={z} height={heightData[z]?.[x] ?? 0} color={colorData[z]?.[x] ?? '#ffffff'} onPointerDown={onGridPointerDown} gridWidth={gridWidth} gridHeight={gridHeight} />); } } return cells;
    }, [heightData, colorData, gridWidth, gridHeight, onGridPointerDown]); // Pass callback down

    const renderedObjects = useMemo(() => {
         if (gridWidth === 0 || gridHeight === 0) return [];
        return objects.map(obj => {
            const ObjectComponent = ObjectComponents[obj.type]; if (!ObjectComponent) return null;
            const clampedX = Math.max(0, Math.min(obj.gridX, gridWidth - 1));
            const clampedZ = Math.max(0, Math.min(obj.gridZ, gridHeight - 1));
            const groundHeight = heightData[clampedZ]?.[clampedX] ?? 0;
             // Use helper for base Y position
             const worldYBase = getWorldYBase(groundHeight);
             // Calculate world X/Z based on *center* of the cell
             const worldX = (clampedX - gridWidth / 2 + 0.5) * CELL_SIZE;
             const worldZ = (clampedZ - gridHeight / 2 + 0.5) * CELL_SIZE;

            return ( <ObjectComponent key={obj.id} objectId={obj.id} position={[worldX, worldYBase, worldZ]} isSelected={obj.id === selectedObjectId} onSelect={() => onObjectSelect(obj.id)} onPointerDown={onObjectPointerDown} globalAge={globalAge} {...obj} /> );
        })
    }, [objects, heightData, gridWidth, gridHeight, selectedObjectId, globalAge, onObjectSelect, onObjectPointerDown]); // Pass callbacks down


     // --- Base Scene Elements ---
    const controlsTarget = useMemo(() => [0, 0, 0], []);
    const groundPlaneSize = useMemo(() => [gridWidth * CELL_SIZE + 4, gridHeight * CELL_SIZE + 4], [gridWidth, gridHeight]);
    const avgHeight = useMemo(() => {
        if (gridWidth === 0 || gridHeight === 0) return 0; let t = 0; let c = 0;
        for (let z = 0; z < gridHeight; z++) { for (let x = 0; x < gridWidth; x++) { t += heightData[z]?.[x] ?? 0; c++; } }
        return c > 0 ? t / c : 0;
    }, [heightData, gridWidth, gridHeight]);

    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.6} />
            <directionalLight position={[gridWidth * 0.5, 15 + avgHeight, gridHeight * 0.5]} intensity={1.0} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
             {/* No Camera or OrbitControls here - managed by Experience */}
            {/* Render Content */}
            <group>{gridCells}</group>
            <group>{renderedObjects}</group>
            {/* Base Ground Plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                <planeGeometry args={groundPlaneSize} />
                <meshStandardMaterial color="#444" side={THREE.DoubleSide} />
            </mesh>
        </>
    );
});


// --- Component inside Canvas to handle R3F context and interactions ---
function Experience({
    // Props from PlanEditor
    currentMode,
    addModeObjectType,
    selectedObjectId,
    globalAge,
    brushSize,
    sceneLogicRef, // Ref to SceneWithLogic's imperative API
    onSelectObject, // Callback to PlanEditor
    onInteractionEnd, // Callback to PlanEditor
    getInitialObjectId // Function to get next ID
}) {
    // --- R3F Hooks & Refs ---
    const { raycaster, pointer, camera, gl } = useThree(); // Get gl.domElement for listeners
    const orbitControlsRef = useRef();
    const dragPlaneRef = useRef();

    // Refs to store latest pointer position for handlers outside react flow
    const pointerRef = useRef({ x: 0, y: 0 });

    // --- Interaction State ---
    const [draggingInfo, setDraggingInfo] = useState(null);
    const [isPaintingTerrain, setIsPaintingTerrain] = useState(false);
    const [paintDirection, setPaintDirection] = useState(1);

    // --- Event Handlers ---
    // --- Pointer Down Handlers (Initiate Interaction) ---
    const handleObjectPointerDown = useCallback((event, objectId, objectType) => {
        event.stopPropagation();
        if (currentMode === 'edit-terrain' || currentMode === 'move') {
            onSelectObject(objectId);
            const clickedObject = sceneLogicRef.current?.getObjectById(objectId);
            if (clickedObject) {
                const groundHeight = sceneLogicRef.current?.getGroundHeight(clickedObject.gridX, clickedObject.gridZ) ?? 0;
                setDraggingInfo({ id: objectId, initialY: getWorldYBase(groundHeight) + DRAG_PLANE_OFFSET });
                if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
                event.target?.setPointerCapture(event.pointerId); // Capture pointer
                console.log("Drag Start:", objectId, "at Y:", getWorldYBase(groundHeight) + DRAG_PLANE_OFFSET);
            }
        }
    }, [currentMode, onSelectObject, sceneLogicRef]);

    const handleGridPointerDown = useCallback((event, gridX, gridZ) => {
        if (draggingInfo) return;

        if (addModeObjectType) {
             const baseProps = { id: getInitialObjectId(), type: addModeObjectType, gridX, gridZ };
             const typeProps = { /* default type props */ }[addModeObjectType] || {};
             sceneLogicRef.current?.addObject({ ...baseProps, ...typeProps });
             onSelectObject(null);
             onInteractionEnd();
        } else if (selectedObjectId !== null && currentMode === 'move') {
            sceneLogicRef.current?.updateObjectPosition(selectedObjectId, gridX, gridZ);
            onInteractionEnd();
        } else if (currentMode === 'edit-terrain') {
            event.stopPropagation();
            setIsPaintingTerrain(true);
            const dir = event.shiftKey ? -1 : 1;
            setPaintDirection(dir);
            sceneLogicRef.current?.applyTerrainBrush(gridX, gridZ, HEIGHT_MODIFIER * dir);
            event.target?.setPointerCapture(event.pointerId);
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
            console.log("Paint Start");
        } else {
            onSelectObject(null);
        }
    }, [currentMode, addModeObjectType, selectedObjectId, draggingInfo, brushSize, sceneLogicRef, onInteractionEnd, onSelectObject, getInitialObjectId]);

    const handlePointerMove = useCallback((event) => {
        // Update pointerRef immediately for use in raycasting logic
        // The pointer object from useThree() might update slightly delayed in React state batches
        pointerRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointerRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;

        if (!sceneLogicRef.current) return;

        // Use the updated pointerRef for raycasting
        raycaster.setFromCamera(pointerRef.current, camera);

        if (draggingInfo && dragPlaneRef.current) {
            const intersects = raycaster.intersectObject(dragPlaneRef.current);
            if (intersects.length > 0) {
                const point = intersects[0].point;
                const { gridWidth, gridHeight } = sceneLogicRef.current.getGridDimensions();
                // Ensure CELL_SIZE is correctly applied
                const gridX = Math.floor(point.x / CELL_SIZE + gridWidth / 2);
                const gridZ = Math.floor(point.z / CELL_SIZE + gridHeight / 2);
                const clampedX = Math.max(0, Math.min(gridX, gridWidth - 1));
                const clampedZ = Math.max(0, Math.min(gridZ, gridHeight - 1));
                // console.log(`Dragging to grid: ${clampedX}, ${clampedZ}`); // Debug log
                sceneLogicRef.current.updateObjectPosition(draggingInfo.id, clampedX, clampedZ);
            } else {
                 // console.log("Drag Raycast Missed Plane"); // Debug log
            }
        } else if (isPaintingTerrain) {
            const { gridWidth, gridHeight } = sceneLogicRef.current.getGridDimensions();
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersectionPoint = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
                const gridX = Math.floor(intersectionPoint.x / CELL_SIZE + gridWidth / 2);
                const gridZ = Math.floor(intersectionPoint.z / CELL_SIZE + gridHeight / 2);
                if (gridX >= 0 && gridX < gridWidth && gridZ >= 0 && gridZ < gridHeight) {
                    sceneLogicRef.current.applyTerrainBrush(gridX, gridZ, HEIGHT_MODIFIER * paintDirection);
                }
            }
        }
    }, [draggingInfo, isPaintingTerrain, paintDirection, raycaster, camera, sceneLogicRef]); // Removed pointer dependency

     const handlePointerUp = useCallback((event) => {
        console.log("Pointer Up Fired"); // Debug log
        // No need to check event target for release capture when using window listeners
        if (draggingInfo) {
            // gl.domElement.releasePointerCapture?.(event.pointerId); // Release might need event if not window listener
            setDraggingInfo(null);
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
            console.log("Drag End");
        }
        if (isPaintingTerrain) {
            // gl.domElement.releasePointerCapture?.(event.pointerId);
            setIsPaintingTerrain(false);
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
             console.log("Paint End");
        }
    }, [draggingInfo, isPaintingTerrain /*, gl*/]); // Removed event dependency

    useEffect(() => {
        const domElement = gl.domElement; // Use the canvas element for listeners

        // Wrapper functions to ensure correct event handling context if needed
        const moveHandler = (event) => handlePointerMove(event);
        const upHandler = (event) => handlePointerUp(event);

        if (draggingInfo || isPaintingTerrain) {
            console.log("Attaching global listeners");
            domElement.addEventListener('pointermove', moveHandler);
            domElement.addEventListener('pointerup', upHandler);
            // Optional: Add pointerleave listener if needed
            // domElement.addEventListener('pointerleave', upHandler);
        }

        // Cleanup function
        return () => {
             console.log("Removing global listeners");
            domElement.removeEventListener('pointermove', moveHandler);
            domElement.removeEventListener('pointerup', upHandler);
            // domElement.removeEventListener('pointerleave', upHandler);

             // Ensure controls are re-enabled if component unmounts during drag/paint
             if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
        };
    }, [draggingInfo, isPaintingTerrain, handlePointerMove, handlePointerUp, gl]); // Add gl dependency

     const handlePointerMissed = useCallback(() => {
        if (!addModeObjectType && !draggingInfo && !isPaintingTerrain) {
            onSelectObject(null);
        }
    }, [addModeObjectType, draggingInfo, isPaintingTerrain, onSelectObject]);

    return (
        <>
            {/* Camera needs to be defined within Canvas context */}
            <PerspectiveCamera makeDefault position={[15, 20, 25]} fov={60} />

            {/* Pass handlers down to scene components */}
            <SceneWithLogic
                ref={sceneLogicRef}
                selectedObjectId={selectedObjectId}
                globalAge={globalAge}
                brushSize={brushSize}
                onObjectSelect={onSelectObject} // Pass parent's selector
                onObjectPointerDown={handleObjectPointerDown} // Pass interaction starter
                onGridPointerDown={handleGridPointerDown}      // Pass interaction starter
                // onInteractionEnd={onInteractionEnd} // SceneLogic doesn't need this directly
            />

            {/* Invisible plane for drag raycasting */}
            {draggingInfo && (
                <Plane ref={dragPlaneRef} args={[1000, 1000]} rotation={[-Math.PI / 2, 0, 0]} position={[0, draggingInfo.initialY, 0]}
                    // visible={true} // DEBUG: Make plane visible
                    // material-color="red" // DEBUG: Make plane visible
                     visible={false}
                 />
            )}
            {/* Conditionally enable/disable controls here based on state */}
            <OrbitControls ref={orbitControlsRef} enabled={!draggingInfo && !isPaintingTerrain} makeDefault/>

            {/* Global listeners if needed, placed on a mesh covering the screen or use useEffect above */}
             {/* Listeners attached to Canvas should work via event system */}
        </>
    );
}


// --- App Entry Point (Manages Layout, UI, Modes, File IO) ---
export default function PlanEditor() {
    const sceneLogicRef = useRef(); // Ref to SceneWithLogic's imperative API
    const fileInputRef = useRef(null);

    // --- UI State and App Modes ---
    const [addModeObjectType, setAddModeObjectType] = useState(null);
    const [selectedObjectId, setSelectedObjectId] = useState(null);
    const [globalAge, setGlobalAge] = useState(1.0);
    const [brushSize, setBrushSize] = useState(3);
    const [desiredWidth, setDesiredWidth] = useState(INITIAL_GRID_WIDTH);
    const [desiredHeight, setDesiredHeight] = useState(INITIAL_GRID_HEIGHT);
    const [currentGridSize, setCurrentGridSize] = useState({w: INITIAL_GRID_WIDTH, h: INITIAL_GRID_HEIGHT});

    const currentMode = useMemo(() => {
        if (addModeObjectType) return `add-${addModeObjectType}`;
        if (selectedObjectId !== null) return 'move'; // 'move' mode implies an object is selected
        return 'edit-terrain';
    }, [addModeObjectType, selectedObjectId]);

    const getNextObjectId = useCallback(() => nextObjectId++, []); // Provide ID incrementor

    // --- Button Styles ---
    const getButtonStyle = (modeOrAction, disabled = false) => ({
        margin: '2px', padding: '4px 8px', border: currentMode === modeOrAction ? '2px solid #eee' : '2px solid transparent',
        backgroundColor: disabled ? '#666' : (currentMode === modeOrAction ? '#555' : '#333'),
        color: disabled ? '#aaa' : 'white', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
    });

     // --- Handlers for UI actions ---
    const onSaveClick = useCallback(() => {
        const saveData = sceneLogicRef.current?.save(); if (!saveData) return;
        const jsonString = JSON.stringify(saveData, null, 2); const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = 'plan_data_v3.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }, []);

    const onLoadClick = useCallback(() => { fileInputRef.current?.click(); }, []);

    const onFileSelected = useCallback((event) => {
        const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonString = e.target.result; const loadedData = JSON.parse(jsonString);
                const newSize = sceneLogicRef.current?.load(loadedData); // Load returns new grid size
                if (newSize) {
                    setDesiredWidth(newSize.newWidth); setDesiredHeight(newSize.newHeight); setCurrentGridSize({w: newSize.newWidth, h: newSize.newHeight});
                }
                setSelectedObjectId(null); // Deselect after load
                setAddModeObjectType(null); // Reset mode after load
            } catch (error) { console.error("Load Error:", error); alert(`Failed to load: ${error.message}`); }
            finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
        }; reader.onerror = (e) => { console.error("Read Error:", e); alert("Error reading file."); if (fileInputRef.current) fileInputRef.current.value = ""; }; reader.readAsText(file);
    }, []); // Dependency array okay, uses refs and setters

    const handleSetMode = (type) => { setAddModeObjectType(type); setSelectedObjectId(null); };
    const handleSelectObject = useCallback((id) => { setSelectedObjectId(id); setAddModeObjectType(null); }, []); // Callback *from* Experience
    const handleRemoveSelected = () => { if (selectedObjectId !== null) { sceneLogicRef.current?.removeObject(selectedObjectId); setSelectedObjectId(null); } };
    const handleInteractionEnd = useCallback(() => {
        // Reset add mode after placing an object
        setAddModeObjectType(null);
        // Keep selection after move/drag? Current logic deselects after instant move, keeps after drag.
    }, []); // Callback *from* Experience

    const handleResize = () => {
        const w = parseInt(desiredWidth, 10); const h = parseInt(desiredHeight, 10);
        if (isNaN(w) || isNaN(h) || w < MIN_GRID_DIM || h < MIN_GRID_DIM || w > MAX_GRID_DIM || h > MAX_GRID_DIM) {
            alert(`Invalid size. Dimensions: ${MIN_GRID_DIM}-${MAX_GRID_DIM}.`); setDesiredWidth(currentGridSize.w); setDesiredHeight(currentGridSize.h); return;
        }
        sceneLogicRef.current?.resizeGrid(w, h);
        setCurrentGridSize({ w: w, h: h });
        setSelectedObjectId(null); // Deselect after resize
    };

    const instructions = useMemo(() => {
         switch(currentMode) {
            case 'add-tree': case 'add-shrub': case 'add-grass': return `Click grid to add ${addModeObjectType}.`;
            case 'move': return "Drag object to move. Click grid for instant move. Click bg/object to change selection.";
            default: return "Brush: Click/Drag grid (Shift=Lower). Drag object to move. Click object/bg to select/deselect.";
        }
    }, [currentMode, addModeObjectType]);

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#282c34' }}>
            {/* UI Overlay */}
             <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1, color: 'white', background: 'rgba(0,0,0,0.75)', padding: '10px', borderRadius: '5px', fontSize: '12px', maxWidth: '220px', maxHeight: 'calc(100vh - 20px)', overflowY: 'auto' }}>
                 {/* Mode Selection */}
                <div style={{ marginBottom: '8px' }}>
                     <strong>Mode:</strong><br/>
                     <button style={getButtonStyle('edit-terrain')} onClick={() => handleSetMode(null)}>Pointer/Brush</button>
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
                  {/* Brush Size Slider */}
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}>
                    <strong>Brush Size:</strong> {brushSize}<br/>
                    <input type="range" min="1" max="10" step="1" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} style={{ width: '100%' }}/>
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
                {/* Pointer handlers are now managed within Experience */}
                <Canvas shadows>
                    <Experience
                        // Pass state down
                        currentMode={currentMode}
                        addModeObjectType={addModeObjectType}
                        selectedObjectId={selectedObjectId}
                        globalAge={globalAge}
                        brushSize={brushSize}
                        sceneLogicRef={sceneLogicRef} // Give Experience access to SceneLogic's API
                        // Pass callbacks up
                        onSelectObject={handleSelectObject}
                        onInteractionEnd={handleInteractionEnd}
                        // Pass ID generator
                        getInitialObjectId={getNextObjectId}
                    />
                </Canvas>
            </div>
        </div>
    );
}
