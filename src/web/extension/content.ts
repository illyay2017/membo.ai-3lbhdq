import { captureSelectedText, extractMetadata, prepareContentInput } from './utils/capture';
import { saveToExtensionStorage } from './utils/storage';
import { ContentStatus } from '../src/types/content';

// Chrome runtime API for messaging - @types/chrome v0.0.x
const { runtime } = chrome;

// Configuration constants
const CAPTURE_SHORTCUT = { ctrlKey: true, key: 'c', altKey: true };
const SELECTION_TIMEOUT = 500;
const MAX_CAPTURE_SIZE = 50000;
const RETRY_ATTEMPTS = 3;
const DEBOUNCE_DELAY = 250;

// Performance monitoring
let lastCaptureTime: number | null = null;
let captureCount = 0;

/**
 * Debounce function for performance optimization
 * @version 1.0.0
 */
const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
};

/**
 * Handles text selection with enhanced error handling and accessibility
 * @version 1.0.0
 */
const handleTextSelection = async (event: MouseEvent): Promise<void> => {
    try {
        // Performance tracking
        const startTime = performance.now();
        
        // Get selected text with validation
        const selectedText = captureSelectedText();
        if (!selectedText || selectedText.length > MAX_CAPTURE_SIZE) {
            return;
        }

        // Extract metadata with enhanced context
        const metadata = extractMetadata();
        
        // Prepare content with validation
        const content = prepareContentInput(selectedText, metadata);
        
        // Save to storage with retry mechanism
        let retryCount = 0;
        while (retryCount < RETRY_ATTEMPTS) {
            try {
                await saveToExtensionStorage(content);
                break;
            } catch (error) {
                retryCount++;
                if (retryCount === RETRY_ATTEMPTS) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }

        // Show visual feedback with accessibility support
        showCaptureConfirmation(true);
        
        // Track performance metrics
        const endTime = performance.now();
        lastCaptureTime = endTime - startTime;
        captureCount++;
        
        // Notify background script
        runtime.sendMessage({
            type: 'CAPTURE_COMPLETE',
            content: content.id,
            metrics: {
                processingTime: lastCaptureTime,
                captureCount,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Capture error:', error);
        showCaptureConfirmation(false);
        
        // Report error to background script
        runtime.sendMessage({
            type: 'CAPTURE_ERROR',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        });
    }
};

/**
 * Handles keyboard shortcuts with accessibility support
 * @version 1.0.0
 */
const handleKeyboardShortcut = (event: KeyboardEvent): void => {
    const { ctrlKey, altKey, key } = event;
    
    // Check if shortcut matches configuration
    if (ctrlKey === CAPTURE_SHORTCUT.ctrlKey &&
        altKey === CAPTURE_SHORTCUT.altKey &&
        key.toLowerCase() === CAPTURE_SHORTCUT.key) {
        
        event.preventDefault();
        handleTextSelection(new MouseEvent('mouseup'));
    }
};

/**
 * Shows visual confirmation with accessibility support
 * @version 1.0.0
 */
const showCaptureConfirmation = (success: boolean): void => {
    const notification = document.createElement('div');
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px;
        border-radius: 4px;
        background-color: ${success ? '#4CAF50' : '#f44336'};
        color: white;
        z-index: 2147483647;
        transition: opacity 0.3s ease;
    `;
    
    notification.textContent = success ? 'Content captured!' : 'Capture failed';
    
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
};

/**
 * Processes messages from background script
 * @version 1.0.0
 */
const handleBackgroundMessage = async (
    message: any,
    sender: chrome.runtime.MessageSender
): Promise<void> => {
    // Validate message origin
    if (!sender.id || sender.id !== chrome.runtime.id) {
        return;
    }

    try {
        switch (message.type) {
            case 'GET_SELECTION':
                const selection = captureSelectedText();
                runtime.sendMessage({
                    type: 'SELECTION_RESULT',
                    content: selection
                });
                break;
                
            case 'UPDATE_SETTINGS':
                // Handle settings updates
                Object.assign(CAPTURE_SHORTCUT, message.settings.shortcut);
                break;
                
            default:
                console.warn('Unknown message type:', message.type);
        }
    } catch (error) {
        console.error('Message handling error:', error);
        runtime.sendMessage({
            type: 'MESSAGE_ERROR',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Initializes content script with enhanced features
 * @version 1.0.0
 */
const initializeContentScript = (): void => {
    // Set up event listeners with performance optimization
    document.addEventListener('mouseup', debounce(handleTextSelection, DEBOUNCE_DELAY));
    document.addEventListener('keydown', handleKeyboardShortcut);
    
    // Set up message handler
    runtime.onMessage.addListener(handleBackgroundMessage);
    
    // Initialize mutation observer for dynamic content
    const observer = new MutationObserver(debounce(() => {
        // Handle dynamic content changes
    }, DEBOUNCE_DELAY));
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Register cleanup handler
    window.addEventListener('unload', () => {
        observer.disconnect();
        runtime.sendMessage({ type: 'CONTENT_SCRIPT_UNLOAD' });
    });
    
    // Report initialization success
    runtime.sendMessage({
        type: 'CONTENT_SCRIPT_READY',
        timestamp: new Date().toISOString()
    });
};

// Initialize content script
initializeContentScript();