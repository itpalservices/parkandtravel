import { Router } from "express";
import {
  listBookings,
  getBooking,
  deleteBooking,
} from "../controllers/bookings.controller";

const router = Router();

router.get("/", listBookings);
router.get("/:id", getBooking);
router.put("/:id/delete", deleteBooking);

export default router;
