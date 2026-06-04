const SESSION_COOKIE = "aiv_session";

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res
    .status(200)
    .setHeader("Set-Cookie", clearSessionCookie())
    .json({ ok: true });
}