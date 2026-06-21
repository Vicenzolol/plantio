// Gera os ícones PNG do PWA a partir do public/favicon.svg.
// Uso: node scripts/gen-icons.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const svg = readFileSync(resolve(root, 'public/favicon.svg'));

mkdirSync(resolve(root, 'public/icons'), { recursive: true });

const targets = [
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/icon-512.png', size: 512 },
  { file: 'public/icons/icon-maskable-512.png', size: 512, padding: true },
  { file: 'public/apple-touch-icon.png', size: 180, bg: '#0a84ff' },
];

for (const t of targets) {
  let img = sharp(svg).resize(t.size, t.size);
  if (t.padding) {
    // maskable: reduz o conteúdo e adiciona margem segura
    const inner = Math.round(t.size * 0.78);
    img = sharp(svg)
      .resize(inner, inner)
      .extend({
        top: Math.round((t.size - inner) / 2),
        bottom: Math.round((t.size - inner) / 2),
        left: Math.round((t.size - inner) / 2),
        right: Math.round((t.size - inner) / 2),
        background: '#0a84ff',
      });
  }
  if (t.bg) {
    img = img.flatten({ background: t.bg });
  }
  await img.png().toFile(resolve(root, t.file));
  console.log('gerado', t.file);
}
console.log('Ícones gerados.');
