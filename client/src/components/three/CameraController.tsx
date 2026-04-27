import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { PerspectiveCamera } from 'three';

import type { ViewportTier } from '@/hooks/useViewportTier';

import { computeFovCompensation } from './camera-compensation';

export interface CameraControllerProps {
  /** Actual available width of the Scene3D container in pixels. */
  effectiveWidth: number;
  /** Current viewport tier from useViewportTier. */
  tier: ViewportTier;
}

/** Base FOV presets matching the existing Scene3D camera config. */
const BASE_FOV: Record<ViewportTier, number> = {
  mobile: 46,
  tablet: 43,
  desktop: 40,
};

/**
 * R3F internal component that dynamically adjusts the camera FOV
 * based on the effective viewport width.
 *
 * It preserves the existing mobile / tablet / desktop three-tier
 * FOV presets and layers a continuous compensation on top so the
 * scene core area stays visible when a sidebar narrows the viewport.
 *
 * Must be rendered inside an R3F `<Canvas>`.
 */
export function CameraController({ effectiveWidth, tier }: CameraControllerProps) {
  const { camera } = useThree();

  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;

    const baseFov = BASE_FOV[tier];
    const fovCompensation = computeFovCompensation(effectiveWidth);
    const targetFov = baseFov + fovCompensation;

    camera.fov = targetFov;
    camera.updateProjectionMatrix();
  }, [effectiveWidth, tier, camera]);

  return null;
}
