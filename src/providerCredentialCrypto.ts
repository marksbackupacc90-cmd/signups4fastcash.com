import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const CREDENTIAL_KEY_SALT = 'signups4fastcash-provider-credentials-v1';

function deriveCredentialKey(secret: string) {
  if (!secret) throw new Error('Provider credential encryption is not configured.');
  return scryptSync(secret, CREDENTIAL_KEY_SALT, 32);
}

export interface EncryptedProviderCredential {
  ciphertext: string;
  nonce: string;
  authTag: string;
}

export function encryptProviderCredential(value: string, secret: string): EncryptedProviderCredential {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveCredentialKey(secret), nonce);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('hex'),
    nonce: nonce.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

export function decryptProviderCredential(
  encrypted: EncryptedProviderCredential,
  secret: string,
) {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveCredentialKey(secret),
    Buffer.from(encrypted.nonce, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
