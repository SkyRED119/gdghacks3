import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export function ExtensionTokenPanel() {
  const { token } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!token) return null;

  const copy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ background: "#1e1e2e", border: "1px solid #313244", borderRadius: 8, padding: 16, marginTop: 16 }}>
      <p style={{ color: "#cdd6f4", fontSize: 13, marginBottom: 8 }}>
        🔑 <strong>Extension Token</strong> — paste this into the Academia Quest extension to sync your data
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          readOnly
          value={token}
          style={{
            flex: 1, background: "#181825", color: "#a6adc8",
            border: "1px solid #45475a", borderRadius: 6,
            padding: "6px 10px", fontSize: 11, fontFamily: "monospace",
          }}
        />
        <button
          onClick={copy}
          style={{
            background: copied ? "#a6e3a1" : "#89b4fa",
            color: "#1e1e2e", border: "none", borderRadius: 6,
            padding: "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13,
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
