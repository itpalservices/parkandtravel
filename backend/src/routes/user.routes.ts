import { Router, Request, Response } from "express";
import { checkJwt } from "../middleware/auth.middleware";
import { getUserById, updateUser, sendVerificationEmail, searchRegularUserByEmail, getAllRegularUsers, getAllDriverUsers, createDriverUser } from "../services/auth0.service";
import { getBookingsByUserId } from "../services/bookings.service";

const router = Router();

router.get("/profile", checkJwt, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const userId = auth?.payload?.sub;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const user = await getUserById(userId);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      success: true,
      data: {
        email: user.email,
        name: user.given_name || "",
        surname: user.family_name || "",
        phone: user.user_metadata?.phone_number || "",
        phoneCode: user.user_metadata?.phone_code || "",
        emailVerified: user.email_verified,
        picture: user.picture,
      },
    });
  } catch (error: any) {
    console.error("Error fetching user profile:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

router.put("/profile", checkJwt, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const userId = auth?.payload?.sub;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const { name, surname, phone, phoneCode } = req.body;

    if (name !== undefined && typeof name !== "string") {
      res.status(400).json({ error: "Invalid name" });
      return;
    }

    if (surname !== undefined && typeof surname !== "string") {
      res.status(400).json({ error: "Invalid surname" });
      return;
    }

    if (phone !== undefined && typeof phone !== "string") {
      res.status(400).json({ error: "Invalid phone" });
      return;
    }

    if (phoneCode !== undefined && typeof phoneCode !== "string") {
      res.status(400).json({ error: "Invalid phone code" });
      return;
    }

    const updateData: any = {};

    if (name !== undefined) {
      updateData.given_name = name;
    }

    if (surname !== undefined) {
      updateData.family_name = surname;
    }

    if (name !== undefined || surname !== undefined) {
      updateData.name = `${name || ""} ${surname || ""}`.trim();
    }

    if (phone !== undefined || phoneCode !== undefined) {
      updateData.user_metadata = {};
      if (phone !== undefined) {
        updateData.user_metadata.phone_number = phone;
      }
      if (phoneCode !== undefined) {
        updateData.user_metadata.phone_code = phoneCode;
      }
    }

    const updatedUser = await updateUser(userId, updateData);

    res.json({
      success: true,
      data: {
        email: updatedUser.email,
        name: updatedUser.given_name || "",
        surname: updatedUser.family_name || "",
        phone: updatedUser.user_metadata?.phone_number || "",
        phoneCode: updatedUser.user_metadata?.phone_code || "",
        emailVerified: updatedUser.email_verified,
        picture: updatedUser.picture,
      },
    });
  } catch (error: any) {
    console.error("Error updating user profile:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to update user profile" });
  }
});

router.post("/resend-verification", checkJwt, async (req: Request, res: Response) => {
  try {
    const auth = (req as any).auth;
    const userId = auth?.payload?.sub;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const user = await getUserById(userId);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.email_verified) {
      res.status(400).json({ error: "Email is already verified" });
      return;
    }

    await sendVerificationEmail(userId);

    res.json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (error: any) {
    console.error("Error sending verification email:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to send verification email" });
  }
});

router.post("/drivers", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;
    if (!authUser || authUser.role !== "admin") {
      res.status(403).json({ error: "Only admins can create drivers" });
      return;
    }

    const { name, surname, email, phone, phoneCode } = req.body;

    if (!name || !surname || !email || !phone || !phoneCode) {
      res.status(400).json({ error: "Name, surname, email, phone and phone code are required" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Invalid email address" });
      return;
    }

    const result = await createDriverUser({ name, surname, email, phone, phoneCode });

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error creating driver:", error.response?.data || error.message);
    const status = error.response?.status === 409 ? 409 : 500;
    const message = error.response?.data?.message || error.message || "Failed to create driver";
    res.status(status).json({ error: message });
  }
});

router.get("/drivers", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser || authUser.role !== "admin") {
      res.status(403).json({ error: "Only admins can view drivers" });
      return;
    }

    const page = Math.max(0, parseInt(req.query.page as string) || 0);
    const perPage = 10;

    const result = await getAllDriverUsers(page, perPage);

    res.json({
      success: true,
      data: result.users,
      total: result.total,
      page,
      perPage,
    });
  } catch (error: any) {
    console.error("Error fetching drivers:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

router.get("/customers", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser || authUser.role !== "admin") {
      res.status(403).json({ error: "Only admins can view customers" });
      return;
    }

    const customers = await getAllRegularUsers();

    res.json({
      success: true,
      data: customers,
    });
  } catch (error: any) {
    console.error("Error fetching customers:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

router.get("/search", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser || (authUser.role !== "admin" && authUser.role !== "driver")) {
      res.status(403).json({ error: "Only admins and drivers can search for users" });
      return;
    }

    const email = req.query.email as string;
    const phone = req.query.phone as string;
    const phoneCode = req.query.phoneCode as string;

    let result;
    if (email && typeof email === "string") {
      result = await searchRegularUserByEmail(email.toLowerCase().trim());
    } else if (phone && phoneCode) {
      const { searchRegularUserByPhone } = await import("../services/auth0.service");
      result = await searchRegularUserByPhone(phone.trim(), phoneCode.trim());
    } else {
      res.status(400).json({ error: "Email or phone+phoneCode parameters are required" });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error searching user:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to search for user" });
  }
});

router.get("/:userId/bookings", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser || authUser.role !== "admin") {
      res.status(403).json({ error: "Only admins can view customer booking history" });
      return;
    }

    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    const bookings = await getBookingsByUserId(userId);

    res.json({
      success: true,
      data: bookings,
    });
  } catch (error: any) {
    console.error("Error fetching user bookings:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch user bookings" });
  }
});

export default router;
