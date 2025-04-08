// src/PlanEditor.jsx
import React, { useState, useMemo, useCallback, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera, Box, Plane, Text } from '@react-three/drei';
import * as THREE from 'three';

// Import object components AND their editor schemas
import { ObjectComponents, ObjectEditorSchemas, objectConfigurations } from './Objects.jsx';

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// --- Configuration ---
const CELL_SIZE = 1;
const HEIGHT_MODIFIER = 0.1; // Base height change per brush application
const INITIAL_MAX_HEIGHT = 1.5; // For terrain generation
const INITIAL_GRID_WIDTH = 20;
const INITIAL_GRID_HEIGHT = 20;
const MIN_GRID_DIM = 5;
const MAX_GRID_DIM = 100;
const COLORS = ['#48b5d0', '#bbbbbb', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#795548']; // Terrain Colors
const DRAG_PLANE_OFFSET = 0.1; // Place drag plane slightly above ground
const DRAG_THRESHOLD = 5; // Minimum pixels pointer must move to initiate a drag
const LOCAL_STORAGE_KEY = 'planEditorSaveData_v5'; // Key for localStorage, update if format changes significantly

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
const lerp = THREE.MathUtils.lerp;

// --- Object ID Counter ---
let nextObjectId = 1;

// --- Components ---

// GridCell remains here
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
    onObjectSelect, onObjectPointerDown, onGridPointerDown, onInteractionEnd,
    showCoordinates, sunAzimuth, sunElevation, terrainPaintMode, absolutePaintHeight,
    currentMonth
}, ref) => {
    const sanitizeObjectsArray = (arr) => Array.isArray(arr) ? arr.filter(obj => obj && typeof obj === 'object' && obj.id != null) : [];
    const CURRENT_SAVE_VERSION = 5;

    const generateDefaultState = () => {
        console.log("Generating default scene state...");
        const defaultHeightData = getInitialHeightData(INITIAL_GRID_WIDTH, INITIAL_GRID_HEIGHT);
        const defaultColorData = getInitialColorData(defaultHeightData);
         const initialGridObjects = [
             { id: 1, type: 'tree', gridX: 5, gridZ: 5 }, // Base info
             { id: 2, type: 'tree', gridX: 15, gridZ: 8, maxFoliageHeight: 1.8, maxFoliageRadius: 0.7 }, // Override some defaults
             { id: 3, type: 'shrub', gridX: 8, gridZ: 14 },
             { id: 4, type: 'grass', gridX: 10, gridZ: 10 },
         ];
        nextObjectId = 5; // Reset counter

        const hData = defaultHeightData;
        const defaultObjects = initialGridObjects.map(obj => {
            const defaults = {}; const schema = ObjectEditorSchemas[obj.type];
            if (schema) { schema.forEach(propInfo => { defaults[propInfo.name] = propInfo.defaultValue; }); }
             const groundHeight = hData[obj.gridZ]?.[obj.gridX] ?? 0;
             const [worldX, , worldZ] = gridToWorldCenter(obj.gridX, obj.gridZ, groundHeight, INITIAL_GRID_WIDTH, INITIAL_GRID_HEIGHT);
             const { gridX, gridZ, ...rest } = obj;
             return { ...defaults, worldX, worldZ, ...rest };
        });

        return { heightData: defaultHeightData, colorData: defaultColorData, objects: defaultObjects };
    };

    const [initialState] = useState(() => {
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                // Basic validation - could be more thorough
                if (parsed && parsed.heightData && parsed.colorData && parsed.objects && parsed.version === 5) {
                    console.log("Loaded state from localStorage");
                    // Reset nextObjectId based on loaded data
                    const maxId = parsed.objects.reduce((max, obj) => {
                        return Math.max(max, (obj && obj.id) ? obj.id : 0);
                    }, 0);
                    nextObjectId = maxId + 1;
                    return { heightData: parsed.heightData, colorData: parsed.colorData, objects: sanitizeObjectsArray(parsed.objects) };
                } else {
                     console.warn("localStorage data invalid or old version, generating default.");
                }
            } catch (e) {
                console.error("Failed to parse localStorage data, generating default.", e);
            }
        }
        return generateDefaultState();
    });

    const [heightData, setHeightData] = useState(initialState.heightData);
    const [colorData, setColorData] = useState(initialState.colorData);
    const [objects, setObjects] = useState(initialState.objects);
    const gridHeight = useMemo(() => heightData.length, [heightData]);
    const gridWidth = useMemo(() => (heightData[0] ? heightData[0].length : 0), [heightData]);
    function getInitialHeightData(width, height) {
        console.log((new Error()).stack);
        const data = []; for (let z = 0; z < height; z++) { data[z] = []; for (let x = 0; x < width; x++) { data[z][x] = getInitialHeight(x, z, width, height); } } return data;
    }
    function getInitialColorData(hData) {
        const data = [];
        const height = hData.length;
        if (height === 0)
            return [];
        const width = hData[0].length;

        for (let z = 0; z < height; z++) {
            data[z] = [];
            for (let x = 0; x < width; x++) {
                const h = hData[z]?.[x] ?? 0;
                const hr = h / INITIAL_MAX_HEIGHT;
                const ci = Math.min(COLORS.length - 1, Math.max(0, Math.floor(hr * (COLORS.length - 2)) + 1));
                data[z][x] = h < 0.05 ? COLORS[0] : COLORS[ci];
            }
        }
        return data;
    }

    // --- Terrain & Height Lookup ---
    const applyTerrainBrush = useCallback((centerX, centerZ, deltaHeight, mode = 'relative', targetHeight = 0) => {
        if (gridWidth === 0 || gridHeight === 0) return; // Exit if grid is empty
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
                         let modifiedHeight;
                         if (mode === 'absolute') {
                             modifiedHeight = targetHeight;
                         } else { // Relative mode
                            let intensity = 0;
                            if (radius > 0.1) { const dist = Math.sqrt(distSq); const ratio = Math.min(1.0, dist / radius); intensity = Math.pow(Math.cos(ratio * Math.PI * 0.5), 2); } // Squared Cosine falloff
                            else { intensity = (distSq < 0.1) ? 1.0 : 0.0; }

                            const currentHeight = newData[z]?.[x] ?? 0; // Ensure currentHeight exists
                            modifiedHeight = currentHeight + deltaHeight * intensity;
                         }

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

    // --- Auto-Save to localStorage ---
    const saveTimeoutRef = useRef(null);
    useEffect(() => {
        // Debounce saving
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            try {
                const saveData = { version: CURRENT_SAVE_VERSION, heightData, colorData, objects };
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saveData));
                console.log("Autosaved state to localStorage");
            } catch (e) {
                console.error("Failed to save state to localStorage:", e);
            }
        }, 1000); // Save 1 second after the last change

        return () => clearTimeout(saveTimeoutRef.current); // Cleanup timeout on unmount
    }, [heightData, colorData, objects]); // Trigger effect when state changes

     // --- Imperative API ---
    useImperativeHandle(ref, () => ({
        // TODO: Cleanup null objects
        save: () => ({ version: CURRENT_SAVE_VERSION, heightData, colorData, objects }),
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
             // Trigger autosave after load
             if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
             localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ version: CURRENT_SAVE_VERSION, heightData: loadedData.heightData, colorData: loadedData.colorData, objects: processedObjects }));
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
             prev = sanitizeObjectsArray(prev);
             setObjects(prev => prev.filter(obj => obj.worldX >= minWorldX && obj.worldX < maxWorldX && obj.worldZ >= minWorldZ && obj.worldZ < maxWorldZ ));
             if (onInteractionEnd) onInteractionEnd(); // Notify parent
        },
        resetState: () => {
            console.log("Resetting scene state via imperative call");
            const defaultState = generateDefaultState(); // Regenerate defaults
            setHeightData(defaultState.heightData);
            setColorData(defaultState.colorData);
            setObjects(defaultState.objects);
            // Autosave will trigger due to state change
        },
        addObject: (newObjectData) => {
            const defaults = {}; const schema = ObjectEditorSchemas[newObjectData.type];
            if (schema) { schema.forEach(propInfo => { defaults[propInfo.name] = propInfo.defaultValue ?? (propInfo.type === 'color' ? '#CCCCCC' : (propInfo.min ?? 0.5)); }); }
            const fullData = { ...defaults, ...newObjectData };
            setObjects(prev => [...prev, fullData]);
        },
        removeObject: (id) => { setObjects(prev => prev.filter(obj => obj.id !== id)); },
        updateObjectPositionWorld: (id, newWorldX, newWorldZ) => {
            setObjects(prev => prev.map(obj => (obj && (obj.id === id)) ? { ...obj, worldX: newWorldX, worldZ: newWorldZ } : obj ));
        },
        getObjectProperties: (id) => {
            const obj = objects.find(o => o != null && o.id === id);
            return obj ? { ...obj } : null;
        },
        updateObjectProperty: (id, propName, value) => {
            setObjects(prev => prev.map(obj => (obj && (obj.id === id)) ? { ...obj, [propName]: value } : obj ));
        },
        getGroundHeightAtWorld: getGroundHeightAtWorld,
        getGridDimensions: () => ({ gridWidth, gridHeight }),
        applyTerrainBrush: applyTerrainBrush,
        updateCellColor: (gridX, gridZ, newColor) => {
            if (gridX >= 0 && gridX < gridWidth && gridZ >= 0 && gridZ < gridHeight) {
                setColorData(prevData => { const newData = prevData.map(r => [...r]); newData[gridZ][gridX] = newColor; return newData; });
            }
        },
    }), [ heightData, colorData, objects, gridWidth, gridHeight, brushSize, applyTerrainBrush, getGroundHeightAtWorld, onInteractionEnd ]);


    // --- Render Logic ---
    const gridCells = useMemo(() => {
        if (gridWidth === 0 || gridHeight === 0) return []; const cells = [];
        for (let z = 0; z < gridHeight; z++) { for (let x = 0; x < gridWidth; x++) { cells.push(<GridCell key={`${x}-${z}`} x={x} z={z} height={heightData[z]?.[x] ?? 0} color={colorData[z]?.[x] ?? '#ffffff'} onPointerDown={onGridPointerDown} gridWidth={gridWidth} gridHeight={gridHeight} />); } } return cells;
    }, [heightData, colorData, gridWidth, gridHeight, onGridPointerDown]);

    const renderedObjects = useMemo(() => {
         if (gridWidth === 0 || gridHeight === 0) return [];
         return objects.map(obj => {
            if (!obj)
                return null;
            const ObjectComponent = ObjectComponents[obj.type]; if (!ObjectComponent) return null;
            const groundHeight = getGroundHeightAtWorld(obj.worldX, obj.worldZ); const worldYBase = getWorldYBase(groundHeight); const position = [obj.worldX, worldYBase, obj.worldZ];
            return ( <ObjectComponent key={obj.id} objectId={obj.id} position={position} isSelected={obj.id === selectedObjectId} onSelect={() => onObjectSelect(obj.id)} onPointerDown={onObjectPointerDown} globalAge={globalAge} currentMonth={currentMonth} {...obj} /> );
        })
    }, [objects, selectedObjectId, globalAge, onObjectSelect, onObjectPointerDown, getGroundHeightAtWorld, gridWidth, gridHeight, currentMonth]);

    // --- Coordinate Labels ---
    const coordinateLabels = useMemo(() => {
        if (!showCoordinates || gridWidth === 0 || gridHeight === 0) {
            return null;
        }

        const labels = [];
        const labelColor = "#cccccc";
        const labelSize = 0.5;
        const labelOffset = 1; // How far outside the grid to place labels
        const groundY = 0.3; // Slightly above the base plane

        // X-axis labels (along negative Z edge)
        const zPos = (-gridHeight / 2 - labelOffset) * CELL_SIZE;
        for (let x = 0; x < gridWidth; x++) {
            const xPos = (x - gridWidth / 2 + 0.5) * CELL_SIZE;
            labels.push(
                <Text key={`coord-x-${x}`} position={[xPos, groundY, zPos]} fontSize={labelSize} color={labelColor} anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]}>
                    {x}
                </Text>
            );
        }

        // Z-axis labels (along negative X edge)
        const xPos = (-gridWidth / 2 - labelOffset) * CELL_SIZE;
        for (let z = 0; z < gridHeight; z++) {
            const zPos = (z - gridHeight / 2 + 0.5) * CELL_SIZE;
            labels.push(
                <Text key={`coord-z-${z}`} position={[xPos, groundY, zPos]} fontSize={labelSize} color={labelColor} anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]}>
                    {z}
                </Text>
            );
        }
        return labels;
    }, [showCoordinates, gridWidth, gridHeight]); // Depend on toggle state and dimensions

     // --- Base Scene Elements ---
    const groundPlaneSize = useMemo(() => [gridWidth * CELL_SIZE + 4, gridHeight * CELL_SIZE + 4], [gridWidth, gridHeight]);
    const avgHeight = useMemo(() => { if (gridWidth === 0 || gridHeight === 0) return 0; let t = 0; let c = 0; for (let z = 0; z < gridHeight; z++) { for (let x = 0; x < gridWidth; x++) { t += heightData[z]?.[x] ?? 0; c++; } } return c > 0 ? t / c : 0; }, [heightData, gridWidth, gridHeight]);

    // --- Shadow Camera Configuration ---
    const shadowCameraProps = useMemo(() => {
        const size = Math.max(gridWidth, gridHeight) * CELL_SIZE * 0.75; // Cover slightly more than half the max dimension
        return {
            near: 0.5,
            far: Math.max(gridWidth, gridHeight) * CELL_SIZE * 2 + 50, // Ensure far plane is distant enough
            left: -size,
            right: size,
            top: size,
            bottom: -size,
        };
    }, [gridWidth, gridHeight]); // Update if grid size changes

    // --- Calculate Light Position based on Azimuth/Elevation ---
    const lightPosition = useMemo(() => {
        const distance = Math.max(gridWidth, gridHeight) * 1.5; // Distance from center
        const azimuthRad = THREE.MathUtils.degToRad(sunAzimuth);
        const elevationRad = THREE.MathUtils.degToRad(sunElevation);

        // Spherical to Cartesian conversion
        const x = distance * Math.cos(elevationRad) * Math.sin(azimuthRad);
        const y = distance * Math.sin(elevationRad); // Height above the center plane
        const z = distance * Math.cos(elevationRad) * Math.cos(azimuthRad);

        // Offset slightly by average terrain height? Optional.
        // const offsetY = avgHeight / 2;
        return new THREE.Vector3(x, y + 10, z); // Add base height offset
    }, [sunAzimuth, sunElevation, gridWidth, gridHeight /*, avgHeight */]);

    return (
        <>
            <ambientLight intensity={0.6} />
            <directionalLight
                position={lightPosition}
                intensity={1.0}
                castShadow
                shadow-mapSize-width={1024} // Or 2048 for better quality
                shadow-mapSize-height={1024}
                shadow-camera-near={shadowCameraProps.near}
                shadow-camera-far={shadowCameraProps.far}
                shadow-camera-left={shadowCameraProps.left}
                shadow-camera-right={shadowCameraProps.right}
                shadow-camera-top={shadowCameraProps.top}
                shadow-camera-bottom={shadowCameraProps.bottom}
                shadow-bias={-0.002} // Optional: Adjust if shadow acne appears
                target-position={[0,0,0]} // Ensure light targets origin
            />
            {/* <directionalLight position={[gridWidth * 0.5, 15 + avgHeight, gridHeight * 0.5]} intensity={1.0} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} /> */}
            <group>{gridCells}</group>
            <group>{renderedObjects}</group>
            <group>{coordinateLabels}</group>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow name="base-ground"> <planeGeometry args={groundPlaneSize} /> <meshStandardMaterial color="#444" side={THREE.DoubleSide} /> </mesh>
        </>
    );
});


