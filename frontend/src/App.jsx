import { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import AddProduct from "./pages/AddProduct";
import Inventory from "./pages/Inventory";
import Transaction from "./pages/Transaction";
import AddInventory from "./pages/AddInventory";
import AddTransaction from "./pages/AddTransaction";
import EditTransaction from "./pages/EditTransaction";
import { fetchInventory, fetchProducts } from "./services/api";
import "./App.css";

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Fetch products from backend on mount
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const [productResult, inventoryResult] = await Promise.allSettled([
        fetchProducts(),
        fetchInventory(),
      ]);
      const rows = productResult.status === "fulfilled" ? productResult.value : [];
      const inventoryRows = inventoryResult.status === "fulfilled" ? inventoryResult.value : [];
      if (!rows || rows.length < 2) {
        setProducts([]);
        return;
      }

      const inventoryByProduct = {};
      inventoryRows.slice(1).forEach((row) => {
        inventoryByProduct[row[2]] = {
          quantity: Number(row[9]) || 0,
          date: row[1] || "",
        };
      });

      const [, ...data] = rows;
      const formatted = data.map((row, index) => ({
        id: row[0] || index + 1,
        name: row[1] || "",
        category: row[2] || "Uncategorised",
        unit: row[3] || "",
        quantity: inventoryByProduct[row[0]]?.quantity || 0,
        status: inventoryByProduct[row[0]]?.quantity > 0 ? "In Stock" : "Out of Stock",
        lastUpdated: inventoryByProduct[row[0]]?.date || new Date().toISOString().slice(0, 10),
      }));
      setProducts(formatted);
    } catch (err) {
      console.error("Failed to load products:", err);
      showToast("Failed to load products", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return (
    <BrowserRouter>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-[260px] p-8 min-h-screen bg-slate-50 relative overflow-x-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard products={products} />} />
              <Route path="/products" element={<Products />} />
              <Route path="/add-product" element={<AddProduct />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/add-inventory" element={<AddInventory />} />
              <Route path="/transactions" element={<Transaction />} />
              <Route path="/add-transaction" element={<AddTransaction />} />
              <Route path="/edit-transaction/:id" element={<EditTransaction />} />
            </Routes>
          )}
        </main>

        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-3 z-[300] shadow-lg min-w-[280px] animate-fade-in ${toast.type === "success"
              ? "border-l-[3px] border-l-emerald-500"
              : toast.type === "error"
                ? "border-l-[3px] border-l-rose-500"
                : "border-l-[3px] border-l-amber-500"
              }`}
          >
            <span className="text-sm text-slate-100 font-medium">
              {toast.message}
            </span>
          </div>
        )}
      </div>
    </BrowserRouter>
  );
}

export default App;
