/**
 * =========================================================================
 * PULARI CLUB FEE MANAGEMENT - GOOGLE APPS SCRIPT BACKEND
 * =========================================================================
 * 
 * Features:
 * - Free Real Email OTP dispatch to members using GmailApp.sendEmail()
 * - Full Google Sheets integration for Members and Payments
 * - CORS-enabled REST API for GitHub Pages frontend
 */

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  // Ensure Sheets and headers exist
  setupSpreadsheet();

  let params = {};
  if (e && e.postData && e.postData.contents) {
    try {
      params = JSON.parse(e.postData.contents);
    } catch (err) {
      params = e.parameter || {};
    }
  } else if (e && e.parameter) {
    params = e.parameter;
  }

  const action = params.action || 'getStats';
  let responseData = { status: 'success' };

  try {
    switch (action) {
      case 'getMembers':
        responseData.members = getMembersList();
        break;

      case 'getMemberByEmail':
        responseData.member = findMemberByEmail(params.email);
        break;

      case 'sendEmailOtp':
        responseData = dispatchEmailOtp(params.email, params.otp, params.clubName || 'Pulari Arts and Sports Club');
        break;

      case 'updateMemberProfile':
        responseData.result = updateMemberProfileData(params);
        break;

      case 'updateMemberFee':
        responseData.result = updateMemberFeeData(params);
        break;

      case 'updateAllMembersFee':
        responseData.result = updateAllMembersFeeData(params);
        break;

      case 'submitPayment':
        responseData.payment = recordPaymentSubmission(params);
        break;

      case 'updatePaymentStatus':
        responseData.result = updatePayment(params);
        break;

      case 'addMember':
        responseData.member = createMember(params);
        break;

      case 'getStats':
      default:
        responseData.members = getMembersList();
        responseData.payments = getPaymentsList();
        break;
    }
  } catch (error) {
    responseData = { status: 'error', message: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Auto-creates sheets and headers if not present
 */
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Members Sheet
  let membersSheet = ss.getSheetByName('Members');
  if (!membersSheet) {
    membersSheet = ss.insertSheet('Members');
    membersSheet.appendRow(['Member ID', 'Full Name', 'Email Address', 'Mobile Number', 'Monthly Fee', 'Join Date', 'Created At']);
    // Seed initial demo data
    membersSheet.appendRow(['101', 'Rahul Sharma', 'rahul.pulari@gmail.com', '9876543210', 200, 'Jan 2024', new Date().toISOString()]);
    membersSheet.appendRow(['102', 'Anoop Krishnan', 'anoop.pulari@gmail.com', '9895012345', 200, 'Feb 2024', new Date().toISOString()]);
    membersSheet.appendRow(['103', 'Priya Nair', 'priya.pulari@gmail.com', '9447012345', 200, 'Mar 2024', new Date().toISOString()]);
    membersSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#4f46e5').setFontColor('#ffffff');
  }

  // 2. Payments Sheet
  let paymentsSheet = ss.getSheetByName('Payments');
  if (!paymentsSheet) {
    paymentsSheet = ss.insertSheet('Payments');
    paymentsSheet.appendRow(['Payment ID', 'Member ID', 'Member Name', 'Email', 'Phone', 'Billing Month', 'Amount', 'Status', 'UTR / Ref', 'Payment Date', 'Verified By']);
    // Seed sample payment
    paymentsSheet.appendRow(['P101', '101', 'Rahul Sharma', 'rahul.pulari@gmail.com', '9876543210', 'September 2026', 200, 'PAID', '42398710001', new Date().toLocaleString(), 'Admin']);
    paymentsSheet.getRange('A1:K1').setFontWeight('bold').setBackground('#10b981').setFontColor('#ffffff');
  }
}

/**
 * Send real free OTP email via MailApp / GmailApp
 */
function dispatchEmailOtp(email, otp, clubName) {
  if (!email || !email.includes('@')) {
    return { status: 'error', message: 'Invalid email address' };
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const subject = `🔑 Your Login OTP for ${clubName}: ${otp}`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #4f46e5; margin: 0;">${clubName}</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Monthly Fee & Member Portal</p>
      </div>
      
      <p style="color: #334155; font-size: 15px;">Hello,</p>
      <p style="color: #334155; font-size: 15px;">Your one-time verification code to log in to the <strong>${clubName}</strong> member portal is:</p>
      
      <div style="text-align: center; margin: 25px 0;">
        <div style="display: inline-block; background-color: #e0e7ff; color: #3730a3; font-size: 32px; font-weight: 800; letter-spacing: 6px; padding: 14px 28px; border-radius: 8px; border: 2px solid #818cf8;">
          ${otp}
        </div>
      </div>
      
      <p style="color: #64748b; font-size: 13px;">This OTP is valid for 10 minutes. Please do not share this code with anyone.</p>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center;">Sent automatically by ${clubName} System via Google Apps Script.</p>
    </div>
  `;

  try {
    MailApp.sendEmail({
      to: cleanEmail,
      subject: subject,
      htmlBody: htmlBody,
      name: clubName
    });
    return { status: 'success', message: `OTP sent to ${cleanEmail}`, email: cleanEmail };
  } catch (err) {
    try {
      GmailApp.sendEmail(cleanEmail, subject, `Your OTP is: ${otp}`, {
        htmlBody: htmlBody,
        name: clubName
      });
      return { status: 'success', message: `OTP sent to ${cleanEmail}`, email: cleanEmail };
    } catch (gErr) {
      return { status: 'error', message: gErr.toString() };
    }
  }
}

/**
 * Fetch all members
 */
function getMembersList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Members');
  const data = sheet.getDataRange().getValues();
  const members = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      members.push({
        id: String(data[i][0]),
        name: String(data[i][1]),
        email: String(data[i][2]),
        phone: String(data[i][3]),
        fee: Number(data[i][4]) || 200,
        joinDate: String(data[i][5])
      });
    }
  }
  return members;
}

/**
 * Fetch all payments
 */
function getPaymentsList() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Payments');
  const data = sheet.getDataRange().getValues();
  const payments = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      payments.push({
        id: String(data[i][0]),
        memberId: String(data[i][1]),
        name: String(data[i][2]),
        email: String(data[i][3]),
        phone: String(data[i][4]),
        month: String(data[i][5]),
        amount: Number(data[i][6]),
        status: String(data[i][7]),
        utr: String(data[i][8]),
        date: String(data[i][9]),
        verifiedBy: String(data[i][10])
      });
    }
  }
  return payments;
}

/**
 * Find member by email or phone
 */
function findMemberByEmail(email) {
  const members = getMembersList();
  const cleanEmail = String(email).trim().toLowerCase();
  return members.find(m => m.email.toLowerCase() === cleanEmail || m.phone === cleanEmail) || null;
}

/**
 * Update member profile (Name and Phone) in Members and Payments sheets
 */
function updateMemberProfileData(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const membersSheet = ss.getSheetByName('Members');
  const paymentsSheet = ss.getSheetByName('Payments');

  const searchEmail = params.email ? String(params.email).trim().toLowerCase() : '';
  const searchId = params.memberId ? String(params.memberId).trim() : '';
  const newName = params.name ? String(params.name).trim() : '';
  const newPhone = params.phone ? String(params.phone).trim() : '';

  let memberUpdated = false;

  // 1. Update in Members Sheet
  if (membersSheet) {
    const data = membersSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const rowId = String(data[i][0]).trim();
      const rowEmail = String(data[i][2]).trim().toLowerCase();

      if ((searchId && rowId === searchId) || (searchEmail && rowEmail === searchEmail)) {
        if (newName) membersSheet.getRange(i + 1, 2).setValue(newName); // Col 2: Full Name
        if (newPhone) membersSheet.getRange(i + 1, 4).setValue(newPhone); // Col 4: Mobile Number
        memberUpdated = true;
        break;
      }
    }
  }

  // 2. Update Member Name in Payments Sheet for consistency
  if (paymentsSheet && newName) {
    const pData = paymentsSheet.getDataRange().getValues();
    for (let j = 1; j < pData.length; j++) {
      const pMemberId = String(pData[j][1]).trim();
      const pEmail = String(pData[j][3]).trim().toLowerCase();

      if ((searchId && pMemberId === searchId) || (searchEmail && pEmail === searchEmail)) {
        paymentsSheet.getRange(j + 1, 3).setValue(newName); // Col 3: Member Name
        if (newPhone) paymentsSheet.getRange(j + 1, 5).setValue(newPhone); // Col 5: Phone
      }
    }
  }

  return { success: memberUpdated, name: newName, phone: newPhone };
}

/**
 * Update member monthly fee amount in Members sheet
 */
function updateMemberFeeData(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const membersSheet = ss.getSheetByName('Members');
  if (!membersSheet) return { success: false, message: 'Members sheet not found' };

  const searchEmail = params.email ? String(params.email).trim().toLowerCase() : '';
  const searchId = params.memberId ? String(params.memberId).trim() : '';
  const newFee = Number(params.fee) || 1;

  const data = membersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][0]).trim();
    const rowEmail = String(data[i][2]).trim().toLowerCase();

    if ((searchId && rowId === searchId) || (searchEmail && rowEmail === searchEmail)) {
      membersSheet.getRange(i + 1, 5).setValue(newFee); // Col 5: Monthly Fee
      return { success: true, updatedRow: i + 1, fee: newFee };
    }
  }

  return { success: false, message: 'Member not found' };
}

/**
 * Update monthly fee for ALL members in Google Sheet
 */
function updateAllMembersFeeData(params) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const membersSheet = ss.getSheetByName('Members');
  if (!membersSheet) return { success: false, message: 'Members sheet not found' };

  const newFee = Number(params.fee) || 1;
  const lastRow = membersSheet.getLastRow();

  if (lastRow > 1) {
    for (let i = 2; i <= lastRow; i++) {
      membersSheet.getRange(i, 5).setValue(newFee); // Col 5: Monthly Fee
    }
  }

  return { success: true, updatedCount: lastRow - 1, fee: newFee };
}

/**
 * Record a new payment submission
 */
function recordPaymentSubmission(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Payments');
  const paymentId = 'P' + new Date().getTime();
  
  sheet.appendRow([
    paymentId,
    data.memberId,
    data.memberName || '',
    data.email || '',
    data.phone || '',
    data.month,
    data.amount,
    data.status || 'SUBMITTED',
    data.utr || '',
    data.date || new Date().toLocaleString(),
    'Pending'
  ]);

  return { id: paymentId, ...data };
}

/**
 * Update payment status (Admin verify)
 */
function updatePayment(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Payments');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    // Match memberId and month
    if (String(data[i][1]) === String(params.memberId) && String(data[i][5]) === String(params.month)) {
      sheet.getRange(i + 1, 8).setValue(params.status); // Column 8: Status
      if (params.utr) sheet.getRange(i + 1, 9).setValue(params.utr); // Column 9: UTR
      sheet.getRange(i + 1, 11).setValue('Admin'); // Column 11: Verified By
      return { success: true, updatedRow: i + 1 };
    }
  }

  return recordPaymentSubmission({
    memberId: params.memberId,
    month: params.month,
    amount: params.amount || 200,
    status: params.status || 'PAID',
    utr: params.utr || 'VERIFIED-BY-ADMIN',
    date: params.date || new Date().toLocaleString()
  });
}

/**
 * Create a new member
 */
function createMember(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Members');
  const memberId = String(100 + sheet.getLastRow());

  sheet.appendRow([
    memberId,
    data.name,
    data.email || '',
    String(data.phone || ''),
    Number(data.fee) || 200,
    data.joinDate || 'Jan 2024',
    new Date().toISOString()
  ]);

  return { id: memberId, ...data };
}

