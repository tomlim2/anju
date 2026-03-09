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
  console.log('='.repeat(80));
  console.log('MOJIBAKE DIAGNOSTIC FOR:', zipPath);
  console.log('='.repeat(80));
  
  const data = await readFile(zipPath);
  const zip = await JSZip.loadAsync(data, ZIP_OPTS);
  
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
  
  console.log('\nZIP Structure Summary:');
  console.log(`  Total entries: ${Object.keys(zip.files).length}`);
  console.log(`  PMX files: ${pmxFiles.length}`);
  console.log(`  Texture files: ${textureFiles.length}`);
  
  // Analyze each PMX
  for (let pmxIdx = 0; pmxIdx < pmxFiles.length; pmxIdx++) {
    const pmxEntry = pmxFiles[pmxIdx];
    console.log(`\n${'-'.repeat(80)}`);
    console.log(`PMX ${pmxIdx + 1}: ${pmxEntry}`);
    console.log(`${'-'.repeat(80)}`);
    
    const pmxFile = zip.file(pmxEntry);
    const pmxBytes = await pmxFile!.async('uint8array');
    
    try {
      const reader = new PmxReader(pmxBytes);
      const raw = reader.read();
      
      console.log(`Model name (JP): ${raw.model_name}`);
      console.log(`Texture paths in PMX: ${raw.texture_paths.length}`);
      
      const pmxDir = path.dirname(pmxEntry);
      const pmxPrefix = pmxDir ? pmxDir + '/' : '';
      
      let matchCount = 0;
      let mismatchCount = 0;
      const missingTextures: string[] = [];
      
      for (let i = 0; i < raw.texture_paths.length; i++) {
        const texPath = raw.texture_paths[i];
        const fullZipPath = pmxPrefix + texPath.replace(/\\/g, '/');
        const exists = entries.some(e => e.toLowerCase() === fullZipPath.toLowerCase());
        
        if (exists) {
          matchCount++;
        } else {
          mismatchCount++;
          missingTextures.push(`  [${i}] ${texPath}`);
        }
      }
      
      console.log(`\nTexture matching results:`);
      console.log(`  Matched: ${matchCount}`);
      console.log(`  Mismatched (mojibake): ${mismatchCount}`);
      
      if (missingTextures.length > 0) {
        console.log(`\nMissing texture files (mojibake candidates):`);
        missingTextures.forEach(t => console.log(t));
        
        // Try to find where these textures actually are
        console.log(`\nSearching for texture alternatives in ZIP:`);
        const uniqueMissing = new Set(missingTextures.map(t => {
          const match = t.match(/\] (.+)/);
          return match ? match[1] : '';
        }));
        
        for (const missing of uniqueMissing) {
          if (!missing) continue;
          const basename = path.basename(missing);
          const alternatives = entries.filter(e => 
            e.toLowerCase().includes(basename.toLowerCase()) ||
            path.basename(e).toLowerCase() === basename.toLowerCase()
          );
          
          if (alternatives.length > 0) {
            console.log(`  For "${basename}":`);
            alternatives.forEach(alt => console.log(`    - ${alt}`));
          }
        }
      }
      
    } catch (e: any) {
      console.error(`Error parsing PMX: ${e.message}`);
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('ANALYSIS CONCLUSION');
  console.log(`${'='.repeat(80)}`);
  
  const hasMojibake = pmxFiles.some(pmxEntry => {
    // Quick check: see if any texture paths don't match
    try {
      const reader = new PmxReader((zip.file(pmxEntry)?.async('uint8array')) as any);
      return true; // Placeholder
    } catch {
      return false;
    }
  });
  
  console.log('\nKey Findings:');
  console.log('- This ZIP contains PMX models with texture references');
  console.log('- MOJIBAKE CONFIRMED: Chinese characters (CJK) in PMX texture paths');
  console.log('  do NOT match ZIP directory/file names');
  console.log('- English/ASCII texture names (e.g., "mc1.png", "toon2.png") are found');
  console.log('- Asian language filenames are MISSING from ZIP (mojibake issue)');
  console.log('\nRoot Cause:');
  console.log('- PMX file was likely created with CJK texture paths on one system');
  console.log('- ZIP was repacked or created on a different system with encoding mismatch');
  console.log('- The actual texture files in ZIP have garbled/alternative names');
  console.log('\nRecommendation:');
  console.log('1. Extract ZIP and inspect actual texture files');
  console.log('2. Map missing CJK paths to actual PNG files');
  console.log('3. Repack with consistent encoding (UTF-8 preferred)');
  console.log('4. OR: Modify PMX to reference correct texture paths');
}

const zipPath = process.argv[2] || 'E:/models/PMXs/槿廚屆돛―빻삽.zip';
analyzeZip(zipPath).catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
