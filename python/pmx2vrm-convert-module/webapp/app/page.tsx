"use client";

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from "react";
import "./globals.css";

type Tab = "convert" | "zip" | "validate";
type Status = "idle" | "loading" | "success" | "error";

interface ConvertResult {
  blob: Blob;
  name: string;
  size: number;
  elapsed: number;
  logs: string[];
  validation: ValidationData | null;
}

interface ZipOutput {
  name: string;
  size: number;
  data: string; // base64
}

interface ZipResult {
  outputs: ZipOutput[];
  logs: string[];
  elapsed: number;
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

// ── Folder picker component ──

function FolderPicker({
  files,
  displayName,
  onFiles,
  onClear,
}: {
  files: File[];
  displayName: string;
  onFiles: (files: File[], name: string) => void;
  onClear: () => void;
}) {
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFolderChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const allFiles: File[] = [];
    let folderName = "";
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const relPath = (f as any).webkitRelativePath || f.name;
      if (!folderName) folderName = relPath.split("/")[0];
      Object.defineProperty(f, "_relativePath", {
        value: relPath.split("/").slice(1).join("/") || f.name,
        writable: false,
      });
      allFiles.push(f);
    }
    const pmxCandidates = allFiles
      .filter(f => f.name.toLowerCase().endsWith(".pmx"))
      .sort((a, b) => b.size - a.size);
    if (pmxCandidates.length === 0) {
      alert("No .pmx file found in the selected folder");
      e.target.value = "";
      return;
    }
    // Pick the largest PMX (humanoid models are always larger than accessories)
    const pmx = pmxCandidates[0];
    const note = pmxCandidates.length > 1
      ? ` (${pmxCandidates.length} PMXs found, using largest: ${pmx.name})`
      : "";
    onFiles(allFiles, `${folderName}/ (${allFiles.length} files, PMX: ${pmx.name})${note}`);
  }, [onFiles]);

  if (files.length > 0) {
    const totalSize = files.reduce((s, f) => s + f.size, 0);
    return (
      <div style={styles.fileInfo}>
        <span style={styles.fileName}>{displayName}</span>
        <span style={styles.fileSize}>{formatSize(totalSize)}</span>
        <button style={styles.removeBtn} onClick={onClear}>&times;</button>
      </div>
    );
  }

  return (
    <div>
      <button style={styles.btnSecondary} onClick={() => folderInputRef.current?.click()}>
        Select PMX folder
      </button>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 12 }}>
        Folder must contain a .pmx file (textures included automatically)
      </span>
      <input ref={folderInputRef} type="file" onChange={handleFolderChange} style={{ display: "none" }}
        {...{ webkitdirectory: "", directory: "" } as any} />
    </div>
  );
}

// ── Main page ──

