import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Pencil, RefreshCw, Search, Trash2, Plus, Loader2, Filter, X } from "lucide-react";
import { deleteTransaction, fetchTransactions } from "../services/api";
import { useNavigate } from "react-router-dom";

// Convert Excel serial number to YYYY-MM-DD date string
function formatDate(raw) {
    if (!raw) return "-";
    const str = String(raw).trim();
    // If it's a pure number (Excel serial number), convert it
    if (/^\d+$/.test(str)) {
        const serial = Number(str);
        if (serial > 25000 && serial < 100000) {
            const ms = (serial - 25569) * 86400000;
            const d = new Date(ms);
            return d.toISOString().slice(0, 10);
        }
    }
    return str;
}

// Convert Google Sheet rows into objects using the actual header names.
function parseRows(rows = []) {
    const headers = (rows[0] || []).map((header) =>
        String(header).toLowerCase().replace(/[_\s]+/g, "").trim()
    );
    const column = (...names) => names.map((name) => headers.indexOf(name)).find((index) => index !== -1);
    const value = (row, index, fallback = "") => index === undefined ? fallback : row[index] || fallback;
    const columns = {
        id: column("id", "transactionid"),
        date: column("date", "transactiondate"),
        productId: column("productid", "productcode"),
        name: column("productname", "product"),
        category: column("category"),
        unit: column("unit"),
        type: column("transactiontype", "type"),
        opening: column("openingbalance", "opening", "openingqty"),
        received: column("receivedqty", "received", "receivedquantity"),
        issued: column("issuedqty", "issued", "issuedquantity"),
        quantity: column("quantity", "qty"),
        jobSlipNo: column("jobslipno", "job_slip_no", "jslipno"),
        remarks: column("remarks", "remark"),
    };

    return rows.slice(1).map((row, index) => ({
        id: value(row, columns.id, index + 1),
        date: formatDate(value(row, columns.date)),
        productId: value(row, columns.productId),
        name: value(row, columns.name, "Unknown product"),
        category: value(row, columns.category, "Uncategorised"),
        unit: value(row, columns.unit),
        type: value(row, columns.type),
        opening: Number(value(row, columns.opening, 0)) || 0,
        received: Number(value(row, columns.received, 0)) || 0,
        issued: Number(value(row, columns.issued, 0)) || 0,
        quantity: Number(value(row, columns.quantity, 0)) || 0,
        remarks: value(row, columns.remarks),
        jobSlipNo: value(row, columns.jobSlipNo),
    }));
}

function getTransactionType(transaction) {
    if (transaction.type) {
        const type = String(transaction.type).trim().toLowerCase();
        if (type === "opening") return "Opening";
        if (type === "received") return "Received";
        if (type === "issued") return "Issued";
        return "Other";
    }
    if (transaction.opening > 0) return "Opening";
    if (transaction.received > 0) return "Received";
    if (transaction.issued > 0) return "Issued";
    return "Other";
}

function getTransactionQuantity(transaction) {
    if (transaction.type === "Opening") return transaction.opening || transaction.quantity;
    if (transaction.type === "Received") return transaction.received || transaction.quantity;
    if (transaction.type === "Issued") return transaction.issued || transaction.quantity;
    return transaction.quantity || transaction.opening || transaction.received || transaction.issued;
}

