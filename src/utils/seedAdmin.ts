import User from "../models/User.js";
import { hashPassword } from "./passwordUtils.js";
import { logger } from "./logger.js";

/**
 * Seeds the default admin user into the database if not already present.
 */
export const seedAdminUser = async (): Promise<void> => {
  try {
    const adminEmail = (process.env.DEFAULT_ADMIN_EMAIL || "admin@vaultvogue.com").trim().toLowerCase();
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "AdminPassword@123";
    const adminName = process.env.DEFAULT_ADMIN_NAME || "Admin User";

    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      logger.info(`ℹ️ Admin user already exists with email: ${adminEmail}`);
      return;
    }

    const hashedPassword = await hashPassword(adminPassword);

    await User.create({
      email: adminEmail,
      passwordHash: hashedPassword,
      name: adminName,
      role: "admin",
      isActive: true,
    });

    logger.info(`✅ Default admin user created successfully: ${adminEmail}`);
  } catch (error) {
    logger.error("❌ Error seeding default admin user:", error);
  }
};
