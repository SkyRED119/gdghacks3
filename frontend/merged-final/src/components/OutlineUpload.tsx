/**
 * OutlineUpload.tsx
 *
 * Lets a user upload a PDF course outline. The PDF is sent to OpenAI's
 * Chat Completions API which extracts assignments/deadlines and returns
 * structured JSON. Those assignments are then synced to the backend so the
 * calendar updates immediately.
 *
 * Set VITE_OPENAI_KEY in your .env.local. In production, move this call
 * behind your backend so the API key isn't shipped to the client.
 *
 * Usage in App.tsx (already added):
 *   <OutlineUpload onSynced={fetchData} />
 */

import { useState, useRef } from "react";
import { api } from "../lib/api";
import type { OutlineAssignment } from "../lib/api";

interface Props {
  onSynced?: () => void;
}

type Stage = "idle" | "reading" | "parsing" | "syncing" | "done" | "error";

export function OutlineUpload({ onSynced }: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<OutlineAssignment[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStage("idle");
    setError("");
    setPreview([]);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    if (!file) return;
    setFileName(file.name);
    setStage("reading");
    setError("");
    setPreview([]);

    // ── 1. Read PDF as base64
    let base64: string;
    try {
      base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // strip data:application/pdf;base64,
        };
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
    } catch (e: any) {
      setStage("error");
      setError("Could not read the PDF: " + e.message);
      return;
    }

    // ── 2. Send to OpenAI to extract assignments
    setStage("parsing");
    let extracted: OutlineAssignment[];
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "file",
                  file: {
                    filename: fileName,
                    file_data: `data:application/pdf;base64,${base64}`,
                  },
                },
                {
                  type: "text",
                  text: `Extract every assignment, quiz, midterm, exam, lab, and deadline from this course outline.

Return ONLY a valid JSON array — no markdown, no explanation, nothing else.
Each item must have:
  "course"    : course code + name (string)
  "title"     : assignment/assessment name (string)
  "dueDate"   : due date as YYYY-MM-DD (string, or null if not specified)
  "priority"  : grade weight as a number 0-100 (or 0 if not specified)

Example:
[
  {"course":"CIS*3760 Software Engineering","title":"Assignment 1","dueDate":"2026-02-14","priority":10},
  {"course":"CIS*3760 Software Engineering","title":"Midterm Exam","dueDate":"2026-03-05","priority":30}
]`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `API error ${response.status}`);
      }

      const data = await response.json();
      // OpenAI response shape is different from Anthropic
      const text = data.choices[0].message.content;

      const clean = text.replace(/```json|```/gi, "").trim();
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed)) throw new Error("Unexpected response format");

      extracted = parsed.map((item: any, i: number) => ({
        id: `outline-${Date.now()}-${i}`,
        course: item.course ?? "Unknown",
        courseId: (item.course ?? "unknown").replace(/\s+/g, "-").toLowerCase(),
        title: item.title ?? `Item ${i + 1}`,
        dueDate: item.dueDate ?? undefined,
        priority: typeof item.priority === "number" ? item.priority : 0,
        status: "pending",
        source: "outline",
      }));
    } catch (e: any) {
      setStage("error");
      setError("Could not parse the outline: " + e.message);
      return;
    }

    setPreview(extracted);
    setStage("idle"); // show preview, wait for confirm
  }

  async function handleSync() {
    if (preview.length === 0) return;
    setStage("syncing");
    try {
      await api.uploadOutline(preview);
      setStage("done");
      onSynced?.();
      setTimeout(() => {
        reset();
        setOpen(false);
      }, 1600);
    } catch (e: any) {
      setStage("error");
      setError("Sync failed: " + e.message);
    }
  }

  // ── Trigger button (outside modal)
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: 7,
          padding: "5px 12px",
          fontSize: 12,
          color: "var(--text-muted)",
          cursor: "pointer",
          fontFamily: "var(--font-body)",
          letterSpacing: "0.04em",
          transition: "background 0.15s, color 0.15s",
        }}
        onMouseOver={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background =
            "var(--bg-surface)")
        }
        onMouseOut={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.background = "none")
        }
      >
        📋 Upload outline
      </button>
    );
  }

  // ── Modal
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(5px)",
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={() => { reset(); setOpen(false); }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 28,
          width: "100%",
          maxWidth: 520,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          boxShadow: "var(--shadow-lg)",
          fontFamily: "var(--font-body)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontStyle: "italic", color: "var(--text)" }}>
            Upload Course Outline
          </span>
          <button
            onClick={() => { reset(); setOpen(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 16 }}
          >
            ✕
          </button>
        </div>

        {/* Instructions */}
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Upload your course outline PDF. Claude will read it and extract all
          assignments, exams, and deadlines automatically.
        </p>

        {/* Drop zone / file picker */}
        {stage === "idle" && preview.length === 0 && (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file?.type === "application/pdf") handleFile(file);
              else { setStage("error"); setError("Please drop a PDF file."); }
            }}
            style={{
              border: "2px dashed var(--border-strong)",
              borderRadius: 10,
              padding: "32px 20px",
              textAlign: "center",
              cursor: "pointer",
              transition: "background 0.15s",
              color: "var(--text-muted)",
            }}
            onMouseOver={(e) =>
              ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-surface)")
            }
            onMouseOut={(e) =>
              ((e.currentTarget as HTMLDivElement).style.background = "transparent")
            }
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
              Click to choose a PDF
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>or drag and drop it here</div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {/* Loading states */}
        {(stage === "reading" || stage === "parsing" || stage === "syncing") && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{
              width: 36, height: 36, border: "3px solid var(--border)",
              borderTop: "3px solid var(--text)", borderRadius: "50%",
              animation: "spin 0.9s linear infinite", margin: "0 auto 14px",
            }} />
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {stage === "reading" && "Reading PDF…"}
              {stage === "parsing" && `Analysing "${fileName}" with Claude…`}
              {stage === "syncing" && "Syncing to your dashboard…"}
            </div>
          </div>
        )}

        {/* Success */}
        {stage === "done" && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#27ae60", fontSize: 15 }}>
            ✓ {preview.length} items synced to your dashboard!
          </div>
        )}

        {/* Error */}
        {stage === "error" && (
          <div style={{ fontSize: 12, color: "#c0392b", background: "rgba(192,57,43,0.08)", borderRadius: 8, padding: "10px 14px" }}>
            {error}
            <button
              onClick={reset}
              style={{ display: "block", marginTop: 8, background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0 }}
            >
              Try again
            </button>
          </div>
        )}

        {/* Preview table */}
        {preview.length > 0 && stage === "idle" && (
          <>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Found <strong style={{ color: "var(--text)" }}>{preview.length} items</strong> in{" "}
              <em>{fileName}</em>. Review below then sync.
            </div>
            <div style={{
              maxHeight: 220, overflowY: "auto",
              border: "1px solid var(--border)", borderRadius: 8,
            }}>
              {preview.map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: "8px 12px",
                    borderBottom: i < preview.length - 1 ? "1px solid var(--border)" : "none",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                      {item.course}{item.dueDate ? ` · ${item.dueDate}` : ""}
                    </div>
                  </div>
                  {item.priority ? (
                    <span style={{ fontSize: 11, color: "var(--text-faint)", flexShrink: 0 }}>
                      {item.priority}%
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={reset}
                style={{
                  background: "none", border: "1px solid var(--border)", borderRadius: 7,
                  padding: "8px 14px", fontSize: 12, color: "var(--text-muted)",
                  cursor: "pointer", fontFamily: "var(--font-body)",
                }}
              >
                Upload different file
              </button>
              <button
                onClick={handleSync}
                style={{
                  background: "var(--text)", color: "var(--bg)", border: "none",
                  borderRadius: 7, padding: "8px 20px", fontSize: 13, fontWeight: 500,
                  cursor: "pointer", fontFamily: "var(--font-body)",
                }}
              >
                Sync to dashboard →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
