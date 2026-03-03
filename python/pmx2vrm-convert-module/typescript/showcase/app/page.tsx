"use client";

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import JSZip from "jszip";
import "./globals.css";

type Tab = "convert" | "validate";
type Status = "idle" | "loading" | "success" | "error";

// ── Types ──

interface QueueItem {
  files: File[];
  displayName: string;
}

interface OutputItem {
  name: string;
  size: number;
  blob: Blob;
  validation: ValidationData | null;
}

interface QueueResult {
  itemName: string;
  outputs: OutputItem[];
  logs: string[];
  elapsed: number;
  error: string | null;
}

interface ZipApiOutput {
  name: string;
  size: number;
  data: string; // base64
  validation: ValidationData | null;
}

interface ValidationIssue {
  severity: "ERROR" | "WARNING" | "INFO";
  layer: number;
  message: string;
  path: string;
}

interface ValidationData {
  valid: boolean;
  issues: ValidationIssue[];
  vrm_version: string | null;
  exporter: string | null;
  bone_count: number;
  node_count: number;
  material_count: number;
}

interface ValidateResult {
  result: ValidationData;
  humanText: string;
}

// ── Helpers ──

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function downloadBlob(data: Blob | Uint8Array, filename: string) {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatValidation(result: ValidationData): string {
  const layerNames: Record<number, string> = {
    1: "GLB structure", 2: "glTF validity", 3: "VRM extension",
    4: "Humanoid bones", 5: "Secondary animation", 6: "Materials",
  };
  const lines: string[] = [];

  for (let layer = 1; layer <= 6; layer++) {
    const issues = result.issues.filter(i => i.layer === layer);
    if (!issues.length) continue;
    const errors = issues.filter(i => i.severity === "ERROR");
    const warnings = issues.filter(i => i.severity === "WARNING");
    const name = layerNames[layer];
    if (errors.length) {
      lines.push(`[FAIL] ${name}`);
      errors.forEach(i => lines.push(`  - ${i.path ? i.path + ": " : ""}${i.message}`));
    } else if (warnings.length) {
      lines.push(`[WARN] ${name}`);
      warnings.forEach(i => lines.push(`  - ${i.path ? i.path + ": " : ""}${i.message}`));
    } else {
      lines.push(`[PASS] ${name}`);
    }
  }

  lines.push("");
  const errs = result.issues.filter(i => i.severity === "ERROR");
  const warns = result.issues.filter(i => i.severity === "WARNING");
  if (errs.length) {
    const parts = [`${errs.length} error${errs.length > 1 ? "s" : ""}`];
    if (warns.length) parts.push(`${warns.length} warning${warns.length > 1 ? "s" : ""}`);
    lines.push(`Result: INVALID (${parts.join(", ")})`);
  } else if (warns.length) {
    lines.push(`Result: VALID (${warns.length} warning${warns.length > 1 ? "s" : ""})`);
  } else {
    lines.push("Result: VALID");
  }

  return lines.join("\n");
}

// ── Dropzone component ──

function Dropzone({
  accept,
  hint,
  label,
  file,
  onFile,
  onClear,
}: {
  accept: string;
  hint: string;
  label: string;
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragover, setDragover] = useState(false);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragover(false);
    if (e.dataTransfer.files.length) onFile(e.dataTransfer.files[0]);
  }, [onFile]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) onFile(e.target.files[0]);
  }, [onFile]);

  if (file) {
    return (
      <div style={styles.fileInfo}>
        <span style={styles.fileName}>{file.name}</span>
        <span style={styles.fileSize}>{formatSize(file.size)}</span>
        <button style={styles.removeBtn} onClick={onClear}>&times;</button>
      </div>
    );
  }

  return (
    <div
      style={{
        ...styles.dropzone,
        borderColor: dragover ? "var(--blue)" : "var(--border)",
        background: dragover ? "var(--blue-light)" : "transparent",
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragover(true); }}
      onDragLeave={() => setDragover(false)}
      onDrop={handleDrop}
    >
      <div style={styles.dropLabel}>
        Drop <span style={{ color: "var(--blue)", fontWeight: 500 }}>{label}</span> file here or click to browse
      </div>
      <div style={styles.dropHint}>{hint}</div>
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} style={{ display: "none" }} />
    </div>
  );
}

