import { describe, expect, it } from "vitest";
import { type Bucket, takeToken } from "../src/room/rateLimit";

const LIMIT = { perSecond: 10, burst: 10 };

function take(times: number, bucket: Bucket | undefined, now: number) {
  let current = bucket;
  let allowed = 0;
  for (let i = 0; i < times; i++) {
    const result = takeToken(current, now, LIMIT);
    current = result.bucket;
    if (result.ok) allowed++;
  }
  return { allowed, bucket: current };
}

describe("takeToken", () => {
  it("allows a full burst at once, then refuses", () => {
    expect(take(15, undefined, 0).allowed).toBe(10);
  });

  it("refills at the rate: half a second later, 5 more", () => {
    const { bucket } = take(10, undefined, 0);
    expect(take(15, bucket, 500).allowed).toBe(5);
  });

  it("never stores more than the burst", () => {
    const { bucket } = take(1, undefined, 0);
    expect(take(30, bucket, 60_000).allowed).toBe(10);
  });

  it("steady fast tapping at 8 a second is never refused", () => {
    let bucket: Bucket | undefined;
    let refused = 0;
    for (let i = 0; i < 8 * 60; i++) {
      const result = takeToken(bucket, Math.round((i * 1000) / 8), LIMIT);
      bucket = result.bucket;
      if (!result.ok) refused++;
    }
    expect(refused).toBe(0);
  });
});
