Option Explicit

' Gasket bundle clip (spacer) calculator.
'
' Sheets are referenced by code name, so renaming a tab does not break the macro:
'   shGuide, shSummary, shDetail, shInput, shTable, shSetting
' Settings and lookup tables are read through workbook names (setFactor, tblMin, ...).
'
' build.py turns every non-ASCII string literal in this file into U("hex") before
' it is packed into the workbook, so the project runs under any Windows code page.

Private Const INPUT_FIRST_ROW As Long = 5
Private Const HEADER_SCAN_ROWS As Long = 40
Private Const DET_FIRST As Long = 5
Private Const SUM_FIRST As Long = 12

Private Const F_ORDER As Long = 1
Private Const F_DESC As Long = 2
Private Const F_SIZE As Long = 3
Private Const F_CLASS As Long = 4
Private Const F_QTY As Long = 5
Private Const F_SPEC As Long = 6   ' second description column (spec next to item name)
Private Const N_FIELDS As Long = 6

Private kwExact(1 To N_FIELDS) As Variant
Private kwContains(1 To N_FIELDS) As Variant
Private kwExclude(1 To N_FIELDS) As Variant
Private tMin As Variant, tMax As Variant, tCls As Variant, tData As Variant

' ============================================================ buttons

' Button: pick an order file, copy it into the input sheet, then calculate.
Public Sub ImportAndCalc()
    Dim f As Variant, wb As Workbook, src As Worksheet, ws As Worksheet
    Dim lr As Long, lc As Long, cols(1 To N_FIELDS) As Long, dn As Boolean
    Dim v As Variant, r As Long, c As Long, fileName As String

    f = Application.GetOpenFilename("Excel/CSV (*.xlsx;*.xlsm;*.xls;*.csv),*.xlsx;*.xlsm;*.xls;*.csv", , "수주 상세 내역 파일을 선택하세요")
    If VarType(f) = vbBoolean Then Exit Sub

    On Error GoTo Fail
    Application.ScreenUpdating = False
    Set wb = Workbooks.Open(Filename:=f, ReadOnly:=True, UpdateLinks:=0)
    fileName = wb.Name

    ' Prefer the first sheet whose header row can be recognized.
    For Each ws In wb.Worksheets
        lr = LastUsedRow(ws)
        lc = LastUsedCol(ws)
        If lr > 0 Then
            If FindHeaderRow(ws, 1, lr, lc, cols, dn) > 0 Then Set src = ws: Exit For
            If src Is Nothing Then Set src = ws
        End If
    Next ws
    If src Is Nothing Then
        wb.Close SaveChanges:=False
        Application.ScreenUpdating = True
        MsgBox "선택한 파일에 데이터가 없습니다.", vbExclamation
        Exit Sub
    End If

    lr = LastUsedRow(src)
    lc = LastUsedCol(src)
    v = src.Range(src.Cells(1, 1), src.Cells(lr, lc)).Value
    If Not IsArray(v) Then
        Dim one(1 To 1, 1 To 1) As Variant
        one(1, 1) = v
        v = one
    End If
    ' Keep text as text: without the apostrophe Excel would turn 1/2 into a date.
    For r = 1 To UBound(v, 1)
        For c = 1 To UBound(v, 2)
            If VarType(v(r, c)) = vbString Then
                If Len(v(r, c)) > 0 Then v(r, c) = "'" & v(r, c)
            End If
        Next c
    Next r
    wb.Close SaveChanges:=False
    Set wb = Nothing

    ClearInputData
    shInput.Cells(INPUT_FIRST_ROW, 1).Resize(UBound(v, 1), UBound(v, 2)).Value = v
    SetSourceInfo fileName & "  (" & src.Name & ")"
    Application.ScreenUpdating = True

    DoCalc True
    Exit Sub
Fail:
    Application.ScreenUpdating = True
    If Not wb Is Nothing Then wb.Close SaveChanges:=False
    MsgBox "파일을 불러오는 중 문제가 생겼습니다." & vbCrLf & Err.Description, vbExclamation
End Sub

' Button: calculate from whatever is on the input sheet.
Public Sub RunClipCalc()
    DoCalc True
End Sub

' Button: clear input and results.
Public Sub ResetAll()
    If MsgBox("입력한 수주 내역과 계산 결과를 모두 지울까요?", vbQuestion + vbYesNo) <> vbYes Then Exit Sub
    Application.ScreenUpdating = False
    ClearInputData
    SetSourceInfo ""
    ThisWorkbook.Names("inputOrderNo").RefersToRange.Value = ""
    ClearDetail
    ClearSummary True
    Application.ScreenUpdating = True
    shInput.Activate
    shInput.Range("A" & INPUT_FIRST_ROW).Select
    MsgBox "초기화했습니다. 수주입력 시트의 A5 셀부터 새 내역을 붙여넣으세요.", vbInformation
End Sub

' Button: save the summary sheet as PDF.
Public Sub ExportSummaryPdf()
    Dim f As Variant
    f = Application.GetSaveAsFilename(InitialFileName:="클립소요량_" & Format(Now, "yyyymmdd_hhnn") & ".pdf", FileFilter:="PDF (*.pdf),*.pdf")
    If VarType(f) = vbBoolean Then Exit Sub
    On Error GoTo Fail
    shSummary.ExportAsFixedFormat Type:=xlTypePDF, Filename:=f, Quality:=xlQualityStandard, IgnorePrintAreas:=False, OpenAfterPublish:=True
    Exit Sub
Fail:
    MsgBox "PDF 저장에 실패했습니다." & vbCrLf & Err.Description, vbExclamation
End Sub

' ============================================================ main calculation

