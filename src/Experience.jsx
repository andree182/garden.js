import { OrthographicCamera, PerspectiveCamera, Plane, OrbitControls } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
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
    onObjectPropertyUpdate,
    isShiftPressed,
    onHoverUpdate
}) {
    const { raycaster, pointer, camera, gl } = useThree();
    const orbitControlsRef = useRef();
    const dragPlaneRef = useRef();

    // --- Interaction State ---
    const [draggingInfo, setDraggingInfo] = useState(null);
    const [isPaintingTerrain, setIsPaintingTerrain] = useState(false);
    const [isPaintingColor, setIsPaintingColor] = useState(false);
    const [paintDirection, setPaintDirection] = useState(1);
    const [localHoveredPoint, setLocalHoveredPoint] = useState(null);
    const showCoordsDuringDrag = useRef(false);
    const suppressShiftCoords = useRef(false);
    const pointerRef = useRef({ x: 0, y: 0 });
    const ROTATION_SENSITIVITY = 1;

    // --- Camera Sync State ---
    const lastCameraState = useRef({
        target: new THREE.Vector3(0, 0, 0),
        position: new THREE.Vector3(15, 20, 25),
        zoom: 50,
        distance: 35,
        initialized: false
    });

    useFrame((state) => {
        if (orbitControlsRef.current) {
            const controls = orbitControlsRef.current;
            lastCameraState.current.target.copy(controls.target);
            lastCameraState.current.position.copy(state.camera.position);
            lastCameraState.current.zoom = state.camera.zoom;
            lastCameraState.current.distance = state.camera.position.distanceTo(controls.target);
            lastCameraState.current.initialized = true;
        }
    });

    useEffect(() => {
        if (!orbitControlsRef.current || !lastCameraState.current.initialized) return;

        const controls = orbitControlsRef.current;
        const state = lastCameraState.current;

        if (isOrthographic) {
            // Transitioning from Perspective to Orthographic
            controls.target.copy(state.target);
            
            // Calculate equivalent zoom for OrthographicCamera based on last perspective distance
            const calculatedZoom = Math.max(5, Math.min(200, 1500 / state.distance));
            camera.zoom = calculatedZoom;
            
            // Place orthographic camera directly above the target (slightly offset in Z to avoid gimbal lock)
            camera.position.set(state.target.x, state.target.y + 50, state.target.z + 0.01);
            camera.updateProjectionMatrix();
            controls.update();
        } else {
            // Transitioning from Orthographic to Perspective
            controls.target.copy(state.target);
            
            // Calculate perspective distance based on orthographic zoom
            const calculatedDistance = Math.max(5, Math.min(200, 1500 / state.zoom));
            
            // Place perspective camera at a nice default angle from target
            const dir = new THREE.Vector3(15, 20, 25).normalize();
            camera.position.copy(state.target).addScaledVector(dir, calculatedDistance);
            camera.updateProjectionMatrix();
            controls.update();
        }
    }, [isOrthographic, camera]);

    useEffect(() => {
        if (!isShiftPressed) {
            suppressShiftCoords.current = false;
            setLocalHoveredPoint(null);
            onHoverUpdate?.(null);
        }
    }, [isShiftPressed, onHoverUpdate]);

    // --- Event Handlers (Now strictly check currentMode) ---
    const handleObjectPointerDown = useCallback(
        (event, objectId, objectType) => {
            //console.log("OBJECT", event, objectId, objectType);
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
                    startRotationY: clickedObject.rotationY || 0,
                    startX: event.clientX,
                });
                showCoordsDuringDrag.current = event.shiftKey || isShiftPressed;
                if (orbitControlsRef.current) orbitControlsRef.current.enabled = false;
                event.target?.setPointerCapture(event.pointerId);
                console.log("Potential Drag Start:", objectId);
            }
        },
        [currentMode, onSelectObject, sceneLogicRef]
    ); // Add currentMode dependency

    const handleGridPointerDown = useCallback(
        (event, gridX, gridZ) => {
            //console.log("GRID", event, gridX, gridZ);
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
                // onInteractionEnd(); // Keep the object selection for further placing (do not reset mode/selection after adding)
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
            // console.log("move", event);
            pointerRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
            pointerRef.current.y =
                -(event.clientY / window.innerHeight) * 2 + 1;
            if (!sceneLogicRef.current) return;

            const ctrlPressed = event.ctrlKey;

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
                if (ctrlPressed) {
                    const deltaX = event.clientX - draggingInfo.startX;
                    const rotationChange = deltaX * ROTATION_SENSITIVITY;
                    const newRotationY = (draggingInfo.startRotationY + rotationChange) % 360;
                    sceneLogicRef.current.updateObjectRotationY(draggingInfo.id, newRotationY);
                    onObjectPropertyUpdate(draggingInfo.id, 'rotationY', newRotationY);
                } else {
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
                        const dir = paintDirection;
                        sceneLogicRef.current.applyTerrainBrush(
                            gridX,
                            gridZ,
                            HEIGHT_MODIFIER * dir, // deltaHeight (used in relative mode)
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

            // --- Coordinate Ruler (when Shift is pressed or Dragging) ---
            if (draggingInfo) {
                if (showCoordsDuringDrag.current) {
                    const objProps = sceneLogicRef.current.getObjectProperties(draggingInfo.id);
                    if (objProps) {
                        const height = sceneLogicRef.current.getGroundHeightAtWorld(objProps.worldX, objProps.worldZ);
                        const point = new THREE.Vector3(objProps.worldX, height, objProps.worldZ);
                        setLocalHoveredPoint(point);
                        onHoverUpdate?.({ x: point.x, y: point.y, z: point.z });
                    }
                } else {
                    if (localHoveredPoint) setLocalHoveredPoint(null);
                    onHoverUpdate?.(null);
                }
            } else if (isShiftPressed && !suppressShiftCoords.current) {
                const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                const intersectionPoint = new THREE.Vector3();
                if (raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
                    const height = sceneLogicRef.current.getGroundHeightAtWorld(intersectionPoint.x, intersectionPoint.z);
                    intersectionPoint.y = height;
                    setLocalHoveredPoint(intersectionPoint.clone());
                    onHoverUpdate?.({ x: intersectionPoint.x, y: intersectionPoint.y, z: intersectionPoint.z });
                } else {
                    setLocalHoveredPoint(null);
                    onHoverUpdate?.(null);
                }
            } else {
                if (localHoveredPoint) setLocalHoveredPoint(null);
                onHoverUpdate?.(null);
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
            onObjectPropertyUpdate,
            isShiftPressed,
            onHoverUpdate,
            localHoveredPoint
        ]
    );

    const handlePointerUp = useCallback(
        (event) => {
            // console.log("Pointer up", event);
            const pointerId = event.pointerId;

            if (draggingInfo) {
                // A drag actually occurred
                console.log("Pointer Up - Drag End");
                gl.domElement.releasePointerCapture?.(pointerId); // Release capture first
                setDraggingInfo(null);
                if (orbitControlsRef.current)
                    orbitControlsRef.current.enabled = true;
                
                // Hide coords after drag ends (independent of Shift key state)
                showCoordsDuringDrag.current = false;
                suppressShiftCoords.current = true;
                setLocalHoveredPoint(null);
                onHoverUpdate?.(null);
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
                minPolarAngle={isOrthographic ? 0.01 : 0}
                maxPolarAngle={isOrthographic ? 0.01 : Math.PI / 2.1}
                makeDefault />

            {/* 3D Coordinate Ruler Overlay */}
            {isShiftPressed && localHoveredPoint && (
                <group>
                    {/* X-axis ruler line (red) */}
                    <mesh position={[0, localHoveredPoint.y + 0.02, localHoveredPoint.z]} scale={[100, 0.01, 0.01]}>
                        <boxGeometry />
                        <meshBasicMaterial color="#ff3333" transparent opacity={0.5} depthWrite={false} />
                    </mesh>
                    
                    {/* Z-axis ruler line (blue) */}
                    <mesh position={[localHoveredPoint.x, localHoveredPoint.y + 0.02, 0]} scale={[0.01, 0.01, 100]}>
                        <boxGeometry />
                        <meshBasicMaterial color="#3333ff" transparent opacity={0.5} depthWrite={false} />
                    </mesh>

                    {/* Vertical height ruler line to Y=0 (green) */}
                    {localHoveredPoint.y > 0.01 && (
                        <mesh position={[localHoveredPoint.x, localHoveredPoint.y / 2, localHoveredPoint.z]} scale={[0.01, localHoveredPoint.y, 0.01]}>
                            <boxGeometry />
                            <meshBasicMaterial color="#00ff66" transparent opacity={0.7} depthWrite={false} />
                        </mesh>
                    )}
                </group>
            )}
        </>
    );
}
