// 카카오톡 공유 JS SDK 로더.
//
// PortOne SDK가 모바일 사파리에서 조용히 로드 실패했던 전례가 있어(프로젝트 룰:
// 외부 SDK는 로드 실패 핸들링 필수), 여기서도 실패를 삼키지 않고 호출부에 알린다.
// 실패하면 호출부가 링크 복사로 강등한다 — 보상 문구 없이.

const SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js";
const LOAD_TIMEOUT_MS = 8000;

type KakaoSdk = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: {
    sendDefault: (settings: Record<string, unknown>) => void;
  };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

let loadPromise: Promise<KakaoSdk> | null = null;

export function loadKakaoSdk(): Promise<KakaoSdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  if (loadPromise) return loadPromise;

  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!jsKey) {
    return Promise.reject(new Error("missing kakao js key"));
  }

  loadPromise = new Promise<KakaoSdk>((resolve, reject) => {
    const finish = () => {
      const sdk = window.Kakao;
      if (!sdk) return reject(new Error("kakao sdk missing after load"));
      try {
        if (!sdk.isInitialized()) sdk.init(jsKey);
      } catch (e) {
        return reject(e instanceof Error ? e : new Error("kakao init failed"));
      }
      resolve(sdk);
    };

    if (window.Kakao) return finish();

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    const script = existing ?? document.createElement("script");

    const timer = setTimeout(() => reject(new Error("kakao sdk load timeout")), LOAD_TIMEOUT_MS);
    const onLoad = () => {
      clearTimeout(timer);
      finish();
    };
    const onError = () => {
      clearTimeout(timer);
      // 실패한 script 태그를 남겨두면 다음 시도에서 그걸 재사용하게 되는데,
      // 이미 끝난 태그는 load를 다시 발화하지 않아 매번 타임아웃만 먹는다.
      // 세션 내 복구가 영영 안 되므로 태그째 제거한다.
      script.remove();
      loadPromise = null;
      reject(new Error("kakao sdk load failed"));
    };

    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });

    if (!existing) {
      script.src = SDK_SRC;
      script.async = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  });

  // 실패한 프라미스를 캐시에 남겨두면 영영 못 고친다
  loadPromise.catch(() => {
    loadPromise = null;
  });

  return loadPromise;
}

export type KakaoShareContent = {
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  buttonTitle?: string;
};

/**
 * 카카오톡 공유 전송.
 * serverCallbackArgs가 없으면 웹훅 자체가 오지 않는다(카카오 문서) — 보상이 필요한
 * 호출은 반드시 nonce를 넘겨야 한다. nonce 없이 호출하면 공유만 되고 보상은 없다.
 */
export async function sendKakaoShare(
  content: KakaoShareContent,
  nonce?: string | null
): Promise<void> {
  const sdk = await loadKakaoSdk();

  const settings: Record<string, unknown> = {
    objectType: "feed",
    content: {
      title: content.title,
      description: content.description,
      imageUrl: content.imageUrl,
      link: { mobileWebUrl: content.linkUrl, webUrl: content.linkUrl },
    },
    buttons: [
      {
        title: content.buttonTitle ?? "결과 보러 가기",
        link: { mobileWebUrl: content.linkUrl, webUrl: content.linkUrl },
      },
    ],
    installTalk: true,
  };

  if (nonce) settings.serverCallbackArgs = { n: nonce };

  sdk.Share.sendDefault(settings);
}
