const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generates an invoice PDF for a payment
 * @param {Object} payment - The payment object from DB
 * @param {Object} resident - The resident object
 * @param {Object} hostel - The hostel object
 */
const generateInvoicePDF = (payment, resident, hostel) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      let buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        let pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // ── Header ─────────────────────────────────────────────────────────────────
      doc
        .fillColor('#444444')
        .fontSize(20)
        .text(hostel.hostelName, 110, 57)
        .fontSize(10)
        .text(hostel.address || 'Hostel Address Not Available', 110, 80)
        .text(`${hostel.city || ''}, ${hostel.state || ''}`, 110, 95)
        .moveDown();

      // ── Invoice Details ────────────────────────────────────────────────────────
      doc
        .fillColor('#444444')
        .fontSize(20)
        .text('INVOICE', 50, 160);

      generateHr(doc, 185);

      const customerInformationTop = 200;

      doc
        .fontSize(10)
        .text('Invoice Number:', 50, customerInformationTop)
        .font('Helvetica-Bold')
        .text(payment.paymentId, 150, customerInformationTop)
        .font('Helvetica')
        .text('Invoice Date:', 50, customerInformationTop + 15)
        .text(new Date().toLocaleDateString(), 150, customerInformationTop + 15)
        .text('Amount Due:', 50, customerInformationTop + 30)
        .text(
          `INR ${payment.amount.toLocaleString()}`,
          150,
          customerInformationTop + 30
        )

        .font('Helvetica-Bold')
        .text(resident.fullName, 300, customerInformationTop)
        .font('Helvetica')
        .text(resident.email, 300, customerInformationTop + 15)
        .text(
          `Resident ID: ${resident.residentId}`,
          300,
          customerInformationTop + 30
        )
        .moveDown();

      generateHr(doc, 252);

      // ── Invoice Items ──────────────────────────────────────────────────────────
      const invoiceTableTop = 330;

      doc.font('Helvetica-Bold');
      generateTableRow(
        doc,
        invoiceTableTop,
        'Description',
        'Quantity',
        'Price',
        'Total'
      );
      generateHr(doc, invoiceTableTop + 20);
      doc.font('Helvetica');

      const description = `Hostel Fee - ${payment.forPeriod?.frequencyType || 'Monthly'}`;
      generateTableRow(
        doc,
        invoiceTableTop + 30,
        description,
        '1',
        `INR ${payment.amount.toLocaleString()}`,
        `INR ${payment.amount.toLocaleString()}`
      );

      generateHr(doc, invoiceTableTop + 56);

      const subtotalPosition = invoiceTableTop + 70;
      generateTableRow(
        doc,
        subtotalPosition,
        '',
        '',
        'Subtotal',
        `INR ${payment.amount.toLocaleString()}`
      );

      const paidToDatePosition = subtotalPosition + 20;
      generateTableRow(
        doc,
        paidToDatePosition,
        '',
        '',
        'Amount Paid',
        `INR ${payment.amountPaid.toLocaleString()}`
      );

      const duePosition = paidToDatePosition + 25;
      doc.font('Helvetica-Bold');
      generateTableRow(
        doc,
        duePosition,
        '',
        '',
        'Balance Due',
        `INR ${(payment.amount - payment.amountPaid).toLocaleString()}`
      );
      doc.font('Helvetica');

      // ── Footer ─────────────────────────────────────────────────────────────────
      doc
        .fontSize(10)
        .text(
          'Payment is due within 15 days. Thank you for your stay at NestRoom.',
          50,
          700,
          { align: 'center', width: 500 }
        );

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
};

function generateHr(doc, y) {
  doc
    .strokeColor('#aaaaaa')
    .lineWidth(1)
    .moveTo(50, y)
    .lineTo(550, y)
    .stroke();
}

function generateTableRow(doc, y, item, description, unitCost, quantity, lineTotal) {
  doc
    .fontSize(10)
    .text(item, 50, y)
    .text(description, 150, y)
    .text(unitCost, 280, y, { width: 90, align: 'right' })
    .text(quantity, 370, y, { width: 90, align: 'right' })
    .text(lineTotal, 0, y, { align: 'right' });
}

module.exports = { generateInvoicePDF };
