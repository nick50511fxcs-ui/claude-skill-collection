# Handoff (2026-09-30)

## Goal
- Excel VBA tool that builds export CI / PL / appendix from pasted ERP order data and
  writes the invoice row into the team's shared export ledger. Other staff must be able to use it.

## Decisions
- Deliverables are PRIVATE: never commit tool files, samples, customer data or internal paths
  to this public repo. Deliver files only as chat attachments (zip).
- Format: .xlsx template + .bas module (CP949, CRLF) that the user imports and saves as .xlsm.
  Logic is mirrored in a Python replica (build.py, replica.py, tests) because no Excel in the cloud.
- CI/PL templates = the user's own original CI/PL file with values replaced by {{placeholders}}
  (fonts, fills, widths, print setup, signature image kept). Output sheet names: INVOICE / Packing / detail.
- Invoice No. = prefix + YYMM + 2-digit monthly serial, taken from the yearly ledger file
  (one row per invoice appended at the bottom; month separator row "N월" added when the month changes;
  NO. restarts monthly; columns found by header names in Settings).
- Order number (수주번호) is typed by hand in the Input sheet (comma separated). No ERP access.
- G.W optional. No shipping mark. PL Net Weight = per EA; total in the G.TOTAL row.
- Weights: shared WeightDB first, then SWG / RTJ tables (octagonal vs oval by description).
- Macros named for Alt+F8 order: A_Generate_CIPL, B_Load_Customer, C_Refresh_Lists, D_Setup, Z_Clear_RAW.
- 8+ items -> "As per appendix" in CI/PL body and item list on the detail sheet.

## Current state
- v4 delivered as CIPL_Tool_v4.zip (contains src/ with build.py, replica.py, test.py,
  test_ledger.py, guide.txt, vbacheck.py and HANDOFF_private.md with full details).
- User confirmed the ledger writing works in real Excel (v3). v4 (original-format templates,
  optional G.W, macro rename, per-EA weight) is not yet confirmed in real Excel.
- Nothing about the tool is committed to this repo (by design).

## Next steps
1. Ask the user to re-upload CIPL_Tool_v4.zip (and the original CI/PL sample if templates change);
   the cloud container that had the files is gone.
2. Get feedback on the v4 first run (layout vs. original, stamp image, row insertion, totals).
3. Fix issues in the .bas and replica, re-run tests, deliver v5 as a zip attachment.

## Notes
- Chat in plain Korean; user is token-conscious. Committed files stay in English.
- LibreOffice Calc can be installed (apt) to render xlsx -> pdf for visual checks; openpyxl needs
  Pillow to keep images.
- Weight-table outliers exist in the user's tables (some 300LB lighter than 150LB); not changed.
