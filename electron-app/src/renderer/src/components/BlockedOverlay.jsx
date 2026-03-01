import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BlockedOverlay({ isVisible, windowInfo }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (isVisible && overlayRef.current) overlayRef.current.focus();
  }, [isVisible]);

  const label = windowInfo?.appName || windowInfo?.url || 'this application';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            background: 'rgba(185, 28, 28, 0.97)',
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 2px, transparent 2px, transparent 10px)',
          }}
          role="alertdialog"
          aria-modal="true"
          aria-label="Distraction blocked"
          tabIndex={-1}
        >
          <div className="text-center max-w-lg px-8">
            <span className="text-7xl block mb-5">🚫</span>
            <h1
              className="text-7xl font-black tracking-tighter leading-none text-destructive-foreground mb-5"
              style={{ textShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
            >
              BLOCKED
            </h1>
            <p className="text-xl text-destructive-foreground/90 mb-3">
              <strong>{label}</strong> is on your blocklist.
            </p>
            <p className="text-sm text-destructive-foreground/70">
              Switch away from this window to continue your session.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

