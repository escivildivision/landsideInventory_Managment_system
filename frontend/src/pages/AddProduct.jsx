import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import ProductForm from "../components/ProductForm";

export default function AddProduct({ onAddProduct }) {
    const navigate = useNavigate();

    const handleSubmit = (data) => {
        onAddProduct(data);
        navigate("/products");
    };

    return (
        <div className="relative z-[1] animate-fade-in">
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <button
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-slate-400 border border-white/[0.06] hover:bg-white/[0.08] hover:text-slate-100 transition-all cursor-pointer"
                        onClick={() => navigate("/products")}
                    >
                        <ArrowLeft size={16} />
                        Back to Products
                    </button>

                    <button
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 hover:text-indigo-100 transition-all cursor-pointer"
                        onClick={() => navigate("/products")}
                    >
                        <ExternalLink size={16} />
                        View All Products
                    </button>
                </div>

                <h2 className="text-3xl font-bold tracking-tight text-slate-100">
                    Add New Product
                </h2>
                <p className="text-slate-400 mt-1 text-sm">
                    Enter the details for your new product below.
                </p>
            </div>

            <ProductForm stayAfterSave />
        </div>
    );
}
