import opentype from 'opentype.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLED_FONT = join(__dirname, '..', 'fonts', 'Inter-Bold.ttf');

/**
 * Convert <text> elements in SVG to <path> elements using font outlines.
 * This makes the SVG font-independent — it renders correctly everywhere.
 */
export async function textToPath(svgContent, fontPath) {
  const fontFile = fontPath && existsSync(fontPath) ? fontPath : BUNDLED_FONT;

  if (!existsSync(fontFile)) {
    return JSON.stringify({
      success: false,
      error: 'No font file found. Provide a fontPath or ensure Inter-Bold.ttf is in src/fonts/',
      svg: svgContent,
    });
  }

  const font = await opentype.load(fontFile);

  // Parse all <text> elements
  const textRegex = /<text([^>]*)>(.*?)<\/text>/gs;
  let result = svgContent;
  let match;
  let convertedCount = 0;

  while ((match = textRegex.exec(svgContent)) !== null) {
    const [fullMatch, attrs, textContent] = match;

    // Extract attributes
    const x = parseFloat(extractAttr(attrs, 'x') || '0');
    const y = parseFloat(extractAttr(attrs, 'y') || '0');
    const fontSize = parseFloat(extractAttr(attrs, 'font-size') || '16');
    const fill = extractAttr(attrs, 'fill') || '#000000';
    const textAnchor = extractAttr(attrs, 'text-anchor') || 'start';
    const fontWeight = extractAttr(attrs, 'font-weight') || '400';
    const letterSpacing = parseFloat(extractAttr(attrs, 'letter-spacing') || '0');

    // Handle <tspan> elements inside text
    const plainText = textContent.replace(/<tspan[^>]*>(.*?)<\/tspan>/g, '$1').replace(/<[^>]+>/g, '');

    if (!plainText.trim()) continue;

    // Generate path
    const path = font.getPath(plainText, 0, 0, fontSize);
    const pathData = path.toPathData(2);

    // Calculate text width for anchor alignment
    const bbox = path.getBoundingBox();
    const textWidth = bbox.x2 - bbox.x1;

    let offsetX = x;
    if (textAnchor === 'middle') offsetX = x - textWidth / 2;
    else if (textAnchor === 'end') offsetX = x - textWidth;

    // Apply letter spacing (approximate)
    let finalPathData = pathData;
    if (letterSpacing !== 0) {
      // Re-generate with manual spacing
      let currentX = 0;
      let spacedPaths = [];
      for (const char of plainText) {
        const charPath = font.getPath(char, currentX, 0, fontSize);
        spacedPaths.push(charPath.toPathData(2));
        const glyph = font.charToGlyph(char);
        currentX += (glyph.advanceWidth / font.unitsPerEm) * fontSize + letterSpacing;
      }
      finalPathData = spacedPaths.join(' ');
    }

    const pathElement = `<path d="${finalPathData}" fill="${fill}" transform="translate(${offsetX}, ${y})"/>`;
    result = result.replace(fullMatch, pathElement);
    convertedCount++;
  }

  return JSON.stringify({
    success: true,
    convertedCount,
    svg: result,
  });
}

function extractAttr(attrString, name) {
  const regex = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i');
  const match = attrString.match(regex);
  return match ? match[1] : null;
}
