// Scheduled upkeep, called by the GitHub Actions workflow (no secrets needed):
//   ?job=ping    keeps the free project awake
//   ?job=cleanup swaps old videos for their still frame and deletes the video file
//   ?job=backup  returns every table, encrypted with Spark's public key (only the private key opens it)
// Each job is rate-limited in the database, so calling it from anywhere is harmless.
import { createClient } from "jsr:@supabase/supabase-js@2";

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAl76NkQbk08YVnkjFp6LZ
V/tEweSBn2GuCV/p7et0QdZZFKsfgeISBAcFLZtsPnwbbVueLsPs2CKuXZC0v1D4
XO5DUaiZu4kdRklq+gStbsiqwx5CIeiGy9EObyz+63NVM4IBPSa6W8eHOUnjb9zf
TK0k71XNISZrWMGUuWTaH0T2cVzkHSnxSLUl3AAS/KzyqMQhtw2uhnH7IffX3Shl
hjQIVlY/+lAWLlbvI7y216Sn/yhBiExPUBPqafz7IAeZRtjtBGn3R5+AGMLZwAcV
Rx+XvzT8QxIS2KRMKCdO4DRX7OQALyQT/cqZXx4sXI++1C1x/l3ZUdJraB4TYUhr
Be4eQqQGNNoIgX2Nz9B+yDaPnt91egClxz1hrrBg4fbEiCqe1YNVbk1AUr+vPm+p
bbdVv2eIc0AkVkbg5bMAxJKaN0vuqtGGQkyYQd7nvGFJ+kmLzFEFMTzsrLooCfDq
3IsZfm84wkEycMQxliaFbkB6STnYFU3jZMyvIpHVaapc870ystq8v4O16FHhlfOW
6HmWwFP6BaP6m9CxQhX4/6rdPFoIR1fgqqVBQWHQbeCZlJlGOlAgmWqkcykRAqyf
64sk3yH5llfGnZSjwEOuvtMx90C9PTS2vHaowRVJuOXWrbWKz0oASPpSiWRrXYaj
J35EkUjkWwR/LYsmX50XWXMCAwEAAQ==
-----END PUBLIC KEY-----`;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const b64chunks = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

async function encrypt(plain: Uint8Array) {
  const der = Uint8Array.from(atob(PUBLIC_KEY.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
  const rsa = await crypto.subtle.importKey("spki", der, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const aes = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, plain));
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", aes));
  const key = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, rsa, rawKey));
  return { v: 1, alg: "RSA-OAEP-256+A256GCM", key: b64(key), iv: b64(iv), data: b64chunks(data) };
}

async function claim(job: string, minutes: number) {
  const { data, error } = await db.rpc("svc_claim_job", { p_job: job, p_gap_minutes: minutes });
  if (error) throw error;
  return data === true;
}

Deno.serve(async (req) => {
  const job = new URL(req.url).searchParams.get("job") || "ping";
  try {
    if (job === "ping") {
      const { count } = await db.from("profiles").select("id", { count: "exact", head: true });
      return json({ ok: true, profiles: count });
    }
    if (job === "cleanup") {
      if (!(await claim("cleanup", 360))) return json({ ok: true, skipped: "ran recently" });
      const { data, error } = await db.rpc("svc_expire_old_videos");
      if (error) throw error;
      const paths = (data as string[]).filter(Boolean);
      if (paths.length) await db.storage.from("media").remove(paths);
      return json({ ok: true, removed: paths.length });
    }
    if (job === "backup") {
      if (!(await claim("backup", 10))) return json({ ok: false, skipped: "ran recently" }, 429);
      const { data, error } = await db.rpc("svc_backup_dump");
      if (error) throw error;
      const plain = new TextEncoder().encode(JSON.stringify(data));
      return json(await encrypt(plain));
    }
    return json({ ok: false, error: "unknown job" }, 400);
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message || e) }, 500);
  }
});
