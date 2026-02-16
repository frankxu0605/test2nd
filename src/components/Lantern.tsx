export function Lantern({ size = "md", delay = 0 }: { size?: "sm" | "md" | "lg"; delay?: number }) {
  const sizeMap = {
    sm: { width: "w-8", height: "h-10", text: "text-xs" },
    md: { width: "w-12", height: "h-16", text: "text-sm" },
    lg: { width: "w-16", height: "h-20", text: "text-base" },
  };
  const s = sizeMap[size];

  return (
    <div className="animate-swing flex flex-col items-center" style={{ animationDelay: `${delay}s` }}>
      {/* String */}
      <div className="w-0.5 h-6 bg-cny-gold-dark" />
      {/* Top cap */}
      <div className={`${s.width} h-2 bg-cny-gold rounded-t-sm`} />
      {/* Body */}
      <div
        className={`${s.width} ${s.height} rounded-full bg-gradient-to-b from-red-500 to-red-700 border border-cny-gold/50 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.4)]`}
      >
        <span className={`${s.text} text-cny-gold font-bold`}>福</span>
      </div>
      {/* Bottom cap */}
      <div className={`${s.width} h-2 bg-cny-gold rounded-b-sm`} />
      {/* Tassel */}
      <div className="flex gap-0.5">
        <div className="w-0.5 h-4 bg-cny-gold-dark rounded-b" />
        <div className="w-0.5 h-5 bg-cny-gold rounded-b" />
        <div className="w-0.5 h-4 bg-cny-gold-dark rounded-b" />
      </div>
    </div>
  );
}
