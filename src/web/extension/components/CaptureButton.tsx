import * as React from "react"; // ^18.0.0
import { toast } from "sonner"; // ^1.0.0
import { buttonVariants } from "../../src/components/ui/button";
import { 
  captureSelectedText, 
  extractMetadata, 
  prepareContentInput 
} from "../utils/capture";
import { saveToExtensionStorage } from "../utils/storage";
import { Content, ContentStatus } from "../../src/types/content";

// Constants for capture behavior
const DEBOUNCE_DELAY = 500;
const KEYBOARD_SHORTCUT = "Alt+C";

interface CaptureButtonProps {
  className?: string;
  onCaptureComplete?: (content: Content) => void;
  onCaptureError?: (error: Error) => void;
  captureOptions?: {
    showToasts?: boolean;
    autoSave?: boolean;
    includeContext?: boolean;
  };
  accessibilityLabel?: string;
}

export const CaptureButton: React.FC<CaptureButtonProps> = ({
  className,
  onCaptureComplete,
  onCaptureError,
  captureOptions = {
    showToasts: true,
    autoSave: true,
    includeContext: true
  },
  accessibilityLabel = "Capture selected text"
}) => {
  const [isCapturing, setIsCapturing] = React.useState(false);
  const lastCaptureTime = React.useRef<number>(0);
  const captureAttempts = React.useRef<number>(0);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        handleCapture();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, []);

  // Reset capture attempts periodically
  React.useEffect(() => {
    const resetInterval = setInterval(() => {
      captureAttempts.current = 0;
    }, 60000);

    return () => clearInterval(resetInterval);
  }, []);

  const handleCapture = React.useCallback(async () => {
    // Debounce rapid capture attempts
    const now = Date.now();
    if (now - lastCaptureTime.current < DEBOUNCE_DELAY) {
      return;
    }
    lastCaptureTime.current = now;

    // Track capture attempts to prevent abuse
    captureAttempts.current += 1;
    if (captureAttempts.current > 10) {
      toast.error("Too many capture attempts. Please wait a minute.");
      return;
    }

    if (isCapturing) {
      return;
    }

    try {
      setIsCapturing(true);
      captureOptions.showToasts && toast.loading("Capturing content...");

      // Capture selected text
      const selectedText = await captureSelectedText();
      if (!selectedText) {
        throw new Error("No text selected");
      }

      // Extract metadata and prepare content
      const metadata = await extractMetadata();
      const content = prepareContentInput(selectedText, metadata);

      // Save to extension storage if autoSave is enabled
      if (captureOptions.autoSave) {
        await saveToExtensionStorage(content);
      }

      // Show success notification
      if (captureOptions.showToasts) {
        toast.success("Content captured successfully", {
          description: `${content.content.slice(0, 50)}...`
        });
      }

      // Call completion callback
      onCaptureComplete?.(content);

    } catch (error) {
      // Handle specific error cases
      const errorMessage = error instanceof Error ? error.message : "Capture failed";
      
      if (captureOptions.showToasts) {
        toast.error("Failed to capture content", {
          description: errorMessage
        });
      }

      onCaptureError?.(error instanceof Error ? error : new Error(errorMessage));

    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, captureOptions, onCaptureComplete, onCaptureError]);

  return (
    <button
      className={buttonVariants({
        variant: "primary",
        size: "md",
        className: `relative flex items-center gap-2 ${className || ""}`
      })}
      onClick={handleCapture}
      disabled={isCapturing}
      aria-label={accessibilityLabel}
      title={`Capture selected text (${KEYBOARD_SHORTCUT})`}
      data-testid="capture-button"
    >
      {/* Loading spinner */}
      {isCapturing && (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}

      {/* Capture icon */}
      {!isCapturing && (
        <svg
          className="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      )}

      <span className="whitespace-nowrap">
        {isCapturing ? "Capturing..." : "Capture"}
      </span>

      {/* Screen reader text */}
      <span className="sr-only">
        {isCapturing ? "Capturing selected text..." : `Capture selected text (${KEYBOARD_SHORTCUT})`}
      </span>
    </button>
  );
};

export default CaptureButton;