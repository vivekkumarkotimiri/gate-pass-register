// public/js/export-pdf.js
// ------------------------------------------------------------------
// Shared PDF export logic used by both public.js and admin.js.
// Fetches gate passes filtered by date range from the API and
// generates a downloadable PDF using jsPDF + AutoTable.
// ------------------------------------------------------------------

async function exportToPDF() {
  const fromDate = document.getElementById("fromDate").value;
  const toDate   = document.getElementById("toDate").value;

  if (!fromDate || !toDate) {
    alert("Please select both From and To dates before exporting.");
    return;
  }
  if (fromDate > toDate) {
    alert("From date cannot be after To date.");
    return;
  }

  // Fetch all entries (no pagination limit) then filter by date range client-side
  const res  = await fetch("/api/gatepasses");
  const data = await res.json();

  const filtered = data.filter((e) => e.entry_date >= fromDate && e.entry_date <= toDate);

  if (!filtered.length) {
    alert(`No gate pass entries found between ${fromDate} and ${toDate}.`);
    return;
  }

  // ---- Build PDF ----
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Gate Pass Register", 148, 14, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Date Range: ${fromDate}  to  ${toDate}`, 148, 21, { align: "center" });
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 148, 27, { align: "center" });
  doc.text(`Total entries: ${filtered.length}`, 148, 33, { align: "center" });

  // Table
  doc.autoTable({
    startY: 38,
    head: [[
      "Gate Pass No.",
      "Date",
      "Material",
      "Technician",
      "Contact No.",
      "Type",
      "Address",
      "Purpose",
      "Status",
    ]],
    body: filtered.map((e) => [
      e.gate_pass_no,
      e.entry_date,
      e.material_name,
      e.technician  || "—",
      e.number      || "—",
      e.return_type,
      e.address,
      e.purpose,
      e.status,
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
    },
    headStyles: {
      fillColor: [27, 42, 65],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [244, 239, 227],
    },
    columnStyles: {
      0: { cellWidth: 28 },  // Gate Pass No.
      1: { cellWidth: 22 },  // Date
      2: { cellWidth: 35 },  // Material
      3: { cellWidth: 28 },  // Technician
      4: { cellWidth: 25 },  // Contact
      5: { cellWidth: 28 },  // Type
      6: { cellWidth: 40 },  // Address
      7: { cellWidth: 25 },  // Purpose
      8: { cellWidth: 18 },  // Status
    },
    didDrawCell: (hookData) => {
      // Colour the Status cell text
      if (hookData.section === "body" && hookData.column.index === 8) {
        const status = hookData.cell.raw;
        doc.setTextColor(status === "Open" ? 63 : 156, status === "Open" ? 107 : 61, status === "Open" ? 77 : 52);
      }
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 8) {
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Footer on every page
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${totalPages}`,
      doc.internal.pageSize.getWidth() - 10,
      doc.internal.pageSize.getHeight() - 8,
      { align: "right" }
    );
  }

  doc.save(`GatePass_${fromDate}_to_${toDate}.pdf`);
}