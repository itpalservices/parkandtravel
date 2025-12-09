import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bookingsRoutes from "./routes/bookings.routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/bookings", bookingsRoutes);

export default app;
