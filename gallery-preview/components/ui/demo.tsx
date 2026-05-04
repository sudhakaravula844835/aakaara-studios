import { FocusRail, type FocusRailItem } from "@/components/ui/focus-rail";

const VIDEO_WORKS_ITEMS: FocusRailItem[] = [
  {
    id: 1,
    title: "Pooja & Amit",
    description:
      "A timeless wedding story told through light, motion, and quiet ceremony.",
    meta: "Wedding Film",
    imageSrc:
      "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1000&auto=format&fit=crop",
    href: "#",
  },
  {
    id: 2,
    title: "Vyshnavi & Daniel",
    description:
      "Love found across cultures, captured in Philadelphia's golden afternoon.",
    meta: "Engagement Film",
    imageSrc:
      "https://images.unsplash.com/photo-1529634806980-85c3dd6d34ac?q=80&w=1000&auto=format&fit=crop",
    href: "#",
  },
  {
    id: 3,
    title: "Abhinav & Megha",
    description:
      "A Houston wedding — tradition, joy, and cinematic grandeur distilled into one film.",
    meta: "Wedding Film",
    imageSrc:
      "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?q=80&w=1000&auto=format&fit=crop",
    href: "#",
  },
  {
    id: 4,
    title: "Hemanth",
    description:
      "Quiet moments, unspoken poetry — a pre-wedding reverie set in natural light.",
    meta: "Pre-Wedding Film",
    imageSrc:
      "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=1000&auto=format&fit=crop",
    href: "#",
  },
  {
    id: 5,
    title: "Sameeksha NYC",
    description:
      "New York through a conceptual lens — raw energy, city light, and a singular presence.",
    meta: "Conceptual Film",
    imageSrc:
      "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=1000&auto=format&fit=crop",
    href: "#",
  },
  {
    id: 6,
    title: "Suprith & Pragnya",
    description:
      "The season before forever — a pre-wedding film wrapped in warmth and wonder.",
    meta: "Pre-Wedding Film",
    imageSrc:
      "https://images.unsplash.com/photo-1583939003579-730e3918a45a?q=80&w=1000&auto=format&fit=crop",
    href: "#",
  },
  {
    id: 7,
    title: "Darzi Suits",
    description:
      "Where heritage meets modern craft — a brand film for a new era of Indian fashion.",
    meta: "Brand Film",
    imageSrc:
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1000&auto=format&fit=crop",
    href: "#",
  },
];

export default function VideoWorksDemo() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden bg-neutral-950 py-20">
      <div className="mb-12 text-center">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-neutral-500">
          Aakaara Studios NYC
        </p>
        <h1 className="text-4xl font-bold text-white">Video Works</h1>
        <p className="mt-2 text-neutral-400">
          Stories in motion — drag, scroll, or use arrow keys to explore.
        </p>
      </div>

      <FocusRail items={VIDEO_WORKS_ITEMS} autoPlay={false} loop={true} />
    </main>
  );
}
