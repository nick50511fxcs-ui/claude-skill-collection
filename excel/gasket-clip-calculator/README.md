# Gasket clip (spacer) calculator

`GasketClipCalculator.xlsm` reads an order detail list, finds each line's pipe
size and pressure class, and works out how many packing clips (spacers) each
order and the whole list need. The user guide inside the workbook is in Korean,
written for people who rarely use Excel.

## Rule

From JIC-3S-PSG-25-001 Rev.9, 4.3 Gasket Bundles & Spacer Requirements (Table 3).
`10-4` means 10 gaskets per bundle and 4 clips per bundle; `1-0` means one per
bundle and no clips; `N/A` means there is no rule for that size and class.

- bundles per line = ceil(quantity / bundle size)
- base clips per line = bundles × clips per bundle
- final clips (total) = ceil(sum of every line's base clips × 1.2); each order
  row shows ceil(order base × 1.2), so order rows can add up to a few more than
  the total
- 36" and larger: packed one by one, no clips, whatever the class (user rule that
  replaces the spec's 36" row)

- a multi-rated spec such as `150/300LB` can be packed as either class, so the
  first listed class the table has a rule for is used; shortened forms such as
  `9/1500LB` read as 900/1500; the choice is written to the note column
- several orders at once: pick several files on import (each file is one order,
  named after the file), or paste lists one below another; every repeated header
  row starts a new order, named by a single-cell row just above it, else
  `수주입력!B3` (first list only), else "수주 1", "수주 2", ...

The table and the 1.2 factor are editable on the `클립기준표` and `설정` sheets.

## Sheets

| Sheet | Purpose |
|---|---|
| 사용설명서 | User guide and buttons |
| 결과요약 | Report: total and per-order clips, PDF export |
| 계산상세 | One row per order line, with formulas; lines that could not be calculated are orange |
| 수주입력 | Where the order list goes (imported by button or pasted at A5); ships with sample data |
| 클립기준표 | The bundle/clip table |
| 설정 | Margin factor, manual column mapping, item keyword filter |

## How parsing works

The macro finds the header row by column names (수주번호/ORDER NO, 품명/규격/DESCRIPTION,
SIZE, CLASS/RATING, 수량/QTY). Size and class come from dedicated columns when
they exist, otherwise from the description text, using markers such as
`1-1/2"`, `2IN`, `NPS 6`, `50A`, `DN50`, `150LB`, `150#`, `CL150`, `CLASS 150`.
Blank order numbers inherit the one above; total/subtotal rows are skipped.

## Rebuilding

```
python3 build/build.py                  # writes GasketClipCalculator.xlsm
python3 build/lo_test.py GasketClipCalculator.xlsm [orders.xlsx]   # optional smoke test
```

`build/vbaproject.py` writes the VBA project (`vbaProject.bin`) from
`vba/ClipCalc.bas` without needing Excel. It stores source code only, so Excel
compiles it when the file is opened. `lo_test.py` runs the macro in headless
LibreOffice; it needs `SOFFICE_HELPER` set to the directory holding
`office/soffice.py` from the xlsx skill. A final check in desktop Excel is still
recommended.
