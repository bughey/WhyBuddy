#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

const svgPath = path.join(
  repoRoot,
  "docs",
  "ui-redesign-8-spec-progress-overview-2026-04-27.svg",
);

const originalBaseline = {
  specsDone: 8,
  specsTotal: 8,
  tasksDone: 329,
  tasksTotal: 329,
};

const iaSpecs = [
  {
    label: "Home cockpit shell",
    slug: "ui-redesign-home-cockpit-shell-convergence",
    file: path.join(
      repoRoot,
      ".kiro",
      "specs",
      "ui-redesign-home-cockpit-shell-convergence",
      "tasks.md",
    ),
  },
  {
    label: "Task center workbench",
    slug: "ui-redesign-task-center-workbench-tabs",
    file: path.join(
      repoRoot,
      ".kiro",
      "specs",
      "ui-redesign-task-center-workbench-tabs",
      "tasks.md",
    ),
  },
  {
    label: "Composer-only center",
    slug: "ui-redesign-composer-only-center-input",
    file: path.join(
      repoRoot,
      ".kiro",
      "specs",
      "ui-redesign-composer-only-center-input",
      "tasks.md",
    ),
  },
];

const validationCommands = [
  {
    label: "home tests",
    command:
      "npx vitest run --pool=forks --poolOptions.forks.singleFork client/src/components/office/OfficeTaskCockpit.test.tsx client/src/components/office/__tests__/OfficeTaskCockpit.cards-integration.test.tsx client/src/components/office/office-task-cockpit-utils.test.ts",
  },
  {
    label: "/tasks tests",
    command:
      "npx vitest run --pool=forks --poolOptions.forks.singleFork client/src/pages/tasks client/src/components/tasks/__tests__/TasksQueueRail.test.tsx client/src/components/tasks/__tests__/TasksCockpitDetail.test.tsx client/src/components/tasks/__tests__/RightInfoPanel.test.tsx client/src/App.shell-layout.test.tsx",
  },
  {
    label: "launch/composer tests",
    command:
      "npx vitest run --pool=forks --poolOptions.forks.singleFork client/src/components/office/OfficeTaskCockpit.test.tsx client/src/components/launch/__tests__/LaunchPanelShell.test.tsx client/src/components/launch/__tests__/LaunchPanelIntegration.test.tsx",
  },
  {
    label: "SVG XML check",
    command: "node scripts/ui-redesign-ia-progress.mjs --check-xml",
  },
];

const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  printHelp();
  process.exit(0);
}

const report = buildReport();

if (args.has("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);
}

if (args.has("--write")) {
  writeSvg(report);
}

if (args.has("--check-xml") || args.has("--write")) {
  validateSvgXml(svgPath);
}

function printHelp() {
  console.log(`Usage: node scripts/ui-redesign-ia-progress.mjs [options]

Options:
  --json       Print machine-readable progress statistics.
  --write      Refresh the marked New IA progress fields in the SVG.
  --check-xml  Parse the SVG with .NET XmlReader and fail on XML errors.
  --help       Show this help text.
`);
}

function buildReport() {
  const specs = iaSpecs.map(parseSpec);
  const totals = specs.reduce(
    (acc, spec) => {
      acc.phases.done += spec.phases.done;
      acc.phases.total += spec.phases.total;
      acc.subtasks.done += spec.subtasks.done;
      acc.subtasks.total += spec.subtasks.total;
      acc.checklist.done += spec.checklist.done;
      acc.checklist.total += spec.checklist.total;
      return acc;
    },
    {
      phases: { done: 0, total: 0 },
      subtasks: { done: 0, total: 0 },
      checklist: { done: 0, total: 0 },
    },
  );

  return {
    generatedAt: new Date().toISOString(),
    originalBaseline,
    newIa: {
      specs,
      totals,
      percent: percent(totals.checklist.done, totals.checklist.total),
    },
    validationCommands,
  };
}

function parseSpec(spec) {
  const markdown = fs.readFileSync(spec.file, "utf8");
  const checklist = [];

  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const match = /^(\s*)- \[([ xX])\] (.+)$/.exec(line);
    if (!match) continue;

    const [, indent, mark, label] = match;
    const isDone = mark.toLowerCase() === "x";
    const isPhase = indent.length === 0 && /^\d+\./.test(label);

    checklist.push({
      line: index + 1,
      label: label.trim(),
      done: isDone,
      type: isPhase ? "phase" : "subtask",
    });
  }

  const phases = checklist.filter((item) => item.type === "phase");
  const subtasks = checklist.filter((item) => item.type === "subtask");

  return {
    label: spec.label,
    slug: spec.slug,
    taskFile: path.relative(repoRoot, spec.file).replaceAll(path.sep, "/"),
    status: statusFor(checklist),
    phases: count(phases),
    subtasks: count(subtasks),
    checklist: count(checklist),
  };
}

