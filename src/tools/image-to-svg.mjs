import { execSync } from 'child_process';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

/**
 * Convert raster image (PNG/JPG) to SVG using vtracer.
 * Best for logos, icons, flat graphics. Not suitable for photographs.
 */
export async function imageToSvg(imagePath, colorMode = 'color', precision = 6) {
  if (!existsSync(imagePath)) {
    return JSON.stringify({ success: false, error: `File not found: ${imagePath}` });
  }

  const outputPath = join(tmpdir(), `logoloom-trace-${Date.now()}.svg`);

  try {
    // Try using vtracer CLI if installed
    const vtracerArgs = [
      '--input', imagePath,
      '--output', outputPath,
      '--colormode', colorMode === 'binary' ? 'binary' : 'color',
      '--precision', String(Math.min(10, Math.max(1, precision))),
      '--filter_speckle', '4',
      '--color_precision', '6',
      '--corner_threshold', '60',
      '--segment_length', '4',
      '--splice_threshold', '45',
    ];

    try {
      execSync(`vtracer ${vtracerArgs.join(' ')}`, { timeout: 30000 });
    } catch {
      // If vtracer CLI not found, try npx @aspect/vtracer or fallback
      try {
        execSync(`npx -y vtracer-cli ${vtracerArgs.join(' ')}`, { timeout: 60000 });
      } catch {
        // Last resort: try potrace for binary mode
        if (colorMode === 'binary') {
          try {
            execSync(`potrace --svg --output ${outputPath} ${imagePath}`, { timeout: 30000 });
          } catch {
            return JSON.stringify({
              success: false,
              error: 'No vectorizer found. Install vtracer (cargo install vtracer) or potrace (apt install potrace).',
            });
          }
        } else {
          return JSON.stringify({
            success: false,
            error: 'No color vectorizer found. Install vtracer: cargo install vtracer',
          });
        }
      }
    }

    if (!existsSync(outputPath)) {
      return JSON.stringify({ success: false, error: 'Vectorization produced no output' });
    }

    const svgContent = readFileSync(outputPath, 'utf-8');
    const fileSize = Buffer.byteLength(svgContent, 'utf8');

    // Cleanup temp file
    try { unlinkSync(outputPath); } catch {}

    return JSON.stringify({
      success: true,
      fileSize,
      svg: svgContent,
    });
  } catch (error) {
    return JSON.stringify({ success: false, error: error.message });
  }
}
