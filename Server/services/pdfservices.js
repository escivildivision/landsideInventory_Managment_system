const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */
const PAGE_WIDTH = 841.89;   // A4 landscape width in points
const PAGE_HEIGHT = 595.28;  // A4 landscape height in points
const MARGIN = 12;
const MAX_PRODUCTS_PER_PAGE = 20; // Maximum product columns per page

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function num(v) { return Number(v) || 0; }
function str(v) { return String(v ?? '').trim(); }

/** Get FY string like "FY-2026-27" (Pakistan fiscal July–June) */
function getFiscalYear() {
    const now = new Date();
    const y = now.getFullYear();
    return now.getMonth() >= 6
        ? `FY-${y}-${String(y + 1).slice(-2)}`
        : `FY-${y - 1}-${String(y).slice(-2)}`;
}

/**
 * Parse raw Products sheet rows into objects.
 * Columns: 0=ID, 1=Category, 2=Name, 3=Unit
 */
function parseProducts(rawRows) {
    if (!rawRows || rawRows.length < 2) return [];
    return rawRows.slice(1).map(row => ({
        id: str(row[0]),
        category: str(row[1]),
        name: str(row[2]),
        unit: str(row[3]),
    })).filter(p => p.name.length > 0);
}

/**
 * Parse raw Transactions sheet rows into objects.
 * Columns: 0=ID, 1=Date, 2=JobSlipNo, 3=ProductID, 4=ProductName,
 *          5=Category, 6=Unit, 7=TransactionType, 8=Quantity, 9=Remarks
 */
function parseTransactions(rawRows) {
    if (!rawRows || rawRows.length < 2) return [];
    return rawRows.slice(1).map(row => ({
        id: str(row[0]),
        date: str(row[1]),
        job_slip_no: str(row[2]),
        product_id: str(row[3]),
        product_name: str(row[4]),
        category: str(row[5]),
        unit: str(row[6]),
        transaction_type: str(row[7]).toLowerCase(),
        quantity: num(row[8]),
        remarks: str(row[9]),
    })).filter(t => t.remarks.toLowerCase() !== 'test' && t.product_name.toLowerCase() !== 'test' && t.remarks.toLowerCase() !== 'testing');
}

/** Filter transactions to a specific month */
function filterByMonth(txns, year, month) {
    return txns.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === month;
    });
}

/** Find product column index by product_id or product_name within a given product list */
function findProductIndex(products, txn) {
    let idx = products.findIndex(p => p.id === txn.product_id);
    if (idx >= 0) return idx;
    const name = txn.product_name.toLowerCase();
    idx = products.findIndex(p => p.name.toLowerCase() === name);
    return idx;
}

/* ------------------------------------------------------------------ */
/*  DRAWING HELPERS                                                    */
/* ------------------------------------------------------------------ */

function drawCell(doc, value, x, y, w, h, opts = {}) {
    const textVal = str(value);

    // Background fill
    if (opts.fill) {
        doc.save();
        doc.rect(x, y, w, h).fill(opts.fill);
        doc.restore();
    }

    // Border
    doc.lineWidth(opts.lineWidth || 0.5);
    doc.rect(x, y, w, h).stroke('#000000');

    if (!textVal && !opts.forceDrawText) return;

    const fontSize = opts.fontSize || 7.5;
    const font = opts.bold ? 'Helvetica-Bold' : 'Helvetica';
    const textColor = opts.color || '#000000';

    doc.font(font).fontSize(fontSize).fillColor(textColor);

    if (opts.vertical) {
        doc.save();
        const cx = x + w / 2;
        const cy = y + h / 2;
        doc.translate(cx, cy);
        doc.rotate(-90);

        const boxLength = h - 6;
        doc.text(textVal, -boxLength / 2, -fontSize / 2, {
            width: boxLength,
            align: opts.align || 'left',
            lineBreak: false,
        });
        doc.restore();
    } else if (opts.align === 'left') {
        doc.text(textVal, x + 3, y + 2, {
            width: Math.max(w - 6, 1),
            height: h - 4,
            align: 'left',
            lineBreak: true,
            lineGap: -0.5,
        });
    } else {
        const textY = y + (h - fontSize) / 2 - 0.5;
        doc.text(textVal, x + 2, textY, {
            width: Math.max(w - 4, 1),
            align: opts.align || 'center',
            lineBreak: false,
        });
    }
}

