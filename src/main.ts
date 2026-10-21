import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  classifyTerrain,
  generateWorld,
  heightAt,
  slopeAt,
  type BiomeId,
  type GeneratedWorld,
  type PackPart,
  type TerrainClass,
} from "./model";
import "./style.css";

const TERRAIN_SEGMENTS = 128;

function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing required element #${id}`);
  return node as T;
}

const viewport = element<HTMLDivElement>("viewport");
const failure = element<HTMLDivElement>("webgl-failure");
const status = element<HTMLOutputElement>("status");
const form = element<HTMLFormElement>("controls");
const seedInput = element<HTMLInputElement>("seed");
const biomeSelect = element<HTMLSelectElement>("biome");
const reliefInput = element<HTMLInputElement>("relief");
const densityInput = element<HTMLInputElement>("density");
const reliefValue = element<HTMLOutputElement>("relief-value");
const densityValue = element<HTMLOutputElement>("density-value");
const debugInput = element<HTMLInputElement>("debug");
const wireframeInput = element<HTMLInputElement>("wireframe");
const metrics = element<HTMLDListElement>("metrics");
const rejections = element<HTMLDListElement>("rejections");
const seedBadge = element<HTMLSpanElement>("seed-badge");

let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
} catch {
  failure.hidden = false;
  status.textContent = "Renderer unavailable";
  throw new Error("Unable to create a WebGL renderer.");
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  failure.hidden = false;
  status.textContent = "WebGL context lost";
});
renderer.domElement.addEventListener("webglcontextrestored", () => {
  failure.hidden = true;
  regenerate();
});
viewport.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#919b92");
scene.fog = new THREE.FogExp2("#919b92", 0.015);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.minDistance = 12;
controls.maxDistance = 92;
controls.maxPolarAngle = Math.PI * 0.48;
controls.target.set(0, 0.8, 0);

function resetCamera(): void {
  camera.position.set(33, 27, 38);
  controls.target.set(0, 0.7, 0);
  controls.update();
}
resetCamera();

const hemisphere = new THREE.HemisphereLight("#d9e3d5", "#24231d", 2.25);
scene.add(hemisphere);
const sun = new THREE.DirectionalLight("#ffe9bd", 3.2);
sun.position.set(-24, 38, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 3;
sun.shadow.camera.far = 100;
sun.shadow.camera.left = -46;
sun.shadow.camera.right = 46;
sun.shadow.camera.top = 46;
sun.shadow.camera.bottom = -46;
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.025;
scene.add(sun);

let generatedRoot = new THREE.Group();
let debugRoot = new THREE.Group();
let terrainMaterial: THREE.MeshStandardMaterial | null = null;
let currentWorld: GeneratedWorld | null = null;
scene.add(generatedRoot, debugRoot);

const terrainColors: Record<TerrainClass, THREE.Color> = {
  water: new THREE.Color(), shore: new THREE.Color(), lowland: new THREE.Color(),
  upland: new THREE.Color(), ridge: new THREE.Color(),
};

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}

function clearGenerated(): void {
  scene.remove(generatedRoot, debugRoot);
  disposeObject(generatedRoot);
  disposeObject(debugRoot);
  generatedRoot = new THREE.Group();
  debugRoot = new THREE.Group();
  scene.add(generatedRoot, debugRoot);
}

function makeTerrain(world: GeneratedWorld): void {
  const geometry = new THREE.PlaneGeometry(world.options.worldSize, world.options.worldSize, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  if (!positions) throw new Error("Terrain position buffer is unavailable.");
  const colorValues = new Float32Array(positions.count * 3);
  Object.entries(terrainColors).forEach(([key, color]) => color.set(world.profile.palette[key as TerrainClass]));
  const tintNoiseSeed = world.report.numericSeed ^ 0x517cc1b7;
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const height = heightAt(x, z, world.options);
    const slope = slopeAt(x, z, world.options);
    const terrainClass = classifyTerrain(height, slope, world.profile);
    const color = terrainColors[terrainClass].clone();
    const tint = Math.sin(x * 0.33 + tintNoiseSeed) * Math.cos(z * 0.29 - tintNoiseSeed) * 0.025;
    color.offsetHSL(0, 0, tint);
    positions.setY(index, height);
    colorValues[index * 3] = color.r;
    colorValues[index * 3 + 1] = color.g;
    colorValues[index * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colorValues, 3));
  geometry.computeVertexNormals();
  terrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
    wireframe: wireframeInput.checked,
  });
  const terrain = new THREE.Mesh(geometry, terrainMaterial);
  terrain.receiveShadow = true;
  generatedRoot.add(terrain);

  const waterGeometry = new THREE.PlaneGeometry(world.options.worldSize * 1.08, world.options.worldSize * 1.08);
  const waterMaterial = new THREE.MeshPhysicalMaterial({
    color: world.profile.palette.water,
    roughness: 0.22,
    metalness: 0,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = world.profile.waterLevel + 0.035;
  water.receiveShadow = true;
  water.renderOrder = 2;
  generatedRoot.add(water);

  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(world.options.worldSize * 0.7, world.options.worldSize * 0.72, 7, 4, 1, true),
    new THREE.MeshStandardMaterial({ color: "#34362f", roughness: 1, side: THREE.DoubleSide }),
  );
  skirt.rotation.y = Math.PI / 4;
  skirt.position.y = -3.7;
  skirt.receiveShadow = true;
  generatedRoot.add(skirt);
}

