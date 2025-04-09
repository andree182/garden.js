// src/PlanEditor.jsx
import React, {
    useState,
    useMemo,
    useCallback,
    useRef,
    useEffect,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
    Box,
} from "@react-three/drei";
import * as THREE from "three";

// Import object components AND their editor schemas
import { ObjectComponents, objectConfigurations } from "./objects";
import { Experience } from "./Experience";

const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

// --- Configuration ---
export const CELL_SIZE = 1;
export const HEIGHT_MODIFIER = 0.1; // Base height change per brush application
export const INITIAL_MAX_HEIGHT = 1.5; // For terrain generation
export const INITIAL_GRID_WIDTH = 20;
export const INITIAL_GRID_HEIGHT = 20;
const MIN_GRID_DIM = 5;
const MAX_GRID_DIM = 100;
export const COLORS = [
    "#48b5d0",
    "#bbbbbb",
    "#8BC34A",
    "#CDDC39",
    "#FFEB3B",
    "#FFC107",
    "#FF9800",
    "#795548",
]; // Terrain Colors
export const DRAG_PLANE_OFFSET = 0.1; // Place drag plane slightly above ground
const DRAG_THRESHOLD = 5; // Minimum pixels pointer must move to initiate a drag
export const LOCAL_STORAGE_KEY = "planEditorSaveData_v5"; // Key for localStorage, update if format changes significantly

// --- Helper Functions ---
export const getInitialHeight = (x, z, width, height) => {
    const freqX = (2 * Math.PI) / width;
    const freqZ = (2 * Math.PI) / height;
    const sinX = Math.sin(x * freqX * 2);
    const sinZ = Math.sin(z * freqZ * 2);
    return ((sinX + sinZ + 2) / 4) * INITIAL_MAX_HEIGHT;
};
// For loading old saves or placing initial grid items
export const gridToWorldCenter = (
    gridX,
    gridZ,
    currentHeight,
    gridWidth,
    gridHeight
) => {
    const worldX = (gridX - gridWidth / 2 + 0.5) * CELL_SIZE;
    const worldZ = (gridZ - gridHeight / 2 + 0.5) * CELL_SIZE;
    const worldY = currentHeight / 2; // Center Y for grid cell box
    return [worldX, worldY, worldZ];
};

// Calculate base Y position for an object placed *on* the ground
export const getWorldYBase = (groundHeight) => groundHeight;
const lerp = THREE.MathUtils.lerp;

// --- Components ---

// GridCell remains here
export const GridCell = React.memo(
    ({ x, z, height, color, onPointerDown, gridWidth, gridHeight }) => {
        // Calculate world position for the center of the grid cell box
        const position = useMemo(() => {
            const worldX = (x - gridWidth / 2 + 0.5) * CELL_SIZE;
            const worldZ = (z - gridHeight / 2 + 0.5) * CELL_SIZE;
            const worldY = (height <= 0 ? 0.01 : height) / 2; // Center Y based on actual height
            return [worldX, worldY, worldZ];
        }, [x, z, height, gridWidth, gridHeight]);

        const scale = useMemo(
            () => [CELL_SIZE, height <= 0 ? 0.01 : height, CELL_SIZE],
            [height]
        );

        const handlePointerDown = useCallback(
            (event) => {
                // Allow event to bubble up to the Canvas/Experience handler
                onPointerDown(event, x, z);
            },
            [x, z, onPointerDown]
        );

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
                <meshStandardMaterial
                    color={color}
                    roughness={0.8}
                    metalness={0.1}
                />
            </mesh>
        );
    }
);

