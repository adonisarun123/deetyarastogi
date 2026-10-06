// Allows the browser to PUT photos directly to the private `media` bucket via short-lived
// signed URLs (needed because serverless hosts cap request bodies far below 20 MB).
// Usage: node scripts/storage-cors.mjs https://yourdomain.com [https://another-origin]
import { PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET } from "./_env.mjs";

const origins = [...process.argv.slice(2), process.env.SITE_URL, "http://localhost:3000"].filter(Boolean).map((o) => o.replace(/\/$/, ""));
const client = await s3();
await client.send(
  new PutBucketCorsCommand({
    Bucket: BUCKET,
    CORSConfiguration: {
      CORSRules: [{ AllowedOrigins: [...new Set(origins)], AllowedMethods: ["PUT"], AllowedHeaders: ["*"], MaxAgeSeconds: 3600 }],
    },
  }),
);
const now = await client.send(new GetBucketCorsCommand({ Bucket: BUCKET }));
console.log(`CORS on bucket "${BUCKET}":`, JSON.stringify(now.CORSRules));
