import { SignJWT, jwtVerify } from 'jose';

interface TokenPayload {
  user_id: number;
  username: string;
  role: string;
  tenant_id: number | null;
  token_version: number;
}

export async function createToken(payload: TokenPayload, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(key);
}

export async function verifyToken(token: string, secret: string): Promise<TokenPayload> {
  const key = new TextEncoder().encode(secret);
  const { payload } = await jwtVerify(token, key);
  return payload as unknown as TokenPayload;
}
