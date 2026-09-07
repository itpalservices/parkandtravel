import { Router } from "express";
import {
  getPublicSettingsHandler,
  getSettingsHandler,
  updateSettingsHandler,
} from "../controllers/settings.controller";
import { checkJwt } from "../middleware/auth.middleware";

const router = Router();

router.get("/public", getPublicSettingsHandler);
router.get("/", checkJwt, getSettingsHandler);
router.put("/", checkJwt, updateSettingsHandler);

export default router;
