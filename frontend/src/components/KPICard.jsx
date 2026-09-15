export default function KPICard({ icon: Icon, label, value, trend, trendDir, colorClass }) {
    const iconColors = {
        indigo: "bg-indigo-500/12 text-indigo-400",
        cyan: "bg-cyan-400/12 text-cyan-400",
        emerald: "bg-emerald-500/12 text-emerald-500",
        amber: "bg-amber-500/12 text-amber-500",
        rose: "bg-rose-500/12 text-rose-500",
    };

    return (
        <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl p-6 relative overflow-hidden transition-all hover:border-white/10 hover:-translate-y-0.5 hover:shadow-lg animate-fade-in">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${iconColors[colorClass] || iconColors.indigo}`}>
                <Icon size={22} />
            </div>
            <div className="text-sm text-slate-400 font-medium mb-1">{label}</div>
            <div className="text-2xl font-bold text-slate-100">{value}</div>
            {trend && (
                <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trendDir === "up" ? "text-emerald-500" : "text-rose-500"}`}>
                    {trendDir === "up" ? "↑" : "↓"} {trend}
                </div>
            )}
        </div>
    );
}
