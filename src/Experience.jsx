import { OrthographicCamera, PerspectiveCamera, Plane, OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import React, { useRef, useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import { getWorldYBase, DRAG_PLANE_OFFSET, HEIGHT_MODIFIER, CELL_SIZE } from "./PlanEditor";
import { SceneWithLogic } from "./SceneWithLogic";

// --- Experience Component (Handles R3F Context and Interactions based on Mode) ---
export function Experience({
    currentMode, // Explicit mode from PlanEditor
    selectedObjectToAdd, // NEW: Pass the selected configuration to add
    selectedObjectId, // Read-only, selection managed by PlanEditor via onSelectObject
    globalAge, brushSize, // Props for rendering/API
    sceneLogicRef, onSelectObject, onInteractionEnd, getInitialObjectId, showCoordinates, paintColor, sunAzimuth, sunElevation, terrainPaintMode, absolutePaintHeight, currentMonth, isOrthographic, showObjectNames,
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
    const handleObjectPointerDown = useCallback(
        (event, objectId, objectType) => {
            // Only handle if in 'select' mode
            if (currentMode !== "select") return;

            event.stopPropagation();
            onSelectObject(objectId); // Select the object
            const clickedObject = sceneLogicRef.current?.getObjectProperties(objectId);
            if (clickedObject) {
                const groundHeight = sceneLogicRef.current?.getGroundHeightAtWorld(
                    clickedObject.worldX,
                    clickedObject.worldZ
                ) ?? 0;
                // Set potential drag info
                setDraggingInfo({
                    id: objectId,
                    initialY: getWorldYBase(groundHeight) + DRAG_PLANE_OFFSET,
                    pointerId: event.pointerId,
                });
                if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
                event.target?.setPointerCapture(event.pointerId);
                console.log("Potential Drag Start:", objectId);
            }
        },
        [currentMode, onSelectObject, sceneLogicRef]
    ); // Add currentMode dependency

    const handleGridPointerDown = useCallback(
        (event, gridX, gridZ) => {
            if (draggingInfo || !sceneLogicRef.current) return; // Ignore grid clicks while dragging

            // --- Mode-Specific Actions ---
            if (selectedObjectToAdd) {
                event.stopPropagation(); // avoid adding multiple objects in parallel

                // TODO: this calculates relative to the ground plane, but should relative to the cell
                raycaster.setFromCamera(pointer, camera);
                const groundPlane = new THREE.Plane(
                    new THREE.Vector3(0, 1, 0),
                    0
                );
                const intersectionPoint = new THREE.Vector3();
                if (!raycaster.ray.intersectPlane(
                    groundPlane,
                    intersectionPoint
                ))
                    return;
                const worldX = intersectionPoint.x;
                const worldZ = intersectionPoint.z;

                // Create object using data from selectedObjectToAdd
                const newObjectData = {
                    id: getInitialObjectId(),
                    type: selectedObjectToAdd.type,
                    name: selectedObjectToAdd.name,
                    configName: selectedObjectToAdd.name,
                    worldX,
                    worldZ,
                    ...selectedObjectToAdd.props, // Spread the predefined properties
                };
                sceneLogicRef.current.addObject(newObjectData);
                onInteractionEnd(); // Reset mode/selection after adding
            } else if (currentMode === "terrain") {
                event.stopPropagation();
                setIsPaintingTerrain(true);
                const dir = event.shiftKey ? -1 : 1;
                setPaintDirection(dir);

                // Call applyTerrainBrush with mode and target height
                sceneLogicRef.current.applyTerrainBrush(
                    gridX,
                    gridZ,
                    HEIGHT_MODIFIER * dir, // deltaHeight (used in relative mode)
                    terrainPaintMode,
                    absolutePaintHeight // Pass mode and target
                );
                event.target?.setPointerCapture(event.pointerId);
                if (orbitControlsRef.current)
                    orbitControlsRef.current.enabled = false;
                console.log("Paint Start");
            } else if (currentMode === "select") {
                // Click on grid in select mode deselects any selected object
                onSelectObject(null);
            } else if (currentMode === "paint-color") {
                event.stopPropagation();
                setIsPaintingColor(true);
                sceneLogicRef.current?.updateCellColor(
                    gridX,
                    gridZ,
                    paintColor
                ); // Paint the clicked cell
                event.target?.setPointerCapture(event.pointerId);
                if (orbitControlsRef.current)
                    orbitControlsRef.current.enabled = false;
            }
        },
        [
            currentMode,
            selectedObjectToAdd,
            draggingInfo,
            brushSize,
            sceneLogicRef,
            onInteractionEnd,
            onSelectObject,
            getInitialObjectId,
            raycaster,
            pointer,
            camera,
            gl,
            paintColor,
            terrainPaintMode,
            absolutePaintHeight,
        ]
    ); // Added currentMode

    const handlePointerMove = useCallback(
        (event) => {
            pointerRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
            pointerRef.current.y =
                -(event.clientY / window.innerHeight) * 2 + 1;
            if (!sceneLogicRef.current) return;

            // If dragging, disable controls on first move
            if (draggingInfo &&
                orbitControlsRef.current &&
                orbitControlsRef.current.enabled) {
                orbitControlsRef.current.enabled = false;
                console.log("Drag detected, disabling controls.");
            }

            // --- Handle actual drag or paint based on state ---
            raycaster.setFromCamera(pointerRef.current, camera);

            if (draggingInfo && dragPlaneRef.current) {
                // Actual drag is happening
                const intersects = raycaster.intersectObject(
                    dragPlaneRef.current
                );
                if (intersects.length > 0) {
                    const point = intersects[0].point;
                    sceneLogicRef.current.updateObjectPositionWorld(
                        draggingInfo.id,
                        point.x,
                        point.z
                    );
                }
            } else if (isPaintingTerrain) {
                // Painting is happening (implicitly, currentMode must be 'terrain')
                const { gridWidth, gridHeight } = sceneLogicRef.current.getGridDimensions();
                const groundPlane = new THREE.Plane(
                    new THREE.Vector3(0, 1, 0),
                    0
                );
                const intersectionPoint = new THREE.Vector3();
                if (raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
                    const gridX = Math.floor(
                        intersectionPoint.x / CELL_SIZE + gridWidth / 2
                    );
                    const gridZ = Math.floor(
                        intersectionPoint.z / CELL_SIZE + gridHeight / 2
                    );
                    if (gridX >= 0 &&
                        gridX < gridWidth &&
                        gridZ >= 0 &&
                        gridZ < gridHeight) {
                        // Call applyTerrainBrush with mode and target height
                        sceneLogicRef.current.applyTerrainBrush(
                            gridX,
                            gridZ,
                            HEIGHT_MODIFIER * paintDirection, // deltaHeight (used in relative mode)
                            terrainPaintMode,
                            absolutePaintHeight // Pass mode and target
                        );
                    }
                }
            } else if (isPaintingColor) {
                // Painting color
                const { gridWidth, gridHeight } = sceneLogicRef.current.getGridDimensions();
                const groundPlane = new THREE.Plane(
                    new THREE.Vector3(0, 1, 0),
                    0
                );
                const intersectionPoint = new THREE.Vector3();
                if (raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
                    const gridX = Math.floor(
                        intersectionPoint.x / CELL_SIZE + gridWidth / 2
                    );
                    const gridZ = Math.floor(
                        intersectionPoint.z / CELL_SIZE + gridHeight / 2
                    );
                    if (gridX >= 0 &&
                        gridX < gridWidth &&
                        gridZ >= 0 &&
                        gridZ < gridHeight) {
                        sceneLogicRef.current.updateCellColor(
                            gridX,
                            gridZ,
                            paintColor
                        );
                    } // Paint cell under pointer
                }
            }
        },
        [
            draggingInfo,
            isPaintingTerrain,
            isPaintingColor,
            paintDirection,
            raycaster,
            camera,
            sceneLogicRef,
            paintColor,
            terrainPaintMode,
            absolutePaintHeight,
        ]
    );

    const handlePointerUp = useCallback(
        (event) => {
            console.log("Pointer up");
            const pointerId = event.pointerId;

            if (draggingInfo) {
                // A drag actually occurred
                console.log("Pointer Up - Drag End");
                gl.domElement.releasePointerCapture?.(pointerId); // Release capture first
                setDraggingInfo(null);
                if (orbitControlsRef.current)
                    orbitControlsRef.current.enabled = true;
            } else if (isPaintingTerrain) {
                // Painting ended
                console.log("Pointer Up - Paint End");
                setIsPaintingTerrain(false);
                if (orbitControlsRef.current)
                    orbitControlsRef.current.enabled = true;
                gl.domElement.releasePointerCapture?.(pointerId);
            } else if (isPaintingColor) {
                // Color painting ended
                console.log("Pointer Up - Color Paint End");
                setIsPaintingColor(false);
                if (orbitControlsRef.current)
                    orbitControlsRef.current.enabled = true;
                gl.domElement.releasePointerCapture?.(pointerId);
            }
        },
        [draggingInfo, isPaintingTerrain, isPaintingColor, gl]
    );

    // Effect to add/remove global listeners
    useEffect(() => {
        const domElement = gl.domElement;
        const moveHandler = (event) => handlePointerMove(event);
        const upHandler = (event) => handlePointerUp(event);
        // Listen if dragging, actually dragging, or painting
        if (draggingInfo || isPaintingTerrain || isPaintingColor) {
            domElement.addEventListener("pointermove", moveHandler);
            domElement.addEventListener("pointerup", upHandler);
        }
        return () => {
            domElement.removeEventListener("pointermove", moveHandler);
            domElement.removeEventListener("pointerup", upHandler);
            if (orbitControlsRef.current)
                orbitControlsRef.current.enabled = true; // Ensure re-enabled
        };
    }, [
        draggingInfo,
        isPaintingTerrain,
        isPaintingColor,
        handlePointerMove,
        handlePointerUp,
        gl,
    ]);

    return (
        <>
            {/* Conditionally Render Cameras */}
            {isOrthographic ? (
                <OrthographicCamera
                    makeDefault
                    position={[0, 50, 0]} // Position directly above center
                    zoom={50} // Adjust initial zoom level (smaller value = more zoomed in)
                    near={0.1}
                    far={1000} />
            ) : (
                <PerspectiveCamera
                    makeDefault
                    position={[15, 20, 25]} // Default perspective position
                    fov={60} />
            )}
            <SceneWithLogic
                ref={sceneLogicRef}
                selectedObjectId={selectedObjectId}
                globalAge={globalAge}
                brushSize={brushSize}
                onObjectSelect={onSelectObject}
                onObjectPointerDown={handleObjectPointerDown}
                onGridPointerDown={handleGridPointerDown}
                showCoordinates={showCoordinates}
                onInteractionEnd={onInteractionEnd}
                sunAzimuth={sunAzimuth}
                sunElevation={sunElevation} // Pass down for Add/Resize
                terrainPaintMode={terrainPaintMode}
                absolutePaintHeight={absolutePaintHeight}
                currentMonth={currentMonth}
                showObjectNames={showObjectNames} />
            {draggingInfo && (
                <Plane
                    ref={dragPlaneRef}
                    args={[10000, 10000]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, draggingInfo.initialY, 0]}
                    visible={false} />
            )}
            {/* Disable controls only when actually dragging or painting */}
            <OrbitControls
                ref={orbitControlsRef}
                enabled={!draggingInfo && !isPaintingTerrain}
                makeDefault />
        </>
    );
}
