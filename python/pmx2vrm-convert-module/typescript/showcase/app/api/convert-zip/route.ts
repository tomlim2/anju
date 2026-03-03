import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { process_ } from "@converter/intake.js";
import { validate } from "@converter/vrm-validator.js";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const start = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => logs.push(msg);

  let tmpDir = "";

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const scale = parseFloat(String(form.get("scale") ?? "0.08"));
    const noSpring = form.get("noSpring") === "true";

    // Write zip to temp
    tmpDir = path.join(tmpdir(), `truepmx2vrm-zip-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    const zipPath = path.join(tmpDir, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(zipPath, buffer);

    // Convert (scan + rename handled internally by process_)
    const outDir = path.join(tmpDir, "output");
    await mkdir(outDir, { recursive: true });
    log("Processing zip...");
    const outputPaths = await process_(zipPath, {
      outputDir: outDir,
      scale,
      noSpring,
      noRename: false,
      noValidate: true, // validate here in API so we can return results
    });
    log(`  Converted ${outputPaths.length} VRM(s)`);

    // Read outputs + validate each
    const outputs: { name: string; size: number; data: string; validation: any }[] = [];
    for (const vrmPath of outputPaths) {
      const buf = await readFile(vrmPath);
      const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      let validation = null;
      try {
        validation = await validate(uint8);
      } catch { /* validation optional */ }
      const name = path.basename(vrmPath);
      log(`  ${name} — ${validation?.valid ? "VALID" : "INVALID"}`);
      outputs.push({
        name,
        size: buf.byteLength,
        data: buf.toString("base64"),
        validation,
      });
    }

    const elapsed = Date.now() - start;
    log(`Done in ${elapsed}ms, ${outputs.length} VRM(s)`);

    return NextResponse.json({ outputs, logs, elapsed });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, logs }, { status: 500 });
  } finally {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
