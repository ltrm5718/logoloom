import sharp from 'sharp';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Export SVG into a full brand kit — 3 categories:
 * 1. Full logo (icon + wordmark)
 * 2. Icon only (square, for avatars/favicons)
 * 3. Wordmark only (text, for headers)
 *
 * Each category gets: SVG (light/dark/mono) + PNG (multiple sizes)
 * Plus: favicons, OG image, social sizes, BRAND.md
 */
export async function exportBrandKit({ svg, outputDir, name, colors = {}, darkSvg }) {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const results = [];
  const fullSvgBuffer = Buffer.from(svg);

  // ============================
  // 1. FULL LOGO (icon + wordmark)
  // ============================

  writeFileSync(join(outputDir, 'logo-full-light.svg'), svg);
  results.push('logo-full-light.svg');

  if (darkSvg) {
    writeFileSync(join(outputDir, 'logo-full-dark.svg'), darkSvg);
    results.push('logo-full-dark.svg');
  }

  // Full logo PNGs (wide)
  for (const width of [800, 400]) {
    const buf = await renderPng(fullSvgBuffer, { width });
    writeFileSync(join(outputDir, `logo-full-${width}w.png`), buf);
    results.push(`logo-full-${width}w.png`);
  }

  // Full logo mono
  writeFileSync(join(outputDir, 'logo-full-mono-black.svg'), createMonoVariant(svg, '#000000'));
  writeFileSync(join(outputDir, 'logo-full-mono-white.svg'), createMonoVariant(svg, '#ffffff'));
  results.push('logo-full-mono-black.svg', 'logo-full-mono-white.svg');

  // ============================
  // 2. ICON ONLY (square, for avatars/favicons/app icons)
  // ============================

  const iconSvg = extractIconSvg(svg);
  const iconSource = iconSvg || svg;
  const iconBuffer = Buffer.from(iconSource);

  if (iconSvg) {
    writeFileSync(join(outputDir, 'icon-light.svg'), iconSvg);
    results.push('icon-light.svg');

    if (darkSvg) {
      const darkIcon = extractIconSvg(darkSvg);
      if (darkIcon) {
        writeFileSync(join(outputDir, 'icon-dark.svg'), darkIcon);
        results.push('icon-dark.svg');
      }
    }
  }

  // Icon mono
  writeFileSync(join(outputDir, 'icon-mono-black.svg'), createMonoVariant(iconSource, '#000000'));
  writeFileSync(join(outputDir, 'icon-mono-white.svg'), createMonoVariant(iconSource, '#ffffff'));
  results.push('icon-mono-black.svg', 'icon-mono-white.svg');

  // Icon PNGs — standard sizes people actually need
  // 16, 32, 48: favicons
  // 64: small UI
  // 128: medium UI
  // 180: Apple touch icon
  // 192: Android PWA
  // 256: Windows tile
  // 512: Google PWA, high-res
  // 1024: App Store
  for (const size of [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024]) {
    const buf = await renderPng(iconBuffer, { width: size, height: size });
    writeFileSync(join(outputDir, `icon-${size}.png`), buf);
    results.push(`icon-${size}.png`);
  }

  // Icon WebP
  const webp = await sharp(iconBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toBuffer();
  writeFileSync(join(outputDir, 'icon-512.webp'), webp);
  results.push('icon-512.webp');

  // Favicon ICO (32px PNG saved as .ico — browsers accept this)
  const ico = await renderPng(iconBuffer, { width: 32, height: 32 });
  writeFileSync(join(outputDir, 'favicon.ico'), ico);
  results.push('favicon.ico');

  // Apple touch icon (180px, required by iOS Safari)
  // Already exported as icon-180.png above

  // ============================
  // 3. WORDMARK ONLY (text, no icon — for headers, inline use)
  // ============================

  const wordmarkSvg = extractWordmarkSvg(svg);
  if (wordmarkSvg) {
    writeFileSync(join(outputDir, 'wordmark-light.svg'), wordmarkSvg);
    results.push('wordmark-light.svg');

    if (darkSvg) {
      const darkWordmark = extractWordmarkSvg(darkSvg);
      if (darkWordmark) {
        writeFileSync(join(outputDir, 'wordmark-dark.svg'), darkWordmark);
        results.push('wordmark-dark.svg');
      }
    }

    // Wordmark PNGs
    const wmBuffer = Buffer.from(wordmarkSvg);
    for (const width of [600, 300]) {
      const buf = await renderPng(wmBuffer, { width });
      writeFileSync(join(outputDir, `wordmark-${width}w.png`), buf);
      results.push(`wordmark-${width}w.png`);
    }

    // Wordmark mono
    writeFileSync(join(outputDir, 'wordmark-mono-black.svg'), createMonoVariant(wordmarkSvg, '#000000'));
    writeFileSync(join(outputDir, 'wordmark-mono-white.svg'), createMonoVariant(wordmarkSvg, '#ffffff'));
    results.push('wordmark-mono-black.svg', 'wordmark-mono-white.svg');
  }

  // ============================
  // 4. SOCIAL MEDIA SIZES
  // ============================

  const ogBg = colors.bgLight || '#ffffff';

  // OG image (1200x630) — used by Facebook, LinkedIn, Twitter cards
  const ogBuffer = await createSocialImage(fullSvgBuffer, 1200, 630, ogBg);
  writeFileSync(join(outputDir, 'og-image.png'), ogBuffer);
  results.push('og-image.png');

  // Twitter header (1500x500)
  const twitterHeader = await createSocialImage(fullSvgBuffer, 1500, 500, ogBg);
  writeFileSync(join(outputDir, 'twitter-header.png'), twitterHeader);
  results.push('twitter-header.png');

  // GitHub social preview (1280x640)
  const ghPreview = await createSocialImage(fullSvgBuffer, 1280, 640, ogBg);
  writeFileSync(join(outputDir, 'github-social-preview.png'), ghPreview);
  results.push('github-social-preview.png');

  // ============================
  // 5. PREVIEW HTML
  // ============================

  const previewHtml = generatePreviewHtml(name, results, iconSvg, wordmarkSvg);
  writeFileSync(join(outputDir, 'preview.html'), previewHtml);
  results.push('preview.html');

  // ============================
  // 6. BRAND.MD
  // ============================

  const brandMd = generateBrandMd(name, colors, wordmarkSvg !== null);
  writeFileSync(join(outputDir, 'BRAND.md'), brandMd);
  results.push('BRAND.md');

  return JSON.stringify({
    success: true,
    outputDir,
    files: results,
    totalFiles: results.length,
  });
}

// ============================
// Helper functions
// ============================

async function renderPng(svgBuffer, { width, height }) {
  const opts = { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } };
  if (width && height) {
    return sharp(svgBuffer).resize(width, height, opts).png().toBuffer();
  }
  return sharp(svgBuffer).resize(width, null, opts).png().toBuffer();
}