/* ------------------------------------------------------------------ */
/*  DRAW PAGE HEADER (Title + Table Header with Product Columns)       */
/* ------------------------------------------------------------------ */

function drawPageHeader(doc, productGroup, pageNum, totalPages, logoPath) {
    const left = MARGIN;
    const right = PAGE_WIDTH - MARGIN;
    const contentWidth = right - left;

    const colCount = productGroup.length;
    const dateW = 70;
    const descW = 170;
    const leftColsW = dateW + descW;
    const materialAreaW = contentWidth - leftColsW;
    const matColW = colCount > 0 ? materialAreaW / colCount : 40;

    const headerRowH = 90;
    const unitRowH = 15;
    const numRowH = 15;
    const subHeaderH = 15;

    let y = MARGIN;

    // --- Title Section ---
    if (logoPath) {
        try {
            doc.image(logoPath, left + 6, y, { fit: [60, 48], align: 'center' });
        } catch (e) { /* skip logo if missing */ }
    }

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000');
    doc.text('PAKISTAN AIRPORTS AUTHORITY', left + 60, y + 2, {
        width: contentWidth - 120,
        align: 'center',
    });
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('MATERIAL CONSUMPTION REGISTER FORM (8)', left + 60, y + 18, {
        width: contentWidth - 120,
        align: 'center',
    });

    // Form reference
    doc.font('Helvetica-Bold').fontSize(8);
    doc.text('CAAF-016-ESCW-1.0', right - 110, y + 4, {
        width: 105,
        align: 'right',
    });

    // Fiscal Year
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text(getFiscalYear(), left + 60, y + 33, {
        width: contentWidth - 120,
        align: 'center',
    });

    // Page number
    doc.font('Helvetica').fontSize(7).fillColor('#666666');
    doc.text(`Page ${pageNum} of ${totalPages}`, right - 110, y + 38, {
        width: 105,
        align: 'right',
    });
    doc.fillColor('#000000');

    const tableTop = y + 50;
    y = tableTop;

    // --- Row 1: "Description of Material" & Vertical Product Names ---
    drawCell(doc, 'Description of Material', left, y, leftColsW, headerRowH, {
        bold: true, fontSize: 8.5, align: 'center',
    });

    let mx = left + leftColsW;
    for (let i = 0; i < colCount; i++) {
        drawCell(doc, productGroup[i].name, mx, y, matColW, headerRowH, {
            vertical: true, fontSize: 7, bold: true, align: 'left',
        });
        mx += matColW;
    }
    y += headerRowH;

    // --- Row 2: Units ---
    drawCell(doc, '', left, y, leftColsW, unitRowH, { fontSize: 7 });
    mx = left + leftColsW;
    for (let i = 0; i < colCount; i++) {
        drawCell(doc, productGroup[i].unit, mx, y, matColW, unitRowH, {
            bold: true, fontSize: 7, align: 'center',
        });
        mx += matColW;
    }
    y += unitRowH;

    // --- Row 3: Column Numbers + Category ---
    const category = productGroup[0]?.category || 'Hardware Material';
    drawCell(doc, `(${category})`, left, y, leftColsW, numRowH, {
        bold: true, fontSize: 8, align: 'center',
    });
    mx = left + leftColsW;
    for (let i = 0; i < colCount; i++) {
        drawCell(doc, productGroup[i].id || String(i + 1), mx, y, matColW, numRowH, {
            bold: true, fontSize: 6.5, align: 'center',
        });
        mx += matColW;
    }
    y += numRowH;

    // --- Row 4: Sub-headers: Date | Description ---
    drawCell(doc, 'Date', left, y, dateW, subHeaderH, { bold: true, fontSize: 7.5, align: 'center' });
    drawCell(doc, 'Description', left + dateW, y, descW, subHeaderH, { bold: true, fontSize: 7.5, align: 'center' });

    mx = left + leftColsW;
    for (let i = 0; i < colCount; i++) {
        drawCell(doc, '', mx, y, matColW, subHeaderH, { fontSize: 7 });
        mx += matColW;
    }
    y += subHeaderH;

    return { y, matColW, dateW, descW, leftColsW };
}

