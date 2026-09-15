import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, FileDown, RefreshCw, Search, Trash2, Loader2, Filter, X } from "lucide-react";
import { deleteInventory, downloadInventoryPdf, fetchInventory } from "../services/api";

// Convert Google Sheet rows into inventory objects
function parseRows(rows = []) {
    return rows.slice(1).map((row, index) => ({
        id: row[0] || index + 1,
        date: row[1] || "",
        productId: row[2] || "",
        name: row[3] || "Unknown product",
        category: row[4] || "Uncategorised",
        unit: row[5] || "",
        opening: Number(row[6]) || 0,
        received: Number(row[7]) || 0,
        issued: Number(row[8]) || 0,
        closing: Number(row[9]) || 0,
        remarks: row[10] || "",
        jobSlipNo: row[11] || "",
    }));
}

export default function Inventory() {
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [generatingPdf, setGeneratingPdf] = useState(false);

    // Fetch inventory
    const loadInventory = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const data = await fetchInventory();
            setItems(parseRows(data));
        } catch (err) {
            setError(err.message || "Unable to load inventory.");
        } finally {
            setLoading(false);
        }
    }, []);

    async function handleGeneratePdf() {
        try {
            setGeneratingPdf(true);
            setError("");
            const blob = await downloadInventoryPdf(categoryFilter);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            const catSuffix = categoryFilter && categoryFilter !== "All" ? `-${categoryFilter.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
            link.download = `material-consumption-register${catSuffix}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.message || "Unable to generate register PDF.");
        } finally {
            setGeneratingPdf(false);
        }
    }

    useEffect(() => {
        loadInventory();
    }, [loadInventory]);

    // Unique Categories list
    const categories = useMemo(() => {
        const set = new Set();
        items.forEach((item) => {
            if (item.category && item.category !== "Uncategorised") {
                set.add(item.category);
            }
        });
        return Array.from(set).sort();
    }, [items]);

    // Helper to safely parse dates for range comparison
    const parseDateValue = useCallback((dateStr) => {
        if (!dateStr) return null;
        const str = String(dateStr).trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            return new Date(str + "T00:00:00");
        }
        const match = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (match) {
            const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
            const m = months[match[2].toLowerCase()];
            if (m !== undefined) {
                return new Date(Number(match[3]), m, Number(match[1]));
            }
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    }, []);

    // Search & Filter inventory
    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            // Category filter
            if (categoryFilter !== "All" && item.category !== categoryFilter) {
                return false;
            }

            // Date Range filter
            if (fromDate) {
                const fDate = new Date(fromDate + "T00:00:00");
                const itemD = parseDateValue(item.date);
                if (itemD && itemD < fDate) return false;
            }

            if (toDate) {
                const tDate = new Date(toDate + "T23:59:59");
                const itemD = parseDateValue(item.date);
                if (itemD && itemD > tDate) return false;
            }

            // Search query filter
            const val = query.trim().toLowerCase();
            if (!val) return true;

            return [item.name, item.productId, item.category, item.remarks, item.jobSlipNo]
                .join(" ")
                .toLowerCase()
                .includes(val);
        });
    }, [items, query, categoryFilter, fromDate, toDate, parseDateValue]);

    const hasActiveFilters = Boolean(query || categoryFilter !== "All" || fromDate || toDate);

    function resetFilters() {
        setQuery("");
        setCategoryFilter("All");
        setFromDate("");
        setToDate("");
    }

    // Delete inventory record
    async function handleDelete(id) {
        const confirmed = window.confirm(`Delete inventory record ${id}?`);
        if (!confirmed) return;

        try {
            await deleteInventory(id);
            setItems((current) => current.filter((item) => String(item.id) !== String(id)));
        } catch (err) {
            setError(err.message || "Unable to delete inventory record.");
        }
    }
    return (
        <div className="animate-fade-in space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-indigo-400 mb-1">
                        <Boxes size={20} />
                        <span className="text-xs font-bold uppercase tracking-wider">
                            Stock Ledger & Management
                        </span>
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-100">
                        Inventory
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Monitor live stock movement, balances, and export PAA Form (8) reports.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={loadInventory}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/[0.08] transition-all cursor-pointer disabled:opacity-50"
                        title="Refresh inventory"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>

                    <button
                        onClick={handleGeneratePdf}
                        disabled={generatingPdf}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                        title="Generate Material Consumption Register (Form 8) PDF"
                    >
                        {generatingPdf ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Generating PDF...
                            </>
                        ) : (
                            <>
                                <FileDown size={16} />
                                Generate Register PDF
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            {/* Filter Bar */}
            <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Filter size={18} className="text-indigo-400" />
                        <h3 className="font-bold text-slate-100 text-sm uppercase tracking-wider">
                            Filter Stock Ledger Records
                        </h3>
                    </div>
                    {hasActiveFilters && (
                        <button
                            onClick={resetFilters}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-all cursor-pointer"
                        >
                            <X size={14} />
                            Reset Filters
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Search */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            Search Product
                        </label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by name, ID..."
                                className="w-full bg-white/5 border border-white/[0.06] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500/50"
                            />
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            Category
                        </label>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500/50 cursor-pointer"
                        >
                            <option value="All" className="bg-dark-800 text-slate-100">
                                All Categories
                            </option>
                            {categories.map((cat, idx) => (
                                <option key={idx} value={cat} className="bg-dark-800 text-slate-100">
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* From Date */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            From Date
                        </label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500/50"
                        />
                    </div>

                    {/* To Date */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            To Date
                        </label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500/50"
                        />
                    </div>
                </div>
            </div>

            {/* Stock Ledger Table */}
            <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl w-full overflow-hidden">
                {/* Header info */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-100 text-base">Stock Ledger Records</h3>
                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/[0.06]">
                            {filteredItems.length} records
                        </span>
                    </div>
                </div>

                {/* Table Content */}
                <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 bg-dark-800 z-10">
                            <tr className="text-slate-400 border-b border-white/[0.06]">
                                <th className="px-4 py-3 font-semibold">ID</th>
                                <th className="px-4 py-3 font-semibold">Opening Date</th>
                                <th className="px-4 py-3 font-semibold">Product ID</th>
                                <th className="px-4 py-3 font-semibold">Product Name</th>
                                <th className="px-4 py-3 font-semibold">Category</th>
                                <th className="px-4 py-3 font-semibold">Unit</th>
                                <th className="px-4 py-3 font-semibold">Opening</th>
                                <th className="px-4 py-3 font-semibold">Received</th>
                                <th className="px-4 py-3 font-semibold">Issued</th>
                                <th className="px-4 py-3 font-semibold">Closing</th>
                                <th className="px-4 py-3 font-semibold">Remarks</th>
                                <th className="px-4 py-3 font-semibold text-right">Action</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-white/[0.04]">
                            {loading ? (
                                <tr>
                                    <td colSpan={12} className="px-4 py-12 text-center text-slate-400">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 size={18} className="animate-spin text-indigo-400" />
                                            Loading inventory records...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="px-4 py-12 text-center text-slate-500">
                                        No inventory records found.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={item.id} className="text-slate-200 hover:bg-white/[0.02]">
                                        <td className="px-4 py-3 text-slate-400 text-xs font-mono">{item.id}</td>
                                        <td className="px-4 py-3">{item.date}</td>
                                        <td className="px-4 py-3 font-semibold text-indigo-300">{item.productId}</td>
                                        <td className="px-4 py-3 font-semibold text-slate-100">{item.name}</td>
                                        <td className="px-4 py-3 text-slate-300">{item.category}</td>
                                        <td className="px-4 py-3 text-slate-400">{item.unit}</td>
                                        <td className="px-4 py-3">{item.opening}</td>
                                        <td className="px-4 py-3 text-emerald-400 font-medium">+{item.received}</td>
                                        <td className="px-4 py-3 text-amber-400 font-medium">-{item.issued}</td>
                                        <td className="px-4 py-3 font-bold text-slate-100">{item.closing}</td>
                                        <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">{item.remarks}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer"
                                                title="Delete Record"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}