import type { CSSProperties } from "react";

import { useI18n } from "@/i18n";
import { useAppStore } from "@/lib/store";

const RAIL_STEPS = ["INIT", "SYNC", "CONFIG", "FINALIZE"] as const;

const FLOATING_BLOCKS = [
  "left-[8%] top-[11%] size-3 bg-[#ff4d4f]",
  "left-[10%] top-[62%] size-5 bg-white",
  "left-[13%] top-[83%] size-2.5 bg-[#b9c4d0]",
  "right-[8%] top-[22%] size-3 bg-[#b9c4d0]",
  "right-[14%] top-[72%] size-3 bg-[#ff4d4f]",
  "right-[7%] top-[57%] size-3 bg-[#f4a340]",
] as const;

const DOT_FIELDS = [
  "left-[9%] top-[16%]",
  "right-[10%] top-[31%]",
  "left-[9%] bottom-[17%]",
  "right-[11%] bottom-[14%]",
] as const;

const CHINESE_COPY = {
  title: "正在配置书房...",
  subtitle: "小宠物们正在搬家具，马上就绪",
  progress: "正在同步书房布局与装饰数据...",
};

const ENGLISH_COPY = {
  title: "Configuring the study...",
  subtitle: "The cube pets are moving furniture. Almost ready",
  progress: "Syncing study layout and decoration data...",
};

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function PixelCluster({
  className,
  mirrored = false,
}: {
  className: string;
  mirrored?: boolean;
}) {
  return (
    <div className={`absolute h-28 w-28 opacity-70 ${className}`}>
      {Array.from({ length: 18 }).map((_, index) => {
        const column = index % 6;
        const row = Math.floor(index / 6);
        return (
          <span
            key={index}
            className="absolute border border-white bg-white/75 shadow-[0_8px_22px_rgba(90,104,123,0.12)]"
            style={{
              left: column * 17 + (mirrored ? Math.abs(3 - column) * 1.5 : 0),
              top: row * 17 + Math.abs(2 - column) * 1.8,
              width: 15,
              height: 15,
            }}
          />
        );
      })}
    </div>
  );
}

function PixelField() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-testid="loading-pixel-field"
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(108,124,143,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(108,124,143,0.08)_1px,transparent_1px)] bg-[size:26px_26px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.48)_45%,rgba(231,236,241,0.8)_100%)]" />

      <PixelCluster className="left-[5%] top-[37%]" />
      <PixelCluster className="right-[10%] top-[43%]" mirrored />

      {DOT_FIELDS.map(position => (
        <div
          key={position}
          className={`absolute grid grid-cols-4 gap-3 opacity-55 ${position}`}
        >
          {Array.from({ length: 16 }).map((_, index) => (
            <span key={index} className="size-1 rounded-full bg-[#aab6c4]" />
          ))}
        </div>
      ))}

      {FLOATING_BLOCKS.map(className => (
        <span
          key={className}
          className={`absolute rounded-[3px] shadow-[0_8px_18px_rgba(35,48,66,0.12)] ${className}`}
        />
      ))}
      <span className="absolute left-[13%] top-[27%] h-7 w-7 rounded-full border-[6px] border-[#f4a340]/75" />
      <span className="absolute right-[13%] top-[15%] h-7 w-7 rounded-full border-[6px] border-[#ff4d4f]/80" />
    </div>
  );
}