/* ------------------------------------------------------------------ */
/*  DRAW PAGE FOOTER (Page Total + Page Balance rows)                  */
/* ------------------------------------------------------------------ */

function drawPageFooter(doc, colCount, matColW, dateW, descW, leftColsW, pageTotal, pageBalance) {
    const left = MARGIN;
    const footerRowH = 18;
    const footerReservedH = footerRowH * 2 + 8;
    const footerY = PAGE_HEIGHT - MARGIN - footerReservedH;
    const redColor = '#CC0000';

    // --- Page Total Row ---
    drawCell(doc, '', left, footerY, dateW, footerRowH, {
        bold: true, fontSize: 8, fill: '#F0F0F0', lineWidth: 0.75
    });
    drawCell(doc, 'Page Total', left + dateW, footerY, descW, footerRowH, {
        bold: true, fontSize: 8, color: '#000000', align: 'left', fill: '#F0F0F0', lineWidth: 0.75
    });

    let mx = left + leftColsW;
    for (let i = 0; i < colCount; i++) {
        const val = pageTotal[i] !== 0 ? String(pageTotal[i]) : '0';
        drawCell(doc, val, mx, footerY, matColW, footerRowH, {
            bold: true, fontSize: 8, color: '#000000', align: 'center', fill: '#F0F0F0', lineWidth: 0.75
        });
        mx += matColW;
    }

    // --- Page Balance Row ---
    const balanceY = footerY + footerRowH;
    drawCell(doc, '', left, balanceY, dateW, footerRowH, {
        bold: true, fontSize: 8, fill: '#E8F5E9', lineWidth: 0.75
    });
    drawCell(doc, 'Page Balance', left + dateW, balanceY, descW, footerRowH, {
        bold: true, fontSize: 8, color: redColor, align: 'left', fill: '#E8F5E9', lineWidth: 0.75
    });

    mx = left + leftColsW;
    for (let i = 0; i < colCount; i++) {
        const val = pageBalance[i] !== 0 ? String(pageBalance[i]) : '0';
        drawCell(doc, val, mx, balanceY, matColW, footerRowH, {
            bold: true, fontSize: 8, color: redColor, align: 'center', fill: '#E8F5E9', lineWidth: 0.75
        });
        mx += matColW;
    }
}

/* ------------------------------------------------------------------ */
/*  DRAW ONE PRODUCT-GROUP PAGE (handles vertical pagination too)      */
/* ------------------------------------------------------------------ */

