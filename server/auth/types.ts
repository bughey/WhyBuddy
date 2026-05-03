import type { Request } from "express";
import type { CurrentUser } from "../../shared/auth.js";

export interface AuthenticatedRequest extends Request {
  user: CurrentUser;
  sessionId: string;
}

export interface RequestWithOptionalUser extends Request {
  user?: CurrentUser;
  sessionId?: string;
}
