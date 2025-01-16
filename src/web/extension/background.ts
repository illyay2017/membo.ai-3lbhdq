/**
 * @fileoverview Background script for the membo.ai Chrome extension
 * Manages content capture, storage, and synchronization with comprehensive error handling
 * @version 1.0.0
 */

import { captureSelectedText, prepareContentInput } from './utils/capture';
import { saveToExtensionStorage, clearSyncedContent } from './utils/storage';
import { setupAutoSync, syncContent } from './utils/sync';

// Constants for extension configuration
const BADGE_BACKGROUND_COLOR = '#2563eb';
const CONTEXT_MENU_ID = 'membo-capture';
const SYNC_INTERVAL = 300000; // 5 minutes
const ERROR_RETRY_DELAY = 1000;
const MAX_ERROR_RETRIES = 3;

/**
 * Interface for content capture messages between content script and background
 */
interface ContentCaptureMessage {
    type: 'CAPTURE_CONTENT';
    selectedText: string;
    source: string;
    timestamp: number;
    version: string;
}

/**
 * Decorator for error boundary implementation
 */
function errorBoundary(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
        let retryCount = 0;
        while (retryCount < MAX_ERROR_RETRIES) {
            try {
                return await originalMethod.apply(this, args);
            } catch (error) {
                console.error(`Error in ${propertyKey}:`, error);
                retryCount++;
                if (retryCount === MAX_ERROR_RETRIES) {
                    updateExtensionBadge('error');
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, ERROR_RETRY_DELAY * retryCount));
            }
        }
    };
    return descriptor;
}

/**
 * Initializes the extension background script
 * Sets up message listeners, context menu, and sync mechanisms
 */
class BackgroundScript {
    private initialized: boolean = false;

    @errorBoundary
    async initialize(): Promise<void> {
        if (this.initialized) return;

        // Set up context menu
        chrome.contextMenus.create({
            id: CONTEXT_MENU_ID,
            title: 'Capture to membo.ai',
            contexts: ['selection']
        });

        // Initialize message listeners
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
        chrome.contextMenus.onClicked.addListener(this.handleContextMenu.bind(this));

        // Set up automatic sync
        setupAutoSync(SYNC_INTERVAL);

        // Set initial badge state
        await this.updateBadgeState();

        // Set up storage change listener
        chrome.storage.onChanged.addListener(this.handleStorageChange.bind(this));

        this.initialized = true;
    }

    /**
     * Handles incoming messages from content script and popup
     */
    private async handleMessage(
        message: ContentCaptureMessage,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response: any) => void
    ): Promise<void> {
        if (message.type === 'CAPTURE_CONTENT') {
            try {
                await this.handleContentCapture(message);
                sendResponse({ success: true });
            } catch (error) {
                console.error('Content capture failed:', error);
                sendResponse({ success: false, error: error.message });
            }
        }
    }

    /**
     * Handles context menu capture action
     */
    @errorBoundary
    private async handleContextMenu(
        info: chrome.contextMenus.OnClickData,
        tab: chrome.tabs.Tab
    ): Promise<void> {
        if (info.menuItemId === CONTEXT_MENU_ID && tab.id) {
            await chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_CAPTURE' });
        }
    }

    /**
     * Processes content capture requests
     */
    @errorBoundary
    private async handleContentCapture(message: ContentCaptureMessage): Promise<void> {
        const { selectedText } = message;
        
        // Prepare content with metadata
        const content = await prepareContentInput(selectedText, {
            source: message.source,
            timestamp: message.timestamp,
            version: message.version
        });

        // Save to extension storage
        await saveToExtensionStorage(content);

        // Trigger sync if online
        if (navigator.onLine) {
            await syncContent(true);
        }

        // Update badge state
        await this.updateBadgeState();
    }

    /**
     * Handles storage changes and updates badge
     */
    private async handleStorageChange(
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string
    ): Promise<void> {
        if (areaName === 'local' && changes[StorageKeys.CONTENT]) {
            await this.updateBadgeState();
        }
    }

    /**
     * Updates extension badge state based on pending items
     */
    @errorBoundary
    private async updateBadgeState(): Promise<void> {
        const pendingContent = await getFromExtensionStorage();
        const count = pendingContent.length;

        chrome.action.setBadgeBackgroundColor({ color: BADGE_BACKGROUND_COLOR });
        chrome.action.setBadgeText({ text: count > 0 ? count.toString() : '' });
        
        if (count > 0) {
            chrome.action.setTitle({ 
                title: `${count} item${count === 1 ? '' : 's'} pending sync` 
            });
        } else {
            chrome.action.setTitle({ title: 'membo.ai Capture' });
        }
    }

    /**
     * Handles extension suspension
     */
    private async handleSuspend(): Promise<void> {
        if (navigator.onLine) {
            await syncContent(true);
        }
    }
}

// Initialize background script
const backgroundScript = new BackgroundScript();
backgroundScript.initialize().catch(console.error);

// Handle suspension
chrome.runtime.onSuspend.addListener(() => {
    backgroundScript.handleSuspend().catch(console.error);
});

// Export for testing
export const testing = {
    BackgroundScript,
    errorBoundary
};