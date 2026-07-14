import { useRef, Suspense, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Target resting rotation: face mostly forward, very slight turn right
const REST_ROT_Y = -1.0;
const REST_ROT_X = 0.2;

// As the hero is scrolled past, the head turns from its right-facing
// rest pose over to a left-facing one — this is how far (in radians)
// that additional turn goes at full scroll progress.
const SCROLL_TURN_Y = -1.8;

const MODEL_Y_OFFSET = 0.15;
const MODEL_TARGET_SIZE = 1.9;

// ─── Holographic fresnel rim-light shader ─────────────────────────────
const RimVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vLocalY;
  void main() {
    vec4 worldPos = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-worldPos.xyz);
    vLocalY = position.y;
    gl_Position = projectionMatrix * worldPos;
  }
`;

const RimFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uIntensity;
  uniform float uFaceCenterY;
  uniform float uFaceSpread;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying float vLocalY;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vViewDir);
    float rim = 1.0 - max(dot(n, v), 0.0);
    rim = pow(rim, uPower) * uIntensity;

    // Only glow where the surface still faces broadly toward the camera —
    // suppresses the reconstructed side/back geometry (which has no real
    // detail) so the glow reads as an edge highlight on the face/shoulders
    // rather than lighting up the whole rough back of the bust.
    float facing = smoothstep(-0.15, 0.35, dot(n, v));
    rim *= facing;

    // Concentrate the glow at face height instead of spreading evenly
    // across hair/head-top and shoulders — fade almost fully to zero away
    // from face height so the visible glow shape itself sits lower/tighter,
    // not just dimmer.
    float heightFalloff = 1.0 - smoothstep(0.0, uFaceSpread * 2.0, abs(vLocalY - uFaceCenterY));
    rim *= mix(0.02, 1.0, heightFalloff);

    gl_FragColor = vec4(uColor, rim);
  }
`;

function RimGlow({ scene, scale, center }) {
  const materialRef = useRef();

  const rimMeshes = useMemo(() => {
    const meshes = [];
    scene.traverse((child) => {
      if (child.isMesh) {
        const mesh = new THREE.Mesh(child.geometry, null);
        mesh.matrixAutoUpdate = false;
        meshes.push({ mesh, sourceMatrixWorld: child.matrixWorld });
      }
    });
    return meshes;
  }, [scene]);

  // Estimate where the face sits in local mesh-space Y so the glow can be
  // concentrated there — a bust's face is near the top of its bounding box,
  // above the bulk of the shoulders/chest below it.
  const { faceCenterY, faceSpread } = useMemo(() => {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const { mesh } of rimMeshes) {
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      minY = Math.min(minY, bb.min.y);
      maxY = Math.max(maxY, bb.max.y);
    }
    const height = maxY - minY;
    return {
      faceCenterY: maxY - height * 0.38,
      faceSpread: height * 0.16,
    };
  }, [rimMeshes]);

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#00eaff') },
      uPower: { value: 2.6 },
      uIntensity: { value: 0.75 },
      uFaceCenterY: { value: faceCenterY },
      uFaceSpread: { value: faceSpread },
    }),
    [faceCenterY, faceSpread]
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      const pulse = 0.95 + Math.sin(clock.elapsedTime * 1.6) * 0.15;
      materialRef.current.uniforms.uIntensity.value = 0.75 * pulse;
    }
    // Keep rim meshes glued to the animated source geometry's world transform
    for (const { mesh, sourceMatrixWorld } of rimMeshes) {
      mesh.matrix.copy(sourceMatrixWorld);
    }
  });

  return (
    <group
      scale={[scale, scale, scale]}
      position={[-center.x * scale, -center.y * scale, -center.z * scale]}
    >
      {rimMeshes.map(({ mesh }, i) => (
        <primitive key={i} object={mesh}>
          <shaderMaterial
            ref={i === 0 ? materialRef : undefined}
            vertexShader={RimVertexShader}
            fragmentShader={RimFragmentShader}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.FrontSide}
          />
        </primitive>
      ))}
    </group>
  );
}

