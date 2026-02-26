import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { scanZip, process_ as processZip } from "@converter/intake.js";

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

    // Scan
    log("Scanning zip...");
    const results = await scanZip(zipPath);
    log(`  Found ${results.length} .pmx file(s)`);

    const humanoids = results.filter((r: any) => r.humanoid);
    log(`  Humanoid: ${humanoids.length}`);

    for (const r of results) {
      const tag = (r as any).humanoid ? "humanoid" : "skip";
      log(`  ${(r as any).name} — ${tag} (${(r as any).mappedCount}/17)`);
    }

    if (humanoids.length === 0) {
      return NextResponse.json(
        { error: "No humanoid PMX found in zip", logs, results },
        { status: 400 },
      );
    }

    // Convert
    const outDir = path.join(tmpDir, "output");
    await mkdir(outDir, { recursive: true });
    const outputPaths: string[] = await processZip(zipPath, outDir, scale, noSpring);

    // Read outputs
    const outputs: { name: string; size: number; data: string }[] = [];
    for (const vrmPath of outputPaths) {
      const buf = await readFile(vrmPath);
      outputs.push({
        name: path.basename(vrmPath),
        size: buf.byteLength,
        data: buf.toString("base64"),
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
