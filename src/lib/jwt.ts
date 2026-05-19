import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const EXPIRES_IN = "30d";

export type JWTPayload = {
  userId: string;
  email: string;
};

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, SECRET as string, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET as string) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}
