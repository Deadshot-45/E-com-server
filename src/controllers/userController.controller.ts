import { Request, Response } from "express";
import User from "../models/User.js";

export const getUserDetails = async (req: Request, res: Response) => {
    try {
        const userId = req.params.id || (req as any).user?._id;
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, data: user });
    } catch (error) {
        res.status(404).json({ success: false, message: "User not found" });
    }
};