/**
 * @fileoverview Utility module for managing synchronization of captured content between
 * the Chrome extension and the main membo.ai application, implementing real-time sync,
 * offline capabilities, and robust error handling with retry mechanisms.
 * @version 1.0.0
 */

import { getFromExtensionStorage, clearSyncedContent } from './storage';
import { api } from '../../src/lib/api';
import { Content } from '../../src/types/content';

// Constants for sync configuration
const DEFAULT_SYNC_INTERVAL = 300000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 5;
const MIN_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 300000; // 5 minutes
const CONTENT_SIZE_THRESHOLD = 1048576; // 1MB

/**
 * Interface for sync status information with enhanced error tracking
 */
export interface SyncStatus {
    lastSyncTime: Date;
    pendingItems: number;
    syncError: string | null;
    isSyncing: boolean;
    retryCount: number;
    lastRetryTime: Date | null;
    offlineMode: boolean;
}

// Initial sync status
let currentSyncStatus: SyncStatus = {
    lastSyncTime: new Date(),
    pendingItems: 0,
    syncError: null,
    isSyncing: false,
    retryCount: 0,
    lastRetryTime: null,
    offlineMode: false
};

/**
 * Checks network connectivity status
 * @returns Promise resolving to boolean indicating online status
 */
const checkConnectivity = async (): Promise<boolean> => {
    try {
        await fetch(chrome.runtime.getURL('manifest.json'), { method: 'HEAD' });
        return true;
    } catch {
        return false;
    }
};

/**
 * Synchronizes captured content with retry mechanism and offline support
 * @param force Force sync regardless of pending items
 */
export const syncContent = async (force: boolean = false): Promise<void> => {
    if (currentSyncStatus.isSyncing && !force) {
        return;
    }

    try {
        const isOnline = await checkConnectivity();
        if (!isOnline) {
            currentSyncStatus.offlineMode = true;
            currentSyncStatus.syncError = 'Network connection unavailable';
            return;
        }

        currentSyncStatus.isSyncing = true;
        currentSyncStatus.offlineMode = false;

        const unsyncedContent = await getFromExtensionStorage();
        if (!unsyncedContent.length && !force) {
            return;
        }

        const syncedContentIds: string[] = [];
        const batchSize = 10;

        // Process content in batches
        for (let i = 0; i < unsyncedContent.length; i += batchSize) {
            const batch = unsyncedContent.slice(i, i + batchSize);
            
            try {
                await api.post('/content/batch', {
                    content: batch
                }, {
                    timeout: 30000,
                    retries: MAX_RETRY_ATTEMPTS
                });

                syncedContentIds.push(...batch.map(item => item.id));
            } catch (error) {
                if (currentSyncStatus.retryCount < MAX_RETRY_ATTEMPTS) {
                    currentSyncStatus.retryCount++;
                    currentSyncStatus.lastRetryTime = new Date();
                    const delay = Math.min(
                        MIN_RETRY_DELAY * Math.pow(2, currentSyncStatus.retryCount),
                        MAX_RETRY_DELAY
                    );
                    await new Promise(resolve => setTimeout(resolve, delay));
                    i -= batchSize; // Retry this batch
                    continue;
                }
                throw error;
            }
        }

        if (syncedContentIds.length) {
            await clearSyncedContent(syncedContentIds);
        }

        currentSyncStatus = {
            lastSyncTime: new Date(),
            pendingItems: unsyncedContent.length - syncedContentIds.length,
            syncError: null,
            isSyncing: false,
            retryCount: 0,
            lastRetryTime: null,
            offlineMode: false
        };

    } catch (error) {
        currentSyncStatus.syncError = error instanceof Error ? error.message : 'Sync failed';
        currentSyncStatus.isSyncing = false;
        throw error;
    }
};

/**
 * Retrieves current sync status with enhanced error information
 */
export const getSyncStatus = async (): Promise<SyncStatus> => {
    const unsyncedContent = await getFromExtensionStorage();
    return {
        ...currentSyncStatus,
        pendingItems: unsyncedContent.length
    };
};

/**
 * Updates the sync status with enhanced error tracking
 */
const updateSyncStatus = async (status: Partial<SyncStatus>): Promise<void> => {
    currentSyncStatus = {
        ...currentSyncStatus,
        ...status
    };

    // Emit sync status change event
    chrome.runtime.sendMessage({
        type: 'SYNC_STATUS_UPDATED',
        payload: currentSyncStatus
    });
};

/**
 * Configures automatic content synchronization with adaptive intervals
 */
export const setupAutoSync = (intervalMs: number = DEFAULT_SYNC_INTERVAL): void => {
    let syncInterval = Math.max(intervalMs, MIN_RETRY_DELAY);
    let syncTimer: NodeJS.Timeout;

    const startSync = async () => {
        try {
            await syncContent();
            // Adjust sync interval based on pending items
            if (currentSyncStatus.pendingItems > 0) {
                syncInterval = Math.max(intervalMs / 2, MIN_RETRY_DELAY);
            } else {
                syncInterval = intervalMs;
            }
        } catch (error) {
            console.error('Auto sync failed:', error);
        }
        syncTimer = setTimeout(startSync, syncInterval);
    };

    // Start initial sync
    startSync();

    // Listen for network status changes
    window.addEventListener('online', () => {
        currentSyncStatus.offlineMode = false;
        syncContent(true);
    });

    window.addEventListener('offline', () => {
        currentSyncStatus.offlineMode = true;
        clearTimeout(syncTimer);
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.content) {
            syncContent();
        }
    });
};