// ── Badge component ──

function Badge({ type, children }: { type: "success" | "error" | "warning"; children: React.ReactNode }) {
  const colorMap = {
    success: { bg: "var(--green-light)", color: "var(--green)" },
    error: { bg: "var(--red-light)", color: "var(--red)" },
    warning: { bg: "var(--orange-light)", color: "var(--orange)" },
  };
  const c = colorMap[type];
  return (
    <span style={{ ...styles.badge, background: c.bg, color: c.color }}>{children}</span>
  );
}

// ── Log viewer ──

function LogViewer({ text }: { text: string }) {
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/\[FAIL\]/g, '<span style="color:var(--red)">[FAIL]</span>')
    .replace(/\[WARN\]/g, '<span style="color:var(--orange)">[WARN]</span>')
    .replace(/\[PASS\]/g, '<span style="color:var(--green)">[PASS]</span>')
    .replace(/(Result: INVALID[^\n]*)/g, '<span style="color:var(--red)">$1</span>')
    .replace(/(Result: VALID)$/gm, '<span style="color:var(--green)">$1</span>');

  return <pre style={styles.log} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── Queue picker component ──

function QueuePicker({
  items,
  onAddZips,
  onRemove,
  disabled,
}: {
  items: QueueItem[];
  onAddZips: (items: QueueItem[]) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}) {
  const zipInputRef = useRef<HTMLInputElement>(null);

  const handleZipChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const newItems: QueueItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      newItems.push({ files: [f], displayName: f.name });
    }
    onAddZips(newItems);
    e.target.value = "";
  }, [onAddZips]);

  return (
    <div>
      {items.map((item, i) => {
        const totalSize = item.files.reduce((s, f) => s + f.size, 0);
        return (
          <div key={i} style={{ ...styles.fileInfo, marginBottom: 4 }}>
            <span style={styles.fileName}>{item.displayName}</span>
            <span style={styles.fileSize}>{formatSize(totalSize)}</span>
            <button style={styles.removeBtn} onClick={() => onRemove(i)} disabled={disabled}>&times;</button>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 8, marginTop: items.length > 0 ? 12 : 0 }}>
        <button style={styles.btnSecondary} onClick={() => zipInputRef.current?.click()} disabled={disabled}>
          {items.length > 0 ? "Add ZIP" : "Select ZIP file"}
        </button>
        <span style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", alignItems: "center" }}>
          ZIP archives containing PMX files (flat only, no nested ZIPs)
        </span>
      </div>
      <input ref={zipInputRef} type="file" accept=".zip" multiple onChange={handleZipChange} style={{ display: "none" }} />
    </div>
  );
}

// ── Main page ──

export default function Page() {
  const [tab, setTab] = useState<Tab>("convert");

  // Convert state (unified queue)
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [cvtScale, setCvtScale] = useState("0.08");
  const [cvtNoSpring, setCvtNoSpring] = useState(false);
  const [cvtStatus, setCvtStatus] = useState<Status>("idle");
  const [cvtResults, setCvtResults] = useState<QueueResult[]>([]);
  const [cvtProgress, setCvtProgress] = useState("");

  // Validate state
  const [vrmFile, setVrmFile] = useState<File | null>(null);
  const [vrmStrict, setVrmStrict] = useState(false);
  const [vrmStatus, setVrmStatus] = useState<Status>("idle");
  const [vrmResult, setVrmResult] = useState<ValidateResult | null>(null);
  const [vrmError, setVrmError] = useState("");

  // ── Unified convert handler ──
  const handleConvert = useCallback(async () => {
    if (queue.length === 0) return;
    setCvtStatus("loading");
    setCvtResults([]);
    setCvtProgress(`Converting 1/${queue.length}...`);

    const results: QueueResult[] = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      setCvtProgress(`Converting ${i + 1}/${queue.length}...`);

      const form = new FormData();
      form.append("file", item.files[0]);
      form.append("scale", cvtScale);
      form.append("noSpring", String(cvtNoSpring));

      try {
        const resp = await fetch("/api/convert-zip", { method: "POST", body: form });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "Conversion failed");

        const zipOutputs: ZipApiOutput[] = data.outputs;
        const logs: string[] = data.logs ?? [];
        const elapsed: number = data.elapsed ?? 0;
        const outputs: OutputItem[] = zipOutputs.map(out => {
          const bytes = Uint8Array.from(atob(out.data), c => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: "application/octet-stream" });
          return { name: out.name, size: out.size, blob, validation: out.validation };
        });

        results.push({ itemName: item.displayName, outputs, logs, elapsed, error: null });
      } catch (e: any) {
        results.push({ itemName: item.displayName, outputs: [], logs: [], elapsed: 0, error: e.message });
      }

      setCvtResults([...results]);
    }

    setCvtStatus("success");
    setCvtProgress("");
  }, [queue, cvtScale, cvtNoSpring]);

  // ── Validate handler ──
  const handleValidate = useCallback(async () => {
    if (!vrmFile) return;
    setVrmStatus("loading");
    setVrmResult(null);
    setVrmError("");

    const form = new FormData();
    form.append("file", vrmFile);
    form.append("strict", String(vrmStrict));

    try {
      const resp = await fetch("/api/validate", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Validation failed");
      setVrmResult(data);
      setVrmStatus("success");
    } catch (e: any) {
      setVrmError(e.message);
      setVrmStatus("error");
    }
  }, [vrmFile, vrmStrict]);

  // ── Collect all downloadable outputs ──
  const allValidOutputs = cvtResults.flatMap(r =>
    r.outputs.filter(o => o.validation === null || o.validation.valid)
  );

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>truepmx2vrm</h1>
      <p style={styles.subtitle}>PMX to VRM 0.x converter — TypeScript test interface</p>

      {/* Tabs */}
      <div style={styles.tabs}>
        {(["convert", "validate"] as Tab[]).map(t => (
          <button
            key={t}
            style={{
              ...styles.tab,
              color: tab === t ? "var(--text)" : "var(--text-secondary)",
              borderBottomColor: tab === t ? "var(--text)" : "transparent",
            }}
            onClick={() => setTab(t)}
          >
            {t === "convert" ? "Convert" : "Validate VRM"}
          </button>
        ))}
      </div>

      {/* ── Convert (unified: folders + ZIPs) ── */}
      {tab === "convert" && (
        <div>
          <QueuePicker
            items={queue}
            onAddZips={(items) => { setQueue(prev => [...prev, ...items]); setCvtStatus("idle"); setCvtResults([]); }}
            onRemove={(i) => { setQueue(prev => prev.filter((_, j) => j !== i)); setCvtStatus("idle"); setCvtResults([]); }}
            disabled={cvtStatus === "loading"}
          />

          <div style={styles.options}>
            <label style={styles.option}>
              Scale
              <input
                type="number"
                value={cvtScale}
                onChange={e => setCvtScale(e.target.value)}
                step="0.01"
                min="0.01"
                style={styles.numberInput}
              />
            </label>
            <label style={styles.option}>
              <input
                type="checkbox"
                checked={cvtNoSpring}
                onChange={e => setCvtNoSpring(e.target.checked)}
                style={styles.checkbox}
              />
              Skip spring bones
            </label>
          </div>

          <button
            style={{ ...styles.btn, opacity: queue.length === 0 || cvtStatus === "loading" ? 0.4 : 1 }}
            disabled={queue.length === 0 || cvtStatus === "loading"}
            onClick={handleConvert}
          >
            {cvtStatus === "loading"
              ? cvtProgress
              : queue.length > 1
                ? `Convert ${queue.length} items to VRM`
                : "Convert to VRM"}
          </button>

          {cvtStatus === "loading" && <div style={styles.progressBar}><div style={styles.progressFill} /></div>}

          {/* Results */}
          {cvtResults.length > 0 && (
            <div style={{ marginTop: 24 }}>
              {allValidOutputs.length > 1 && cvtStatus === "success" && (
                <button
                  style={{ ...styles.btn, marginBottom: 20 }}
                  onClick={async () => {
                    const zip = new JSZip();
                    for (const out of allValidOutputs) {
                      zip.file(out.name, out.blob);
                    }
                    const zipBlob = await zip.generateAsync({ type: "blob" });
                    downloadBlob(zipBlob, "vrm_output.zip");
                  }}
                >
                  Download All ({allValidOutputs.length} VRMs)
                </button>
              )}

              {cvtResults.map((item, i) => {
                if (item.error) {
                  return (
                    <div key={i} style={styles.resultCard}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Badge type="error">ERROR</Badge>
                        <span style={{ ...styles.fileName, flex: 1 }}>{item.itemName}</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--red)", marginTop: 8 }}>{item.error}</div>
                    </div>
                  );
                }

                return (
                  <div key={i} style={styles.resultCard}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: item.outputs.length > 1 ? 12 : 0 }}>
                      <span style={{ ...styles.fileName, flex: 1, fontWeight: 600 }}>{item.itemName}</span>
                      <span style={styles.resultMeta}>
                        {item.outputs.length} VRM{item.outputs.length !== 1 ? "s" : ""} in {item.elapsed}ms
                      </span>
                    </div>

                    {item.outputs.map((out, j) => {
                      const isInvalid = out.validation !== null && !out.validation.valid;
                      const hasWarnings = out.validation?.issues.some(i => i.severity === "WARNING") ?? false;
                      const isValid = out.validation !== null && out.validation.valid;
                      return (
                        <div key={j} style={{ padding: "8px 0", borderTop: j > 0 ? "1px solid var(--border)" : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {isValid && (
                              <Badge type={hasWarnings ? "warning" : "success"}>
                                {hasWarnings ? "WARN" : "VALID"}
                              </Badge>
                            )}
                            {isInvalid && <Badge type="error">INVALID</Badge>}
                            {out.validation === null && <Badge type="warning">NO VALIDATION</Badge>}
                            <span style={styles.outputName}>{out.name}</span>
                            <span style={styles.resultMeta}>{formatSize(out.size)}</span>
                            {!isInvalid ? (
                              <button
                                style={styles.btnSmall}
                                onClick={() => downloadBlob(out.blob, out.name)}
                              >
                                Download
                              </button>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--red)" }}>blocked</span>
                            )}
                          </div>

                          {out.validation && (
                            <details style={{ marginTop: 8 }}>
                              <summary style={styles.summary}>Validation</summary>
                              <div style={{ marginTop: 4 }}>
                                <LogViewer text={formatValidation(out.validation)} />
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })}

                    {item.logs.length > 0 && (
                      <details style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                        <summary style={styles.summary}>Pipeline log</summary>
                        <pre style={{ ...styles.log, marginTop: 8 }}>{item.logs.join("\n")}</pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Validate VRM ── */}
      {tab === "validate" && (
        <div>
          <Dropzone
            accept=".vrm,.glb"
            label=".vrm"
            hint="VRM 0.x only"
            file={vrmFile}
            onFile={setVrmFile}
            onClear={() => { setVrmFile(null); setVrmStatus("idle"); setVrmResult(null); }}
          />

          <div style={styles.options}>
            <label style={styles.option}>
              <input
                type="checkbox"
                checked={vrmStrict}
                onChange={e => setVrmStrict(e.target.checked)}
                style={styles.checkbox}
              />
              Strict mode (warnings = errors)
            </label>
          </div>

          <button
            style={{ ...styles.btn, opacity: !vrmFile || vrmStatus === "loading" ? 0.4 : 1 }}
            disabled={!vrmFile || vrmStatus === "loading"}
            onClick={handleValidate}
          >
            {vrmStatus === "loading" ? "Validating..." : "Validate"}
          </button>

          {vrmStatus === "loading" && <div style={styles.progressBar}><div style={styles.progressFill} /></div>}

          {vrmStatus === "error" && (
            <div style={{ marginTop: 24 }}>
              <Badge type="error">ERROR</Badge>
              <span style={{ ...styles.resultMeta, marginLeft: 12 }}>{vrmError}</span>
            </div>
          )}

          {vrmStatus === "success" && vrmResult && (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                {vrmResult.result.valid ? (
                  vrmResult.result.issues.some(i => i.severity === "WARNING") ? (
                    <Badge type="warning">VALID (warnings)</Badge>
                  ) : (
                    <Badge type="success">VALID</Badge>
                  )
                ) : (
                  <Badge type="error">INVALID</Badge>
                )}
                <span style={styles.resultMeta}>
                  {vrmResult.result.bone_count} bones, {vrmResult.result.node_count} nodes
                </span>
              </div>
              <LogViewer text={vrmResult.humanText} />
            </div>
          )}
        </div>
      )}

      <div style={styles.footer}>truepmx2vrm TypeScript &mdash; test interface</div>
    </div>
  );
}

// ── Inline styles (editorial minimalism) ──

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "40px 24px 80px",
  },
  h1: {
    fontSize: 24,
    fontWeight: 600,
    letterSpacing: "-0.02em",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "var(--text-secondary)",
    marginBottom: 40,
  },
  tabs: {
    display: "flex",
    gap: 0,
    borderBottom: "1px solid var(--border)",
    marginBottom: 32,
  },
  tab: {
    padding: "8px 16px",
    fontSize: 14,
    fontWeight: 500,
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    cursor: "pointer",
    marginBottom: -1,
    transition: "color 0.15s ease, border-color 0.15s ease",
    fontFamily: "var(--sans)",
  },
  dropzone: {
    border: "1.5px dashed var(--border)",
    padding: "48px 24px",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "border-color 0.15s ease, background 0.15s ease",
  },
  dropLabel: {
    fontSize: 14,
    color: "var(--text-secondary)",
  },
  dropHint: {
    fontSize: 12,
    color: "var(--text-tertiary)",
    marginTop: 8,
  },
  fileInfo: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    background: "var(--bg-secondary)",
    fontSize: 14,
  },
  fileName: {
    fontWeight: 500,
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  fileSize: {
    color: "var(--text-tertiary)",
    fontFamily: "var(--mono)",
    fontSize: 13,
  },
  removeBtn: {
    color: "var(--text-tertiary)",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    padding: "0 4px",
  },
  options: {
    display: "flex",
    gap: 24,
    marginTop: 20,
    padding: "16px 0",
  },
  option: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    color: "var(--text-secondary)",
    cursor: "pointer",
  },
  numberInput: {
    width: 72,
    padding: "4px 8px",
    fontFamily: "var(--mono)",
    fontSize: 13,
    border: "1px solid var(--border)",
    outline: "none",
  },
  checkbox: {
    width: 16,
    height: 16,
    cursor: "pointer",
    accentColor: "var(--blue)",
  },
  btn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "var(--sans)",
    background: "var(--text)",
    color: "var(--bg)",
    border: "none",
    cursor: "pointer",
    marginTop: 0,
    transition: "opacity 0.15s ease",
  },
  btnSecondary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "var(--sans)",
    background: "var(--bg)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    cursor: "pointer",
    transition: "border-color 0.15s ease",
  },
  btnSmall: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 500,
    fontFamily: "var(--sans)",
    background: "var(--text)",
    color: "var(--bg)",
    border: "none",
    cursor: "pointer",
    flexShrink: 0,
  },
  outputName: {
    flex: 1,
    fontFamily: "var(--mono)",
    fontSize: 13,
    color: "var(--text)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  progressBar: {
    height: 2,
    background: "var(--bg-secondary)",
    marginTop: 24,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    width: "30%",
    background: "var(--blue)",
    animation: "slide 1.2s ease-in-out infinite",
  },
  badge: {
    display: "inline-block",
    padding: "2px 10px",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    flexShrink: 0,
  },
  resultMeta: {
    fontSize: 13,
    color: "var(--text-secondary)",
    flexShrink: 0,
  },
  log: {
    background: "var(--bg-secondary)",
    padding: 16,
    fontFamily: "var(--mono)",
    fontSize: 13,
    lineHeight: 1.8,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-all" as const,
    maxHeight: 400,
    overflowY: "auto" as const,
    color: "var(--text-secondary)",
  },
  summary: {
    fontSize: 14,
    cursor: "pointer",
    color: "var(--text-secondary)",
  },
  resultCard: {
    padding: "16px 20px",
    marginBottom: 12,
    border: "1px solid var(--border)",
    background: "var(--bg-secondary)",
  },
  footer: {
    marginTop: 60,
    paddingTop: 20,
    borderTop: "1px solid var(--border)",
    fontSize: 12,
    color: "var(--text-tertiary)",
  },
};
