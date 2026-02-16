import nodemailer from "nodemailer";
import { env } from "../config/env";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.emailUser,
    pass: env.emailPass
  }
});

export const sendEmail = async (
  to: string,
  subject: string,
  html: string
): Promise<boolean> => {
  try {
    if (!env.emailUser || !env.emailPass) {
      console.error("Email configuration missing: EMAIL_USER or EMAIL_PASS is not set");
      return false;
    }

    await transporter.sendMail({
      from: env.emailUser,
      to,
      subject,
      html
    });

    console.log(`Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
};