' Returns the number of item lines calculated (0 when nothing could be done).
Public Function DoCalc(ByVal interactive As Boolean) As Long
    Dim ws As Worksheet, calcMode As Long
    Dim lastRow As Long, lastCol As Long, headerRow As Long
    Dim cols(1 To N_FIELDS) As Long, dnMode As Boolean
    Dim data As Variant, outV() As Variant, srcRow() As Variant
    Dim orders As New Collection
    Dim r As Long, c As Long, n As Long, msg As String
    Dim rowText As String, descText As String, otherText As String
    Dim orderText As String, lastOrder As String
    Dim qty As Variant, sizeV As Double, classV As Long, filters As Variant
    Dim classText As String, note As String, noteV() As Variant, defaultOrder As String

    On Error GoTo Fail
    InitKeywords
    LoadTable
    Set ws = shInput
    calcMode = Application.Calculation
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationManual

    lastRow = LastUsedRow(ws)
    lastCol = LastUsedCol(ws)
    If lastRow < INPUT_FIRST_ROW Then
        msg = "수주입력 시트에 데이터가 없습니다." & vbCrLf & "[수주 파일 불러오기] 버튼을 누르거나, A5 셀부터 수주 내역을 붙여넣은 뒤 다시 실행하세요."
        GoTo Done
    End If

    headerRow = FindHeaderRow(ws, InputScanStart(), lastRow, lastCol, cols, dnMode)
    ApplyOverrides cols, headerRow, dnMode
    If headerRow = 0 Then
        msg = "수주 내역의 제목 행(수주번호 / 품명 / 수량 등)을 찾지 못했습니다." & vbCrLf & "설정 시트에서 '제목 행 번호'와 각 열을 직접 지정한 뒤 다시 실행하세요."
        GoTo Done
    End If
    If cols(F_QTY) = 0 Or (cols(F_DESC) = 0 And cols(F_SIZE) = 0) Then
        msg = "필요한 열을 찾지 못했습니다." & vbCrLf & ColumnReport(cols) & vbCrLf & vbCrLf & "설정 시트에서 해당 열(예: B)을 직접 지정한 뒤 다시 실행하세요."
        GoTo Done
    End If

    data = ws.Range(ws.Cells(1, 1), ws.Cells(lastRow, lastCol)).Value
    filters = FilterKeywords()
    ReDim outV(1 To lastRow, 1 To 6)
    ReDim srcRow(1 To lastRow, 1 To 1)
    ReDim noteV(1 To lastRow, 1 To 1)
    ' Order lists without an order number column use the number typed on the input sheet.
    defaultOrder = Trim$(SafeText(Setting("inputOrderNo")))
    If Len(defaultOrder) = 0 Then defaultOrder = "(수주번호 미입력)"

    For r = headerRow + 1 To lastRow
        rowText = ""
        otherText = ""
        For c = 1 To lastCol
            If Len(SafeText(data(r, c))) > 0 Then
                rowText = rowText & " " & SafeText(data(r, c))
                If c <> cols(F_ORDER) And c <> cols(F_QTY) Then otherText = otherText & " " & SafeText(data(r, c))
            End If
        Next c
        If Len(Trim$(rowText)) = 0 Then GoTo NextRow

        descText = ""
        If cols(F_DESC) > 0 Then descText = Trim$(SafeText(data(r, cols(F_DESC))))
        If cols(F_SPEC) > 0 Then descText = Trim$(descText & " " & SafeText(data(r, cols(F_SPEC))))
        orderText = ""
        If cols(F_ORDER) > 0 Then orderText = Trim$(SafeText(data(r, cols(F_ORDER))))
        If IsTotalRow(descText) Or IsTotalRow(orderText) Or IsTotalRow(FirstText(data, r, lastCol)) Then GoTo NextRow
        If Not PassesFilter(rowText, filters) Then GoTo NextRow

        ' Size: dedicated column first, then the description, then the rest of the row.
        sizeV = 0
        If cols(F_SIZE) > 0 Then sizeV = ParseSizeCell(data(r, cols(F_SIZE)), dnMode)
        If sizeV = 0 And Len(descText) > 0 Then sizeV = ParseSizeText(descText, False, False)
        If sizeV = 0 Then sizeV = ParseSizeText(otherText, False, False)

        ' Class: same order. 300/600LB style ratings list every class.
        classText = ""
        If cols(F_CLASS) > 0 Then classText = ParseClassCell(data(r, cols(F_CLASS)))
        If Len(classText) = 0 And Len(descText) > 0 Then classText = ParseClassText(descText)
        If Len(classText) = 0 Then classText = ParseClassText(otherText)
        classV = PickClass(classText, sizeV, note)

        qty = ParseQty(data(r, cols(F_QTY)))
        ' A row with no quantity and no recognizable gasket spec is a note, not an item.
        If IsEmpty(qty) And sizeV = 0 And classV = 0 Then GoTo NextRow

        If cols(F_ORDER) > 0 Then
            If Len(orderText) = 0 Then orderText = lastOrder Else lastOrder = orderText
        End If
        If Len(orderText) = 0 Then orderText = defaultOrder

        n = n + 1
        outV(n, 1) = n
        outV(n, 2) = orderText
        outV(n, 3) = ItemText(data, r, cols)
        If Not IsEmpty(qty) Then outV(n, 4) = qty
        If sizeV > 0 Then outV(n, 5) = sizeV
        If classV > 0 Then outV(n, 6) = classV
        srcRow(n, 1) = r
        noteV(n, 1) = note
        AddUnique orders, orderText
NextRow:
    Next r

    If n = 0 Then
        msg = "계산할 품목을 찾지 못했습니다." & vbCrLf & ColumnReport(cols) & vbCrLf & "제목 행: " & headerRow & "행"
        GoTo Done
    End If

    WriteDetail n, outV, srcRow, noteV
    WriteSummary orders, DET_FIRST + n - 1
    DoCalc = n

Done:
    On Error Resume Next
    Application.Calculation = calcMode
    Application.Calculate
    Application.ScreenUpdating = True
    If interactive Then
        If DoCalc > 0 Then
            shSummary.Activate
            shSummary.Range("A1").Select
            msg = "계산이 끝났습니다." & vbCrLf & vbCrLf & _
                  "수주 " & orders.Count & "건 / 품목 " & n & "라인" & vbCrLf & _
                  "최종 필요 클립: " & Format(shSummary.Range("B8").Value, "#,##0") & "개" & vbCrLf & _
                  "(기본 " & Format(shSummary.Range("D8").Value, "#,##0") & "개 × 여유 계수 " & Setting("setFactor") & ", 수주별 올림)"
            If shSummary.Range("H8").Value > 0 Then
                msg = msg & vbCrLf & vbCrLf & "※ 확인이 필요한 품목 " & shSummary.Range("H8").Value & "라인은 클립 계산에서 빠졌습니다." & vbCrLf & "   계산상세 시트의 주황색 행을 확인하세요."
                MsgBox msg, vbExclamation
            Else
                MsgBox msg, vbInformation
            End If
        Else
            MsgBox msg, vbExclamation
        End If
    End If
    Exit Function
