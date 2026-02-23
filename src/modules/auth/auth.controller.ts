import { Request, Response, NextFunction } from "express";
import { registerUser, loginUser, refreshAccessToken, logoutUser, sanitizeUser } from "./auth.service";
import { generateAccessToken, generateRefreshToken } from "./auth.service";
import { User, UserRole } from "../users/user.model";
import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcrypt";
import crypto from "crypto";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID?.trim());

const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth/refresh",
  maxAge: 7 * 24 * 60 * 60 * 1000                          
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

   
                 
                                        
                                        
   
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);

                                           
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

export const googleLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      const error: any = new Error("Google credential is required");
      error.statusCode = 400;
      throw error;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID?.trim()
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const name = payload?.name || "Google User";

    if (!email) {
      const error: any = new Error("Unable to verify Google account email");
      error.statusCode = 400;
      throw error;
    }

    let user = await User.findOne({ email });

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: UserRole.PARTICIPANT,
        refreshToken: null,
        isGoogleAuth: true
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: "Google login successful",
      data: {
        accessToken,
        user: sanitizeUser(user)
      }
    });
  } catch (error) {
    next(error);
  }
};
