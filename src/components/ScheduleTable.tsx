import { cn } from "@/lib/utils";
import { ProgramItem, ProgramType } from "@/data/gala-schedules";

function programTypeBadgeClass(type: ProgramType): string {
  const map: Record<ProgramType, string> = {
    "歌舞": "bg-cny-gold/20 text-cny-gold",
    "小品": "bg-pink-500/20 text-pink-300",
    "相声": "bg-green-500/20 text-green-300",
    "魔术": "bg-purple-500/20 text-purple-300",
    "杂技": "bg-cyan-500/20 text-cyan-300",
    "武术": "bg-orange-500/20 text-orange-300",
    "戏曲": "bg-rose-500/20 text-rose-300",
    "朗诵": "bg-blue-500/20 text-blue-300",
    "特别节目": "bg-amber-500/20 text-amber-300",
    "零点钟声": "bg-red-500/30 text-red-300 animate-pulse-glow",
  };
  return map[type] || "bg-white/10 text-white/70";
}

export function ScheduleTable({ programs }: { programs: ProgramItem[] }) {
  return (
    <div className="space-y-1">
      {programs.map((program, i) => (
        <div key={i} className="flex gap-4 items-start group">
          {/* Time */}
          <div className="shrink-0 w-14 text-right font-mono text-sm text-cny-gold/80 pt-0.5">
            {program.time}
          </div>
          {/* Dot + line */}
          <div className="relative flex flex-col items-center pt-1">
            <div className="w-3 h-3 rounded-full bg-cny-gold shrink-0 group-hover:scale-125 transition-transform" />
            {i < programs.length - 1 && (
              <div className="w-0.5 flex-1 bg-cny-gold/20 min-h-8" />
            )}
          </div>
          {/* Content */}
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white">{program.name}</span>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full shrink-0",
                  programTypeBadgeClass(program.type)
                )}
              >
                {program.type}
              </span>
            </div>
            <p className="text-sm text-white/50 mt-1">{program.performers}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
