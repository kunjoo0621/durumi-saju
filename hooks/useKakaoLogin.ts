"use client";

import { useCallback, useRef, useState } from "react";
import { signIn } from "next-auth/react";

export function useKakaoLogin() {
  const [signing, setSigning] = useState(false);
  const lockRef = useRef(false);

  const login = useCallback((callbackUrl?: string) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setSigning(true);
    signIn("kakao", callbackUrl ? { callbackUrl } : undefined);
  }, []);

  return { login, signing } as const;
}
