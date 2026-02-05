import { Request, Response, NextFunction } from "express";
import { User } from "./user.model";

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;

    const user = await User.findById(userId).select("-password");

    if (!user) {
      const error: any = new Error("User not found");
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};
