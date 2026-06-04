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

function fromBase64Url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
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

function passwordMatches(password, stored) {
  const calculated = crypto.pbkdf2Sync(
    password,
    stored.salt,
    stored.iterations || PBKDF2_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    stored.digest || "sha256",
  );
  const saved = Buffer.from(stored.hash, "hex");
  return saved.length === calculated.length && crypto.timingSafeEqual(saved, calculated);
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body;
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "");
    const users = await readUsers();
    const user = users.find((candidate) => candidate.email === email);

    if (!user || !passwordMatches(password, user.password)) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = createSessionToken(user);

    return res
      .status(200)
      .setHeader("Set-Cookie", sessionCookie(token))
      .json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    console.error("Login API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}