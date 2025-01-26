import crypto from 'crypto';

interface EncryptedValue {
    content: string;
    iv: string;
    authTag: string;
}

type EncryptedData<T> = {
    [K in keyof T]: T[K] | EncryptedValue;
};

export class EncryptionService {
    private algorithm = 'aes-256-gcm';
    private key: Buffer;
    private iv: Buffer;

    constructor() {
        // Use environment variables for key and iv in production
        const encryptionKey = process.env.ENCRYPTION_KEY || 'your-secure-encryption-key-min-32-chars';
        this.key = crypto.scryptSync(encryptionKey, 'salt', 32);
        this.iv = crypto.randomBytes(16);
    }

    async encryptFields<T extends Record<string, unknown>>(data: T, sensitiveFields: string[]): Promise<EncryptedData<T>> {
        const encryptedData = { ...data } as Record<string, unknown>;
        for (const field of sensitiveFields) {
            if (field in data) {
                const value = data[field];
                if (value) {
                    const cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv) as crypto.CipherGCM;
                    let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'hex');
                    encrypted += cipher.final('hex');
                    const authTag = cipher.getAuthTag();
                    
                    encryptedData[field] = {
                        content: encrypted,
                        iv: this.iv.toString('hex'),
                        authTag: authTag.toString('hex')
                    };
                }
            }
        }
        return encryptedData as EncryptedData<T>;
    }

    async decryptFields<T extends Record<string, unknown>>(data: EncryptedData<T>, sensitiveFields: string[]): Promise<T> {
        const decryptedData = { ...data } as T;
        for (const field of sensitiveFields) {
            const value = (data as Record<string, EncryptedValue | unknown>)[field];
            if (this.isEncryptedValue(value)) {
                const decipher = crypto.createDecipheriv(
                    this.algorithm, 
                    this.key, 
                    Buffer.from(value.iv, 'hex')
                ) as crypto.DecipherGCM;
                decipher.setAuthTag(Buffer.from(value.authTag, 'hex'));
                let decrypted = decipher.update(value.content, 'hex', 'utf8');
                decrypted += decipher.final('utf8');
                (decryptedData as Record<string, unknown>)[field] = JSON.parse(decrypted);
            }
        }
        return decryptedData;
    }

    private isEncryptedValue(value: unknown): value is EncryptedValue {
        return Boolean(
            value && 
            typeof value === 'object' && 
            'content' in value &&
            'iv' in value &&
            'authTag' in value
        );
    }
}
