/* src/utils/generateAllTimesheetsZip.ts */
/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  format,
  getDaysInMonth,
  startOfMonth,
  eachDayOfInterval,
  isSunday,
} from "date-fns";

export interface AttendanceRecord {
  date: string; // ISO date
  status: number; // 1 full, 0.5 half, 0 absent
  workingHours: number;
  otHours: number;
  site: { siteRefName: string };
}

export interface SalaryRecord {
  _id: string;
  givenName: string;
  surname: string;
  employNo: string;
  basicSalary: number;
  allowance: number;
  totalSalary: number;
  totalOtAed: number;
  absentDeduction: number;
  advance: number;
  totalSalaryPayable: number;
  perDayAed: number;
  otAedPerHrNormal: number;
  otAedPerHrSunday: number;
  attendance?: AttendanceRecord[];
}

export const downloadAllTimesheetsAsZip = async (
  records: SalaryRecord[],
  monthDisplay: string,
  monthValue: string,
  companyName = "AL FAHEEM ELECTROMECHANICAL WORKS"
) => {
  const zip = new JSZip();

  for (const record of records) {
    // Landscape A4
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(companyName, 148, 12, { align: "center" });

    doc.setFontSize(14);
    doc.text(`Time Sheet    Month of ${monthDisplay}`, 148, 18, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${record.givenName} ${record.surname}`, 12, 26);
    doc.text(`Emp No: ${record.employNo}`, 12, 31);

    // Prepare attendance mapping
    const start = startOfMonth(new Date(monthValue + "-01"));
    const daysInMonth = getDaysInMonth(start);
    const days = eachDayOfInterval({
      start,
      end: new Date(start.getFullYear(), start.getMonth(), daysInMonth),
    });

    const attendanceMap = new Map<string, AttendanceRecord[]>();
    (record.attendance || []).forEach((a) => {
      const dKey = a.date.split("T")[0];
      if (!attendanceMap.has(dKey)) attendanceMap.set(dKey, []);
      attendanceMap.get(dKey)!.push(a);
    });

    const calendarData = days.flatMap((day) => {
      const key = format(day, "yyyy-MM-dd");
      const recs = attendanceMap.get(key);
      if (recs && recs.length > 0) {
        // Filter out legacy dummy 0-hour absent records IF there is at least one valid record today
        const validRecs = recs.some(r => (r.workingHours || 0) > 0 || (r.otHours || 0) > 0) 
            ? recs.filter(r => (r.workingHours || 0) > 0 || (r.otHours || 0) > 0) 
            : recs;

        return validRecs.map(rec => {
          const normal = rec.workingHours || 0;
          const ot = rec.otHours || 0;
          return {
            project: rec.status === 0 ? "Absent" : (rec.site?.siteRefName || "-"),
            date: format(day, "d-MMM-yy"),
            normal,
            ot,
            total: normal + ot,
            isSunday: isSunday(day),
          };
        });
      } else {
        return [{
          project: isSunday(day) ? "Sunday" : "Absent",
          date: format(day, "d-MMM-yy"),
          normal: 0,
          ot: 0,
          total: 0,
          isSunday: isSunday(day),
        }];
      }
    });

    // Single long table
    const body = calendarData.map((d) => {
      const projectCell =
        d.project === "Sunday"
          ? { content: d.project, styles: { fillColor: [255, 220, 220], textColor: 150 } }
          : d.project === "Absent"
          ? { content: d.project, styles: { textColor: [200, 0, 0] } }
          : { content: d.project };
      return [projectCell, d.date, d.normal, d.ot, d.total];
    });

    autoTable(doc, {
      startY: 38,
      head: [["Project Name", "Date", "Normal Duty", "OT", "Total"]],
      body,
      theme: "grid",
      headStyles: { fillColor: [230, 230, 230], textColor: 0, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25, halign: "center" },
        3: { cellWidth: 25, halign: "center" },
        4: { cellWidth: 25, halign: "center" },
      },
      margin: { left: 12, right: 12 },
    });

    // Totals
    const totalNormal = calendarData.reduce((s, r) => s + (r.normal || 0), 0);
    const totalOt = calendarData.reduce((s, r) => s + (r.ot || 0), 0);
    const totalAbsent = calendarData.filter((r) => r.project === "Absent").length;
    const subTotal = totalNormal + totalOt;

    const yPos = (doc as any).lastAutoTable?.finalY ?? 50;
    const leftX = 12;
    let totalsY = yPos + 4;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Total HR Normal", leftX, totalsY);
    doc.text(String(totalNormal), leftX + 60, totalsY, { align: "right" });

    totalsY += 6;
    doc.text("Total HR OT", leftX, totalsY);
    doc.text(String(totalOt), leftX + 60, totalsY, { align: "right" });

    totalsY += 6;
    doc.setFillColor(220, 0, 0);
    doc.rect(leftX, totalsY - 4, 70, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("Sub Total HR", leftX + 2, totalsY + 1.5);
    doc.text(String(subTotal), leftX + 60, totalsY + 1.5, { align: "right" });
    doc.setTextColor(0, 0, 0);

    totalsY += 10;
    doc.text("Total Absent(Days)", leftX, totalsY);
    doc.text(String(totalAbsent), leftX + 60, totalsY, { align: "right" });

    // Rev & Remarks
    doc.setFontSize(9);
    doc.text("Remarks :", 200, totalsY - 4);

    // Salary summary box
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);

    // Signature
    const sigY = 150;
    doc.setFontSize(10);
    doc.text("Authorized Signature ___________________", 220, sigY);

    const pdfBlob = doc.output("blob");
    const safeName = `${record.employNo}_${record.givenName}_${record.surname}`.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    );

    zip.file(`Timesheet_${safeName}_${monthValue}.pdf`, pdfBlob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  saveAs(zipBlob, `All_Timesheets_${monthValue}.zip`);
};
