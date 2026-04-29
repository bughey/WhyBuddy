import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { isDesktopViewportWidth } from "@/hooks/useViewportTier";

import { useHUDPositionSync } from "./hud-sync";
import { OverlayContainer } from "./OverlayContainer";
import type { HUDDefinition, HUDElement, OverlayContainerProps } from "./types";

const EMPTY_HUD_DEFINITIONS: HUDDefinition[] = [];

export interface UEOverlayChromeProps {
  videoElement: OverlayContainerProps["videoElement"];
  mediaLayer?: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
  hudDefinitions?: HUDDefinition[];
  hudElements?: HUDElement[];
  viewportWidth?: number;
  overlayTone?: OverlayContainerProps["overlayTone"];
  className?: string;
}

export function UEOverlayChrome({
  videoElement,
  mediaLayer,
  sidebar,
  children,
  hudDefinitions = EMPTY_HUD_DEFINITIONS,
  hudElements,
  viewportWidth = 1280,
  overlayTone = "dimmed",
  className,
}: UEOverlayChromeProps) {
  const layout = isDesktopViewportWidth(viewportWidth) ? "desktop" : "narrow";
  const syncedHUDElements = useHUDPositionSync(hudDefinitions);

  return (
    <OverlayContainer
      videoElement={videoElement}
      mediaLayer={mediaLayer}
      hudElements={hudElements ?? syncedHUDElements}
      overlayTone={overlayTone}
      pointerPassthrough
    >
      <div
        className={cn("pointer-events-none absolute inset-0", className)}
        data-testid="ue-overlay-chrome"
        data-overlay-layout={layout}
      >
        {sidebar ? (
          <div
            className={cn(
              "pointer-events-auto absolute bottom-0 left-0 top-0 z-40",
              layout === "desktop" ? "w-[240px]" : "w-[64px]",
            )}
            data-testid="ue-overlay-sidebar-slot"
          >
            {sidebar}
          </div>
        ) : null}

        <div
          className={cn(
            "pointer-events-none absolute inset-0 min-h-0",
            sidebar && layout === "desktop" && "pl-[240px]",
            sidebar && layout === "narrow" && "pl-[64px]",
          )}
          data-testid="ue-overlay-panel-slot"
        >
          <div className="pointer-events-auto h-full min-h-0">{children}</div>
        </div>
      </div>
    </OverlayContainer>
  );
}
