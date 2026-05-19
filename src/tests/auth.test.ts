import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "@/lib/jwt";

describe("jwt", () => {
  it("round-trips a payload", () => {
    const token = signToken({ userId: "u_1", email: "a@b.com" });
    const decoded = verifyToken(token);
    expect(decoded?.userId).toBe("u_1");
    expect(decoded?.email).toBe("a@b.com");
  });

  it("returns null for an invalid token", () => {
    expect(verifyToken("not.a.real.token")).toBeNull();
  });
});
