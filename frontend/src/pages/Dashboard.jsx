import { useMemo } from "react";
import {
    Package,
    AlertTriangle,
    CheckCircle,
} from "lucide-react";
import {
    Tooltip,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from "recharts";
import KPICard from "../components/KPICard";

const CHART_COLORS = [
    "#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#f43f5e",
    "#3b82f6", "#a855f7", "#ec4899", "#14b8a6", "#f97316",
];

export default function Dashboard({ products }) {
    const totalItems = products.length;
    const totalUnits = products.reduce((s, p) => s + p.quantity, 0);
    const lowStockCount = products.filter(
        (p) => p.status === "Low Stock" || p.status === "Out of Stock"
    ).length;
    const inStockCount = products.filter((p) => p.status === "In Stock").length;
    // Derive categories from products data
    const categoryData = useMemo(() => {
        const catMap = {};
        products.forEach((p) => {
            if (!catMap[p.category]) {
                catMap[p.category] = 0;
            }
            catMap[p.category] += p.quantity;
        });
        return Object.entries(catMap).map(([name, quantity], i) => ({
            name,
            quantity,
            color: CHART_COLORS[i % CHART_COLORS.length],
        }));
    }, [products]);

    return (
        <div className="relative z-[1] animate-fade-in">
            <div className="mb-8">
                <h2 className="text-3xl font-bold tracking-tight text-slate-100">
                    Store Dashboard
                </h2>
                <p className="text-slate-400 mt-1 text-sm">
                    Airport maintenance inventory overview
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 mb-8">
                <KPICard
                    icon={Package}
                    label="Total Items"
                    value={totalItems}
                    trend={`${totalUnits} total units`}
                    trendDir="up"
                    colorClass="indigo"
                />
                <KPICard
                    icon={AlertTriangle}
                    label="Low / Out of Stock"
                    value={lowStockCount}
                    trend={lowStockCount > 3 ? "Action needed" : "Under control"}
                    trendDir={lowStockCount > 3 ? "down" : "up"}
                    colorClass="amber"
                />
                <KPICard
                    icon={CheckCircle}
                    label="In Stock Items"
                    value={inStockCount}
                    trend={totalItems > 0 ? `${Math.round((inStockCount / totalItems) * 100)}% healthy` : "No data"}
                    trendDir="up"
                    colorClass="emerald"
                />
            </div>

            {categoryData.length > 0 && (
                <div className="mb-8">
                    <div className="bg-dark-800/80 border border-slate-200 rounded-2xl p-6 animate-fade-in">
                        <h3 className="text-base font-semibold mb-5 text-slate-100">
                            Stock Quantity by Category
                        </h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={categoryData} barSize={36}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#e2e8f0"
                                />
                                <XAxis
                                    dataKey="name"
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#64748b"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: "#ffffff",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: 10,
                                        fontSize: "0.8125rem",
                                    }}
                                    cursor={{ fill: "#f8fafc" }}
                                />
                                <Bar dataKey="quantity" radius={[6, 6, 0, 0]}>
                                    {categoryData.map((entry, index) => (
                                        <Cell key={index} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Recent Products List */}
            {products.length > 0 && (
                <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl p-6 animate-fade-in">
                    <h3 className="text-base font-semibold mb-5 text-slate-100">
                        Recent Products
                    </h3>
                    <div className="flex flex-col gap-0.5">
                        {products.slice(-5).reverse().map((p) => (
                            <div
                                className="flex items-center gap-3 px-3 py-3 rounded-lg transition-colors hover:bg-white/[0.02]"
                                key={p.id}
                            >
                                <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${p.status === "In Stock"
                                        ? "bg-emerald-500"
                                        : p.status === "Low Stock"
                                            ? "bg-amber-500"
                                            : "bg-rose-500"
                                        }`}
                                ></span>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-100">
                                        {p.name}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                        {p.category} — Qty: {p.quantity}
                                    </div>
                                </div>
                                <span className="text-xs text-slate-500 shrink-0">
                                    {p.lastUpdated}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
