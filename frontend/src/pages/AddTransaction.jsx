import { useEffect, useState } from "react";
import { ArrowLeft, ArrowLeftRight, Save, Loader2, Check, PackageCheck, AlertCircle } from "lucide-react";
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

const initialForm = {
    date: new Date().toISOString().slice(0, 10),
    product_id: "",
    product_name: "",
    category: "",
    unit: "",
    type: "Received",
    quantity: "",
    remarks: "",
    job_slip_no: ""
};

export default function AddTransaction() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const editingTransaction = location.state?.transaction;

    const [form, setForm] = useState(() =>
        editingTransaction
            ? {
                date: formatDateForInput(editingTransaction.date),
                product_id: editingTransaction.productId || "",
                product_name: editingTransaction.name || "",
                category: editingTransaction.category || "",
                unit: editingTransaction.unit || "",
                type: editingTransaction.type || initialForm.type,
                quantity:
                    editingTransaction.quantity ||
                    editingTransaction.received ||
                    editingTransaction.issued ||
                    editingTransaction.opening ||
                    "",
                remarks: editingTransaction.remarks || "",
                job_slip_no: editingTransaction.jobSlipNo || "",
            }
            : initialForm
    );

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [inventoryMap, setInventoryMap] = useState({});
    const [status, setStatus] = useState({ loading: false, error: "", success: "" });

    useEffect(() => {
        Promise.all([
            fetchProducts().catch(() => []),
            fetchInventory().catch(() => []),
            fetchCategories().catch(() => []),
        ])
            .then(([prodRows, invRows, catRes]) => {
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

                // Extract unique categories from products & category API
                const catSet = new Set();
                parsedProducts.forEach((p) => {
                    if (p.category) catSet.add(p.category);
                });
                if (Array.isArray(catRes)) {
                    catRes.forEach((c) => {
                        const name = typeof c === 'string' ? c : c.name || c.category;
                        if (name) catSet.add(name);
                    });
                }
                setCategories(Array.from(catSet).sort());

                // Build stock lookup map: productId -> closing_balance
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
            })
            .catch(() =>
                setStatus({ loading: false, error: "Unable to load required product data.", success: "" })
            );
    }, []);

    useEffect(() => {
        if (!id || editingTransaction) return;
        fetchTransaction(id)
            .then((row) => {
                setForm({
                    date: formatDateForInput(row[1]),
                    job_slip_no: row[2] || "",
                    product_id: row[3] || "",
                    product_name: row[4] || "",
                    category: row[5] || "",
                    unit: row[6] || "",
                    type: row[7] || initialForm.type,
                    quantity: row[8] || "",
                    remarks: row[9] || "",
                });
            })
            .catch((err) =>
                setStatus({
                    loading: false,
                    error: err.message || "Unable to load transaction.",
                    success: "",
                })
            );
    }, [id, editingTransaction]);

    function updateField(event) {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    }

    function selectCategory(event) {
        const selectedCat = event.target.value;
        setForm((current) => {
            // Check if current selected product belongs to the newly selected category
            const currentProd = products.find((item) => item.id === current.product_id);
            const isMatch = currentProd && currentProd.category === selectedCat;
            return {
                ...current,
                category: selectedCat,
                product_id: isMatch ? current.product_id : "",
                product_name: isMatch ? current.product_name : "",
                unit: isMatch ? current.unit : "",
            };
        });
    }

    function selectProduct(event) {
        const selectedId = event.target.value;
        const product = products.find((item) => item.id === selectedId);
        setForm((current) => ({
            ...current,
            product_id: product?.id || "",
            product_name: product?.name || "",
            category: product?.category || current.category,
            unit: product?.unit || "",
        }));
    }

    // Filter products by selected category
    const filteredProducts = form.category
        ? products.filter((p) => p.category.toLowerCase() === form.category.toLowerCase())
        : products;

    // Available stock for selected product
    const availableStock = form.product_id
        ? (inventoryMap[String(form.product_id).trim()] ?? 0)
        : null;

    async function handleSubmit(event) {
        event.preventDefault();
        const quantity = Number(form.quantity);

        if (!form.category) {
            setStatus({ loading: false, error: "Please select a Category.", success: "" });
            return;
        }

        if (!form.product_id) {
            setStatus({ loading: false, error: "Please select a Product.", success: "" });
            return;
        }

        if (isNaN(quantity) || quantity <= 0) {
            setStatus({ loading: false, error: "Please enter a valid quantity greater than 0.", success: "" });
            return;
        }

        // Validation for Issued transactions: cannot issue more than available stock
        if (form.type === "Issued") {
            const stock = availableStock ?? 0;
            if (stock <= 0) {
                setStatus({
                    loading: false,
                    error: `Cannot issue product "${form.product_name}": Current available stock is 0.`,
                    success: "",
                });
                return;
            }
            if (quantity > stock) {
                setStatus({
                    loading: false,
                    error: `Issued quantity (${quantity}) cannot be greater than available stock (${stock} ${form.unit || "units"}).`,
                    success: "",
                });
                return;
            }
        }

        const payload = {
            date: form.date,
            product_id: form.product_id,
            product_name: form.product_name,
            category: form.category,
            unit: form.unit,
            transaction_type: form.type,
            quantity,
            remarks: form.remarks,
            job_slip_no: form.job_slip_no,
        };

        try {
            setStatus({ loading: true, error: "", success: "" });
            if (id) {
                await updateTransaction(id, payload);
                setStatus({ loading: false, error: "", success: "Transaction updated successfully!" });
            } else {
                await addTransaction(payload);
                setStatus({ loading: false, error: "", success: "Transaction saved successfully!" });
            }
            setTimeout(() => {
                navigate("/transactions");
            }, 1000);
        } catch (err) {
            setStatus({
                loading: false,
                error: err.message || `Unable to ${id ? "update" : "add"} transaction.`,
                success: "",
            });
        }
    }

    return (
        <div className="animate-fade-in max-w-3xl">
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
                    Record stock received, issued, or opening balance updates.
                </p>
            </div>

            {/* Notification messages */}
            {status.error && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm font-medium flex items-center gap-2">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>{status.error}</span>
                </div>
            )}

            {status.success && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium flex items-center gap-2">
                    <Check size={18} className="shrink-0" />
                    <span>{status.success}</span>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-dark-800/80 border border-white/[0.06] rounded-2xl p-6 sm:p-8 space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Date <span className="text-rose-400">*</span>
                        </label>
                        <input
                            required
                            type="date"
                            name="date"
                            value={form.date}
                            onChange={updateField}
                            className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-indigo-500/50"
                        />
                    </div>

                    {/* Transaction Type */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Transaction Type <span className="text-rose-400">*</span>
                        </label>
                        <select
                            name="type"
                            value={form.type}
                            onChange={updateField}
                            className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-indigo-500/50 cursor-pointer"
                        >
                            <option value="Received" className="bg-dark-800 text-emerald-400 font-semibold">
                                Received (Stock In)
                            </option>
                            <option value="Issued" className="bg-dark-800 text-amber-400 font-semibold">
                                Issued (Stock Out)
                            </option>
                            <option value="Opening" className="bg-dark-800 text-slate-300">
                                Opening Balance
                            </option>
                        </select>
                    </div>

                    {/* 1. Category Selection First */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Category <span className="text-rose-400">*</span>
                        </label>
                        <select
                            required
                            name="category"
                            value={form.category}
                            onChange={selectCategory}
                            className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-indigo-500/50 cursor-pointer"
                        >
                            <option value="" className="bg-dark-800 text-slate-400">
                                -- Select Category First --
                            </option>
                            {categories.map((cat, idx) => (
                                <option key={idx} value={cat} className="bg-dark-800 text-slate-100">
                                    {cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 2. Product Selection (Filtered by Category) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Product <span className="text-rose-400">*</span>
                        </label>
                        <select
                            required
                            name="product_id"
                            value={form.product_id}
                            onChange={selectProduct}
                            disabled={!form.category}
                            className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-indigo-500/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="" className="bg-dark-800 text-slate-400">
                                {form.category ? "-- Select Product --" : "-- Select Category First --"}
                            </option>
                            {filteredProducts.map((product) => (
                                <option
                                    key={product.id}
                                    value={product.id}
                                    className="bg-dark-800 text-slate-100"
                                >
                                    {product.id} - {product.name} ({product.unit})
                                </option>
                            ))}
                        </select>

                        {/* Available Stock Indicator */}
                        {form.product_id && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
                                <PackageCheck size={14} className={availableStock > 0 ? "text-emerald-400" : "text-rose-400"} />
                                <span className="text-slate-400">Available Stock:</span>
                                <span className={availableStock > 0 ? "text-emerald-400" : "text-rose-400"}>
                                    {availableStock} {form.unit}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Quantity */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Quantity <span className="text-rose-400">*</span>
                        </label>
                        <input
                            required
                            min="0"
                            step="any"
                            type="number"
                            name="quantity"
                            placeholder="Enter quantity"
                            value={form.quantity}
                            onChange={updateField}
                            className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-indigo-500/50"
                        />
                        {form.type === "Issued" && availableStock !== null && (
                            <p className="mt-1 text-xs text-amber-400/90 font-medium">
                                Max allowable issue: {availableStock} {form.unit}
                            </p>
                        )}
                    </div>

                    {/* Unit (Auto-filled) */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                            Unit
                        </label>
                        <input
                            readOnly
                            value={form.unit || "Auto-filled when product selected"}
                            className="w-full bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3 text-slate-400 text-sm outline-none cursor-not-allowed"
                        />
                    </div>

                    {/* Job Slip No. */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Job Slip No. <span className="text-xs text-slate-500">(Optional - e.g. 02, 04, 18)</span>
                        </label>
                        <input
                            type="text"
                            name="job_slip_no"
                            value={form.job_slip_no}
                            onChange={updateField}
                            placeholder="Enter Job Slip No. (e.g. 02, 04, 18)"
                            className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-indigo-500/50"
                        />
                    </div>

                    {/* Remarks */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Remarks / Details <span className="text-xs text-slate-500">(Optional)</span>
                        </label>
                        <textarea
                            name="remarks"
                            value={form.remarks}
                            onChange={updateField}
                            rows="3"
                            placeholder="e.g. Meterial Received vide MB# 1875 Page 43"
                            className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-indigo-500/50"
                        />
                    </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate("/transactions")}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-slate-100 transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={status.loading}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                    >
                        {status.loading ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Saving Transaction...
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                {id ? "Update Transaction" : "Save Transaction"}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
