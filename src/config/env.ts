import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: process.env.PORT as string,
  mongoUri: process.env.MONGO_URI as string,
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET as string,
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN as string,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET as string,
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN as string,
  emailUser: process.env.EMAIL_USER as string,
  emailPass: process.env.EMAIL_PASS as string,
  huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY as string,
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY as string,
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET as string,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID as string,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET as string,
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET as string,
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() as string,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() as string,
  nodeEnv: process.env.NODE_ENV || "development",
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  runMigration: process.env.RUN_MIGRATION === "true",
};
