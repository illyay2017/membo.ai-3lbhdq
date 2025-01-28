/**
 * @fileoverview Browser storage utility library for managing client-side data persistence,
 * handling authentication tokens, user preferences, and offline content caching with
 * enhanced security, compression, and IndexedDB support.
 * @version 1.0.0
 */

import { AuthTokens } from '../types/auth';
import { Content } from '../types/content';
import * as pako from 'pako'; // v2.1.0
import * as CryptoJS from 'crypto-js'; // v4.1.1

/**
 * Constants for storage configuration and management
 */
const STORAGE_KEYS = {
    AUTH_TOKENS: 'auth_tokens',
    USER_PREFERENCES: 'user_preferences',
    OFFLINE_CONTENT: 'offline_content',
    SYNC_TIMESTAMP: 'sync_timestamp',
    ENCRYPTION_KEY: 'encryption_key',
    STORAGE_VERSION: '1.0.0'
} as const;

const TOKEN_EXPIRY = 1800000; // 30 minutes in milliseconds
const STORAGE_QUOTA = 50000000; // 50MB default storage quota
const COMPRESSION_THRESHOLD = 1000; // Minimum bytes for compression
const DB_VERSION = 1;
const DB_NAME = 'membo_offline_storage';

/**
 * Interface for IndexedDB database structure
 */
interface OfflineDatabase extends IDBDatabase {
    readonly objectStoreNames: DOMStringList;
}

let db: OfflineDatabase | null = null;

/**
 * Initializes the storage subsystem including IndexedDB setup
 * @returns Promise that resolves when storage is initialized
 */
export async function initializeStorage(): Promise<void> {
    try {
        await initializeIndexedDB();
        await validateStorageIntegrity();
    } catch (error) {
        console.error('Storage initialization failed:', error);
        throw new Error('Failed to initialize storage subsystem');
    }
}

/**
 * Initializes IndexedDB for offline content storage
 */
async function initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(new Error('Failed to open IndexedDB'));

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            
            if (!db.objectStoreNames.contains('content')) {
                const contentStore = db.createObjectStore('content', { keyPath: 'id' });
                contentStore.createIndex('userId', 'userId', { unique: false });
                contentStore.createIndex('status', 'status', { unique: false });
            }

            if (!db.objectStoreNames.contains('metadata')) {
                const metadataStore = db.createObjectStore('metadata', { keyPath: 'id' });
                metadataStore.createIndex('syncTimestamp', 'syncTimestamp', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            db = (event.target as IDBOpenDBRequest).result as OfflineDatabase;
            resolve();
        };
    });
}

/**
 * Stores authentication tokens securely with encryption
 * @param tokens Authentication tokens to store
 */
export function setAuthTokens(tokens: AuthTokens): void {
    try {
        const salt = CryptoJS.lib.WordArray.random(128/8);
        const key = CryptoJS.PBKDF2(
            window.location.hostname, 
            salt,
            { keySize: 256/32, iterations: 1000 }
        );

        const encrypted = CryptoJS.AES.encrypt(
            JSON.stringify(tokens),
            key.toString(),
            { mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
        );

        localStorage.setItem(STORAGE_KEYS.ENCRYPTION_KEY, salt.toString());
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKENS, encrypted.toString());
        localStorage.setItem('tokenExpiry', (Date.now() + TOKEN_EXPIRY).toString());
    } catch (error) {
        console.error('Failed to store auth tokens:', error);
        throw new Error('Token storage failed');
    }
}

/**
 * Retrieves and validates stored authentication tokens
 * @returns Decrypted auth tokens or null if invalid/expired
 */
export async function getAuthTokens(): Promise<AuthTokens | null> {
    try {
        const encrypted = localStorage.getItem(STORAGE_KEYS.AUTH_TOKENS);
        const salt = localStorage.getItem(STORAGE_KEYS.ENCRYPTION_KEY);
        const expiry = localStorage.getItem('tokenExpiry');

        if (!encrypted || !salt || !expiry) {
            return null;
        }

        if (Date.now() > parseInt(expiry, 10)) {
            clearAuthTokens();
            return null;
        }

        const key = CryptoJS.PBKDF2(
            window.location.hostname,
            salt,
            { keySize: 256/32, iterations: 1000 }
        );

        const decrypted = CryptoJS.AES.decrypt(encrypted, key.toString());
        const tokens = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8)) as AuthTokens;

        if (!validateTokenStructure(tokens)) {
            clearAuthTokens();
            return null;
        }

        return tokens;
    } catch (error) {
        console.error('Failed to retrieve auth tokens:', error);
        clearAuthTokens();
        return null;
    }
}