function LoadingStatusRail() {
  return (
    <aside
      className="relative flex min-h-[350px] flex-col justify-between overflow-hidden rounded-[26px] border border-[#e3e8ee] bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(241,245,249,0.58))] px-7 py-7 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] lg:min-h-[500px] lg:rounded-[30px]"
      data-testid="loading-status-rail"
    >
      <div>
        <p className="font-data text-[11px] font-semibold uppercase tracking-[0.22em] text-[#718197]">
          SYSTEM
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#ffb0b2] bg-white/70 px-4 py-2 font-data text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff4d4f]">
          <span className="size-2.5 rounded-full bg-[#ff4d4f] shadow-[0_0_0_5px_rgba(255,77,79,0.12)]" />
          ONLINE
        </div>
      </div>

      <div className="relative my-10 pl-1">
        <span className="absolute left-[8px] top-3 h-[calc(100%-24px)] w-px bg-[#c5ced8]" />
        <div className="flex flex-col gap-8">
          {RAIL_STEPS.map((step, index) => (
            <div key={step} className="relative flex items-center gap-5">
              <span
                className={`relative z-10 size-3 rounded-full border-2 shadow-[0_0_0_4px_rgba(255,255,255,0.8)] ${
                  index < 3
                    ? "border-[#ff4d4f] bg-[#ff4d4f]"
                    : "border-[#a9b5c2] bg-white"
                }`}
              />
              <span
                className={`font-data text-[12px] font-semibold uppercase tracking-[0.18em] ${
                  index < 3 ? "text-[#5e6b7a]" : "text-[#a0abb7]"
                }`}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="font-data text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d9aa8]">
        VER. 1.0.0
      </p>
    </aside>
  );
}

function SimpleLoadingLogo() {
  return (
    <div
      aria-label="CUBE PETS OFFICE"
      className="relative mx-auto flex h-[132px] w-full items-center justify-center"
      data-testid="loading-simple-logo"
    >
      <div className="absolute left-1/2 top-1/2 h-[104px] w-[104px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(207,216,226,0.42)_1.5px,transparent_1.5px)] bg-[size:11px_11px]" />
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative h-[112px] w-[112px] drop-shadow-[0_20px_36px_rgba(70,86,108,0.18)]"
      >
        <g>
          <path d="M20 58 L40 46 L60 58 L40 70Z" fill="#e6ebf0" />
          <path d="M20 58 L40 70 L40 94 L20 82Z" fill="#9aa8b7" />
          <path d="M60 58 L40 70 L40 94 L60 82Z" fill="#bbc5cf" />
        </g>
        <g>
          <path d="M60 58 L80 46 L100 58 L80 70Z" fill="#d9e0e7" />
          <path d="M60 58 L80 70 L80 94 L60 82Z" fill="#9aa8b7" />
          <path d="M100 58 L80 70 L80 94 L100 82Z" fill="#adb8c4" />
        </g>
        <g>
          <path d="M40 34 L60 22 L80 34 L60 46Z" fill="#ff4d4f" />
          <path d="M40 34 L60 46 L60 70 L40 58Z" fill="#d9363e" />
          <path d="M80 34 L60 46 L60 70 L80 58Z" fill="#ef3f46" />
        </g>
      </svg>
      <span className="absolute left-[28%] top-[47%] size-2 rotate-45 bg-[#f4a340]" />
      <span className="absolute right-[28%] top-[38%] size-2 rotate-45 bg-[#ff4d4f]" />
      <span className="absolute right-[24%] top-[62%] size-1.5 rotate-45 bg-[#b8c3cf]" />
    </div>
  );
}

function CubeMark() {
  return (
    <span
      aria-hidden="true"
      className="size-2 rotate-45 rounded-[1px] bg-[linear-gradient(135deg,#ff4d4f,#c8d1dc)]"
    />
  );
}

export function LoadingScreen() {
  const loadingProgress = useAppStore(state => state.loadingProgress);
  const { locale } = useI18n();
  const progress = clampProgress(loadingProgress);
  const copy = locale === "zh-CN" ? CHINESE_COPY : ENGLISH_COPY;

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#f3f5f8] px-4 py-6 text-center text-[#26364a] sm:px-6 lg:py-8"
      data-testid="loading-screen"
    >
      <PixelField />

      <main className="relative z-10 flex w-full max-w-[1060px] flex-col items-center">
        <section
          className="grid w-full gap-4 rounded-[34px] border border-[#e3e8ee] bg-[linear-gradient(145deg,rgba(255,255,255,0.9),rgba(244,247,250,0.78))] p-4 shadow-[0_28px_80px_rgba(81,96,115,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl lg:grid-cols-[150px_minmax(0,1fr)] lg:gap-5 lg:rounded-[42px] lg:p-5"
          data-testid="loading-wide-card"
        >
          <LoadingStatusRail />

          <div className="relative flex min-h-[430px] flex-col items-center justify-center overflow-hidden rounded-[26px] border border-[#e3e8ee] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(248,250,252,0.58))] px-5 py-9 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:px-8 lg:min-h-[500px] lg:rounded-[30px]">
            <SimpleLoadingLogo />

            <div className="mx-auto mt-1 max-w-[720px]">
              <h1 className="text-[clamp(1.65rem,3vw,2.25rem)] font-semibold leading-tight tracking-[0.18em] text-[#687688]">
                {copy.title}
              </h1>
              <p className="mt-5 text-base font-medium leading-7 tracking-[0.08em] text-[#94a1b1]">
                {copy.subtitle}
              </p>

              <div className="mt-8 flex justify-center gap-4">
                <span className="size-2.5 rounded-full bg-[#ff4d4f]" />
                <span className="size-2.5 rounded-full bg-[#c8d1dc]" />
                <span className="size-2.5 rounded-full bg-[#d8dee5]" />
              </div>

              <div
                className="mx-auto mt-10 w-full max-w-[610px] rounded-[20px] border border-[#e2e7ee] bg-white/60 px-6 py-5 text-left shadow-[0_16px_42px_rgba(81,96,115,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]"
                style={
                  { "--loading-progress": `${progress}%` } as CSSProperties
                }
              >
                <div className="mb-4 flex items-center justify-between gap-4 font-data text-[12px] font-semibold uppercase tracking-[0.24em] text-[#6b7787]">
                  <span>PIXEL SYNC</span>
                  <span className="tracking-normal text-[#ff4d4f]">
                    {progress}%
                  </span>
                </div>
                <div className="relative h-3.5 overflow-hidden rounded-full bg-[#dbe1e8] shadow-[inset_0_2px_5px_rgba(31,48,70,0.12)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#ff4d4f_0%,#ff6045_52%,#f7b347_100%)] shadow-[0_9px_18px_rgba(255,77,79,0.22),inset_0_1px_0_rgba(255,255,255,0.28)] transition-[width] duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-4 text-center text-sm font-medium leading-6 tracking-[0.06em] text-[#94a1b1]">
                  {copy.progress}
                </p>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-8 flex max-w-full items-center justify-center gap-5 font-data text-[12px] font-semibold uppercase tracking-[0.48em] text-[#6b7787]">
          <CubeMark />
          <span>CUBE PETS OFFICE</span>
          <CubeMark />
        </footer>
      </main>
    </div>
  );
}
