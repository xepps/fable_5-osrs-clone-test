import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'
import { persistentPlayerSchema, type PersistentPlayer } from '@osrs/shared'

const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

export const deriveKey = (serverKey: string, characterId: string): Buffer =>
  createHmac('sha256', serverKey).update(characterId).digest()

export const encryptSave = (
  key: Buffer,
  payload: PersistentPlayer,
  iv: Buffer = randomBytes(IV_LENGTH),
): string => {
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')
}

export const decryptSave = (key: Buffer, blob: string): PersistentPlayer | null => {
  try {
    const raw = Buffer.from(blob, 'base64')
    const iv = raw.subarray(0, IV_LENGTH)
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      'utf8',
    )
    const parsed = persistentPlayerSchema.safeParse(JSON.parse(plaintext))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
