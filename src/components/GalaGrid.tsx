import { galas } from "@/data/gala-schedules";
import { GalaCard } from "./GalaCard";

export function GalaGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {galas.map((gala) => (
        <GalaCard key={gala.id} gala={gala} />
      ))}
    </div>
  );
}
