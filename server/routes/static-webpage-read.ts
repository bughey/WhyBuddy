import { Router } from "express";

import {
  executeStaticWebpageReadNode,
  isStaticWebpageReadNodeType,
  type StaticWebpageReadNodeAdapterDeps,
} from "./node-adapters/static-webpage-read-node-adapter.js";

export interface StaticWebpageReadRouterDeps
  extends StaticWebpageReadNodeAdapterDeps {}

export function createStaticWebpageReadRouter(
  deps: StaticWebpageReadRouterDeps = {},
): Router {
  const router = Router();

  router.post("/nodes/execute", async (req, res) => {
    const nodeType = req.body?.nodeType;
    if (!isStaticWebpageReadNodeType(nodeType)) {
      return res.status(400).json({ error: "nodeType must be static_webpage_read" });
    }

    try {
      const result = await executeStaticWebpageReadNode(
        {
          nodeType,
          input: req.body?.input,
        },
        deps,
      );

      return res.status(200).json(result);
    } catch (error: any) {
      const message = error?.message || "Static webpage read node execution failed.";
      const status =
        /requires url or html/i.test(message) ||
        /requires fetchhtml/i.test(message)
          ? 400
          : 500;
      return res.status(status).json({ error: message });
    }
  });

  return router;
}

const router = createStaticWebpageReadRouter();

export default router;
