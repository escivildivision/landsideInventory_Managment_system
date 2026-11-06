import { fetchCategories, fetchProducts, addCategory, updateProduct, deleteProduct } from "../services/api";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FolderPlus, PackagePlus, Loader2, X, Pencil, Trash2, Check, Search } from "lucide-react";

export default function Products() {
    const navigate = useNavigate();

    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Modal state for adding a new category
    const [showAddCatModal, setShowAddCatModal] = useState(false);
    const [newCatName, setNewCatName] = useState("");
    const [addingCat, setAddingCat] = useState(false);
    const [catError, setCatError] = useState("");

    // Edit product state
    const [editingProduct, setEditingProduct] = useState(null); // product object being edited
    const [editForm, setEditForm] = useState({ category: "", name: "", unit: "" });
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState("");

    // Delete state
    const [deletingId, setDeletingId] = useState(null); // id currently being deleted
    const [confirmDeleteId, setConfirmDeleteId] = useState(null); // id awaiting confirmation

    const loadData = async () => {
        try {
            setLoading(true);
            const [catResult, prodResult] = await Promise.allSettled([
                fetchCategories(),
                fetchProducts(),
            ]);

            const catRows = catResult.status === "fulfilled" ? catResult.value : null;
            const prodRows = prodResult.status === "fulfilled" ? prodResult.value : null;

            if (catRows && catRows.length > 1) {
                const [, ...catData] = catRows;
                setCategories(catData.map((row) => ({ id: row[0], name: row[1] })));
            }

            if (prodRows && prodRows.length > 1) {
                const [, ...prodData] = prodRows;
                setProducts(
                    prodData.map((row) => ({
                        id: row[0] || "",
                        category: row[1] || "",
                        name: row[2] || "",
                        unit: row[3] || "",
                    }))
                );
            }
        } catch (err) {
            console.error("Failed to load data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
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

            await loadData();
            if (created && created.name) {
                setSelectedCategory(created.name);
            } else {
                setSelectedCategory(newCatName.trim());
            }
        } catch (err) {
            setCatError(err.message || "Failed to add category");
        } finally {
            setAddingCat(false);
        }
    };

    /* ---------- Edit handlers ---------- */
    const openEdit = (product) => {
        setEditingProduct(product);
        setEditForm({ category: product.category, name: product.name, unit: product.unit });
        setEditError("");
    };

    const handleEditSave = async (e) => {
        e.preventDefault();
        if (!editForm.name.trim()) { setEditError("Product name is required"); return; }
        try {
            setEditSaving(true);
            setEditError("");
            await updateProduct(editingProduct.id, editForm);
            setEditingProduct(null);
            await loadData();
        } catch (err) {
            setEditError(err.message || "Failed to update product");
        } finally {
            setEditSaving(false);
        }
    };

    /* ---------- Delete handlers ---------- */
    const handleDelete = async (id) => {
        try {
            setDeletingId(id);
            await deleteProduct(id);
            setConfirmDeleteId(null);
            await loadData();
        } catch (err) {
            console.error("Delete failed:", err);
        } finally {
            setDeletingId(null);
        }
    };

    // Filter products by selected category + search query
    const filteredProducts = products.filter((p) => {
        const matchCat = !selectedCategory || p.category === selectedCategory;
        const q = searchQuery.toLowerCase();
        const matchSearch = !q ||
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.id.toLowerCase().includes(q);
        return matchCat && matchSearch;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-100">
                        Products
                    </h2>
                    <p className="text-slate-400 mt-1 text-sm">
                        Manage your product inventory and stock levels.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setShowAddCatModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/[0.08] transition-all cursor-pointer"
                    >
                        <FolderPlus size={16} className="text-indigo-400" />
                        Add Category
                    </button>

                    <button
                        onClick={() => navigate("/add-product")}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                    >
                        <PackagePlus size={16} />
                        Add Product
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl p-5 flex flex-wrap gap-5 mb-6">
                {/* Category filter */}
                <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
                    <label className="text-sm font-medium text-slate-400">Category</label>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="bg-white/5 border border-white/[0.06] rounded-xl px-4 py-2.5 text-slate-100 text-sm font-sans outline-none cursor-pointer transition-colors focus:border-indigo-500/50"
                    >
                        <option value="" className="bg-dark-800 text-slate-100">
                            All Categories ({categories.length})
                        </option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.name} className="bg-dark-800 text-slate-100">
                                {category.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Search bar */}
                <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                    <label className="text-sm font-medium text-slate-400">Search</label>
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Name, category or ID…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500/50 transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* ===== Product List Table with Edit / Delete ===== */}
            <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl w-full overflow-hidden mb-6">
                <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-300">
                        Product List
                        <span className="ml-2 text-xs text-slate-500 font-normal">
                            ({filteredProducts.length} products)
                        </span>
                    </h3>
                </div>
                <div className="max-h-[340px] overflow-y-auto overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 bg-dark-800 z-10">
                            <tr className="text-slate-400 border-b border-white/[0.06]">
                                <th className="px-4 py-3">ID</th>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3">Unit</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                                        No products found.
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr
                                        key={product.id}
                                        className="border-b border-white/[0.04] text-slate-200 hover:bg-white/[0.02] transition-colors"
                                    >
                                        <td className="px-4 py-2.5 text-xs text-slate-500 font-mono">{product.id}</td>
                                        <td className="px-4 py-2.5 font-semibold text-slate-100">{product.name}</td>
                                        <td className="px-4 py-2.5">
                                            <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                                {product.category || "—"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-400">{product.unit}</td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Edit button */}
                                                <button
                                                    onClick={() => openEdit(product)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all cursor-pointer"
                                                >
                                                    <Pencil size={12} />
                                                    Edit
                                                </button>

                                                {/* Delete / Confirm */}
                                                {confirmDeleteId === product.id ? (
                                                    <span className="flex items-center gap-1">
                                                        <span className="text-xs text-slate-400">Sure?</span>
                                                        <button
                                                            onClick={() => handleDelete(product.id)}
                                                            disabled={deletingId === product.id}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-600/80 hover:bg-rose-600 text-white transition-all cursor-pointer disabled:opacity-50"
                                                        >
                                                            {deletingId === product.id
                                                                ? <Loader2 size={12} className="animate-spin" />
                                                                : <Check size={12} />}
                                                            Yes
                                                        </button>
                                                        <button
                                                            onClick={() => setConfirmDeleteId(null)}
                                                            className="px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                                                        >
                                                            No
                                                        </button>
                                                    </span>
                                                ) : (
                                                    <button
                                                        onClick={() => setConfirmDeleteId(product.id)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                                                    >
                                                        <Trash2 size={12} />
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>


            {/* ===== Edit Product Modal ===== */}
            {editingProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-fade-in">
                        <button
                            type="button"
                            onClick={() => setEditingProduct(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                            <X size={18} />
                        </button>

                        <h3 className="text-xl font-bold text-slate-100 mb-1">Edit Product</h3>
                        <p className="text-slate-400 text-xs mb-4">
                            ID: <span className="font-mono text-slate-300">{editingProduct.id}</span>
                        </p>

                        {editError && (
                            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                                {editError}
                            </div>
                        )}

                        <form onSubmit={handleEditSave} className="space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Product Name <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500/50"
                                    required
                                    autoFocus
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Category
                                </label>
                                <select
                                    value={editForm.category}
                                    onChange={(e) => setEditForm(f => ({ ...f, category: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500/50 cursor-pointer"
                                >
                                    <option value="" className="bg-dark-800">— No Category —</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.name} className="bg-dark-800">{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Unit */}
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                    Unit
                                </label>
                                <input
                                    type="text"
                                    value={editForm.unit}
                                    onChange={(e) => setEditForm(f => ({ ...f, unit: e.target.value }))}
                                    placeholder="e.g. Nos, Kg, Ltr"
                                    className="w-full bg-white/5 border border-white/[0.06] rounded-xl px-4 py-2.5 text-slate-100 text-sm outline-none focus:border-indigo-500/50"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingProduct(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 text-slate-400 hover:bg-white/10 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={editSaving}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    {editSaving ? (
                                        <><Loader2 size={14} className="animate-spin" /> Saving...</>
                                    ) : (
                                        "Save Changes"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal for Quick Category Creation */}
            {showAddCatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative animate-fade-in">
                        <button
                            type="button"
                            onClick={() => setShowAddCatModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
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
                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 text-slate-400 hover:bg-white/10 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={addingCat}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md cursor-pointer disabled:opacity-50"
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