import * as THREE from 'three'
import { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PivotControls } from '@react-three/drei'
import { Geometry, Base, Subtraction, Addition } from '@react-three/csg'

import { useFrame } from '@react-three/fiber';

export function Ground(props) {
  const [heightmap, setHeightmap] = useState(Array(128).fill().map(() => Array(128).fill(0)));
  const meshRef = useRef(null);

  useFrame(() => {
    if (meshRef.current) {
      const geometry = meshRef.current.geometry;
      geometry.vertices = [];
      for (let y = 0; y < 128; y++) {
        for (let x = 0; x < 128; x++) {
          geometry.vertices.push(x * 0.1 - 6.4, y * 0.1 - 6.4, heightmap[y][x] * 0.01);
        }
      }
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
    }
  });

  const handleClick = (event) => {
    const raycaster = new THREE.Raycaster();
    const mousePosition = new THREE.Vector2();
    mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mousePosition, camera);
    const intersects = raycaster.intersectObject(meshRef.current);
    if (intersects.length > 0) {
      const x = Math.floor(intersects[0].point.x / 0.1 + 64);
      const y = Math.floor(intersects[0].point.z / 0.1 + 64);
      setHeightmap(prevHeightmap => {
        const newHeightmap = [...prevHeightmap];
        newHeightmap[y] = [...newHeightmap[y]];
        newHeightmap[y][x] = Math.min(newHeightmap[y][x] + 1, 255);
        return newHeightmap;
      });
    }
  };

  const handleScroll = (event) => {
    const raycaster = new THREE.Raycaster();
    const mousePosition = new THREE.Vector2();
    mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mousePosition, camera);
    const intersects = raycaster.intersectObject(meshRef.current);
    if (intersects.length > 0) {
      const x = Math.floor(intersects[0].point.x / 0.1 + 64);
      const y = Math.floor(intersects[0].point.z / 0.1 + 64);
      setHeightmap(prevHeightmap => {
        const newHeightmap = [...prevHeightmap];
        newHeightmap[y] = [...newHeightmap[y]];
        newHeightmap[y][x] = Math.max(newHeightmap[y][x] - (event.deltaY < 0 ? -1 : 1), 0);
        return newHeightmap;
      });
    }
  };

  return (
    <mesh ref={meshRef} onClick={handleClick} onWheel={handleScroll}>
      <planeGeometry args={[12.8, 12.8, 128, 128]} />
      <meshBasicMaterial wireframe color="red" />
    </mesh>
  );
}