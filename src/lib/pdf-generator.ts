import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Funcionario } from "../context/OfficialsContext";

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

/**
 * Interface for the programming data required to generate the PDF
 */
export interface PDFProgrammingData {
  funcionario: Funcionario;
  selectedPeriod: { name: string; id: number } | null;
  activityEntries: Array<{
    activity: string;
    specialty: string;
    assignedHours: string;
    performance: string;
  }>;
  timeUnit: "hours" | "minutes";
  prais: string;
  currentOfficialStatus: string;
  assignedGroupId: number | string | null;
  groups: Array<{ id: number; name: string }>;
  totalContractHours: number;
  contractHoursDisplayText: string;
  totalScheduledHours: number;
  availableHoursFormatted: number;
  observations: string;
  globalSpecialty: string;
  selectedProcess: string;
  selectedPerformanceUnit: string;
}

/**
 * Configuration for PDF design and styles
 */
const PDF_CONFIG = {
  colors: {
    primary: [79, 70, 229] as [number, number, number],
    text: {
      black: 0,
      darkGray: 80,
      lightGray: 100,
      silver: 150,
      blue: [79, 70, 229] as [number, number, number],
    },
    status: {
      negative: [220, 38, 38] as [number, number, number],
      zero: [22, 163, 74] as [number, number, number],
      positive: [202, 138, 4] as [number, number, number],
    },
    background: {
      light: 248,
      border: 220,
    }
  },
  fonts: {
    title: 18,
    sectionHeader: 9,
    content: 8,
    small: 7.5,
    tiny: 7,
  },
  margins: {
    page: 15,
    top: 20,
    boxPadding: 4,
    rowHeight: 4.5,
  }
};

/**
 * Utility to format lunch time for display
 */
const formatLunchTime = (lunchStr: string, timeUnit: "hours" | "minutes") => {
  const minutes = parseInt(lunchStr);
  if (isNaN(minutes)) return lunchStr;
  
  if (timeUnit === "hours") {
    const hrs = minutes / 60;
    return `${hrs % 1 === 0 ? hrs : hrs.toFixed(1)} hrs.`;
  }
  return `${minutes} min`;
};

/**
 * Utility to calculate agenda and annual quotas
 */
const calculateCupos = (assignedHours: string, performance: string, timeUnit: "hours" | "minutes") => {
  const hours = parseFloat(assignedHours) || 0;
  const perf = parseFloat(performance) || 0;
  const effectiveHours = timeUnit === "minutes" ? hours / 60 : hours;
  
  const agenda = effectiveHours * perf;
  const annual = agenda * 4 * 12;
  
  return {
    agenda: Number.isInteger(agenda) ? agenda : agenda.toFixed(1),
    annual: Number.isInteger(annual) ? annual : annual.toFixed(0)
  };
};

/**
 * Main function to generate and save the programming PDF
 * @param data The programming and official data
 */
