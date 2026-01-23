import { Router } from "express";
import { validateFlight } from "../controllers/flight.controller";

const router = Router();

router.get("/validate", validateFlight);

export default router;