// --- Experience Component (Handles R3F Context and Interactions based on Mode) ---
function Experience({
    currentMode, // Explicit mode from PlanEditor
    selectedObjectToAdd, // NEW: Pass the selected configuration to add
    selectedObjectId, // Read-only, selection managed by PlanEditor via onSelectObject
    globalAge, brushSize, // Props for rendering/API
    sceneLogicRef, onSelectObject, onInteractionEnd, getInitialObjectId, showCoordinates, paintColor, sunAzimuth, sunElevation,
    terrainPaintMode, absolutePaintHeight,
    currentMonth, isOrthographic
}) {
    const { raycaster, pointer, camera, gl } = useThree();
    const orbitControlsRef = useRef();
    const dragPlaneRef = useRef();

    // --- Interaction State ---
    const [draggingInfo, setDraggingInfo] = useState(null);
    const [isPaintingTerrain, setIsPaintingTerrain] = useState(false);
    const [isPaintingColor, setIsPaintingColor] = useState(false);
    const [paintDirection, setPaintDirection] = useState(1);
    const pointerRef = useRef({ x: 0, y: 0 });

    // --- Event Handlers (Now strictly check currentMode) ---

    const handleObjectPointerDown = useCallback((event, objectId, objectType) => {
        // Only handle if in 'select' mode
        if (currentMode !== 'select') return;

        event.stopPropagation();
        onSelectObject(objectId); // Select the object
        const clickedObject = sceneLogicRef.current?.getObjectProperties(objectId);
        if (clickedObject) {
            const groundHeight = sceneLogicRef.current?.getGroundHeightAtWorld(clickedObject.worldX, clickedObject.worldZ) ?? 0;
            // Set potential drag info
            setDraggingInfo({
                id: objectId, initialY: getWorldYBase(groundHeight) + DRAG_PLANE_OFFSET,
                pointerId: event.pointerId
            });
            event.target?.setPointerCapture(event.pointerId);
            console.log("Potential Drag Start:", objectId);
        }
    }, [currentMode, onSelectObject, sceneLogicRef]); // Add currentMode dependency

    const handleGridPointerDown = useCallback((event, gridX, gridZ) => {
        if (draggingInfo || !sceneLogicRef.current) return; // Ignore grid clicks while dragging

        // --- Mode-Specific Actions ---
        if (selectedObjectToAdd) {
             raycaster.setFromCamera(pointer, camera);
             const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
             const intersectionPoint = new THREE.Vector3();
             if (!raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) return;
             const worldX = intersectionPoint.x; const worldZ = intersectionPoint.z;

             // Create object using data from selectedObjectToAdd
             const newObjectData = {
                 id: getInitialObjectId(),
                 type: selectedObjectToAdd.type,
                 worldX,
                 worldZ,
                 ...selectedObjectToAdd.props // Spread the predefined properties
             };
             sceneLogicRef.current.addObject(newObjectData);
             onInteractionEnd(); // Reset mode/selection after adding
        } else if (currentMode === 'terrain') {
            event.stopPropagation();
            setIsPaintingTerrain(true);
            const dir = event.shiftKey ? -1 : 1;
            setPaintDirection(dir);

            // Call applyTerrainBrush with mode and target height
            sceneLogicRef.current.applyTerrainBrush(
                gridX, gridZ,
                HEIGHT_MODIFIER * dir, // deltaHeight (used in relative mode)
                terrainPaintMode, absolutePaintHeight // Pass mode and target
            );
            event.target?.setPointerCapture(event.pointerId);
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
            console.log("Paint Start");
        }
        else if (currentMode === 'select') {
             // Click on grid in select mode deselects any selected object
             //onSelectObject(null);
        }
        else if (currentMode === 'paint-color') {
            event.stopPropagation();
            setIsPaintingColor(true);
            sceneLogicRef.current?.updateCellColor(gridX, gridZ, paintColor); // Paint the clicked cell
            event.target?.setPointerCapture(event.pointerId);
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
        }

    }, [currentMode, selectedObjectToAdd, draggingInfo, brushSize, sceneLogicRef, onInteractionEnd, onSelectObject, getInitialObjectId, raycaster, pointer, camera, gl, paintColor, terrainPaintMode, absolutePaintHeight]); // Added currentMode

    const handlePointerMove = useCallback((event) => {
        pointerRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
        pointerRef.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
        if (!sceneLogicRef.current) return;

        // If dragging, disable controls on first move
        if (draggingInfo && orbitControlsRef.current && orbitControlsRef.current.enabled) {
            orbitControlsRef.current.enabled = false;
            console.log("Drag detected, disabling controls.");
        }
 
        // --- Handle actual drag or paint based on state ---
        raycaster.setFromCamera(pointerRef.current, camera);

        if (draggingInfo && dragPlaneRef.current) { // Actual drag is happening
            const intersects = raycaster.intersectObject(dragPlaneRef.current);
            if (intersects.length > 0) { const point = intersects[0].point; sceneLogicRef.current.updateObjectPositionWorld(draggingInfo.id, point.x, point.z); }
        } else if (isPaintingTerrain) { // Painting is happening (implicitly, currentMode must be 'terrain')
            const { gridWidth, gridHeight } = sceneLogicRef.current.getGridDimensions();
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const intersectionPoint = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
                 const gridX = Math.floor(intersectionPoint.x / CELL_SIZE + gridWidth / 2); const gridZ = Math.floor(intersectionPoint.z / CELL_SIZE + gridHeight / 2);
                 if (gridX >= 0 && gridX < gridWidth && gridZ >= 0 && gridZ < gridHeight) {
                     // Call applyTerrainBrush with mode and target height
                     sceneLogicRef.current.applyTerrainBrush(
                         gridX, gridZ,
                         HEIGHT_MODIFIER * paintDirection, // deltaHeight (used in relative mode)
                         terrainPaintMode, absolutePaintHeight // Pass mode and target
                     );
                }
            }
        } else if (isPaintingColor) { // Painting color
            const { gridWidth, gridHeight } = sceneLogicRef.current.getGridDimensions();
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const intersectionPoint = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
                 const gridX = Math.floor(intersectionPoint.x / CELL_SIZE + gridWidth / 2); const gridZ = Math.floor(intersectionPoint.z / CELL_SIZE + gridHeight / 2);
                 if (gridX >= 0 && gridX < gridWidth && gridZ >= 0 && gridZ < gridHeight) { sceneLogicRef.current.updateCellColor(gridX, gridZ, paintColor); } // Paint cell under pointer
            }
        }
    }, [draggingInfo, isPaintingTerrain, isPaintingColor, paintDirection, raycaster, camera, sceneLogicRef, paintColor, terrainPaintMode, absolutePaintHeight]);

    const handlePointerUp = useCallback((event) => {
        console.log("Pointer up");
        const pointerId = event.pointerId;

        if (draggingInfo) { // A drag actually occurred
            console.log("Pointer Up - Drag End");
            gl.domElement.releasePointerCapture?.(pointerId); // Release capture first
            setDraggingInfo(null);
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
        } else if (isPaintingTerrain) { // Painting ended
            console.log("Pointer Up - Paint End");
            setIsPaintingTerrain(false);
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
            gl.domElement.releasePointerCapture?.(pointerId);
        } else if (isPaintingColor) { // Color painting ended
            console.log("Pointer Up - Color Paint End");
            setIsPaintingColor(false);
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = true;
            gl.domElement.releasePointerCapture?.(pointerId);
        }
    }, [draggingInfo, isPaintingTerrain, isPaintingColor, gl]);

     // Effect to add/remove global listeners
     useEffect(() => {
        const domElement = gl.domElement;
        const moveHandler = (event) => handlePointerMove(event);
        const upHandler = (event) => handlePointerUp(event);
        // Listen if dragging, actually dragging, or painting
        if (draggingInfo || isPaintingTerrain || isPaintingColor) {
            domElement.addEventListener('pointermove', moveHandler);
            domElement.addEventListener('pointerup', upHandler);
        }
        return () => {
            domElement.removeEventListener('pointermove', moveHandler);
            domElement.removeEventListener('pointerup', upHandler);
            if (orbitControlsRef.current) orbitControlsRef.current.enabled = true; // Ensure re-enabled
        };
    }, [draggingInfo, isPaintingTerrain, isPaintingColor, handlePointerMove, handlePointerUp, gl]);

     
    console.log("[Experience] Received showCoordinates:", showCoordinates);
    return (
        <>
            {/* Conditionally Render Cameras */}
            {isOrthographic ? (
                <OrthographicCamera
                    makeDefault
                    position={[0, 50, 0]} // Position directly above center
                    zoom={50} // Adjust initial zoom level (smaller value = more zoomed in)
                    near={0.1}
                    far={1000}
                    // Rotation is implicitly handled by position/lookAt for top-down
                    // left={-aspect * frustumSize / 2} // Can calculate based on viewport size if needed
                    // right={aspect * frustumSize / 2}
                    // top={frustumSize / 2}
                    // bottom={-frustumSize / 2}
                />
            ) : (
                <PerspectiveCamera
                    makeDefault
                    position={[15, 20, 25]} // Default perspective position
                    fov={60}
                />
            )}
            <SceneWithLogic
                ref={sceneLogicRef} selectedObjectId={selectedObjectId} globalAge={globalAge} brushSize={brushSize}
                onObjectSelect={onSelectObject} onObjectPointerDown={handleObjectPointerDown} onGridPointerDown={handleGridPointerDown} showCoordinates={showCoordinates}
                onInteractionEnd={onInteractionEnd} sunAzimuth={sunAzimuth} sunElevation={sunElevation} // Pass down for Add/Resize
                terrainPaintMode={terrainPaintMode} absolutePaintHeight={absolutePaintHeight}
                currentMonth={currentMonth}
            />
            {draggingInfo && (<Plane ref={dragPlaneRef} args={[10000, 10000]} rotation={[-Math.PI / 2, 0, 0]} position={[0, draggingInfo.initialY, 0]} visible={false} />)}
            {/* Disable controls only when actually dragging or painting */}
            <OrbitControls ref={orbitControlsRef} enabled={!draggingInfo && !isPaintingTerrain} makeDefault/>
        </>
    );
}