async function createSocialImage(logoSvgBuffer, width, height, bgColor) {
  const logoWidth = Math.round(width * 0.55);
  const logoHeight = Math.round(height * 0.35);

  return sharp({
    create: { width, height, channels: 4, background: hexToRgba(bgColor) },
  })
    .composite([{
      input: await sharp(logoSvgBuffer)
        .resize(logoWidth, logoHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
      gravity: 'center',
    }])
    .png()
    .toBuffer();
}

function extractIconSvg(svg) {
  if (svg.includes('viewBox="0 0 100 100"')) return svg;

  // Match translate(10,10) or translate(10 10) (SVGO removes comma)
  const iconMatch = svg.match(/<g[^>]*transform="translate\(10[, ]10\)"[^>]*>([\s\S]*?)<\/g>/);
  if (iconMatch) {
    const defsMatch = svg.match(/<defs>[\s\S]*?<\/defs>/);
    const defs = defsMatch ? defsMatch[0] : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${defs}${iconMatch[1]}</svg>`;
  }
  return null;
}

function extractWordmarkSvg(svg) {
  const defsMatch = svg.match(/<defs>[\s\S]*?<\/defs>/);
  const defs = defsMatch ? defsMatch[0] : '';

  // Strategy 1: Find a <g> that contains <text> elements
  const groups = [...svg.matchAll(/<g[^>]*>([\s\S]*?)<\/g>/g)];
  for (const group of groups) {
    if (group[1].includes('<text') && !group[1].includes('<rect') && !group[1].includes('<circle')) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 270 80" width="270" height="80">${defs}<g transform="translate(0,32)">${group[1]}</g></svg>`;
    }
  }

  // Strategy 2: SVGO may have moved <text> elements out of <g> — find all <text> with translate(130
  const textElements = [...svg.matchAll(/<text[^>]*transform="translate\(130[^"]*\)"[^>]*>[\s\S]*?<\/text>/g)];
  if (textElements.length > 0) {
    const texts = textElements.map(m => m[0].replace(/transform="translate\(130[, ]\d+\)"/, 'transform="translate(0,32)"')).join('\n');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 270 80" width="270" height="80">${defs}${texts}</svg>`;
  }

  return null;
}

