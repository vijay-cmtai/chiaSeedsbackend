import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { sendEmail } from "../utils/mailer.js";
import crypto from "crypto";

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// --- FIX 1: Corrected User Registration Logic ---
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if ([name, email, password].some((field) => !field || field.trim() === "")) {
    throw new ApiError(400, "Name, email, and password are required");
  }

  const existingUser = await User.findOne({ email });
  const otp = generateOtp();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const emailHtml = `
    <div style="font-family: sans-serif; text-align: center; padding: 20px;">
      <h2>Welcome to Chia!</h2>
      <p>Hi ${name},</p>
      <p>Thank you for registering. Please use the following One-Time Password (OTP) to verify your email address. This OTP is valid for 10 minutes.</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; background-color: #f0f0f0; padding: 10px 20px; border-radius: 5px; display: inline-block;">
        ${otp}
      </p>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  `;

  if (existingUser) {
    if (existingUser.isVerified) {
      throw new ApiError(409, "User with this email is already registered.");
    }
    // If user exists but is not verified, update their details and send a new OTP
    existingUser.password = password;
    existingUser.fullName = name;
    existingUser.otp = otp;
    existingUser.otpExpiry = otpExpiry;
    await existingUser.save({ validateBeforeSave: true });

    await sendEmail(email, "Verify Your Email Address", emailHtml);
    
    return res
      .status(200)
      .json(
        new ApiResponse(200, { email }, "Account exists. A new OTP has been sent.")
      );
  }

  // Create a new user and ensure they are NOT verified by default
  await User.create({
    fullName: name,
    email,
    password,
    role: role && role.toLowerCase() === "admin" ? "admin" : "user",
    otp,
    otpExpiry,
    isVerified: false, // This is the crucial fix
  });

  await sendEmail(email, "Verify Your Email Address", emailHtml);

  return res
    .status(201)
    .json(
      new ApiResponse(201, { email }, "User registered successfully. Please check your email for the OTP.")
    );
});


// --- FIX 2: Verify OTP and Automatically Log In the User ---
const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required");
  }

  const user = await User.findOne({
    email,
    otp,
    otpExpiry: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, "Invalid or expired OTP.");
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save({ validateBeforeSave: false });

  // After successful verification, log the user in by creating and sending a token
  const accessToken = user.generateAccessToken();
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken },
        "Email verified successfully. You are now logged in."
      )
    );
});


const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(404, "User with this email does not exist.");
  }

  // This check is now effective because new users are saved with isVerified: false
  if (!user.isVerified) {
    throw new ApiError(403, "Email not verified. Please verify your account first.");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials.");
  }

  const accessToken = user.generateAccessToken();
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken },
        "User logged in successfully"
      )
    );
});


const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    // To prevent email enumeration, always send a success-like response
    return res
      .status(200)
      .json(
        new ApiResponse(200, {}, "If a user with this email exists, a password reset link has been sent.")
      );
  }

  const resetToken = user.getForgotPasswordToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  const emailHtml = `...`; // Your forgot password email HTML

  try {
    await sendEmail(email, "Password Reset Request", emailHtml);
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "A password reset link has been sent to your email."));
  } catch (error) {
    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(500, "Failed to send password reset email. Please try again later.");
  }
});


const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) {
    throw new ApiError(400, "New password is required");
  }

  const forgotPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    forgotPasswordToken,
    forgotPasswordExpiry: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, "Invalid or expired password reset token.");
  }

  user.password = password;
  user.forgotPasswordToken = undefined;
  user.forgotPasswordExpiry = undefined;
  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password has been reset successfully."));
});


const changeCurrentUserPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "Old password and new password are required");
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!user) { throw new ApiError(404, "User not found"); }

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) { throw new ApiError(401, "Invalid old password"); }

  user.password = newPassword;
  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully."));
});


export {
  registerUser,
  verifyOtp,
  loginUser,
  forgotPassword,
  resetPassword,
  changeCurrentUserPassword,
};