function setInstanceTransform(
  mesh: THREE.InstancedMesh,
  index: number,
  position: THREE.Vector3,
  rotationY: number,
  scale: THREE.Vector3,
): void {
  const matrix = new THREE.Matrix4();
  matrix.compose(position, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0)), scale);
  mesh.setMatrixAt(index, matrix);
}

function configureInstances(mesh: THREE.InstancedMesh): void {
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  generatedRoot.add(mesh);
}

function makeScatter(world: GeneratedWorld): void {
  const plants = world.props.filter((prop) => prop.kind === "plant");
  const rocks = world.props.filter((prop) => prop.kind === "rock");
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: world.profile.palette.wood, roughness: 0.96 });
  const foliageColors: Record<BiomeId, string> = { forest: "#314f3b", desert: "#60704b", alpine: "#3a5149" };
  const foliageMaterial = new THREE.MeshStandardMaterial({ color: foliageColors[world.options.biome], roughness: 0.92 });

  const trunkGeometry = world.options.biome === "desert"
    ? new THREE.CylinderGeometry(0.11, 0.16, 1.5, 7)
    : new THREE.CylinderGeometry(0.08, 0.14, 1.1, 7);
  const crownGeometry = world.options.biome === "forest"
    ? new THREE.IcosahedronGeometry(0.72, 1)
    : world.options.biome === "alpine"
      ? new THREE.ConeGeometry(0.72, 1.8, 8)
      : new THREE.SphereGeometry(0.42, 7, 5);
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, plants.length);
  const crowns = new THREE.InstancedMesh(crownGeometry, foliageMaterial, plants.length);
  plants.forEach((prop, index) => {
    const heightScale = world.options.biome === "desert" ? 1.1 : 0.85 + prop.variant * 0.12;
    setInstanceTransform(
      trunks, index,
      new THREE.Vector3(prop.x, prop.height + 0.55 * prop.scale * heightScale, prop.z),
      prop.rotation,
      new THREE.Vector3(prop.scale, prop.scale * heightScale, prop.scale),
    );
    const crownY = world.options.biome === "desert" ? 1.25 : world.options.biome === "alpine" ? 1.3 : 1.15;
    setInstanceTransform(
      crowns, index,
      new THREE.Vector3(prop.x, prop.height + crownY * prop.scale * heightScale, prop.z),
      prop.rotation,
      new THREE.Vector3(prop.scale, prop.scale * heightScale, prop.scale),
    );
  });
  configureInstances(trunks);
  configureInstances(crowns);

  const rockGeometry = new THREE.DodecahedronGeometry(0.52, 0);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: world.profile.palette.stone, roughness: 0.98 });
  const rockMesh = new THREE.InstancedMesh(rockGeometry, rockMaterial, rocks.length);
  rocks.forEach((prop, index) => {
    setInstanceTransform(
      rockMesh, index,
      new THREE.Vector3(prop.x, prop.height + 0.24 * prop.scale, prop.z),
      prop.rotation,
      new THREE.Vector3(prop.scale, prop.scale * (0.45 + prop.variant * 0.12), prop.scale * (0.75 + prop.variant * 0.08)),
    );
  });
  configureInstances(rockMesh);
}

function primitiveGeometry(part: PackPart): THREE.BufferGeometry {
  switch (part.primitive) {
    case "cylinder": return new THREE.CylinderGeometry(0.5, 0.58, 1, 10);
    case "cone": return new THREE.ConeGeometry(0.5, 1, 10);
    case "ring": {
      const ring = new THREE.TorusGeometry(0.5, 0.12, 6, 14);
      ring.rotateX(Math.PI / 2);
      return ring;
    }
    case "beam":
    case "box": return new THREE.BoxGeometry(1, 1, 1);
  }
}

