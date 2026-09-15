import { fetchCategories, fetchProducts, fetchInventory, addCategory } from "../services/api";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderPlus, PackagePlus, Loader2, X } from "lucide-react";

export default function Products() {
    const navigate = useNavigate();

    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [products, setProducts] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedproduct, setSelectedProduct] = useState("");

    // Modal state for adding a new category
    const [showAddCatModal, setShowAddCatModal] = useState(false);
    const [newCatName, setNewCatName] = useState("");
    const [addingCat, setAddingCat] = useState(false);
    const [catError, setCatError] = useState("");

    const loadData = async () => {
        try {
            setLoading(true);
            const [catResult, prodResult, invResult] = await Promise.allSettled([
                fetchCategories(),
                fetchProducts(),
                fetchInventory(),
            ]);

            const catRows = catResult.status === "fulfilled" ? catResult.value : null;
            const prodRows = prodResult.status === "fulfilled" ? prodResult.value : null;
            const invRows = invResult.status === "fulfilled" ? invResult.value : null;

            if (catResult.status === "rejected") console.warn("Categories fetch failed:", catResult.reason);
            if (prodResult.status === "rejected") console.warn("Products fetch failed:", prodResult.reason);
            if (invResult.status === "rejected") console.warn("Inventory fetch failed:", invResult.reason);

            if (catRows && catRows.length > 1) {
                const [, ...catData] = catRows;
                setCategories(
                    catData.map((row) => ({ id: row[0], name: row[1] }))
                );
            }

            // Products sheet: Product ID | Category | Product Name | Unit
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

            // Inventory sheet
            if (invRows && invRows.length > 1) {
                const [, ...invData] = invRows;
                setInventory(
                    invData.map((row, index) => ({
                        id: row[0] || index + 1,
                        date: row[1] || "",
                        productId: row[2] || "",
                        name: row[3] || "",
                        category: row[4] || "",
                        unit: row[5] || "",
                        openingBalance: row[6] || 0,
                        receivedQty: row[7] || 0,
                        issuedQty: row[8] || 0,
                        closingBalance: row[9] || 0,
                        remarks: row[10] || "",
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

            // Reload data and select new category
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

    // Filter products by selected category
    const filteredProducts = selectedCategory
        ? products.filter((p) => p.category === selectedCategory)
        : products;

    // Filter inventory by selected category AND selected product
    let filteredInventory = inventory;
    if (selectedCategory) {
        filteredInventory = filteredInventory.filter((item) => item.category === selectedCategory);
    }
    if (selectedproduct) {
        filteredInventory = filteredInventory.filter((item) => item.name === selectedproduct);
    }

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
                <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                    <label className="text-sm font-medium text-slate-400">
                        Category
                    </label>
                    <select
                        value={selectedCategory}
                        onChange={(e) => {
                            setSelectedCategory(e.target.value);
                            setSelectedProduct("");
                        }}
                        className="bg-white/5 border border-white/[0.06] rounded-xl px-4 py-2.5 text-slate-100 text-sm font-sans outline-none cursor-pointer transition-colors focus:border-indigo-500/50"
                    >
                        <option value="" className="bg-dark-800 text-slate-100">
                            All Categories ({categories.length})
                        </option>
                        {categories.map((category) => (
                            <option
                                key={category.id}
                                value={category.name}
                                className="bg-dark-800 text-slate-100"
                            >
                                {category.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                    <label className="text-sm font-medium text-slate-400">
                        Products
                    </label>
                    <select
                        value={selectedproduct}
                        onChange={(e) => setSelectedProduct(e.target.value)}
                        className="bg-white/5 border border-white/[0.06] rounded-xl px-4 py-2.5 text-slate-100 text-sm font-sans outline-none cursor-pointer transition-colors focus:border-indigo-500/50"
                    >
                        <option value="" className="bg-dark-800 text-slate-100">
                            All Products ({filteredProducts.length})
                        </option>
                        {filteredProducts.map((product) => (
                            <option
                                key={product.id}
                                value={product.name}
                                className="bg-dark-800 text-slate-100"
                            >
                                {product.name} ({product.unit})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-dark-800/80 border border-white/[0.06] rounded-2xl w-full overflow-hidden">
                <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 bg-dark-800 z-10">
                            <tr className="text-slate-400 border-b border-white/[0.06]">
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Product ID</th>
                                <th className="px-4 py-3">Product Name</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3">Unit</th>
                                <th className="px-4 py-3">Opening</th>
                                <th className="px-4 py-3">Received</th>
                                <th className="px-4 py-3">Issued</th>
                                <th className="px-4 py-3">Closing</th>
                                <th className="px-4 py-3">Remarks</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredInventory.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={10}
                                        className="px-4 py-6 text-center text-slate-500"
                                    >
                                        No inventory records found.
                                    </td>
                                </tr>
                            ) : (
                                filteredInventory.map((item, index) => (
                                    <tr
                                        key={index}
                                        className="border-b border-white/[0.04] text-slate-200"
                                    >
                                        <td className="px-4 py-3">{item.date}</td>
                                        <td className="px-4 py-3 font-semibold text-slate-300">{item.productId}</td>
                                        <td className="px-4 py-3 font-semibold text-slate-100">{item.name}</td>
                                        <td className="px-4 py-3">{item.category}</td>
                                        <td className="px-4 py-3">{item.unit}</td>
                                        <td className="px-4 py-3">{item.openingBalance}</td>
                                        <td className="px-4 py-3 text-emerald-400">+{item.receivedQty}</td>
                                        <td className="px-4 py-3 text-amber-400">-{item.issuedQty}</td>
                                        <td className="px-4 py-3 font-bold text-slate-100">{item.closingBalance}</td>
                                        <td className="px-4 py-3">{item.remarks}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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