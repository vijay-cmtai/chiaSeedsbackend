import nodemailer from "nodemailer";
import { ApiError } from "./ApiError.js";

// Setup transporter for Zoho SMTP
const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,            // SSL port for secure Zoho SMTP
  secure: true,         // true for port 465
  auth: {
    user: process.env.MAIL_USER,    // e.g., hello@naraaglobal.com
    pass: process.env.MAIL_PASS,    // App password (not login password)
  },
  logger: true,         // optional: show debug logs in console
  debug: true,          // optional: detailed output for debugging
});

const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Naraaglobal Enterprises" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent: %s", info.messageId);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new ApiError(
      500,
      "Failed to send email due to a server issue. Please try again later."
    );
  }
};

export { sendEmail };
