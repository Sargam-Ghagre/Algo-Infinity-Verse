import { initializeFirebase, getDb, COLLECTIONS } from "../firebase.js";
import crypto from "crypto";

const SESSION_COOKIE = "aiv_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 210000;
const PASSWORD_KEY_LENGTH = 32;

const db = initializeFirebase();
const useFirestore = !!db;

async function readUsers() {
  if (!useFirestore) {
    return [];
  }
  try {
    const snapshot = await db.collection(COLLECTIONS.USERS).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Firestore read error:", error);
    return [];
  }
}

async function writeUsers(users) {
  // Not needed for Firestore - users created individually
}

function sessionSecret() {
  return process.env.SESSION_SECRET || "dev-only-change-me-with-SESSION_SECRET-before-deploying";
}

function sign(value) {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createSessionToken(user) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      sub: user.id,
      name: user.name,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    }),
  );
  const body = `${header}.${payload}`;
  return `${body}.${sign(body)}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PASSWORD_KEY_LENGTH, "sha256")
    .toString("hex");
  return { salt, hash, iterations: PBKDF2_ITERATIONS, digest: "sha256" };
}

function sessionCookie(token) {
  const secure = process.env.VERCEL === "1";
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function validateSignup({ name, email, password, confirmPassword }) {
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const rawPassword = String(password || "");
  const rawConfirm = String(confirmPassword || "");

  if (cleanName.length < 2) return "Name must be at least 2 characters.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return "Enter a valid email address.";
  }
  if (rawPassword.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(rawPassword) || !/[A-Z]/.test(rawPassword) || !/\d/.test(rawPassword)) {
    return "Password must include uppercase, lowercase, and a number.";
  }
  if (rawPassword !== rawConfirm) return "Passwords do not match.";
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body;
    const validationError = validateSignup(payload);
    if (validationError) return res.status(400).json({ error: validationError });

    const users = await readUsers();
    const email = String(payload.email).trim().toLowerCase();
    if (users.some((user) => user.email === email)) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const user = {
      id: crypto.randomUUID(),
      name: String(payload.name).trim(),
      email,
      password: hashPassword(String(payload.password)),
      createdAt: new Date().toISOString(),
    };

    if (useFirestore) {
      const { addDoc } = await import("firebase/firestore");
      await addDoc(db.collection(COLLECTIONS.USERS), user);
    }

    const token = createSessionToken(user);

    return res
      .status(201)
      .setHeader("Set-Cookie", sessionCookie(token))
      .json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Signup API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}