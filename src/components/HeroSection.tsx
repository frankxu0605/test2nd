import { Lantern } from "./Lantern";
import { Fireworks } from "./Fireworks";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4">
      {/* Fireworks */}
      <Fireworks />

      {/* Lanterns - left */}
      <div className="absolute top-0 left-4 sm:left-12 hidden sm:flex flex-col gap-8">
        <Lantern size="lg" delay={0} />
        <Lantern size="md" delay={0.5} />
      </div>

      {/* Lanterns - right */}
      <div className="absolute top-0 right-4 sm:right-12 hidden sm:flex flex-col gap-8">
        <Lantern size="md" delay={0.3} />
        <Lantern size="lg" delay={0.8} />
      </div>

      {/* Horse emoji floating */}
      <div className="animate-float text-6xl sm:text-8xl mb-6">
        🐴
      </div>

      {/* Main greeting */}
      <h1 className="animate-shimmer text-5xl sm:text-6xl lg:text-8xl font-bold tracking-wider text-center">
        恭贺新禧
      </h1>

      {/* Sub greeting */}
      <p className="text-xl sm:text-2xl lg:text-3xl text-cny-gold/80 mt-4 text-center">
        甲午马年 · 万事如意
      </p>

      {/* Blessing strip */}
      <div className="mt-8 flex flex-wrap justify-center gap-3 sm:gap-6 text-cny-cream/70 text-sm sm:text-base">
        {["马到成功", "龙马精神", "万马奔腾", "一马当先", "策马奔腾"].map((text) => (
          <span
            key={text}
            className="px-3 py-1 rounded-full border border-cny-gold/20 bg-cny-gold/5"
          >
            {text}
          </span>
        ))}
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 text-cny-gold/40 text-sm animate-bounce">
        ↓ 向下浏览春晚节目
      </div>
    </section>
  );
}
