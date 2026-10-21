export type BiomeId = "forest" | "desert" | "alpine";
export type TerrainClass = "water" | "shore" | "lowland" | "upland" | "ridge";
export type PropKind = "plant" | "rock";
export type SlotId = "center" | "front" | "rear" | "left" | "right" | "rearLeft" | "rearRight";
export type PrimitiveKind = "box" | "cylinder" | "cone" | "beam" | "ring";

export interface GenerationOptions {
  seed: string;
  biome: BiomeId;
  relief: number;
  density: number;
  worldSize?: number;
  propLimit?: number;
}

export interface BiomeProfile {
  id: BiomeId;
  label: string;
  waterLevel: number;
  plantSlopeLimit: number;
  rockSlopeLimit: number;
  shoreClearance: number;
  plantSpacing: number;
  rockSpacing: number;
  plantShare: number;
  palette: Record<TerrainClass | "waterDeep" | "wood" | "stone" | "accent", string>;
  packIds: readonly string[];
}

export interface TerrainSample {
  x: number;
  z: number;
  height: number;
  slope: number;
  terrainClass: TerrainClass;
}

export interface PropPlacement extends TerrainSample {
  kind: PropKind;
  scale: number;
  rotation: number;
  variant: number;
}

export interface ContactSample {
  label: "corner-nw" | "corner-ne" | "corner-sw" | "corner-se" | "entrance";
  x: number;
  z: number;
  height: number;
}

export interface PackPart {
  slot: SlotId;
  primitive: PrimitiveKind;
  scale: readonly [number, number, number];
  offset: readonly [number, number, number];
  rotation: number;
  material: "wood" | "stone" | "accent";
}

export interface StructurePlacement {
  id: string;
  packId: string;
  x: number;
  z: number;
  rotation: number;
  width: number;
  depth: number;
  seatHeight: number;
  entranceHeight: number;
  maxContactDelta: number;
  contacts: ContactSample[];
  parts: PackPart[];
}

export interface RejectionCounts {
  underwater: number;
  shore: number;
  slope: number;
  spacing: number;
  structureZone: number;
  siteClearance: number;
  footprintRelief: number;
  entrance: number;
  structureSpacing: number;
}

export interface GenerationReport {
  version: 1;
  seed: string;
  numericSeed: number;
  biome: BiomeId;
  profile: string;
  relief: number;
  density: number;
  worldSize: number;
  propLimit: number;
  attempts: { props: number; structures: number };
  accepted: { plants: number; rocks: number; structures: number; totalProps: number };
  rejections: RejectionCounts;
  terrainCoverage: Record<TerrainClass, number>;
  constraints: {
    waterLevel: number;
    plantSlopeLimit: number;
    rockSlopeLimit: number;
    shoreClearance: number;
    plantSpacing: number;
    rockSpacing: number;
    entranceTolerance: number;
    footprintReliefLimit: number;
  };
  structures: Array<{
    id: string;
    packId: string;
    seatHeight: number;
    entranceDelta: number;
    contactRange: number;
  }>;
}

export interface GeneratedWorld {
  options: Required<GenerationOptions>;
  profile: BiomeProfile;
  props: PropPlacement[];
  structures: StructurePlacement[];
  report: GenerationReport;
}

const DEFAULT_WORLD_SIZE = 72;
const DEFAULT_PROP_LIMIT = 800;
const ENTRANCE_TOLERANCE = 0.5;
const FOOTPRINT_RELIEF_LIMIT = 1.05;

