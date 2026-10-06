import { defineConfig } from "@neon/config/v1";

// Neon backend for the Baking Scrapbook.
// - Postgres is always present (DATABASE_URL).
// - `media` bucket: PRIVATE. Originals and web derivatives live here; the app decides what is
//   public (only photos used by published entries), so the bucket itself must never be public_read.
// Apply with `neon deploy`; it writes the AWS_* storage credentials into .env.local.
export default defineConfig({
  buckets: {
    media: { access: "private" },
  },
});