Fail:
    msg = "계산 중 오류가 발생했습니다." & vbCrLf & Err.Description
    DoCalc = 0
    Resume Done
End Function

' ============================================================ output sheets

Private Sub WriteDetail(ByVal n As Long, outV() As Variant, srcRow() As Variant, noteV() As Variant)
    Dim ws As Worksheet, lastR As Long, f As Long
    Set ws = shDetail
    ClearDetail
    lastR = DET_FIRST + n - 1
    f = DET_FIRST
    ws.Range("B" & f & ":C" & lastR).NumberFormat = "@"
    ws.Range("A" & f & ":F" & lastR).Value = outV
    ws.Range("N" & f & ":N" & lastR).Value = srcRow
    ws.Range("O" & f & ":O" & lastR).Value = noteV

    ' R1C1 with absolute columns: the same text is correct on every row.
    ws.Range("G" & f & ":G" & lastR).FormulaR1C1 = "=IF(RC5="""","""",IF(RC5<MIN(tblMin),""표에 없음"",IF(RC5<=INDEX(tblMax,MATCH(RC5,tblMin,1)),INDEX(tblLabel,MATCH(RC5,tblMin,1)),""표에 없음"")))"
    ws.Range("H" & f & ":H" & lastR).FormulaR1C1 = "=IF(OR(RC7="""",RC7=""표에 없음"",RC6=""""),"""",IFERROR(INDEX(tblData,MATCH(RC5,tblMin,1),MATCH(RC6,tblClass,0)),""표에 없음""))"
    ws.Range("I" & f & ":I" & lastR).FormulaR1C1 = "=IF(ISERROR(FIND(""-"",RC8)),"""",VALUE(LEFT(RC8,FIND(""-"",RC8)-1)))"
    ws.Range("J" & f & ":J" & lastR).FormulaR1C1 = "=IF(RC9="""","""",VALUE(MID(RC8,FIND(""-"",RC8)+1,10)))"
    ws.Range("K" & f & ":K" & lastR).FormulaR1C1 = "=IF(OR(RC9="""",NOT(ISNUMBER(RC4))),"""",ROUNDUP(RC4/RC9,0))"
    ws.Range("L" & f & ":L" & lastR).FormulaR1C1 = "=IF(RC11="""","""",RC11*RC10)"
    ws.Range("M" & f & ":M" & lastR).FormulaR1C1 = "=IF(RC12<>"""",""OK"",IF(NOT(ISNUMBER(RC4)),""수량 확인 필요"",IF(RC5="""",""Size 인식 실패"",IF(RC6="""",""Class 인식 실패"",IF(RC7=""표에 없음"",""기준표에 없는 Size"",IF(RC8=""N/A"",""N/A (기준 없음)"",IF(RC8=""표에 없음"",""기준표에 없는 Class"",""확인 필요"")))))))"

    With ws.Range("A" & f & ":O" & lastR).Borders
        .LineStyle = xlContinuous
        .Color = RGB(191, 191, 191)
        .Weight = xlThin
    End With
    ws.Range("A4:O" & lastR).AutoFilter
End Sub

Private Sub ClearDetail()
    Dim ws As Worksheet, lastR As Long
    Set ws = shDetail
    If ws.AutoFilterMode Then ws.AutoFilterMode = False
    lastR = LastUsedRow(ws)
    If lastR >= DET_FIRST Then
        ws.Range("A" & DET_FIRST & ":O" & lastR).ClearContents
        ws.Range("A" & DET_FIRST & ":O" & lastR).Borders.LineStyle = xlNone
    End If
End Sub

Private Sub WriteSummary(orders As Collection, ByVal detLast As Long)
    Dim ws As Worksheet, i As Long, lastR As Long, totR As Long, noteR As Long
    Dim dB As String, dD As String, dL As String, dM As String, p As String
    Set ws = shSummary
    ClearSummary False

    p = "'" & shDetail.Name & "'!"
    dB = p & "R" & DET_FIRST & "C2:R" & detLast & "C2"
    dD = p & "R" & DET_FIRST & "C4:R" & detLast & "C4"
    dL = p & "R" & DET_FIRST & "C12:R" & detLast & "C12"
    dM = p & "R" & DET_FIRST & "C13:R" & detLast & "C13"

    lastR = SUM_FIRST + orders.Count - 1
    totR = lastR + 1
    ws.Range("B" & SUM_FIRST & ":B" & lastR).NumberFormat = "@"
    For i = 1 To orders.Count
        ws.Cells(SUM_FIRST + i - 1, 2).Value = orders(i)
    Next i

    ws.Range("C" & SUM_FIRST & ":C" & lastR).FormulaR1C1 = "=SUMPRODUCT(--(" & dB & "=RC2))"
    ws.Range("D" & SUM_FIRST & ":D" & lastR).FormulaR1C1 = "=SUMPRODUCT(--(" & dB & "=RC2)," & dD & ")"
    ws.Range("E" & SUM_FIRST & ":E" & lastR).FormulaR1C1 = "=SUMPRODUCT(--(" & dB & "=RC2)," & dL & ")"
    ws.Range("F" & SUM_FIRST & ":F" & lastR).FormulaR1C1 = "=ROUNDUP(RC5*setFactor,0)"
    ws.Range("G" & SUM_FIRST & ":G" & lastR).FormulaR1C1 = "=RC3-SUMPRODUCT(--(" & dB & "=RC2),--(" & dM & "=""OK""))"
    ws.Range("H" & SUM_FIRST & ":H" & lastR).FormulaR1C1 = "=IF(RC7>0,""계산상세 시트 확인"","""")"

    With ws.Range("B" & SUM_FIRST & ":H" & lastR)
        .Font.Size = 10
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(191, 191, 191)
        .VerticalAlignment = xlCenter
        .RowHeight = 20
    End With
    ws.Range("B" & SUM_FIRST & ":B" & lastR).HorizontalAlignment = xlLeft
    ws.Range("C" & SUM_FIRST & ":G" & lastR).HorizontalAlignment = xlRight
    ws.Range("C" & SUM_FIRST & ":E" & lastR).NumberFormat = "#,##0"
    ws.Range("F" & SUM_FIRST & ":F" & lastR).NumberFormat = "#,##0"
    ws.Range("F" & SUM_FIRST & ":F" & lastR).Font.Bold = True
    ws.Range("F" & SUM_FIRST & ":F" & lastR).Interior.Color = RGB(226, 239, 218)
    ws.Range("G" & SUM_FIRST & ":G" & lastR).NumberFormat = "[Red]#,##0;[Red]-#,##0;""-"""
    ws.Range("H" & SUM_FIRST & ":H" & lastR).Font.Color = RGB(192, 0, 0)

    ws.Cells(totR, 2).Value = "합계"
    ws.Range("C" & totR & ":G" & totR).FormulaR1C1 = "=SUM(R" & SUM_FIRST & "C:R" & lastR & "C)"
    With ws.Range("B" & totR & ":H" & totR)
        .Font.Bold = True
        .Interior.Color = RGB(31, 56, 100)
        .Font.Color = RGB(255, 255, 255)
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(31, 56, 100)
        .RowHeight = 24
        .VerticalAlignment = xlCenter
    End With
    ws.Range("C" & totR & ":F" & totR).NumberFormat = "#,##0"
    ws.Range("G" & totR).NumberFormat = "#,##0;-#,##0;""-"""

    ' KPI cards
    ws.Range("B8").Formula = "=F" & totR
    ws.Range("D8").Formula = "=E" & totR
    ws.Range("E8").Formula = "=COUNTA(B" & SUM_FIRST & ":B" & lastR & ")"
    ws.Range("F8").Formula = "=C" & totR
    ws.Range("G8").Formula = "=D" & totR
    ws.Range("H8").Formula = "=G" & totR
    ws.Range("C4").Value = Now
    ws.Range("F4").Value = SourceInfo()

    noteR = totR + 2
    ws.Cells(noteR, 2).Value = "※ 계산 방법: 품목별 묶음 수 = 수량 ÷ 묶음당 수량(올림),  기본 클립 = 묶음 수 × 묶음당 클립"
    ws.Cells(noteR + 1, 2).Value = "※ 최종 클립 = 수주별 기본 클립 × 여유 계수 후 소수점 올림.  전체 최종 클립은 수주별 최종 클립의 합계입니다."
    ws.Cells(noteR + 2, 2).Value = "※ '확인 필요 라인'이 있으면 해당 품목은 클립 계산에서 빠져 있습니다. 계산상세 시트의 주황색 행을 확인하세요."
    With ws.Range("B" & noteR & ":B" & noteR + 2)
        .Font.Size = 9
        .Font.Color = RGB(89, 89, 89)
    End With

    On Error Resume Next
    ws.PageSetup.PrintArea = "$B$2:$H$" & (noteR + 2)
    On Error GoTo 0
