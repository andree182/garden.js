import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// Main App Component
export default function App() {
  const [editMode, setEditMode] = useState('height'); // 'height' or 'color'
  const [selectedColor, setSelectedColor] = useState('#228b22'); // forestgreen
  const [brushSize, setBrushSize] = useState(2);
  const [brushStrength, setBrushStrength] = useState(0.5);
  const [gridSize, setGridSize] = useState(50);
  const [showSettings, setShowSettings] = useState(false);
  const terrainRef = useRef(null);

  // Function to handle terrain saving
  const handleSaveTerrain = () => {
    if (!terrainRef.current) return;
    
    const terrainData = terrainRef.current.getTerrainData();
    const blob = new Blob([JSON.stringify(terrainData)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'terrain.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Function to handle terrain loading
  const handleLoadTerrain = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const terrainData = JSON.parse(event.target.result);
        if (terrainData && terrainRef.current) {
          // Update grid size if different
          if (terrainData.gridSize !== gridSize) {
            setGridSize(terrainData.gridSize);
          }
          
          // Load terrain data after a small delay to ensure grid size is updated
          setTimeout(() => {
            terrainRef.current.loadTerrainData(terrainData);
          }, 100);
        }
      } catch (err) {
        console.error('Failed to parse terrain data:', err);
        alert('Invalid terrain file!');
      }
    };
    reader.readAsText(file);
  };
  
  // Function to handle grid size change
  const handleGridSizeChange = (newSize) => {
    setGridSize(parseInt(newSize));
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <Canvas shadows className="absolute inset-0">
        <PerspectiveCamera makeDefault position={[10, 15, 10]} />
        <Sky sunPosition={[100, 10, 100]} />
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={1} 
          castShadow 
          shadow-mapSize-width={1024} 
          shadow-mapSize-height={1024} 
        />
        
        <TerrainEditor 
          ref={terrainRef}
          editMode={editMode}
          selectedColor={selectedColor}
          brushSize={brushSize}
          brushStrength={brushStrength}
          gridSize={gridSize}
        />
        
        <OrbitControls 
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 2 - 0.1} 
          minDistance={5} 
          maxDistance={50}
        />
      </Canvas>
      
      {/* Floating UI Controls */}
      <div className="absolute top-4 left-4 p-4 bg-black bg-opacity-50 text-white rounded shadow-lg transition-all duration-300 ease-in-out" 
           style={{ 
             maxWidth: '300px',
             transform: showSettings ? 'translateY(0)' : 'translateY(-80%)',
             maxHeight: showSettings ? '80vh' : '80px',
             overflow: 'hidden auto'
           }}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl">Terrain Editor</h2>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded"
          >
            {showSettings ? 'Hide' : 'Show'}
          </button>
        </div>
        
        {/* Import/Export buttons - always visible */}
        <div className="flex gap-2 mb-4">
          <button 
            onClick={handleSaveTerrain}
            className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded"
          >
            Save
          </button>
          
          <label className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded cursor-pointer">
            Load
            <input 
              type="file" 
              accept=".json" 
              onChange={handleLoadTerrain}
              className="hidden" 
            />
          </label>
        </div>
        
        {/* Settings - only visible when showSettings is true */}
        <div className={`transition-opacity duration-300 ${showSettings ? 'opacity-100' : 'opacity-0'}`}>
          <div className="mb-4">
            <h3 className="font-bold">Canvas Size</h3>
            <select 
              value={gridSize} 
              onChange={(e) => handleGridSizeChange(e.target.value)}
              className="w-full bg-gray-700 p-1 rounded"
            >
              <option value="25">25 x 25</option>
              <option value="50">50 x 50</option>
              <option value="75">75 x 75</option>
              <option value="100">100 x 100</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Note: Changing size resets the terrain
            </p>
          </div>
          
          <div className="mb-4">
            <h3 className="font-bold">Edit Mode</h3>
            <div className="flex gap-2">
              <button 
                onClick={() => setEditMode('height')}
                className={`px-2 py-1 rounded ${editMode === 'height' ? 'bg-blue-500' : 'bg-gray-700'}`}
              >
                Height
              </button>
              <button 
                onClick={() => setEditMode('color')}
                className={`px-2 py-1 rounded ${editMode === 'color' ? 'bg-blue-500' : 'bg-gray-700'}`}
              >
                Color
              </button>
            </div>
            {editMode === 'height' && (
              <p className="text-xs text-gray-300 mt-1">
                Left click to raise, right click to lower terrain
              </p>
            )}
          </div>
          
          {editMode === 'color' && (
            <div className="mb-4">
              <h3 className="font-bold">Color</h3>
              <input 
                type="color" 
                value={selectedColor} 
                onChange={(e) => setSelectedColor(e.target.value)} 
                className="w-full"
              />
            </div>
          )}
          
          <div className="mb-4">
            <h3 className="font-bold">Brush Size: {brushSize}</h3>
            <input 
              type="range" 
              min="1" 
              max="5" 
              step="1" 
              value={brushSize} 
              onChange={(e) => setBrushSize(parseInt(e.target.value))} 
              className="w-full"
            />
          </div>
          
          <div className="mb-4">
            <h3 className="font-bold">Brush Strength: {brushStrength.toFixed(1)}</h3>
            <input 
              type="range" 
              min="0.1" 
              max="1" 
              step="0.1" 
              value={brushStrength} 
              onChange={(e) => setBrushStrength(parseFloat(e.target.value))} 
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Terrain Editor Component
const TerrainEditor = React.forwardRef(({ editMode, selectedColor, brushSize, brushStrength, gridSize }, ref) => {
  const meshRef = useRef();
  const heightMapRef = useRef([]);
  const colorMapRef = useRef([]);
  const mousePosition = useRef({ x: 0, y: 0 });
  const isLeftMouseDown = useRef(false);
  const isRightMouseDown = useRef(false);
  const raycaster = new THREE.Raycaster();
  const { camera, gl } = useThree();
  
  // Default tree positions - will be adjusted based on gridSize
  const [trees, setTrees] = useState([]);
  
  // Update trees when grid size changes
  useEffect(() => {
    // Generate trees based on grid size
    const newTrees = [
      { position: [gridSize * 0.2, 0, gridSize * 0.2], scale: 1.2 },
      { position: [gridSize * 0.3, 0, gridSize * 0.4], scale: 0.8 },
      { position: [gridSize * 0.5, 0, gridSize * 0.3], scale: 1.0 },
      { position: [gridSize * 0.6, 0, gridSize * 0.7], scale: 1.5 },
      { position: [gridSize * 0.1, 0, gridSize * 0.7], scale: 0.9 },
    ];
    setTrees(newTrees);
  }, [gridSize]);

  // Initialize height map with sine waves
  useEffect(() => {
    initializeTerrain();
  }, [gridSize]);
  
  // Initialize terrain with default values
  const initializeTerrain = () => {
    const newHeightMap = new Array(gridSize * gridSize).fill(0);
    const newColorMap = new Array(gridSize * gridSize).fill('#3a7e4f');
    
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const i = x + z * gridSize;
        
        // Create sine wave pattern
        const height = 
          Math.sin(x / (gridSize * 0.1)) * Math.cos(z / (gridSize * 0.1)) * 1.5 + 
          Math.sin(x / (gridSize * 0.2) + z / (gridSize * 0.16)) * 1.0;
          
        newHeightMap[i] = height;
        
        // Update colors based on height
        if (height > 1.5) {
          newColorMap[i] = '#aaaaaa'; // Peaks (light gray)
        } else if (height > 0.5) {
          newColorMap[i] = '#3a7e4f'; // High ground (darker green)
        } else if (height > -0.5) {
          newColorMap[i] = '#68a357'; // Mid level (medium green)
        } else {
          newColorMap[i] = '#76b74a'; // Low areas (lighter green)
        }
      }
    }
    
    heightMapRef.current = newHeightMap;
    colorMapRef.current = newColorMap;
    updateGeometry();
  };

  // Expose functions to parent component through ref
  useEffect(() => {
    if (ref) {
      ref.current = {
        getTerrainData: () => ({
          gridSize,
          heightMap: heightMapRef.current,
          colorMap: colorMapRef.current,
          trees: trees.map(tree => ({
            position: tree.position,
            scale: tree.scale
          }))
        }),
        loadTerrainData: (data) => {
          if (data.gridSize === gridSize) {
            heightMapRef.current = data.heightMap;
            colorMapRef.current = data.colorMap;
            if (data.trees) {
              setTrees(data.trees);
            }
            updateGeometry();
          } else {
            console.warn("Grid size mismatch when loading terrain data");
          }
        }
      };
    }
  }, [ref, gridSize, trees]);

  // Update the terrain geometry based on the height map
  const updateGeometry = () => {
    if (!meshRef.current) return;
    
    const geometry = meshRef.current.geometry;
    const position = geometry.attributes.position;
    const colors = geometry.attributes.color;
    
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      
      // Only update vertices that form the top of the terrain
      if (Math.abs(position.getY(i)) < 0.01 || position.getY(i) > 0) {
        // Get the height map index
        const hx = Math.floor(x + gridSize / 2);
        const hz = Math.floor(z + gridSize / 2);
        
        if (hx >= 0 && hx < gridSize && hz >= 0 && hz < gridSize) {
          const idx = hx + hz * gridSize;
          position.setY(i, heightMapRef.current[idx]);
          
          // Update colors
          const color = new THREE.Color(colorMapRef.current[idx]);
          colors.setXYZ(i, color.r, color.g, color.b);
        }
      }
    }
    
    position.needsUpdate = true;
    colors.needsUpdate = true;
    geometry.computeVertexNormals();
  };
  
  // Function to modify terrain at a given point
  const modifyTerrain = (point, isRaising) => {
    // Convert world position to grid coordinates
    const gridX = Math.floor(point.x + gridSize / 2);
    const gridZ = Math.floor(point.z + gridSize / 2);
    
    if (gridX >= 0 && gridX < gridSize && gridZ >= 0 && gridZ < gridSize) {
      // Update in a brush radius
      for (let bx = -brushSize; bx <= brushSize; bx++) {
        for (let bz = -brushSize; bz <= brushSize; bz++) {
          const tx = gridX + bx;
          const tz = gridZ + bz;
          
          // Check if within brush circle and grid bounds
          if (
            Math.sqrt(bx * bx + bz * bz) <= brushSize &&
            tx >= 0 && tx < gridSize && tz >= 0 && tz < gridSize
          ) {
            const strength = 
              brushStrength * (1 - Math.sqrt(bx * bx + bz * bz) / brushSize);
            const idx = tx + tz * gridSize;
            
            if (editMode === 'height') {
              // Raise or lower height based on which mouse button is pressed
              const heightChange = strength * 0.1 * (isRaising ? 1 : -1);
              heightMapRef.current[idx] += heightChange;
            } else if (editMode === 'color') {
              // Modify color
              colorMapRef.current[idx] = selectedColor;
            }
          }
        }
      }
      
      updateGeometry();
    }
  };

  // Handle mouse interactions for terrain editing
  useFrame(() => {
    const intersects = raycaster.intersectObject(meshRef.current);
    
    if (intersects.length > 0) {
      const point = intersects[0].point;
      
      if (isLeftMouseDown.current && editMode === 'height') {
        // Left mouse button - raise terrain
        modifyTerrain(point, true);
      } else if (isRightMouseDown.current && editMode === 'height') {
        // Right mouse button - lower terrain
        modifyTerrain(point, false);
      } else if (isLeftMouseDown.current && editMode === 'color') {
        // Left mouse button for color mode
        modifyTerrain(point, true); // isRaising doesn't matter for color
      }
    }
  });

  // Initialize the terrain mesh and mouse events
  useEffect(() => {
    if (!meshRef.current) return;
    
    const handlePointerDown = (e) => {
      // Prevent context menu on right-click
      if (e.button === 2) {
        e.preventDefault();
        isRightMouseDown.current = true;
      } else {
        isLeftMouseDown.current = true;
      }
      updateRaycaster(e);
    };
    
    const handlePointerUp = (e) => {
      if (e.button === 2) {
        isRightMouseDown.current = false;
      } else {
        isLeftMouseDown.current = false;
      }
    };
    
    const handlePointerMove = (e) => {
      updateRaycaster(e);
    };
    
    const handleContextMenu = (e) => {
      // Prevent the context menu from appearing on right-click
      e.preventDefault();
    };
    
    const updateRaycaster = (e) => {
      // Calculate mouse position in normalized device coordinates (-1 to +1)
      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();
      mousePosition.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mousePosition.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Update the raycaster
      raycaster.setFromCamera(mousePosition.current, camera);
    };
    
    const domElement = gl.domElement;
    domElement.addEventListener('pointerdown', handlePointerDown);
    domElement.addEventListener('pointerup', handlePointerUp);
    domElement.addEventListener('pointermove', handlePointerMove);
    domElement.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
      domElement.removeEventListener('pointerup', handlePointerUp);
      domElement.removeEventListener('pointermove', handlePointerMove);
      domElement.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [gl, camera, editMode]);

  // Create a grid geometry for the terrain
  const createTerrainGeometry = () => {
    const geometry = new THREE.PlaneGeometry(
      gridSize, 
      gridSize, 
      gridSize - 1, 
      gridSize - 1
    );
    
    // Rotate to horizontal plane
    geometry.rotateX(-Math.PI / 2);
    
    // Initialize colors attribute
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return geometry;
  };

  // Adjust tree positions based on height map
  const adjustTreePosition = (position) => {
    const [x, y, z] = position;
    
    const gridX = Math.floor(x + gridSize / 2);
    const gridZ = Math.floor(z + gridSize / 2);
    
    if (gridX >= 0 && gridX < gridSize && gridZ >= 0 && gridZ < gridSize) {
      const height = heightMapRef.current[gridX + gridZ * gridSize];
      return [x, height, z];
    }
    
    return position;
  };

  return (
    <group>
      {/* Terrain Mesh */}
      <mesh 
        ref={meshRef} 
        receiveShadow
      >
        <primitive object={createTerrainGeometry()} attach="geometry" />
        <meshStandardMaterial 
          vertexColors 
          side={THREE.DoubleSide} 
          roughness={0.8}
        />
      </mesh>
      
      {/* Tree Objects */}
      {trees.map((tree, i) => (
        <Tree 
          key={i} 
          position={adjustTreePosition(tree.position)} 
          scale={tree.scale} 
        />
      ))}
    </group>
  );
});

// Simple Tree Component
function Tree({ position, scale = 1 }) {
  const treeRef = useRef();
  
  useEffect(() => {
    if (treeRef.current) {
      treeRef.current.position.set(position[0], position[1], position[2]);
    }
  }, [position]);

  return (
    <group ref={treeRef} scale={[scale, scale, scale]}>
      {/* Tree trunk */}
      <mesh castShadow receiveShadow position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.2, 0.3, 1.5, 8]} />
        <meshStandardMaterial color="#8b4513" roughness={0.9} />
      </mesh>
      
      {/* Tree foliage */}
      <mesh castShadow position={[0, 2, 0]}>
        <coneGeometry args={[1, 2.5, 8]} />
        <meshStandardMaterial color="#2e8b57" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 3, 0]}>
        <coneGeometry args={[0.7, 1.5, 8]} />
        <meshStandardMaterial color="#228b22" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 3.8, 0]}>
        <coneGeometry args={[0.4, 1, 8]} />
        <meshStandardMaterial color="#006400" roughness={0.8} />
      </mesh>
    </group>
  );
}