/**
 * Stores content for offline access with compression
 * @param contentItems Array of content items to store
 */
export async function setOfflineContent(contentItems: Content[]): Promise<void> {
    if (!db) {
        throw new Error('Database not initialized');
    }

    const transaction = db.transaction(['content', 'metadata'], 'readwrite');
    const contentStore = transaction.objectStore('content');
    const metadataStore = transaction.objectStore('metadata');

    return new Promise((resolve, reject) => {
        transaction.onerror = () => reject(new Error('Failed to store offline content'));

        contentItems.forEach(item => {
            const contentString = JSON.stringify(item);
            
            // Compress content if above threshold
            const content = contentString.length > COMPRESSION_THRESHOLD
                ? pako.deflate(contentString)
                : contentString;

            const metadata = {
                id: item.id,
                syncTimestamp: Date.now(),
                compressed: contentString.length > COMPRESSION_THRESHOLD
            };

            contentStore.put({ ...item, content });
            metadataStore.put(metadata);
        });

        transaction.oncomplete = () => {
            localStorage.setItem(STORAGE_KEYS.SYNC_TIMESTAMP, Date.now().toString());
            resolve();
        };
    });
}

/**
 * Retrieves offline content with decompression if needed
 * @param contentId ID of content to retrieve
 * @returns Promise resolving to content item or null if not found
 */
export async function getOfflineContent(contentId: string): Promise<Content | null> {
    if (!db) {
        throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['content', 'metadata'], 'readonly');
        const contentRequest = transaction.objectStore('content').get(contentId);
        const metadataRequest = transaction.objectStore('metadata').get(contentId);

        transaction.onerror = () => reject(new Error('Failed to retrieve offline content'));

        transaction.oncomplete = () => {
            const content = contentRequest.result;
            const metadata = metadataRequest.result;

            if (!content) {
                resolve(null);
                return;
            }

            try {
                if (metadata?.compressed) {
                    const decompressed = pako.inflate(content.content, { to: 'string' });
                    content.content = JSON.parse(decompressed);
                }
                resolve(content);
            } catch (error) {
                console.error('Failed to decompress content:', error);
                resolve(null);
            }
        };
    });
}

/**
 * Validates the structure of authentication tokens
 * @param tokens Tokens to validate
 * @returns boolean indicating if tokens are valid
 */
function validateTokenStructure(tokens: any): tokens is AuthTokens {
    return (
        typeof tokens === 'object' &&
        typeof tokens.accessToken === 'string' &&
        typeof tokens.refreshToken === 'string' &&
        typeof tokens.expiresIn === 'number'
    );
}

/**
 * Clears authentication tokens from storage
 */
export function clearAuthTokens(): void {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKENS);
    localStorage.removeItem(STORAGE_KEYS.ENCRYPTION_KEY);
    localStorage.removeItem('tokenExpiry');
}

/**
 * Validates storage integrity and version compatibility
 */
async function validateStorageIntegrity(): Promise<void> {
    const version = localStorage.getItem(STORAGE_KEYS.STORAGE_VERSION);
    
    if (version !== STORAGE_KEYS.STORAGE_VERSION) {
        await clearStorage();
        localStorage.setItem(STORAGE_KEYS.STORAGE_VERSION, STORAGE_KEYS.STORAGE_VERSION);
    }
}

/**
 * Clears all storage data
 */
async function clearStorage(): Promise<void> {
    localStorage.clear();
    if (db) {
        const transaction = db.transaction(['content', 'metadata'], 'readwrite');
        transaction.objectStore('content').clear();
        transaction.objectStore('metadata').clear();
    }
}

/**
 * Stores user preferences securely
 * @param preferences User preferences to store
 */
export function setUserPreferences(preferences: Record<string, unknown>): void {
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(preferences));
}
