import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowLeftRight, Save, Loader2, Check, PackageCheck, AlertCircle, Plus, Trash2, Search } from "lucide-react";

/* ── Searchable Product Dropdown ─────────────────────────────────────── */
function ProductSearchSelect({ products, value, onChange, disabled, placeholder }) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const inputRef = useRef(null);

    const selected = products.find(p => p.id === value);

    useEffect(() => {
        function onOut(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
                setQuery("");
            }
        }
        document.addEventListener("mousedown", onOut);
        return () => document.removeEventListener("mousedown", onOut);
    }, []);

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    const filtered = query.trim()
        ? products.filter(p =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            String(p.id).toLowerCase().includes(query.toLowerCase())
        )
        : products;

    function handleSelect(p) {
        onChange(p.id);
        setOpen(false);
        setQuery("");
    }

    return (
        <div ref={wrapRef} className="relative">
            {/* Trigger */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => { if (!disabled) setOpen(o => !o); }}
                className={`w-full bg-white border rounded-xl px-3 py-2.5 text-sm text-left flex items-center justify-between gap-2 transition-colors outline-none shadow-sm
                    ${open ? "border-indigo-400 ring-2 ring-indigo-100" : "border-gray-200 hover:border-gray-300"}
                    ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "cursor-pointer"}`}
            >
                <span className={`truncate ${selected ? "text-gray-800 font-medium" : "text-gray-400"}`}>
                    {selected
                        ? `${selected.name} (${selected.unit})`
                        : (disabled ? "Select category first" : placeholder || "— Select Product —")}
                </span>
                <Search size={14} className={`shrink-0 ${open ? "text-indigo-500" : "text-gray-400"}`} />
            </button>

            {/* Dropdown */}
            {open && (
                <div
                    className="absolute z-50 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
                    style={{ minWidth: "280px", left: 0 }}
                >
                    {/* Search input */}
                    <div className="p-2 border-b border-gray-100">
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                            <Search size={13} className="text-indigo-500 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search by name or ID…"
                                className="flex-1 bg-transparent text-gray-800 text-sm outline-none placeholder-gray-400 min-w-0"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                                    className="text-gray-400 hover:text-gray-600 text-xs leading-none cursor-pointer"
                                >✕</button>
                            )}
                        </div>
                        {products.length > 0 && (
                            <p className="mt-1 text-[10px] text-gray-400 px-1">
                                {filtered.length} of {products.length} product{products.length !== 1 ? "s" : ""}
                            </p>
                        )}
                    </div>

                    {/* List */}
                    <ul className="max-h-56 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <li className="px-4 py-4 text-xs text-gray-400 italic text-center">
                                No products match &quot;{query}&quot;
                            </li>
                        ) : filtered.map(p => (
                            <li
                                key={p.id}
                                onClick={() => handleSelect(p)}
                                className={`mx-1 mb-0.5 px-3 py-2 rounded-lg text-sm cursor-pointer flex items-center gap-2.5 transition-all
                                    ${p.id === value
                                        ? "bg-indigo-50 border border-indigo-200"
                                        : "hover:bg-gray-50 border border-transparent"
                                    }`}
                            >
                                <span className="shrink-0 text-[10px] font-bold text-gray-400 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 min-w-[2.2rem] text-center">
                                    {p.id}
                                </span>
                                <span className={`flex-1 font-medium truncate ${p.id === value ? "text-indigo-700" : "text-gray-700"}`}>
                                    {p.name}
                                </span>
                                <span className="shrink-0 text-[10px] text-gray-400 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                                    {p.unit}
                                </span>
                                {p.id === value && (
                                    <span className="shrink-0 text-indigo-500 text-[11px] font-bold">✓</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

import { useLocation, useNavigate, useParams } from "react-router-dom";
import { addTransaction, fetchCategories, fetchInventory, fetchProducts, fetchTransaction, updateTransaction } from "../services/api";

// Convert Excel serial number to YYYY-MM-DD if needed
function formatDateForInput(raw) {
    if (!raw) return new Date().toISOString().slice(0, 10);
    const str = String(raw).trim();
    if (/^\d+$/.test(str)) {
        const serial = Number(str);
        if (serial > 25000 && serial < 100000) {
            const ms = (serial - 25569) * 86400000;
            return new Date(ms).toISOString().slice(0, 10);
        }
    }
    return str;
}

// A blank product row
const blankRow = () => ({ category: "", product_id: "", product_name: "", unit: "", quantity: "" });

export default function AddTransaction() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const editingTransaction = location.state?.transaction;

    // ── Shared / header fields ──────────────────────────────────────────────
    const [shared, setShared] = useState(() => {
        if (editingTransaction) {
            return {
                date: formatDateForInput(editingTransaction.date),
                type: editingTransaction.type || "Received",
                job_slip_no: editingTransaction.jobSlipNo || "",
                remarks: editingTransaction.remarks || "",
            };
        }
        return {
            date: new Date().toISOString().slice(0, 10),
            type: "Received",
            job_slip_no: "",
            remarks: "",
        };
    });

    // ── Product rows (only used when NOT editing) ───────────────────────────
    const [rows, setRows] = useState([blankRow()]);

    // ── Edit-mode single-product fields ────────────────────────────────────
    const [editProduct, setEditProduct] = useState(() =>
        editingTransaction
            ? {
                category: editingTransaction.category || "",
                product_id: editingTransaction.productId || "",
                product_name: editingTransaction.name || "",
                unit: editingTransaction.unit || "",
                quantity:
                    editingTransaction.quantity ||
                    editingTransaction.received ||
                    editingTransaction.issued ||
                    editingTransaction.opening ||
                    "",
            }
            : blankRow()
    );

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [inventoryMap, setInventoryMap] = useState({});
    const [status, setStatus] = useState({ loading: false, error: "", success: "" });

    // ── Load reference data ─────────────────────────────────────────────────
    useEffect(() => {
        Promise.all([
            fetchProducts().catch(() => []),
            fetchInventory().catch(() => []),
            fetchCategories().catch(() => []),
        ]).then(([prodRows, invRows, catRes]) => {
            let parsedProducts = [];
            if (prodRows && prodRows.length > 1) {
                const [, ...rows] = prodRows;
                parsedProducts = rows.map((row) => ({
                    id: row[0] || "",
                    category: row[1] || "",
                    name: row[2] || "",
                    unit: row[3] || "",
                }));
                setProducts(parsedProducts);
            }
            const catSet = new Set();
            parsedProducts.forEach((p) => { if (p.category) catSet.add(p.category); });
            if (Array.isArray(catRes)) {
                catRes.forEach((c) => {
                    const name = typeof c === "string" ? c : c.name || c.category;
                    if (name) catSet.add(name);
                });
            }
            setCategories(Array.from(catSet).sort());

            const stockMap = {};
            if (invRows && invRows.length > 1) {
                const [, ...invData] = invRows;
                invData.forEach((row) => {
                    const pid = String(row[2] || "").trim();
                    const closing = Number(row[9]) || 0;
                    if (pid) stockMap[pid] = closing;
                });
            }
            setInventoryMap(stockMap);
        }).catch(() =>
            setStatus({ loading: false, error: "Unable to load required product data.", success: "" })
        );
    }, []);

    // ── Load existing transaction when editing via URL id ──────────────────
    useEffect(() => {
        if (!id || editingTransaction) return;
        fetchTransaction(id).then((row) => {
            setShared({
                date: formatDateForInput(row[1]),
                job_slip_no: row[2] || "",
                type: row[7] || "Received",
                remarks: row[9] || "",
            });
            setEditProduct({
                category: row[5] || "",
                product_id: row[3] || "",
                product_name: row[4] || "",
                unit: row[6] || "",
                quantity: row[8] || "",
            });
        }).catch((err) =>
            setStatus({ loading: false, error: err.message || "Unable to load transaction.", success: "" })
        );
    }, [id, editingTransaction]);

    // ── Shared field handler ────────────────────────────────────────────────
    function updateShared(e) {
        const { name, value } = e.target;
        setShared((s) => ({ ...s, [name]: value }));
    }

    // ── Row helpers ─────────────────────────────────────────────────────────
    function addRow() {
        setRows((r) => [...r, blankRow()]);
    }

    function removeRow(idx) {
        setRows((r) => r.filter((_, i) => i !== idx));
    }

    function updateRow(idx, field, value) {
        setRows((r) => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));
    }

    function selectRowCategory(idx, cat) {
        setRows((r) => r.map((row, i) => {
            if (i !== idx) return row;
            const existingProd = products.find((p) => p.id === row.product_id);
            const keep = existingProd && existingProd.category === cat;
            return { ...row, category: cat, product_id: keep ? row.product_id : "", product_name: keep ? row.product_name : "", unit: keep ? row.unit : "" };
        }));
    }

    function selectRowProduct(idx, productId) {
        const product = products.find((p) => p.id === productId);
        setRows((r) => r.map((row, i) =>
            i !== idx ? row : {
                ...row,
                product_id: product?.id || "",
                product_name: product?.name || "",
                category: product?.category || row.category,
                unit: product?.unit || "",
            }
        ));
    }

    // ── Edit-mode product field handlers ────────────────────────────────────
    function selectEditCategory(e) {
        const cat = e.target.value;
        setEditProduct((p) => {
            const existing = products.find((pr) => pr.id === p.product_id);
            const keep = existing && existing.category === cat;
            return { ...p, category: cat, product_id: keep ? p.product_id : "", product_name: keep ? p.product_name : "", unit: keep ? p.unit : "" };
        });
    }

    // ── Submit ──────────────────────────────────────────────────────────────
    async function handleSubmit(e) {
        e.preventDefault();

        // ── EDIT MODE (single transaction update) ──
        if (id) {
            const qty = Number(editProduct.quantity);
            if (!editProduct.category) return setStatus({ loading: false, error: "Please select a Category.", success: "" });
            if (!editProduct.product_id) return setStatus({ loading: false, error: "Please select a Product.", success: "" });
            if (isNaN(qty) || qty <= 0) return setStatus({ loading: false, error: "Please enter a valid quantity > 0.", success: "" });

            if (shared.type === "Issued") {
                const stock = inventoryMap[String(editProduct.product_id).trim()] ?? 0;
                if (stock <= 0) return setStatus({ loading: false, error: `No stock available for "${editProduct.product_name}".`, success: "" });
                if (qty > stock) return setStatus({ loading: false, error: `Quantity (${qty}) exceeds available stock (${stock} ${editProduct.unit}).`, success: "" });
            }

            try {
                setStatus({ loading: true, error: "", success: "" });
                await updateTransaction(id, {
                    date: shared.date, product_id: editProduct.product_id, product_name: editProduct.product_name,
                    category: editProduct.category, unit: editProduct.unit, transaction_type: shared.type,
                    quantity: qty, remarks: shared.remarks, job_slip_no: shared.job_slip_no,
                });
                setStatus({ loading: false, error: "", success: "Transaction updated successfully!" });
                setTimeout(() => navigate("/transactions"), 1000);
            } catch (err) {
                setStatus({ loading: false, error: err.message || "Unable to update transaction.", success: "" });
            }
            return;
        }

        // ── ADD MODE (one API call per product row) ──
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 1;
            if (!row.category) return setStatus({ loading: false, error: `Row ${rowNum}: Please select a Category.`, success: "" });
            if (!row.product_id) return setStatus({ loading: false, error: `Row ${rowNum}: Please select a Product.`, success: "" });
            const qty = Number(row.quantity);
            if (isNaN(qty) || qty <= 0) return setStatus({ loading: false, error: `Row ${rowNum}: Enter a valid quantity > 0.`, success: "" });

            if (shared.type === "Issued") {
                const stock = inventoryMap[String(row.product_id).trim()] ?? 0;
                if (stock <= 0) return setStatus({ loading: false, error: `Row ${rowNum} — "${row.product_name}": No stock available.`, success: "" });
                if (qty > stock) return setStatus({ loading: false, error: `Row ${rowNum} — "${row.product_name}": Quantity (${qty}) exceeds stock (${stock} ${row.unit}).`, success: "" });
            }
        }

        try {
            setStatus({ loading: true, error: "", success: "" });
            for (const row of rows) {
                await addTransaction({
                    date: shared.date,
                    product_id: row.product_id,
                    product_name: row.product_name,
                    category: row.category,
                    unit: row.unit,
                    transaction_type: shared.type,
                    quantity: Number(row.quantity),
                    remarks: shared.remarks,
                    job_slip_no: shared.job_slip_no,
                });
            }
            setStatus({ loading: false, error: "", success: `${rows.length} transaction(s) saved successfully!` });
            setTimeout(() => navigate("/transactions"), 1200);
        } catch (err) {
            setStatus({ loading: false, error: err.message || "Unable to save transactions.", success: "" });
        }
    }

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <div className="animate-fade-in max-w-4xl">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => navigate("/transactions")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 text-slate-300 border border-white/[0.06] hover:bg-white/[0.08] hover:text-slate-100 transition-all mb-4 cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    Back to Transactions
                </button>
                <div className="flex items-center gap-3 text-indigo-400 mb-1">
                    <ArrowLeftRight size={22} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                        {id ? "Edit Transaction" : "New Inventory Activity"}
                    </span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-100">
                    {id ? "Edit Transaction Record" : "Add New Transaction"}
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                    {id ? "Update the transaction details below." : "Fill the common fields once, then add one or more products."}
                </p>
            </div>

            {/* Alerts */}
            {status.error && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm font-medium flex items-center gap-2">
                    <AlertCircle size={18} className="shrink-0" /><span>{status.error}</span>
                </div>
            )}
            {status.success && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium flex items-center gap-2">
                    <Check size={18} className="shrink-0" /><span>{status.success}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* ── SHARED FIELDS (Date, Type, Job Slip, Remarks) ── */}
                <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl p-6 sm:p-8">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">
                        Common Details{!id && <span className="text-slate-500 font-normal normal-case tracking-normal ml-2">— applies to all products below</span>}
                    </h3>
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Date */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Date <span className="text-rose-400">*</span></label>
                            <input required type="date" name="date" value={shared.date} onChange={updateShared}
                                className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-indigo-500/50" />
                        </div>

                        {/* Transaction Type */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Transaction Type <span className="text-rose-400">*</span></label>
                            <select name="type" value={shared.type} onChange={updateShared}
                                className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-indigo-500/50 cursor-pointer">
                                <option value="Received" className="bg-dark-800 text-emerald-400 font-semibold">Received (Stock In)</option>
                                <option value="Issued" className="bg-dark-800 text-amber-400 font-semibold">Issued (Stock Out)</option>
                                <option value="Opening" className="bg-dark-800 text-slate-300">Opening Balance</option>
                            </select>
                        </div>

                        {/* Job Slip No */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Job Slip No. <span className="text-xs text-slate-500">(Optional)</span>
                            </label>
                            <input type="text" name="job_slip_no" value={shared.job_slip_no} onChange={updateShared}
                                placeholder="e.g. 02, 04, 18"
                                className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-indigo-500/50" />
                        </div>

                        {/* Remarks */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Remarks <span className="text-xs text-slate-500">(Optional)</span>
                            </label>
                            <input type="text" name="remarks" value={shared.remarks} onChange={updateShared}
                                placeholder="e.g. Material Received vide MB# 1875 Page 43"
                                className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-indigo-500/50" />
                        </div>
                    </div>
                </div>

                {/* ── EDIT MODE: single product ── */}
                {id && (
                    <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl p-6 sm:p-8">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Product Details</h3>
                        <div className="grid gap-6 md:grid-cols-2">
                            {/* Category */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Category <span className="text-rose-400">*</span></label>
                                <select value={editProduct.category} onChange={selectEditCategory}
                                    className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-indigo-500/50 cursor-pointer">
                                    <option value="" className="bg-dark-800 text-slate-400">-- Select Category --</option>
                                    {categories.map((cat, i) => <option key={i} value={cat} className="bg-dark-800 text-slate-100">{cat}</option>)}
                                </select>
                            </div>

                            {/* Product — searchable */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Product <span className="text-rose-400">*</span></label>
                                <ProductSearchSelect
                                    products={products.filter(p => p.category.toLowerCase() === editProduct.category.toLowerCase())}
                                    value={editProduct.product_id}
                                    onChange={(pid) => {
                                        const product = products.find(pr => pr.id === pid);
                                        setEditProduct(p => ({ ...p, product_id: product?.id || "", product_name: product?.name || "", category: product?.category || p.category, unit: product?.unit || "" }));
                                    }}
                                    disabled={!editProduct.category}
                                />
                                {editProduct.product_id && (() => {
                                    const stock = inventoryMap[String(editProduct.product_id).trim()] ?? 0;
                                    return (
                                        <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
                                            <PackageCheck size={14} className={stock > 0 ? "text-emerald-400" : "text-rose-400"} />
                                            <span className="text-slate-400">Available Stock:</span>
                                            <span className={stock > 0 ? "text-emerald-400" : "text-rose-400"}>{stock} {editProduct.unit}</span>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Quantity */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Quantity <span className="text-rose-400">*</span></label>
                                <input min="0" step="any" type="number" placeholder="Enter quantity"
                                    value={editProduct.quantity}
                                    onChange={(e) => setEditProduct((p) => ({ ...p, quantity: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-indigo-500/50" />
                                {shared.type === "Issued" && editProduct.product_id && (
                                    <p className="mt-1 text-xs text-amber-400/90 font-medium">
                                        Max: {inventoryMap[String(editProduct.product_id).trim()] ?? 0} {editProduct.unit}
                                    </p>
                                )}
                            </div>

                            {/* Unit (read-only) */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-2">Unit</label>
                                <input readOnly value={editProduct.unit || "Auto-filled when product selected"}
                                    className="w-full bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 text-slate-400 text-sm outline-none cursor-not-allowed" />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── ADD MODE: dynamic product rows ── */}
                {!id && (
                    <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl p-6 sm:p-8 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                                Products
                                <span className="ml-2 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/20">
                                    {rows.length}
                                </span>
                            </h3>
                            <button type="button" onClick={addRow}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer">
                                <Plus size={15} /> Add Product
                            </button>
                        </div>

                        <div className="space-y-4">
                            {rows.map((row, idx) => {
                                const filteredProds = row.category
                                    ? products.filter((p) => p.category.toLowerCase() === row.category.toLowerCase())
                                    : products;
                                const stock = row.product_id ? (inventoryMap[String(row.product_id).trim()] ?? 0) : null;

                                return (
                                    <div key={idx} className="border border-white/[0.06] rounded-xl p-4 relative">
                                        {/* Row number badge */}
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                Product #{idx + 1}
                                            </span>
                                            {rows.length > 1 && (
                                                <button type="button" onClick={() => removeRow(idx)}
                                                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                                    title="Remove this product row">
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                            {/* Category */}
                                            <div className="lg:col-span-1">
                                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Category <span className="text-rose-400">*</span></label>
                                                <select value={row.category} onChange={(e) => selectRowCategory(idx, e.target.value)}
                                                    className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-3 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500/50 cursor-pointer">
                                                    <option value="" className="bg-dark-800 text-slate-400">-- Category --</option>
                                                    {categories.map((cat, i) => <option key={i} value={cat} className="bg-dark-800 text-slate-100">{cat}</option>)}
                                                </select>
                                            </div>

                                            {/* Product — searchable */}
                                            <div className="lg:col-span-1">
                                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Product <span className="text-rose-400">*</span></label>
                                                <ProductSearchSelect
                                                    products={filteredProds}
                                                    value={row.product_id}
                                                    onChange={(pid) => selectRowProduct(idx, pid)}
                                                    disabled={!row.category}
                                                    placeholder={row.category ? "-- Product --" : "-- Select Category --"}
                                                />
                                                {stock !== null && (
                                                    <div className="mt-1 flex items-center gap-1 text-xs font-semibold">
                                                        <PackageCheck size={12} className={stock > 0 ? "text-emerald-400" : "text-rose-400"} />
                                                        <span className="text-slate-500">Stock:</span>
                                                        <span className={stock > 0 ? "text-emerald-400" : "text-rose-400"}>{stock} {row.unit}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Quantity */}
                                            <div className="lg:col-span-1">
                                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Quantity <span className="text-rose-400">*</span></label>
                                                <input type="number" min="0" step="any" placeholder="Qty"
                                                    value={row.quantity}
                                                    onChange={(e) => updateRow(idx, "quantity", e.target.value)}
                                                    className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-3 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500/50" />
                                                {shared.type === "Issued" && stock !== null && (
                                                    <p className="mt-1 text-xs text-amber-400/80 font-medium">Max: {stock} {row.unit}</p>
                                                )}
                                            </div>

                                            {/* Unit (read-only) */}
                                            <div className="lg:col-span-1">
                                                <label className="block text-xs font-medium text-slate-400 mb-1.5">Unit</label>
                                                <input readOnly value={row.unit || "—"}
                                                    className="w-full bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2.5 text-slate-400 text-sm outline-none cursor-not-allowed" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── ACTIONS ── */}
                <div className="flex justify-end gap-3">
                    <button type="button" onClick={() => navigate("/transactions")}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-slate-100 transition-all cursor-pointer">
                        Cancel
                    </button>
                    <button type="submit" disabled={status.loading}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50">
                        {status.loading ? (
                            <><Loader2 size={16} className="animate-spin" /> Saving...</>
                        ) : (
                            <><Save size={16} />{id ? "Update Transaction" : `Save ${rows.length > 1 ? `${rows.length} Transactions` : "Transaction"}`}</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}