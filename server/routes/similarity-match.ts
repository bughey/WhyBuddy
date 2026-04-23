import { Router } from "express";

import {
  executeSimilarityMatchNode,
  isSimilarityMatchNodeType,
} from "./node-adapters/similarity-match-node-adapter.js";

const VALIDATION_ERROR_PATTERN =
  /requires query text or queryVector|requires candidates|at least one comparable candidate/i;

export function createSimilarityMatchRouter(): Router {
  const router = Router();

  router.post("/nodes/execute", async (req, res) => {
    const nodeType = req.body?.nodeType;
    if (!isSimilarityMatchNodeType(nodeType)) {
      return res.status(400).json({ error: "nodeType must be similarity_match" });
    }

    try {
      const result = await executeSimilarityMatchNode({
        nodeType,
        input: req.body?.input,
      });

      return res.status(200).json(result);
    } catch (error: any) {
      const message = error?.message || "Similarity match node execution failed.";
      const status = VALIDATION_ERROR_PATTERN.test(message) ? 400 : 500;
      return res.status(status).json({ error: message });
    }
  });

  return router;
}

const router = createSimilarityMatchRouter();

export default router;
