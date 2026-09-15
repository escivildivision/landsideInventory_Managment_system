const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(path, options) {
    const res = await fetch(`${API_URL}${path}`, options);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || data.message || "Request failed");
    return data.data;
}

// ---- Categories ----
export async function fetchCategories() {
    return request("/categories/get");
}

export async function addCategory(category) {
    return request("/categories/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(category),
    });
}

// ---- Products ----
export async function fetchProducts() {
    return request("/products/get");
}

export async function addProduct(product) {
    return request("/products/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
    });
}

// ---- Inventory ----
export async function fetchInventory() {
    return request("/inventory/get");
}

export async function addInventory(inventory) {
    return request("/inventory/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inventory),
    });
}

export async function downloadInventoryPdf(category = "") {
    const url = category && category !== "All"
        ? `${API_URL}/inventory/pdf?category=${encodeURIComponent(category)}`
        : `${API_URL}/inventory/pdf`;
    const res = await fetch(url);
    if (!res.ok) {
        let message = "Unable to generate inventory PDF.";
        try {
            const data = await res.json();
            message = data.error || data.message || message;
        } catch {
            // Keep the default message when the server does not return JSON.
        }
        throw new Error(message);
    }
    return res.blob();
}

// ---- Transactions ----

export async function fetchTransactions() {
    return request("/transaction/get");
}

export async function fetchTransaction(id) {
    return request(`/transaction/get/${encodeURIComponent(id)}`);
}

export async function addTransaction(transaction) {
    return request("/transaction/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transaction),
    });
}

export async function updateTransaction(id, transaction) {
    return request(`/transaction/update/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transaction),
    });
}



export async function deleteInventory(id) {
    return request(`/inventory/delete/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function deleteTransaction(id) {
    return request(`/transaction/delete/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function downloadTransactionPdf(category = "") {
    const url = category && category !== "All"
        ? `${API_URL}/transaction/pdf?category=${encodeURIComponent(category)}`
        : `${API_URL}/transaction/pdf`;
    const res = await fetch(url);
    if (!res.ok) {
        let message = "Unable to generate register PDF.";
        try {
            const data = await res.json();
            message = data.error || data.message || message;
        } catch {
            // Keep the default message when the server does not return JSON.
        }
        throw new Error(message);
    }
    return res.blob();
}