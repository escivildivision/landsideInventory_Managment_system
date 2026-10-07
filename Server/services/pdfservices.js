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

/**
 * Robustly parse a date string that may be in several formats:
 *   - YYYY-MM-DD  (ISO, always safe)
 *   - DD-MMM-YYYY (e.g. 15-Sep-2026) – Google Sheets serial-converted
 *   - DD/MM/YYYY  (e.g. 15/09/2026)
 *   - DD-MM-YYYY  (e.g. 15-09-2026)
 * Falls back to native Date parsing as a last resort.
 * Returns a Date object (may be Invalid Date if nothing worked).
 */
function parseDate(raw) {
    if (!raw) return new Date(NaN);
    const s = String(raw).trim();

    // 1. YYYY-MM-DD  (ISO – always works everywhere)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return new Date(s + 'T00:00:00');
    }

    // 2. DD-MMM-YYYY  e.g. 15-Sep-2026
    const dmyMon = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (dmyMon) {
        const MONTHS = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
        };
        const m = MONTHS[dmyMon[2].toLowerCase()];
        if (m !== undefined) {
            return new Date(Number(dmyMon[3]), m, Number(dmyMon[1]));
        }
    }

    // 3. DD/MM/YYYY  e.g. 15/09/2026
    const dmySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmySlash) {
        return new Date(Number(dmySlash[3]), Number(dmySlash[2]) - 1, Number(dmySlash[1]));
    }

    // 4. DD-MM-YYYY  e.g. 15-09-2026
    const dmyDash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmyDash) {
        return new Date(Number(dmyDash[3]), Number(dmyDash[2]) - 1, Number(dmyDash[1]));
    }

    // 5. Native fallback (may return Invalid Date on Linux for ambiguous strings)
    return new Date(s);
}

