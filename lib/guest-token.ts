import { createHash, randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const PEPPER = process.env.GUEST_TOKEN_PEPPER!
const COOKIE_NAME = 'guest_token'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60          // 7일 (전송용, 만료 판단 안 함)
const DB_EXPIRES_HOURS = 24                        // DB 만료 (유일한 만료 판단)
const MAX_GUEST_TOKENS = 5                         // 쿠키 내 최대 토큰 수

export function generateToken(): string {
  return randomUUID()
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw + PEPPER).digest('hex')
}

export function getDbExpiresAt(): string {
  return new Date(Date.now() + DB_EXPIRES_HOURS * 60 * 60 * 1000).toISOString()
}

export async function getTokensFromCookie(): Promise<string[]> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(COOKIE_NAME)?.value
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return raw ? [raw] : []
  }
}

export async function addTokenToCookie(response: NextResponse, newRawToken: string): Promise<void> {
  const existing = await getTokensFromCookie()
  const updated = [newRawToken, ...existing].slice(0, MAX_GUEST_TOKENS)
  response.cookies.set(COOKIE_NAME, JSON.stringify(updated), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
}

export function deleteAllTokenCookies(response: NextResponse): void {
  response.cookies.delete(COOKIE_NAME)
}
