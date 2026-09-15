import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCategories, addCategory, addProduct } from "../services/api";
import { Plus, Check, Loader2, X, ExternalLink } from "lucide-react";

export default function ProductForm({ stayAfterSave = false }) {
    const navigate = useNavigate();

    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);

    const [category, setCategory] = useState("");
    const [name, setName] = useState("");
    const [unit, setUnit] = useState("Nos");
    const [customUnit, setCustomUnit] = useState("");

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Modal state for adding a new category
    const [showAddCatModal, setShowAddCatModal] = useState(false);
    const [newCatName, setNewCatName] = useState("");
    const [addingCat, setAddingCat] = useState(false);
    const [catError, setCatError] = useState("");

    const commonUnits = [
        "Nos",
        "Ton",
        "Pairs",
        "Sheets",
        "Bags",
        "CFT",
        "Sq. Ft.",
        "Feet",
        "RFt",
        "Kg",
        "Pkt",
        "No",
        "Roll",
        "K",
        "Set",
        "ltr",
        "Custom..."
    ];

    const loadCategoryList = async () => {
        try {
            setLoadingCategories(true);
            const catRows = await fetchCategories();
            if (catRows && catRows.length > 1) {
                const [, ...catData] = catRows;
                const parsed = catData.map((row) => ({ id: row[0], name: row[1] })).filter(c => c.name);
                setCategories(parsed);
                if (parsed.length > 0 && !category) {
                    setCategory(parsed[0].name);
                }
            }
        } catch (err) {
            console.error("Failed to fetch categories:", err);
        } finally {
            setLoadingCategories(false);
        }
    };

    useEffect(() => {
        loadCategoryList();
    }, []);

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        if (!newCatName.trim()) {
            setCatError("Please enter a category name");
            return;
        }

        try {
            setAddingCat(true);
            setCatError("");
            const created = await addCategory({ name: newCatName.trim() });
            setShowAddCatModal(false);
            setNewCatName("");

            // Reload categories and select the newly created category
            await loadCategoryList();
            if (created && created.name) {
                setCategory(created.name);
            } else {
                setCategory(newCatName.trim());
            }
        } catch (err) {
            setCatError(err.message || "Failed to add category");
        } finally {
            setAddingCat(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!name.trim()) {
            setError("Product name is required");
            return;
        }

        const finalUnit = unit === "Custom..." ? customUnit.trim() : unit;
        if (!finalUnit) {
            setError("Please specify a unit");
            return;
        }

        try {
            setSubmitting(true);
            await addProduct({
                category,
                name: name.trim(),
                unit: finalUnit
            });

            setSuccessMessage(`"${name.trim()}" added successfully!`);

            if (stayAfterSave) {
                // Reset form for another entry
                setName("");
                setUnit("Nos");
                setCustomUnit("");
                setTimeout(() => setSuccessMessage(""), 4000);
            } else {
                setTimeout(() => {
                    navigate("/products");
                }, 1200);
            }
        } catch (err) {
            setError(err.message || "Failed to add product");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl p-6 sm:p-8 max-w-2xl">
            {error && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-medium flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><Check size={18} />{successMessage}</span>
                    {stayAfterSave && (
                        <button
                            type="button"
                            onClick={() => navigate("/products")}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 whitespace-nowrap cursor-pointer transition-colors"
                        >
                            <ExternalLink size={13} />
                            View All Products
                        </button>
                    )}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Category Selection */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-slate-300">
                            Category <span className="text-rose-400">*</span>
                        </label>
                        <button
                            type="button"
                            onClick={() => setShowAddCatModal(true)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                        >
                            <Plus size={14} />
                            Add New Category
                        </button>
                    </div>

                    {loadingCategories ? (
                        <div className="flex items-center gap-2 py-2 text-sm text-slate-400">
                            <Loader2 size={16} className="animate-spin" />
                            Loading categories...
                        </div>
                    ) : (
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm font-sans outline-none focus:border-indigo-500/50 cursor-pointer"
                        >
                            {categories.length === 0 ? (
                                <option value="" className="bg-dark-800 text-slate-100">
                                    No categories available
                                </option>
                            ) : (
                                categories.map((cat) => (
                                    <option
                                        key={cat.id || cat.name}
                                        value={cat.name}
                                        className="bg-dark-800 text-slate-100"
                                    >
                                        {cat.name}
                                    </option>
                                ))
                            )}
                        </select>
                    )}
                </div>

                {/* Product Name */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Product Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. Door Handles 3/4 thick"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm font-sans outline-none focus:border-indigo-500/50"
                        required
                    />
                </div>

                {/* Unit Selection */}
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Unit of Measurement <span className="text-rose-400">*</span>
                    </label>
                    <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm font-sans outline-none focus:border-indigo-500/50 cursor-pointer"
                    >
                        {commonUnits.map((u) => (
                            <option key={u} value={u} className="bg-dark-800 text-slate-100">
                                {u}
                            </option>
                        ))}
                    </select>

                    {unit === "Custom..." && (
                        <input
                            type="text"
                            placeholder="Enter custom unit (e.g. Rolls, Metre)"
                            value={customUnit}
                            onChange={(e) => setCustomUnit(e.target.value)}
                            className="mt-3 w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-3 text-slate-100 text-sm font-sans outline-none focus:border-indigo-500/50"
                            required
                        />
                    )}
                </div>

                {/* Submit Action */}
                <div className="pt-4 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate("/products")}
                        className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-slate-100 transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Adding Product...
                            </>
                        ) : (
                            "Save Product"
                        )}
                    </button>
                </div>
            </form>

            {/* Modal for Quick Category Creation */}
            {showAddCatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-fade-in">
                        <button
                            type="button"
                            onClick={() => setShowAddCatModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
                        >
                            <X size={18} />
                        </button>

                        <h3 className="text-xl font-bold text-slate-100 mb-1">
                            Add New Category
                        </h3>
                        <p className="text-slate-400 text-xs mb-4">
                            Enter the category name to store in Google Sheets.
                        </p>

                        {catError && (
                            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                                {catError}
                            </div>
                        )}

                        <form onSubmit={handleCreateCategory} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Category Name
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Electrical & Wiring"
                                    value={newCatName}
                                    onChange={(e) => setNewCatName(e.target.value)}
                                    className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500/50"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddCatModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 text-slate-400 hover:bg-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={addingCat}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md disabled:opacity-50"
                                >
                                    {addingCat ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        "Add Category"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}