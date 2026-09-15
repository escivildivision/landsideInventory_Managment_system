import { useEffect, useState } from "react";
import { ArrowLeft, Boxes, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { addInventory, fetchProducts } from "../services/api";

const today = new Date().toISOString().slice(0, 10);
const initialForm = { date: today, product_id: "", product_name: "", category: "", unit: "", opening_balance: "", received_qty: "", issued_qty: "", remarks: "" };

export default function AddInventory() {
    const navigate = useNavigate();
    const [form, setForm] = useState(initialForm);
    const [products, setProducts] = useState([]);
    const [status, setStatus] = useState({ loading: false, error: "" });

    useEffect(() => {
        fetchProducts().then((rows) => setProducts((rows || []).slice(1).map((row) => ({ id: row[0] || "", category: row[1] || "", name: row[2] || "", unit: row[3] || "" })))).catch(() => setStatus({ loading: false, error: "Unable to load products." }));
    }, []);

    function updateField(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
    function selectProduct(event) {
        const product = products.find((item) => item.id === event.target.value);
        setForm((current) => ({ ...current, product_id: product?.id || "", product_name: product?.name || "", category: product?.category || "", unit: product?.unit || "" }));
    }
    async function handleSubmit(event) {
        event.preventDefault();
        try { setStatus({ loading: true, error: "" }); await addInventory({ ...form, opening_balance: Number(form.opening_balance) || 0, received_qty: Number(form.received_qty) || 0, issued_qty: Number(form.issued_qty) || 0 }); navigate("/inventory"); }
        catch (err) { setStatus({ loading: false, error: err.message || "Unable to add inventory." }); }
    }
    return <section className="animate-fade-in max-w-4xl space-y-6"><button onClick={() => navigate("/inventory")} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600"><ArrowLeft size={16} /> Back to Inventory</button><header><div className="mb-2 flex items-center gap-3 text-indigo-600"><Boxes size={22} /><span className="text-xs font-bold uppercase tracking-[0.18em]">Stock control</span></div><h2 className="text-3xl font-bold text-slate-900">Add Inventory</h2><p className="mt-1 text-sm text-slate-500">Record opening stock, receipts, and issues.</p></header><form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-5 md:grid-cols-2"><label className="field-label">Date<input required type="date" name="date" value={form.date} onChange={updateField} /></label><label className="field-label">Product<select required name="product_id" value={form.product_id} onChange={selectProduct}><option value="">Select product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.id} - {product.name}</option>)}</select></label><label className="field-label">Product name<input readOnly value={form.product_name} /></label><label className="field-label">Category<input readOnly value={form.category} /></label><label className="field-label">Unit<input readOnly value={form.unit} /></label><label className="field-label">Opening balance<input min="0" type="number" name="opening_balance" value={form.opening_balance} onChange={updateField} /></label><label className="field-label">Received quantity<input min="0" type="number" name="received_qty" value={form.received_qty} onChange={updateField} /></label><label className="field-label">Issued quantity<input min="0" type="number" name="issued_qty" value={form.issued_qty} onChange={updateField} /></label><label className="field-label md:col-span-2">Remarks<textarea name="remarks" value={form.remarks} onChange={updateField} rows="3" /></label></div>{status.error && <p className="mt-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{status.error}</p>}<button disabled={status.loading} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"><Save size={16} />{status.loading ? "Saving..." : "Save inventory"}</button></form></section>;
}
