import { Router } from "express";
import {
  checkParkingAvailability,
  getAvailabilityBoth,
} from "../controllers/availability.controller";

const router = Router();

router.get("/check", checkParkingAvailability);
router.get("/both", getAvailabilityBoth);

export default router;
