#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { textToPath } from './tools/text-to-path.mjs';
import { optimizeSvg } from './tools/optimize-svg.mjs';
import { exportBrandKit } from './tools/export-brand-kit.mjs';
import { imageToSvg } from './tools/image-to-svg.mjs';
import { z } from 'zod';

const server = new McpServer({
  name: 'logoloom',
  version: '1.0.0',
});

server.tool(
  'text_to_path',
  'Convert <text> elements in SVG to <path> elements using font outlines. Makes SVG font-independent — text renders correctly everywhere without requiring the original font.',
  {
    svg: z.string().describe('SVG content with <text> elements'),
    fontPath: z.string().optional().describe('Path to .ttf/.otf font file. Uses bundled Inter if not provided.'),
  },
  async ({ svg, fontPath }) => ({
    content: [{ type: 'text', text: await textToPath(svg, fontPath) }],
  })
);

server.tool(
  'optimize_svg',
  'Optimize SVG by removing metadata, merging paths, compressing coordinates. Typically reduces size 30-60%.',
  {
    svg: z.string().describe('SVG content to optimize'),
    aggressive: z.boolean().optional().describe('More aggressive optimization. Default: false.'),
  },
  async ({ svg, aggressive }) => ({
    content: [{ type: 'text', text: await optimizeSvg(svg, aggressive) }],
  })
);

server.tool(
  'export_brand_kit',
  'Export SVG logo into complete brand kit: PNG (256/512/1024), ICO favicon, WebP, OG image (1200x630), color variants, BRAND.md guidelines.',
  {
    svg: z.string().describe('Finalized SVG logo content'),
    outputDir: z.string().describe('Directory to write brand kit files to'),
    name: z.string().describe('Project/brand name'),
    colors: z.object({
      primary: z.string().optional(),
      secondary: z.string().optional(),
      textLight: z.string().optional(),
      textDark: z.string().optional(),
      bgLight: z.string().optional(),
      bgDark: z.string().optional(),
    }).optional().describe('Brand colors (hex codes)'),
    darkSvg: z.string().optional().describe('Dark mode SVG variant'),
  },
  async (args) => ({
    content: [{ type: 'text', text: await exportBrandKit(args) }],
  })
);

server.tool(
  'image_to_svg',
  'Convert raster image (PNG/JPG) to SVG vector using vtracer. Best for logos, icons, flat graphics.',
  {
    imagePath: z.string().describe('Path to input image (PNG or JPG)'),
    colorMode: z.enum(['color', 'binary']).optional().describe('Color mode. Default: color.'),
    precision: z.number().optional().describe('Path precision 1-10. Default: 6.'),
  },
  async ({ imagePath, colorMode, precision }) => ({
    content: [{ type: 'text', text: await imageToSvg(imagePath, colorMode, precision) }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