// ─── Round point sprite shader ─────────────────────────────────────────
// PointsMaterial renders square sprites by default; this discards pixels
// outside a circular mask (with a soft edge) so stars render as dots.
const StarVertexShader = /* glsl */ `
  uniform float uSize;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float dist = max(-mvPosition.z, 1.0);
    gl_PointSize = clamp(uSize * (14.0 / dist), 2.0, 6.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const StarFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.15, d) * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// ─── Reactive starfield ────────────────────────────────────────────────
// Multiple depth layers of points that rotate with drag (parallax) plus a
// slow constant drift, giving the sense of floating through a universe.
function Starfield({ dragState }) {
  const layerRefs = useRef([]);
  const orbitAngle = useRef(0);

  const layers = useMemo(() => {
    const defs = [
      { count: 900, radius: 5.5, size: 2.2, depthFactor: 1.6, drift: 0.06, color: '#bfefff' },
      { count: 700, radius: 8.5, size: 2.8, depthFactor: 1.0, drift: 0.04, color: '#7fd9ff' },
      { count: 500, radius: 13, size: 3.6, depthFactor: 0.55, drift: 0.025, color: '#3ab6ff' },
    ];

    return defs.map((def) => {
      const positions = new Float32Array(def.count * 3);
      for (let i = 0; i < def.count; i++) {
        // Uniform random distribution on a sphere shell
        const r = def.radius * (0.6 + Math.random() * 0.4);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      return { ...def, positions };
    });
  }, []);

  useFrame((state, delta) => {
    // Slow, constant orbital motion — always running, independent of drag.
    orbitAngle.current += delta * 0.18;

    layerRefs.current.forEach((group, i) => {
      if (!group) return;
      const def = layers[i];
      const orbit = orbitAngle.current * def.drift;

      // Parallax (from dragging the face) layered on top of a constant
      // slow circular orbit, scaled per-layer depth so closer layers move
      // less, distant layers sweep more — like wheeling through space.
      group.rotation.x = dragState.current.x * def.depthFactor * 0.35 + Math.sin(orbit) * 0.25;
      group.rotation.y = dragState.current.y * def.depthFactor * 0.35 + orbit;
      group.rotation.z = Math.cos(orbit) * 0.15;
    });
  });

  return (
    <>
      {layers.map((def, i) => (
        <group key={i} ref={(el) => (layerRefs.current[i] = el)}>
          <points>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={def.positions}
                count={def.positions.length / 3}
                itemSize={3}
              />
            </bufferGeometry>
            <shaderMaterial
              vertexShader={StarVertexShader}
              fragmentShader={StarFragmentShader}
              uniforms={{
                uColor: { value: new THREE.Color(def.color) },
                uOpacity: { value: 0.85 },
                uSize: { value: def.size },
              }}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </points>
        </group>
      ))}
    </>
  );
}

function HeadModel({ dragState, scrollProgress, onReady }) {
  const groupRef = useRef();
  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const currentRot = useRef({ x: REST_ROT_X, y: REST_ROT_Y });
  const idleTimer = useRef(null);
  const isReturning = useRef(false);

  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.style.cursor = 'grab';

    // Release the drag as soon as the pointer exits the canvas's bounds
    // (plus a little slack), even mid-drag over the rest of the page —
    // not just when it leaves the canvas element itself.
    function withinBounds(cx, cy) {
      const rect = canvas.getBoundingClientRect();
      const margin = 40;
      return (
        cx >= rect.left - margin &&
        cx <= rect.right + margin &&
        cy >= rect.top - margin &&
        cy <= rect.bottom + margin
      );
    }

    function onDown(e) {
      isDragging.current = true;
      isReturning.current = false;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      lastPointer.current = { x: cx, y: cy };
      velocity.current = { x: 0, y: 0 };
      if (idleTimer.current) clearTimeout(idleTimer.current);
      canvas.style.cursor = 'grabbing';
    }

    function onMove(e) {
      if (!isDragging.current) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;

      if (!withinBounds(cx, cy)) {
        onUp();
        return;
      }

      const dx = cx - lastPointer.current.x;
      const dy = cy - lastPointer.current.y;
      velocity.current.y = dx * 0.006;
      velocity.current.x = dy * 0.006;
      currentRot.current.x += dy * 0.006;
      currentRot.current.y += dx * 0.006;
      lastPointer.current = { x: cx, y: cy };
    }

    function onUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      canvas.style.cursor = 'grab';
      idleTimer.current = setTimeout(() => { isReturning.current = true; }, 2000);
    }

    // Listen on window so we can detect the pointer leaving the bounds even
    // when it moves fast enough to skip past the canvas edge in one frame.
    window.addEventListener('mousedown', onDown, { capture: true });
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);

    return () => {
      window.removeEventListener('mousedown', onDown, { capture: true });
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [gl]);

  const { scene } = useGLTF(`${import.meta.env.BASE_URL}head2_opt.glb`);

  // Suspense only renders this component once useGLTF's promise has
  // resolved, so reaching this point means the model is fully loaded —
  // let the page-level loading screen know it can dismiss.
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  const { scale, center } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = maxDim > 0 ? MODEL_TARGET_SIZE / maxDim : 1;
    return { scale, center };
  }, [scene]);

  // Mouse light position for the spotlight effect
  const lightRef = useRef();

  useFrame((state) => {
    if (!groupRef.current) return;

    // Move spotlight to follow mouse in world space
    if (lightRef.current) {
      const mx = state.pointer.x * 3;
      const my = state.pointer.y * 3;
      lightRef.current.position.set(mx, my, 3);
    }

    if (!isDragging.current) {
      if (isReturning.current) {
        // Smoothly lerp back to rest position
        currentRot.current.x += (REST_ROT_X - currentRot.current.x) * 0.05;
        currentRot.current.y += (REST_ROT_Y - currentRot.current.y) * 0.05;

        // Stop returning once close enough
        if (
          Math.abs(currentRot.current.x - REST_ROT_X) < 0.001 &&
          Math.abs(currentRot.current.y - REST_ROT_Y) < 0.001
        ) {
          currentRot.current.x = REST_ROT_X;
          currentRot.current.y = REST_ROT_Y;
          isReturning.current = false;
        }
      } else {
        // Apply inertia after release
        currentRot.current.x += velocity.current.x;
        currentRot.current.y += velocity.current.y;
        velocity.current.x *= 0.92;
        velocity.current.y *= 0.92;
      }
    }

    const scrollTurn = (scrollProgress?.current ?? 0) * SCROLL_TURN_Y;
    groupRef.current.rotation.x = currentRot.current.x;
    groupRef.current.rotation.y = currentRot.current.y + scrollTurn;

    // Publish rotation for the starfield parallax — includes the scroll
    // turn too, so the universe behind the head sweeps along with it
    // instead of staying independently on its own constant orbit.
    dragState.current.x = currentRot.current.x;
    dragState.current.y = currentRot.current.y + scrollTurn;
  });

  return (
    <group>
      <group
        ref={groupRef}
        scale={[scale, scale, scale]}
        position={[-center.x * scale, -center.y * scale + MODEL_Y_OFFSET, -center.z * scale]}
      >
        <primitive object={scene} />
      </group>

      <RimGlow scene={scene} scale={scale} center={center} />

      {/* Mouse-tracking spotlight */}
      <pointLight
        ref={lightRef}
        color="#4fd8ff"
        intensity={4}
        distance={7}
        decay={2}
        position={[0, 0, 3]}
      />
    </group>
  );
}

useGLTF.preload(`${import.meta.env.BASE_URL}head2_opt.glb`);

export default function HologramHead({ scrollProgress, onReady }) {
  const dragState = useRef({ x: REST_ROT_X, y: REST_ROT_Y });

  return (
    <div className="hologram-canvas-wrapper">
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        resize={{ scroll: false, offsetSize: true }}
      >
        <fog attach="fog" args={['#050a14', 6, 15]} />
        <ambientLight intensity={0.7} />
        <directionalLight color="#ffffff" intensity={1.6} position={[2, 2, 4]} />
        <directionalLight color="#ffffff" intensity={0.5} position={[-2, 1, 2]} />

        <Starfield dragState={dragState} />

        <Suspense fallback={null}>
          <HeadModel dragState={dragState} scrollProgress={scrollProgress} onReady={onReady} />
        </Suspense>
      </Canvas>
    </div>
  );
}
