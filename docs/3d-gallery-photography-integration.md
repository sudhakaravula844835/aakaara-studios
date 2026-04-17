# 3D Gallery Integration Notes

## Current repo status

This repository is currently a static HTML/CSS/JavaScript site.

It does **not** yet include:

- React
- TypeScript
- Tailwind CSS
- `components.json` from shadcn
- a framework entry like Next.js `app/` or Vite `src/`

Because of that, the new gallery files added under `components/ui/` are source files for a future React layer, not something the current `index.html` can render directly.

## Default paths

There is no existing shadcn path config in this repo yet, so the recommended defaults are:

- Components: `/components/ui`
- Global styles: `/app/globals.css` in a Next.js App Router setup

If you build this as a Vite React app instead, the equivalent global stylesheet is usually `/src/index.css`.

## Why `/components/ui` matters

Keeping shared shadcn-style components in `/components/ui` gives you:

- predictable imports like `@/components/ui/...`
- a clean separation between reusable UI and page-level code
- easier shadcn CLI updates later
- a standard location that other developers will immediately understand

## Files added

- `/components/ui/3d-gallery-photography.tsx`
- `/components/ui/demo.tsx`

## Required dependencies

At minimum, this component expects:

```bash
npm install react react-dom three @react-three/fiber @react-three/drei lucide-react
```

If you convert this repo to TypeScript and Tailwind from scratch, also add:

```bash
npm install -D typescript @types/react @types/react-dom tailwindcss postcss autoprefixer
```

## Recommended setup path

### Option A: cleanest path for shadcn

Create a proper React app first, then move these files in:

```bash
npx create-next-app@latest studio-react --typescript --tailwind --app
cd studio-react
npx shadcn@latest init
npm install three @react-three/fiber @react-three/drei lucide-react
```

Then copy:

- `components/ui/3d-gallery-photography.tsx`
- `components/ui/demo.tsx`

### Option B: upgrade this repo in place

If you want this exact repo to support the component, you need to add a real React toolchain first:

1. Add React and React DOM.
2. Add TypeScript and create `tsconfig.json`.
3. Add Tailwind and global CSS entry.
4. Add a bundler/framework entry point such as Next.js App Router or Vite.
5. Run `npx shadcn@latest init`.

Until those pieces exist, the TSX component files will not render inside the current static site.

## Props and behavior

### Props this component expects

- `images`: array of image URLs or `{ src, alt }` objects
- `speed`: motion sensitivity multiplier
- `zSpacing`: depth spacing between planes
- `visibleCount`: number of rendered planes
- `falloff`: depth range tuning
- `fadeSettings`: opacity timing
- `blurSettings`: blur timing
- `className` and `style`: wrapper sizing/styling

### State behavior

The component manages:

- autoplay when the user is idle
- wheel input
- arrow key input
- touch drag input
- hover-driven cloth animation
- WebGL fallback handling

## Assets

No local assets are required. The demo uses remote Unsplash image URLs.

## Responsive behavior

Best use is a full-viewport or large hero section. The component works best in:

- a homepage hero
- a portfolio introduction
- an editorial campaign landing section

For smaller mobile sections, reduce `visibleCount` and keep the overlay copy minimal.

## Best placement in an app

The strongest placement is as a full-screen landing block above supporting text, with short centered copy layered over the canvas.
