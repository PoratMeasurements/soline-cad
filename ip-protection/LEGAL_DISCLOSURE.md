# Soline IP-Protection — Legal Disclosure & Privacy Boundary

> ⚖️ אזהרה: מסמך זה הוא הנחיה הנדסית/עסקית, **לא ייעוץ משפטי**. לפני הפעלת שכבת
> טלמטריה (beacon) או ניסוח סעיפי-רישיון, יש לאשר מול עו״ד המתמחה בקניין-רוחני
> ובפרטיות (ישראל: חוק הגנת הפרטיות התשמ״א-1981 ותיקון 13; אם יש לקוחות/נתונים
> באיחוד-האירופי: GDPR).

The protection in this module is lawful **only** when it is **disclosed** and
stays within a clear privacy boundary. This file states what Soline must put in
its terms, and what the system must never do.

---

## 1. Core principle

Soline fingerprints **its own exported files** to protect **its own IP** and to
identify **the licensee a file was issued to**. This is ordinary, legitimate
self-protection (the same category as a document watermark or a software license
key). It becomes a legal/privacy problem only if it (a) is hidden from the very
customer it applies to when it collects data, or (b) is used to surveil third
parties. Both are prohibited below.

## 2. What is embedded — and its lawful basis

| Data in the token | Purpose | Personal data? |
|---|---|---|
| `pid` project id, `cid` customer id | Trace a leak to the licensee | Pseudonymous identifiers (resolve to a person/business only via Soline's own records). |
| `tier`, `fmt`, `ts`, `nid` | License scope, format, issue time, per-file nonce | Not personal on their own. |
| `job` (optional display) | Human context on the deliverable | May contain a name/address if Soline puts one there — **keep it non-personal** (e.g. "מטבח דירת דוגמה") to minimize. |

Lawful basis: **legitimate interest** (protecting Soline's IP) + **contract**
(the customer's license). No special-category data is embedded. The token holds
**identifiers, not personal profiles** — it points back to Soline's records; it
does not itself compile personal information.

## 3. Mandatory license-terms clauses (customer-facing)

Soline's customer license / terms of service **must** include, in plain language:

1. **Fingerprinting disclosure.** "Files Soline delivers (measurement plans, DXF,
   PDF, HTML, `.sol`) contain a unique, possibly invisible, identifier that ties
   the file to your project and account, so Soline can identify the source of a
   copied or redistributed file."
2. **Purpose limitation.** The identifier is used solely to (a) prove Soline's
   authorship/ownership and (b) identify the licensee of a leaked file — not for
   advertising, profiling, or resale.
3. **Redistribution terms.** What the customer may/may not do with the file
   (the actual IP grant — this is the substantive right the fingerprint enforces).
4. **Telemetry disclosure — only if beacons are enabled.** If (and only if) Soline
   turns on the HTML/PDF open-beacon: "Certain deliverables, when opened while
   online, notify Soline that the file was opened and report the file's identifier.
   No document content and no keystrokes are transmitted." State what is sent
   (identifier + timestamp + requesting IP as seen by the server), the retention
   period, and how to contact Soline about it.
5. **Data-subject rights.** How to ask what is stored and request correction (per
   applicable privacy law).

## 4. The telemetry beacon — hard rules

The beacon (`html.stamp` with `opts.beaconUrl` + `opts.disclosed === true`) is a
1×1 image request that fires **when the deliverable is opened online**.

- **OFF by default.** Config ships `beacon.url:""`, `disclosedInLicense:false`.
  Code refuses to emit a beacon unless `disclosed === true` is passed explicitly.
- **Only in formats the customer knowingly opens** (HTML/PDF report), never smuggled
  into a CAD file meant for offline use.
- **Must be disclosed** per §3.4 before it is switched on for any customer.
- **Minimize.** Send only the `nid` (or an opaque handle), a timestamp, and rely on
  standard server logs. Do **not** put personal data in the URL. Do **not** attempt
  device fingerprinting, cookies, or cross-site tracking.
- **Never covert.** No hidden phone-home from offline CAD (DXF/PDP) — it is
  technically avoided and contractually prohibited.

## 5. Absolute prohibitions

- ❌ **No covert surveillance of third parties.** If a file reaches someone who is
  not the licensee, Soline may identify *which licensee it was issued to* — it may
  **not** track that third party (no covert beacon aimed at them beyond a lawfully
  disclosed open-ping, no attempt to identify or profile them).
- ❌ **No hidden data collection the customer wasn't told about.** If it collects,
  it's disclosed. If it's not disclosed, it doesn't collect (metadata/stego that
  merely *sits in the file* is fine and is the default; *transmitting* needs §3.4).
- ❌ **No personal/sensitive data in the fingerprint or in any URL/query string.**
- ❌ **No CAPTCHA-bypassing, credential capture, or account actions** as part of
  monitoring. Web/marketplace monitoring uses lawful, ToS-respecting access only.
- ❌ **No repurposing** the identifier for marketing, scoring, or sale.

## 6. Retention & security

- The **signing secret** is the crown jewel: store it in a secret manager / env,
  rotate on suspected exposure, never commit it, never ship it in a file. Losing it
  lets others forge marks; leaking it does **not** expose customer data (the token
  is pseudonymous), but it breaks authenticity guarantees.
- The **issue log** (`issued.log.jsonl`: `nid` → project/customer/time) is what
  resolves a recovered `nid` to a real licensee. Treat it as customer data: access-
  controlled, retained only as long as needed for IP-enforcement, and covered by
  Soline's privacy notice.

## 7. Enforcement posture (how the trace is meant to be used)

1. Recover the token via `verify.js` (submit-to-verify or monitoring hit).
2. Confirm **authenticity** (HMAC) — the file is genuinely Soline's, unaltered mark.
3. Resolve `nid`/`cid` to the licensee via the issue log.
4. Act through **lawful** channels: license-breach notice, DMCA/marketplace
   takedown, contractual remedies. The fingerprint is *evidence*, not
   self-help enforcement.
