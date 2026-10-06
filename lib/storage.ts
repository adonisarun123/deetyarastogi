import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Neon Object Storage is S3-compatible (path-style only). `neon deploy` injects
// AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3 and AWS_REGION.
// Without them we fall back to a local folder (development only).

export const BUCKET = process.env.MEDIA_BUCKET || "media";

export function storageDriver(): "s3" | "local" {
  if (process.env.STORAGE_DRIVER === "local") return "local";
  return process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID ? "s3" : "local";
}

let _s3: S3Client | null = null;
function s3() {
  if (!_s3) {
    _s3 = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      endpoint: process.env.AWS_ENDPOINT_URL_S3,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _s3;
}

const LOCAL_ROOT = process.env.LOCAL_STORAGE_DIR || join(/*turbopackIgnore: true*/ process.cwd(), ".storage");

function localPath(key: string) {
  const p = normalize(join(/*turbopackIgnore: true*/ LOCAL_ROOT, key));
  if (!p.startsWith(normalize(LOCAL_ROOT))) throw new Error("Invalid key");
  return p;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (storageDriver() === "s3") {
    await s3().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
    return;
  }
  const p = localPath(key);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, body);
}

export async function getObject(key: string): Promise<Buffer | null> {
  if (storageDriver() === "s3") {
    try {
      const res = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      const bytes = await res.Body!.transformToByteArray();
      return Buffer.from(bytes);
    } catch (e) {
      const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }
  try {
    return await readFile(localPath(key));
  } catch {
    return null;
  }
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  if (storageDriver() === "s3") {
    try {
      const res = await s3().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      return { size: Number(res.ContentLength ?? 0) };
    } catch {
      return null;
    }
  }
  try {
    const s = await stat(localPath(key));
    return { size: s.size };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string) {
  if (storageDriver() === "s3") {
    await s3().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return;
  }
  await rm(localPath(key), { force: true });
}

function localSecret() {
  return process.env.SESSION_SECRET || process.env.AUTH_SECRET || "local-dev-secret";
}

export function signLocalUpload(key: string, expires: number) {
  return createHmac("sha256", localSecret()).update(`${key}|${expires}`).digest("base64url");
}

export function verifyLocalUpload(key: string, expires: number, sig: string) {
  if (Date.now() / 1000 > expires) return false;
  const expected = Buffer.from(signLocalUpload(key, expires));
  const got = Buffer.from(sig);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Short-lived direct upload URL for the browser. The original stays private. */
export async function presignUpload(key: string, contentType: string): Promise<{ url: string; method: "PUT" }> {
  if (storageDriver() === "s3") {
    const url = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }), {
      expiresIn: 600,
    });
    return { url, method: "PUT" };
  }
  const expires = Math.floor(Date.now() / 1000) + 600;
  const sig = signLocalUpload(key, expires);
  return {
    url: `/api/media/local-upload?key=${encodeURIComponent(key)}&expires=${expires}&sig=${sig}`,
    method: "PUT",
  };
}