function createMonoVariant(svg, fillColor) {
  let mono = svg;
  mono = mono.replace(/fill="url\(#[^"]*\)"/g, `fill="${fillColor}"`);
  mono = mono.replace(/stroke="url\(#[^"]*\)"/g, `stroke="${fillColor}"`);
  mono = mono.replace(/fill="(?!none)[^"]*"/g, `fill="${fillColor}"`);
  mono = mono.replace(/stroke="(?!none)[^"]*"/g, `stroke="${fillColor}"`);
  mono = mono.replace(/<defs>[\s\S]*?<\/defs>/g, '');
  return mono;
}

function hexToRgba(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b, alpha: 1 };
}

function generatePreviewHtml(name, files, hasIcon, hasWordmark) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${name} Brand Kit — LogoLoom</title>
<style>
  body { font-family: system-ui; background: #f1f5f9; margin: 0; padding: 40px; }
  h1 { color: #0f172a; } h1 span { color: #ea580c; }
  .section { margin-bottom: 48px; }
  .section h2 { color: #ea580c; border-bottom: 2px solid #fed7aa; padding-bottom: 8px; font-size: 20px; }
  .row { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
  .box { padding: 16px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; }
  .label { font-size: 12px; color: #64748b; margin-top: 4px; text-align: center; }
  .card { display: inline-flex; flex-direction: column; align-items: center; }
</style></head><body>
<h1>${name} Brand Kit <span>— LogoLoom</span></h1>
<p style="color:#64748b;">${files.filter(f => !f.endsWith('.html')).length} files generated.</p>

<div class="section">
  <h2>1. Full Logo (icon + wordmark)</h2>
  <div class="row">
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="logo-full-light.svg" width="400"></div><div class="label">Light SVG</div></div>
    ${files.includes('logo-full-dark.svg') ? '<div class="card"><div class="box" style="background:#0f172a;"><img src="logo-full-dark.svg" width="400"></div><div class="label">Dark SVG</div></div>' : ''}
  </div>
  <div class="row" style="margin-top:12px;">
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="logo-full-800w.png" width="400"></div><div class="label">PNG 800w</div></div>
  </div>
  <div class="row" style="margin-top:12px;">
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="logo-full-mono-black.svg" width="300"></div><div class="label">Mono Black</div></div>
    <div class="card"><div class="box" style="background:#1c1917;"><img src="logo-full-mono-white.svg" width="300"></div><div class="label">Mono White</div></div>
  </div>
</div>

<div class="section">
  <h2>2. Icon Only (avatar, favicon, app icon)</h2>
  <div class="row">
    ${hasIcon ? '<div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="icon-light.svg" width="80"></div><div class="label">SVG Light</div></div>' : ''}
    ${files.includes('icon-dark.svg') ? '<div class="card"><div class="box" style="background:#1c1917;"><img src="icon-dark.svg" width="80"></div><div class="label">SVG Dark</div></div>' : ''}
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="icon-mono-black.svg" width="64"></div><div class="label">Mono Black</div></div>
    <div class="card"><div class="box" style="background:#1c1917;"><img src="icon-mono-white.svg" width="64"></div><div class="label">Mono White</div></div>
  </div>
  <div class="row" style="margin-top:12px;">
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="icon-1024.png" width="80"></div><div class="label">1024</div></div>
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="icon-512.png" width="64"></div><div class="label">512</div></div>
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="icon-256.png" width="48"></div><div class="label">256</div></div>
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="icon-192.png" width="40"></div><div class="label">192 PWA</div></div>
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="icon-180.png" width="36"></div><div class="label">180 Apple</div></div>
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="icon-128.png" width="32"></div><div class="label">128</div></div>
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="icon-64.png" width="24"></div><div class="label">64</div></div>
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="icon-48.png" width="20"></div><div class="label">48</div></div>
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="icon-32.png" width="16"></div><div class="label">32</div></div>
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="icon-16.png" width="16"></div><div class="label">16</div></div>
  </div>
</div>

${hasWordmark ? `<div class="section">
  <h2>3. Wordmark Only (text, no icon)</h2>
  <div class="row">
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="wordmark-light.svg" width="270"></div><div class="label">Light SVG</div></div>
    ${files.includes('wordmark-dark.svg') ? '<div class="card"><div class="box" style="background:#0f172a;"><img src="wordmark-dark.svg" width="270"></div><div class="label">Dark SVG</div></div>' : ''}
  </div>
  <div class="row" style="margin-top:12px;">
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="wordmark-mono-black.svg" width="200"></div><div class="label">Mono Black</div></div>
    <div class="card"><div class="box" style="background:#1c1917;"><img src="wordmark-mono-white.svg" width="200"></div><div class="label">Mono White</div></div>
  </div>
</div>` : ''}

<div class="section">
  <h2>4. Social Media</h2>
  <div class="row">
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="og-image.png" width="480"></div><div class="label">OG Image 1200×630</div></div>
  </div>
  <div class="row" style="margin-top:12px;">
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="github-social-preview.png" width="480"></div><div class="label">GitHub Social 1280×640</div></div>
  </div>
  <div class="row" style="margin-top:12px;">
    <div class="card"><div class="box" style="background:white; border:1px solid #e2e8f0;"><img src="twitter-header.png" width="480"></div><div class="label">Twitter Header 1500×500</div></div>
  </div>
</div>

</body></html>`;
}

function generateBrandMd(name, colors, hasWordmark) {
  const primary = colors.primary || '#ea580c';
  const secondary = colors.secondary || '#db2777';
  const textLight = colors.textLight || '#1c1917';
  const textDark = colors.textDark || '#fef3c7';
  const bgLight = colors.bgLight || '#ffffff';
  const bgDark = colors.bgDark || '#18120b';

  return `# ${name} — Brand Guidelines

## Logo Files

### 1. Full Logo (icon + wordmark)
| File | Usage |
|------|-------|
| \`logo-full-light.svg\` | Primary — light backgrounds |
| \`logo-full-dark.svg\` | Dark backgrounds |
| \`logo-full-800w.png\` / \`400w.png\` | README header, presentations |
| \`logo-full-mono-black.svg\` | Single-color printing |
| \`logo-full-mono-white.svg\` | Single-color on dark |

### 2. Icon Only (avatar, favicon, app icon)
| File | Usage |
|------|-------|
| \`icon-light.svg\` / \`icon-dark.svg\` | SVG icon |
| \`icon-mono-black.svg\` / \`icon-mono-white.svg\` | Single-color |
| \`icon-1024.png\` | App Store |
| \`icon-512.png\` | Google PWA, high-res |
| \`icon-256.png\` | Windows tile |
| \`icon-192.png\` | Android PWA manifest |
| \`icon-180.png\` | Apple touch icon |
| \`icon-128.png\` | Medium UI |
| \`icon-64.png\` | Small UI |
| \`icon-48.png\` / \`icon-32.png\` / \`icon-16.png\` | Favicons |
| \`favicon.ico\` | Browser favicon |
| \`icon-512.webp\` | Web optimized |

${hasWordmark ? `### 3. Wordmark Only (text, no icon)
| File | Usage |
|------|-------|
| \`wordmark-light.svg\` / \`wordmark-dark.svg\` | Headers, inline |
| \`wordmark-600w.png\` / \`300w.png\` | Raster wordmark |
| \`wordmark-mono-black.svg\` / \`mono-white.svg\` | Single-color |
` : ''}
### 4. Social Media
| File | Size | Usage |
|------|------|-------|
| \`og-image.png\` | 1200×630 | Facebook, LinkedIn, default share |
| \`github-social-preview.png\` | 1280×640 | GitHub repo social preview |
| \`twitter-header.png\` | 1500×500 | Twitter/X profile header |

## Colors

| Name | Hex | Usage |
|------|-----|-------|
| Primary | \`${primary}\` | Gradient start, CTA, accents |
| Secondary | \`${secondary}\` | Gradient end, hover states |
| Text (light bg) | \`${textLight}\` | Body text on white/light |
| Text (dark bg) | \`${textDark}\` | Body text on dark |
| Background (light) | \`${bgLight}\` | Light mode |
| Background (dark) | \`${bgDark}\` | Dark mode |

## Typography

- Headings: system-ui, -apple-system, sans-serif — weight 800
- Body: system-ui, -apple-system, sans-serif — weight 400

## Usage Rules

- Minimum icon size: 16×16px
- Always maintain original aspect ratio
- Do not stretch, rotate, skew, or add drop shadows
- Use monochrome variant for single-color printing
- Minimum clear space: 25% of icon width on all sides

Generated by [LogoLoom](https://github.com/mcpware/logoloom)
`;
}
