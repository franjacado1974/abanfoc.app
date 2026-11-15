import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createHash, timingSafeEqual } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Request } from "firebase-functions/v2/https";

if (getApps().length === 0) {
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    const localKeyPath = path.resolve(__dirname, "..", "service-account.local.json");
    if (fs.existsSync(localKeyPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(localKeyPath, "utf8"));
      initializeApp({
        credential: cert(serviceAccount),
        projectId: "app-abanfoc-v1",
      });
      console.info("Firebase Admin SDK inicializado en local con service-account.local.json");
    } else {
      initializeApp({
        projectId: "app-abanfoc-v1",
        serviceAccountId:
          process.env.SERVICE_ACCOUNT_EMAIL || "468455047562-compute@developer.gserviceaccount.com",
      });
    }
  } else {
    initializeApp();
  }
}

const db = getFirestore();
const adminAuth = getAuth();
const makeWebhookUrl = defineSecret("MAKE_ONEDRIVE_WEBHOOK_URL");

// Límite máximo permitido en Salamandra / Cloud Functions v2 (máx. HTTP 32 MB)
const MAX_MAKE_PAYLOAD_BYTES = 25 * 1024 * 1024;

// Protección contra fuerza bruta en memoria (sin escribir en Firestore de producción)
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_FAILURES = 5;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const failedAttemptsStore = new Map<string, RateLimitEntry>();

function getClientIp(req: Request): string {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.ip || "unknown";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = failedAttemptsStore.get(key);
  if (!entry) return false;
  if (now > entry.resetAt) {
    failedAttemptsStore.delete(key);
    return false;
  }
  return entry.count >= RATE_LIMIT_MAX_FAILURES;
}

function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const existing = failedAttemptsStore.get(key);
  if (!existing || now > existing.resetAt) {
    failedAttemptsStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    existing.count += 1;
  }
}

function clearFailedAttempts(key: string): void {
  failedAttemptsStore.delete(key);
}

function safeCompareSecret(input: string, stored: string): boolean {
  const hashA = createHash("sha256").update(input, "utf8").digest();
  const hashB = createHash("sha256").update(stored, "utf8").digest();
  return timingSafeEqual(hashA, hashB) && stored !== "";
}

function normalizeRole(raw: unknown, cleanUsername: string): string {
  let rawRol = String(raw || "").trim().toLowerCase();
  if (!rawRol) {
    if (cleanUsername.includes("super")) rawRol = "super-administrador";
    else if (cleanUsername.includes("admin")) rawRol = "administrador";
    else rawRol = "tecnico";
  }
  if (rawRol === "administracion" || rawRol === "administración" || rawRol === "admin") {
    return "administrador";
  }
  if (
    rawRol === "superadministrador" ||
    rawRol === "superusuario" ||
    rawRol === "super_administrador" ||
    rawRol === "super-usuario"
  ) {
    return "super-administrador";
  }
  return rawRol;
}

/**
 * Intercambia credenciales válidas de la colección "usuarios" de Salamandra
 * por un Firebase Custom Token firmado con Firebase Admin SDK.
 */
