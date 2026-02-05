import { Request, Response, NextFunction } from "express";
import { UserRole } from "../modules/users/user.model";

export const roleMiddleware =
  (...allowedRoles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        const error: any = new Error("Unauthorized");
        error.statusCode = 401;
        throw error;
      }

      if (!allowedRoles.includes(req.user.role)) {
        const error: any = new Error("Forbidden: Access denied");
        error.statusCode = 403;
        throw error;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
