import { Text } from "@react-three/drei";
import React, { forwardRef, useState, useMemo, useCallback, useRef, useEffect, useImperativeHandle } from "react";
import * as THREE from "three";
import { ObjectComponents } from "./objects";
import { INITIAL_GRID_WIDTH, INITIAL_GRID_HEIGHT, gridToWorldCenter, LOCAL_STORAGE_KEY, getInitialHeight, INITIAL_MAX_HEIGHT, COLORS, CELL_SIZE, GridCell, getWorldYBase } from "./PlanEditor";

// --- Scene Component (Manages Data State and 3D Primitives) ---
export const SceneWithLogic = forwardRef(
    (
        {
            selectedObjectId, globalAge, brushSize, // Props
            onObjectSelect, onObjectPointerDown, onGridPointerDown, onInteractionEnd, showCoordinates, sunAzimuth, sunElevation, terrainPaintMode, absolutePaintHeight, currentMonth, showObjectNames,
        },
        ref
    ) => {
        const sanitizeObjectsArray = (arr) => Array.isArray(arr)
            ? arr.filter(
                (obj) => obj && typeof obj === "object" && obj.id != null
            )
            : [];
        const CURRENT_SAVE_VERSION = 5;

        const generateDefaultState = () => {
            console.log("Generating default scene state...");
            const defaultHeightData = getInitialHeightData(
                INITIAL_GRID_WIDTH,
                INITIAL_GRID_HEIGHT
            );
            const defaultColorData = getInitialColorData(defaultHeightData);
            const initialGridObjects = [
                { id: 1, type: "tree", gridX: 5, gridZ: 5 }, // Base info
                {
                    id: 2,
                    type: "tree",
                    gridX: 15,
                    gridZ: 8,
                    maxFoliageHeight: 1.8,
                    maxFoliageRadius: 0.7,
                }, // Override some defaults
                { id: 3, type: "shrub", gridX: 8, gridZ: 14 },
                { id: 4, type: "grass", gridX: 10, gridZ: 10 },
            ];

            const hData = defaultHeightData;
            const defaultObjects = initialGridObjects.map((obj) => {
                const defaults = {};
                const schema = ObjectComponents[obj.type].editorSchema;
                if (schema) {
                    schema.forEach((propInfo) => {
                        defaults[propInfo.name] = propInfo.defaultValue;
                    });
                }
                const groundHeight = hData[obj.gridZ]?.[obj.gridX] ?? 0;
                const [worldX, , worldZ] = gridToWorldCenter(
                    obj.gridX,
                    obj.gridZ,
                    groundHeight,
                    INITIAL_GRID_WIDTH,
                    INITIAL_GRID_HEIGHT
                );
                const { gridX, gridZ, ...rest } = obj;
                return { ...defaults, worldX, worldZ, ...rest };
            });

            return {
                heightData: defaultHeightData,
                colorData: defaultColorData,
                objects: defaultObjects,
            };
        };

        const [initialState] = useState(() => {
            const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    // Basic validation - could be more thorough
                    if (parsed &&
                        parsed.heightData &&
                        parsed.colorData &&
                        parsed.objects &&
                        parsed.version === 5) {
                        console.log("Loaded state from localStorage");
                        return {
                            heightData: parsed.heightData,
                            colorData: parsed.colorData,
                            objects: sanitizeObjectsArray(parsed.objects),
                        };
                    } else {
                        console.warn(
                            "localStorage data invalid or old version, generating default."
                        );
                    }
                } catch (e) {
                    console.error(
                        "Failed to parse localStorage data, generating default.",
                        e
                    );
                }
            }
            return generateDefaultState();
        });

        const [heightData, setHeightData] = useState(initialState.heightData);
        const [colorData, setColorData] = useState(initialState.colorData);
        const [objects, setObjects] = useState(initialState.objects);
        const gridHeight = useMemo(() => heightData.length, [heightData]);
        const gridWidth = useMemo(
            () => (heightData[0] ? heightData[0].length : 0),
            [heightData]
        );
        function getInitialHeightData(width, height) {
            const data = [];
            for (let z = 0; z < height; z++) {
                data[z] = [];
                for (let x = 0; x < width; x++) {
                    data[z][x] = getInitialHeight(x, z, width, height);
                }
            }
            return data;
        }
        function getInitialColorData(hData) {
            const data = [];
            const height = hData.length;
            if (height === 0) return [];
            const width = hData[0].length;

            for (let z = 0; z < height; z++) {
                data[z] = [];
                for (let x = 0; x < width; x++) {
                    const h = hData[z]?.[x] ?? 0;
                    const hr = h / INITIAL_MAX_HEIGHT;
                    const ci = Math.min(
                        COLORS.length - 1,
                        Math.max(0, Math.floor(hr * (COLORS.length - 2)) + 1)
                    );
                    data[z][x] = h < 0.05 ? COLORS[0] : COLORS[ci];
                }
            }
            return data;
        }

        // --- Terrain & Height Lookup ---
        const applyTerrainBrush = useCallback(
            (
                centerX,
                centerZ,
                deltaHeight,
                mode = "relative",
                targetHeight = 0
            ) => {
                if (gridWidth === 0 || gridHeight === 0) return; // Exit if grid is empty
                setHeightData((prevData) => {
                    const newData = prevData.map((row) => [...row]);
                    const radius = brushSize - 1;
                    const radiusSq = radius * radius;
                    const startX = Math.max(0, Math.floor(centerX - radius));
                    const endX = Math.min(
                        gridWidth - 1,
                        Math.ceil(centerX + radius)
                    );
                    const startZ = Math.max(0, Math.floor(centerZ - radius));
                    const endZ = Math.min(
                        gridHeight - 1,
                        Math.ceil(centerZ + radius)
                    );

                    for (let z = startZ; z <= endZ; z++) {
                        for (let x = startX; x <= endX; x++) {
                            const distX = x - centerX;
                            const distZ = z - centerZ;
                            const distSq = distX * distX + distZ * distZ;
                            if (distSq <= (radius + 0.5) * (radius + 0.5)) {
                                let modifiedHeight;
                                if (mode === "absolute") {
                                    modifiedHeight = targetHeight;
                                } else {
                                    // Relative mode
                                    let intensity = 0;
                                    if (radius > 0.1) {
                                        const dist = Math.sqrt(distSq);
                                        const ratio = Math.min(
                                            1.0,
                                            dist / radius
                                        );
                                        intensity = Math.pow(
                                            Math.cos(ratio * Math.PI * 0.5),
                                            2
                                        );
                                    } // Squared Cosine falloff
                                    else {
                                        intensity = distSq < 0.1 ? 1.0 : 0.0;
                                    }

                                    const currentHeight = newData[z]?.[x] ?? 0; // Ensure currentHeight exists
                                    modifiedHeight =
                                        currentHeight + deltaHeight * intensity;
                                }

                                newData[z][x] = Math.max(0, modifiedHeight);
                            }
                        }
                    }
                    return newData;
                });
            },
            [brushSize, gridWidth, gridHeight]
        );

        const getGroundHeightAtWorld = useCallback(
            (worldX, worldZ) => {
                if (!heightData || gridWidth === 0 || gridHeight === 0)
                    return 0;
                const fractionalGridX = worldX / CELL_SIZE + gridWidth / 2 - 0.5;
                const fractionalGridZ = worldZ / CELL_SIZE + gridHeight / 2 - 0.5;
                const gridX = Math.floor(fractionalGridX);
                const gridZ = Math.floor(fractionalGridZ);
                // Basic: Use cell height
                if (gridX >= 0 &&
                    gridX < gridWidth &&
                    gridZ >= 0 &&
                    gridZ < gridHeight) {
                    return heightData[gridZ][gridX];
                }
                // TODO: Bilinear interpolation for smoother height
                return 0;
            },
            [heightData, gridWidth, gridHeight]
        );

        // --- Auto-Save to localStorage ---
        const saveTimeoutRef = useRef(null);
        useEffect(() => {
            // Debounce saving
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            saveTimeoutRef.current = setTimeout(() => {
                try {
                    const saveData = {
                        version: CURRENT_SAVE_VERSION,
                        heightData,
                        colorData,
                        objects,
                    };
                    localStorage.setItem(
                        LOCAL_STORAGE_KEY,
                        JSON.stringify(saveData)
                    );
                    console.log("Autosaved state to localStorage");
                } catch (e) {
                    console.error("Failed to save state to localStorage:", e);
                }
            }, 1000); // Save 1 second after the last change

            return () => clearTimeout(saveTimeoutRef.current); // Cleanup timeout on unmount
        }, [heightData, colorData, objects]); // Trigger effect when state changes


        // --- Imperative API ---
        useImperativeHandle(
            ref,
            () => ({
                // TODO: Cleanup null objects
                save: () => ({
                    version: CURRENT_SAVE_VERSION,
                    heightData,
                    colorData,
                    objects,
                }),
                load: (loadedData) => {
                    if (!loadedData || typeof loadedData !== "object")
                        throw new Error("Invalid data");
                    const version = loadedData.version ?? 1;
                    if (!Array.isArray(loadedData.heightData) ||
                        !Array.isArray(loadedData.colorData) ||
                        !Array.isArray(loadedData.objects))
                        throw new Error("Invalid data format");

                    setHeightData(loadedData.heightData);
                    setColorData(loadedData.colorData);
                    const currentW = loadedData.heightData[0]?.length ?? 0;
                    const currentH = loadedData.heightData.length ?? 0;
                    const hDataForConvert = loadedData.heightData;

                    const processedObjects = loadedData.objects.map((obj) => {
                        let baseObj = { ...obj };
                        // Add defaults based on SCHEMAS for robustness
                        const schema = ObjectComponents[baseObj.type].editorSchema;
                        if (schema) {
                            schema.forEach((propInfo) => {
                                if (baseObj[propInfo.name] === undefined) {
                                    baseObj[propInfo.name] =
                                        propInfo.defaultValue ??
                                        (propInfo.type === "color"
                                            ? "#CCCCCC"
                                            : propInfo.min ?? 0);
                                }
                            });
                        }
                        // Ensure core position exists
                        baseObj.worldX = baseObj.worldX ?? 0;
                        baseObj.worldZ = baseObj.worldZ ?? 0;
                        baseObj.rotationY = baseObj.rotationY ?? 0;
                        baseObj.name =
                            baseObj.name ?? config?.name ?? baseObj.type;
                        return baseObj;
                    });
                    setObjects(processedObjects);
                    // Trigger autosave after load
                    if (saveTimeoutRef.current)
                        clearTimeout(saveTimeoutRef.current);
                    localStorage.setItem(
                        LOCAL_STORAGE_KEY,
                        JSON.stringify({
                            version: CURRENT_SAVE_VERSION,
                            heightData: loadedData.heightData,
                            colorData: loadedData.colorData,
                            objects: processedObjects,
                        })
                    );
                    return { newWidth: currentW, newHeight: currentH };
                },
                resizeGrid: (newWidth, newHeight) => {
                    const oldWidth = gridWidth;
                    const oldHeight = gridHeight;
                    const oldHData = heightData;
                    const oldCData = colorData;
                    const newHData = [];
                    const newCData = [];
                    for (let z = 0; z < newHeight; z++) {
                        newHData[z] = [];
                        newCData[z] = [];
                        for (let x = 0; x < newWidth; x++) {
                            if (x < oldWidth && z < oldHeight) {
                                newHData[z][x] = oldHData[z][x];
                                newCData[z][x] = oldCData[z][x];
                            } else {
                                const h = getInitialHeight(
                                    x,
                                    z,
                                    newWidth,
                                    newHeight
                                );
                                newHData[z][x] = h;
                                const hr = h / INITIAL_MAX_HEIGHT;
                                const ci = Math.min(
                                    COLORS.length - 1,
                                    Math.max(
                                        0,
                                        Math.floor(hr * (COLORS.length - 2)) + 1
                                    )
                                );
                                newCData[z][x] =
                                    h < 0.05 ? COLORS[0] : COLORS[ci];
                            }
                        }
                    }
                    setHeightData(newHData);
                    setColorData(newCData);
                    const minWorldX = (-newWidth / 2) * CELL_SIZE;
                    const maxWorldX = (newWidth / 2) * CELL_SIZE;
                    const minWorldZ = (-newHeight / 2) * CELL_SIZE;
                    const maxWorldZ = (newHeight / 2) * CELL_SIZE;
                    prev = sanitizeObjectsArray(prev);
                    setObjects((prev) => prev.filter(
                        (obj) => obj.worldX >= minWorldX &&
                            obj.worldX < maxWorldX &&
                            obj.worldZ >= minWorldZ &&
                            obj.worldZ < maxWorldZ
                    )
                    );
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
                    const defaults = {};
                    const schema = ObjectComponents[newObjectData.type].editorSchema;
                    if (schema) {
                        schema.forEach((propInfo) => {
                            defaults[propInfo.name] =
                                propInfo.defaultValue ??
                                (propInfo.type === "color"
                                    ? "#CCCCCC"
                                    : propInfo.min ?? 0.5);
                        });
                    }
                    const configName = newObjectData.configName || newObjectData.type; // Get original config name if passed
                    const name = newObjectData.name || configName;
                    const fullData = { ...defaults, ...newObjectData, name };
                    setObjects((prev) => [...prev, fullData]);
                },
                removeObject: (id) => {
                    setObjects((prev) => prev.filter((obj) => obj.id !== id));
                },
                updateObjectPositionWorld: (id, newWorldX, newWorldZ) => {
                    setObjects((prev) => prev.map((obj) => obj && obj.id === id
                        ? {
                            ...obj,
                            worldX: newWorldX,
                            worldZ: newWorldZ,
                        }
                        : obj
                    )
                    );
                },
                getObjects: () => [...objects],
                getObjectProperties: (id) => {
                    const obj = objects.find((o) => o != null && o.id === id);
                    return obj ? { ...obj } : null;
                },
                updateObjectProperty: (id, propName, value) => {
                    setObjects((prev) => prev.map((obj) => obj && obj.id === id
                        ? { ...obj, [propName]: value }
                        : obj
                    )
                    );
                },
                getGroundHeightAtWorld: getGroundHeightAtWorld,
                getGridDimensions: () => ({ gridWidth, gridHeight }),
                applyTerrainBrush: applyTerrainBrush,
                updateCellColor: (gridX, gridZ, newColor) => {
                    if (gridX >= 0 &&
                        gridX < gridWidth &&
                        gridZ >= 0 &&
                        gridZ < gridHeight) {
                        setColorData((prevData) => {
                            const newData = prevData.map((r) => [...r]);
                            newData[gridZ][gridX] = newColor;
                            return newData;
                        });
                    }
                },
            }),
            [
                heightData,
                colorData,
                objects,
                gridWidth,
                gridHeight,
                brushSize,
                applyTerrainBrush,
                getGroundHeightAtWorld,
                onInteractionEnd,
            ]
        );

        // --- Render Logic ---
        const gridCells = useMemo(() => {
            if (gridWidth === 0 || gridHeight === 0) return [];
            const cells = [];
            for (let z = 0; z < gridHeight; z++) {
                for (let x = 0; x < gridWidth; x++) {
                    cells.push(
                        <GridCell
                            key={`${x}-${z}`}
                            x={x}
                            z={z}
                            height={heightData[z]?.[x] ?? 0}
                            color={colorData[z]?.[x] ?? "#ffffff"}
                            onPointerDown={onGridPointerDown}
                            gridWidth={gridWidth}
                            gridHeight={gridHeight} />
                    );
                }
            }
            return cells;
        }, [heightData, colorData, gridWidth, gridHeight, onGridPointerDown]);

        const renderedObjects = useMemo(() => {
            return objects.map((obj) => {
                if (!obj) return null; // Handle potential nulls after sanitization fail? Should not happen.
                const ObjectComponent = ObjectComponents[obj.type];
                if (!ObjectComponent) {
                    console.warn(`Unknown object type: ${obj.type}`);
                    return null;
                }
                const groundHeight = getGroundHeightAtWorld(
                    obj.worldX,
                    obj.worldZ
                );
                const worldYBase = getWorldYBase(groundHeight);
                const position = [obj.worldX, worldYBase, obj.worldZ];

                // Calculate approximate height for name tag positioning
                // This is rough, depends on object type. Could be improved.
                let objectHeight = 1.0; // Default height
                if (obj.type === "tree" || obj.type === "deciduous_tree")
                    objectHeight =
                        (obj.trunkHeight || 1) +
                        (obj.maxFoliageHeight || obj.foliageDiameter || 1) *
                        0.5;
                else if (obj.type === "hedge") objectHeight = obj.height || 0.8;
                else if (obj.type === "small_flower")
                    objectHeight = obj.stemHeight || 0.15;
                else if (obj.type === "garden_light")
                    objectHeight = obj.postHeight || 0.6;

                else
                    objectHeight =
                        obj.height || obj.bushHeight || obj.bodyHeight || 0.5; // Guess for others

                const nameYOffset = objectHeight * 1.1 + 0.2; // Position above the object

                return (
                    // Wrap object and potential name tag in a group if needed,
                    // but rendering Text directly might be okay performance-wise for moderate counts
                    <React.Fragment key={obj.id}>
                        <ObjectComponent
                            objectId={obj.id}
                            position={position}
                            isSelected={obj.id === selectedObjectId}
                            onSelect={() => onObjectSelect(obj.id)}
                            onPointerDown={onObjectPointerDown}
                            globalAge={globalAge}
                            currentMonth={currentMonth}
                            {...obj} // Pass all props including name, rotationY etc.
                        />
                        {/* Conditionally render Name Tag */}
                        {showObjectNames && (
                            <Text
                                position={[
                                    position[0],
                                    position[1] + nameYOffset,
                                    position[2],
                                ]} // Position above object base + offset
                                fontSize={0.25}
                                color="#FFF"
                                anchorX="center"
                                anchorY="middle"
                                outlineWidth={0.02}
                                outlineColor="#000"
                            >
                                {obj.name || obj.type}{" "}
                                {/* Show name or fallback to type */}
                            </Text>
                        )}
                    </React.Fragment>
                );
            });
        }, [
            objects,
            selectedObjectId,
            globalAge,
            currentMonth,
            onObjectSelect,
            onObjectPointerDown,
            getGroundHeightAtWorld,
            showObjectNames,
        ]);

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
                    <Text
                        key={`coord-x-${x}`}
                        position={[xPos, groundY, zPos]}
                        fontSize={labelSize}
                        color={labelColor}
                        anchorX="center"
                        anchorY="middle"
                        rotation={[-Math.PI / 2, 0, 0]}
                    >
                        {x}
                    </Text>
                );
            }

            // Z-axis labels (along negative X edge)
            const xPos = (-gridWidth / 2 - labelOffset) * CELL_SIZE;
            for (let z = 0; z < gridHeight; z++) {
                const zPos = (z - gridHeight / 2 + 0.5) * CELL_SIZE;
                labels.push(
                    <Text
                        key={`coord-z-${z}`}
                        position={[xPos, groundY, zPos]}
                        fontSize={labelSize}
                        color={labelColor}
                        anchorX="center"
                        anchorY="middle"
                        rotation={[-Math.PI / 2, 0, 0]}
                    >
                        {z}
                    </Text>
                );
            }
            return labels;
        }, [showCoordinates, gridWidth, gridHeight]); // Depend on toggle state and dimensions


        // --- Base Scene Elements ---
        const groundPlaneSize = useMemo(
            () => [gridWidth * CELL_SIZE + 4, gridHeight * CELL_SIZE + 4],
            [gridWidth, gridHeight]
        );
        const avgHeight = useMemo(() => {
            if (gridWidth === 0 || gridHeight === 0) return 0;
            let t = 0;
            let c = 0;
            for (let z = 0; z < gridHeight; z++) {
                for (let x = 0; x < gridWidth; x++) {
                    t += heightData[z]?.[x] ?? 0;
                    c++;
                }
            }
            return c > 0 ? t / c : 0;
        }, [heightData, gridWidth, gridHeight]);

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
                    target-position={[0, 0, 0]} // Ensure light targets origin
                />
                {/* <directionalLight position={[gridWidth * 0.5, 15 + avgHeight, gridHeight * 0.5]} intensity={1.0} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} /> */}
                <group>{gridCells}</group>
                <group>{renderedObjects}</group>
                <group>{coordinateLabels}</group>
                <mesh
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, -0.05, 0]}
                    receiveShadow
                    name="base-ground"
                >
                    {" "}
                    <planeGeometry args={groundPlaneSize} />{" "}
                    <meshStandardMaterial
                        color="#444"
                        side={THREE.DoubleSide} />{" "}
                </mesh>
            </>
        );
    }
);
