import type { NextFunction, Request, Response } from "express";

import { isAdminRole } from "../../shared/auth.js";
import type { AuthenticatedRequest, RequestWithOptionalUser } from "./types.js";
import type { SessionService } from "./session-service.js";

export function createAuthMiddleware(sessionService: SessionService) {
  async function restoreUser(request: Request): Promise<RequestWithOptionalUser | null> {
    const token = sessionService.readSessionToken(request);
    const result = await sessionService.resolveCurrentUser(token);
    if (!result) return null;

    const target = request as RequestWithOptionalUser;
    target.user = result.user;
    target.sessionId = result.sessionId;
    return target;
  }

  return {
    async requireAuth(request: Request, response: Response, next: NextFunction) {
      const restored = await restoreUser(request);
      if (!restored) {
        sessionService.clearCookie(response);
        response.status(401).json({ success: false, error: "Authentication required" });
        return;
      }
      next();
    },

    async optionalAuth(request: Request, _response: Response, next: NextFunction) {
      await restoreUser(request);
      next();
    },

    requireAdmin(request: Request, response: Response, next: NextFunction) {
      const user = (request as AuthenticatedRequest).user;
      if (!user) {
        response.status(401).json({ success: false, error: "Authentication required" });
        return;
      }

      if (!isAdminRole(user.role)) {
        response.status(403).json({ success: false, error: "Admin privileges required" });
        return;
      }

      next();
    },
  };
}
