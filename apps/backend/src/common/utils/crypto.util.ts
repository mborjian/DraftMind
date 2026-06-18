import { randomBytes, createHash } from 'node:crypto';

export function createOpaqueToken(byteLength: number = 32): string {
  return randomBytes(byteLength).toString('hex');
}

export function createNumericOtp(length: number = 6): string {
  const digits = Array.from(randomBytes(length)).map((value) => (value % 10).toString());
  return digits.join('').slice(0, length);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
