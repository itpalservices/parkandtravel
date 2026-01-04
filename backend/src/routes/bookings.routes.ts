import { Router } from "express";
import {
  listBookings,
  getBooking,
  deleteBooking,
  createGuestBooking,
} from "../controllers/bookings.controller";

const router = Router();

router.get("/", listBookings);
router.get("/:id", getBooking);
router.put("/:id/delete", deleteBooking);
router.post("/guest", createGuestBooking);

export default router;
