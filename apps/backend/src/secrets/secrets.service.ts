import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class SecretsService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key = this.loadKey();

  encrypt(plainText: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString('base64url'), encrypted.toString('base64url'), tag.toString('base64url')].join('.');
  }

  decrypt(cipherText: string | null | undefined): string | null {
    if (!cipherText) {
      return null;
    }

    const [ivEncoded, encryptedEncoded, tagEncoded] = cipherText.split('.');
    if (!ivEncoded || !encryptedEncoded || !tagEncoded) {
      throw new InternalServerErrorException('Stored secret format is invalid.');
    }

    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(ivEncoded, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private loadKey(): Buffer {
    const configuredKey = process.env.APP_ENCRYPTION_KEY?.trim();
    if (!configuredKey) {
      throw new InternalServerErrorException('APP_ENCRYPTION_KEY must be configured.');
    }

    const buffer = Buffer.from(configuredKey, 'hex');
    if (buffer.length !== 32) {
      throw new InternalServerErrorException('APP_ENCRYPTION_KEY must be 64 hex characters.');
    }

    return buffer;
  }
}
