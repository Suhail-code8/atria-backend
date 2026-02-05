import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { User, IUser, UserRole } from "../users/user.model";
import { env } from "../../config/env";

interface SanitizedUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
}

/**
 * Sanitize user object before returning
 * Removes sensitive fields: password, refreshToken
 */
export const sanitizeUser = (user: IUser): SanitizedUser => {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role
  };
};

/**
 * Generate access token (short-lived)
 */
export const generateAccessToken = (user: IUser): string => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role
    },
    env.accessTokenSecret,
    {
      expiresIn: env.accessTokenExpiresIn
    } as SignOptions
  );
};

/**
 * Generate refresh token (long-lived)
 */
export const generateRefreshToken = (user: IUser): string => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role
    },
    env.refreshTokenSecret,
    {
      expiresIn: env.refreshTokenExpiresIn
    } as SignOptions
  );
};

export const registerUser = async (data: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<SanitizedUser> => {
  const existingUser = await User.findOne({ email: data.email });
  if (existingUser) {
    throw new Error("User already exists");
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  const user = await User.create({
    name: data.name,
    email: data.email,
    password: hashedPassword,
    role: data.role,
    refreshToken: null
  });

  return sanitizeUser(user);
};

export const loginUser = async (
  email: string,
  password: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: SanitizedUser;
}> => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Save refresh token to database
  user.refreshToken = refreshToken;
  await user.save();

  return { accessToken, refreshToken, user: sanitizeUser(user) };
};

/**
 * Refresh access token using valid refresh token
 */
export const refreshAccessToken = async (
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string;
}> => {
  // Verify refresh token
  let decoded: any;
  try {
    decoded = jwt.verify(refreshToken, env.refreshTokenSecret);
  } catch (error) {
    throw new Error("Invalid or expired refresh token");
  }

  // Find user by ID
  const user = await User.findById(decoded.userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Verify refresh token matches stored value
  if (user.refreshToken !== refreshToken) {
    throw new Error("Refresh token does not match");
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  // Rotate refresh token in database
  user.refreshToken = newRefreshToken;
  await user.save();

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

/**
 * Logout user by clearing refresh token
 */
export const logoutUser = async (userId: string): Promise<void> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Clear refresh token
  user.refreshToken = null;
  await user.save();
};
