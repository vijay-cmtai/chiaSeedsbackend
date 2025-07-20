import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendEmail } from "../utils/mailer.js";
const ADMIN_EMAIL = process.env.MAIL_USER || "naraglobal@gmail.com";

const handleContactForm = asyncHandler(async (req, res) => {
  const { name, lastname, email, subject, message } = req.body;

  if (
    [name, email, subject, message].some(
      (field) => !field || field.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const emailSubject = `New Contact Form Submission: ${subject}`;
  const emailHtmlBody = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #333;">New Message from Your Website's Contact Form</h2>
            <p>You have received a new message from a visitor.</p>
            <hr>
            <p><strong>Name:</strong> ${name} ${lastname || ""}</p>
            <p><strong>Visitor's Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Message:</strong></p>
            <div style="background-color: #f9f9f9; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                <p style="margin: 0;">${message}</p>
            </div>
            <hr>
            <p style="font-size: 12px; color: #888;">You can reply directly to this visitor by replying to this email.</p>
        </div>
    `;

  try {
    await sendEmail(ADMIN_EMAIL, emailSubject, emailHtmlBody);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Message sent successfully!"));
  } catch (error) {
    throw new ApiError(
      500,
      "Failed to send your message. Please try again later."
    );
  }
});

export { handleContactForm };