/** Filter transactions to a specific month */
function filterByMonth(txns, year, month) {
    return txns.filter(t => {
        const d = parseDate(t.date);
        return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
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

function drawProductGroupPages(doc, allProducts, productGroup, productStartIndex, currentMonthTxns, previousTxns, logoPath, pageNum, totalPages, year, month) {
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
    // Use the passed-in target year/month for the date label
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const firstDayStr = `1-${months[month]}-${year}`;

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

    /* --- Separate opening transactions from the rest & sort by date --- */
    const openingQty = new Array(colCount).fill(0);   // merged opening per column
    const nonOpeningTxns = [];

    // Sort all current-month txns by date ascending first
    const sortedTxns = [...currentMonthTxns].sort((a, b) => {
        const da = parseDate(a.date);
        const db = parseDate(b.date);
        return da - db;
    });

    for (const txn of sortedTxns) {
        const typeStr = (txn.transaction_type || '').toLowerCase();
        const globalIdx = findProductIndex(allProducts, txn);
        const localIdx = globalIdx - productStartIndex;
        if (globalIdx === -1 || localIdx < 0 || localIdx >= colCount) continue;

        if (typeStr === 'opening') {
            openingQty[localIdx] += txn.quantity;
        } else {
            nonOpeningTxns.push(txn);
        }
    }

    /* --- Draw single merged "Opening stock" row --- */
    const hasAnyOpening = openingQty.some(q => q !== 0);
    const totalReceived = new Array(colCount).fill(0);
    const totalIssued = new Array(colCount).fill(0);

    // Add opening amounts into totalReceived so footer balance is correct
    for (let i = 0; i < colCount; i++) {
        totalReceived[i] += openingQty[i];
    }

    if (hasAnyOpening) {
        // Check overflow before drawing
        if (y + dataRowH > maxY) {
            const pageTotal = new Array(colCount).fill(0);
            const pageBalance = new Array(colCount).fill(0);
            for (let i = 0; i < colCount; i++) {
                pageTotal[i] = totalReceived[i] - totalIssued[i];
                pageBalance[i] = prevBalance[i] + totalReceived[i] - totalIssued[i];
            }
            drawPageFooter(doc, colCount, matColW, dateW, descW, leftColsW, pageTotal, pageBalance);
            doc.addPage({ size: 'A4', layout: 'landscape', margin: MARGIN });
            const header = drawPageHeader(doc, productGroup, pageNum, totalPages, logoPath);
            y = header.y;
        }

        drawCell(doc, '', left, y, dateW, dataRowH, { fontSize: 7.5, align: 'center' });
        drawCell(doc, 'Opening stock', left + dateW, y, descW, dataRowH, { fontSize: 7.5, align: 'left' });
        mx = left + leftColsW;
        for (let i = 0; i < colCount; i++) {
            const val = openingQty[i] !== 0 ? String(openingQty[i]) : '';
            drawCell(doc, val, mx, y, matColW, dataRowH, {
                fontSize: 8, bold: Boolean(val), align: 'center',
            });
            mx += matColW;
        }
        y += dataRowH;
    }

    /* --- Group nonOpeningTxns by (date + job_slip_no + transaction_type) --- */
    // Transactions sharing the same date, job slip, and type collapse into one row.
    const rowGroups = [];
    const rowGroupIndex = {}; // key -> index in rowGroups

    for (const txn of nonOpeningTxns) {
        const globalIdx = findProductIndex(allProducts, txn);
        const localIdx = globalIdx - productStartIndex;
        if (globalIdx === -1 || localIdx < 0 || localIdx >= colCount) continue;

        // Key: date|job_slip_no|type  — group these together into one row
        const key = `${txn.date}|${txn.job_slip_no || ''}|${txn.transaction_type}`;
        if (rowGroupIndex[key] === undefined) {
            rowGroupIndex[key] = rowGroups.length;
            rowGroups.push({
                date: txn.date,
                job_slip_no: txn.job_slip_no || '',
                transaction_type: txn.transaction_type,
                remarks: txn.remarks,
                qtys: new Array(colCount).fill(0), // quantity per product column
            });
        }
        const group = rowGroups[rowGroupIndex[key]];
        group.qtys[localIdx] += txn.quantity;
        // carry the first non-empty remark
        if (!group.remarks && txn.remarks) group.remarks = txn.remarks;
    }

    /* --- Data Rows (one row per group) --- */
    for (const group of rowGroups) {
        // Check if we need a new page (vertical overflow)
        if (y + dataRowH > maxY) {
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

        const typeStr = (group.transaction_type || '').toLowerCase();
        const remarksStr = (group.remarks || '').toLowerCase();

        const isReceived = typeStr.includes('received') || remarksStr.includes('received')
            || typeStr.includes('new stock') || remarksStr.includes('new stock');
        const rowFill = isReceived ? '#FFFF00' : null;
        const textColor = isReceived ? redColor : '#000000';

        // Format Job Slip No.
        let jsNoStr = group.job_slip_no;
        if (jsNoStr && !isNaN(Number(jsNoStr))) {
            jsNoStr = String(Number(jsNoStr)).padStart(2, '0');
        }

        // Description
        let desc = group.remarks;
        if (!desc) {
            if (isReceived) {
                desc = jsNoStr ? `Meterial Received vide J.s no ${jsNoStr}` : 'Meterial Received';
            } else {
                desc = jsNoStr ? `Material issued vide J.s no ${jsNoStr}` : 'Material issued';
            }
        } else {
            if (jsNoStr && !desc.toLowerCase().includes('j.s') && !desc.toLowerCase().includes('mb#')) {
                desc = `${desc} vide J.s no ${jsNoStr}`;
            }
        }

        // Track totals for this group's products
        for (let i = 0; i < colCount; i++) {
            if (group.qtys[i] !== 0) {
                if (isReceived) totalReceived[i] += group.qtys[i];
                else totalIssued[i] += group.qtys[i];
            }
        }

        // Draw Date cell
        drawCell(doc, group.date, left, y, dateW, dataRowH, {
            fontSize: 7.5, fill: rowFill, bold: isReceived, color: textColor, align: 'center',
        });

        // Draw Description cell
        drawCell(doc, desc, left + dateW, y, descW, dataRowH, {
            fontSize: 7.5, fill: rowFill, align: 'left', bold: isReceived, color: textColor,
        });

        // Draw Product quantity cells
        mx = left + leftColsW;
        for (let i = 0; i < colCount; i++) {
            const val = group.qtys[i] !== 0 ? String(group.qtys[i]) : '';
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
            });
            const chunks = [];

            let products = parseProducts(rawProducts);
            if (options.category && str(options.category).toLowerCase() !== 'all') {
                const catLower = str(options.category).toLowerCase();
                products = products.filter(p => p.category.toLowerCase() === catLower);
            }
            const allTxns = parseTransactions(rawTransactions);

            // ---- DEBUG LOGGING (safe to keep in production) ----
            console.log('[PDF-DEBUG] rawProducts rows:', (rawProducts || []).length);
            console.log('[PDF-DEBUG] rawTransactions rows:', (rawTransactions || []).length);
            console.log('[PDF-DEBUG] products after parse+filter:', products.length);
            console.log('[PDF-DEBUG] allTxns after parse:', allTxns.length);
            // Show first 5 date strings so we can see the exact format stored in Sheets
            const sampleDates = allTxns.slice(0, 5).map(t => t.date);
            console.log('[PDF-DEBUG] sample date strings:', JSON.stringify(sampleDates));
            // Show what parseDate produces for those samples
            sampleDates.forEach(d => {
                const parsed = parseDate(d);
                console.log(`[PDF-DEBUG]   parseDate("${d}") => ${parsed} | valid=${!isNaN(parsed.getTime())}`);
            });
            // ---- END DEBUG LOGGING ----

            // Determine target year and month:
            // Always use the CURRENT calendar month so that previous-month data
            // (including opening stock entered in past months) goes into
            // "Previous Month Balance", and only the current month's new
            // transactions appear as individual data rows.
            let year, month;
            if (options.year !== undefined && options.month !== undefined) {
                year = Number(options.year);
                month = Number(options.month);
            } else {
                const now = new Date();
                year = now.getFullYear();
                month = now.getMonth();
            }

            console.log(`[PDF-DEBUG] target year=${year} month=${month} (0-based)`);
            const currentMonthTxns = filterByMonth(allTxns, year, month);
            console.log('[PDF-DEBUG] currentMonthTxns:', currentMonthTxns.length);

            // Previous months: everything before target month
            const currentMonthStart = new Date(year, month, 1);
            const previousTxns = allTxns.filter(t => {
                const d = parseDate(t.date);
                return !isNaN(d.getTime()) && d < currentMonthStart;
            });

            // Try multiple base paths to support both local and serverless (Netlify) environments
            const possibleLogoPaths = [
                options.logoPath,
                path.join(__dirname, '..', 'assests', 'LogoPAA.png'),
                path.join(process.cwd(), 'assests', 'LogoPAA.png'),
                path.join(process.cwd(), 'Server', 'assests', 'LogoPAA.png'),
            ].filter(Boolean);
            const resolvedLogo = possibleLogoPaths.find(p => fs.existsSync(p)) || null;

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
                    totalPages,
                    year,
                    month
                );
            }

            doc.end();
            // Note: do NOT call doc.flushPages() when bufferPages is false (default)
            // pages are written to stream immediately as they are added
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = { generateRegisterPDF };