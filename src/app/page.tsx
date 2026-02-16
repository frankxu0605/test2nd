import { HeroSection } from "@/components/HeroSection";
import { GalaGrid } from "@/components/GalaGrid";
import { GalaSchedule } from "@/components/GalaSchedule";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main className="relative z-10">
      <HeroSection />

      {/* 各地春节晚会 */}
      <section id="galas" className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-cny-gold mb-10">
          🏮 各地春节晚会 🏮
        </h2>
        <GalaGrid />
      </section>

      {/* 春晚节目时刻表 */}
      <section id="schedule" className="max-w-4xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-cny-gold mb-10">
          📋 春晚节目时刻表
        </h2>
        <GalaSchedule />
      </section>

      <Footer />
    </main>
  );
}
