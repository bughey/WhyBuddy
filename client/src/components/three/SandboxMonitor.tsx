/**
 * SandboxMonitor - unified wall-mounted control device for terminal, task, and browser panes.
 */

import { Html } from "@react-three/drei";
import { useEffect, useMemo } from "react";

import { useI18n } from "@/i18n";
import { type SandboxFocusedPane, useSandboxStore } from "@/lib/sandbox-store";
import { FUTURE_OFFICE_COLORS } from "@/lib/scene-theme";
import { useTasksStore } from "@/lib/tasks-store";

import { ScreenshotPreview } from "../sandbox/ScreenshotPreview";
import { TerminalPreview } from "../sandbox/TerminalPreview";
import { MissionWallTaskPanel } from "./MissionWallTaskPanel";
import {
  resolveBrowserContextLabel,
  resolveBrowserPreviewFrames,
  resolvePaneStatusLabel,
  resolveSandboxMonitorMission,
} from "./sandbox-monitor-helpers";

const WALL_MONITOR_POSITION: [number, number, number] = [0, 1.5, -4.79];
const DEVICE_WIDTH = 988;
const DEVICE_HEIGHT = 190;
const DEVICE_DISTANCE_FACTOR = 5.2;
const DEVICE_PANEL_Z = 0.008;

function t(locale: string, zh: string, en: string) {
  return locale === "zh-CN" ? zh : en;
}

function buildPaneShellStyle(active: boolean): React.CSSProperties {
  return {
    position: "relative",
    minWidth: 0,
    height: "100%",
    padding: 5,
    borderRadius: 16,
    background: active
      ? "linear-gradient(180deg, rgba(28,47,68,0.86), rgba(13,24,39,0.92))"
      : "linear-gradient(180deg, rgba(248,251,255,0.18), rgba(226,236,246,0.12))",
    border: active
      ? "1px solid rgba(125,211,252,0.36)"
      : "1px solid rgba(226,232,240,0.26)",
    boxShadow: active
      ? "inset 0 0 0 1px rgba(125,211,252,0.18), 0 0 22px rgba(56,189,248,0.16)"
      : "inset 0 1px 0 rgba(255,255,255,0.16)",
  };
}

function buildFlushPaneShellStyle(active: boolean): React.CSSProperties {
  return {
    ...buildPaneShellStyle(active),
    padding: 0,
    overflow: "hidden",
  };
}

function buildCenterPaneShellStyle(active: boolean): React.CSSProperties {
  return {
    position: "relative",
    minWidth: 0,
    height: "100%",
    overflow: "hidden",
    borderRadius: 16,
    background: active ? "rgba(248,251,255,0.16)" : "transparent",
    boxShadow: active ? "0 0 22px rgba(56,189,248,0.12)" : "none",
  };
}

