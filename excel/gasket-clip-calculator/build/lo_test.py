"""Smoke-test the workbook's VBA in headless LibreOffice (its VBA compatibility mode).

    python3 build/lo_test.py GasketClipCalculator.xlsm [orders.xlsx]

Without orders.xlsx the sample data already on the input sheet is used; with it,
that file's first sheet is pasted onto the input sheet (as ImportAndCalc does).
Prints the detail and summary sheets after DoCalc runs. LibreOffice is not Excel:
this catches parsing/logic errors, final checks still belong in Excel.
"""
import os
import subprocess
import sys
import tempfile
import time

import uno
from com.sun.star.beans import PropertyValue

sys.path.insert(0, os.environ.get("SOFFICE_HELPER", ""))
from office.soffice import get_soffice_env  # noqa: E402


def prop(name, value):
    p = PropertyValue()
    p.Name, p.Value = name, value
    return p


def main(path, orders=None):
    profile = tempfile.mkdtemp(prefix="lo_profile_")
    pipe = "lotest%d" % os.getpid()
    proc = subprocess.Popen(
        ["soffice", f"-env:UserInstallation=file://{profile}", "--headless", "--norestore",
         f"--accept=pipe,name={pipe};urp;"], env=get_soffice_env())
    try:
        local = uno.getComponentContext()
        resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
        for _ in range(60):
            try:
                ctx = resolver.resolve(f"uno:pipe,name={pipe};urp;StarOffice.ComponentContext")
                break
            except Exception:
                time.sleep(0.5)
        desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
        doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(os.path.abspath(path)), "_blank", 0,
                                           (prop("Hidden", True), prop("MacroExecutionMode", 4)))
        sheets = doc.Sheets
        if orders:
            src = desktop.loadComponentFromURL(uno.systemPathToFileUrl(os.path.abspath(orders)), "_blank", 0,
                                               (prop("Hidden", True),))
            s = src.Sheets.getByIndex(0)
            cur = s.createCursor()
            cur.gotoEndOfUsedArea(False)
            data = s.getCellRangeByPosition(0, 0, cur.RangeAddress.EndColumn, cur.RangeAddress.EndRow).DataArray
            src.close(True)
            inp = sheets.getByName("수주입력")
            inp.getCellRangeByName("A5:Z500").clearContents(1 | 2 | 4 | 16)
            inp.getCellRangeByPosition(0, 4, len(data[0]) - 1, 4 + len(data) - 1).DataArray = data
        sp = doc.getScriptProvider()
        script = sp.getScript("vnd.sun.star.script:VBAProject.ClipCalc.DoCalc?language=Basic&location=document")
        result = script.invoke((False,), (), ())
        print("DoCalc returned", result[0])
        doc.calculateAll()

        def dump(name, rng):
            sh = sheets.getByName(name)
            print("==", name)
            for row in sh.getCellRangeByName(rng).DataArray:
                if any(str(v).strip() for v in row):
                    print(" | ".join(str(v) for v in row))

        dump("계산상세", "A4:N60")
        dump("결과요약", "B4:H40")
        if os.environ.get("PDF_OUT"):
            doc.storeToURL(uno.systemPathToFileUrl(os.path.abspath(os.environ["PDF_OUT"])),
                           (prop("FilterName", "calc_pdf_Export"),))
        doc.close(True)
    finally:
        proc.terminate()
        proc.wait()


if __name__ == "__main__":
    main(*sys.argv[1:])
