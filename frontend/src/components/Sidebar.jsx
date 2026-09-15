import { NavLink } from "react-router-dom";
import {
    LayoutDashboard,
    PlusCircle,
    Boxes,
    ArrowLeftRight,
} from "lucide-react";

const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/add-product", icon: PlusCircle, label: "Add Products/Categories" },
    { to: "/inventory", icon: Boxes, label: "Inventory" },
    { to: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
];

export default function Sidebar() {
    return (
        <aside className="fixed top-0 left-0 w-[260px] h-screen bg-white border-r border-slate-200 flex flex-col z-[100] overflow-y-auto">

            {/* Logo / Branding */}
            <div className="px-6 py-7 border-b border-slate-200">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    LandSide
                </h1>

                <span className="text-xs text-slate-500 font-normal tracking-widest uppercase block mt-1">
                    Inventory Management System
                </span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 flex flex-col gap-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all relative overflow-hidden ${isActive
                                ? "text-indigo-700 bg-indigo-50"
                                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                            }`
                        }
                    >
                        <item.icon className="w-5 h-5 shrink-0" />
                        {item.label}
                    </NavLink>
                ))}
            </nav>

        </aside>
    );
}