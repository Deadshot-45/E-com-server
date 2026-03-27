import express from "express";
import { userRegister } from "../controllers/registerController.js";
import User from "../models/User.js";

const router = (express as any).Router();

router.post("/register", userRegister);

router.get("/:id", async (req: any, res: any) => {
  const user = await User.findById(req.params.id);
  res.json(user);
});

export default router;