export default function Transaction() {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("All");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Fetch transactions
    const loadTransactions = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const data = await fetchTransactions();
            setTransactions(
                parseRows(data).map((transaction) => ({
                    ...transaction,
                    type: getTransactionType(transaction),
                }))
            );
        } catch (err) {
            setError(err.message || "Unable to load transactions.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTransactions();
    }, [loadTransactions]);

    // Unique Categories
    const categories = useMemo(() => {
        const set = new Set();
        transactions.forEach((item) => {
            if (item.category && item.category !== "Uncategorised") {
                set.add(item.category);
            }
        });
        return Array.from(set).sort();
    }, [transactions]);

    // Helper to safely parse dates for range comparison
    const parseDateValue = useCallback((dateStr) => {
        if (!dateStr || dateStr === "-") return null;
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

    // Search / filter transactions
    const filtered = useMemo(() => {
        return transactions.filter((item) => {
            // Type filter
            if (typeFilter !== "All" && item.type !== typeFilter) {
                return false;
            }

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

            // Search query
            const value = query.trim().toLowerCase();
            if (!value) return true;

            return [item.name, item.productId, item.category, item.remarks, item.type, item.jobSlipNo]
                .join(" ")
                .toLowerCase()
                .includes(value);
        });
    }, [transactions, query, typeFilter, categoryFilter, fromDate, toDate, parseDateValue]);

    const hasActiveFilters = Boolean(query || typeFilter !== "All" || categoryFilter !== "All" || fromDate || toDate);

    function resetFilters() {
        setQuery("");
        setTypeFilter("All");
        setCategoryFilter("All");
        setFromDate("");
        setToDate("");
    }

    // Delete transaction
    async function handleDelete(id) {
        const confirmed = window.confirm(`Delete transaction ${id}?`);
        if (!confirmed) return;

        try {
            await deleteTransaction(id);
            setTransactions((current) =>
                current.filter((item) => String(item.id) !== String(id))
            );
        } catch (err) {
            setError(err.message || "Unable to delete transaction.");
        }
    }

    // Calculate summary values
    const received = transactions.reduce(
        (sum, item) => sum + (item.type === "Received" ? getTransactionQuantity(item) : 0),
        0
    );

    const issued = transactions.reduce(
        (sum, item) => sum + (item.type === "Issued" ? getTransactionQuantity(item) : 0),
        0
    );

    return (
        <div className="animate-fade-in space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-indigo-400 mb-1">
                        <ArrowLeftRight size={20} />
                        <span className="text-xs font-bold uppercase tracking-wider">
                            Activity Audit Trail
                        </span>
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-100">
                        Transactions
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        Review every stock receipt, issue, and opening entry in the system.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={loadTransactions}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/[0.08] transition-all cursor-pointer disabled:opacity-50"
                        title="Refresh transactions"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        Refresh
                    </button>

                    <button
                        onClick={() => navigate("/add-transaction")}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                    >
                        <Plus size={16} />
                        Add New Transaction
                    </button>
                </div>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Total Transactions
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-100">
                        {transactions.length.toLocaleString()}
                    </p>
                </div>

                <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Units Received
                    </p>
                    <p className="mt-2 text-2xl font-bold text-emerald-400">
                        +{received.toLocaleString()}
                    </p>
                </div>

                <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Units Issued
                    </p>
                    <p className="mt-2 text-2xl font-bold text-amber-400">
                        -{issued.toLocaleString()}
                    </p>
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
                            Filter Transactions
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Search */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            Search
                        </label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search transaction..."
                                className="w-full bg-white/5 border border-white/[0.06] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500/50"
                            />
                        </div>
                    </div>

                    {/* Transaction Type Filter */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                            Transaction Type
                        </label>
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-indigo-500/50 cursor-pointer"
                        >
                            <option value="All" className="bg-dark-800 text-slate-100">
                                All Types
                            </option>
                            <option value="Received" className="bg-dark-800 text-emerald-400">
                                Received (Stock In)
                            </option>
                            <option value="Issued" className="bg-dark-800 text-amber-400">
                                Issued (Stock Out)
                            </option>
                            <option value="Opening" className="bg-dark-800 text-slate-300">
                                Opening Balance
                            </option>
                        </select>
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

            {/* Transaction Ledger Table */}
            <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl w-full overflow-hidden">
                {/* Header info */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-100 text-base">Transaction Records</h3>
                        <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/[0.06]">
                            {filtered.length} records
                        </span>
                    </div>
                </div>

                {/* Table Content */}
                <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 bg-dark-800 z-10">
                            <tr className="text-slate-400 border-b border-white/[0.06]">
                                <th className="px-4 py-3 font-semibold">ID</th>
                                <th className="px-4 py-3 font-semibold">Date</th>
                                <th className="px-4 py-3 font-semibold">Product</th>
                                <th className="px-4 py-3 font-semibold">Category</th>
                                <th className="px-4 py-3 font-semibold">Unit</th>
                                <th className="px-4 py-3 font-semibold">Type</th>
                                <th className="px-4 py-3 font-semibold">Quantity</th>
                                <th className="px-4 py-3 font-semibold">Job Slip No.</th>
                                <th className="px-4 py-3 font-semibold">Remarks</th>
                                <th className="px-4 py-3 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-white/[0.04]">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 size={18} className="animate-spin text-indigo-400" />
                                            Loading transactions...
                                        </div>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-12 text-center text-slate-500">
                                        No transactions found.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((item) => (
                                    <tr key={item.id} className="text-slate-200 hover:bg-white/[0.02]">
                                        <td className="px-4 py-3 text-slate-400 text-xs font-mono">#{item.id}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{item.date || "-"}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-slate-100">{item.name}</div>
                                            <div className="text-xs text-indigo-300 font-mono">#{item.productId}</div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">{item.category}</td>
                                        <td className="px-4 py-3 text-slate-400">{item.unit}</td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.type === "Received"
                                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                    : item.type === "Issued"
                                                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                        : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                                    }`}
                                            >
                                                {item.type}
                                            </span>
                                        </td>
                                        <td
                                            className={`px-4 py-3 font-semibold ${item.type === "Received"
                                                ? "text-emerald-400"
                                                : item.type === "Issued"
                                                    ? "text-amber-400"
                                                    : "text-slate-100"
                                                }`}
                                        >
                                            {item.type === "Received" ? "+" : item.type === "Issued" ? "-" : ""}
                                            {getTransactionQuantity(item).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-indigo-300 whitespace-nowrap">
                                            {item.jobSlipNo || "-"}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">
                                            {item.remarks || "-"}
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <button
                                                onClick={() =>
                                                    navigate(`/edit-transaction/${item.id}`, {
                                                        state: { transaction: item },
                                                    })
                                                }
                                                className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-100 transition-colors cursor-pointer mr-1"
                                                title={`Edit transaction ${item.id}`}
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer"
                                                title={`Delete transaction ${item.id}`}
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