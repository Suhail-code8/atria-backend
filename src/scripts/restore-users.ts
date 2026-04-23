import mongoose from "mongoose";
import dotenv from "dotenv";
import { User, UserRole } from "../modules/users/user.model";

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/atria";

const usersData = [
  {
    _id: "699e8ffdfea0115281f36bd0",
    name: "Muhammad Suhail",
    email: "muhammedsuhail6444@gmail.com",
    password: "$2b$10$tIatBxIPaTJlo9yTY93GNOcExTVKVIRGaHxcTm9ztHMQEfFS0R.KS",
    role: UserRole.ORGANIZER,
    refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTllOGZmZGZlYTAxM…",
    isPlaceholder: false,
    createdAt: new Date("2026-02-25T06:00:29.745Z"),
    updatedAt: new Date("2026-04-22T05:40:56.612Z"),
    __v: 0
  },
  {
    _id: "699e964d7d31d154ffd46e2b",
    name: "Sherlock Holmes",
    email: "sherlockholmesmarch8@gmail.com",
    password: "$2b$10$Nfy9KKS6zWwGDI0IIE1dpOtsdNchLPt.geX8TII.SvoFlBNEVHOfS",
    role: UserRole.PARTICIPANT,
    refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTllOTY0ZDdkMzFkM…",
    isPlaceholder: false,
    createdAt: new Date("2026-02-25T06:27:25.954Z"),
    updatedAt: new Date("2026-04-22T05:39:41.751Z"),
    __v: 0
  },
  {
    _id: "699ea0d4ff35ef70d9e4e5dd",
    name: "Nirooz",
    email: "nirooz@gmail.com",
    password: "$2b$10$8//Ue8eLhUK.KSKrCtv/5.9q64LC/w5mxFSZ.zVeX2u0xkJgYkQi6",
    role: UserRole.PARTICIPANT,
    refreshToken: null,
    isPlaceholder: true,
    createdAt: new Date("2026-02-25T07:12:20.188Z"),
    updatedAt: new Date("2026-02-25T07:12:20.188Z"),
    __v: 0
  },
  {
    _id: "69a12a235cb6924968824397",
    name: "Jaseem VT",
    email: "vtjaseem7@gmail.com",
    password: "$2b$10$Do.6VA5PA0edLjdR44taU.0giVokpQWV/MqKip/5aZdgrv.1UUYQW",
    role: UserRole.PARTICIPANT,
    refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWExMmEyMzVjYjY5M…",
    isPlaceholder: false,
    createdAt: new Date("2026-02-27T05:22:43.512Z"),
    updatedAt: new Date("2026-04-22T04:24:23.738Z"),
    __v: 0
  },
  {
    _id: "69a13ca7a76ac99f21f361b4",
    name: "Muhammad Suhail",
    email: "muhammadsuhail6444@gmail.com",
    password: "$2b$10$XDy6WZ83unpXG7J3njsVVetuUPAqKtGUkNLNgfK2ERuFFKloHo8i.",
    role: UserRole.JUDGE,
    refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OWExM2NhN2E3NmFjO…",
    isPlaceholder: false,
    createdAt: new Date("2026-02-27T06:41:43.020Z"),
    updatedAt: new Date("2026-04-22T01:53:05.666Z"),
    __v: 0
  },
  {
    _id: "69a55279204229fee33fd7c5",
    name: "John Doe",
    email: "john@gmail.com",
    password: "$2b$10$WTYn.XH3AWq2aGI/uByFqeba39e4C.jIqoGv6/XpOYZ6MBF5LN6/m",
    role: UserRole.ORGANIZER,
    refreshToken: null,
    isPlaceholder: false,
    createdAt: new Date("2026-03-02T09:03:53.219Z"),
    updatedAt: new Date("2026-03-06T04:01:41.988Z"),
    __v: 0
  },
  {
    _id: "69aa53a8b4a72f037a4cf492",
    name: "Kanaran",
    email: "kanaran@gmail.com",
    password: "$2b$10$XYh2v0T2jVOljs/bOAmPEutBrYkZPeFVLZjba5XnfuE5WjTU3b7UO",
    role: UserRole.PARTICIPANT,
    refreshToken: null,
    isPlaceholder: true,
    createdAt: new Date("2026-03-06T04:10:16.466Z"),
    updatedAt: new Date("2026-03-06T04:10:16.466Z"),
    __v: 0
  },
  {
    _id: "69aa553fb4a72f037a4cf608",
    name: "Jonathen",
    email: "jonathen@gmail.com",
    password: "$2b$10$q9u2oAsIOJcAfq26Tb9PMu72.K9u4u./E4XPX3OI.VTlHSlJz5Sru",
    role: UserRole.PARTICIPANT,
    refreshToken: null,
    isPlaceholder: false,
    createdAt: new Date("2026-03-06T04:17:03.722Z"),
    updatedAt: new Date("2026-03-13T04:25:33.678Z"),
    __v: 0
  },
  {
    _id: "69e6ea744b362149c314e64b",
    name: "Organizer",
    email: "organizer@placeholder.internal",
    password: "$2b$10$fzRHaltUieWHqIEY26oFgeAmQcEnI/az5WTOaaRbvrJmltAE50QeW",
    role: UserRole.PARTICIPANT,
    refreshToken: null,
    isPlaceholder: true,
    createdAt: new Date("2026-04-21T03:09:40.537Z"),
    updatedAt: new Date("2026-04-21T03:09:40.537Z"),
    __v: 0
  }
];

const restoreUsers = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);

    console.log("🧹 Clearing existing users (if any)...");
    await User.deleteMany({});

    console.log(`💉 Injecting ${usersData.length} users...`);
    await User.insertMany(usersData);

    console.log("✅ Users successfully restored!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error restoring users:", error);
    process.exit(1);
  }
};

restoreUsers();
