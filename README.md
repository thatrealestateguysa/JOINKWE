# KW Explore — Agreement & E‑Sign (Google Form → PDF)

Google Apps Script solution that collects agent details via **Google Forms**, fills a **Google Docs** template, exports a **PDF**, emails the agent and **CCs** the KW Explore team, and logs completions to a grey‑headed **Contracts Log** sheet.

**Production (provided by you):**  
`https://script.google.com/macros/s/AKfycbx8CEuzF7rTylBQxFhUgmD6-Y8ZVQgzrmbASOuGXl3NWyf4MRfCvPi0vOxbDE6996HSug/exec`

---

## Features
- Google **Form** with all required fields
- Auto **Anniversary Date** = Start Date + 12 months
- Placeholder replacement for `[...]` and `{...}` in your Doc template
- Optional **signature image** (file upload if supported, else URL text field)
- Exports **PDF**, stores it in Drive, emails the agent with **CCs**
- Logs a row to **Contracts Log** including the PDF link

## Quick start
1. Convert your PDF contract to a **Google Doc** (Drive → _Open with → Google Docs_) and keep placeholders like `[Name]`, `[Anniversary Date]`, `[Associate Signature]`.
2. Copy this repo into an Apps Script project (or use `clasp`, below).
3. Open `Code.gs` and set:
   - `CONFIG.TEMPLATE_DOC_ID = '<your Google Doc ID>'`
   - `CONFIG.LOGO_FILE_ID = '<logo file ID>'`
4. Run `setup()` once and approve permissions.
5. From the **execution log**, open the **Form URL** and submit a test.
6. Check the Drive folder **KW Explore - Agent Joining Forms** for the working Doc and generated PDF.

## Placeholders
Place exact tokens in the Google Doc where values should appear, e.g.
```
[Name] [Surname]
[Email] | [Contact Number]
[Street Address]
[Postal Address]
[Start Date] → [Anniversary Date]
[Associate Initials]
[Associate Signature]
```
Curly‑brace variants like `{Name}` also work.

## CC list
Edit `CONFIG.CC_EMAILS` in `Code.gs`. Current defaults:
- dawie.dutoit@kwsa.co.za
- casandra.vdmerwe@kwsa.co.za
- rukudzo.jagada@kwsa.co.za

## Deploy / develop with CLASP (optional)
```bash
npm i -g @google/clasp
clasp login
clasp create --type standalone --title "KW Explore — Agreement"
# Copy files from this repo into the new project folder
clasp push
# Open the project
clasp open
```
You can also link an existing script with `clasp clone <SCRIPT_ID>`.

## Troubleshooting
- **File upload not available**: Some environments don’t support the Forms upload question. The script detects this and automatically adds a **Signature URL** text field instead.
- **`createChoice` error**: Choices must be created on the **item**, not the `Form`. This repo already uses `agree.createChoice('I agree')`.
- **Missing PDFs in email**: Ensure `Drive`, `Docs`, and `Gmail` scopes were approved when running `setup()`.
- **Template leaking placeholders**: Make sure the tokens in your Doc exactly match the Form titles used in `map` within `onFormSubmit(e)`.

## License
MIT © KW Explore
