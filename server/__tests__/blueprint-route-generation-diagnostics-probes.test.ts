import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const BLUEPRINT_ROUTE_PATH = path.resolve(REPO_ROOT, "server", "routes", "blueprint.ts");
const BLUEPRINT_ROUTE_SOURCE = readFileSync(BLUEPRINT_ROUTE_PATH, "utf-8");

function readRouteGenerationSandboxDerivationSource(): string {
  const start = BLUEPRINT_ROUTE_SOURCE.indexOf(
    "async function createRouteGenerationSandboxDerivation",
  );
  const end = BLUEPRINT_ROUTE_SOURCE.indexOf(
    "const evidenceItems = invocations.map",
    start,
  );

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return BLUEPRINT_ROUTE_SOURCE.slice(start, end);
}

describe("route generation sandbox diagnostics", () => {
  const derivationSource = readRouteGenerationSandboxDerivationSource();

  it("does not run role container loader only to make diagnostics non-zero", () => {
    expect(derivationSource).not.toContain(
      "ctx.roleContainerLoader.provisionRoleContainer",
    );
  });

  it("does not run role agent delegation only to make diagnostics non-zero", () => {
    expect(derivationSource).not.toContain("ctx.roleAgentDelegator.delegate");
    expect(derivationSource).not.toContain(
      "Sandbox derivation: validate route generation capabilities",
    );
    expect(derivationSource).not.toContain(
      'recordDelegation("roleAutonomousAgent"',
    );
  });

  it("does not synthesize stage activation or reasoning bridge activity", () => {
    expect(derivationSource).not.toContain(
      'recordBridgeInvocation("agentCrewStageActivation"',
    );
    expect(derivationSource).not.toContain("recordAgentReasoningForwarded");
    expect(derivationSource).not.toContain("sandbox.derivation.bridge_probe");
  });
});