export const salamandraAuth = onRequest(
  {
    region: "europe-west1",
    cors: true,
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Método no permitido. Usa POST." });
      return;
    }

    const body = typeof req.body === "object" && req.body ? req.body : {};
    const cleanUsername = String(body.username || "").trim().toLowerCase();
    const cleanPassword = String(body.password || "").trim();

    if (!cleanUsername || !cleanPassword) {
      res.status(400).json({ ok: false, error: "Credenciales no válidas." });
      return;
    }

    const clientIp = getClientIp(req);
    const ipKey = `ip:${clientIp}`;
    const userIpKey = `ip_user:${clientIp}:${cleanUsername}`;

    if (isRateLimited(ipKey) || isRateLimited(userIpKey)) {
      res.status(429).json({
        ok: false,
        error: "Demasiados intentos fallidos. Espera 15 minutos antes de volver a intentarlo.",
      });
      return;
    }

    try {
      const snap = await db.collection("usuarios").get();
      let matchedDocId: string | null = null;
      let matchedRol = "tecnico";

      for (const doc of snap.docs) {
        const data = doc.data() || {};
        const uUsuario = String(data.usuario ?? "").trim().toLowerCase();
        const uNombre = String(data.nombre ?? "").trim().toLowerCase();
        const uApellidos = String(data.apellidos ?? "").trim().toLowerCase();
        const uFullName = `${uNombre} ${uApellidos}`.trim().toLowerCase();
        const uEmail = String(data.email ?? "").trim().toLowerCase();

        const isUserMatch =
          (uUsuario !== "" && uUsuario === cleanUsername) ||
          (uNombre !== "" && uNombre === cleanUsername) ||
          (uFullName !== "" && uFullName === cleanUsername) ||
          (uEmail !== "" && uEmail === cleanUsername);

        if (!isUserMatch) continue;

        const storedPassword = String(
          data["contraseña"] ?? data.contrasena ?? data.password ?? data.clave ?? ""
        ).trim();

        const passwordOk = safeCompareSecret(cleanPassword, storedPassword);
        if (passwordOk && data.activo !== false) {
          matchedDocId = doc.id;
          matchedRol = normalizeRole(data.rol, cleanUsername);
        }
        break;
      }

      if (!matchedDocId) {
        // Comparación ficticia para mantener tiempo uniforme y no revelar si el usuario existe
        safeCompareSecret(cleanPassword, "dummy_constant_time_padding");
        recordFailedAttempt(ipKey);
        recordFailedAttempt(userIpKey);
        res.status(401).json({ ok: false, error: "Credenciales no válidas." });
        return;
      }

      clearFailedAttempts(ipKey);
      clearFailedAttempts(userIpKey);

      const customToken = await adminAuth.createCustomToken(matchedDocId, {
        salamandraUser: true,
        rol: matchedRol,
      });

      res.status(200).json({
        ok: true,
        customToken,
      });
    } catch (err: any) {
      console.error("Error en salamandraAuth:", err);
      res.status(500).json({
        ok: false,
        errorCode: err?.errorInfo?.code || err?.code || "internal",
        error: err?.message || "No se pudo verificar la autenticación en este momento.",
      });
    }
  }
);

/**
 * Verifica el Firebase Authentication ID Token enviado en Authorization: Bearer <token>
 */
async function verifyFirebaseBearerToken(req: Request): Promise<{ uid: string; rol: string } | null> {
  const authHeader = String(req.headers.authorization || "");
  if (!authHeader.startsWith("Bearer ")) {
    console.warn("onedriveProxy auth rejected: missing_bearer_header");
    return null;
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    console.warn("onedriveProxy auth rejected: empty_bearer_token");
    return null;
  }

  const decoded = await adminAuth.verifyIdToken(idToken, true);
  if (!decoded || decoded.salamandraUser !== true) {
    console.warn("onedriveProxy auth rejected: missing_salamandraUser_claim", {
      hasDecoded: Boolean(decoded),
      salamandraUser: decoded?.salamandraUser,
      signInProvider: decoded?.firebase?.sign_in_provider,
    });
    return null;
  }

  // Confirmar que el usuario sigue existiendo y activo en Firestore
  const userSnap = await db.collection("usuarios").doc(decoded.uid).get();
  if (!userSnap.exists) {
    console.warn("onedriveProxy auth rejected: user_doc_not_found_in_usuarios");
    return null;
  }
  if (userSnap.data()?.activo === false) {
    console.warn("onedriveProxy auth rejected: user_inactive");
    return null;
  }

  return {
    uid: decoded.uid,
    rol: String(decoded.rol || ""),
  };
}

