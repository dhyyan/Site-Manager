import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { SalaryRecord } from "@/types";

// Import Logos
import alfaheemLogo from "@/images/alfaheem.jpg";
import dafLogo from "@/images/daf.jpg";
import mazayaLogo from "@/images/mazaya.jpg";

interface PdfSalaryRecord extends SalaryRecord {
  totalDue?: number;
}

export const generatePayslipPDF = async (
  record: PdfSalaryRecord,
  month: string,
  companyName = "AL FAHEEM ELECTROMECHANICAL WORKS",
) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Determine Logo and Header Text based on Company Name
  let logoUrl = alfaheemLogo;
  let headerText = "AL FAHEEM ELECTROMECHANICAL WORKS";

  if (companyName === "DAF") {
    logoUrl = dafLogo;
    headerText = "DAF";
  } else if (companyName === "Mazaya Al Madina") {
    logoUrl = mazayaLogo;
    headerText = "Mazaya Al Madina";
  } else {
    // Default fallback to Al Faheem
    logoUrl = alfaheemLogo;
    headerText = "AL FAHEEM ELECTROMECHANICAL WORKS";
  }

  // --- Header Section ---
  // Add Logo (Top Left or Center? Usually Top Left or Center along with text)
  // Let's position Logo Top Left, Text Center.

  // Image: x, y, width, height (Larger size as requested)
  try {
    doc.addImage(logoUrl, "JPEG", 15, 10, 40, 40);
  } catch (err) {
    console.error("Error adding logo:", err);
  }

  // Company Name - Centered
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(headerText, 105, 25, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("PAYSLIP", 105, 35, { align: "center" });

  // Employee Info - Shifted up to reduce gap
  doc.setFontSize(11);
  doc.text(`Employee No: ${record.employNo}`, 20, 53);
  doc.text(`Name: ${record.givenName} ${record.surname}`, 20, 60);
  doc.text(`Designation: ${record.designation || ''}`, 20, 67);
  doc.text(`Company Name: ${companyName}`, 20, 74);
  doc.text(`Month: ${month}`, 20, 81);

  // Salary Table
  autoTable(doc, {
    startY: 88,
    head: [[
      "Description",
      "Amount (AED)"
    ]],
    body: [
      ["Basic Salary", record.basicSalary.toFixed(2)],
      ["Allowance", record.allowance.toFixed(2)],
      ["Total Salary", record.totalSalary.toFixed(2)],
      ["Total Hours (Incl. OT)", record.totalHrInclOT],
      ["Normal Hours (Excl. OT)", record.normalHrExcOT],
      ["Normal OT (Hrs)", record.normalOtHr],
      ["Sunday OT (Hrs)", record.sundayOtHr],
      ["Normal OT AED/Hr", record.otAedPerHrNormal.toFixed(2)],
      ["Sunday OT AED/Hr", record.otAedPerHrSunday.toFixed(2)],
      ["Total OT AED", record.totalOtAed.toFixed(2)],
      ["Per Day AED", record.perDayAed.toFixed(2)],
      ["Absent (Days)", record.absent],
      ["Absent Deduction", record.absentDeduction.toFixed(2)],
      // Expand Advances
      ...(record.deductedAdvances && record.deductedAdvances.length > 0
        ? record.deductedAdvances.map(adv => [
          `Advance Deduction (${new Date(adv.dateGiven).toLocaleDateString("en-GB")})`,
          adv.amount.toFixed(2)
        ])
        : [["Advance Deducted", (record.advance || 0).toFixed(2)]]), // Fallback if no details
      ["Medical/Petty Cash (Deduction)", (record.otherDeduction || 0).toFixed(2)], // Add Medical/Petty Cash
      ["Pending Advance Balance", (record.advancePending || 0).toFixed(2)], // Add Pending Balance
      ["Current Month Payable", record.totalSalaryPayable.toFixed(2)],
      ["Previous Pending", (record.prevPending || 0).toFixed(2)],
      ["Total Due", (record.totalDue || 0).toFixed(2)],
      ["Paid via WPS", (record.wps || 0).toFixed(2)],
      ["Paid via Cash", (record.cash || 0).toFixed(2)],
      ["Pending c/f", (record.pending || 0).toFixed(2)]
    ],
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185], textColor: [255, 255, 255] },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 20, right: 20 }
  });

  // Footer
  doc.setFontSize(10);
  doc.text("Authorized Signature ___________________________", 20, 270);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 20, 278);

  doc.save(`Payslip_${record.employNo}_${month.replace(/ /g, "_")}.pdf`);
};
