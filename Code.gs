/** KW Explore — Google Form → PDF contract with CCs + log (single file)
 * - setup(): creates Form, response Sheet, grey “Contracts Log”, and a submit trigger
 * - onFormSubmit(e): fills the Doc template, exports PDF, emails agent + CCs, logs PDF URL
 * - Works with or without the File Upload question (automatic fallback to URL text field)
 */

const CONFIG = {
  BRAND:       { name: 'KW Explore', primary: '#D40511', dark: '#333' },
  TIMEZONE:    'Africa/Johannesburg',

  // ⇩⇩ UPDATE THESE TWO
  TEMPLATE_DOC_ID: 'PASTE_GOOGLE_DOC_TEMPLATE_ID_HERE',
  LOGO_FILE_ID:    'PASTE_LOGO_FILE_ID_HERE',

  DEST_FOLDER_NAME:'KW Explore - Agent Joining Forms',

  // CCs for every completed contract
  CC_EMAILS: [
    'dawie.dutoit@kwsa.co.za',
    'casandra.vdmerwe@kwsa.co.za',
    'rukudzo.jagada@kwsa.co.za'
  ],

  // Form
  FORM_TITLE:  'KW Explore — Agent Agreement (E-Sign)',
  FORM_DESC:   'Please complete all required fields. By submitting, you acknowledge this constitutes your electronic signature.',

  // Signature handling
  WANT_SIG_UPLOAD: true,                                 // try to add File Upload question
  SIG_UPLOAD_TITLE: 'Signature (image file — PNG/JPG)',  // upload question title
  SIG_URL_FALLBACK_TITLE: 'Signature Image URL (optional)', // text field used if uploads not supported
  SIG_PLACEHOLDERS: ['[Associate Signature]','[Full Signature]','[Agent Signature]'],
  SIGNATURE_IMAGE_WIDTH_PX: 340
};

/* ========================= One-time setup ========================= */

function setup() {
  assertTemplateId_(CONFIG.TEMPLATE_DOC_ID);
  const folder = getOrCreateFolder_(CONFIG.DEST_FOLDER_NAME);
  const form = maybeCreateForm_(folder);
  const ss   = ensureResponsesSheet_(form);
  ensureContractsLogSheet_(ss);

  // Install submit trigger once
  const has = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === 'onFormSubmit');
  if (!has) ScriptApp.newTrigger('onFormSubmit').forForm(form).onFormSubmit().create();

  Logger.log('Form URL: ' + form.getPublishedUrl());
  Logger.log('Form Edit URL: ' + form.getEditUrl());
  Logger.log('Responses spreadsheet: ' + ss.getUrl());
}

/* Quick helper to re-print links later */
function showLinks() {
  const form = FormApp.getActiveForm();
  const ssId = form.getDestinationId();
  Logger.log('Form URL: ' + form.getPublishedUrl());
  Logger.log('Responses spreadsheet: ' + SpreadsheetApp.openById(ssId).getUrl());
}

/* ========================= Form builder ========================= */

