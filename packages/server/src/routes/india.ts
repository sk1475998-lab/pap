import { Router } from "express";

export const indiaRouter = Router();

indiaRouter.use((_req, res) => {
  res.status(410).json({
    ok: false,
    error: "India intelligence endpoints are retired.",
  });
});
