import { Router, Request, Response } from "express";
import { checkJwt, getUserRole } from "../middleware/auth.middleware";
import { getCarsByUserId, getCarById, createCar, updateCar, deleteCar } from "../services/cars.service";

const router = Router();

router.get("/", checkJwt, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const userId = auth?.payload?.sub;
    const role = getUserRole(auth);

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    if (role !== "user") {
      res.status(403).json({ error: "Only regular users can access cars" });
      return;
    }

    const cars = await getCarsByUserId(userId);
    res.json({ success: true, data: cars });
  } catch (error: any) {
    console.error("Error fetching cars:", error.message);
    res.status(500).json({ error: "Failed to fetch cars" });
  }
});

router.get("/:id", checkJwt, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const userId = auth?.payload?.sub;
    const role = getUserRole(auth);
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    if (role !== "user") {
      res.status(403).json({ error: "Only regular users can access cars" });
      return;
    }

    const car = await getCarById(id, userId);
    if (!car) {
      res.status(404).json({ error: "Car not found" });
      return;
    }

    res.json({ success: true, data: car });
  } catch (error: any) {
    console.error("Error fetching car:", error.message);
    res.status(500).json({ error: "Failed to fetch car" });
  }
});

router.post("/", checkJwt, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const userId = auth?.payload?.sub;
    const role = getUserRole(auth);

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    if (role !== "user") {
      res.status(403).json({ error: "Only regular users can manage cars" });
      return;
    }

    const { carBrand, carModel, carColor, plateNo } = req.body;

    if (!carBrand || !carModel || !carColor || !plateNo) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }

    const car = await createCar(userId, carBrand, carModel, carColor, plateNo);
    res.status(201).json({ success: true, data: car });
  } catch (error: any) {
    console.error("Error creating car:", error.message);
    res.status(500).json({ error: "Failed to create car" });
  }
});

router.put("/:id", checkJwt, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const userId = auth?.payload?.sub;
    const role = getUserRole(auth);
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    if (role !== "user") {
      res.status(403).json({ error: "Only regular users can manage cars" });
      return;
    }

    const { carBrand, carModel, carColor, plateNo } = req.body;

    if (!carBrand || !carModel || !carColor || !plateNo) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }

    const car = await updateCar(id, userId, carBrand, carModel, carColor, plateNo);
    if (!car) {
      res.status(404).json({ error: "Car not found" });
      return;
    }

    res.json({ success: true, data: car });
  } catch (error: any) {
    console.error("Error updating car:", error.message);
    res.status(500).json({ error: "Failed to update car" });
  }
});

router.delete("/:id", checkJwt, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const userId = auth?.payload?.sub;
    const role = getUserRole(auth);
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    if (role !== "user") {
      res.status(403).json({ error: "Only regular users can manage cars" });
      return;
    }

    const deleted = await deleteCar(id, userId);
    if (!deleted) {
      res.status(404).json({ error: "Car not found" });
      return;
    }

    res.json({ success: true, message: "Car deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting car:", error.message);
    res.status(500).json({ error: "Failed to delete car" });
  }
});

export default router;