// --- App Entry Point (Manages Layout, UI, Modes, File IO) ---
export default function PlanEditor() {
    const sceneLogicRef = useRef();
    const fileInputRef = useRef(null);

    // --- UI State and App Modes ---
    const [currentMode, setCurrentMode] = useState("select"); // Default mode: 'select', 'terrain', 'add-tree', etc.
    const [selectedObjectId, setSelectedObjectId] = useState(null);
    const [selectedObjectProps, setSelectedObjectProps] = useState(null);
    const [globalAge, setGlobalAge] = useState(1.0);
    const [brushSize, setBrushSize] = useState(3);
    const [desiredWidth, setDesiredWidth] = useState(INITIAL_GRID_WIDTH);
    const [desiredHeight, setDesiredHeight] = useState(INITIAL_GRID_HEIGHT);
    const [currentGridSize, setCurrentGridSize] = useState({
        w: INITIAL_GRID_WIDTH,
        h: INITIAL_GRID_HEIGHT,
    });
    const [terrainPaintMode, setTerrainPaintMode] = useState("relative"); // 'relative' or 'absolute'
    const [absolutePaintHeight, setAbsolutePaintHeight] = useState(1.0); // Target height for absolute mode
    const [paintColor, setPaintColor] = useState(COLORS[1]); // Default paint color
    const [showCoordinates, setShowCoordinates] = useState(true);
    const [clipboard, setClipboard] = useState(null); // For copy-paste
    const [showAddObjectList, setShowAddObjectList] = useState(false);
    const [selectedObjectToAdd, setSelectedObjectToAdd] = useState(null);
    const [isOrthographic, setIsOrthographic] = useState(false);
    const [showObjectNames, setShowObjectNames] = useState(false);
    const [sunAzimuth, setSunAzimuth] = useState(45); // Default: Northeast-ish
    const [sunElevation, setSunElevation] = useState(60); // Default: Fairly high sun
    const [currentMonth, setCurrentMonth] = useState(6);

    const getNextObjectId = useCallback(() => 
        Math.max(...sceneLogicRef.current?.getObjects().map(o => o.id)) + 1, []);

    const getButtonStyle = (highlight = false, disabled = false) => ({
        margin: "2px",
        padding: "4px 8px",
        border: highlight ? "2px solid #eee" : "1px solid #777", // Highlight active mode OR selected config
        backgroundColor: disabled ? "#666" : highlight ? "#555" : "#333",
        color: disabled ? "#aaa" : "white",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        display: "block", // Make add buttons stack vertically
        width: "calc(100% - 10px)", // Adjust width for block display
        textAlign: "left",
        marginBottom: "3px",
        fontSize: "11px", // Smaller font for config buttons
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    });

    useEffect(() => {
        if (selectedObjectId !== null && sceneLogicRef.current) {
            const props =
                sceneLogicRef.current.getObjectProperties(selectedObjectId);
            setSelectedObjectProps(props);
        } else {
            setSelectedObjectProps(null);
        }
    }, [selectedObjectId]);

    const onSaveClick = useCallback(() => {
        const saveData = sceneLogicRef.current?.save();
        if (!saveData) return;
        const jsonString = JSON.stringify(saveData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `plan_data_v${saveData.version}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);
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
                const newSize = sceneLogicRef.current?.load(loadedData);
                if (newSize) {
                    setDesiredWidth(newSize.newWidth);
                    setDesiredHeight(newSize.newHeight);
                    setCurrentGridSize({
                        w: newSize.newWidth,
                        h: newSize.newHeight,
                    });
                }
                setSelectedObjectId(null);
            } catch (error) {
                console.error("Load Error:", error);
                alert(`Failed to load: ${error.message}`);
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
        reader.onerror = (e) => {
            console.error("Read Error:", e);
            alert("Error reading file.");
            if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsText(file);
    }, []);

    // Handler to change the main mode
    const handleSetMode = (newMode) => {
        console.log("Setting mode to:", newMode);
        setCurrentMode(newMode);
        setSelectedObjectToAdd(null); // Clear pending add object when changing main mode
        if (newMode !== "select") {
            setSelectedObjectId(null);
        }
    };

    const handleSelectConfiguration = (config) => {
        console.log(
            "handleSelectConfiguration",
            selectedObjectToAdd?.name,
            config.name
        );
        if (selectedObjectToAdd?.name === config.name) {
            // Clicking the same config again deselects it and returns to 'select' mode
            setSelectedObjectToAdd(null);
            setCurrentMode("select");
            console.log("Deselected configuration for placement");
        } else {
            // Select this config for placement
            setSelectedObjectToAdd(config);
            setCurrentMode("place"); // Special mode indicates user should click terrain
            setSelectedObjectId(null); // Deselect any 3D object
            console.log("Selected configuration for placement:", config.name);
        }
    };

    // Callback from Experience when an object is selected
    const handleSelectObject = useCallback(
        (id) => {
            // Can only select objects if in 'select' mode
            if (currentMode === "select") {
                setSelectedObjectId(id);
            } else if (id === null) {
                // Allow deselecting via background click even in other modes? Maybe not.
                setSelectedObjectId(null);
            }
        },
        [currentMode]
    ); // Depend on currentMode

    const handleRemoveSelected = () => {
        if (selectedObjectId !== null) {
            sceneLogicRef.current?.removeObject(selectedObjectId);
            setSelectedObjectId(null);
        }
    };

    // Callback from Experience/SceneLogic when an interaction ends that should reset the mode (e.g., Add Object, Resize)
    const handleInteractionEnd = useCallback(() => {
        console.log(
            "handleInteractionEnd called in PlanEditor - Resetting mode to select, clearing add object"
        );
        setCurrentMode("select");
        setSelectedObjectId(null);
        setSelectedObjectToAdd(null); // Clear pending add object
    }, []);

    const handleResize = () => {
        const w = parseInt(desiredWidth, 10);
        const h = parseInt(desiredHeight, 10);
        if (
            isNaN(w) ||
            isNaN(h) ||
            w < MIN_GRID_DIM ||
            h < MIN_GRID_DIM ||
            w > MAX_GRID_DIM ||
            h > MAX_GRID_DIM
        ) {
            /* alert */ return;
        }
        sceneLogicRef.current?.resizeGrid(w, h); // resizeGrid calls onInteractionEnd
        setCurrentGridSize({ w: w, h: h });
    };

    const handlePropertyChange = (propName, value, type = "text") => {
        if (selectedObjectId === null || !selectedObjectProps) return;
        let parsedValue = value;
        const schema = ObjectComponents[selectedObjectProps.type].editorSchema;
        const propInfo = schema?.find((p) => p.name === propName);
        if (type === "number" || propInfo?.type === "number") {
            parsedValue = parseFloat(value);
            if (isNaN(parsedValue))
                parsedValue = propInfo.defaultValue ?? propInfo.min ?? 0;
            parsedValue = Math.max(
                propInfo.min ?? -Infinity,
                Math.min(propInfo.max ?? Infinity, parsedValue)
            );
        } else if (type === "boolean") {
            parsedValue = Boolean(value); // Convert checkbox value (usually 'on' or boolean)
        }
        sceneLogicRef.current?.updateObjectProperty(
            selectedObjectId,
            propName,
            parsedValue
        );
        setSelectedObjectProps((prevProps) => ({
            ...prevProps,
            [propName]: parsedValue,
        }));
    };

    const handleReset = () => {
        if (
            window.confirm(
                "Are you sure you want to reset the scene? This cannot be undone."
            )
        ) {
            localStorage.removeItem(LOCAL_STORAGE_KEY); // Clear saved state
            sceneLogicRef.current?.resetState(); // Trigger reset in SceneLogic
            handleInteractionEnd(); // Reset UI mode/selection
        }
        setIsOrthographic(false);
    };

    // --- Keyboard Shortcuts Handler ---
    const handleKeyDown = useCallback(
        (event) => {
            console.log(
                "Key Down:",
                event.key,
                "Ctrl:",
                event.ctrlKey,
                "Meta:",
                event.metaKey
            );

            // --- Deselect ---
            if (event.key === "Escape") {
                if (selectedObjectId !== null) {
                    console.log("ESC: Deselecting");
                    handleSelectObject(null); // Use the existing handler
                }
                if (currentMode === "place") {
                    console.log("ESC: Cancelling add object placement");
                    setSelectedObjectToAdd(null);
                    setCurrentMode("select");
                } else if (
                    currentMode === "terrain" ||
                    currentMode === "paint-color"
                ) {
                    handleSetMode("select");
                }
            }

            // --- Delete ---
            else if (event.key === "Delete" && selectedObjectId !== null) {
                console.log("DEL: Deleting selected");
                event.preventDefault(); // Prevent browser back navigation etc.
                handleRemoveSelected(); // Use existing handler
            }

            // --- Copy ---
            else if (
                (event.ctrlKey || event.metaKey) &&
                event.key === "c" &&
                selectedObjectId !== null
            ) {
                event.preventDefault();
                const props =
                    sceneLogicRef.current?.getObjectProperties(
                        selectedObjectId
                    );
                if (props) {
                    const { id, ...copyData } = props; // Copy everything except the ID
                    setClipboard(copyData);
                    console.log("Copied to clipboard:", copyData);
                }
            }

            // --- Paste ---
            else if (
                (event.ctrlKey || event.metaKey) &&
                event.key === "v" &&
                clipboard !== null
            ) {
                event.preventDefault();
                console.log("Pasting from clipboard:", clipboard);
                const newId = getNextObjectId();
                // Simple paste: offset slightly from original position
                const pasteOffset = CELL_SIZE * 0.5;
                const newWorldX = (clipboard.worldX ?? 0) + pasteOffset;
                const newWorldZ = (clipboard.worldZ ?? 0) + pasteOffset;
                sceneLogicRef.current?.addObject({
                    ...clipboard,
                    id: newId,
                    worldX: newWorldX,
                    worldZ: newWorldZ,
                });
            }

            // --- Nudge (Arrow Keys) ---
            else if (
                event.key.startsWith("Arrow") &&
                selectedObjectId !== null
            ) {
                event.preventDefault(); // Prevent scrolling
                const nudgeAmount = CELL_SIZE * 0.1;
                const currentProps =
                    sceneLogicRef.current?.getObjectProperties(
                        selectedObjectId
                    );
                if (!currentProps) return;

                let dx = 0;
                let dz = 0;
                if (event.key === "ArrowUp") dz = -nudgeAmount;
                else if (event.key === "ArrowDown") dz = nudgeAmount;
                else if (event.key === "ArrowLeft") dx = -nudgeAmount;
                else if (event.key === "ArrowRight") dx = nudgeAmount;

                sceneLogicRef.current?.updateObjectPositionWorld(
                    selectedObjectId,
                    currentProps.worldX + dx,
                    currentProps.worldZ + dz
                );
            }
        },
        [
            selectedObjectId,
            clipboard,
            currentMode,
            handleSelectObject,
            handleRemoveSelected,
            getNextObjectId,
            selectedObjectToAdd,
        ]
    ); // Add dependencies

    const instructions = useMemo(() => {
        switch (currentMode) {
            case "select":
                return "Click object to select/edit properties. Drag selected object to move.";
            case "terrain":
                return "Click/Drag grid to modify height (Shift=Lower). Esc to exit.";
            case "paint-color":
                return "Click/Drag grid to paint color. Esc to exit.";
            case "place":
                return `Click terrain to place '${
                    selectedObjectToAdd?.name || ""
                }'. Click config again or Esc to cancel.`;
            default:
                return "Select a mode.";
        }
    }, [currentMode, selectedObjectToAdd]);

    const renderPropertyEditors = () => {
        if (!selectedObjectProps) return null;
        const editorSchema =
            ObjectComponents[selectedObjectProps.type].editorSchema;
        if (!editorSchema)
            return (
                <div style={{ marginTop: "10px" }}>
                    No editor defined for type: {selectedObjectProps.type}
                </div>
            );
        const commonPropsStyle = { marginBottom: "5px" };

        const labelStyle = {
            display: "inline-block",
            width: "90px",
            marginRight: "5px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            verticalAlign: "middle",
        };
        const inputBaseStyle = {
            width: "calc(100% - 100px)",
            boxSizing: "border-box",
            verticalAlign: "middle",
        };

        return (
            <div
                style={{
                    borderTop: "1px solid #555",
                    paddingTop: "8px",
                    marginTop: "8px",
                }}
            >
                <strong>
                    Edit {selectedObjectProps.type.replace(/_/g, " ")} (ID:{" "}
                    {selectedObjectProps.id})
                </strong>
                <div key="name-editor" style={commonPropsStyle}>
                    <label style={labelStyle} htmlFor="objectName" title="Name">
                        Name:
                    </label>
                    <input
                        style={inputBaseStyle}
                        id="objectName"
                        type="text"
                        value={selectedObjectProps.name || ""} // Use current name
                        onChange={(e) =>
                            handlePropertyChange("name", e.target.value, "text")
                        } // Update name prop
                    />
                </div>
                {editorSchema.map((propInfo) => {
                    let inputElement;
                    const currentValue =
                        selectedObjectProps[propInfo.name] ??
                        propInfo.defaultValue;

                    if (propInfo.type === "select") {
                        inputElement = (
                            <select
                                style={{
                                    ...inputBaseStyle,
                                    height: "21px" /* Match other inputs */,
                                }}
                                id={propInfo.name}
                                value={currentValue} // Bind to state/default
                                onChange={(e) =>
                                    handlePropertyChange(
                                        propInfo.name,
                                        e.target.value,
                                        "select"
                                    )
                                } // Pass type hint if needed, value is string
                            >
                                {/* Map over options defined in the schema */}
                                {propInfo.options?.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                            </select>
                        );
                    } else if (propInfo.type === "boolean") {
                        // NEW: Handle boolean as checkbox
                        inputElement = (
                            <input
                                style={{
                                    verticalAlign: "middle",
                                    marginLeft: "5px",
                                }} // Adjust style as needed
                                id={propInfo.name}
                                type="checkbox"
                                checked={!!currentValue} // Ensure boolean conversion
                                onChange={(e) =>
                                    handlePropertyChange(
                                        propInfo.name,
                                        e.target.checked,
                                        "boolean"
                                    )
                                } // Pass boolean value and type hint
                            />
                        );
                    } else if (propInfo.type === "number") {
                        // NEW: Handle number as slider + text display
                        const min = propInfo.min ?? 0;
                        const max = propInfo.max ?? 1;
                        const step = propInfo.step ?? 0.01; // Default step if not provided
                        inputElement = (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    width: "calc(100% - 100px)",
                                }}
                            >
                                <input
                                    style={{
                                        flexGrow: 1,
                                        marginRight: "5px",
                                        height: "18px",
                                    }} // Slider takes up space
                                    id={propInfo.name}
                                    type="range" // Use range type
                                    min={min}
                                    max={max}
                                    step={step}
                                    value={currentValue}
                                    onChange={(e) =>
                                        handlePropertyChange(
                                            propInfo.name,
                                            e.target.value,
                                            "number"
                                        )
                                    }
                                />
                                <span
                                    style={{
                                        fontSize: "11px",
                                        minWidth: "25px",
                                        textAlign: "right",
                                    }}
                                >
                                    {Number(currentValue).toFixed(
                                        step < 0.1 ? 2 : step < 1 ? 1 : 0
                                    )}
                                </span>{" "}
                                {/* Display value */}
                            </div>
                        );
                    } else {
                        // Handle 'number', 'color', text etc.
                        inputElement = (
                            <input
                                style={inputBaseStyle}
                                id={propInfo.name}
                                type={propInfo.type} // Use type directly ('number', 'color', 'text')
                                step={propInfo.step} // step, min, max primarily for type='number'
                                min={propInfo.min}
                                max={propInfo.max}
                                value={currentValue} // Bind to state/default
                                onChange={(e) =>
                                    handlePropertyChange(
                                        propInfo.name,
                                        e.target.value,
                                        propInfo.type
                                    )
                                } // Pass value and original type
                            />
                        );
                    }

                    return (
                        <div key={propInfo.name} style={commonPropsStyle}>
                            <label
                                style={labelStyle}
                                htmlFor={propInfo.name}
                                title={propInfo.label}
                            >
                                {propInfo.label}:
                            </label>
                            {inputElement}
                        </div>
                    );
                })}
            </div>
        );
    };

    // Handler for Canvas pointer missed - only deselect if in 'select' mode
    const handleCanvasPointerMissed = useCallback(() => {
        if (currentMode === "select" && selectedObjectId !== null) {
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
            position: "absolute", // Position relative to the main UI panel or PlanEditor div
            left: "235px", // Position next to the main panel
            top: "10px",
            background: "rgba(40, 40, 40, 0.9)",
            padding: "10px",
            borderRadius: "5px",
            maxHeight: "calc(100vh - 40px)",
            overflowY: "auto",
            zIndex: 2, // Ensure it's above other UI elements if needed
            border: "1px solid #666",
            color: "white",
            fontSize: "12px",
        };
        const itemStyle = {
            padding: "4px 8px",
            cursor: "pointer",
            borderBottom: "1px solid #555",
        };
        const itemHoverStyle = { backgroundColor: "#555" }; // Basic hover effect

        return (
            <div style={listStyle}>
                <strong>Select Object to Add:</strong>
                {objectConfigurations.map((config, index) => (
                    <div
                        key={config.name + index} // Use name + index for key
                        style={itemStyle}
                        onClick={() => handleSelectConfiguration(config)}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                                itemHoverStyle.backgroundColor)
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                                "transparent")
                        }
                    >
                        {config.name} ({config.type})
                    </div>
                ))}
                <button
                    onClick={() => {
                        setShowAddObjectList(false);
                        setCurrentMode("select");
                    }}
                    style={{ marginTop: "10px", width: "100%" }}
                >
                    Cancel
                </button>
            </div>
        );
    };

    const handleExportObjectList = useCallback(() => {
        const allObjects = sceneLogicRef.current?.getObjects();
        if (!allObjects || allObjects.length === 0) {
            alert("No objects to export.");
            return;
        }

        // Group by name
        const grouped = allObjects.reduce((acc, obj) => {
            if (!obj) return acc; // Skip null/undefined objects
            const name = obj.name || obj.type; // Use name or fallback to type
            if (!acc[name]) {
                acc[name] = { count: 0, coordinates: [] };
            }
            acc[name].count++;
            // Store coords rounded to reasonable precision
            acc[name].coordinates.push([
                parseFloat(obj.worldX.toFixed(3)),
                parseFloat(
                    (
                        obj.worldY ??
                        sceneLogicRef.current?.getGroundHeightAtWorld(
                            obj.worldX,
                            obj.worldZ
                        ) ??
                        0
                    ).toFixed(3)
                ), // Get Y if needed
                parseFloat(obj.worldZ.toFixed(3)),
            ]);
            return acc;
        }, {});

        // Format for export
        const exportData = Object.entries(grouped).map(([name, data]) => ({
            name: name,
            count: data.count,
            positions: data.coordinates, // Rename field to 'positions'
        }));

        // Trigger download
        try {
            const jsonString = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "object_list_export.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to export object list:", error);
            alert("Failed to generate export file.");
        }
    }, []); // Depends only on sceneLogicRef

    // --- Effect for Global Key Listener ---
    useEffect(() => {
        console.log("Attaching keydown listener");
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            console.log("Removing keydown listener");
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [handleKeyDown]); // Re-attach if handler changes (due to dependencies)

    return (
        <div
            style={{
                height: "100vh",
                width: "100vw",
                display: "flex",
                flexDirection: "column",
                background: "#282c34",
            }}
        >
            {/* UI Overlay - Update Mode Buttons */}
            <div
                style={{
                    position: "absolute",
                    top: "10px",
                    left: "10px",
                    zIndex: 1,
                    color: "white",
                    background: "rgba(0,0,0,0.8)",
                    padding: "10px",
                    borderRadius: "5px",
                    fontSize: "12px",
                    width: "220px",
                    maxHeight: "calc(100vh - 20px)",
                    overflowY: "auto",
                    boxSizing: "border-box",
                }}
            >
                <strong>Actions:</strong>
                <br />
                <button onClick={onLoadClick} style={getButtonStyle()}>
                    Load
                </button>
                <button onClick={onSaveClick} style={getButtonStyle()}>
                    Save
                </button>
                <button onClick={handleReset} style={getButtonStyle()}>
                    Reset
                </button>
                <button
                    onClick={handleExportObjectList}
                    style={getButtonStyle()}
                >
                    Export List
                </button>
                <button
                    onClick={handleRemoveSelected}
                    style={getButtonStyle(false, selectedObjectId === null)}
                >
                    Remove
                </button>

                {/* console.log("[PlanEditor] Rendering with showCoordinates:", showCoordinates) */}
                <div style={{ marginBottom: "8px" }}>
                    <strong>Mode:</strong>
                    <br />
                    {/* Explicit Mode Buttons */}
                    <button
                        style={getButtonStyle(currentMode == "place")}
                        onClick={() => handleSetMode("place")}
                    >
                        Place
                    </button>
                    <button
                        style={getButtonStyle(currentMode == "select")}
                        onClick={() => handleSetMode("select")}
                    >
                        Select/Move
                    </button>
                    <button
                        style={getButtonStyle(currentMode == "terrain")}
                        onClick={() => handleSetMode("terrain")}
                    >
                        Edit Terrain
                    </button>
                    <button
                        style={getButtonStyle(currentMode == "paint-color")}
                        onClick={() => handleSetMode("paint-color")}
                    >
                        Paint Color
                    </button>
                </div>
                {/* ... Actions, Grid Resize, Brush Size (only relevant in terrain mode?), Aging Slider ... */}
                <div
                    style={{
                        marginBottom: "8px",
                        borderTop: "1px solid #555",
                        paddingTop: "8px",
                        display: currentMode === "terrain" ? "block" : "none",
                    }}
                >
                    <strong>Terrain Brush:</strong>
                    <div>
                        <label>Size:</label> {brushSize}
                        <br />{" "}
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={brushSize}
                            onChange={(e) =>
                                setBrushSize(parseInt(e.target.value, 10))
                            }
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div style={{ marginTop: "5px" }}>
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                cursor: "pointer",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={terrainPaintMode === "absolute"}
                                onChange={(e) =>
                                    setTerrainPaintMode(
                                        e.target.checked
                                            ? "absolute"
                                            : "relative"
                                    )
                                }
                                style={{ marginRight: "5px" }}
                            />
                            Set Absolute Height:
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={absolutePaintHeight}
                            onChange={(e) =>
                                setAbsolutePaintHeight(
                                    parseFloat(e.target.value) || 0
                                )
                            }
                            disabled={terrainPaintMode !== "absolute"}
                            style={{
                                width: "50px",
                                marginLeft: "5px",
                                opacity:
                                    terrainPaintMode === "absolute" ? 1 : 0.5,
                            }}
                        />
                    </div>
                    <div
                        style={{
                            marginBottom: "8px",
                            borderTop: "1px solid #555",
                            paddingTop: "8px",
                        }}
                    >
                        <strong>
                            Grid ({currentGridSize.w} x {currentGridSize.h}):
                        </strong>
                        <br />
                        <input
                            type="number"
                            value={desiredWidth}
                            onChange={(e) => setDesiredWidth(e.target.value)}
                            min={MIN_GRID_DIM}
                            max={MAX_GRID_DIM}
                            style={{ width: "40px", marginRight: "3px" }}
                        />
                        x
                        <input
                            type="number"
                            value={desiredHeight}
                            onChange={(e) => setDesiredHeight(e.target.value)}
                            min={MIN_GRID_DIM}
                            max={MAX_GRID_DIM}
                            style={{
                                width: "40px",
                                marginLeft: "3px",
                                marginRight: "5px",
                            }}
                        />
                        <button onClick={handleResize} style={getButtonStyle()}>
                            Resize
                        </button>
                    </div>
                </div>
                <div
                    style={{
                        marginBottom: "8px",
                        borderTop: "1px solid #555",
                        paddingTop: "8px",
                        display:
                            currentMode === "paint-color" ? "block" : "none",
                    }}
                >
                    <strong>Paint Color:</strong>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            marginBottom: "5px",
                        }}
                    >
                        <input
                            type="color"
                            value={paintColor}
                            onChange={(e) => setPaintColor(e.target.value)}
                            style={{
                                marginRight: "5px",
                                height: "25px",
                                width: "40px",
                                padding: "0 2px",
                                border: "1px solid #555",
                            }}
                        />
                        <span
                            style={{
                                display: "inline-block",
                                width: "15px",
                                height: "15px",
                                backgroundColor: paintColor,
                                border: "1px solid #fff",
                            }}
                        ></span>
                    </div>
                    <div>
                        {COLORS.map((color) => (
                            <button
                                key={color}
                                title={color}
                                onClick={() => setPaintColor(color)}
                                style={{
                                    width: "20px",
                                    height: "20px",
                                    backgroundColor: color,
                                    border:
                                        paintColor === color
                                            ? "2px solid white"
                                            : "1px solid grey",
                                    marginRight: "3px",
                                    padding: 0,
                                    cursor: "pointer",
                                }}
                            />
                        ))}
                    </div>
                </div>
                <div
                    style={{
                        marginBottom: "8px",
                        borderTop: "1px solid #555",
                        paddingTop: "8px",
                    }}
                >
                    <label
                        style={{
                            display: "flex",
                            alignItems: "center",
                            cursor: "pointer",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={showCoordinates}
                            onChange={(e) =>
                                setShowCoordinates(e.target.checked)
                            }
                            style={{ marginRight: "5px" }}
                        />
                        Show Coordinates
                    </label>
                </div>
                <div
                    style={{
                        marginBottom: "8px",
                        borderTop: "1px solid #555",
                        paddingTop: "8px",
                    }}
                >
                    <strong>Global Age:</strong> {globalAge.toFixed(2)}
                    <br />{" "}
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={globalAge}
                        onChange={(e) =>
                            setGlobalAge(parseFloat(e.target.value))
                        }
                        style={{ width: "100%" }}
                    />
                </div>
                <div
                    style={{
                        marginBottom: "8px",
                        borderTop: "1px solid #555",
                        paddingTop: "8px",
                    }}
                >
                    <label
                        style={{
                            display: "flex",
                            alignItems: "center",
                            cursor: "pointer",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={isOrthographic}
                            onChange={(e) =>
                                setIsOrthographic(e.target.checked)
                            }
                            style={{ marginRight: "5px" }}
                        />
                        Orthographic View
                    </label>
                    <label
                        style={{
                            display: "flex",
                            alignItems: "center",
                            cursor: "pointer",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={showObjectNames}
                            onChange={(e) =>
                                setShowObjectNames(e.target.checked)
                            }
                            style={{ marginRight: "5px" }}
                        />{" "}
                        Names
                    </label>
                </div>

                {/* Sun Position Controls */}
                <div
                    style={{
                        marginBottom: "8px",
                        borderTop: "1px solid #555",
                        paddingTop: "8px",
                    }}
                >
                    <strong>Sun Position:</strong>
                    <div style={{ marginBottom: "3px" }}>
                        <label>Azimuth: {sunAzimuth}°</label>
                        <br />
                        <input
                            type="range"
                            min="0"
                            max="360"
                            step="1"
                            value={sunAzimuth}
                            onChange={(e) =>
                                setSunAzimuth(parseInt(e.target.value, 10))
                            }
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div>
                        <label>Elevation: {sunElevation}°</label>
                        <br />
                        <input
                            type="range"
                            min="0"
                            max="90"
                            step="1"
                            value={sunElevation}
                            onChange={(e) =>
                                setSunElevation(parseInt(e.target.value, 10))
                            }
                            style={{ width: "100%" }}
                        />
                    </div>
                </div>

                {/* Time of Year Slider */}
                <div
                    style={{
                        marginBottom: "8px",
                        borderTop: "1px solid #555",
                        paddingTop: "8px",
                    }}
                >
                    <strong>Time of Year:</strong>{" "}
                    {MONTH_NAMES[currentMonth - 1]}
                    <br />
                    <input
                        type="range"
                        min="1"
                        max="12"
                        step="1" // Months 1 to 12
                        value={currentMonth}
                        onChange={(e) =>
                            setCurrentMonth(parseInt(e.target.value, 10))
                        }
                        style={{ width: "100%" }}
                    />
                </div>

                <div
                    style={{
                        borderTop: "1px solid #555",
                        paddingTop: "8px",
                        marginTop: "8px",
                        display: currentMode === "place" ? "block" : "none",
                    }}
                >
                    <strong>Add Object:</strong>
                    {Object.entries(groupedConfigurations).map(
                        ([type, configs]) => (
                            <div key={type} style={{ marginTop: "5px" }}>
                                <strong
                                    style={{
                                        textTransform: "capitalize",
                                        display: "block",
                                        marginBottom: "3px",
                                    }}
                                >
                                    {type.replace(/_/g, " ")}s:
                                </strong>
                                {configs.map((config) => (
                                    <button
                                        key={config.name}
                                        style={getButtonStyle(
                                            currentMode == "place" &&
                                                selectedObjectToAdd?.name ===
                                                    config.name,
                                            false
                                        )} // Highlight if selected for placement
                                        onClick={() =>
                                            handleSelectConfiguration(config)
                                        }
                                        title={`Place ${config.name}`}
                                    >
                                        {config.name}
                                    </button>
                                ))}
                            </div>
                        )
                    )}
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
                    position: "fixed", // Position relative to the viewport
                    bottom: "15px",
                    right: "15px",
                    padding: "8px 12px",
                    backgroundColor: "#404040", // Dark grey background
                    color: "#ffffff", // White text
                    textDecoration: "none",
                    borderRadius: "4px",
                    border: "#aaa solid 1px",
                    fontSize: "12px",
                    zIndex: 10, // Ensure it's above canvas, potentially adjust if overlaps other UI
                }}
            >
                GitHub/garden.js
            </a>

            <input
                type="file"
                ref={fileInputRef}
                onChange={onFileSelected}
                accept=".json,application/json"
                style={{ display: "none" }}
            />

            <div style={{ flexGrow: 1, overflow: "hidden" }}>
                <Canvas shadows onPointerMissed={handleCanvasPointerMissed}>
                    <Experience
                        currentMode={currentMode} // Pass down the explicit mode
                        selectedObjectToAdd={selectedObjectToAdd}
                        selectedObjectId={selectedObjectId} // Pass down selection
                        globalAge={globalAge}
                        brushSize={brushSize}
                        sceneLogicRef={sceneLogicRef}
                        onSelectObject={handleSelectObject}
                        onInteractionEnd={handleInteractionEnd}
                        getInitialObjectId={getNextObjectId}
                        showCoordinates={showCoordinates}
                        paintColor={paintColor}
                        sunAzimuth={sunAzimuth} // Pass down sun state
                        sunElevation={sunElevation} // Pass down sun state
                        terrainPaintMode={terrainPaintMode}
                        absolutePaintHeight={absolutePaintHeight}
                        currentMonth={currentMonth}
                        isOrthographic={isOrthographic}
                        showObjectNames={showObjectNames}
                    />
                </Canvas>
            </div>
        </div>
    );
}
