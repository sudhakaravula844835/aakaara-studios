import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import vm from 'node:vm';

// The player catalogue remains the single source for film titles, streams and covers.
const root = fileURLToPath(new URL('../', import.meta.url));
const template = readFileSync(resolve(root, 'films/watch.html'), 'utf8');
const match = template.match(/const VIDEOS = (\{[\s\S]*?\n\});/);
if (!match) throw new Error('Film catalogue not found');
const films = vm.runInNewContext(`(${match[1]})`, Object.create(null), { timeout: 1000 });
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const site = 'https://aakaarastudios.com';
const routes = [];
// A couple with several films (wedding + pre-wedding) shares one name, so qualify the
// title with the category only where names collide. Matches the player's runtime title.
const nameCounts = new Map();
for (const { title } of Object.values(films)) nameCounts.set(title, (nameCounts.get(title) || 0) + 1);
mkdirSync(resolve(root, 'films/generated'), { recursive: true });
for (const [slug, film] of Object.entries(films)) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Invalid film slug: ${slug}`);
  const title = nameCounts.get(film.title) > 1
    ? `${film.title} — ${film.category} · Aakaara Studios NYC`
    : `${film.title} — Aakaara Studios NYC`;
  const description = `${film.type} · ${film.category}. Watch ${film.title} by Aakaara Studios NYC.`;
  const image = new URL(film.poster || '/images/og-cover.jpg', site).href;
  const url = `${site}/films/${slug}`;
  let page = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(title)}</title>`);
  const tags = { description, 'og:title': title, 'og:description': description, 'og:image': image, 'twitter:image': image };
  for (const [name, value] of Object.entries(tags)) {
    page = page.replace(new RegExp(`<meta (?:name|property)="${name}" content="[^"]*">`), `<meta ${name.startsWith('og:') ? 'property' : 'name'}="${name}" content="${escape(value)}">`);
  }
  // Cover aspect ratios vary; omit the generic cover's hard-coded dimensions.
  page = page.replace(/<meta property="og:image:(?:width|height)"[^>]*>\n/g, '');
  page = page.replace('</head>', `<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n<meta property="og:image:alt" content="${escape(film.title)}">\n<meta name="twitter:title" content="${escape(title)}">\n<meta name="twitter:description" content="${escape(description)}">\n</head>`);
  // Also works when the generated HTML is opened directly for verification.
  page = page.replace(/^const slug = normalizeSlug\([^\n]+;$/m, `const slug = ${JSON.stringify(slug)};`);
  writeFileSync(resolve(root, `films/generated/${slug}.html`), page);
  routes.push(`/films/${slug}  /films/generated/${slug}.html  200`);
}
const redirectsPath = resolve(root, '_redirects');
let redirects = readFileSync(redirectsPath, 'utf8').replace(/# BEGIN GENERATED FILM ROUTES\n[\s\S]*?# END GENERATED FILM ROUTES\n\n/g, '');
const block = `# BEGIN GENERATED FILM ROUTES\n${routes.join('\n')}\n# END GENERATED FILM ROUTES\n\n`;
redirects = redirects.replace('/films/:slug', block + '/films/:slug');
writeFileSync(redirectsPath, redirects);
console.log(`Generated ${routes.length} film pages with crawler-readable metadata.`);
