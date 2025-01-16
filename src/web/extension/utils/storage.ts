import { Content } from '../../src/types/content';

/**
 * Maximum number of items allowed in extension storage
 * @version 1.0.0
 */
const MAX_STORAGE_ITEMS = 1000;

/**
 * Maximum storage size in bytes (5MB)
 * @version 1.0.0
 */
const MAX_STORAGE_SIZE_BYTES = 5242880;

/**
 * Threshold for content compression (1MB)
 * @version 1.0.0
 */
const COMPRESSION_THRESHOLD_BYTES = 1048576;

/**
 * Maximum retry attempts for storage operations
 * @version 1.0.0
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Enum for storage key constants
 * @version 1.0.0
 */
export enum StorageKeys {
    CONTENT = 'captured-content',
    SYNC_STATUS = 'sync-status',
    METRICS = 'storage-metrics',
    COMPRESSION_MAP = 'compression-map'
}

/**
 * Interface for comprehensive storage usage statistics
 * @version 1.0.0
 */
export interface StorageMetrics {
    totalItems: number;
    totalSize: number;
    compressedSize: number;
    quotaUsage: number;
    lastUpdated: Date;
}

/**
 * Custom error class for storage operations
 * @version 1.0.0
 */
class StorageError extends Error {
    constructor(message: string, public code: string) {
        super(message);
        this.name = 'StorageError';
    }
}

/**
 * Compresses content if it exceeds threshold
 * @version 1.0.0
 */
const compressContent = async (content: string): Promise<string> => {
    if (new Blob([content]).size <= COMPRESSION_THRESHOLD_BYTES) {
        return content;
    }
    
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const compressed = await new Response(
        new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))
    ).blob();
    
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(compressed);
    });
};

/**
 * Decompresses content if it was previously compressed
 * @version 1.0.0
 */
const decompressContent = async (content: string): Promise<string> => {
    if (!content.startsWith('data:')) {
        return content;
    }
    
    const response = await fetch(content);
    const blob = await response.blob();
    const decompressed = await new Response(
        blob.stream().pipeThrough(new DecompressionStream('gzip'))
    ).blob();
    
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(decompressed);
    });
};

/**
 * Saves captured content to Chrome extension's local storage
 * @version 1.0.0
 */
export const saveToExtensionStorage = async (content: Content): Promise<void> => {
    let retryCount = 0;
    
    while (retryCount < MAX_RETRY_ATTEMPTS) {
        try {
            const existingContent = await getFromExtensionStorage();
            
            if (existingContent.length >= MAX_STORAGE_ITEMS) {
                throw new StorageError('Storage item limit exceeded', 'STORAGE_LIMIT_EXCEEDED');
            }
            
            const compressedContent = {
                ...content,
                content: await compressContent(content.content)
            };
            
            const updatedContent = [...existingContent, compressedContent];
            const storageSize = new Blob([JSON.stringify(updatedContent)]).size;
            
            if (storageSize > MAX_STORAGE_SIZE_BYTES) {
                throw new StorageError('Storage size limit exceeded', 'SIZE_LIMIT_EXCEEDED');
            }
            
            await chrome.storage.local.set({ 
                [StorageKeys.CONTENT]: updatedContent 
            });
            
            await updateStorageMetrics(updatedContent);
            return;
            
        } catch (error) {
            retryCount++;
            if (retryCount === MAX_RETRY_ATTEMPTS) {
                throw new StorageError(
                    error instanceof Error ? error.message : 'Storage operation failed',
                    'STORAGE_OPERATION_FAILED'
                );
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
    }
};

/**
 * Retrieves all captured content from extension storage
 * @version 1.0.0
 */
export const getFromExtensionStorage = async (): Promise<Content[]> => {
    try {
        const result = await chrome.storage.local.get(StorageKeys.CONTENT);
        const storedContent = result[StorageKeys.CONTENT] || [];
        
        const decompressedContent = await Promise.all(
            storedContent.map(async (item: Content) => ({
                ...item,
                content: await decompressContent(item.content)
            }))
        );
        
        return decompressedContent.filter((item: Content) => 
            item.id && item.content && item.metadata
        );
        
    } catch (error) {
        throw new StorageError(
            'Failed to retrieve content from storage',
            'RETRIEVAL_FAILED'
        );
    }
};

/**
 * Removes synced content from extension storage
 * @version 1.0.0
 */
export const clearSyncedContent = async (contentIds: string[]): Promise<void> => {
    try {
        const existingContent = await getFromExtensionStorage();
        const remainingContent = existingContent.filter(
            item => !contentIds.includes(item.id)
        );
        
        await chrome.storage.local.set({
            [StorageKeys.CONTENT]: remainingContent
        });
        
        await updateStorageMetrics(remainingContent);
        
    } catch (error) {
        throw new StorageError(
            'Failed to clear synced content',
            'CLEAR_OPERATION_FAILED'
        );
    }
};

/**
 * Updates storage metrics after operations
 * @version 1.0.0
 */
const updateStorageMetrics = async (content: Content[]): Promise<void> => {
    const metrics: StorageMetrics = {
        totalItems: content.length,
        totalSize: new Blob([JSON.stringify(content)]).size,
        compressedSize: content.reduce((size, item) => 
            size + new Blob([item.content]).size, 0
        ),
        quotaUsage: (new Blob([JSON.stringify(content)]).size / MAX_STORAGE_SIZE_BYTES) * 100,
        lastUpdated: new Date()
    };
    
    await chrome.storage.local.set({
        [StorageKeys.METRICS]: metrics
    });
};

/**
 * Retrieves detailed storage usage metrics
 * @version 1.0.0
 */
export const getStorageMetrics = async (): Promise<StorageMetrics> => {
    try {
        const result = await chrome.storage.local.get(StorageKeys.METRICS);
        return result[StorageKeys.METRICS] || {
            totalItems: 0,
            totalSize: 0,
            compressedSize: 0,
            quotaUsage: 0,
            lastUpdated: new Date()
        };
    } catch (error) {
        throw new StorageError(
            'Failed to retrieve storage metrics',
            'METRICS_RETRIEVAL_FAILED'
        );
    }
};