End Sub

Private Sub ClearSummary(ByVal showPlaceholder As Boolean)
    Dim ws As Worksheet
    Set ws = shSummary
    ws.Range(ws.Rows(SUM_FIRST), ws.Rows(SUM_FIRST + 5000)).UnMerge
    ws.Range(ws.Rows(SUM_FIRST), ws.Rows(SUM_FIRST + 5000)).Clear
    ws.Range(ws.Rows(SUM_FIRST), ws.Rows(SUM_FIRST + 5000)).RowHeight = 16.5
    ws.Range("B8").MergeArea.ClearContents
    ws.Range("D8:H8").ClearContents
    If showPlaceholder Then
        ws.Range("C4").MergeArea.ClearContents
        ws.Range("F4").MergeArea.ClearContents
        ws.Cells(SUM_FIRST, 2).Value = "아직 계산 전입니다. [② 붙여넣은 내역으로 계산] 버튼을 눌러 주세요."
        ws.Cells(SUM_FIRST, 2).Font.Color = RGB(128, 128, 128)
    End If
End Sub

Private Sub ClearInputData()
    Dim ws As Worksheet
    Set ws = shInput
    ws.Range(ws.Rows(INPUT_FIRST_ROW), ws.Rows(ws.Rows.Count)).Clear
End Sub

Private Sub SetSourceInfo(ByVal s As String)
    ThisWorkbook.Names("infoSource").RefersToRange.Value = s
End Sub

Private Function SourceInfo() As String
    SourceInfo = SafeText(ThisWorkbook.Names("infoSource").RefersToRange.Value)
    If Len(SourceInfo) = 0 Then SourceInfo = "수주입력 시트에 직접 붙여넣은 데이터"
End Function

' ============================================================ header detection

Private Sub InitKeywords()
    kwExact(F_ORDER) = Split("수주번호|수주NO|수주#|오더번호|주문번호|ORDERNO|ORDER#|SONO|SO#|SO|PONO|PO#|PO|JOBNO|수주", "|")
    kwContains(F_ORDER) = Split("수주번호|수주NO|오더번호|주문번호|ORDERNO|SONO|PONO|JOBNO|수주|ORDER|오더", "|")
    kwExclude(F_ORDER) = Split("일자|일|DATE|날짜|금액|단가|수량|QTY|처|명|고객|CUSTOMER|ITEM", "|")

    kwExact(F_DESC) = Split("규격|품명및규격|품명/규격|DESCRIPTION|ITEMDESCRIPTION|MATERIALDESCRIPTION|SPEC|SPECIFICATION|사양|품명|품목명|제품명|자재명|DESC|품목|ITEM", "|")
    kwContains(F_DESC) = Split("DESCRIPTION|품명|품목|규격|사양|자재|제품|SPEC|ITEM|DESC", "|")
    kwExclude(F_DESC) = Split("코드|CODE|NO|번호|수량|QTY|단위|UNIT|#", "|")

    kwExact(F_SPEC) = kwExact(F_DESC)
    kwContains(F_SPEC) = kwContains(F_DESC)
    kwExclude(F_SPEC) = kwExclude(F_DESC)

    kwExact(F_SIZE) = Split("SIZE|사이즈|NPS|호칭|호칭경|구경|DN|크기", "|")
    kwContains(F_SIZE) = Split("SIZE|사이즈|NPS|호칭|구경", "|")
    kwExclude(F_SIZE) = Split("", "|")

    kwExact(F_CLASS) = Split("CLASS|RATING|PRESSURE|PRESSURECLASS|압력|등급|레이팅|LB|LBS", "|")
    kwContains(F_CLASS) = Split("CLASS|RATING|PRESSURE|압력|등급", "|")
    kwExclude(F_CLASS) = Split("", "|")

    kwExact(F_QTY) = Split("수량|QTY|QUANTITY|수주수량|오더수량|주문수량|EA|개수", "|")
    kwContains(F_QTY) = Split("수량|QTY|QUANTITY", "|")
    kwExclude(F_QTY) = Split("단가|금액|잔|출고|납품|단위|UNIT|PRICE|AMOUNT", "|")