function count(items) {
  return {
    done: items.filter((item) => item.done).length,
    total: items.length,
  };
}

function statusFor(items) {
  const done = items.filter((item) => item.done).length;
  if (items.length > 0 && done === items.length) return "complete";
  if (done > 0) return "in-progress";
  return "pending";
}

function percent(done, total) {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

function printReport(current) {
  const { originalBaseline: baseline, newIa } = current;

  console.log("UI Redesign IA progress");
  console.log(
    `Original 8-spec baseline: ${baseline.specsDone}/${baseline.specsTotal} specs, ${baseline.tasksDone}/${baseline.tasksTotal} tasks complete (kept separate).`,
  );
  console.log(
    `New IA follow-up: ${newIa.totals.checklist.done}/${newIa.totals.checklist.total} checklist items (${newIa.percent}%), ${newIa.totals.phases.done}/${newIa.totals.phases.total} phases, ${newIa.totals.subtasks.done}/${newIa.totals.subtasks.total} subtasks.`,
  );
  console.log("");

  for (const spec of newIa.specs) {
    console.log(
      `- ${spec.label}: ${spec.checklist.done}/${spec.checklist.total} checklist, ${spec.phases.done}/${spec.phases.total} phases, ${spec.subtasks.done}/${spec.subtasks.total} subtasks (${spec.status})`,
    );
  }

  console.log("");
  console.log("Validation commands:");
  for (const item of validationCommands) {
    console.log(`- ${item.label}: ${item.command}`);
  }
  console.log("");
  console.log(
    "Refresh SVG after implementation checkpoints: node scripts/ui-redesign-ia-progress.mjs --write",
  );
}

function writeSvg(current) {
  let svg = fs.readFileSync(svgPath, "utf8");
  const { newIa } = current;

  const replacements = {
    "ia-hero-value": `${newIa.totals.checklist.done} / ${newIa.totals.checklist.total}`,
    "ia-summary-value": `${newIa.totals.checklist.done} / ${newIa.totals.checklist.total} items`,
    "ia-summary-meta": `3 specs, ${newIa.totals.phases.done}/${newIa.totals.phases.total} phases, ${newIa.totals.subtasks.done}/${newIa.totals.subtasks.total} subtasks; excludes original 329/329`,
    "ia-status-badge": `${newIa.totals.checklist.done}/${newIa.totals.checklist.total} tracked`,
    "ia-status-title": `New IA follow-up tracked separately: ${newIa.totals.checklist.done}/${newIa.totals.checklist.total} checklist items`,
    "ia-section-meta": `Separate count: ${newIa.totals.phases.done}/${newIa.totals.phases.total} phases, ${newIa.totals.subtasks.done}/${newIa.totals.subtasks.total} subtasks, ${newIa.totals.checklist.done}/${newIa.totals.checklist.total} checklist items`,
    "ia-footer": `Source: .kiro/specs/ui-redesign-* + IA follow-up specs | Updated 2026-04-28 | Original baseline: 8 specs, 329/329 tasks | New IA separate: ${newIa.totals.checklist.done}/${newIa.totals.checklist.total} checklist, ${newIa.totals.phases.done}/${newIa.totals.phases.total} phases, ${newIa.totals.subtasks.done}/${newIa.totals.subtasks.total} subtasks | /tasks launch tab: explicitly excluded | Refresh: node scripts/ui-redesign-ia-progress.mjs --write`,
  };

  for (const [id, value] of Object.entries(replacements)) {
    svg = replaceTextById(svg, id, value);
  }

  const start = "  <!-- ia-progress-cards:start -->";
  const end = "  <!-- ia-progress-cards:end -->";
  const blockPattern = new RegExp(
    `${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`,
  );
  const renderedBlock = `${start}\n${renderIaCards(newIa.specs)}\n${end}`;

  if (!blockPattern.test(svg)) {
    throw new Error("Could not find ia-progress-cards markers in SVG.");
  }

  svg = svg.replace(blockPattern, renderedBlock);
  fs.writeFileSync(svgPath, svg);
  console.log(`Updated ${path.relative(repoRoot, svgPath).replaceAll(path.sep, "/")}`);
}

function replaceTextById(svg, id, value) {
  const pattern = new RegExp(`(<text\\s+id="${escapeRegExp(id)}"[^>]*>)([\\s\\S]*?)(</text>)`);
  if (!pattern.test(svg)) {
    throw new Error(`Could not find SVG text node with id="${id}".`);
  }
  return svg.replace(pattern, `$1${escapeXml(value)}$3`);
}

function renderIaCards(specs) {
  const cards = specs
    .map((spec, index) => {
      const x = [36, 428, 820][index];
      const width = 372;
      const barWidth = 324;
      const progressWidth = Math.round(
        barWidth * (spec.checklist.total ? spec.checklist.done / spec.checklist.total : 0),
      );
      const fill = spec.status === "complete" ? "#ffffff" : spec.status === "in-progress" ? "#eff6ff" : "#fffbeb";
      const stroke = spec.status === "complete" ? "#27c281" : spec.status === "in-progress" ? "#bfdbfe" : "#fcd34d";
      const badgeFill = spec.status === "complete" ? "#e8fbf2" : spec.status === "in-progress" ? "#dbeafe" : "#fef3c7";
      const badgeClass = spec.status === "complete" ? "badge-done" : spec.status === "in-progress" ? "badge-work" : "badge-reopen";
      const badgeText = spec.status === "complete" ? "complete" : spec.status === "in-progress" ? "in progress" : "pending";
      const progressRect =
        progressWidth > 0
          ? `\n  <rect x="${x + 16}" y="1044" width="${progressWidth}" height="6" rx="3" fill="url(#workFill)"/>`
          : "";

      return `  <rect x="${x}" y="936" width="${width}" height="118" rx="18" fill="${fill}" stroke="${stroke}"/>
  <rect x="${x + 16}" y="950" width="86" height="18" rx="9" fill="${badgeFill}"/>
  <text x="${x + 28}" y="963" class="${badgeClass}">${escapeXml(badgeText)}</text>
  <text x="${x + width - 32}" y="964" text-anchor="end" class="card-value" style="font-size:15px;">${spec.checklist.done}/${spec.checklist.total}</text>
  <text x="${x + 16}" y="992" class="spec-title">${index + 1}. ${escapeXml(spec.label)}</text>
  <text x="${x + 16}" y="1014" class="spec-task">${spec.phases.done}/${spec.phases.total} phases | ${spec.subtasks.done}/${spec.subtasks.total} subtasks</text>
  <text x="${x + 16}" y="1035" class="spec-slug">${escapeXml(spec.slug)}</text>
  <rect x="${x + 16}" y="1044" width="${barWidth}" height="6" rx="3" fill="#e5ebf3"/>${progressRect}`;
    })
    .join("\n\n");

  return `${cards}

  <rect x="1212" y="936" width="352" height="118" rx="18" fill="#eff6ff" stroke="#bfdbfe"/>
  <rect x="1228" y="950" width="104" height="18" rx="9" fill="#dbeafe"/>
  <text x="1240" y="963" class="badge-work">validation</text>
  <text x="1228" y="992" class="spec-title">Validation gates</text>
  <text x="1228" y="1014" class="spec-task">home + /tasks + launch + SVG XML</text>
  <text x="1228" y="1035" class="spec-slug">node scripts/ui-redesign-ia-progress.mjs --check-xml</text>
  <rect x="1228" y="1044" width="304" height="6" rx="3" fill="#e5ebf3"/>
  <rect x="1228" y="1044" width="304" height="6" rx="3" fill="url(#workFill)"/>`;
}

function validateSvgXml(targetPath) {
  const resolved = path.resolve(targetPath);
  const quotedPath = resolved.replaceAll("'", "''");
  const command = [
    "$settings = [System.Xml.XmlReaderSettings]::new();",
    "$settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit;",
    `$reader = [System.Xml.XmlReader]::Create('${quotedPath}', $settings);`,
    "try { while ($reader.Read()) {} } finally { $reader.Close() };",
    "Write-Output 'SVG XML OK';",
  ].join(" ");

  const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
  const result = spawnSync(
    powershell,
    ["-NoProfile", "-NonInteractive", "-Command", command],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `SVG XML validation failed:\n${result.stdout.trim()}\n${result.stderr.trim()}`,
    );
  }

  console.log(result.stdout.trim());
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
