import { Router } from "express";
import {
  getSettingsHandler,
  updateSettingsHandler,
} from "../controllers/settings.controller";
import { checkJwt } from "../middleware/auth.middleware";

const router = Router();

router.get("/", checkJwt, getSettingsHandler);
router.put("/", checkJwt, updateSettingsHandler);

export default router;