End Sub

' Returns the header row (0 when none) and fills cols() with the column of each field.
Private Function FindHeaderRow(ByVal ws As Worksheet, ByVal firstRow As Long, ByVal lastRow As Long, ByVal lastCol As Long, cols() As Long, dnMode As Boolean) As Long
    Dim r As Long, maxR As Long
    If Not IsArray(kwExact(F_QTY)) Then InitKeywords
    maxR = lastRow
    If maxR > firstRow + HEADER_SCAN_ROWS Then maxR = firstRow + HEADER_SCAN_ROWS
    For r = firstRow To maxR
        If MapHeader(ws, r, lastCol, cols) >= 2 Then
            If cols(F_QTY) > 0 Or cols(F_DESC) > 0 Or cols(F_SIZE) > 0 Then
                FindHeaderRow = r
                dnMode = False
                If cols(F_SIZE) > 0 Then dnMode = IsDnHeader(SafeText(ws.Cells(r, cols(F_SIZE)).Value))
                Exit Function
            End If
        End If
    Next r
    For r = 1 To N_FIELDS
        cols(r) = 0
    Next r
End Function

Private Function MapHeader(ByVal ws As Worksheet, ByVal r As Long, ByVal lastCol As Long, cols() As Long) As Long
    Dim fieldOrder As Variant, f As Variant, kw As Variant, c As Long, k As Long, pass As Long
    Dim hdr() As String
    ReDim hdr(1 To lastCol)
    For c = 1 To lastCol
        hdr(c) = NormHeader(ws.Cells(r, c).Value)
        If Len(hdr(c)) > 20 Then hdr(c) = ""
    Next c
    For k = 1 To N_FIELDS
        cols(k) = 0
    Next k
    fieldOrder = Array(F_QTY, F_ORDER, F_SIZE, F_CLASS, F_DESC, F_SPEC)
    For pass = 1 To 2
        For Each f In fieldOrder
            If cols(f) = 0 Then
                If pass = 1 Then
                    ' Exact names, in keyword priority order (spec before item code).
                    For Each kw In kwExact(f)
                        For c = 1 To lastCol
                            If hdr(c) = kw Then
                                If Not ColumnTaken(cols, c) Then cols(f) = c: Exit For
                            End If
                        Next c
                        If cols(f) > 0 Then Exit For
                    Next kw
                Else
                    For c = 1 To lastCol
                        If Len(hdr(c)) > 0 Then
                            If Not ColumnTaken(cols, c) Then
                                If MatchContains(hdr(c), CLng(f)) Then cols(f) = c: Exit For
                            End If
                        End If
                    Next c
                End If
            End If
        Next f
    Next pass
    For k = 1 To N_FIELDS
        If cols(k) > 0 Then MapHeader = MapHeader + 1
    Next k
End Function

Private Function ColumnTaken(cols() As Long, ByVal c As Long) As Boolean
    Dim k As Long
    For k = 1 To N_FIELDS
        If cols(k) = c Then ColumnTaken = True: Exit Function
    Next k
End Function

Private Function MatchContains(ByVal h As String, ByVal f As Long) As Boolean
    Dim k As Variant
    For Each k In kwExclude(f)
        If InStr(1, h, k, vbBinaryCompare) > 0 Then Exit Function
    Next k
    For Each k In kwContains(f)
        If InStr(1, h, k, vbBinaryCompare) > 0 Then MatchContains = True: Exit Function
    Next k
End Function

' On the input sheet, skip the instruction rows above A5 while they are still there.
Private Function InputScanStart() As Long
    InputScanStart = 1
    If Left$(SafeText(shInput.Range("A4").Value), 1) = "▼" Then InputScanStart = INPUT_FIRST_ROW
End Function

Private Function NormHeader(ByVal v As Variant) As String
    Dim s As String, ch As Variant
    s = UCase$(SafeText(v))
    For Each ch In Array(" ", ".", "_", "-", "'", "(", ")", "[", "]", ":", vbCr, vbLf, vbTab, ChrW(160), ChrW(&H3000))
        s = Replace(s, ch, "")
    Next ch
    NormHeader = s
End Function

Private Function IsDnHeader(ByVal s As String) As Boolean
    s = UCase$(s)
    IsDnHeader = InStr(s, "(A)") > 0 Or InStr(s, "DN") > 0 Or InStr(s, "MM") > 0
End Function

' Manual overrides from the settings sheet (blank = automatic).
Private Sub ApplyOverrides(cols() As Long, headerRow As Long, dnMode As Boolean)
    Dim fieldNames As Variant, k As Long, c As Long, hr As Variant
    hr = Setting("setHeaderRow")
    If IsNumeric(hr) And Len(SafeText(hr)) > 0 Then
        If CLng(hr) > 0 Then
            If CLng(hr) <> headerRow Then
                headerRow = CLng(hr)
                MapHeader shInput, headerRow, LastUsedCol(shInput), cols
            End If
        End If
    End If
    fieldNames = Array("setColOrder", "setColDesc", "setColSize", "setColClass", "setColQty")
    For k = 0 To 4
        c = ColumnNumber(Setting(fieldNames(k)))
        If c > 0 Then
            cols(k + 1) = c
            If headerRow = 0 Then headerRow = INPUT_FIRST_ROW
        End If
    Next k
    If cols(F_SIZE) > 0 And headerRow > 0 Then dnMode = IsDnHeader(SafeText(shInput.Cells(headerRow, cols(F_SIZE)).Value))
End Sub

Private Function ColumnNumber(ByVal v As Variant) As Long
    Dim s As String
    s = UCase$(Trim$(SafeText(v)))
    If Len(s) = 0 Then Exit Function
    If IsNumeric(s) Then ColumnNumber = CLng(s): Exit Function
    On Error Resume Next
    ColumnNumber = shInput.Range(s & "1").Column
    On Error GoTo 0
End Function

Private Function Setting(ByVal nm As String) As Variant
    On Error Resume Next
    Setting = ThisWorkbook.Names(nm).RefersToRange.Value
End Function

