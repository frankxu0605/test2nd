"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { galas } from "@/data/gala-schedules";
import { ScheduleTable } from "./ScheduleTable";

export function GalaSchedule() {
  const [activeGalaId, setActiveGalaId] = useState(galas[0].id);
  const activeGala = galas.find((g) => g.id === activeGalaId)!;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
        {galas.map((gala) => (
          <button
            key={gala.id}
            onClick={() => setActiveGalaId(gala.id)}
            className={cn(
              "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer",
              activeGalaId === gala.id
                ? "bg-cny-gold text-cny-red-dark shadow-lg"
                : "bg-white/10 text-cny-gold/70 hover:bg-white/20"
            )}
          >
            {gala.emoji} {gala.name}
          </button>
        ))}
      </div>

      {/* Gala info */}
      <div className="mb-6 mt-2">
        <h3 className="text-lg font-bold text-cny-gold">{activeGala.fullName}</h3>
        <p className="text-sm text-cny-cream/50">{activeGala.channel}</p>
      </div>

      {/* Schedule */}
      <ScheduleTable programs={activeGala.programs} />
    </div>
  );
}
