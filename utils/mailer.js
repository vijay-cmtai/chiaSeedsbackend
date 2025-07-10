import nodemailer from "nodemailer";
import { ApiError } from "./ApiError.js";

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: `"Chia Seeds E-commerce" <${process.env.MAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    throw new ApiError(
      500,
      "Failed to send email due to a server issue. Please try again later."
    );
  }
};

export { sendEmail };