Private Function ColumnReport(cols() As Long) As String
    Dim labels As Variant, k As Long, s As String
    labels = Array("수주번호", "품명/규격", "Size", "Class", "수량")
    For k = 1 To 5
        If cols(k) > 0 Then
            s = s & vbCrLf & "  - " & labels(k - 1) & ": " & ColLetter(cols(k)) & "열"
        Else
            s = s & vbCrLf & "  - " & labels(k - 1) & ": (못 찾음)"
        End If
    Next k
    ColumnReport = "인식한 열:" & s
End Function

Private Function ColLetter(ByVal c As Long) As String
    ColLetter = Split(shInput.Cells(1, c).Address(True, False), "$")(0)
End Function

' ============================================================ text parsing

Private Function NormText(ByVal s As String) As String
    Dim t As String
    t = UCase$(s)
    t = Replace(t, ChrW(&H201D), """")
    t = Replace(t, ChrW(&H201C), """")
    t = Replace(t, ChrW(&H2033), """")
    t = Replace(t, ChrW(&HFF02), """")
    t = Replace(t, ChrW(&H2019) & ChrW(&H2019), """")
    t = Replace(t, "''", """")
    t = Replace(t, vbCr, " ")
    t = Replace(t, vbLf, " ")
    t = Replace(t, vbTab, " ")
    t = Replace(t, ChrW(160), " ")
    t = Replace(t, ChrW(&H3000), " ")
    t = Replace(t, "LBS", "LB")
    NormText = t
End Function

Private Function DigitAt(ByVal t As String, ByVal i As Long) As Boolean
    Dim a As Long
    If i < 1 Or i > Len(t) Then Exit Function
    a = AscW(Mid$(t, i, 1))
    DigitAt = (a >= 48 And a <= 57)
End Function

Private Function LetterAt(ByVal t As String, ByVal i As Long) As Boolean
    Dim a As Long
    If i < 1 Or i > Len(t) Then Exit Function
    a = AscW(Mid$(t, i, 1))
    LetterAt = (a >= 65 And a <= 90) Or (a >= 97 And a <= 122)
End Function

Private Function CharAt(ByVal t As String, ByVal i As Long) As String
    If i >= 1 And i <= Len(t) Then CharAt = Mid$(t, i, 1)
End Function

Private Function ReadDigits(ByVal t As String, ByVal i As Long) As Long
    Do While DigitAt(t, i)
        i = i + 1
    Loop
    ReadDigits = i
End Function

Private Function SkipSpaces(ByVal t As String, ByVal i As Long) As Long
    Do While CharAt(t, i) = " "
        i = i + 1
    Loop
    SkipSpaces = i
End Function

' Text before position i with trailing separators removed, e.g. "CLASS: " -> "CLASS".
Private Function Before(ByVal t As String, ByVal i As Long) As String
    Dim s As String
    s = Left$(t, i - 1)
    Do While Len(s) > 0
        If InStr(" -.:=#", Right$(s, 1)) = 0 Then Exit Do
        s = Left$(s, Len(s) - 1)
    Loop
    Before = s
End Function

Private Function EndsWith(ByVal s As String, ByVal tail As String) As Boolean
    If Len(s) < Len(tail) Then Exit Function
    If Right$(s, Len(tail)) <> tail Then Exit Function
    ' The keyword must start a word: "CL150" yes, "XCL150" no.
    EndsWith = Not LetterAt(s, Len(s) - Len(tail))
End Function

' Starts a number at position i: whole, decimal (1.5), fraction (1/2) or mixed (1-1/2, 1 1/2).
' Sets v and the position just after the number.
Private Sub ReadNumber(ByVal t As String, ByVal i As Long, v As Double, j As Long)
    Dim k As Long, m As Long, num As Double, den As Double
    j = ReadDigits(t, i)
    v = Val(Mid$(t, i, j - i))
    If CharAt(t, j) = "." And DigitAt(t, j + 1) Then
        k = ReadDigits(t, j + 1)
        v = Val(Mid$(t, i, k - i))
        j = k
    ElseIf CharAt(t, j) = "/" And DigitAt(t, j + 1) Then
        k = ReadDigits(t, j + 1)
        den = Val(Mid$(t, j + 1, k - j - 1))
        If den > 0 Then v = v / den
        j = k
    ElseIf (CharAt(t, j) = "-" Or CharAt(t, j) = " ") And DigitAt(t, j + 1) And v <= 48 Then
        k = ReadDigits(t, j + 1)
        If CharAt(t, k) = "/" And DigitAt(t, k + 1) Then
            m = ReadDigits(t, k + 1)
            num = Val(Mid$(t, j + 1, k - j - 1))
            den = Val(Mid$(t, k + 1, m - k - 1))
            If den > 0 And num < den Then
                v = v + num / den
                j = m
            End If
        End If
    End If
End Sub

Private Function NumberStartsAt(ByVal t As String, ByVal i As Long) As Boolean
    If Not DigitAt(t, i) Then Exit Function
    If DigitAt(t, i - 1) Then Exit Function
    If CharAt(t, i - 1) = "." Or CharAt(t, i - 1) = "/" Then Exit Function
    NumberStartsAt = True
End Function

' Pipe size in inches from free text, 0 when not found.
' Needs a marker: 1-1/2"  2IN  2 INCH  NPS 6  2B  50A  DN50  SIZE 6
Private Function ParseSizeText(ByVal s As String, ByVal allowBare As Boolean, ByVal dnMode As Boolean) As Double
    Dim t As String, i As Long, j As Long, e As Long, v As Double, pre As String, res As Double
    t = NormText(s)
    i = 1
    Do While i <= Len(t)
        If NumberStartsAt(t, i) Then
            ReadNumber t, i, v, j
            res = 0
            e = SkipSpaces(t, j)
            pre = Before(t, i)
            If CharAt(t, e) = """" Then
                res = v
            ElseIf Mid$(t, e, 4) = "INCH" Or (Mid$(t, e, 2) = "IN" And Not LetterAt(t, e + 2)) Then
                res = v
            ElseIf CharAt(t, j) = "B" And Not LetterAt(t, j + 1) Then
                res = v
            ElseIf CharAt(t, j) = "A" And Not LetterAt(t, j + 1) Then
                res = DnToInch(v)
            ElseIf EndsWith(pre, "DN") Then
                res = DnToInch(v)
            ElseIf EndsWith(pre, "NPS") Or EndsWith(pre, "SIZE") Then
                If dnMode Then res = DnToInch(v) Else res = v
            End If
            If res > 0 And res <= 120 Then
                ParseSizeText = res
                Exit Function
            End If
            i = j
        Else
            i = i + 1
        End If
    Loop
    If allowBare Then
        ' The whole cell is just a number: 6, 1.5, 1-1/2, 1 1/2
        t = Trim$(t)
        If NumberStartsAt(t, 1) Then
            ReadNumber t, 1, v, j
            If j > Len(t) Then
                If dnMode Then res = DnToInch(v) Else res = v
                If res > 0 And res <= 120 Then ParseSizeText = res
            End If
        End If
    End If
End Function

Private Function ParseSizeCell(ByVal v As Variant, ByVal dnMode As Boolean) As Double
    Dim m As Long, d As Long
    If IsError(v) Or IsEmpty(v) Then Exit Function
    Select Case VarType(v)
        Case vbDate
            ' Excel turned a typed 1/2 or 3/4 into a date.
            m = Month(v)
            d = Day(v)
            If (d = 2 Or d = 4 Or d = 8 Or d = 16) And m < d Then ParseSizeCell = m / d
        Case vbDouble, vbSingle, vbInteger, vbLong, vbCurrency, vbDecimal
            If dnMode Then ParseSizeCell = DnToInch(CDbl(v)) Else ParseSizeCell = CDbl(v)
            If ParseSizeCell > 120 Or ParseSizeCell < 0 Then ParseSizeCell = 0
        Case vbString
            ParseSizeCell = ParseSizeText(CStr(v), True, dnMode)
    End Select
End Function

Private Function DnToInch(ByVal dn As Double) As Double
    Select Case dn
        Case 15: DnToInch = 0.5
        Case 20: DnToInch = 0.75
        Case 25: DnToInch = 1
        Case 32: DnToInch = 1.25
        Case 40: DnToInch = 1.5
        Case 50: DnToInch = 2
        Case 65: DnToInch = 2.5
        Case 80: DnToInch = 3
        Case 90: DnToInch = 3.5
        Case 100: DnToInch = 4
        Case 125: DnToInch = 5
        Case 150: DnToInch = 6
        Case 200: DnToInch = 8
        Case 250: DnToInch = 10
        Case 300: DnToInch = 12
        Case 350: DnToInch = 14
        Case 400: DnToInch = 16
        Case 450: DnToInch = 18
        Case 500: DnToInch = 20
        Case 550: DnToInch = 22
        Case 600: DnToInch = 24
        Case 650: DnToInch = 26
        Case 700: DnToInch = 28
        Case 750: DnToInch = 30
        Case 800: DnToInch = 32
        Case 850: DnToInch = 34
        Case 900: DnToInch = 36
        Case 1000: DnToInch = 40
        Case 1050: DnToInch = 42
        Case 1200: DnToInch = 48
    End Select
End Function

' Pressure class(es) from free text, "" when not found. A multi-rated item such as
' 150/300/600LB returns "150/300/600".
' Needs a marker: 150LB  150LBS  150#  CL150  CLASS 150  ANSI 150  RATING 150
Private Function ParseClassText(ByVal s As String) As String
    Dim t As String, i As Long, j As Long, k As Long, chain As String, ok As Boolean, pre As String
    t = NormText(s)
    i = 1
    Do While i <= Len(t)
        If NumberStartsAt(t, i) Then
            ReadClassChain t, i, chain, j, ok
            If ok Then
                k = SkipSpaces(t, j)
                If CharAt(t, k) = "#" Or Mid$(t, k, 2) = "LB" Then
                    ParseClassText = chain
                    Exit Function
                End If
                pre = Before(t, i)
                If EndsWith(pre, "CLASS") Or EndsWith(pre, "CL") Or EndsWith(pre, "RATING") Or EndsWith(pre, "ANSI") Then
                    ParseClassText = chain
                    Exit Function
                End If
            End If
            i = j
        Else
            i = i + 1
        End If
    Loop
End Function

' Reads 150 or 150/300/600 at position i. ok = every number looks like a class.
Private Sub ReadClassChain(ByVal t As String, ByVal i As Long, chain As String, j As Long, ok As Boolean)
    Dim k As Long, v As Long
    chain = ""
    ok = True
    j = i
    Do
        k = ReadDigits(t, j)
        v = 0
        If k - j <= 4 Then v = CLng(Mid$(t, j, k - j))
        If v < 75 Then ok = False
        If Len(chain) > 0 Then chain = chain & "/"
        chain = chain & CStr(v)
        j = k
        If CharAt(t, j) = "/" And DigitAt(t, j + 1) Then j = j + 1 Else Exit Do
    Loop
    If CharAt(t, j) = "." And DigitAt(t, j + 1) Then ok = False
End Sub

Private Function ParseClassCell(ByVal v As Variant) As String
    Dim t As String, chain As String, j As Long, ok As Boolean
    If IsError(v) Or IsEmpty(v) Then Exit Function
    Select Case VarType(v)
        Case vbDouble, vbSingle, vbInteger, vbLong, vbCurrency, vbDecimal
            If v >= 75 And v <= 9999 And v = Int(v) Then ParseClassCell = CStr(CLng(v))
        Case vbString
            ParseClassCell = ParseClassText(CStr(v))
            If Len(ParseClassCell) = 0 Then
                ' The whole cell is just the class: 150 or 300/600
                t = Trim$(NormText(CStr(v)))
                If NumberStartsAt(t, 1) Then
                    ReadClassChain t, 1, chain, j, ok
                    If ok And j > Len(t) Then ParseClassCell = chain
                End If
            End If
    End Select
End Function

' One class for the calculation. With several (300/600LB) take the one the table
' gives the most clips per gasket for, so clips are never under-counted; ties keep
' the first listed. note explains the choice for the detail sheet.
Private Function PickClass(ByVal classes As String, ByVal sizeV As Double, note As String) As Long
    Dim parts As Variant, k As Long, best As Long, bestRate As Double, rate As Double
    Dim nValid As Long, minRate As Double
    note = ""
    If Len(classes) = 0 Then Exit Function
    parts = Split(classes, "/")
    best = CLng(parts(0))
    If UBound(parts) > 0 Then
        bestRate = -1
        minRate = 1E+30
        For k = 0 To UBound(parts)
            rate = ClipRate(sizeV, CLng(parts(k)))
            If rate >= 0 Then
                nValid = nValid + 1
                If rate < minRate Then minRate = rate
            End If
            If rate > bestRate Then
                bestRate = rate
                best = CLng(parts(k))
            End If
        Next k
        note = "복수 Class " & classes & "# → " & best & "# 적용"
        If bestRate < 0 Then
            note = note & " (기준표 해당 없음)"
        ElseIf nValid = 1 Then
            note = note & " (기준표에 있는 Class)"
        ElseIf minRate = bestRate Then
            note = note & " (클립 기준 동일)"
        Else
            note = note & " (클립이 더 많은 기준)"
        End If
    End If
    PickClass = best
End Function

Private Sub LoadTable()
    tMin = ThisWorkbook.Names("tblMin").RefersToRange.Value
    tMax = ThisWorkbook.Names("tblMax").RefersToRange.Value
    tCls = ThisWorkbook.Names("tblClass").RefersToRange.Value
    tData = ThisWorkbook.Names("tblData").RefersToRange.Value
End Sub

' Clips per gasket for a size and class from the table, -1 when there is no rule.
Private Function ClipRate(ByVal sizeV As Double, ByVal cls As Long) As Double
    Dim r As Long, c As Long, s As String, p As Long, bundle As Double
    ClipRate = -1
    If sizeV <= 0 Then Exit Function
    For r = 1 To UBound(tMin, 1)
        If IsNumeric(tMin(r, 1)) And IsNumeric(tMax(r, 1)) Then
            If sizeV >= tMin(r, 1) And sizeV <= tMax(r, 1) Then
                For c = 1 To UBound(tCls, 2)
                    If IsNumeric(tCls(1, c)) Then
                        If tCls(1, c) = cls Then
                            s = Trim$(SafeText(tData(r, c)))
                            p = InStr(s, "-")
                            If p > 1 Then
                                bundle = Val(Left$(s, p - 1))
                                If bundle > 0 Then ClipRate = Val(Mid$(s, p + 1)) / bundle
                            End If
                        End If
                    End If
                Next c
            End If
        End If
    Next r
End Function

Private Function IsAllDigits(ByVal s As String) As Boolean
    Dim i As Long
    For i = 1 To Len(s)
        If Not DigitAt(s, i) Then Exit Function
    Next i
    IsAllDigits = Len(s) > 0
End Function

Private Function ParseQty(ByVal v As Variant) As Variant
    Dim s As String
    ParseQty = Empty
    If IsError(v) Or IsEmpty(v) Then Exit Function
    Select Case VarType(v)
        Case vbDouble, vbSingle, vbInteger, vbLong, vbCurrency, vbDecimal
            ParseQty = CDbl(v)
        Case vbString
            s = Trim$(Replace(CStr(v), ",", ""))
            If DigitAt(s, 1) Then ParseQty = Val(s)
    End Select
End Function

' ============================================================ helpers

Private Function SafeText(ByVal v As Variant) As String
    If IsError(v) Or IsEmpty(v) Or IsNull(v) Then Exit Function
    SafeText = CStr(v)
End Function

Private Function FirstText(data As Variant, ByVal r As Long, ByVal lastCol As Long) As String
    Dim c As Long
    For c = 1 To lastCol
        If Len(Trim$(SafeText(data(r, c)))) > 0 Then
            FirstText = Trim$(SafeText(data(r, c)))
            Exit Function
        End If
    Next c
End Function

' What the detail sheet shows as the item: description, spec and any separate
' size/class cells, in sheet column order; the whole row when none of those exist.
Private Function ItemText(data As Variant, ByVal r As Long, cols() As Long) As String
    Dim s As String, c As Long, part As String, useAll As Boolean
    useAll = cols(F_DESC) = 0 And cols(F_SPEC) = 0 And cols(F_SIZE) = 0 And cols(F_CLASS) = 0
    For c = 1 To UBound(data, 2)
        If useAll Then
            If c = cols(F_ORDER) Or c = cols(F_QTY) Then GoTo NextCol
        ElseIf c <> cols(F_DESC) And c <> cols(F_SPEC) And c <> cols(F_SIZE) And c <> cols(F_CLASS) Then
            GoTo NextCol
        End If
        part = Trim$(SafeText(data(r, c)))
        If Len(part) > 0 Then
            If Len(s) > 0 Then s = s & "  |  "
            s = s & part
        End If
NextCol:
    Next c
    ItemText = s
End Function

Private Function IsTotalRow(ByVal s As String) As Boolean
    Dim t As String, k As Variant
    t = UCase$(Replace(Trim$(s), " ", ""))
    If Len(t) = 0 Then Exit Function
    If t = "계" Then IsTotalRow = True: Exit Function
    For Each k In Array("합계", "소계", "총계", "TOTAL", "SUBTOTAL", "GRANDTOTAL")
        If Left$(t, Len(k)) = k Then IsTotalRow = True: Exit Function
    Next k
End Function

Private Function FilterKeywords() As Variant
    Dim s As String
    s = UCase$(Trim$(SafeText(Setting("setFilter"))))
    If Len(s) = 0 Then
        FilterKeywords = Empty
    Else
        FilterKeywords = Split(s, ",")
    End If
End Function

Private Function PassesFilter(ByVal rowText As String, filters As Variant) As Boolean
    Dim k As Variant
    If IsEmpty(filters) Then PassesFilter = True: Exit Function
    rowText = UCase$(rowText)
    For Each k In filters
        If Len(Trim$(k)) > 0 Then
            If InStr(1, rowText, Trim$(k), vbBinaryCompare) > 0 Then PassesFilter = True: Exit Function
        End If
    Next k
End Function

Private Sub AddUnique(col As Collection, ByVal key As String)
    On Error Resume Next
    col.Add key, "k" & key
    On Error GoTo 0
End Sub

Private Function LastUsedRow(ByVal ws As Worksheet) As Long
    Dim f As Range
    Set f = ws.Cells.Find(What:="*", LookIn:=xlFormulas, LookAt:=xlPart, SearchOrder:=xlByRows, SearchDirection:=xlPrevious)
    If Not f Is Nothing Then LastUsedRow = f.Row
End Function

Private Function LastUsedCol(ByVal ws As Worksheet) As Long
    Dim f As Range
    Set f = ws.Cells.Find(What:="*", LookIn:=xlFormulas, LookAt:=xlPart, SearchOrder:=xlByColumns, SearchDirection:=xlPrevious)
    If Not f Is Nothing Then LastUsedCol = f.Column
End Function
