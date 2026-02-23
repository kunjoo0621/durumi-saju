"use client";

import { useEffect, useState } from "react";

export function useViewportHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const vp = window.visualViewport;
    if (!vp) {
      setHeight(window.innerHeight);
      return;
    }

    const update = () => {
      console.log('[VP DEBUG]', {
        'vp.height': vp.height,
        'vp.offsetTop': vp.offsetTop,
        'window.innerHeight': window.innerHeight,
        'gap (innerH - vpH)': window.innerHeight - vp.height,
      });
      setHeight(vp.height);
    };

    update();
    vp.addEventListener("resize", update);
    vp.addEventListener("scroll", update);

    return () => {
      vp.removeEventListener("resize", update);
      vp.removeEventListener("scroll", update);
    };
  }, []);

  return height;
}