export const generateProgrammingPDF = (data: PDFProgrammingData) => {
  const { 
    funcionario, 
    selectedPeriod, 
    activityEntries, 
    timeUnit, 
    prais, 
    currentOfficialStatus, 
    assignedGroupId, 
    groups,
    contractHoursDisplayText,
    totalScheduledHours,
    availableHoursFormatted,
    observations,
    globalSpecialty,
    selectedProcess,
    selectedPerformanceUnit
  } = data;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const { margins, colors, fonts } = PDF_CONFIG;
  
  let yPos = margins.top;
  
  /**
   * Draws the header on each page
   */
  const drawHeader = () => {
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 5, 'F');
    
    doc.setFontSize(fonts.content);
    doc.setTextColor(colors.text.silver);
    doc.text(`Generado el: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, pageWidth - margins.page, 12, { align: 'right' });
    doc.text("Sistema de Programación de Funcionarios", margins.page, 12);
    
    doc.setTextColor(colors.text.black);
  };
  
  /**
   * Draws the footer with pagination
   */
  const drawFooter = (pageNo: number, totalPages: number) => {
    doc.setFontSize(fonts.content);
    doc.setTextColor(colors.text.silver);
    doc.line(margins.page, pageHeight - 15, pageWidth - margins.page, pageHeight - 15);
    doc.text(`Página ${pageNo} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  };

  drawHeader();

  // Title Section
  doc.setFontSize(fonts.title);
  doc.setFont("helvetica", "bold");
  doc.text("Ficha de Programación", margins.page, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Periodo: ${selectedPeriod?.name || "N/A"}`, margins.page, yPos);
  yPos += 4.2; // Reduced from 5 to approx 12pt (4.2mm)

  // Funcionario Info Box
  const boxStartY = yPos;
  doc.setFontSize(fonts.content);
  
  const infoStartY = boxStartY + margins.boxPadding;
  let infoY = infoStartY;
  
  const col1X = margins.page + 5;
  const col2X = margins.page + 115; 
  const labelWidth = 35;
  
  doc.setFontSize(fonts.sectionHeader);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.text.blue);
  doc.text("Información del Funcionario", col1X, infoY);
  infoY += 6;
  
  doc.setFontSize(fonts.content);
  doc.setTextColor(colors.text.black);

  /**
   * Helper to calculate row height
   */
  const calculateRowHeight = (value: string, maxWidth: number = 65): number => {
    const textWidth = doc.getTextWidth(value);
    if (textWidth > maxWidth) {
      const splitText = doc.splitTextToSize(value, maxWidth);
      return (splitText.length * 3.2) + 1.2;
    }
    return margins.rowHeight;
  };

  /**
   * Helper to draw a label-value row with automatic text wrapping
   */
  const drawRow = (label: string, value: string, x: number, y: number, maxWidth: number = 65): number => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(colors.text.darkGray);
    doc.text(label, x, y);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(colors.text.black);
    
    const valX = x + labelWidth;
    const textWidth = doc.getTextWidth(value);
    
    if (textWidth > maxWidth) {
      const splitText = doc.splitTextToSize(value, maxWidth);
      doc.text(splitText, valX, y);
      return (splitText.length * 3.2) + 1.2;
    } else {
      doc.text(value, valX, y);
      return margins.rowHeight;
    }
  };

  // Calculate box height through PRECISE simulation using the same logic as drawRow
  doc.setFont("helvetica", "normal"); // Ensure correct font for width calculation
  let simY1 = infoY;
  simY1 += calculateRowHeight(funcionario.name, 55);
  simY1 += calculateRowHeight(funcionario.rut);
  simY1 += calculateRowHeight(funcionario.title, 55);
  simY1 += calculateRowHeight(funcionario.law);
  simY1 += calculateRowHeight(prais || "No");
  
  let simY2 = infoY;
  
  let hoursDisplay = contractHoursDisplayText;
  if (!hoursDisplay.includes("hrs") && !hoursDisplay.includes("min")) hoursDisplay += " hrs.";
  
  // Available width for Col 2 values: PageWidth(210) - Margin(15) - Col2X(130) - LabelWidth(35) = 30
  // We use a slightly larger limit (35) to avoid aggressive wrapping on short words, but risk slight margin overflow.
  // Ideally should be 30.
  const col2MaxWidth = 35; 

  simY2 += calculateRowHeight(hoursDisplay, col2MaxWidth);
  
  const groupName = assignedGroupId && assignedGroupId !== "none" 
    ? groups.find(g => g.id === assignedGroupId)?.name || "Ninguno"
    : "Ninguno";
  simY2 += calculateRowHeight(groupName, col2MaxWidth);
  
  const isMedical = funcionario.title === "Médico(a) Cirujano(a)" || funcionario.title === "Medico Cirujano";
  if (isMedical) {
    simY2 += calculateRowHeight(funcionario.sisSpecialty || "-", col2MaxWidth);
  }
  
  simY2 += calculateRowHeight(currentOfficialStatus, col2MaxWidth);

  const finalBoxHeight = Math.max(simY1, simY2) - infoY + 20; // Increased padding to 15 (approx 5mm bottom padding)
  
  // Draw Background Box
  doc.setDrawColor(colors.background.border);
  doc.setFillColor(colors.background.light, 250, 252); 
  doc.roundedRect(margins.page, boxStartY, pageWidth - (margins.page * 2), finalBoxHeight, 3, 3, "FD");
  
  // Re-draw titles and content over the box
  doc.setFontSize(fonts.sectionHeader);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...colors.text.blue);
  doc.text("Información del Funcionario", col1X, infoY);
  
  let currentY1 = infoY + 6;
  let currentY2 = infoY + 6;
  
  currentY1 += drawRow("Nombre:", funcionario.name, col1X, currentY1, 55);
  currentY1 += drawRow("RUT:", funcionario.rut, col1X, currentY1);
  currentY1 += drawRow("Título:", funcionario.title, col1X, currentY1, 55);
  currentY1 += drawRow("Ley:", funcionario.law, col1X, currentY1);
  currentY1 += drawRow("Atención PRAIS:", prais || "No", col1X, currentY1);

  currentY2 += drawRow("Horas Contrato:", hoursDisplay, col2X, currentY2, col2MaxWidth);
  currentY2 += drawRow("Grupo:", groupName, col2X, currentY2, col2MaxWidth);
  if (isMedical) {
    currentY2 += drawRow("Especialidad SIS:", funcionario.sisSpecialty || "-", col2X, currentY2, col2MaxWidth);
  }
  currentY2 += drawRow("Estado Asignado:", currentOfficialStatus, col2X, currentY2, col2MaxWidth);

  const contentEndY = Math.max(currentY1, currentY2);
  yPos = Math.max(boxStartY + finalBoxHeight + 5, contentEndY + 5);

  // Config Summary Section
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.text.black);
  doc.text("Configuración de Programación", margins.page, yPos);
  yPos += 5;
  
  const configData = [];
  if (globalSpecialty && isMedical) {
    configData.push(["Especialidad Principal", globalSpecialty]);
  }
  if (selectedProcess && !isMedical) {
    configData.push(["Proceso", selectedProcess]);
  }
  if (selectedPerformanceUnit) configData.push(["Unidad de Desempeño", selectedPerformanceUnit]);
  
  const docWithTables = doc as JsPdfWithAutoTable;

  if (configData.length > 0) {
    autoTable(doc, {
      startY: yPos,
      body: configData,
      theme: 'plain',
      styles: { fontSize: 7.5, cellPadding: 0.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { cellWidth: 'auto' } },
      margin: { left: margins.page, right: margins.page }
    });
    yPos = (docWithTables.lastAutoTable?.finalY ?? yPos) + 6;
  } else {
    yPos += 3;
  }

  // Activities Table Section
  const validEntries = activityEntries.filter(e => e.assignedHours && parseFloat(e.assignedHours) > 0);
  
  if (validEntries.length > 0) {
    const tableData = validEntries.map(entry => {
      const cupos = calculateCupos(entry.assignedHours, entry.performance, timeUnit);
      const val = parseFloat(entry.assignedHours);
      const unitLabel = timeUnit === "hours" 
        ? (val === 1 ? "hr" : "hrs") 
        : (val === 1 ? "min" : "mins");
      
      const row = [
        entry.activity,
        `${entry.assignedHours} ${unitLabel}`,
        entry.performance || "-",
        cupos.agenda,
        cupos.annual
      ];

      if (isMedical) {
        row.splice(1, 0, entry.specialty || "-");
      }

      return row;
    });
    
    const headers = isMedical 
      ? [['Actividad', 'Especialidad', 'Horas', 'Rend.', 'Cupos Agenda', 'Cupos Anuales']]
      : [['Actividad', 'Horas', 'Rend.', 'Cupos Agenda', 'Cupos Anuales']];

    autoTable(doc, {
      startY: yPos,
      head: headers,
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: colors.primary, textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
      styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
      columnStyles: isMedical ? {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 40 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 25, halign: 'center' }
      } : {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' }
      },
      margin: { left: margins.page, right: margins.page },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) drawHeader();
      }
    });
    yPos = (docWithTables.lastAutoTable?.finalY ?? yPos) + 8;
  } else {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(colors.text.silver);
    doc.text("No hay actividades programadas.", margins.page, yPos);
    yPos += 8;
  }

  // Totals and Summary Section
  if (yPos + 25 > pageHeight) {
    doc.addPage();
    yPos = 20;
    drawHeader();
  }

  doc.setDrawColor(200);
  doc.line(margins.page, yPos, pageWidth - margins.page, yPos);
  yPos += 4;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(colors.text.black);
  doc.text("Resumen de Horas", margins.page, yPos);
  yPos += 5;

  const summaryX = pageWidth - margins.page - 60;
  
  doc.setFontSize(7.5);
  doc.text("Total Contrato:", summaryX, yPos);
  doc.text(hoursDisplay, pageWidth - margins.page, yPos, { align: 'right' });
  yPos += 4;
  
  const progHours = Math.round(totalScheduledHours * 10) / 10;
  doc.text("Total Programado:", summaryX, yPos);
  doc.text(`${progHours} ${progHours === 1 ? 'hr' : 'hrs'}`, pageWidth - margins.page, yPos, { align: 'right' });
  yPos += 4;
  
  doc.text("Colación:", summaryX, yPos);
  doc.text(`${formatLunchTime(funcionario.lunchTime, timeUnit)}`, pageWidth - margins.page, yPos, { align: 'right' });
  yPos += 5;
  
  doc.setLineWidth(0.5);
  doc.line(summaryX, yPos, pageWidth - margins.page, yPos);
  yPos += 4;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Disponibles:", summaryX, yPos);
  
  const availColor = availableHoursFormatted < 0 ? colors.status.negative : (Math.abs(availableHoursFormatted) < 0.01 ? colors.status.zero : colors.status.positive);
  doc.setTextColor(...availColor);
  doc.text(`${availableHoursFormatted} hrs`, pageWidth - margins.page, yPos, { align: 'right' });
  
  yPos += 10;

  // Observations Section
  if (observations) {
    if (yPos + 20 > pageHeight) {
      doc.addPage();
      yPos = 20;
      drawHeader();
    }
    
    doc.setTextColor(colors.text.black);
    doc.setFont("helvetica", "bold");
    doc.text("Observaciones:", margins.page, yPos);
    yPos += 4;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    
    const splitObs = doc.splitTextToSize(observations, pageWidth - (margins.page * 2));
    doc.text(splitObs, margins.page, yPos);
  }
  
  // Signatures Section
  let sigY = pageHeight - 40;
  if (yPos > sigY - 20) {
    doc.addPage();
    drawHeader();
    sigY = pageHeight - 40;
  }
  
  doc.setDrawColor(colors.text.silver);
  doc.line(margins.page + 20, sigY, margins.page + 80, sigY);
  doc.line(pageWidth - margins.page - 80, sigY, pageWidth - margins.page - 20, sigY);
  
  doc.setFontSize(fonts.tiny);
  doc.setTextColor(colors.text.lightGray);
  doc.text("Firma Funcionario", margins.page + 50, sigY + 5, { align: 'center' });
  doc.text("Firma Jefatura", pageWidth - margins.page - 50, sigY + 5, { align: 'center' });

  // Apply footers to all pages
  const totalPages = doc.getNumberOfPages();
  for(let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  doc.save(`Ficha_Programacion_${funcionario.rut}.pdf`);
};
