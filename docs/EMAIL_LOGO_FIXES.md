# PO Email Logo — Outlook.com Compatibility

## Problem
The company logo in PO emails renders correctly in **Gmail** but **not in Outlook.com/Hotmail**.
The logo either doesn't display at all or shows as a broken image / clickable attachment.

## Attempts

### Attempt 1: Base64 Data URI (original implementation)
**Approach:** Embed logo directly in HTML as `<img src="data:image/png;base64,...">`.

**Result:** Works in Gmail. **Broken in Outlook.com** — Outlook strips `data:` URIs entirely from email HTML. This is a known, intentional security policy.

**Reference:** [Twilio: Embedding Images in Emails](https://www.twilio.com/en-us/blog/insights/embedding-images-emails-facts) — "Base64 encoding is blocked completely in Outlook."

### Attempt 2: CID Inline Image (MailComposer)
**Approach:** Reference image as `<img src="cid:company-logo">` in HTML and attach it as an inline MIME part with a matching `Content-ID` header. Used `nodemailer/MailComposer` to build `multipart/related` MIME structure automatically.

**MIME structure produced:**
```
multipart/related
  ├── multipart/alternative
  │     ├── text/plain
  │     └── text/html (with <img src="cid:company-logo">)
  └── image/png (Content-ID: <company-logo>, Content-Disposition: inline)
```

**Result:** Works in Gmail and desktop Outlook. **Still broken in Outlook.com (webmail)** — CID embedding works in desktop email clients but generally does not work in web-based email clients.

**References:**
- [Twilio: Embedding Images in Emails](https://www.twilio.com/en-us/blog/insights/embedding-images-emails-facts) — "CID embedding will work fine in most desktop email clients, but most likely not at all in web-based email clients, such as Gmail or Yahoo! Mail."
- [Microsoft Q&A: CID images not loading in Outlook](https://learn.microsoft.com/en-us/answers/questions/2286613/cid-image-embeds-are-not-loading-properly-in-outlo) — Even with correct MIME structure, Outlook.com has security restrictions on CID.

### Attempt 3: Google Drive Hosted URL (WORKING)
**Approach:** Upload logo to Google Drive via existing `driveService.ts`, set public permissions (`anyone: reader`), use the public URL as `<img src>` in email HTML.

**Critical detail — URL format matters:**
- `https://drive.google.com/uc?export=view&id={FILE_ID}` — **does NOT work in Outlook.com**. Returns a 302 redirect, and Outlook.com's email renderer won't follow redirects for `<img>` sources. Shows broken image icon.
- `https://lh3.googleusercontent.com/d/{FILE_ID}` — **works everywhere**. Serves raw image bytes directly with no redirect.

**Implementation:**
- Added `uploadCompanyLogo()` to `driveService.ts` — uploads base64 logo, sets public permissions, returns `lh3.googleusercontent.com` URL
- Lazy initialization: first PO email send auto-uploads if `company_logo_url` not in `rbac_settings`
- Subsequent sends read `company_logo_url` from settings (no re-upload)
- Preview dialog still uses data URI (works fine in iframe)
- Graceful fallback: if Drive upload fails, email sends with text company name instead of logo

**MIME structure (clean, no attachments):**
```
multipart/alternative
  ├── text/plain
  └── text/html (with <img src="https://lh3.googleusercontent.com/d/{FILE_ID}">)
```

**Result:** Works in Gmail and Outlook.com (Hotmail). Logo renders inline in both clients.

## Key Learnings

| Method | Gmail | Outlook Desktop | Outlook.com (Web) | Size Impact |
|--------|-------|-----------------|-------------------|-------------|
| Data URI (base64) | Yes | No | No | Large (inline) |
| CID (inline attachment) | Yes | Yes | No | Medium (attachment) |
| Hosted URL (drive.google.com/uc) | Yes | Yes | No (redirect) | Minimal |
| Hosted URL (lh3.googleusercontent.com) | Yes | Yes | **Yes** | Minimal |

1. **Outlook.com is a web-based client** — it has stricter security than desktop Outlook. Methods that work in desktop Outlook don't necessarily work in Outlook.com.
2. **There is no embed-only solution for Outlook.com** — neither data URIs nor CID work reliably. Hosted URLs are the only universal approach.
3. **Google Drive URL format matters** — `drive.google.com/uc?export=view` returns a 302 redirect that email clients won't follow. `lh3.googleusercontent.com/d/{FILE_ID}` serves bytes directly and works universally.
4. **Preview vs Send can use different strategies** — the frontend preview (iframe) can keep using data URIs since it's rendered locally, while sent emails need the hosted URL approach.
5. **MailComposer is still the right tool** — even without CID, MailComposer is cleaner than manual MIME string building and is the established pattern in our codebase (used by 3 other email services).

## Current State (RESOLVED)
- `supplierOrderEmailService.ts` uses hosted Google Drive URL (`lh3.googleusercontent.com`) for sent emails
- Preview dialog uses data URI (works fine in iframe)
- Logo URL auto-stored in `rbac_settings` as `company_logo_url` after first upload
- Tested and confirmed working in Gmail and Outlook.com

## File Reference
- **PO Email Service:** `/backend/web/src/services/supplierOrderEmailService.ts`
- **Other email services (MailComposer pattern):** `cashEstimateEmailService.ts`, `invoiceEmailService.ts`
