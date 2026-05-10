import { useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

export function GoogleSignInButton() {
  const { handleGoogleSuccess } = useAuth();
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function initGoogle() {
      if (!window.google || !btnRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          try {
            await handleGoogleSuccess(response.credential);
          } catch (err) {
            console.error("Google sign-in failed:", err);
          }
        },
      });

      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: 320,
      });
    }

    // Already loaded — initialize immediately
    if (window.google) {
      initGoogle();
      return;
    }

    // Not loaded yet — wait for the script tag to fire its load event
    const script = document.querySelector(
      'script[src*="accounts.google.com/gsi/client"]'
    ) as HTMLScriptElement | null;

    if (script) {
      script.addEventListener("load", initGoogle);
      return () => script.removeEventListener("load", initGoogle);
    }
  }, []);

  return <div ref={btnRef} style={{ minHeight: 44 }} />;
}

// Extend window type for Google GSI SDK
declare global {
  interface Window {
    google: any;
  }
}
