import { Request, Response, NextFunction } from "express";
import { registerUser, loginUser, refreshAccessToken, logoutUser, sanitizeUser } from "./auth.service";

const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth/refresh",
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await registerUser(req.body);
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login endpoint
 * Returns access token in response body
 * Sets refresh token as httpOnly cookie
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accessToken: result.accessToken,
        user: result.user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token endpoint
 * Reads refresh token from httpOnly cookie
 * Returns new access token in response body
 * Sets new refresh token as httpOnly cookie
 */
export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      const error: any = new Error("Refresh token is required");
      error.statusCode = 401;
      throw error;
    }

    const tokens = await refreshAccessToken(refreshToken);

    // Set new refresh token as httpOnly cookie
    res.cookie("refreshToken", tokens.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      data: {
        accessToken: tokens.accessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout endpoint
 * Requires valid access token
 * Clears refresh token from database
 * Clears refresh token cookie
 */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      const error: any = new Error("Unauthorized");
      error.statusCode = 401;
      throw error;
    }

    await logoutUser(userId);

    // Clear refresh token cookie
    res.cookie("refreshToken", "", {
      httpOnly: true,
      secure: true,
      sameSite: "strict" as const,
      path: "/api/auth/refresh",
      maxAge: 0
    });

    res.status(200).json({
      success: true,
      message: "Logout successful"
    });
  } catch (error) {
    next(error);
  }
};
