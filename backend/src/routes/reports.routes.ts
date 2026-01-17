import { Router } from "express";
import { washServiceReport } from "../controllers/reports.controller";

const router = Router();

router.get("/wash-service", washServiceReport);

export default router;