function drawProductGroupPages(doc, allProducts, productGroup, productStartIndex, currentMonthTxns, previousTxns, logoPath, pageNum, totalPages) {
    const left = MARGIN;
    const colCount = productGroup.length;
    const dataRowH = 17;
    const footerRowH = 18;
    const footerReservedH = footerRowH * 2 + 8;
    const maxY = PAGE_HEIGHT - MARGIN - footerReservedH - 10;
    const redColor = '#CC0000';

    // Draw page header
    let { y, matColW, dateW, descW, leftColsW } = drawPageHeader(doc, productGroup, pageNum, totalPages, logoPath);

    /* --- Compute previous balance for this group's products --- */
    const prevBalance = new Array(colCount).fill(0);
    for (const txn of previousTxns) {
        const globalIdx = findProductIndex(allProducts, txn);
        const localIdx = globalIdx - productStartIndex;
        if (localIdx >= 0 && localIdx < colCount) {
            if (txn.transaction_type === 'received' || txn.transaction_type === 'opening') {
                prevBalance[localIdx] += txn.quantity;
            } else if (txn.transaction_type === 'issued') {
                prevBalance[localIdx] -= txn.quantity;
            }
        }
    }

    /* --- Previous Month Balance Row --- */
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const firstDayStr = `1-${months[now.getMonth()]}-${now.getFullYear()}`;

    drawCell(doc, firstDayStr, left, y, dateW, dataRowH, {
        bold: true, fontSize: 8, color: redColor, align: 'center', lineWidth: 0.75
    });
    drawCell(doc, 'Previous Month Balance', left + dateW, y, descW, dataRowH, {
        bold: true, fontSize: 8, color: redColor, align: 'left', lineWidth: 0.75
    });

    let mx = left + leftColsW;
    for (let i = 0; i < colCount; i++) {
        const val = prevBalance[i];
        drawCell(doc, String(val), mx, y, matColW, dataRowH, {
            bold: true, fontSize: 8, color: redColor, align: 'center', lineWidth: 0.75
        });
        mx += matColW;
    }
    y += dataRowH;

    /* --- Data Rows --- */
    const totalReceived = new Array(colCount).fill(0);
    const totalIssued = new Array(colCount).fill(0);

    for (const txn of currentMonthTxns) {
        // Check if we need a new page (vertical overflow)
        if (y + dataRowH > maxY) {
            // Draw footer on current page
            const pageTotal = new Array(colCount).fill(0);
            const pageBalance = new Array(colCount).fill(0);
            for (let i = 0; i < colCount; i++) {
                pageTotal[i] = totalReceived[i] - totalIssued[i];
                pageBalance[i] = prevBalance[i] + totalReceived[i] - totalIssued[i];
            }
            drawPageFooter(doc, colCount, matColW, dateW, descW, leftColsW, pageTotal, pageBalance);

            // New page with same product group
            doc.addPage({ size: 'A4', layout: 'landscape', margin: MARGIN });
            const header = drawPageHeader(doc, productGroup, pageNum, totalPages, logoPath);
            y = header.y;
        }

        const typeStr = (txn.transaction_type || '').toLowerCase();
        const remarksStr = (txn.remarks || '').toLowerCase();

        const isReceived = typeStr.includes('received') || remarksStr.includes('received') || typeStr.includes('new stock') || remarksStr.includes('new stock');
        const rowFill = isReceived ? '#FFFF00' : null;
        const textColor = isReceived ? redColor : '#000000';

        const dateStr = txn.date;

        // Format Job Slip No.
        let jsNoStr = txn.job_slip_no;
        if (jsNoStr && !isNaN(Number(jsNoStr))) {
            jsNoStr = String(Number(jsNoStr)).padStart(2, '0');
        }

        // Description formatting
        let desc = txn.remarks;
        if (!desc) {
            if (isReceived) {
                desc = jsNoStr ? `Meterial Received vide J.s no ${jsNoStr}` : 'Meterial Received';
            } else if (typeStr.includes('opening')) {
                desc = 'Opening stock';
            } else {
                desc = jsNoStr ? `Material issued vide J.s no ${jsNoStr}` : 'Material issued';
            }
        } else {
            if (jsNoStr && !desc.toLowerCase().includes('j.s') && !desc.toLowerCase().includes('mb#')) {
                desc = `${desc} vide J.s no ${jsNoStr}`;
            }
        }

        // Find which column in this group the product belongs to
        const globalIdx = findProductIndex(allProducts, txn);
        const localIdx = globalIdx - productStartIndex;

        // Skip transactions that do not belong to any product on this page/group
        if (globalIdx === -1 || localIdx < 0 || localIdx >= colCount) {
            continue;
        }

        // Track totals for this group's products
        if (isReceived || typeStr.includes('opening')) {
            totalReceived[localIdx] += txn.quantity;
        } else {
            totalIssued[localIdx] += txn.quantity;
        }

        // Draw Date cell
        drawCell(doc, dateStr, left, y, dateW, dataRowH, {
            fontSize: 7.5, fill: rowFill, bold: isReceived, color: textColor, align: 'center',
        });

        // Draw Description cell
        drawCell(doc, desc, left + dateW, y, descW, dataRowH, {
            fontSize: 7.5, fill: rowFill, align: 'left', bold: isReceived, color: textColor,
        });

        // Draw Product quantity cells
        mx = left + leftColsW;
        for (let i = 0; i < colCount; i++) {
            let val = '';
            if (localIdx === i && (txn.quantity !== undefined && txn.quantity !== null && !isNaN(txn.quantity))) {
                val = String(txn.quantity);
            }
            drawCell(doc, val, mx, y, matColW, dataRowH, {
                fontSize: 8, fill: rowFill, bold: isReceived || Boolean(val), color: textColor, align: 'center',
            });
            mx += matColW;
        }

        y += dataRowH;
    }

    /* --- Fill empty rows --- */
    while (y + dataRowH <= maxY) {
        drawCell(doc, '', left, y, dateW, dataRowH, { fontSize: 7.5 });
        drawCell(doc, '', left + dateW, y, descW, dataRowH, { fontSize: 7.5 });
        mx = left + leftColsW;
        for (let i = 0; i < colCount; i++) {
            drawCell(doc, '', mx, y, matColW, dataRowH, { fontSize: 7.5 });
            mx += matColW;
        }
        y += dataRowH;
    }

    /* --- Footer --- */
    const pageTotal = new Array(colCount).fill(0);
    const pageBalance = new Array(colCount).fill(0);
    for (let i = 0; i < colCount; i++) {
        pageTotal[i] = totalReceived[i] - totalIssued[i];
        pageBalance[i] = prevBalance[i] + totalReceived[i] - totalIssued[i];
    }
    drawPageFooter(doc, colCount, matColW, dateW, descW, leftColsW, pageTotal, pageBalance);
}