export const BIOME_PROFILES: Record<BiomeId, BiomeProfile> = {
  forest: {
    id: "forest",
    label: "Temperate forest",
    waterLevel: -0.45,
    plantSlopeLimit: 0.62,
    rockSlopeLimit: 0.95,
    shoreClearance: 1.2,
    plantSpacing: 1.42,
    rockSpacing: 1.85,
    plantShare: 0.82,
    palette: {
      water: "#253a3a", waterDeep: "#172a2d", shore: "#9a8b69", lowland: "#586b4c",
      upland: "#455544", ridge: "#77786c", wood: "#5d4632", stone: "#777b72", accent: "#d3a453",
    },
    packIds: ["timber-camp", "weathered-watch"],
  },
  desert: {
    id: "desert",
    label: "High desert",
    waterLevel: -0.8,
    plantSlopeLimit: 0.48,
    rockSlopeLimit: 1.08,
    shoreClearance: 1.55,
    plantSpacing: 2.25,
    rockSpacing: 1.7,
    plantShare: 0.45,
    palette: {
      water: "#315154", waterDeep: "#1c3336", shore: "#b59b6d", lowland: "#a47d51",
      upland: "#896246", ridge: "#6e6258", wood: "#684936", stone: "#a2815d", accent: "#d7b465",
    },
    packIds: ["sun-court", "broken-arch"],
  },
  alpine: {
    id: "alpine",
    label: "Alpine shelf",
    waterLevel: -0.65,
    plantSlopeLimit: 0.5,
    rockSlopeLimit: 1.15,
    shoreClearance: 1.1,
    plantSpacing: 1.85,
    rockSpacing: 1.48,
    plantShare: 0.57,
    palette: {
      water: "#304650", waterDeep: "#1e3038", shore: "#929486", lowland: "#53635a",
      upland: "#626965", ridge: "#a7aaa5", wood: "#56483b", stone: "#858b8d", accent: "#c99a55",
    },
    packIds: ["stone-shelter", "signal-post"],
  },
};

const SLOT_COORDS: Record<SlotId, readonly [number, number]> = {
  center: [0, 0], front: [0, 0.36], rear: [0, -0.36], left: [-0.36, 0], right: [0.36, 0],
  rearLeft: [-0.33, -0.32], rearRight: [0.33, -0.32],
};

const PACKS: Record<string, readonly PackPart[]> = {
  "timber-camp": [
    { slot: "center", primitive: "box", scale: [0.95, 0.12, 0.72], offset: [0, 0.12, 0], rotation: 0, material: "wood" },
    { slot: "rearLeft", primitive: "beam", scale: [0.12, 1.15, 0.12], offset: [0, 0.58, 0], rotation: 0, material: "wood" },
    { slot: "rearRight", primitive: "beam", scale: [0.12, 1.15, 0.12], offset: [0, 0.58, 0], rotation: 0, material: "wood" },
    { slot: "rear", primitive: "box", scale: [0.85, 0.09, 0.55], offset: [0, 1.08, 0], rotation: -0.32, material: "accent" },
    { slot: "front", primitive: "ring", scale: [0.34, 0.1, 0.34], offset: [0, 0.1, 0], rotation: 0, material: "stone" },
  ],
  "weathered-watch": [
    { slot: "center", primitive: "cylinder", scale: [0.55, 1.25, 0.55], offset: [0, 0.62, 0], rotation: 0, material: "stone" },
    { slot: "center", primitive: "cone", scale: [0.78, 0.55, 0.78], offset: [0, 1.48, 0], rotation: 0, material: "wood" },
    { slot: "left", primitive: "beam", scale: [0.12, 0.78, 0.12], offset: [0, 0.39, 0], rotation: 0, material: "wood" },
    { slot: "right", primitive: "beam", scale: [0.12, 0.78, 0.12], offset: [0, 0.39, 0], rotation: 0, material: "wood" },
  ],
  "sun-court": [
    { slot: "center", primitive: "box", scale: [0.88, 0.16, 0.76], offset: [0, 0.1, 0], rotation: 0, material: "stone" },
    { slot: "rearLeft", primitive: "cylinder", scale: [0.2, 1.18, 0.2], offset: [0, 0.59, 0], rotation: 0, material: "stone" },
    { slot: "rearRight", primitive: "cylinder", scale: [0.2, 1.18, 0.2], offset: [0, 0.59, 0], rotation: 0, material: "stone" },
    { slot: "rear", primitive: "beam", scale: [0.8, 0.15, 0.16], offset: [0, 1.12, 0], rotation: 1.5708, material: "accent" },
    { slot: "front", primitive: "ring", scale: [0.4, 0.09, 0.4], offset: [0, 0.08, 0], rotation: 0, material: "accent" },
  ],
  "broken-arch": [
    { slot: "left", primitive: "box", scale: [0.25, 1.25, 0.28], offset: [0, 0.62, 0], rotation: 0.04, material: "stone" },
    { slot: "right", primitive: "box", scale: [0.25, 0.86, 0.28], offset: [0, 0.43, 0], rotation: -0.08, material: "stone" },
    { slot: "center", primitive: "beam", scale: [0.78, 0.2, 0.28], offset: [0, 1.18, 0], rotation: 1.5708, material: "stone" },
    { slot: "rear", primitive: "box", scale: [0.75, 0.12, 0.52], offset: [0, 0.08, 0], rotation: 0, material: "accent" },
  ],
  "stone-shelter": [
    { slot: "center", primitive: "box", scale: [0.92, 0.18, 0.72], offset: [0, 0.09, 0], rotation: 0, material: "stone" },
    { slot: "rearLeft", primitive: "box", scale: [0.25, 0.82, 0.25], offset: [0, 0.41, 0], rotation: 0.05, material: "stone" },
    { slot: "rearRight", primitive: "box", scale: [0.25, 0.96, 0.25], offset: [0, 0.48, 0], rotation: -0.04, material: "stone" },
    { slot: "rear", primitive: "box", scale: [0.86, 0.12, 0.55], offset: [0, 0.96, 0], rotation: -0.28, material: "wood" },
    { slot: "front", primitive: "ring", scale: [0.32, 0.08, 0.32], offset: [0, 0.08, 0], rotation: 0, material: "accent" },
  ],
  "signal-post": [
    { slot: "center", primitive: "cylinder", scale: [0.22, 1.7, 0.22], offset: [0, 0.85, 0], rotation: 0, material: "wood" },
    { slot: "center", primitive: "cone", scale: [0.44, 0.58, 0.44], offset: [0, 1.9, 0], rotation: 0, material: "accent" },
    { slot: "left", primitive: "box", scale: [0.55, 0.13, 0.42], offset: [0, 0.1, 0], rotation: 0.12, material: "stone" },
    { slot: "right", primitive: "box", scale: [0.44, 0.12, 0.35], offset: [0, 0.08, 0], rotation: -0.1, material: "stone" },
  ],
};

