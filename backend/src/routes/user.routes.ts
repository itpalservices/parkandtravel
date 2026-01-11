import { Router, Request, Response } from "express";
import { checkJwt } from "../middleware/auth.middleware";
import { getUserById, updateUser, sendVerificationEmail, searchRegularUserByEmail } from "../services/auth0.service";

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

router.get("/search", checkJwt, async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser || (authUser.role !== "admin" && authUser.role !== "driver")) {
      res.status(403).json({ error: "Only admins and drivers can search for users" });
      return;
    }

    const email = req.query.email as string;

    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "Email parameter is required" });
      return;
    }

    const result = await searchRegularUserByEmail(email.toLowerCase().trim());

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("Error searching user:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to search for user" });
  }
});

export default router;
