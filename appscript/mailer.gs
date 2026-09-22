const QR_FOLDER   = "keli-qr-codes"; // Must match Drive folder name exactly
const DELAY_MS    = 300;             // ms between emails — increase to 500 if failing

// ════════════════════════════════════════════════════════════════════
// DEDICATED FUNCTIONS — Select any of these from the top dropdown
// ════════════════════════════════════════════════════════════════════

function sendYear1() { processTabByName("Year "); }
function sendYear2() { processTabByName("Year 2"); }
function sendYear3() { processTabByName("Year 3"); }
function sendYear4() { processTabByName("Year 4"); }
function sendYear5() { processTabByName("Year 5"); }

// ════════════════════════════════════════════════════════════════════

/**
 * Creates a custom menu in Google Sheets header toolbar
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 KELI Mailer")
    .addItem("Process Year 1", "sendYear1")
    .addItem("Process Year 2", "sendYear2")
    .addItem("Process Year 3", "sendYear3")
    .addItem("Process Year 4", "sendYear4")
    .addItem("Process Year 5", "sendYear5")
    .addSeparator()
    .addItem("Send Ticket for Selected Row Only", "sendSelectedRow")
    .addToUi();
}

/**
 * Core processing function for a named sheet tab
 */
function processTabByName(tabName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(tabName);

  if (!sheet) {
    // Try case-insensitive or partial matching if exact match fails
    const sheets = ss.getSheets();
    sheet = sheets.find(s => s.getName().toLowerCase().trim() === tabName.toLowerCase().trim());
  }

  if (!sheet) {
    throw new Error(`Sheet tab '${tabName}' not found in Google Sheets. Available tabs: ` +
      ss.getSheets().map(s => `'${s.getName()}'`).join(", "));
  }

  Logger.log(`Starting email batch for sheet tab: '${sheet.getName()}'`);

  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());

  // Automatically create missing status tracking headers if they don't exist yet
  let statusCol = headers.indexOf("mail_status");
  let sentAtCol = headers.indexOf("mail_sent_at");

  if (statusCol === -1) {
    statusCol = headers.length;
    sheet.getRange(1, statusCol + 1).setValue("mail_status");
    headers.push("mail_status");
  }

  if (sentAtCol === -1) {
    sentAtCol = headers.length;
    sheet.getRange(1, sentAtCol + 1).setValue("mail_sent_at");
    headers.push("mail_sent_at");
  }

  // Force Google Sheets UI to display status columns immediately
  SpreadsheetApp.flush();

  const C = {
    name:   headers.indexOf("Name"),
    email:  headers.indexOf("Email"),
    day1:   headers.indexOf("day1"),
    day2:   headers.indexOf("day2"),
    status: statusCol,
    sentAt: sentAtCol,
  };

  const missing = Object.entries(C).filter(([k, v]) => v === -1).map(([k]) => k);
  if (missing.length) throw new Error(`Missing required columns in '${sheet.getName()}': ` + missing.join(", "));

  const folderIter = DriveApp.getFoldersByName(QR_FOLDER);
  if (!folderIter.hasNext())
    throw new Error(`Drive folder '${QR_FOLDER}' not found. Create it and upload QR PNGs.`);
  const qrFolder = folderIter.next();

  let sent = 0, failed = 0, skipped = 0;

  for (let i = 1; i < data.length; i++) {
    const row    = data[i];
    const status = String(row[C.status] || "").trim();

    if (status === "sent") { skipped++; continue; }

    const name   = String(row[C.name]  || "").trim();
    const email  = String(row[C.email] || "").trim();
    const day1Id = String(row[C.day1]  || "").trim();
    const day2Id = String(row[C.day2]  || "").trim();

    if (!name || !email || !day1Id || !day2Id) {
      sheet.getRange(i + 1, C.status + 1).setValue("failed: missing data");
      SpreadsheetApp.flush();
      failed++; continue;
    }

    try {
      const day1QR = getQR(qrFolder, day1Id);
      const day2QR = getQR(qrFolder, day2Id);

      const html = HtmlService.createTemplateFromFile("template");
      html.studentName = name;
      html.day1Id      = day1Id;
      html.day2Id      = day2Id;
      const body = html.evaluate().getContent();

      GmailApp.sendEmail(
        email,
        "KELI 2026 - Your Pro-Show Tickets",
        `Hi ${name}, your KELI 2026 tickets are attached. Day 1: ${day1Id} | Day 2: ${day2Id}`,
        { htmlBody: body, attachments: [day1QR, day2QR], name: "KELI 2026" }
      );

      sheet.getRange(i + 1, C.status + 1).setValue("sent");
      sheet.getRange(i + 1, C.sentAt  + 1).setValue(new Date().toISOString());
      SpreadsheetApp.flush(); // Instant real-time UI refresh in Google Sheets!
      sent++;

    } catch (e) {
      sheet.getRange(i + 1, C.status + 1).setValue("failed: " + e.message);
      SpreadsheetApp.flush();
      Logger.log(`ROW ${i + 1} FAILED in '${sheet.getName()}' — ${email}: ${e.message}`);
      failed++;
    }

    Utilities.sleep(DELAY_MS);
  }

  Logger.log(`Finished '${sheet.getName()}'. Sent: ${sent} | Failed: ${failed} | Skipped: ${skipped}`);
}

