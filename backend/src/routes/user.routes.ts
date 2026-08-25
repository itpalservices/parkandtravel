import { Router, Request, Response } from "express";
import { checkJwt } from "../middleware/auth.middleware";
import { getUserById, updateUser, sendVerificationEmail, searchRegularUserByEmail, getAllRegularUsers, getAllDriverUsers, createDriverUser, updateDriverUser, deleteDriverUser, setDriverBlockStatus, getUserDiscount, setUserDiscount, getUserSettings, setUserSettings, getDriverById, sendPasswordResetEmail } from "../services/auth0.service";
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
        discountPercentage: user.app_metadata?.discount_percentage ?? null,
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

    const { name, surname, email, phone, phoneCode, idNumber, address } = req.body;

    if (!name || !surname || !email || !phone || !phoneCode || !idNumber) {
      res.status(400).json({ error: "Name, surname, email, phone, phone code and ID number are required" });
      return;
    }

    if (!/^\d+$/.test(idNumber)) {
      res.status(400).json({ error: "ID number must contain only digits" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Invalid email address" });
      return;
    }

    const result = await createDriverUser({ name, surname, email, phone, phoneCode, idNumber, address });

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error creating driver:", error.response?.data || error.message);
    const status = error.response?.status === 409 ? 409 : 500;
    const message = error.response?.data?.message || error.message || "Failed to create driver";
    res.status(status).json({ error: message });
  }
});

router.put("/drivers/:userId", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;
    if (!authUser || authUser.role !== "admin") {
      res.status(403).json({ error: "Only admins can update drivers" });
      return;
    }

    const { userId } = req.params;
    const { name, surname, phone, phoneCode, idNumber, address } = req.body;

    if (!name || !surname || !phone || !phoneCode || !idNumber) {
      res.status(400).json({ error: "Name, surname, phone, phone code and ID number are required" });
      return;
    }

    if (!/^\d+$/.test(idNumber)) {
      res.status(400).json({ error: "ID number must contain only digits" });
      return;
    }

    await updateDriverUser(userId, { name, surname, phone, phoneCode, idNumber, address });
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating driver:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || "Failed to update driver" });
  }
});

router.delete("/drivers/:userId", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;
    if (!authUser || authUser.role !== "admin") {
      res.status(403).json({ error: "Only admins can delete drivers" });
      return;
    }

    const { userId } = req.params;
    await deleteDriverUser(userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting driver:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || "Failed to delete driver" });
  }
});

router.patch("/drivers/:userId/block", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;
    if (!authUser || authUser.role !== "admin") {
      res.status(403).json({ error: "Only admins can block/unblock drivers" });
      return;
    }

    const { userId } = req.params;
    const { blocked } = req.body;

    if (typeof blocked !== "boolean") {
      res.status(400).json({ error: "blocked must be a boolean" });
      return;
    }

    await setDriverBlockStatus(userId, blocked);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating driver block status:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || "Failed to update driver status" });
  }
});

router.post("/drivers/:userId/reset-password", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;
    if (!authUser || authUser.role !== "admin") {
      res.status(403).json({ error: "Only admins can reset driver passwords" });
      return;
    }

    const { userId } = req.params;
    const driver = await getDriverById(userId);

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    if (driver.blocked) {
      res.status(400).json({ error: "Cannot reset password for a blocked driver" });
      return;
    }

    await sendPasswordResetEmail(driver.email);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error sending driver password reset email:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to send password reset email" });
  }
});

router.get("/drivers/:userId", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;
    if (!authUser || authUser.role !== "admin") {
      res.status(403).json({ error: "Only admins can view driver details" });
      return;
    }

    const { userId } = req.params;
    const driver = await getDriverById(userId);

    if (!driver) {
      res.status(404).json({ error: "Driver not found" });
      return;
    }

    res.json({ success: true, data: driver });
  } catch (error: any) {
    console.error("Error fetching driver:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch driver" });
  }
});

router.get("/drivers", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser || authUser.role !== "admin") {
      res.status(403).json({ error: "Only admins can view drivers" });
      return;
    }

    const drivers = await getAllDriverUsers();

    res.json({
      success: true,
      data: drivers,
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

router.get("/me/settings", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;
    if (!authUser?.sub) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const user = await getUserById(authUser.sub);
    const exemptMandatoryPayment = user?.app_metadata?.exempt_mandatory_payment ?? false;
    res.json({ success: true, data: { exemptMandatoryPayment } });
  } catch (error: any) {
    console.error("Error fetching own settings:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch user settings" });
  }
});

router.get("/:userId/settings", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;
    if (!authUser || (authUser.role !== "admin" && authUser.role !== "driver")) {
      res.status(403).json({ error: "Only admins and drivers can view customer settings" });
      return;
    }

    const { userId } = req.params;
    const settings = await getUserSettings(userId);
    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.error("Error fetching user settings:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch user settings" });
  }
});

router.patch("/:userId/settings", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;
    if (!authUser || authUser.role !== "admin") {
      res.status(403).json({ error: "Only admins can update customer settings" });
      return;
    }

    const { userId } = req.params;
    const { discountPercentage, exemptMandatoryPayment } = req.body;

    let discountToSave: number | null = null;
    if (discountPercentage !== null && discountPercentage !== undefined) {
      const val = Number(discountPercentage);
      if (!Number.isInteger(val) || val < 0 || val > 100) {
        res.status(400).json({ error: "Discount percentage must be an integer between 0 and 100" });
        return;
      }
      discountToSave = val;
    }

    await setUserSettings(userId, discountToSave, !!exemptMandatoryPayment);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating user settings:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to update user settings" });
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
