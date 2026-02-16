import { GalaInfo } from "@/data/gala-schedules";

export function GalaCard({ gala }: { gala: GalaInfo }) {
  return (
    <div className="rounded-2xl border border-cny-gold/20 bg-cny-red-dark/80 backdrop-blur-sm p-6 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(251,191,36,0.15)] transition-all duration-300">
      <div className="text-4xl mb-3">{gala.emoji}</div>
      <h3 className="text-xl font-bold text-cny-gold">{gala.name}</h3>
      <p className="text-sm text-cny-gold/60 mt-1">{gala.fullName}</p>
      <p className="text-sm text-cny-cream/70 mt-2">{gala.channel}</p>
      <div className="mt-3 flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: gala.color }}
        />
        <span className="text-xs text-cny-cream/50">
          {gala.programs.length} 个节目 · {gala.programs[0].time} - {gala.programs[gala.programs.length - 1].time}
        </span>
      </div>
    </div>
  );
}
