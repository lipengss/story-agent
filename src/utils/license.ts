import { saveToStorage, loadFromStorage } from './storage'

const LICENSE_API_URL = 'https://license.speedstory.cn/api/verify'
const API_KEY = 'ak-052c3ec3bfde4f71bef3b4ae4e9c07d6'
const LICENSE_STORAGE_KEY = 'license'
const DEVICE_ID_KEY = 'device_id'

export interface LicenseState {
  activated: boolean
  code: string
  deviceId: string
  expiresAt?: string
}

export interface VerifyResult {
  valid: boolean
  reason?: 'invalid' | 'already_activated' | 'revoked' | 'expired'
  expiresAt?: string
}

/** Generate or retrieve a persistent device identifier */
export function getDeviceId(): string {
  const stored = loadFromStorage<string>(DEVICE_ID_KEY, '')
  if (stored) return stored
  const id = crypto.randomUUID()
  saveToStorage(DEVICE_ID_KEY, id)
  return id
}

/** Get the saved license state, if any */
export function getSavedLicense(): LicenseState | null {
  return loadFromStorage<LicenseState | null>(LICENSE_STORAGE_KEY, null)
}

/** Persist license state to localStorage (and Electron disk via saveToStorage bridge) */
export function saveLicense(state: LicenseState): void {
  saveToStorage(LICENSE_STORAGE_KEY, state)
}

/** Check whether the current license is valid and not expired */
export function isLicenseValid(): boolean {
  const license = getSavedLicense()
  if (!license?.activated) return false
  if (license.expiresAt && new Date(license.expiresAt) <= new Date()) return false
  return true
}

/** Call the license verification API */
export async function verifyLicense(code: string): Promise<VerifyResult> {
  const deviceId = getDeviceId()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'x-client-version': '1.0.0',
  }

  const body = JSON.stringify({ code, deviceId })

  const electron = (window as any).electronAPI
  let ok: boolean
  let text: string

  if (electron) {
    // Electron: proxy through main process (no CORS issues)
    const result = await electron.apiFetch(LICENSE_API_URL, {
      method: 'POST',
      headers,
      body,
    })
    ok = result.ok
    text = result.text
    if (!result.ok && result.error) {
      throw new Error(result.error)
    }
  } else {
    // Browser / dev mode: direct fetch (may need CORS handling)
    const response = await fetch(LICENSE_API_URL, {
      method: 'POST',
      headers,
      body,
    })
    ok = response.ok
    text = await response.text()
  }

  if (ok) {
    try {
      return JSON.parse(text)
    } catch {
      return { valid: false, reason: 'invalid' }
    }
  }
  return { valid: false, reason: 'invalid' }
}

const CODE_PREFIX = 'STORY'
const CODE_GROUP_COUNT = 4
const CODE_GROUP_LEN = 4
const CODE_TOTAL_CHARS = CODE_PREFIX.length + CODE_GROUP_COUNT * CODE_GROUP_LEN // 21

/** Format a raw code string into STORY-XXXX-XXXX-XXXX-XXXX */
export function formatCode(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

  // If input starts with STORY, strip it and reformat
  const body = cleaned.startsWith(CODE_PREFIX) ? cleaned.slice(CODE_PREFIX.length) : cleaned
  const limited = body.slice(0, CODE_GROUP_COUNT * CODE_GROUP_LEN)

  const parts: string[] = [CODE_PREFIX]
  for (let i = 0; i < limited.length; i += CODE_GROUP_LEN) {
    parts.push(limited.slice(i, i + CODE_GROUP_LEN))
  }
  return parts.join('-')
}

/** Validate code format: STORY-XXXX-XXXX-XXXX-XXXX */
export function isValidCodeFormat(code: string): boolean {
  return /^STORY-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)
}
