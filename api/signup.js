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
function createSessionToken(u) { const h=b64u(JSON.stringify({alg:"HS256",typ:"JWT"})); const p=b64u(JSON.stringify({sub:u.id,name:u.name,email:u.email,exp:Math.floor(Date.now()/1000)+SESSION_MAX_AGE_SECONDS})); return `${h}.${p}.${sign(`${h}.${p}`)}`; }
function hashPassword(p, s=crypto.randomBytes(16).toString("hex")) { return {salt:s,hash:crypto.pbkdf2Sync(p,s,PBKDF2_ITERATIONS,PASSWORD_KEY_LENGTH,"sha256").toString("hex"),iterations:PBKDF2_ITERATIONS,digest:"sha256"}; }
function sessionCookie(t) { const sec=process.env.VERCEL==="1"; return [`${SESSION_COOKIE}=${encodeURIComponent(t)}`,"HttpOnly","SameSite=Lax","Path=/",`Max-Age=${SESSION_MAX_AGE_SECONDS}`,sec?"Secure":""].filter(Boolean).join("; "); }

async function readUsers() { if(!useFirestore)return[]; try{const s=await db.collection("users").get();return s.docs.map(d=>({id:d.id,...d.data()}));}catch(e){console.error(e);return[];} }

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const {name,email,password,confirmPassword}=req.body;
    const cleanName=String(name||"").trim(),cleanEmail=String(email||"").trim().toLowerCase(),rp=String(password||""),rc=String(confirmPassword||"");
    if(cleanName.length<2)return res.status(400).json({error:"Name must be at least 2 characters."});
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))return res.status(400).json({error:"Enter a valid email address."});
    if(rp.length<8)return res.status(400).json({error:"Password must be at least 8 characters."});
    if(!/[a-z]/.test(rp)||!/[A-Z]/.test(rp)||!/\d/.test(rp))return res.status(400).json({error:"Password must include uppercase, lowercase, and a number."});
    if(rp!==rc)return res.status(400).json({error:"Passwords do not match."});
    const users=await readUsers();
    if(users.some(u=>u.email===cleanEmail))return res.status(409).json({error:"An account with this email already exists."});
    const user={id:crypto.randomUUID(),name:cleanName,email:cleanEmail,password:hashPassword(rp),createdAt:new Date().toISOString()};
    if(useFirestore){await db.collection("users").add(user);}
    const token=createSessionToken(user);
    return res.status(201).setHeader("Set-Cookie",sessionCookie(token)).json({user:{id:user.id,name:user.name,email:user.email}});
  } catch(e){console.error(e);return res.status(500).json({error:"Internal server error"});}
}