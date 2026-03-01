/**
 * BlockedOverlay.jsx
 *
 * Full-screen red overlay rendered whenever the main process emits
 * 'distraction-detected'. Dismissed automatically via 'window-clear'.
 *
 * Props:
 *  isVisible   {boolean} — whether to show the overlay
 *  windowInfo  {object}  — { appName, url, title } from the last distraction event
 */

import React, { useEffect, useRef } from 'react';

export default function BlockedOverlay({ isVisible, windowInfo }) {
  const overlayRef = useRef(null);

  // Trap focus inside the overlay when visible (accessibility).
  useEffect(() => {
    if (isVisible && overlayRef.current) {
      overlayRef.current.focus();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const label = windowInfo?.appName || windowInfo?.url || 'this application';

  return (
    <div
      ref={overlayRef}
      className="blocked-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-label="Distraction blocked"
      tabIndex={-1}
    >
      <div className="blocked-overlay__content">
        <span className="blocked-overlay__icon" aria-hidden="true">🚫</span>
        <h1 className="blocked-overlay__heading">BLOCKED</h1>
        <p className="blocked-overlay__subtext">
          <strong>{label}</strong> is on your blocklist.
        </p>
        <p className="blocked-overlay__hint">
          Switch away from this window to continue your session.
        </p>
      </div>
    </div>
  );
}
