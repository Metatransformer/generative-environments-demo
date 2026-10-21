import { describe, expect, it } from "vitest";
import { BIOME_PROFILES, generateWorld, heightAt, type GenerationOptions } from "./model";

const BASE: GenerationOptions = {
  seed: "invariant-field-17",
  biome: "forest",
  relief: 1,
  density: 0.78,
  worldSize: 64,
  propLimit: 260,
};

describe("deterministic environment model", () => {
  it("reproduces the complete generation for the same inputs", () => {
    expect(generateWorld(BASE)).toEqual(generateWorld(BASE));
  });

  it("changes the sampled field and placements when the seed changes", () => {
    const first = generateWorld(BASE);
    const secondOptions = { ...BASE, seed: "invariant-field-18" };
    const second = generateWorld(secondOptions);

    expect(heightAt(8.25, -3.75, BASE)).not.toBe(heightAt(8.25, -3.75, secondOptions));
    expect(first.props).not.toEqual(second.props);
  });

  it.each(["forest", "desert", "alpine"] as const)("never places %s plants underwater", (biome) => {
    const world = generateWorld({ ...BASE, biome, seed: `dry-${biome}` });
    const waterLevel = BIOME_PROFILES[biome].waterLevel;
    const plants = world.props.filter((prop) => prop.kind === "plant");

    expect(plants.length).toBeGreaterThan(0);
    expect(plants.every((plant) => plant.height > waterLevel)).toBe(true);
  });

  it("enforces the per-kind slope limits", () => {
    const world = generateWorld(BASE);

    for (const prop of world.props) {
      const limit = prop.kind === "plant" ? world.profile.plantSlopeLimit : world.profile.rockSlopeLimit;
      expect(prop.slope).toBeLessThanOrEqual(limit);
    }
  });

  it("keeps every accepted prop outside both objects' minimum spacing", () => {
    const world = generateWorld(BASE);

    for (let leftIndex = 0; leftIndex < world.props.length; leftIndex += 1) {
      const left = world.props[leftIndex];
      if (!left) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < world.props.length; rightIndex += 1) {
        const right = world.props[rightIndex];
        if (!right) continue;
        const distance = Math.hypot(left.x - right.x, left.z - right.z);
        const leftSpacing = left.kind === "plant" ? world.profile.plantSpacing : world.profile.rockSpacing;
        const rightSpacing = right.kind === "plant" ? world.profile.plantSpacing : world.profile.rockSpacing;
        expect(distance).toBeGreaterThanOrEqual(Math.max(leftSpacing, rightSpacing) - 1e-9);
      }
    }
  });

  it("seats every structure from finite footprint samples and constrains its entrance", () => {
    const world = generateWorld({ ...BASE, seed: "ground-mount-proof", density: 0.5 });

    expect(world.structures.length).toBeGreaterThanOrEqual(3);
    expect(world.structures.length).toBeLessThanOrEqual(5);
    for (const structure of world.structures) {
      const corners = structure.contacts.filter((contact) => contact.label !== "entrance");
      expect(structure.contacts).toHaveLength(5);
      expect(structure.contacts.every((contact) => Number.isFinite(contact.height))).toBe(true);
      expect(structure.seatHeight).toBe(Math.min(...corners.map((contact) => contact.height)));
      expect(Math.abs(structure.entranceHeight - structure.seatHeight)).toBeLessThanOrEqual(
        world.report.constraints.entranceTolerance,
      );
      expect(structure.maxContactDelta).toBeLessThanOrEqual(world.report.constraints.footprintReliefLimit);
    }
  });
});


describe("rendered structure contracts", () => {
  it("samples the actual Three.js Y-rotated footprint and keeps scatter clear", () => {
    const world = generateWorld({ seed: "field-notes-42", biome: "forest", relief: 1, density: 1 });
    expect(world.structures.length).toBeGreaterThan(0);
    for (const site of world.structures) {
      const x = -site.width / 2, z = -site.depth / 2;
      expect(site.contacts[0]!.x).toBeCloseTo(site.x + x * Math.cos(site.rotation) + z * Math.sin(site.rotation));
      expect(site.contacts[0]!.z).toBeCloseTo(site.z - x * Math.sin(site.rotation) + z * Math.cos(site.rotation));
      for (const prop of world.props) {
        const dx = prop.x - site.x, dz = prop.z - site.z;
        const lx = dx * Math.cos(site.rotation) - dz * Math.sin(site.rotation);
        const lz = dx * Math.sin(site.rotation) + dz * Math.cos(site.rotation);
        expect(Math.abs(lx) >= site.width / 2 + 1.2 || Math.abs(lz) >= site.depth / 2 + 1.2).toBe(true);
      }
    }
  });
});
