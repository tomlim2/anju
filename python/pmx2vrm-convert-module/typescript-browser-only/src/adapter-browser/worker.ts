/**
 * Web Worker entry point for browser PMX → VRM conversion.
 *
 * Receives a ZIP ArrayBuffer, runs the pipeline off the main thread,
 * and returns VRM results via postMessage with Transferable buffers.
 */

import { convertZip } from "./convert.js";
import type { ConvertOptions } from "./convert.js";

export interface WorkerInput extends ConvertOptions {
  zipBuffer: ArrayBuffer;
}

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { zipBuffer, scale, noSpring } = e.data;
  try {
    const results = await convertZip(zipBuffer, { scale, noSpring });
    const transfers = results.map(r => r.vrm.buffer);
    self.postMessage({ ok: true, results }, transfers as any);
  } catch (err) {
    self.postMessage({ ok: false, error: (err as Error).message });
  }
};
