# Handoff (2026-09-30)

## Goal
- Automate the user's export Commercial Invoice / Packing List (CI/PL) Excel work:
  fill the CI, PL and appendix sheets from pasted order RAW DATA, with no manual
  row adding, deleting or reformatting. Other users at the company must be able to run it.

## Decisions
- Format: **Excel macro (.xlsm, VBA)**. No install needed, runs on each user's PC with
  their own rights, so it can open the shared network drive (Claude cannot, and does not need to).
- Verify the logic first with a Python replica against the user's 3 sample CI/PLs, then
  deliver VBA. Excel is not available in the cloud session, so the user tests the macro once.
- Workbook sheets: Input (customer dropdown, PO/JAR No., dates, packing, G.W, Generate button),
  RAW (pasted order data plus one "ship qty" column; default = remaining qty, blank = skip),
  Customers, WeightDB, Templates (CI / PL / appendix).
- 8 or more items: put "As per appendix" in the CI and PL bodies and list the items on the appendix sheet.
- Invoice No.: read the yearly export ledger file (`YY년 수출대장.XLSX` on the shared drive),
  take the next number, write the row right away, stop if the file is locked. Path is a setting.
  Assumed rule `JI-YYMM` + 2-digit monthly serial (for example JI-260918); user to confirm.
- Customers: new customers are saved automatically; Consignee and Notify are reused as fixed data.
  Payment terms, Incoterms, HS code and loading port are **per-PO defaults**: prefill with the
  customer's last-used value, offer that customer's past values in a dropdown, highlight in yellow
  for review, require a value before generating, record the actual values for each shipment in the
  ledger, and ask before changing the saved default.
- Weights: look up the user's SWG/RTJ weight tables by parsed spec (normalize `2-1/2"` vs `2.1/2"`,
  `600LB` vs `Class 600`); if missing, mark the cell red, ask the user, and save the answer to WeightDB.
- Unify the shipper address (samples mix the old and the new address).

## Current state
- Design only. No code yet. Uploaded files are not in the repo; ask the user to re-upload them.
- Sample issues found (to cite as automation benefits): CI vs PL reference No. mismatch, CI vs PL
  description mismatch, an incomplete invoice No., weight-table outliers (300LB lighter than 150LB
  at 2-1/2", 6", 24").

## Next steps
1. Get from the user: export ledger layout (redacted copy or screenshot), confirmation of the number rule
   and whether the month follows the issue date or the ship date, one unified template or per-customer
   templates, customer list personal or team-shared, one ledger file or one per staff member.
2. Ask the user to re-upload: the sample CI/PLs (China, Vietnam, Indonesia), the RAW DATA sample and the weight tables.
3. Build the Python replica, match all samples, then write the VBA .xlsm and a short Korean user guide.

## Notes
- Chat in plain Korean. User is token-conscious. Committed files stay in English (CI rule).
- The repo is public: keep customer names, addresses and internal paths out of committed files.
- The earlier skill-repo handoff note is still on `master` (in HANDOFF.md).
