"use client";

import { useEffect, useState } from "react";

export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    let rafId: number | null = null;

    const handleResize = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const bottom = window.innerHeight - viewport.height - viewport.offsetTop;
        setHeight(Math.max(0, Math.round(bottom)));
        rafId = null;
      });
    };

    handleResize();
    viewport.addEventListener("resize", handleResize);
    viewport.addEventListener("scroll", handleResize);

    const onFocusIn = () => handleResize();
    const onFocusOut = () => setTimeout(handleResize, 50);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      viewport.removeEventListener("resize", handleResize);
      viewport.removeEventListener("scroll", handleResize);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return height;
}