function maybeCreateForm_(folder) {
  const existing = FormApp.getActiveForm();
  if (existing) return existing;

  const form = FormApp.create(CONFIG.FORM_TITLE);
  form.setDescription(CONFIG.FORM_DESC);
  form.setCollectEmail(true).setProgressBar(true);

  // Section 1: Personal
  form.addSectionHeaderItem().setTitle('1) Personal Details');
  form.addTextItem().setTitle('Name').setRequired(true);
  form.addTextItem().setTitle('Surname').setRequired(true);
  form.addTextItem().setTitle('Preferred Name');
  form.addTextItem().setTitle('Contact Number').setRequired(true).setHelpText('e.g., +27 …');
  form.addTextItem().setTitle('ID Number');
  form.addDateItem().setTitle('Date of Birth');
  form.addParagraphTextItem().setTitle('Street Address').setRequired(true);
  form.addParagraphTextItem().setTitle('Postal Address').setRequired(true);
  form.addTextItem().setTitle('KW Sponsor Name and Surname').setRequired(true);

  // Optional family/emergency
  form.addSectionHeaderItem().setTitle('2) Family & Emergency (optional)');
  form.addMultipleChoiceItem().setTitle('Marital Status')
      .setChoiceValues(['Married','Single','Divorced','Widowed']);
  form.addTextItem().setTitle('Date of Marriage');
  form.addTextItem().setTitle('Spouse Name');
  form.addDateItem().setTitle('Spouse Date of Birth');
  form.addTextItem().setTitle('Spouse Contact Number');
  form.addTextItem().setTitle('Emergency Contact Name');
  form.addTextItem().setTitle('Emergency Contact Number');
  form.addTextItem().setTitle('Emergency Contact Relation');

  // FFC & Banking
  form.addSectionHeaderItem().setTitle('3) FFC & Banking');
  form.addMultipleChoiceItem().setTitle('Do you hold a FFC').setChoiceValues(['Yes','No']);
  form.addTextItem().setTitle('Year of first FFC');
  form.addMultipleChoiceItem().setTitle('Qualification Status (FFC)')
      .setChoiceValues(['Candidate','Full Status','Principle Status']);
  form.addTextItem().setTitle('FFC Number');
  form.addTextItem().setTitle('To which Company is FFC Linked');
  form.addTextItem().setTitle('Bank Account Name');
  form.addTextItem().setTitle('Bank');
  form.addMultipleChoiceItem().setTitle('Type of Account')
      .setChoiceValues(['Cheque','Savings','Transmission']);
  form.addTextItem().setTitle('Branch Code');
  form.addTextItem().setTitle('Branch Name');
  form.addTextItem().setTitle('Account Number');
  form.addTextItem().setTitle('Income Tax Number');

  // Farming & Dates
  form.addSectionHeaderItem().setTitle('4) Farming & Dates');
  form.addTextItem().setTitle('Main Farming Area').setRequired(true);
  form.addDateItem().setTitle('Start Date').setRequired(true);
  form.addTextItem().setTitle('Associate Initials').setRequired(true).setHelpText('Type 2–6 characters');

  // Signature — try upload; fall back to URL field if not supported
  let addedUpload = false;
  if (CONFIG.WANT_SIG_UPLOAD && typeof form.addFileUploadItem === 'function') {
    try {
      const up = form.addFileUploadItem()
        .setTitle(CONFIG.SIG_UPLOAD_TITLE)
        .setHelpText('Attach your signature image (optional).')
        .setMaxFiles(1)
        .setValidation(FormApp.createFileUploadValidation()
          .requireFileSizeLessThanOrEqualTo(10) // MB
          .build());
      addedUpload = !!up;
    } catch (_) { addedUpload = false; }
  }
  if (!addedUpload) {
    form.addTextItem()
        .setTitle(CONFIG.SIG_URL_FALLBACK_TITLE)
        .setHelpText('Paste a public PNG/JPG URL of your signature (optional).');
  }

  // Agreement (createChoice belongs to the item, not the form)
  const agree = form.addCheckboxItem()
    .setTitle('I agree that this constitutes my electronic signature and I am entering into the agreement.')
    .setRequired(true);
  agree.setChoices([agree.createChoice('I agree')]);

  // Move form under the destination folder
  DriveApp.getFileById(form.getId()).moveTo(folder);
  return form;
}

