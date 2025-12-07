import Redis from "ioredis";

const REDIS_URL =
  process.env.REDIS_URL ||
  "";

if (!REDIS_URL) {
  console.warn("REDIS_URL is not set. Redis features will be unavailable.");
}

export const redis = REDIS_URL ? new Redis(REDIS_URL) : null;
