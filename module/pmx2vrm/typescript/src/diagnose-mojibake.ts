import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import iconv from 'iconv-lite';
import { PmxReader } from './pmx-reader.js';

const FALLBACK_ENCODINGS = ['shiftjis', 'gbk', 'euc-kr', 'big5'];

function smartDecodeFilename(bytes: Uint8Array): string {
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true });
    return utf8.decode(bytes);
  } catch {}

  for (const enc of FALLBACK_ENCODINGS) {
    try {
      const decoded = iconv.decode(Buffer.from(bytes), enc);
      if (!decoded.includes('\uFFFD')) return decoded;
    } catch {
      continue;
    }
  }

  return new TextDecoder('utf-8').decode(bytes);
}

const ZIP_OPTS = { decodeFileName: smartDecodeFilename };

async function analyzeZip(zipPath: string) {
  console.log('Reading ZIP file:', zipPath);
  const data = await readFile(zipPath);
  const zip = await JSZip.loadAsync(data, ZIP_OPTS);
  
  console.log('\n=== ZIP ENTRIES ===');
  console.log('Total entries:', Object.keys(zip.files).length);
  
  const entries: string[] = [];
  const pmxFiles: string[] = [];
  const textureFiles: string[] = [];
  
  for (const [entryName, file] of Object.entries(zip.files)) {
    if (file.dir) continue;
    
    const lower = entryName.toLowerCase();
    entries.push(entryName);
    
    if (lower.endsWith('.pmx')) {
      pmxFiles.push(entryName);
    } else if (/\.(png|jpg|jpeg|bmp|tga|tif|tiff)$/i.test(entryName)) {
      textureFiles.push(entryName);
    }
  }
  
  console.log('\n=== PMX FILES ===');
  console.log('Count:', pmxFiles.length);
  pmxFiles.forEach(p => console.log('  -', p));
  
  console.log('\n=== TEXTURE FILES IN ZIP ===');
  console.log('Count:', textureFiles.length);
  textureFiles.slice(0, 15).forEach(t => console.log('  -', t));
  if (textureFiles.length > 15) console.log('  ... and', textureFiles.length - 15, 'more');
  
  if (pmxFiles.length > 0) {
    console.log('\n=== READING PMX FILE ===');
    const pmxEntry = pmxFiles[0];
    const pmxFile = zip.file(pmxEntry);
    const pmxBytes = await pmxFile!.async('uint8array');
    
    try {
      const reader = new PmxReader(pmxBytes);
      const raw = reader.read();
      
      console.log('PMX model name:', raw.model_name);
      console.log('Texture paths declared in PMX:', raw.texture_paths.length);
      console.log('\n=== TEXTURE PATHS FROM PMX ===');
      raw.texture_paths.forEach((tp, i) => {
        console.log(`[${i}] ${tp}`);
      });
      
      console.log('\n=== MOJIBAKE CHECK ===');
      const pmxDir = path.dirname(pmxEntry);
      const pmxPrefix = pmxDir ? pmxDir + '/' : '';
      
      let matchCount = 0;
      let mismatchCount = 0;
      
      raw.texture_paths.forEach((texPath, idx) => {
        const fullZipPath = pmxPrefix + texPath.replace(/\\/g, '/');
        const exists = entries.some(e => e.toLowerCase() === fullZipPath.toLowerCase());
        
        if (exists) {
          matchCount++;
          console.log(`[MATCH] Texture ${idx}: ${texPath}`);
        } else {
          mismatchCount++;
          console.log(`[MISMATCH] Texture ${idx}: ${texPath}`);
          console.log(`  Expected: ${fullZipPath}`);
          const candidates = entries.filter(e => 
            path.basename(e).toLowerCase() === path.basename(texPath).toLowerCase()
          );
          if (candidates.length > 0) {
            console.log(`  Found file (different path): ${candidates[0]}`);
          }
        }
      });
      
      console.log(`\nSummary: ${matchCount} matched, ${mismatchCount} mismatched`);
      if (mismatchCount > 0) {
        console.log('\nCONCLUSION: MOJIBAKE DETECTED - Texture paths in PMX do not match ZIP entries');
      } else if (matchCount > 0) {
        console.log('\nCONCLUSION: OK - All texture paths match ZIP entries');
      }
      
    } catch (e: any) {
      console.error('Failed to parse PMX:', e.message);
    }
  }
}

const zipPath = process.argv[2] || 'E:/models/PMXs/槿廚屆돛―빻삽.zip';
analyzeZip(zipPath).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
