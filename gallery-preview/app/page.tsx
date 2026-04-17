'use client';

import InfiniteGallery from "@/components/ui/3d-gallery-photography";

const images = [
  { src: "/images/couples/sa1.jpg",  alt: "Sameeksha & Aman" },
  { src: "/images/couples/sa5.jpg",  alt: "Sameeksha & Aman" },
  { src: "/images/couples/sa10.jpg", alt: "Sameeksha & Aman" },
  { src: "/images/couples/sa15.jpg", alt: "Sameeksha & Aman" },
  { src: "/images/couples/ks1.jpg",  alt: "Karthik & Sowmya" },
  { src: "/images/couples/ks2.jpg",  alt: "Karthik & Sowmya" },
  { src: "/images/couples/aa1.jpg",  alt: "Anusha & Akshay" },
  { src: "/images/couples/aa2.jpg",  alt: "Anusha & Akshay" },
  { src: "/images/couples/yo1.jpg",  alt: "Yogesh & Supritha" },
  { src: "/images/couples/yo3.jpg",  alt: "Yogesh & Supritha" },
  { src: "/images/couples/sp1.jpg",  alt: "Suprith & Pragnya" },
  { src: "/images/couples/sp3.jpg",  alt: "Suprith & Pragnya" },
  { src: "/images/couples/sr1.jpg",  alt: "Sripad & Ritika" },
  { src: "/images/couples/sr2.jpg",  alt: "Sripad & Ritika" },
];

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-black">
      <InfiniteGallery
        images={images}
        speed={1.2}
        visibleCount={10}
        className="h-screen w-full"
      />
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center text-center px-3 mix-blend-exclusion text-white">
        <h1 className="font-serif text-4xl md:text-7xl tracking-tight">
          <span className="italic">Aakaara</span> Studios
        </h1>
      </div>
      <div className="fixed bottom-8 left-0 right-0 text-center font-mono uppercase text-[11px] text-white/50">
        <p>Wheel · Arrow keys · Touch</p>
      </div>
    </main>
  );
}
