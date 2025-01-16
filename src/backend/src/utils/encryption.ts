import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// Constants for encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || (() => { throw new Error('Encryption key not configured'); })();
const IV_LENGTH = 16;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;

/**
 * Validates encryption key format and length
 * @throws Error if key is invalid
 */
const validateKey = (): Buffer => {
  try {
    const key = Buffer.from(ENCRYPTION_KEY, 'base64');
    if (key.length !== 32) { // 256 bits
      throw new Error('Invalid encryption key length');
    }
    return key;
  } catch (error) {
    throw new Error('Invalid encryption key format');
  }
};

/**
 * Encrypts data using AES-256-GCM with authentication tag
 * @param data - String or object to encrypt
 * @returns Encrypted string in format: iv:encryptedData:authTag (base64)
 * @throws Error on encryption failure
 */
export const encrypt = (data: string | object): string => {
  try {
    // Validate key and generate IV
    const key = validateKey();
    const iv = randomBytes(IV_LENGTH);
    
    // Create cipher and encrypt
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    const stringData = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Perform encryption
    const encrypted = Buffer.concat([
      cipher.update(stringData, 'utf8'),
      cipher.final()
    ]);
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Encode components
    const result = [
      iv.toString('base64'),
      encrypted.toString('base64'),
      authTag.toString('base64')
    ].join(':');
    
    // Clear sensitive data
    key.fill(0);
    iv.fill(0);
    
    return result;
  } catch (error) {
    throw new Error(`Encryption failed: ${(error as Error).message}`);
  }
};

/**
 * Decrypts data encrypted with the encrypt function
 * @param encryptedData - Encrypted string in format: iv:encryptedData:authTag
 * @returns Decrypted string
 * @throws Error on decryption failure or tampering detection
 */
export const decrypt = (encryptedData: string): string => {
  try {
    // Validate key and input format
    const key = validateKey();
    const [ivString, dataString, authTagString] = encryptedData.split(':');
    
    if (!ivString || !dataString || !authTagString) {
      throw new Error('Invalid encrypted data format');
    }
    
    // Decode components
    const iv = Buffer.from(ivString, 'base64');
    const encrypted = Buffer.from(dataString, 'base64');
    const authTag = Buffer.from(authTagString, 'base64');
    
    // Create decipher
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Perform decryption
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    // Clear sensitive data
    key.fill(0);
    iv.fill(0);
    
    return decrypted.toString('utf8');
  } catch (error) {
    if ((error as Error).message.includes('auth')) {
      throw new Error('Data integrity verification failed');
    }
    throw new Error(`Decryption failed: ${(error as Error).message}`);
  }
};

/**
 * Encrypts a specific field in an object
 * @param object - Source object
 * @param field - Field name to encrypt
 * @returns New object with encrypted field
 * @throws Error if field doesn't exist or encryption fails
 */
export const encryptField = (object: Record<string, any>, field: string): Record<string, any> => {
  if (!object || typeof object !== 'object') {
    throw new Error('Invalid object provided');
  }
  
  if (!object.hasOwnProperty(field)) {
    throw new Error(`Field '${field}' not found in object`);
  }
  
  const value = object[field];
  if (value === undefined || value === null) {
    throw new Error(`Field '${field}' has invalid value`);
  }
  
  // Create new object for immutability
  const result = { ...object };
  result[field] = encrypt(value);
  
  return result;
};

/**
 * Decrypts a specific encrypted field in an object
 * @param object - Source object
 * @param field - Field name to decrypt
 * @returns New object with decrypted field
 * @throws Error if field doesn't exist or decryption fails
 */
export const decryptField = (object: Record<string, any>, field: string): Record<string, any> => {
  if (!object || typeof object !== 'object') {
    throw new Error('Invalid object provided');
  }
  
  if (!object.hasOwnProperty(field)) {
    throw new Error(`Field '${field}' not found in object`);
  }
  
  const value = object[field];
  if (typeof value !== 'string') {
    throw new Error(`Field '${field}' is not encrypted`);
  }
  
  // Create new object for immutability
  const result = { ...object };
  result[field] = decrypt(value);
  
  try {
    // Attempt to parse JSON if the decrypted value is a stringified object
    result[field] = JSON.parse(result[field]);
  } catch {
    // If parsing fails, keep the string value
  }
  
  return result;
};