/**
 * Sends a single ticket for whichever row your cursor is currently highlighting in Google Sheets
 */
function sendSelectedRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const activeRange = sheet.getActiveRange();
  if (!activeRange) {
    SpreadsheetApp.getUi().alert("Please click on a student row first!");
    return;
  }
  const rowNum = activeRange.getRow();
  if (rowNum <= 1) {
    SpreadsheetApp.getUi().alert("Row 1 is the header! Please select a student row (Row 2 or below).");
    return;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  let statusCol = headers.indexOf("mail_status");
  let sentAtCol = headers.indexOf("mail_sent_at");

  if (statusCol === -1) {
    statusCol = headers.length;
    sheet.getRange(1, statusCol + 1).setValue("mail_status");
    headers.push("mail_status");
  }
  if (sentAtCol === -1) {
    sentAtCol = headers.length;
    sheet.getRange(1, sentAtCol + 1).setValue("mail_sent_at");
    headers.push("mail_sent_at");
  }
  SpreadsheetApp.flush();

  const C = {
    name:   headers.indexOf("Name"),
    email:  headers.indexOf("Email"),
    day1:   headers.indexOf("day1"),
    day2:   headers.indexOf("day2"),
    status: statusCol,
    sentAt: sentAtCol,
  };

  const folderIter = DriveApp.getFoldersByName(QR_FOLDER);
  if (!folderIter.hasNext()) throw new Error(`Drive folder '${QR_FOLDER}' not found.`);
  const qrFolder = folderIter.next();

  const row = data[rowNum - 1];
  const name = String(row[C.name] || "").trim();
  const email = String(row[C.email] || "").trim();
  const day1Id = String(row[C.day1] || "").trim();
  const day2Id = String(row[C.day2] || "").trim();

  try {
    const day1QR = getQR(qrFolder, day1Id);
    const day2QR = getQR(qrFolder, day2Id);
    const html = HtmlService.createTemplateFromFile("template");
    html.studentName = name;
    html.day1Id = day1Id;
    html.day2Id = day2Id;
    const body = html.evaluate().getContent();

    GmailApp.sendEmail(
      email,
      "KELI 2026 - Your Pro-Show Tickets",
      `Hi ${name}, your KELI 2026 tickets are attached. Day 1: ${day1Id} | Day 2: ${day2Id}`,
      { htmlBody: body, attachments: [day1QR, day2QR], name: "KELI 2026" }
    );

    sheet.getRange(rowNum, C.status + 1).setValue("sent");
    sheet.getRange(rowNum, C.sentAt + 1).setValue(new Date().toISOString());
    SpreadsheetApp.flush();
    SpreadsheetApp.getUi().alert(`✓ Ticket sent successfully for ${name} (Row ${rowNum})!`);
  } catch (e) {
    sheet.getRange(rowNum, C.status + 1).setValue("failed: " + e.message);
    SpreadsheetApp.flush();
    SpreadsheetApp.getUi().alert(`✗ Failed to send ticket for ${name}: ${e.message}`);
  }
}

function getQR(folder, ticketId) {
  const files = folder.getFilesByName(ticketId + ".png");
  if (!files.hasNext()) throw new Error(`QR not found in Drive: ${ticketId}.png`);
  return files.next().getBlob().setName(ticketId + ".png");
}