function ensureResponsesSheet_(form) {
  // Create a dedicated responses spreadsheet and link it
  const ss = SpreadsheetApp.create('KW Explore — Agent Join Responses (Form)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  return ss;
}

function ensureContractsLogSheet_(ss) {
  let sh = ss.getSheetByName('Contracts Log');
  if (!sh) {
    sh = ss.insertSheet('Contracts Log');
    sh.getRange(1,1,1,6).setValues([['Timestamp','Full Name','Email','Start Date','Anniversary Date','PDF URL']]);
    sh.getRange(1,1,1,6).setBackground('#efefef').setFontWeight('bold'); // grey header
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ========================= Submit handler ========================= */

function onFormSubmit(e) {
  const tz     = CONFIG.TIMEZONE;
  const folder = getOrCreateFolder_(CONFIG.DEST_FOLDER_NAME);
  const nv     = e.namedValues || {};

  const respondentEmail = e.response.getRespondentEmail() || '';

  // Dates
  const start  = parseDate_(nv['Start Date']?.[0]);
  const ann    = start ? addMonths_(start, 12) : null;
  const annStr = ann ? Utilities.formatDate(ann, tz, 'yyyy-MM-dd') : '';

  // Placeholder map
  const map = {
    'Name': nv['Name']?.[0] || '',
    'Surname': nv['Surname']?.[0] || '',
    'Preferred Name': nv['Preferred Name']?.[0] || '',
    'Email': respondentEmail,
    'Contact Number': nv['Contact Number']?.[0] || '',
    'ID Number': nv['ID Number']?.[0] || '',
    'Date of Birth': nv['Date of Birth']?.[0] || '',
    'KW Sponsor Name and Surname': nv['KW Sponsor Name and Surname']?.[0] || '',
    'Street Address': nv['Street Address']?.[0] || '',
    'Postal Address': nv['Postal Address']?.[0] || '',
    'Marital Status': nv['Marital Status']?.[0] || '',
    'Date of Marridge': nv['Date of Marriage']?.[0] || '',
    'Spouse Name': nv['Spouse Name']?.[0] || '',
    'Spouse date of Birth': nv['Spouse Date of Birth']?.[0] || '',
    'Spouse Contact Number': nv['Spouse Contact Number']?.[0] || '',
    'Emergency Contact Name': nv['Emergency Contact Name']?.[0] || '',
    'Emergency Contact Number': nv['Emergency Contact Number']?.[0] || '',
    'Emergency Contact Relation': nv['Emergency Contact Relation']?.[0] || '',
    'Do you hold a FFC': nv['Do you hold a FFC']?.[0] || '',
    'Year of first FFC': nv['Year of first FFC']?.[0] || '',
    'Qualification Status (FFC)': nv['Qualification Status (FFC)']?.[0] || '',
    'FFC Number': nv['FFC Number']?.[0] || '',
    'To which Company is FFC Linked': nv['To which Company is FFC Linked']?.[0] || '',
    'Bank Account Name': nv['Bank Account Name']?.[0] || '',
    'Bank': nv['Bank']?.[0] || '',
    'Type of Account': nv['Type of Account']?.[0] || '',
    'Branch Code': nv['Branch Code']?.[0] || '',
    'Branch Name': nv['Branch Name']?.[0] || '',
    'Account Number': nv['Account Number']?.[0] || '',
    'Income Tax Number': nv['Income Tax Number']?.[0] || '',
    'Main Farming Area': nv['Main Farming Area']?.[0] || '',
    'Start Date': nv['Start Date']?.[0] || '',
    'Anniversary Date': annStr,
    'Associate Initials': nv['Associate Initials']?.[0] || '',
    'Signed Date': Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd')
  };

  const fullName = [map['Name'], map['Surname']].filter(Boolean).join(' ').trim() || 'New Agent';
  const dateStr  = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  // Working copy of the template
  const baseFile  = DriveApp.getFileById(CONFIG.TEMPLATE_DOC_ID);
  const workingId = baseFile.makeCopy(`KWE Agreement - ${fullName} - ${dateStr}`, folder).getId();

  // Replace placeholders
  const doc = DocumentApp.openById(workingId);
  const body = doc.getBody(), header = doc.getHeader(), footer = doc.getFooter();
  replaceTokensInContainer_(body, map);
  if (header) replaceTokensInContainer_(header, map);
  if (footer) replaceTokensInContainer_(footer, map);

  // Signature image: try file-upload first, else URL field
  let sigBlob = null;
  const sigFile = getFirstUploadedFile_(e, CONFIG.SIG_UPLOAD_TITLE);
  if (sigFile) {
    sigBlob = sigFile.getBlob();
  } else {
    const url = (nv[CONFIG.SIG_URL_FALLBACK_TITLE]?.[0] || '').trim();
    if (url) { try { sigBlob = UrlFetchApp.fetch(url).getBlob(); } catch (_) { sigBlob = null; } }
  }
  if (sigBlob) insertImageAtFirstMatch_([body,header,footer].filter(Boolean), CONFIG.SIG_PLACEHOLDERS, sigBlob, CONFIG.SIGNATURE_IMAGE_WIDTH_PX);

  doc.saveAndClose();

  // Export PDF
  const pdfBlob = DriveApp.getFileById(workingId).getAs(MimeType.PDF)
                    .setName(`KWE Agreement - ${fullName} - ${dateStr}.pdf`);
  const pdfFile = folder.createFile(pdfBlob);

  // Email agent + CCs (PDF attached)
  const subject = 'Your signed KW Explore agreement';
  const html    = buildEmailHtml_(fullName, pdfFile.getUrl());
  GmailApp.sendEmail(
    respondentEmail || CONFIG.CC_EMAILS[0],
    subject,
    'Please view this email in HTML.',
    { htmlBody: html, name: CONFIG.BRAND.name, cc: CONFIG.CC_EMAILS.join(','), attachments: [pdfFile.getAs(MimeType.PDF)] }
  );

  // Log to “Contracts Log”
  const form = FormApp.openById(e.source.getId());
  const ss   = SpreadsheetApp.openById(form.getDestinationId());
  const log  = ensureContractsLogSheet_(ss);
  log.appendRow([
    Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss'),
    fullName,
    respondentEmail,
    map['Start Date'] || '',
    annStr || '',
    pdfFile.getUrl()
  ]);
}

/* ========================= Helpers ========================= */

function getOrCreateFolder_(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}
function parseDate_(s){ if(!s) return null; const d=new Date(s); return isNaN(d)?null:d; }
function addMonths_(d,m){ const x=new Date(d.getTime()); x.setMonth(x.getMonth()+m); return x; }

function replaceTokensInContainer_(container, map) {
  Object.keys(map).forEach(k => {
    const v = String(map[k] ?? '');
    ['\\['+escapeRegExp_(k)+'\\]','\\{'+escapeRegExp_(k)+'\\}'].forEach(p => container.replaceText(p, v));
  });
}
function insertImageAtFirstMatch_(containers, tokens, blob, widthPx){
  for (const c of containers){
    for (const t of tokens){
      let r=c.findText(escapeRegExp_(t));
      if(r){
        const el=r.getElement();
        try{ el.asText().deleteText(r.getStartOffset(), r.getEndOffsetInclusive()); }catch(e){}
        let p=el; while(p && p.getType()!==DocumentApp.ElementType.PARAGRAPH) p=p.getParent();
        if(!p) p=c.appendParagraph('');
        const img=p.appendInlineImage(blob); if(widthPx) img.setWidth(widthPx);
        return;
      }
    }
  }
}
function escapeRegExp_(s){ return String(s).replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&'); }

function buildEmailHtml_(fullName, pdfUrl) {
  const logo = safeLogoImgTag_();
  return `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:${CONFIG.BRAND.dark}">
    <div style="padding:16px 0">${logo}</div>
    <h2 style="margin:0 0 8px">Welcome, ${fullName} 🎉</h2>
    <p>Your <strong>signed agreement</strong> is ready.</p>
    <p><a href="${pdfUrl}" style="background:${CONFIG.BRAND.primary};color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;display:inline-block">View Your PDF</a></p>
    <p>We’re excited to be in business with you at <strong>${CONFIG.BRAND.name}</strong>.</p>
  </div>`;
}
function safeLogoImgTag_(){
  try{
    if(!CONFIG.LOGO_FILE_ID) return '';
    const blob=DriveApp.getFileById(CONFIG.LOGO_FILE_ID).getBlob();
    const b64 = Utilities.base64Encode(blob.getBytes());
    const mime=blob.getContentType()||'image/png';
    return `<img alt="${CONFIG.BRAND.name}" src="data:${mime};base64,${b64}" style="height:46px">`;
  }catch(e){ return ''; }
}

/* ---- File-upload helper (only returns a file when the upload item exists) ---- */
function getFirstUploadedFile_(e, uploadTitle) {
  try {
    const item = e.response.getItemResponses().find(ir => ir.getItem().getTitle() === uploadTitle);
    if (!item) return null;
    const ids = item.getResponse(); // array of Drive File IDs
    if (!ids || !ids.length) return null;
    return DriveApp.getFileById(ids[0]);
  } catch (err) {
    return null;
  }
}

/* ---- Validation ---- */
function assertTemplateId_(id){
  if(!id || typeof id!=='string') throw new Error('CONFIG.TEMPLATE_DOC_ID is empty.');
  if(!/^[a-zA-Z0-9_-]{20,}$/.test(id)) throw new Error('TEMPLATE_DOC_ID looks wrong — paste only the Doc ID.');
}
