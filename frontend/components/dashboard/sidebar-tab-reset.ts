"use client";

import { useEffect } from "react";

const sidebarTabResetEvent = "finora:sidebar-tab-reset";

export function requestSidebarTabReset() {
  window.dispatchEvent(new Event(sidebarTabResetEvent));
}

export function useSidebarTabReset(onReset: () => void) {
  useEffect(() => {
    const reset = () => onReset();
    window.addEventListener(sidebarTabResetEvent, reset);
    return () => window.removeEventListener(sidebarTabResetEvent, reset);
  }, [onReset]);
}
