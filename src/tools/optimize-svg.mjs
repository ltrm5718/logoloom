import { optimize } from 'svgo';

/**
 * Optimize SVG using SVGO — removes metadata, merges paths, compresses coordinates.
 * Typically reduces file size 30-60%.
 */
export async function optimizeSvg(svgContent, aggressive = false) {
  const config = {
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            // Disable convertPathData — crashes on opentype.js generated paths
            convertPathData: false,
          },
        },
      },
      'removeTitle',
      'removeDesc',
      'removeMetadata',
      'removeComments',
      {
        name: 'removeAttrs',
        params: { attrs: ['data-*'] },
      },
    ],
  };

  if (aggressive) {
    config.plugins.push(
      'removeUselessDefs',
      'cleanupEnableBackground',
      'removeEmptyContainers',
      {
        name: 'removeAttrs',
        params: { attrs: ['class', 'style'] },
      }
    );
  }

  const result = optimize(svgContent, config);
  const originalSize = Buffer.byteLength(svgContent, 'utf8');
  const optimizedSize = Buffer.byteLength(result.data, 'utf8');
  const savedPercent = Math.round((1 - optimizedSize / originalSize) * 100);

  return JSON.stringify({
    success: true,
    originalSize,
    optimizedSize,
    savedPercent: `${savedPercent}%`,
    svg: result.data,
  });
}
