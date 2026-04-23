import { Router } from "express";

import {
  executeIntentRecognitionNode,
  isIntentRecognitionNodeType,
  type IntentRecognitionNodeAdapterDeps,
} from "./node-adapters/intent-recognition-node-adapter.js";

export interface IntentRecognitionRouterDeps
  extends IntentRecognitionNodeAdapterDeps {}

export function createIntentRecognitionRouter(
  deps: IntentRecognitionRouterDeps = {},
): Router {
  const router = Router();

  router.post("/nodes/execute", async (req, res) => {
    const nodeType = req.body?.nodeType;

    if (!isIntentRecognitionNodeType(nodeType)) {
      return res
        .status(400)
        .json({ error: "nodeType must be intent_recognition" });
    }

    try {
      const result = await executeIntentRecognitionNode(
        {
          nodeType,
          input: req.body?.input,
        },
        deps,
      );

      return res.status(200).json(result);
    } catch (error: any) {
      const message =
        error?.message || "Intent recognition node execution failed.";
      const status = /requires commandText|requires userId/i.test(message)
        ? 400
        : 500;
      return res.status(status).json({ error: message });
    }
  });

  return router;
}

const router = createIntentRecognitionRouter();

export default router;
