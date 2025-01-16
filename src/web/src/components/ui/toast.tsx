import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import cn from 'classnames';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { colors } from '../../constants/theme';

interface IToastProps {
  id: string;
  variant: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
  onDismiss?: () => void;
  position?: 'top' | 'bottom';
  showIcon?: boolean;
}

const VARIANTS = {
  success: {
    backgroundColor: colors.primary,
    icon: CheckCircle,
    ariaRole: 'status'
  },
  error: {
    backgroundColor: colors.error,
    icon: XCircle,
    ariaRole: 'alert'
  },
  info: {
    backgroundColor: colors.secondary,
    icon: Info,
    ariaRole: 'status'
  }
} as const;

const ANIMATION_VARIANTS = {
  initial: { opacity: 0, y: -20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.95 }
};

const GESTURE_CONFIG = {
  swipeToDismiss: true,
  swipeThreshold: 50,
  swipeDirection: 'up'
} as const;

const Toast = React.memo(({
  id,
  variant,
  message,
  duration = 5000,
  onDismiss,
  position = 'top',
  showIcon = true
}: IToastProps) => {
  const variantConfig = VARIANTS[variant];
  
  React.useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        onDismiss?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={ANIMATION_VARIANTS}
        transition={{ duration: 0.2 }}
        drag={GESTURE_CONFIG.swipeToDismiss ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.9}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.y) > GESTURE_CONFIG.swipeThreshold) {
            onDismiss?.();
          }
        }}
        className={cn(
          'fixed flex items-center px-4 py-3 rounded-lg shadow-lg max-w-md w-full',
          'transform transition-all duration-200',
          {
            'top-4': position === 'top',
            'bottom-4': position === 'bottom',
            'left-1/2 -translate-x-1/2': true
          }
        )}
        style={{ backgroundColor: variantConfig.backgroundColor }}
        role={variantConfig.ariaRole}
        aria-live={variant === 'error' ? 'assertive' : 'polite'}
      >
        {showIcon && (
          <variantConfig.icon 
            className="w-5 h-5 text-white mr-3 flex-shrink-0" 
            aria-hidden="true"
          />
        )}
        
        <span className="text-white text-sm font-medium flex-grow">
          {message}
        </span>

        <button
          onClick={onDismiss}
          className="ml-4 text-white opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
});

Toast.displayName = 'Toast';

export default Toast;