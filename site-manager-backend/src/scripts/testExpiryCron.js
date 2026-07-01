const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../../.env") });

const { checkExpiriesAndSendEmail } = require("../cron/expiryCron");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/alfaheem_site_manager";

async function testCron() {
  console.log("⚡ Connecting to MongoDB...");
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB.");

    console.log("⚡ Running document expiry cron check...");
    const result = await checkExpiriesAndSendEmail();
    console.log("✅ Cron run finished. Result:", result);

  } catch (error) {
    console.error("❌ Cron test failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB.");
  }
}

testCron();
