export function SocialButtons({ next }: { next?: string } = {}) {
  const googleHref =
    next && next !== "/"
      ? `/api/auth/google/start?next=${encodeURIComponent(next)}`
      : "/api/auth/google/start";
  const facebookHref =
    next && next !== "/"
      ? `/api/auth/facebook/start?next=${encodeURIComponent(next)}`
      : "/api/auth/facebook/start";
  return (
    <div className="space-y-3">
      <a
        href={googleHref}
        aria-label="Continue with Google"
        className="flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-white text-sm font-semibold text-gray-900 transition hover:opacity-90"
      >
        <GoogleIcon />
        Continue with Google
      </a>
      <a
        href={facebookHref}
        aria-label="Continue with Facebook"
        className="flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-[#1877F2] text-sm font-semibold text-white transition hover:opacity-90"
      >
        <FacebookIcon />
        Continue with Facebook
      </a>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-white/10" />
      <span className="text-xs font-bold tracking-widest text-white/80">OR</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.63z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.34l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96l3 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#fff"
        d="M22.675 0H1.325C.593 0 0 .593 0 1.326v21.348C0 23.408.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.894-4.788 4.659-4.788 1.325 0 2.464.099 2.796.143v3.24h-1.918c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116C23.407 24 24 23.408 24 22.674V1.326C24 .593 23.407 0 22.675 0z"
      />
    </svg>
  );
}
