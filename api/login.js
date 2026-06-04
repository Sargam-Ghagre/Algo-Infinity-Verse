import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

let db = null;
let useFirestore = false;

function initFirebase() {
  if (getApps().length > 0) { db = getFirestore(); useFirestore = true; return; }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) { console.warn("Firebase credentials not set."); return; }
  try { initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }); db = getFirestore(); useFirestore = true; }
  catch (e) { console.error(e); }
}
initFirebase();

const SESSION_COOKIE = "aiv_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 210000;
const PASSWORD_KEY_LENGTH = 32;

function sessionSecret() { return process.env.SESSION_SECRET || "dev-only-change-me-with-SESSION_SECRET-before-deploying"; }
function sign(v) { return crypto.createHmac("sha256", sessionSecret()).update(v).digest("base64url"); }
function b64u(i) { return Buffer.from(i).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_"); }
function fromB64u(i) { return Buffer.from(i.replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8"); }
function createSessionToken(u) { const h=b64u(JSON.stringify({alg:"HS256",typ:"JWT"})); const p=b64u(JSON.stringify({sub:u.id,name:u.name,email:u.email,exp:Math.floor(Date.now()/1000)+SESSION_MAX_AGE_SECONDS})); return `${h}.${p}.${sign(`${h}.${p}`)}`; }
function passwordMatches(p, s) { const c=crypto.pbkdf2Sync(p,s.salt,s.iterations||PBKDF2_ITERATIONS,PASSWORD_KEY_LENGTH,s.digest||"sha256"); const b=Buffer.from(s.hash,"hex"); return b.length===c.length&&crypto.timingSafeEqual(b,c); }
function sessionCookie(t) { const sec=process.env.VERCEL==="1"; return [`${SESSION_COOKIE}=${encodeURIComponent(t)}`,"HttpOnly","SameSite=Lax","Path=/",`Max-Age=${SESSION_MAX_AGE_SECONDS}`,sec?"Secure":""].filter(Boolean).join("; "); }

async function readUsers() { if(!useFirestore)return[]; try{const s=await db.collection("users").get();return s.docs.map(d=>({id:d.id,...d.data()}));}catch(e){console.error(e);return[];} }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const {email,password}=req.body;
    const cleanEmail=String(email||"").trim().toLowerCase(),pwd=String(password||"");
    const users=await readUsers();
    const user=users.find(u=>u.email===cleanEmail);
    if(!user||!passwordMatches(pwd,user.password))return res.status(401).json({error:"Invalid email or password."});
    const token=createSessionToken(user);
    return res.status(200).setHeader("Set-Cookie",sessionCookie(token)).json({user:{id:user.id,name:user.name,email:user.email}});
  } catch(e){console.error(e);return res.status(500).json({error:"Internal server error"});}
}