export function SandboxMonitor() {
  const { locale } = useI18n();

  const tasks = useTasksStore(s => s.tasks);
  const detailsById = useTasksStore(s => s.detailsById);
  const selectedTaskId = useTasksStore(s => s.selectedTaskId);

  const logLines = useSandboxStore(s => s.logLines);
  const isStreaming = useSandboxStore(s => s.isStreaming);
  const focusedPane = useSandboxStore(s => s.focusedPane);
  const activeMissionId = useSandboxStore(s => s.activeMissionId);
  const latestScreenshot = useSandboxStore(s => s.latestScreenshot);
  const previousScreenshot = useSandboxStore(s => s.previousScreenshot);
  const setActiveMission = useSandboxStore(s => s.setActiveMission);
  const setFocusedPane = useSandboxStore(s => s.setFocusedPane);

  const { displayMission, missionDetail } = useMemo(
    () => resolveSandboxMonitorMission(tasks, detailsById, selectedTaskId),
    [detailsById, selectedTaskId, tasks]
  );

  const { current: browserCurrentFrame, previous: browserPreviousFrame } =
    useMemo(
      () => resolveBrowserPreviewFrames(latestScreenshot, previousScreenshot),
      [latestScreenshot, previousScreenshot]
    );

  useEffect(() => {
    const nextMissionId = displayMission?.id ?? null;
    if (activeMissionId !== nextMissionId) {
      setActiveMission(nextMissionId);
    }
  }, [activeMissionId, displayMission?.id, setActiveMission]);

  const taskStageLabel =
    missionDetail?.currentStageLabel ||
    displayMission?.currentStageLabel ||
    t(locale, "等待任务", "Awaiting mission");

  const terminalStatus = resolvePaneStatusLabel(
    locale,
    displayMission?.status,
    "terminal",
    isStreaming || logLines.length > 0
  );
  const browserStatus = resolvePaneStatusLabel(
    locale,
    displayMission?.status,
    "browser",
    Boolean(browserCurrentFrame)
  );
  const browserContext = resolveBrowserContextLabel(
    locale,
    taskStageLabel,
    displayMission?.title
  );

  const closePaneFocus = () => setFocusedPane(null);
  const togglePane = (pane: SandboxFocusedPane) => {
    setFocusedPane(focusedPane === pane ? null : pane);
  };

  return (
    <>
      <group position={WALL_MONITOR_POSITION}>
        <Html
          transform
          position={[0, 0, DEVICE_PANEL_Z]}
          center
          distanceFactor={DEVICE_DISTANCE_FACTOR}
          style={{
            pointerEvents: "auto",
            width: DEVICE_WIDTH,
            height: DEVICE_HEIGHT,
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderRadius: 20,
              padding: 8,
              background:
                "linear-gradient(180deg, rgba(248,251,255,0.82), rgba(222,235,247,0.7))",
              border: "1px solid rgba(203,213,225,0.54)",
              boxShadow:
                "0 22px 46px rgba(86,105,126,0.2), inset 0 1px 0 rgba(255,255,255,0.65)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(circle at top, ${FUTURE_OFFICE_COLORS.cyan}22, transparent 26%), radial-gradient(circle at bottom, ${FUTURE_OFFICE_COLORS.blue}18, transparent 30%)`,
                pointerEvents: "none",
              }}
            />

            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "grid",
                gridTemplateColumns: "1fr 1.55fr 1fr",
                gap: 8,
                width: "100%",
                height: "100%",
              }}
            >
              <div style={buildFlushPaneShellStyle(focusedPane === "terminal")}>
                <TerminalPreview
                  logLines={logLines}
                  isStreaming={isStreaming}
                  fullscreen={false}
                  onToggleFullscreen={closePaneFocus}
                  embedded
                  onActivate={() => togglePane("terminal")}
                  showFullscreenButton={false}
                  title={t(locale, "执行流", "Execution Feed")}
                  statusLabel={terminalStatus}
                  variant="wall"
                  headerMode="hidden"
                />
              </div>

              <div style={buildCenterPaneShellStyle(focusedPane === "task")}>
                <MissionWallTaskPanel
                  mission={displayMission}
                  detail={missionDetail}
                  onActivate={() => togglePane("task")}
                />
              </div>

              <div style={buildFlushPaneShellStyle(focusedPane === "browser")}>
                <ScreenshotPreview
                  current={browserCurrentFrame}
                  previous={browserPreviousFrame}
                  onClickZoom={() => togglePane("browser")}
                  embedded
                  fullscreen={false}
                  onToggleFullscreen={closePaneFocus}
                  showFullscreenButton={false}
                  title={t(locale, "浏览器回传", "Browser Live")}
                  statusLabel={browserStatus}
                  contextLabel={browserContext}
                  variant="wall"
                  headerMode="hidden"
                />
              </div>
            </div>
          </div>
        </Html>
      </group>

      {focusedPane === "terminal" ? (
        <Html fullscreen style={{ pointerEvents: "auto" }}>
          <TerminalPreview
            logLines={logLines}
            isStreaming={isStreaming}
            fullscreen
            onToggleFullscreen={closePaneFocus}
            title={t(locale, "执行流", "Execution Feed")}
            statusLabel={terminalStatus}
            variant="wall"
          />
        </Html>
      ) : null}

      {focusedPane === "task" ? (
        <Html fullscreen style={{ pointerEvents: "auto" }}>
          <MissionWallTaskPanel
            mission={displayMission}
            detail={missionDetail}
            fullscreen
            onClose={closePaneFocus}
          />
        </Html>
      ) : null}

      {focusedPane === "browser" ? (
        <Html fullscreen style={{ pointerEvents: "auto" }}>
          <ScreenshotPreview
            current={browserCurrentFrame}
            previous={browserPreviousFrame}
            onClickZoom={() => undefined}
            fullscreen
            onToggleFullscreen={closePaneFocus}
            title={t(locale, "浏览器回传", "Browser Live")}
            statusLabel={browserStatus}
            contextLabel={browserContext}
            variant="wall"
          />
        </Html>
      ) : null}
    </>
  );
}
