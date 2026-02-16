import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "../modules/users/user.model";

interface JwtPayload {
  userId: string;
  role: UserRole;
}

export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const error: any = new Error("Unauthorized: No token provided");
      error.statusCode = 401;
      throw error;
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, env.accessTokenSecret) as JwtPayload;

    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };

    next();
  } catch (err: any) {
    err.statusCode = 401;
    err.message = "Unauthorized: Invalid or expired token";
    next(err);
  }
};

export const optionalAuthMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, env.accessTokenSecret) as JwtPayload;

    req.user = {
      userId: decoded.userId,
      role: decoded.role
    };

    next();
  } catch (_err: any) {
    next();
  }
};
