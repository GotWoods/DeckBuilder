import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({
  message,
  isVisible,
  onClose,
  duration = 3000
}) => {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimatingOut(false);

      const timer = setTimeout(() => {
        setIsAnimatingOut(true);

        // Wait for fade out animation to complete before calling onClose
        setTimeout(onClose, 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible && !isAnimatingOut) {
    return null;
  }

  return (
    <div style={{
      ...styles.overlay,
      opacity: isAnimatingOut ? 0 : 1,
      transform: `translateY(${isAnimatingOut ? '-20px' : '0'})`,
    }}>
      <div style={styles.toast}>
        <span style={styles.checkmark}>✓</span>
        <span style={styles.message}>{message}</span>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    pointerEvents: 'none' as const,
    transition: 'all 0.3s ease-in-out',
  },
  toast: {
    backgroundColor: '#28a745',
    color: 'white',
    padding: '12px 24px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    minWidth: '200px',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: '16px',
    color: 'white',
  },
  message: {
    color: 'white',
  },
};

export default Toast;