"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeroProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  subtitle: string;
  images: { src: string; alt: string }[];
}

export const HeroSection = React.forwardRef<HTMLDivElement, HeroProps>(
  ({ title, subtitle, images, className, ...props }, ref) => {
    const [currentIndex, setCurrentIndex] = React.useState(
      Math.floor(images.length / 2)
    );

    const handleNext = React.useCallback(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, [images.length]);

    const handlePrev = React.useCallback(() => {
      setCurrentIndex(
        (prevIndex) => (prevIndex - 1 + images.length) % images.length
      );
    }, [images.length]);

    React.useEffect(() => {
      const timer = window.setInterval(() => {
        handleNext();
      }, 4000);

      return () => window.clearInterval(timer);
    }, [handleNext]);

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden bg-background px-4 py-16 text-foreground",
          className
        )}
        {...props}
      >
        <div className="absolute inset-0 z-0 opacity-30" aria-hidden="true">
          <div className="absolute left-[-18%] top-[-10%] size-[32rem] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(128,90,213,0.28),rgba(255,255,255,0))]" />
          <div className="absolute bottom-0 right-[-18%] size-[32rem] rounded-full bg-[radial-gradient(circle_farthest-side,rgba(0,123,255,0.24),rgba(255,255,255,0))]" />
        </div>

        <div className="z-10 flex w-full max-w-6xl flex-col items-center gap-8 text-center md:gap-12">
          <div className="space-y-4">
            <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
              {title}
            </h1>
            <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-xl">
              {subtitle}
            </p>
          </div>

          <div className="relative flex h-[350px] w-full items-center justify-center md:h-[450px]">
            <div className="relative flex h-full w-full items-center justify-center [perspective:1000px]">
              {images.map((image, index) => {
                const offset = index - currentIndex;
                const total = images.length;
                let pos = (offset + total) % total;

                if (pos > Math.floor(total / 2)) {
                  pos -= total;
                }

                const isCenter = pos === 0;
                const isAdjacent = Math.abs(pos) === 1;

                return (
                  <div
                    key={`${image.src}-${index}`}
                    className={cn(
                      "absolute flex h-96 w-48 items-center justify-center transition-all duration-500 ease-in-out md:h-[450px] md:w-64"
                    )}
                    style={{
                      transform: `
                        translateX(${pos * 45}%)
                        scale(${isCenter ? 1 : isAdjacent ? 0.85 : 0.7})
                        rotateY(${pos * -10}deg)
                      `,
                      zIndex: isCenter ? 10 : isAdjacent ? 5 : 1,
                      opacity: isCenter ? 1 : isAdjacent ? 0.4 : 0,
                      filter: isCenter ? "blur(0px)" : "blur(4px)",
                      visibility: Math.abs(pos) > 1 ? "hidden" : "visible",
                    }}
                  >
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="h-full w-full rounded-3xl border-2 border-foreground/10 object-cover shadow-2xl"
                    />
                  </div>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="icon"
              className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-background/50 backdrop-blur-sm sm:left-8"
              onClick={handlePrev}
              aria-label="Previous slide"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-background/50 backdrop-blur-sm sm:right-8"
              onClick={handleNext}
              aria-label="Next slide"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

HeroSection.displayName = "HeroSection";
