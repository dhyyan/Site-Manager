const brevo = require("@getbrevo/brevo");

let apiInstance = null;

const initializeBrevoAPI = () => {
  if (apiInstance) return apiInstance;

  if (!process.env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is not set in environment variables");
  }

  apiInstance = new brevo.TransactionalEmailsApi();
  apiInstance.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY.trim()
  );

  return apiInstance;
};

/**
 * Send Expiry Reminder Email with Tabular Layout
 */
const sendExpiryReminderEmail = async (toEmail, data) => {
  try {
    const { expired = [], expiringSoon = [] } = data;
    const normalizedEmail = String(toEmail).toLowerCase().trim();

    if (!normalizedEmail) {
      console.error("Email recipient not provided");
      return false;
    }

    // Helper to generate table rows
    const generateTableRows = (items) => {
      if (!items || items.length === 0) return "<tr><td colspan='3' style='text-align:center; color:#999; padding:20px;'>No documents in this category</td></tr>";
      
      return items
        .map(
          (worker) => `
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 12px; border-bottom: 1px solid #eee;">
                <strong>${worker.name || "N/A"}</strong>
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
                ${worker.employeeNo || "-"}
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #eee;">
                ${Array.isArray(worker.docs) ? worker.docs.join(", ") : "N/A"}
              </td>
            </tr>
          `
        )
        .join("");
    };

    const hasExpired = expired.length > 0;
    const hasExpiringSoon = expiringSoon.length > 0;

    // Responsive HTML Email with Tables
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document Expiry Reminder</title>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f4f4; font-family: Arial, Helvetica, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding:20px 0;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background-color: #1976d2; color: white; padding: 25px; text-align: center;">
                    <h1 style="margin:0; font-size:24px;">Document Expiry Notification</h1>
                    <p style="margin:10px 0 0; font-size:16px; opacity:0.9;">Please review the following document statuses</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 30px 25px; color: #333;">
                    <p style="margin-top:0; font-size:16px;">Dear Manager,</p>
                    <p>This is an automated reminder about workforce document compliance.</p>

                    ${hasExpired ? `
                    <!-- Expired Documents Table -->
                    <div style="margin: 30px 0;">
                      <h2 style="color: #d32f2f; margin-bottom: 15px; font-size: 20px;";
                        >Already Expired Documents</h2>
                      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size:14px;">
                        <thead>
                          <tr style="background-color: #ffebee;">
                            <th style="text-align:left; padding: 12px; border: 1px solid #ffcdd2;">Employee Name</th>
                            <th style="text-align:center; padding: 12px; border: 1px solid #ffcdd2; width:120px;">Employee No</th>
                            <th style="text-align:left; padding: 12px; border: 1px solid #ffcdd2;">Expired Documents</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${generateTableRows(expired)}
                        </tbody>
                      </table>
                    </div>
                    ` : ""}

                    ${hasExpiringSoon ? `
                    <!-- Expiring Soon Table -->
                    <div style="margin: 30px 0;">
                      <h2 style="color: #f57c00; margin-bottom: 15px; font-size: 20px;">
                        Expiring Soon (Within 30 Days)</h2>
                      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size:14px;">
                        <thead>
                          <tr style="background-color: #fff3e0;">
                            <th style="text-align:left; padding: 12px; border: 1px solid #ffcc80;">Employee Name</th>
                            <th style="text-align:center; padding: 12px; border: 1px solid #ffcc80; width:120px;">Employee No</th>
                            <th style="text-align:left; padding: 12px; border: 1px solid #ffcc80;">Expiring Documents</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${generateTableRows(expiringSoon)}
                        </tbody>
                      </table>
                    </div>
                    ` : ""}

                    ${!hasExpired && !hasExpiringSoon ? `
                    <div style="text-align:center; padding:40px; background-color:#f9f9f9; border-radius:8px;">
                      <p style="color:#4caf50; font-size:18px; margin:0;">All documents are up to date!</p>
                    </div>
                    ` : ""}

                    <hr style="border: none; border-top: 1px solid #eee; margin: 35px 0;">

                    <p style="font-size:14px; color:#666;">
                      This is an automated message. Please contact HR if you need assistance updating documents.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size:12px; color:#888;">
                    <p style="margin:0;">
                      © ${new Date().getFullYear()} Your Company Name • Document Compliance System<br>
                      Sent automatically on ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const api = initializeBrevoAPI();
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = `Document Expiry Alert - ${hasExpired ? "Expired Documents" : "Expiring Soon"}`;
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.sender = {
      name: "Document Compliance System",
      email: process.env.ADMIN_EMAIL || "no-reply@yourcompany.com"
    };
    sendSmtpEmail.to = [{ email: normalizedEmail }];

    await api.sendTransacEmail(sendSmtpEmail);
    console.log(`Expiry reminder email sent successfully to ${normalizedEmail}`);
    return true;

  } catch (error) {
    console.error(`Brevo Email Error for ${toEmail}:`, error.message || error);
    return false;
  }
};

module.exports = {
  sendExpiryReminderEmail,
  initializeBrevoAPI
};