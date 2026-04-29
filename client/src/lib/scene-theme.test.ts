import { describe, expect, it } from "vitest";
import * as THREE from "three";

import {
  FUTURE_DEPARTMENT_COLORS,
  FUTURE_OFFICE_COLORS,
  rethemeFurnitureMaterial,
} from "./scene-theme";

function hex(color: THREE.Color) {
  return `#${color.getHexString().toUpperCase()}`;
}

describe("future office scene theme", () => {
  it("uses a cool white office palette without the old warm pod accent", () => {
    expect(FUTURE_OFFICE_COLORS.sceneBackground).toBe("#F8FBFF");
    expect(FUTURE_OFFICE_COLORS.floorBase).toBe("#F3F7FB");
    expect(FUTURE_OFFICE_COLORS.warning).toBe(FUTURE_OFFICE_COLORS.cyanSoft);
    expect(FUTURE_DEPARTMENT_COLORS).not.toContain("#D97706");
  });

  it("retints generic furniture materials into cold white office surfaces", () => {
    const material = new THREE.MeshStandardMaterial({
      color: "#8F755D",
      roughness: 0.2,
      metalness: 0.4,
    });

    rethemeFurnitureMaterial(material, "DeskTop", "/models/desk.glb");

    expect(hex(material.color)).toBe(FUTURE_OFFICE_COLORS.furniture);
    expect(material.roughness).toBeGreaterThanOrEqual(0.72);
    expect(material.metalness).toBeLessThanOrEqual(0.18);
  });

  it("retints displays as dark cool glass with cyan emission", () => {
    const material = new THREE.MeshStandardMaterial({
      color: "#4A3527",
      emissive: "#000000",
      emissiveIntensity: 0,
    });

    rethemeFurnitureMaterial(
      material,
      "ComputerScreenDisplay",
      "/models/computer-screen.glb"
    );

    expect(hex(material.color)).toBe(FUTURE_OFFICE_COLORS.screen);
    expect(hex(material.emissive)).toBe(FUTURE_OFFICE_COLORS.cyan);
    expect(material.emissiveIntensity).toBeGreaterThan(0);
  });
});