// --- App Entry Point (Manages Layout, UI, Modes, File IO) ---
export default function PlanEditor() {
    const sceneLogicRef = useRef();
    const fileInputRef = useRef(null);

    // --- UI State and App Modes ---
    const [currentMode, setCurrentMode] = useState('select'); // Default mode: 'select', 'terrain', 'add-tree', etc.
    const [selectedObjectId, setSelectedObjectId] = useState(null);
    const [selectedObjectProps, setSelectedObjectProps] = useState(null);
    const [globalAge, setGlobalAge] = useState(1.0);
    const [brushSize, setBrushSize] = useState(3);
    const [desiredWidth, setDesiredWidth] = useState(INITIAL_GRID_WIDTH);
    const [desiredHeight, setDesiredHeight] = useState(INITIAL_GRID_HEIGHT);
    const [currentGridSize, setCurrentGridSize] = useState({w: INITIAL_GRID_WIDTH, h: INITIAL_GRID_HEIGHT});
    const [terrainPaintMode, setTerrainPaintMode] = useState('relative'); // 'relative' or 'absolute'
    const [absolutePaintHeight, setAbsolutePaintHeight] = useState(1.0); // Target height for absolute mode
    const [paintColor, setPaintColor] = useState(COLORS[1]); // Default paint color
    const [showCoordinates, setShowCoordinates] = useState(true);
    const [clipboard, setClipboard] = useState(null); // For copy-paste
    const [showAddObjectList, setShowAddObjectList] = useState(false);
    const [selectedObjectToAdd, setSelectedObjectToAdd] = useState(null);
    const [isOrthographic, setIsOrthographic] = useState(false);
    const [sunAzimuth, setSunAzimuth] = useState(45); // Default: Northeast-ish
    const [sunElevation, setSunElevation] = useState(60); // Default: Fairly high sun
    const [currentMonth, setCurrentMonth] = useState(6);

    const getNextObjectId = useCallback(() => nextObjectId++, []);

    const getButtonStyle = (modeOrAction, disabled = false, isSelectedToAdd = false) => ({
        margin: '2px', padding: '4px 8px',
        border: (currentMode === modeOrAction || isSelectedToAdd) ? '2px solid #eee' : '1px solid #777', // Highlight active mode OR selected config
        backgroundColor: disabled ? '#666' : ((currentMode === modeOrAction || isSelectedToAdd) ? '#555' : '#333'),
        color: disabled ? '#aaa' : 'white', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        display: 'block', // Make add buttons stack vertically
        width: 'calc(100% - 10px)', // Adjust width for block display
        textAlign: 'left',
        marginBottom: '3px',
        fontSize: '11px', // Smaller font for config buttons
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    });

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
            try { const jsonString = e.target.result; const loadedData = JSON.parse(jsonString); const newSize = sceneLogicRef.current?.load(loadedData); if (newSize) { setDesiredWidth(newSize.newWidth); setDesiredHeight(newSize.newHeight); setCurrentGridSize({w: newSize.newWidth, h: newSize.newHeight}); } setSelectedObjectId(null); }
            catch (error) { console.error("Load Error:", error); alert(`Failed to load: ${error.message}`); }
            finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
        }; reader.onerror = (e) => { console.error("Read Error:", e); alert("Error reading file."); if (fileInputRef.current) fileInputRef.current.value = ""; }; reader.readAsText(file);
    }, []);

    // Handler to change the main mode
    const handleSetMode = (newMode) => {
        console.log("Setting mode to:", newMode);
        setCurrentMode(newMode);
        setSelectedObjectToAdd(null); // Clear pending add object when changing main mode
        if (newMode !== 'select') { setSelectedObjectId(null); }
    };
    
    const handleSelectConfiguration = (config) => {
        console.log("handleSelectConfiguration", selectedObjectToAdd?.name, config.name);
        if (selectedObjectToAdd?.name === config.name) {
            // Clicking the same config again deselects it and returns to 'select' mode
            setSelectedObjectToAdd(null);
            setCurrentMode('select');
            console.log("Deselected configuration for placement");
        } else {
            // Select this config for placement
            setSelectedObjectToAdd(config);
            setCurrentMode('placing'); // Special mode indicates user should click terrain
            setSelectedObjectId(null); // Deselect any 3D object
            console.log("Selected configuration for placement:", config.name);
        }
    };

    // Callback from Experience when an object is selected
    const handleSelectObject = useCallback((id) => {
        // Can only select objects if in 'select' mode
        if (currentMode === 'select') {
            setSelectedObjectId(id);
        } else if (id === null) {
            // Allow deselecting via background click even in other modes? Maybe not.
             setSelectedObjectId(null);
        }
    }, [currentMode]); // Depend on currentMode

    const handleRemoveSelected = () => { if (selectedObjectId !== null) { sceneLogicRef.current?.removeObject(selectedObjectId); setSelectedObjectId(null); } };

    // Callback from Experience/SceneLogic when an interaction ends that should reset the mode (e.g., Add Object, Resize)
    const handleInteractionEnd = useCallback(() => {
        console.log("handleInteractionEnd called in PlanEditor - Resetting mode to select, clearing add object");
        setCurrentMode('select');
        setSelectedObjectId(null);
        setSelectedObjectToAdd(null); // Clear pending add object
    }, []);

    const handleResize = () => {
        const w = parseInt(desiredWidth, 10); const h = parseInt(desiredHeight, 10);
        if (isNaN(w) || isNaN(h) || w < MIN_GRID_DIM || h < MIN_GRID_DIM || w > MAX_GRID_DIM || h > MAX_GRID_DIM) { /* alert */ return; }
        sceneLogicRef.current?.resizeGrid(w, h); // resizeGrid calls onInteractionEnd
        setCurrentGridSize({ w: w, h: h });
    };

    const handlePropertyChange = (propName, value, type) => {
        if (selectedObjectId === null || !selectedObjectProps) return;
        let parsedValue = value;
        const schema = ObjectEditorSchemas[selectedObjectProps.type];
        const propInfo = schema?.find(p => p.name === propName);
        if (type === 'number' || propInfo?.type === 'number') {
            parsedValue = parseFloat(value);
            if (isNaN(parsedValue)) parsedValue = propInfo.defaultValue ?? propInfo.min ?? 0;
            parsedValue = Math.max(propInfo.min ?? -Infinity, Math.min(propInfo.max ?? Infinity, parsedValue));
        } else if (type === 'boolean') {
            parsedValue = Boolean(value); // Convert checkbox value (usually 'on' or boolean)
        }
        sceneLogicRef.current?.updateObjectProperty(selectedObjectId, propName, parsedValue);
        setSelectedObjectProps(prevProps => ({ ...prevProps, [propName]: parsedValue }));
    };

    const handleReset = () => {
        if (window.confirm("Are you sure you want to reset the scene? This cannot be undone.")) {
            localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear saved state
            sceneLogicRef.current?.resetState(); // Trigger reset in SceneLogic
            handleInteractionEnd(); // Reset UI mode/selection
        }
        setIsOrthographic(false);
    };

    // --- Keyboard Shortcuts Handler ---
    const handleKeyDown = useCallback((event) => {
        console.log("Key Down:", event.key, "Ctrl:", event.ctrlKey, "Meta:", event.metaKey);

        // --- Deselect ---
        if (event.key === 'Escape') {
            if (selectedObjectId !== null) {
                console.log("ESC: Deselecting");
                handleSelectObject(null); // Use the existing handler
            }
            if (currentMode === 'placing') {
                console.log("ESC: Cancelling add object placement");
                setSelectedObjectToAdd(null);
                setCurrentMode('select');
            } else if (currentMode === 'terrain' || currentMode === 'paint-color') {
                handleSetMode('select');
            }
            // Potentially cancel other interactions like add mode?
            // if (currentMode.startsWith('add-')) {
            //     handleSetMode('select');
            // }
        }

        // --- Delete ---
        else if (event.key === 'Delete' && selectedObjectId !== null) {
            console.log("DEL: Deleting selected");
            event.preventDefault(); // Prevent browser back navigation etc.
            handleRemoveSelected(); // Use existing handler
        }

        // --- Copy ---
        else if ((event.ctrlKey || event.metaKey) && event.key === 'c' && selectedObjectId !== null) {
            event.preventDefault();
            const props = sceneLogicRef.current?.getObjectProperties(selectedObjectId);
            if (props) {
                const { id, ...copyData } = props; // Copy everything except the ID
                setClipboard(copyData);
                console.log("Copied to clipboard:", copyData);
            }
        }

        // --- Paste ---
        else if ((event.ctrlKey || event.metaKey) && event.key === 'v' && clipboard !== null) {
            event.preventDefault();
            console.log("Pasting from clipboard:", clipboard);
            const newId = getNextObjectId();
            // Simple paste: offset slightly from original position
            const pasteOffset = CELL_SIZE * 0.5;
            const newWorldX = (clipboard.worldX ?? 0) + pasteOffset;
            const newWorldZ = (clipboard.worldZ ?? 0) + pasteOffset;
            sceneLogicRef.current?.addObject({ ...clipboard, id: newId, worldX: newWorldX, worldZ: newWorldZ });
        }

        // --- Nudge (Arrow Keys) ---
        else if (event.key.startsWith('Arrow') && selectedObjectId !== null) {
            event.preventDefault(); // Prevent scrolling
            const nudgeAmount = CELL_SIZE * 0.1;
            const currentProps = sceneLogicRef.current?.getObjectProperties(selectedObjectId);
            if (!currentProps) return;

            let dx = 0; let dz = 0;
            if (event.key === 'ArrowUp') dz = -nudgeAmount;
            else if (event.key === 'ArrowDown') dz = nudgeAmount;
            else if (event.key === 'ArrowLeft') dx = -nudgeAmount;
            else if (event.key === 'ArrowRight') dx = nudgeAmount;

            sceneLogicRef.current?.updateObjectPositionWorld(selectedObjectId, currentProps.worldX + dx, currentProps.worldZ + dz);
        }
    }, [selectedObjectId, clipboard, currentMode, handleSelectObject, handleRemoveSelected, getNextObjectId, selectedObjectToAdd]); // Add dependencies

    const instructions = useMemo(() => {
         switch(currentMode) {
            case 'select': return "Click object to select/edit properties. Drag selected object to move.";
            case 'terrain': return "Click/Drag grid to modify height (Shift=Lower). Esc to exit.";
            case 'paint-color': return "Click/Drag grid to paint color. Esc to exit.";
            case 'placing': return `Click terrain to place '${selectedObjectToAdd?.name || ''}'. Click config again or Esc to cancel.`;
            default: return "Select a mode.";
        }
    }, [currentMode, selectedObjectToAdd]);

    const renderPropertyEditors = () => {
        if (!selectedObjectProps) return null;
        const editorSchema = ObjectEditorSchemas[selectedObjectProps.type];
        if (!editorSchema)
            return (<div style={{ marginTop: '10px' }}>No editor defined for type: {selectedObjectProps.type}</div>);
        const commonPropsStyle = { marginBottom: '5px' };
        
        const labelStyle = { display: 'inline-block', width: '90px', marginRight: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' };
        const inputBaseStyle = { width: 'calc(100% - 100px)', boxSizing: 'border-box', verticalAlign: 'middle' };

        return (
             <div style={{ borderTop: '1px solid #555', paddingTop: '8px', marginTop: '8px' }}>
                <strong>Edit {selectedObjectProps.type.replace(/_/g,' ')} (ID: {selectedObjectProps.id})</strong>
                {editorSchema.map(propInfo => {
                    let inputElement;
                    const currentValue = selectedObjectProps[propInfo.name] ?? propInfo.defaultValue;

                    if (propInfo.type === 'select') {
                        inputElement = (
                            <select
                                style={{ ...inputBaseStyle, height: '21px' /* Match other inputs */}}
                                id={propInfo.name}
                                value={currentValue} // Bind to state/default
                                onChange={(e) => handlePropertyChange(propInfo.name, e.target.value, 'select')} // Pass type hint if needed, value is string
                            >
                                {/* Map over options defined in the schema */}
                                {propInfo.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        );
                    } else if (propInfo.type === 'boolean') { // NEW: Handle boolean as checkbox
                         inputElement = (
                            <input
                                style={{ verticalAlign: 'middle', marginLeft: '5px' }} // Adjust style as needed
                                id={propInfo.name}
                                type="checkbox"
                                checked={!!currentValue} // Ensure boolean conversion
                                onChange={(e) => handlePropertyChange(propInfo.name, e.target.checked, 'boolean')} // Pass boolean value and type hint
                            />
                         );
                    } else if (propInfo.type === 'number') { // NEW: Handle number as slider + text display
                        const min = propInfo.min ?? 0;
                        const max = propInfo.max ?? 1;
                        const step = propInfo.step ?? 0.01; // Default step if not provided
                        inputElement = (
                            <div style={{ display: 'flex', alignItems: 'center', width: 'calc(100% - 100px)'}}>
                                <input
                                    style={{ flexGrow: 1, marginRight: '5px', height: '18px' }} // Slider takes up space
                                    id={propInfo.name}
                                    type="range" // Use range type
                                    min={min}
                                    max={max}
                                    step={step}
                                    value={currentValue}
                                    onChange={(e) => handlePropertyChange(propInfo.name, e.target.value, 'number')}
                                />
                                <span style={{ fontSize: '11px', minWidth: '25px', textAlign: 'right' }}>{Number(currentValue).toFixed(step < 0.1 ? 2 : (step < 1 ? 1 : 0) )}</span> {/* Display value */}
                            </div>
                          );
                    }
                    else { // Handle 'number', 'color', text etc.
                        inputElement = (
                            <input
                                style={inputBaseStyle}
                                id={propInfo.name}
                                type={propInfo.type} // Use type directly ('number', 'color', 'text')
                                step={propInfo.step} // step, min, max primarily for type='number'
                                min={propInfo.min}
                                max={propInfo.max}
                                value={currentValue} // Bind to state/default
                                onChange={(e) => handlePropertyChange(propInfo.name, e.target.value, propInfo.type)} // Pass value and original type
                            />
                        );
                    }

                    return (
                         <div key={propInfo.name} style={commonPropsStyle}>
                            <label style={labelStyle} htmlFor={propInfo.name} title={propInfo.label}>{propInfo.label}:</label>
                            {inputElement}
                        </div>
                    );
                })}
            </div>
        );
    };

    // Handler for Canvas pointer missed - only deselect if in 'select' mode
    const handleCanvasPointerMissed = useCallback(() => {
        if (currentMode === 'select'  && selectedObjectId !== null) {
            setSelectedObjectId(null);
        }
    }, [currentMode]);

    const groupedConfigurations = useMemo(() => {
        return objectConfigurations.reduce((acc, config) => {
            const type = config.type;
            if (!acc[type]) {
                acc[type] = [];
            }
            acc[type].push(config);
            return acc;
        }, {});
    }, []); // Runs once

    const renderAddObjectList = () => {
        if (!showAddObjectList) return null;

        const listStyle = {
            position: 'absolute', // Position relative to the main UI panel or PlanEditor div
            left: '235px', // Position next to the main panel
            top: '10px',
            background: 'rgba(40, 40, 40, 0.9)',
            padding: '10px',
            borderRadius: '5px',
            maxHeight: 'calc(100vh - 40px)',
            overflowY: 'auto',
            zIndex: 2, // Ensure it's above other UI elements if needed
            border: '1px solid #666',
            color: 'white',
            fontSize: '12px'
        };
        const itemStyle = {
            padding: '4px 8px',
            cursor: 'pointer',
            borderBottom: '1px solid #555'
        };
        const itemHoverStyle = { backgroundColor: '#555' }; // Basic hover effect

        return (
            <div style={listStyle}>
                <strong>Select Object to Add:</strong>
                {objectConfigurations.map((config, index) => (
                    <div
                        key={config.name + index} // Use name + index for key
                        style={itemStyle}
                        onClick={() => handleSelectConfiguration(config)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = itemHoverStyle.backgroundColor}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        {config.name} ({config.type})
                    </div>
                ))}
                 <button onClick={() => { setShowAddObjectList(false); setCurrentMode('select'); }} style={{marginTop: '10px', width: '100%'}}>Cancel</button>
            </div>
        );
    };

    // --- Effect for Global Key Listener ---
    useEffect(() => {
        console.log("Attaching keydown listener");
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            console.log("Removing keydown listener");
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]); // Re-attach if handler changes (due to dependencies)

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#282c34' }}>
             {/* UI Overlay - Update Mode Buttons */}
             <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 1, color: 'white', background: 'rgba(0,0,0,0.8)', padding: '10px', borderRadius: '5px', fontSize: '12px', width: '220px', maxHeight: 'calc(100vh - 20px)', overflowY: 'auto', boxSizing: 'border-box' }}>
                <strong>Actions:</strong><br/>
                    <button onClick={onLoadClick} style={getButtonStyle('load')}>Load</button>
                    <button onClick={onSaveClick} style={getButtonStyle('save')}>Save</button>
                    <button onClick={handleReset} style={getButtonStyle('reset')}>Reset</button>
                    <button onClick={handleRemoveSelected} disabled={selectedObjectId === null} style={getButtonStyle('remove', selectedObjectId === null)}>Remove</button>

                 { /* console.log("[PlanEditor] Rendering with showCoordinates:", showCoordinates) */ }
                 <div style={{ marginBottom: '8px' }}>
                     <strong>Mode:</strong><br/>
                     {/* Explicit Mode Buttons */}
                     <button style={getButtonStyle('placing')} onClick={() => handleSetMode('placing')}>Place</button>
                     <button style={getButtonStyle('select')} onClick={() => handleSetMode('select')}>Select/Move</button>
                     <button style={getButtonStyle('terrain')} onClick={() => handleSetMode('terrain')}>Edit Terrain</button>
                     <button style={getButtonStyle('paint-color')} onClick={() => handleSetMode('paint-color')}>Paint Color</button>
                 </div>
                 {/* ... Actions, Grid Resize, Brush Size (only relevant in terrain mode?), Aging Slider ... */}
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px', display: currentMode === 'terrain' ? 'block' : 'none' }}>
                    <strong>Terrain Brush:</strong>
                    <div><label>Size:</label> {brushSize}<br/> <input type="range" min="1" max="10" step="1" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value, 10))} style={{ width: '100%' }}/></div>
                    <div style={{marginTop: '5px'}}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                             <input type="checkbox" checked={terrainPaintMode === 'absolute'} onChange={(e) => setTerrainPaintMode(e.target.checked ? 'absolute' : 'relative')} style={{ marginRight: '5px' }}/>
                             Set Absolute Height:
                        </label>
                        <input type="number" step="0.1" value={absolutePaintHeight} onChange={(e) => setAbsolutePaintHeight(parseFloat(e.target.value) || 0)} disabled={terrainPaintMode !== 'absolute'} style={{ width: '50px', marginLeft: '5px', opacity: terrainPaintMode === 'absolute' ? 1 : 0.5 }}/>
                    </div>
                    <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}>
                        <strong>Grid ({currentGridSize.w} x {currentGridSize.h}):</strong><br/>
                        <input type="number" value={desiredWidth} onChange={(e) => setDesiredWidth(e.target.value)} min={MIN_GRID_DIM} max={MAX_GRID_DIM} style={{ width: '40px', marginRight: '3px' }}/>
                        x
                        <input type="number" value={desiredHeight} onChange={(e) => setDesiredHeight(e.target.value)} min={MIN_GRID_DIM} max={MAX_GRID_DIM} style={{ width: '40px', marginLeft: '3px', marginRight: '5px' }}/>
                        <button onClick={handleResize} style={getButtonStyle('resize')}>Resize</button>
                    </div>
                 </div>
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px', display: currentMode === 'paint-color' ? 'block' : 'none' }}>
                    <strong>Paint Color:</strong>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                        <input type="color" value={paintColor} onChange={(e) => setPaintColor(e.target.value)} style={{ marginRight: '5px', height: '25px', width: '40px', padding: '0 2px', border: '1px solid #555' }}/>
                        <span style={{ display: 'inline-block', width: '15px', height: '15px', backgroundColor: paintColor, border: '1px solid #fff' }}></span>
                    </div>
                    <div>
                        {COLORS.map(color => (
                            <button key={color} title={color} onClick={() => setPaintColor(color)} style={{ width: '20px', height: '20px', backgroundColor: color, border: paintColor === color ? '2px solid white' : '1px solid grey', marginRight: '3px', padding: 0, cursor: 'pointer' }} />
                        ))}
                    </div>
                 </div>
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}>
                     <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                         <input type="checkbox" checked={showCoordinates} onChange={(e) => setShowCoordinates(e.target.checked)} style={{ marginRight: '5px' }}/>
                         Show Coordinates
                     </label>
                 </div>
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}>
                     <strong>Global Age:</strong> {globalAge.toFixed(2)}<br/> <input type="range" min="0" max="1" step="0.01" value={globalAge} onChange={(e) => setGlobalAge(parseFloat(e.target.value))} style={{ width: '100%' }} />
                 </div>
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}>
                     <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                         <input type="checkbox" checked={isOrthographic} onChange={(e) => setIsOrthographic(e.target.checked)} style={{ marginRight: '5px' }}/>
                         Orthographic View
                     </label>
                 </div>

                 {/* Sun Position Controls */}
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}>
                     <strong>Sun Position:</strong>
                     <div style={{marginBottom: '3px'}}>
                         <label>Azimuth: {sunAzimuth}°</label><br/>
                         <input type="range" min="0" max="360" step="1" value={sunAzimuth} onChange={(e) => setSunAzimuth(parseInt(e.target.value, 10))} style={{ width: '100%' }} />
                     </div>
                     <div>
                         <label>Elevation: {sunElevation}°</label><br/>
                         <input type="range" min="0" max="90" step="1" value={sunElevation} onChange={(e) => setSunElevation(parseInt(e.target.value, 10))} style={{ width: '100%' }} />
                     </div>
                 </div>

                 {/* Time of Year Slider */}
                 <div style={{ marginBottom: '8px', borderTop: '1px solid #555', paddingTop: '8px' }}>
                     <strong>Time of Year:</strong> {MONTH_NAMES[currentMonth - 1]}<br/>
                     <input
                         type="range"
                         min="1" max="12" step="1" // Months 1 to 12
                         value={currentMonth}
                         onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
                         style={{ width: '100%' }}
                     />
                 </div>

                 <div style={{ borderTop: '1px solid #555', paddingTop: '8px', marginTop: '8px', display: currentMode === 'placing' ? 'block' : 'none' }} >
                     <strong>Add Object:{selectedObjectToAdd?.name}</strong>
                     {Object.entries(groupedConfigurations).map(([type, configs]) => (
                         <div key={type} style={{ marginTop: '5px' }}>
                             <strong style={{ textTransform: 'capitalize', display: 'block', marginBottom: '3px' }}>{type.replace(/_/g, ' ')}s:</strong>
                             {configs.map((config) => (
                                 <button
                                     key={config.name}
                                     style={getButtonStyle('placing', false, selectedObjectToAdd?.name === config.name)} // Highlight if selected for placement
                                     onClick={() => handleSelectConfiguration(config)}
                                     title={`Place ${config.name}`}
                                 >
                                     {config.name}
                                 </button>
                             ))}
                         </div>
                     ))}
                 </div>

                 {/* ... Property Editor (shown only if selectedObjectId is not null) ... */}
                 {selectedObjectId !== null && renderPropertyEditors()}
                 {/* ... Instructions ... */}
            </div>

            {renderAddObjectList()}

            
            {/* Floating GitHub Link Button */}
            <a
                href="https://github.com/andree182/garden.js/"
                target="_blank"
                rel="noopener noreferrer"
                title="View source on GitHub"
                style={{
                    position: 'fixed', // Position relative to the viewport
                    bottom: '15px',
                    right: '15px',
                    padding: '8px 12px',
                    backgroundColor: '#404040', // Dark grey background
                    color: '#ffffff', // White text
                    textDecoration: 'none',
                    borderRadius: '4px',
                    border: '#aaa solid 1px',
                    fontSize: '12px',
                    zIndex: 10 // Ensure it's above canvas, potentially adjust if overlaps other UI
                }}
            >
                =&amp; GitHub
            </a>

            <input type="file" ref={fileInputRef} onChange={onFileSelected} accept=".json,application/json" style={{ display: 'none' }} />

             <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                <Canvas shadows onPointerMissed={handleCanvasPointerMissed}>
                    <Experience
                         currentMode={currentMode} // Pass down the explicit mode
                         selectedObjectToAdd={selectedObjectToAdd} 
                         selectedObjectId={selectedObjectId} // Pass down selection
                         globalAge={globalAge} brushSize={brushSize} sceneLogicRef={sceneLogicRef}
                         onSelectObject={handleSelectObject} onInteractionEnd={handleInteractionEnd} getInitialObjectId={getNextObjectId}
                         showCoordinates={showCoordinates}
                         paintColor={paintColor}
                         sunAzimuth={sunAzimuth} // Pass down sun state
                         sunElevation={sunElevation} // Pass down sun state
                         terrainPaintMode={terrainPaintMode} absolutePaintHeight={absolutePaintHeight} 
                         currentMonth={currentMonth}
                         isOrthographic={isOrthographic}
                    />
                </Canvas>
            </div>
        </div>
    );
}
