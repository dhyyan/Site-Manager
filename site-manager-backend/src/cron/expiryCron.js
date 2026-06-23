const cron = require("node-cron");
const Worker = require("../models/Worker");
const { sendExpiryReminderEmail } = require("../utils/emailService");

const EXPIRY_THRESHOLD_DAYS = 30;

const getDaysDifference = (date) => {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(date);
  exp.setHours(0, 0, 0, 0);
  return Math.floor((exp - today) / (1000 * 60 * 60 * 24));
};

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString("en-GB") : "N/A";

const startExpiryCron = () => {

  console.log("⏱ Cron job scheduled for 12 AM UAE time daily...");

  // RUN EVERYDAY AT 12 AM UAE TIME
  cron.schedule(
    "00 00 * * *",
    async () => {
      console.log("⚡ Cron Triggered at:", new Date().toLocaleString("en-AE", {
        timeZone: "Asia/Dubai",
      }));

      try {
        const workers = await Worker.find({
          isActive: { $ne: false },
          $or: [
            { visaExpDate: { $ne: null } },
            { laborCardExpDate: { $ne: null } },
            { emiratesIdExpDate: { $ne: null } },
            { passportExpDate: { $ne: null } },
          ],
        }).select(
          "firstName lastName employeeNo visaExpDate laborCardExpDate emiratesIdExpDate passportExpDate"
        );

        const expired = [];
        const expiringSoon = [];

        workers.forEach((worker) => {
          const docs = [
            { name: "Visa", date: worker.visaExpDate },
            { name: "Labor Card", date: worker.laborCardExpDate },
            { name: "Emirates ID", date: worker.emiratesIdExpDate },
            { name: "Passport", date: worker.passportExpDate },
          ];

          docs.forEach(({ name, date }) => {
            const days = getDaysDifference(date);
            if (days == null) return;

            const info = `${name} (expires: ${formatDate(date)})`;

            if (days < 0) {
              // Already expired
              let entry = expired.find((e) => e.employeeNo === worker.employeeNo);
              if (!entry) {
                entry = {
                  name: `${worker.firstName} ${worker.lastName}`,
                  employeeNo: worker.employeeNo,
                  docs: [],
                };
                expired.push(entry);
              }
              entry.docs.push(info);
            } else if (days <= EXPIRY_THRESHOLD_DAYS) {
              // Expiring soon
              let entry = expiringSoon.find((e) => e.employeeNo === worker.employeeNo);
              if (!entry) {
                entry = {
                  name: `${worker.firstName} ${worker.lastName}`,
                  employeeNo: worker.employeeNo,
                  docs: [],
                };
                expiringSoon.push(entry);
              }
              entry.docs.push(info);
            }
          });
        });

        if (expired.length > 0 || expiringSoon.length > 0) {
          await sendExpiryReminderEmail(process.env.ADMIN_EMAIL, {
            expired,
            expiringSoon,
          });
          console.log("📧 Email sent successfully");
        } else {
          console.log("✔ No expiries found today");
        }
      } catch (error) {
        console.error("❌ Cron failed:", error);
      }
    },
    {
      timezone: "Asia/Dubai",
      scheduled: true,
    }
  );
};

module.exports = { startExpiryCron };