export const onedriveProxy = onRequest(
  {
    region: "europe-west1",
    cors: true,
    secrets: [makeWebhookUrl],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Método no permitido. Usa POST." });
      return;
    }

    // 1. Verificar Firebase ID Token firmado
    try {
      const verified = await verifyFirebaseBearerToken(req);
      if (!verified) {
        res.status(401).json({
          ok: false,
          error: "Token de autenticación de Firebase inválido o ausente.",
        });
        return;
      }
    } catch (authErr) {
      console.error("Error verificando Firebase ID Token:", authErr);
      res.status(401).json({
        ok: false,
        error: "La sesión firmada ha caducado o no es válida. Inicia sesión de nuevo.",
      });
      return;
    }

    // 2. Comprobar límite de 5 MB de Make antes de reenviar
    const rawBody = req.rawBody;
    const contentLengthHeader = Number(req.headers["content-length"] || 0);
    const payloadSize = rawBody ? rawBody.length : contentLengthHeader;

    if (!rawBody || rawBody.length === 0) {
      res.status(400).json({ ok: false, error: "Cuerpo de la petición vacío." });
      return;
    }

    if (payloadSize > MAX_MAKE_PAYLOAD_BYTES) {
      res.status(413).json({
        ok: false,
        error: "El archivo supera el límite máximo de 25 MB permitido.",
      });
      return;
    }

    // 3. Obtener URL secreta del Webhook de Make
    const webhookUrl = makeWebhookUrl.value().trim();
    if (!webhookUrl) {
      res.status(500).json({
        ok: false,
        error: "El secreto MAKE_ONEDRIVE_WEBHOOK_URL no está configurado en Firebase.",
      });
      return;
    }

    // 4. Reenviar petición multipart/form-data servidor-a-servidor a Make
    try {
      const contentType = String(req.headers["content-type"] || "application/octet-stream");
      const makeRes = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
        },
        body: new Uint8Array(rawBody),
      });

      const rawText = await makeRes.text().catch(() => "");
      if (!makeRes.ok) {
        if (makeRes.status === 413) {
          res.status(413).json({
            ok: false,
            error:
              "Make.com rechazó el archivo (HTTP 413) porque sus Webhooks tienen un límite estricto de 5 MB en el cuerpo de la petición.",
          });
          return;
        }
        res.status(makeRes.status).json({
          ok: false,
          error: rawText || `Make respondió con error HTTP ${makeRes.status}.`,
        });
        return;
      }

      let parsed: Record<string, any> | null = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      const hasWebhookResponse = Boolean(parsed && typeof parsed === "object");
      const itemId = hasWebhookResponse
        ? String(parsed?.id || parsed?.itemId || parsed?.onedriveItemId || parsed?.fileId || parsed?.FileID || "")
        : "";
      const itemName = hasWebhookResponse
        ? String(parsed?.nombre || parsed?.name || parsed?.fileName || parsed?.Name || "")
        : "";
      const webUrl = hasWebhookResponse
        ? String(
            parsed?.webUrl ||
              parsed?.web_url ||
              parsed?.WebUrl ||
              parsed?.WebURL ||
              parsed?.shareLink ||
              parsed?.share_link ||
              parsed?.ShareLink ||
              parsed?.url ||
              parsed?.link ||
              ""
          )
        : "";
      const downloadUrl = hasWebhookResponse
        ? String(
            parsed?.downloadUrl ||
              parsed?.download_url ||
              parsed?.DownloadUrl ||
              parsed?.DownloadURL ||
              parsed?.["@microsoft.graph.downloadUrl"] ||
              ""
          )
        : "";

      console.info("onedriveProxy Make response:", {
        status: makeRes.status,
        hasWebhookResponse,
        keys: hasWebhookResponse && parsed ? Object.keys(parsed) : [],
        rawPreview: !hasWebhookResponse ? rawText.slice(0, 120) : undefined,
        hasWebUrl: Boolean(webUrl),
        hasDownloadUrl: Boolean(downloadUrl),
      });

      res.status(200).json({
        ok: true,
        id: itemId,
        nombre: itemName,
        webUrl,
        downloadUrl,
        hasWebhookResponse,
      });
    } catch (err: any) {
      console.error("Error reenviando archivo a Make:", err);
      res.status(502).json({
        ok: false,
        error: err?.message || "No se pudo conectar con el Webhook de Make desde Cloud Functions.",
      });
    }
  }
);