export function seedToUint(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
}

export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function latticeValue(x: number, z: number, seed: number): number {
  let value = Math.imul(x, 0x27d4eb2d) ^ Math.imul(z, 0x165667b1) ^ seed;
  value = Math.imul(value ^ (value >>> 15), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return ((value ^ (value >>> 16)) >>> 0) / 2147483647.5 - 1;
}

const smooth = (value: number): number => value * value * (3 - 2 * value);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function valueNoise2D(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const tz = smooth(z - z0);
  const top = lerp(latticeValue(x0, z0, seed), latticeValue(x0 + 1, z0, seed), tx);
  const bottom = lerp(latticeValue(x0, z0 + 1, seed), latticeValue(x0 + 1, z0 + 1, seed), tx);
  return lerp(top, bottom, tz);
}

export function heightAt(x: number, z: number, options: GenerationOptions): number {
  const numericSeed = seedToUint(options.seed);
  const relief = Number.isFinite(options.relief) ? options.relief : 1;
  const warpX = valueNoise2D(x * 0.027, z * 0.027, numericSeed ^ 0xa341316c) * 5.2;
  const warpZ = valueNoise2D(x * 0.027, z * 0.027, numericSeed ^ 0xc8013ea4) * 5.2;
  const px = x + warpX;
  const pz = z + warpZ;
  let amplitude = 1;
  let frequency = 0.034;
  let total = 0;
  let weight = 0;
  for (let octave = 0; octave < 5; octave += 1) {
    const noise = valueNoise2D(px * frequency, pz * frequency, numericSeed + octave * 1013);
    const modulation = 0.72 + Math.abs(total) * 0.11;
    total += noise * amplitude * modulation;
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  const ridges = 1 - Math.abs(valueNoise2D(px * 0.018, pz * 0.018, numericSeed ^ 0x9e3779b9));
  const basin = -0.5 + Math.min(1, Math.hypot(x, z) / 52) * 0.7;
  const biomeBias = options.biome === "alpine" ? 0.48 : options.biome === "desert" ? -0.08 : 0.16;
  return ((total / weight) * 5.9 + ridges * ridges * 1.7 + basin + biomeBias) * relief;
}

export function slopeAt(x: number, z: number, options: GenerationOptions): number {
  const step = 0.35;
  const dx = (heightAt(x + step, z, options) - heightAt(x - step, z, options)) / (step * 2);
  const dz = (heightAt(x, z + step, options) - heightAt(x, z - step, options)) / (step * 2);
  return Math.hypot(dx, dz);
}

export function classifyTerrain(height: number, slope: number, profile: BiomeProfile): TerrainClass {
  if (height <= profile.waterLevel) return "water";
  if (height <= profile.waterLevel + profile.shoreClearance) return "shore";
  if (slope > 0.92 || height > 3.35) return "ridge";
  if (height > 1.45 || slope > 0.48) return "upland";
  return "lowland";
}

export function sampleTerrain(x: number, z: number, options: GenerationOptions): TerrainSample {
  const profile = BIOME_PROFILES[options.biome];
  const height = heightAt(x, z, options);
  const slope = slopeAt(x, z, options);
  return { x, z, height, slope, terrainClass: classifyTerrain(height, slope, profile) };
}

function distanceSquared(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}

function rotatedOffset(x: number, z: number, rotation: number): readonly [number, number] {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return [x * cos + z * sin, -x * sin + z * cos];
}

export function composePack(packId: string, width: number, depth: number): PackPart[] {
  const definition = PACKS[packId];
  if (!definition) throw new Error(`Unknown pack: ${packId}`);
  return definition.map((part) => {
    const slot = SLOT_COORDS[part.slot];
    return {
      ...part,
      offset: [slot[0] * width + part.offset[0], part.offset[1], slot[1] * depth + part.offset[2]],
    };
  });
}

function sampleFootprint(
  x: number,
  z: number,
  width: number,
  depth: number,
  rotation: number,
  options: GenerationOptions,
): ContactSample[] {
  const offsets: Array<[ContactSample["label"], number, number]> = [
    ["corner-nw", -width / 2, -depth / 2], ["corner-ne", width / 2, -depth / 2],
    ["corner-sw", -width / 2, depth / 2], ["corner-se", width / 2, depth / 2],
    ["entrance", 0, depth / 2 + 0.72],
  ];
  return offsets.map(([label, ox, oz]) => {
    const [rx, rz] = rotatedOffset(ox, oz, rotation);
    const px = x + rx;
    const pz = z + rz;
    return { label, x: px, z: pz, height: heightAt(px, pz, options) };
  });
}

function terrainCoverage(options: Required<GenerationOptions>, profile: BiomeProfile): Record<TerrainClass, number> {
  const counts: Record<TerrainClass, number> = { water: 0, shore: 0, lowland: 0, upland: 0, ridge: 0 };
  const samples = 24;
  for (let z = 0; z < samples; z += 1) {
    for (let x = 0; x < samples; x += 1) {
      const px = ((x / (samples - 1)) - 0.5) * options.worldSize;
      const pz = ((z / (samples - 1)) - 0.5) * options.worldSize;
      const height = heightAt(px, pz, options);
      const terrainClass = classifyTerrain(height, slopeAt(px, pz, options), profile);
      counts[terrainClass] += 1;
    }
  }
  return counts;
}

export function generateWorld(input: GenerationOptions): GeneratedWorld {
  const options: Required<GenerationOptions> = {
    seed: input.seed.trim() || "field-notes-42",
    biome: input.biome,
    relief: Math.min(1.65, Math.max(0.55, input.relief)),
    density: Math.min(1.5, Math.max(0.35, input.density)),
    worldSize: input.worldSize ?? DEFAULT_WORLD_SIZE,
    propLimit: Math.min(DEFAULT_PROP_LIMIT, input.propLimit ?? DEFAULT_PROP_LIMIT),
  };
  const profile = BIOME_PROFILES[options.biome];
  const numericSeed = seedToUint(`${options.seed}:${options.biome}`);
  const rng = createRng(numericSeed);
  const props: PropPlacement[] = [];
  const structures: StructurePlacement[] = [];
  const rejections: RejectionCounts = {
    underwater: 0, shore: 0, slope: 0, spacing: 0, structureZone: 0, siteClearance: 0,
    footprintRelief: 0, entrance: 0, structureSpacing: 0,
  };

  const targetProps = Math.min(options.propLimit, Math.round((options.worldSize ** 2 / 8.2) * options.density));
  const maxPropAttempts = Math.max(1600, targetProps * 18);
  let propAttempts = 0;
  while (props.length < targetProps && propAttempts < maxPropAttempts) {
    propAttempts += 1;
    const x = (rng() - 0.5) * (options.worldSize - 3);
    const z = (rng() - 0.5) * (options.worldSize - 3);
    const sample = sampleTerrain(x, z, options);
    const kind: PropKind = rng() < profile.plantShare ? "plant" : "rock";
    const slopeLimit = kind === "plant" ? profile.plantSlopeLimit : profile.rockSlopeLimit;
    const spacing = kind === "plant" ? profile.plantSpacing : profile.rockSpacing;
    if (sample.height <= profile.waterLevel) { rejections.underwater += 1; continue; }
    if (sample.height < profile.waterLevel + profile.shoreClearance * (kind === "plant" ? 0.82 : 0.28)) {
      rejections.shore += 1; continue;
    }
    if (sample.slope > slopeLimit) { rejections.slope += 1; continue; }
    if (props.some((placed) => distanceSquared(sample, placed) < Math.max(spacing, placed.kind === "plant" ? profile.plantSpacing : profile.rockSpacing) ** 2)) {
      rejections.spacing += 1; continue;
    }
    props.push({ ...sample, kind, scale: 0.68 + rng() * 0.78, rotation: rng() * Math.PI * 2, variant: Math.floor(rng() * 3) });
  }

  const targetStructures = 3 + Math.floor(rng() * 3);
  let structureAttempts = 0;
  const maxStructureAttempts = 700;
  while (structures.length < targetStructures && structureAttempts < maxStructureAttempts) {
    structureAttempts += 1;
    const x = (rng() - 0.5) * (options.worldSize - 14);
    const z = (rng() - 0.5) * (options.worldSize - 14);
    const rotation = rng() * Math.PI * 2;
    const width = 4.4 + rng() * 1.8;
    const depth = 3.8 + rng() * 1.7;
    const center = sampleTerrain(x, z, options);
    if (center.height <= profile.waterLevel + profile.shoreClearance || center.slope > 0.36) {
      rejections.structureZone += 1; continue;
    }
    if (structures.some((placed) => distanceSquared(center, placed) < 12 ** 2)) {
      rejections.structureSpacing += 1; continue;
    }
    const contacts = sampleFootprint(x, z, width, depth, rotation, options);
    const cornerHeights = contacts.filter((contact) => contact.label !== "entrance").map((contact) => contact.height);
    const seatHeight = Math.min(...cornerHeights);
    const maxHeight = Math.max(...cornerHeights);
    const entranceHeight = contacts.find((contact) => contact.label === "entrance")?.height ?? Number.NaN;
    if (!Number.isFinite(seatHeight) || !Number.isFinite(entranceHeight) || maxHeight - seatHeight > FOOTPRINT_RELIEF_LIMIT) {
      rejections.footprintRelief += 1; continue;
    }
    if (Math.abs(entranceHeight - seatHeight) > ENTRANCE_TOLERANCE) {
      rejections.entrance += 1; continue;
    }
    const packId = profile.packIds[Math.floor(rng() * profile.packIds.length)] ?? profile.packIds[0];
    if (!packId) continue;
    structures.push({
      id: `site-${structures.length + 1}`,
      packId, x, z, rotation, width, depth, seatHeight, entranceHeight,
      maxContactDelta: maxHeight - seatHeight,
      contacts,
      parts: composePack(packId, width, depth),
    });
  }

  for (let i = props.length - 1; i >= 0; i -= 1) {
    const prop = props[i]!;
    if (structures.some((site) => {
      const [x, z] = rotatedOffset(prop.x - site.x, prop.z - site.z, -site.rotation);
      return Math.abs(x) < site.width / 2 + 1.2 && Math.abs(z) < site.depth / 2 + 1.2;
    })) { props.splice(i, 1); rejections.siteClearance += 1; }
  }

  const plants = props.filter((prop) => prop.kind === "plant").length;
  const rocks = props.length - plants;
  const report: GenerationReport = {
    version: 1,
    seed: options.seed,
    numericSeed,
    biome: options.biome,
    profile: profile.label,
    relief: options.relief,
    density: options.density,
    worldSize: options.worldSize,
    propLimit: options.propLimit,
    attempts: { props: propAttempts, structures: structureAttempts },
    accepted: { plants, rocks, structures: structures.length, totalProps: props.length },
    rejections,
    terrainCoverage: terrainCoverage(options, profile),
    constraints: {
      waterLevel: profile.waterLevel,
      plantSlopeLimit: profile.plantSlopeLimit,
      rockSlopeLimit: profile.rockSlopeLimit,
      shoreClearance: profile.shoreClearance,
      plantSpacing: profile.plantSpacing,
      rockSpacing: profile.rockSpacing,
      entranceTolerance: ENTRANCE_TOLERANCE,
      footprintReliefLimit: FOOTPRINT_RELIEF_LIMIT,
    },
    structures: structures.map((structure) => ({
      id: structure.id,
      packId: structure.packId,
      seatHeight: structure.seatHeight,
      entranceDelta: Math.abs(structure.entranceHeight - structure.seatHeight),
      contactRange: structure.maxContactDelta,
    })),
  };
  return { options, profile, props, structures, report };
}