export default function Page() {
  const [tab, setTab] = useState<Tab>("convert");

  // Convert state
  const [pmxFiles, setPmxFiles] = useState<File[]>([]);
  const [pmxDisplayName, setPmxDisplayName] = useState("");
  const [pmxScale, setPmxScale] = useState("0.08");
  const [pmxNoSpring, setPmxNoSpring] = useState(false);
  const [pmxStatus, setPmxStatus] = useState<Status>("idle");
  const [pmxResult, setPmxResult] = useState<ConvertResult | null>(null);
  const [pmxError, setPmxError] = useState("");

  // ZIP state
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipScale, setZipScale] = useState("0.08");
  const [zipNoSpring, setZipNoSpring] = useState(false);
  const [zipStatus, setZipStatus] = useState<Status>("idle");
  const [zipResult, setZipResult] = useState<ZipResult | null>(null);
  const [zipError, setZipError] = useState("");

  // Validate state
  const [vrmFile, setVrmFile] = useState<File | null>(null);
  const [vrmStrict, setVrmStrict] = useState(false);
  const [vrmStatus, setVrmStatus] = useState<Status>("idle");
  const [vrmResult, setVrmResult] = useState<ValidateResult | null>(null);
  const [vrmError, setVrmError] = useState("");

  // ── Convert handler ──
  const handleConvert = useCallback(async () => {
    if (pmxFiles.length === 0) return;
    setPmxStatus("loading");
    setPmxResult(null);
    setPmxError("");

    const form = new FormData();
    form.append("scale", pmxScale);
    form.append("noSpring", String(pmxNoSpring));

    // Find the PMX file for naming
    const pmx = pmxFiles.find(f => f.name.toLowerCase().endsWith(".pmx"));
    const pmxName = pmx?.name ?? "output.pmx";

    // Send all files with relative paths
    for (const f of pmxFiles) {
      form.append("files", f);
      const relPath = (f as any)._relativePath
        || (f as any).webkitRelativePath
        || f.name;
      form.append("paths", relPath);
    }

    try {
      const resp = await fetch("/api/convert", { method: "POST", body: form });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Conversion failed");
      }

      const blob = await resp.blob();
      const elapsed = Number(resp.headers.get("X-Convert-Time") ?? 0);
      const vrmName = resp.headers.get("X-Vrm-Name") || pmxName.replace(/\.pmx$/i, ".vrm");
      const logsB64 = resp.headers.get("X-Convert-Logs");
      const validB64 = resp.headers.get("X-Validation");

      const logs: string[] = logsB64 ? JSON.parse(atob(logsB64)) : [];
      const validation: ValidationData | null = validB64 ? JSON.parse(atob(validB64)) : null;

      setPmxResult({
        blob,
        name: vrmName,
        size: blob.size,
        elapsed,
        logs,
        validation,
      });
      setPmxStatus("success");
    } catch (e: any) {
      setPmxError(e.message);
      setPmxStatus("error");
    }
  }, [pmxFiles, pmxScale, pmxNoSpring]);

  // ── ZIP handler ──
  const handleZip = useCallback(async () => {
    if (!zipFile) return;
    setZipStatus("loading");
    setZipResult(null);
    setZipError("");

    const form = new FormData();
    form.append("file", zipFile);
    form.append("scale", zipScale);
    form.append("noSpring", String(zipNoSpring));

    try {
      const resp = await fetch("/api/convert-zip", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Conversion failed");
      setZipResult(data);
      setZipStatus("success");
    } catch (e: any) {
      setZipError(e.message);
      setZipStatus("error");
    }
  }, [zipFile, zipScale, zipNoSpring]);

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

  return (
    <div style={styles.container}>
      <h1 style={styles.h1}>truepmx2vrm</h1>
      <p style={styles.subtitle}>PMX to VRM 0.x converter — TypeScript test interface</p>

      {/* Tabs */}
      <div style={styles.tabs}>
        {(["convert", "zip", "validate"] as Tab[]).map(t => (
          <button
            key={t}
            style={{
              ...styles.tab,
              color: tab === t ? "var(--text)" : "var(--text-secondary)",
              borderBottomColor: tab === t ? "var(--text)" : "transparent",
            }}
            onClick={() => setTab(t)}
          >
            {t === "convert" ? "Convert PMX" : t === "zip" ? "Convert ZIP" : "Validate VRM"}
          </button>
        ))}
      </div>

      {/* ── Convert PMX ── */}
      {tab === "convert" && (
        <div>
          <FolderPicker
            files={pmxFiles}
            displayName={pmxDisplayName}
            onFiles={(files, name) => { setPmxFiles(files); setPmxDisplayName(name); }}
            onClear={() => { setPmxFiles([]); setPmxDisplayName(""); setPmxStatus("idle"); setPmxResult(null); }}
          />

          <div style={styles.options}>
            <label style={styles.option}>
              Scale
              <input
                type="number"
                value={pmxScale}
                onChange={e => setPmxScale(e.target.value)}
                step="0.01"
                min="0.01"
                style={styles.numberInput}
              />
            </label>
            <label style={styles.option}>
              <input
                type="checkbox"
                checked={pmxNoSpring}
                onChange={e => setPmxNoSpring(e.target.checked)}
                style={styles.checkbox}
              />
              Skip spring bones
            </label>
          </div>

          <button
            style={{ ...styles.btn, opacity: pmxFiles.length === 0 || pmxStatus === "loading" ? 0.4 : 1 }}
            disabled={pmxFiles.length === 0 || pmxStatus === "loading"}
            onClick={handleConvert}
          >
            {pmxStatus === "loading" ? "Converting..." : "Convert to VRM"}
          </button>

          {pmxStatus === "loading" && <div style={styles.progressBar}><div style={styles.progressFill} /></div>}

          {pmxStatus === "error" && (
            <div style={{ marginTop: 24 }}>
              <Badge type="error">ERROR</Badge>
              <span style={{ ...styles.resultMeta, marginLeft: 12 }}>{pmxError}</span>
            </div>
          )}

          {pmxStatus === "success" && pmxResult && (() => {
            const valid = pmxResult.validation?.valid ?? false;
            const hasWarnings = pmxResult.validation?.issues.some(i => i.severity === "WARNING") ?? false;
            return (
              <div style={{ marginTop: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  {valid ? (
                    <Badge type={hasWarnings ? "warning" : "success"}>
                      {hasWarnings ? "VALID (warnings)" : "VALID"}
                    </Badge>
                  ) : (
                    <Badge type="error">INVALID</Badge>
                  )}
                  <span style={styles.resultMeta}>
                    {formatSize(pmxResult.size)} in {pmxResult.elapsed}ms
                  </span>
                </div>

                {pmxResult.validation && (
                  <div style={{ marginBottom: 16 }}>
                    <LogViewer text={formatValidation(pmxResult.validation)} />
                  </div>
                )}

                {valid ? (
                  <button
                    style={styles.btn}
                    onClick={() => downloadBlob(pmxResult.blob, pmxResult.name)}
                  >
                    Download {pmxResult.name}
                  </button>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--red)" }}>
                    Download blocked — VRM validation failed
                  </div>
                )}

                {pmxResult.logs.length > 0 && (
                  <details style={{ marginTop: 16 }}>
                    <summary style={styles.summary}>Pipeline log</summary>
                    <pre style={{ ...styles.log, marginTop: 8 }}>{pmxResult.logs.join("\n")}</pre>
                  </details>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Convert ZIP ── */}
      {tab === "zip" && (
        <div>
          <Dropzone
            accept=".zip"
            label=".zip"
            hint="Handles nested zips and CJK filenames"
            file={zipFile}
            onFile={setZipFile}
            onClear={() => { setZipFile(null); setZipStatus("idle"); setZipResult(null); }}
          />

          <div style={styles.options}>
            <label style={styles.option}>
              Scale
              <input
                type="number"
                value={zipScale}
                onChange={e => setZipScale(e.target.value)}
                step="0.01"
                min="0.01"
                style={styles.numberInput}
              />
            </label>
            <label style={styles.option}>
              <input
                type="checkbox"
                checked={zipNoSpring}
                onChange={e => setZipNoSpring(e.target.checked)}
                style={styles.checkbox}
              />
              Skip spring bones
            </label>
          </div>

          <button
            style={{ ...styles.btn, opacity: !zipFile || zipStatus === "loading" ? 0.4 : 1 }}
            disabled={!zipFile || zipStatus === "loading"}
            onClick={handleZip}
          >
            {zipStatus === "loading" ? "Converting..." : "Convert ZIP"}
          </button>

          {zipStatus === "loading" && <div style={styles.progressBar}><div style={styles.progressFill} /></div>}

          {zipStatus === "error" && (
            <div style={{ marginTop: 24 }}>
              <Badge type="error">ERROR</Badge>
              <span style={{ ...styles.resultMeta, marginLeft: 12 }}>{zipError}</span>
            </div>
          )}

          {zipStatus === "success" && zipResult && (
            <div style={{ marginTop: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <Badge type="success">{zipResult.outputs.length} VRM(s)</Badge>
                <span style={styles.resultMeta}>{zipResult.elapsed}ms</span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {zipResult.outputs.map((out, i) => (
                  <button
                    key={i}
                    style={styles.btnSecondary}
                    onClick={() => {
                      const bytes = Uint8Array.from(atob(out.data), c => c.charCodeAt(0));
                      downloadBlob(bytes, out.name);
                    }}
                  >
                    {out.name} ({formatSize(out.size)})
                  </button>
                ))}
              </div>

              {zipResult.logs.length > 0 && (
                <details style={{ marginTop: 16 }}>
                  <summary style={styles.summary}>Pipeline log</summary>
                  <pre style={{ ...styles.log, marginTop: 8 }}>{zipResult.logs.join("\n")}</pre>
                </details>
              )}
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
  },
  resultMeta: {
    fontSize: 13,
    color: "var(--text-secondary)",
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
  footer: {
    marginTop: 60,
    paddingTop: 20,
    borderTop: "1px solid var(--border)",
    fontSize: 12,
    color: "var(--text-tertiary)",
  },
};
