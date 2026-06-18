const brevo = require("@getbrevo/brevo");

// Initialize Brevo API - Called lazily to ensure .env is loaded
let apiInstance = null;

const initializeBrevoAPI = () => {
  if (apiInstance) return apiInstance;

  if (!process.env.BREVO_API_KEY) {
    throw new Error("❌ BREVO_API_KEY is not set in environment variables");
  }

  apiInstance = new brevo.TransactionalEmailsApi();
  
  // Set API Key using the correct method
  apiInstance.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY.trim()
  );

  console.log("✅ Brevo API initialized successfully");
  return apiInstance;
};

/**
 * Send OTP Email with retry logic
 */
const sendOtpEmail = async (email, otp, retries = 3) => {
  try {
    // Validate inputs
    if (!email || !otp) {
      throw new Error("Email and OTP are required");
    }

    // Normalize email
    const normalizedEmail = String(email).toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error("Invalid email format");
    }

    // Initialize API
    const api = initializeBrevoAPI();

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = "Your Password Reset OTP";
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reset Your Password</h2>
        <p>Your OTP is:</p>
        <p style="font-size: 2em; font-weight: bold; color: #1976d2; letter-spacing: 5px;">
          ${otp}
        </p>
        <p style="color: #666;">
          This OTP will expire in <strong>5 minutes</strong>.
        </p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="color: #999; font-size: 0.9em;">
          If you didn't request this, please ignore this email or contact support.
        </p>
      </div>
    `;
    sendSmtpEmail.sender = { 
      name: "Site Manager", 
      email: process.env.ADMIN_EMAIL 
    };
    sendSmtpEmail.to = [{ email: normalizedEmail }];
    sendSmtpEmail.replyTo = { email: process.env.ADMIN_EMAIL };

    await api.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ OTP Email sent successfully to ${normalizedEmail}`);
    return { 
      success: true, 
      message: "Email sent successfully",
      email: normalizedEmail 
    };

  } catch (error) {
    console.error(`❌ Failed to send OTP email to ${email}:`, error.message);
    
    // Retry logic for temporary failures
    if (retries > 0 && error.response?.status !== 401) {
      console.log(`⏳ Retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      return sendOtpEmail(email, otp, retries - 1);
    }

    throw new Error(`Email sending failed: ${error.message}`);
  }
};

/**
 * Send Welcome Email
 */
const sendWelcomeEmail = async (email, name) => {
  try {
    const normalizedEmail = String(email).toLowerCase().trim();
    const api = initializeBrevoAPI();

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = "Welcome to Site Manager";
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome ${name}!</h2>
        <p>Your account has been created successfully.</p>
        <p>You can now login to the Site Manager application.</p>
        <a href="${process.env.FRONTEND_URL}/login" style="display: inline-block; padding: 10px 20px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 5px;">
          Go to Login
        </a>
      </div>
    `;
    sendSmtpEmail.sender = { 
      name: "Site Manager", 
      email: process.env.ADMIN_EMAIL 
    };
    sendSmtpEmail.to = [{ email: normalizedEmail }];

    await api.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Welcome email sent to ${normalizedEmail}`);
    return true;

  } catch (error) {
    console.error(`❌ Failed to send welcome email:`, error.message);
    return false;
  }
};

module.exports = { 
  sendOtpEmail,
  sendWelcomeEmail,
  initializeBrevoAPI
};