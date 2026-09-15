import { useState } from "react";
import { Search, Minus, Plus, Edit3, Trash2, Package } from "lucide-react";

export default function ProductTable({
    products,
    onUpdateQuantity,
    onDeleteProduct,
    onEditProduct,
}) {
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");

    const categories = ["All", ...new Set(products.map((p) => p.category))];

    const filtered = products.filter((p) => {
        const matchesSearch =
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.supplier.toLowerCase().includes(search.toLowerCase());
        const matchesCategory =
            categoryFilter === "All" || p.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const getStatusClass = (status) => {
        switch (status) {
            case "In Stock":
                return "in-stock";
            case "Low Stock":
                return "low-stock";
            case "Out of Stock":
                return "out-of-stock";
            default:
                return "";
        }
    };

    return (
        <>
            <div className="table-controls">
                <div className="search-input-wrapper">
                    <Search />
                    <input
                        id="product-search"
                        type="text"
                        placeholder="Search products or suppliers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    id="category-filter"
                    className="filter-select"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                >
                    {categories.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
            </div>

            <div className="table-card">
                <table className="product-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Category</th>
                            <th>Price</th>
                            <th>Quantity</th>
                            <th>Supplier</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan="7">
                                    <div className="table-empty">
                                        <Package />
                                        <p>No products found</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filtered.map((product) => (
                                <tr key={product.id}>
                                    <td className="product-name">{product.name}</td>
                                    <td>{product.category}</td>
                                    <td>Rs. {product.price.toFixed(2)}</td>
                                    <td>
                                        <div className="quantity-controls">
                                            <button
                                                className="qty-btn"
                                                onClick={() =>
                                                    onUpdateQuantity(
                                                        product.id,
                                                        Math.max(0, product.quantity - 1)
                                                    )
                                                }
                                                aria-label="Decrease quantity"
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <span className="qty-value">{product.quantity}</span>
                                            <button
                                                className="qty-btn"
                                                onClick={() =>
                                                    onUpdateQuantity(product.id, product.quantity + 1)
                                                }
                                                aria-label="Increase quantity"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </td>
                                    <td>{product.supplier}</td>
                                    <td>
                                        <span
                                            className={`status-badge ${getStatusClass(product.status)}`}
                                        >
                                            <span className="status-dot"></span>
                                            {product.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="actions-cell">
                                            <button
                                                className="action-btn"
                                                onClick={() => onEditProduct(product)}
                                                aria-label="Edit product"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                className="action-btn delete"
                                                onClick={() => onDeleteProduct(product.id)}
                                                aria-label="Delete product"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}