function makeStructures(world: GeneratedWorld): void {
  const materials: Record<PackPart["material"], THREE.MeshStandardMaterial> = {
    wood: new THREE.MeshStandardMaterial({ color: world.profile.palette.wood, roughness: 0.96 }),
    stone: new THREE.MeshStandardMaterial({ color: world.profile.palette.stone, roughness: 1 }),
    accent: new THREE.MeshStandardMaterial({ color: world.profile.palette.accent, roughness: 0.82 }),
  };
  world.structures.forEach((structure) => {
    const group = new THREE.Group();
    group.position.set(structure.x, structure.seatHeight, structure.z);
    group.rotation.y = structure.rotation;
    structure.parts.forEach((part) => {
      const mesh = new THREE.Mesh(primitiveGeometry(part), materials[part.material].clone());
      mesh.position.set(...part.offset);
      mesh.rotation.y = part.rotation;
      mesh.scale.set(...part.scale);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });
    generatedRoot.add(group);

    const outlinePoints = [0, 1, 3, 2].map((index) => structure.contacts[index]!).map((contact) => new THREE.Vector3(contact.x, contact.height + 0.12, contact.z));
    outlinePoints.push(outlinePoints[0]?.clone() ?? new THREE.Vector3());
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(outlinePoints),
      new THREE.LineBasicMaterial({ color: "#f0c168", depthTest: false, transparent: true, opacity: 0.95 }),
    );
    line.renderOrder = 8;
    debugRoot.add(line);
    structure.contacts.forEach((contact) => {
      const isEntrance = contact.label === "entrance";
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(isEntrance ? 0.25 : 0.17, 10, 7),
        new THREE.MeshBasicMaterial({ color: isEntrance ? "#e77d5c" : "#f0c168", depthTest: false }),
      );
      marker.position.set(contact.x, contact.height + 0.18, contact.z);
      marker.renderOrder = 9;
      debugRoot.add(marker);
    });
  });
  debugRoot.visible = debugInput.checked;
}

function addMetric(label: string, value: string): void {
  const term = document.createElement("dt");
  term.textContent = label;
  const definition = document.createElement("dd");
  definition.textContent = value;
  metrics.append(term, definition);
}

function addRejection(label: string, value: number): void {
  const term = document.createElement("dt");
  term.textContent = label;
  const definition = document.createElement("dd");
  definition.textContent = value.toLocaleString();
  rejections.append(term, definition);
}

function updateReport(world: GeneratedWorld): void {
  metrics.replaceChildren();
  rejections.replaceChildren();
  seedBadge.textContent = `#${world.report.numericSeed.toString(16).padStart(8, "0")}`;
  addMetric("Placed", `${world.report.accepted.totalProps} props`);
  addMetric("Ecology", `${world.report.accepted.plants} plants · ${world.report.accepted.rocks} rocks`);
  addMetric("Sites", `${world.report.accepted.structures} footprint-mounted`);
  addMetric("Attempts", `${world.report.attempts.props.toLocaleString()} scatter · ${world.report.attempts.structures} site`);
  addMetric("Terrain", `${TERRAIN_SEGMENTS}² cells · ${world.options.worldSize}m`);
  addMetric("Ground mount", world.structures.length > 0 ? `${Math.max(...world.structures.map((site) => site.maxContactDelta)).toFixed(2)}m max contact range` : "No valid sites");
  Object.entries(world.report.rejections).forEach(([reason, count]) => addRejection(reason.replace(/([A-Z])/g, " $1"), count));
}

function readOptions(): { seed: string; biome: BiomeId; relief: number; density: number } {
  return {
    seed: seedInput.value,
    biome: biomeSelect.value as BiomeId,
    relief: Number(reliefInput.value),
    density: Number(densityInput.value),
  };
}

function regenerate(): void {
  status.textContent = "Generating constrained terrain…";
  window.requestAnimationFrame(() => {
    try {
      const world = generateWorld(readOptions());
      seedInput.value = world.options.seed;
      clearGenerated();
      makeTerrain(world);
      makeScatter(world);
      makeStructures(world);
      updateReport(world);
      currentWorld = world;
      status.textContent = `${world.profile.label} · ${world.report.accepted.totalProps} props · ${world.report.accepted.structures} sites`;
      window.setTimeout(() => { status.textContent = ""; }, 2600);
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Generation failed";
    }
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  regenerate();
});
reliefInput.addEventListener("input", () => { reliefValue.value = `${Number(reliefInput.value).toFixed(2)}×`; });
densityInput.addEventListener("input", () => { densityValue.value = `${Number(densityInput.value).toFixed(2)}×`; });
debugInput.addEventListener("change", () => { debugRoot.visible = debugInput.checked; });
wireframeInput.addEventListener("change", () => { if (terrainMaterial) terrainMaterial.wireframe = wireframeInput.checked; });
element<HTMLButtonElement>("reset-camera").addEventListener("click", resetCamera);
element<HTMLButtonElement>("new-seed").addEventListener("click", () => {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  seedInput.value = `field-${values[0]?.toString(36)}-${values[1]?.toString(36)}`;
  regenerate();
});
element<HTMLButtonElement>("export").addEventListener("click", () => {
  if (!currentWorld) return;
  const blob = new Blob([JSON.stringify(currentWorld.report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `generation-${currentWorld.options.seed.replace(/[^a-z0-9_-]+/gi, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
});

const resizeObserver = new ResizeObserver(() => {
  const width = Math.max(1, viewport.clientWidth);
  const height = Math.max(1, viewport.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
});
resizeObserver.observe(viewport);

function animate(): void {
  controls.update();
  renderer.render(scene, camera);
  window.requestAnimationFrame(animate);
}

regenerate();
animate();