/* ------------------------------------------------------------------ */
/*  PUBLIC API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Generate the Material Consumption Register Form (8) PDF.
 * Products are split across multiple pages (max 10 per page) so each
 * column is wide enough to read.
 */
const generateRegisterPDF = (rawProducts = [], rawTransactions = [], options = {}) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape',
                margin: MARGIN,
                bufferPages: true,
            });
            const chunks = [];

            let products = parseProducts(rawProducts);
            if (options.category && str(options.category).toLowerCase() !== 'all') {
                const catLower = str(options.category).toLowerCase();
                products = products.filter(p => p.category.toLowerCase() === catLower);
            }
            const allTxns = parseTransactions(rawTransactions);

            // Determine target year and month (options > latest transaction date > current date)
            let year, month;
            if (options.year !== undefined && options.month !== undefined) {
                year = Number(options.year);
                month = Number(options.month);
            } else {
                // Find the latest valid transaction date, or fallback to current date
                let latestDate = null;
                for (const t of allTxns) {
                    const d = new Date(t.date);
                    if (!isNaN(d.getTime())) {
                        if (!latestDate || d > latestDate) {
                            latestDate = d;
                        }
                    }
                }
                const targetDate = latestDate || new Date();
                year = targetDate.getFullYear();
                month = targetDate.getMonth();
            }

            const currentMonthTxns = filterByMonth(allTxns, year, month);

            // Previous months: everything before target month
            const currentMonthStart = new Date(year, month, 1);
            const previousTxns = allTxns.filter(t => {
                const d = new Date(t.date);
                return d < currentMonthStart;
            });

            const defaultLogoPath = path.join(__dirname, '..', 'assests', 'LogoPAA.png');
            const logoPath = options.logoPath || defaultLogoPath;
            const resolvedLogo = fs.existsSync(logoPath) ? logoPath : null;

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Split products into groups of MAX_PRODUCTS_PER_PAGE
            const productGroups = [];
            for (let i = 0; i < products.length; i += MAX_PRODUCTS_PER_PAGE) {
                productGroups.push({
                    products: products.slice(i, i + MAX_PRODUCTS_PER_PAGE),
                    startIndex: i,
                });
            }

            // If no products at all, still create one empty page
            if (productGroups.length === 0) {
                productGroups.push({ products: [], startIndex: 0 });
            }

            const totalPages = productGroups.length;

            for (let pg = 0; pg < productGroups.length; pg++) {
                if (pg > 0) {
                    doc.addPage({ size: 'A4', layout: 'landscape', margin: MARGIN });
                }

                drawProductGroupPages(
                    doc,
                    products,
                    productGroups[pg].products,
                    productGroups[pg].startIndex,
                    currentMonthTxns,
                    previousTxns,
                    resolvedLogo,
                    pg + 1,
                    totalPages
                );
            }

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = { generateRegisterPDF };