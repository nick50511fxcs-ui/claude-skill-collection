"""Build GasketClipCalculator.xlsm: sheets, formulas, buttons and the VBA project.

    python3 build/build.py [output.xlsm]

The VBA lives in vba/ClipCalc.bas (UTF-8). Non-ASCII string literals are rewritten
to U("hex") calls so the project compiles the same under any Windows code page.
"""
import os
import re
import sys
import unicodedata

import xlsxwriter

from vbaproject import build_vba_project

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONT = "Malgun Gothic"
NAVY = "#1F3864"
BLUE_TEXT = "#0000FF"
INPUT_FILL = "#FFF2CC"
GREEN_FILL = "#E2EFDA"
GREY_FILL = "#F2F2F2"
LINE = "#BFBFBF"

# JIC-3S-PSG-25-001 Rev.9, 4.3 Gasket Bundles & Spacer Requirements (Table 3).
CLASSES = [150, 300, 600, 900, 1500, 2500]
TABLE = [
    ('1/2" - 1-1/2"', 0.5, 1.5, ["10-4", "10-4", "10-4", "10-4", "10-4", "10-4"]),
    ('2" - 5"', 2, 5, ["10-4", "10-4", "10-4", "10-4", "10-4", "10-4"]),
    ('6"', 6, 6, ["10-4", "5-3", "5-3", "5-3", "5-3", "5-3"]),
    ('8"', 8, 8, ["10-4", "5-3", "5-3", "5-3", "5-3", "5-3"]),
    ('10"', 10, 10, ["10-4", "5-3", "5-3", "5-3", "5-3", "5-3"]),
    ('12"', 12, 12, ["5-3", "5-3", "5-3", "5-3", "5-3", "5-3"]),
    ('14"', 14, 14, ["5-3", "5-3", "5-3", "5-3", "5-3", "N/A"]),
    ('16"', 16, 16, ["5-3", "5-3", "5-3", "2-3", "2-3", "N/A"]),
    ('18"', 18, 18, ["5-3", "5-3", "5-3", "2-3", "2-3", "N/A"]),
    ('20"', 20, 20, ["5-3", "5-3", "5-3", "2-3", "2-3", "N/A"]),
    ('24"', 24, 24, ["5-3", "5-3", "5-3", "1-0", "1-0", "N/A"]),
    ('30"', 30, 30, ["5-3", "5-3", "1-0", "1-0", "1-0", "N/A"]),
    ('36"', 36, 36, ["5-3", "5-3", "1-0", "1-0", "1-0", "N/A"]),
]

# Same layout as the ERP "수주정보 상세목록" download (fictional values).
SAMPLE_ORDER_NO = "예시-0001"
SAMPLE_HEADER = ["순서", "품목", "품명", "규격", "수량", "단가", "단위", "생산특기사항", "라벨표기사항"]
SAMPLE_ROWS = [
    [1, "O-SW(3S)-000101", "SW(3S), 304, SF, OR(CS)", '4.5T RF 150LB 1" [*31.8*47.8*66.8]', 250, 0.24, "EA", "3S OEM", "GS010-150B1A"],
    [2, "O-SW(3S)-000102", "SW(3S), 304, SF, OR(CS)", '4.5T RF 300/600LB 2" [*69.9*85.9*111.3]', 120, 0.44, "EA", "3S OEM", "GS020-300B1A"],
    [3, "O-SW(3S)-000103", "SW(3S), 304, SF, OR(CS)", '4.5T RF 150LB 6" [*182.6*209.6*222.3]', 48, 1.15, "EA", "3S OEM", "GS060-150B1A"],
    [4, "O-SW(3S)-000104", "SW(3S), 316L, SF, I/OR(316L,CS)", '4.5T RF 300LB 12" [317.5*339.9*374.7*422.4]', 20, 4.84, "EA", "3S OEM", "GSI120-300C1AC"],
    [5, "O-SW(3S)-000105", "SW(3S), 304, SF, I/OR(304,CS)", '4.5T RF 900LB 24" [590.6*628.7*679.5*838.2]', 6, 19.18, "EA", "3S OEM", "GSI240-900B1AB"],
    [6, "O-SW(3S)-000106", "SW(3S), None, None, IR(304)", '3.0T RF 150/300LB 6" [157.2*182.6]', 30, 0.9, "EA", "3S OEM", "IR060-150-300B"],
    ["", "", "", "", "합 = 474", "", "", "", ""],
]


# --------------------------------------------------------------- VBA source
def vba_ascii(code: str) -> str:
    """Rewrite string literals with non-ASCII text into "ascii" & U("hex") pieces."""
    out_lines = []
    for line in code.splitlines():
        out, i = [], 0
        while i < len(line):
            ch = line[i]
            if ch == "'":  # comment (outside a string): must be ASCII
                rest = line[i:]
                assert rest.isascii(), "non-ASCII comment: " + line
                out.append(rest)
                break
            if ch != '"':
                out.append(ch)
                i += 1
                continue
            j, value = i + 1, []
            while True:
                if line[j] == '"':
                    if j + 1 < len(line) and line[j + 1] == '"':
                        value.append('"')
                        j += 2
                        continue
                    break
                value.append(line[j])
                j += 1
            text = "".join(value)
            if text.isascii():
                out.append(line[i:j + 1])
            else:
                parts = []
                for run in re.findall(r"[\x00-\x7f]+|[^\x00-\x7f]+", text):
                    if run.isascii():
                        parts.append('"%s"' % run.replace('"', '""'))
                    else:
                        parts.append('U("%s")' % "".join("%04X" % ord(c) for c in run))
                out.append("(" + " & ".join(parts) + ")")
            i = j + 1
        new = "".join(out)
        assert new.isascii() and len(new) < 1000, new[:80]
        out_lines.append(new)
    helper = (
        "\n' Decodes 4-hex-digit UTF-16 code units (see build.py).\n"
        "Private Function U(ByVal h As String) As String\n"
        "    Dim i As Long\n"
        "    For i = 1 To Len(h) Step 4\n"
        '        U = U & ChrW(CLng("&H" & Mid$(h, i, 4)))\n'
        "    Next i\n"
        "End Function\n"
    )
    return "\n".join(out_lines) + "\n" + helper


# --------------------------------------------------------------- helpers
def text_width(s: str) -> int:
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in s)


def row_height(s: str, width_chars: float, line_pt: float = 15.0) -> float:
    lines = 0
    for para in s.split("\n"):
        lines += max(1, -(-text_width(para) // int(width_chars)))
    return lines * line_pt + 5


class Styles:
    def __init__(self, wb):
        self.wb = wb
        self.cache = {}

    def __call__(self, **props):
        key = tuple(sorted(props.items()))
        if key not in self.cache:
            base = {"font_name": FONT, "font_size": 10, "valign": "vcenter"}
            base.update(props)
            self.cache[key] = self.wb.add_format(base)
        return self.cache[key]


# --------------------------------------------------------------- sheets
def build_guide(wb, ws, st):
    ws.hide_gridlines(2)
    ws.set_column("A:A", 2)
    ws.set_column("B:B", 5)
    ws.set_column("C:J", 13)
    ws.set_column("K:K", 2)
    content_w = 8 * 13 + 3  # merged C:J, in character units

    ws.set_row(1, 34)
    ws.merge_range("B2:J2", "가스켓 포장 클립(Spacer) 계산기  —  사용 설명서",
                   st(bold=True, font_size=18, font_color=NAVY))
    ws.merge_range("B3:J3", "수주 상세 내역을 넣고 버튼만 누르면, 수주번호별 · 전체 필요한 클립 개수를 자동으로 계산합니다.",
                   st(font_size=11, font_color="#404040"))
    ws.set_row(3, 52)
    buttons = [
        ("ImportAndCalc", "① 수주 파일 불러와서 계산", 0, 200),
        ("RunClipCalc", "② 붙여넣은 내역으로 계산", 210, 200),
        ("ExportSummaryPdf", "결과 PDF 저장", 420, 150),
        ("ResetAll", "초기화 (모두 지우기)", 580, 150),
    ]
    for macro, caption, x, w in buttons:
        ws.insert_button("C4", {"macro": macro, "caption": caption, "width": w,
                                "height": 46, "x_offset": x, "y_offset": 8})
    ws.merge_range("B5:J5", "버튼은 이 시트, 수주입력 시트, 결과요약 시트에 있습니다.  "
                   "버튼이 눌리지 않으면 아래 1번(매크로 허용)을 먼저 해 주세요.",
                   st(font_size=9, font_color="#7F7F7F"))

    row = 6
    h_fmt = st(bold=True, font_size=12, font_color="#FFFFFF", bg_color=NAVY)
    p_fmt = st(text_wrap=True, valign="top")
    num_fmt = st(bold=True, font_color=NAVY, align="center", valign="top", font_size=11)
    th = st(bold=True, bg_color="#DDEBF7", border=1, border_color=LINE, align="center", text_wrap=True)
    td = st(border=1, border_color=LINE, text_wrap=True)
    tdc = st(border=1, border_color=LINE, text_wrap=True, align="center")
    note = st(text_wrap=True, valign="top", font_color="#7F7F7F", font_size=9)
    tip = st(text_wrap=True, valign="top", bg_color=INPUT_FILL)

    def heading(text):
        nonlocal row
        row += 1
        ws.set_row(row, 24)
        ws.merge_range(row, 1, row, 9, "  " + text, h_fmt)
        row += 1

    def para(text, fmt=p_fmt, num=None):
        nonlocal row
        ws.set_row(row, row_height(text, content_w - 2))
        if num is not None:
            ws.write(row, 1, num, num_fmt)
        ws.merge_range(row, 2, row, 9, text, fmt)
        row += 1

    def table(header, rows, spans):
        """spans: list of (first_col, last_col) per column, columns C..J = 2..9."""
        nonlocal row
        for cells, fmt in [(header, th)] + [(r, None) for r in rows]:
            height = 18
            for k, (a, b) in enumerate(spans):
                width = sum(13 for _ in range(a, b + 1)) + 1
                height = max(height, row_height(str(cells[k]), width - 2))
                f = fmt or (tdc if k > 0 and b - a == 0 else td)
                if a == b:
                    ws.write(row, a, cells[k], f)
                else:
                    ws.merge_range(row, a, row, b, cells[k], f)
            ws.set_row(row, height)
            row += 1

    heading("1. 처음 한 번만 — 매크로(버튼) 허용하기")
    para("파일을 열었을 때 화면 위쪽에 노란색 줄 [보안 경고 – 매크로를 사용할 수 없도록 설정했습니다]가 보이면 "
         "오른쪽의 [콘텐츠 사용] 버튼을 누르세요.", num="1")
    para("빨간색 줄 [보안 위험 – Microsoft에서 이 파일의 매크로 실행을 차단했습니다]가 보이면(메일·메신저로 받은 파일): "
         "엑셀을 닫고 → 파일 아이콘을 마우스 오른쪽 클릭 → [속성] → 아래쪽 [차단 해제]에 체크 → [확인] → 파일을 다시 여세요.",
         num="2")
    para("저장할 때는 지금 형식(Excel 매크로 사용 통합 문서, .xlsm) 그대로 저장하세요. "
         ".xlsx로 바꿔 저장하면 버튼이 동작하지 않습니다.", num="3")

    heading("2. 사용 방법 A — 수주 파일을 그대로 불러오기 (가장 쉬움)")
    para("위의 [① 수주 파일 불러와서 계산] 버튼을 누릅니다.", num="1")
    para("ERP에서 받은 '수주정보 상세목록' 엑셀(또는 CSV) 파일을 골라 [열기]를 누릅니다. 파일 양식은 고칠 필요 없습니다.\n"
         "여러 수주를 한 번에 하려면 Ctrl 키를 누른 채 파일을 여러 개 클릭해서 고르세요. 파일 하나가 수주 하나로 계산되고, "
         "결과요약에는 파일 이름이 수주 이름으로 나옵니다.", num="2")
    para("끝입니다. 자동으로 계산되고 [결과요약] 시트가 열립니다.", num="3")

    heading("3. 사용 방법 B — 복사해서 붙여넣기")
    para("ERP에서 받은 '수주정보 상세목록' 엑셀을 열고, 아무 칸이나 클릭한 뒤 Ctrl + A → Ctrl + C 로 전체를 복사합니다 "
         "(제목 행 '순서 · 품목 · 품명 · 규격 · 수량 …'이 꼭 포함되어야 합니다). 맨 아래 '합 = …' 행은 같이 복사돼도 자동으로 빠집니다.", num="1")
    para("[수주입력] 시트의 A5 셀을 클릭하고 붙여넣습니다 (Ctrl + V). "
         "예전 데이터가 남아 있으면 먼저 [초기화] 버튼을 누르세요.", num="2")
    para("수주정보 상세목록에는 수주번호 열이 없으므로, [수주입력] 시트 B3 노란 칸에 수주번호를 적어 두면 결과에 그 번호로 표시됩니다 "
         "(비워 두면 '수주 1'로 표시되고 계산은 똑같이 됩니다).", num="3")
    para("[② 붙여넣은 내역으로 계산] 버튼을 누릅니다.", num="4")
    para("여러 수주를 붙여넣을 때: 첫 번째 목록 아래에 한 줄을 비우고, 그다음 줄 A열에 수주번호를 적은 뒤, "
         "바로 아래 줄에 두 번째 목록을 제목 행째로 붙여넣으세요. 세 번째부터도 똑같이 하면 됩니다. "
         "제목 행(순서 · 품목 · 품명 · 규격 · 수량 …)이 나올 때마다 새 수주로 나눠 계산합니다. "
         "수주번호를 안 적으면 '수주 1', '수주 2' … 로 표시됩니다.", fmt=tip)

    heading("4. 결과 보는 법")
    table(["시트", "보이는 내용"], [
        ["결과요약", "맨 위 초록색 칸 '최종 필요 클립'이 전체 필요한 클립 수입니다. 아래 표에 수주번호별 "
                 "기본 클립과 최종 클립(× 1.2)이 나옵니다. [결과 PDF 저장] 버튼으로 보고서를 PDF로 저장할 수 있습니다."],
        ["계산상세", "품목(라인)마다 Size · Class를 어떻게 읽었는지, 몇 묶음 · 몇 클립인지 보여 줍니다. "
                 "결과가 이상하면 여기를 확인하세요. 주황색 행은 계산에서 빠진 품목입니다."],
    ], [(2, 3), (4, 9)])

    heading("5. 계산 방법")
    para("기준표의 '10-4'는 10개씩 한 묶음으로 포장하고, 한 묶음에 클립 4개가 필요하다는 뜻입니다. "
         "'5-3'은 5개씩 · 클립 3개, '2-3'은 2개씩 · 클립 3개, '1-0'은 1개씩 포장 · 클립 없음, 'N/A'는 기준이 없다는 뜻입니다.")
    para("묶음 수 = 수량 ÷ 묶음당 수량 (나머지가 있으면 한 묶음 더, 즉 올림)\n"
         "기본 클립 = 묶음 수 × 묶음당 클립\n"
         "최종 필요 클립 = 모든 품목(줄)의 기본 클립 합계 × 1.2 (소수점은 올림)", fmt=tip)
    table(["품목 (예시)", "수량", "기준", "묶음 수", "기본 클립"], [
        ['1-1/2" 150#', "25개", "10-4", "25 ÷ 10 = 2.5 → 3묶음", "3 × 4 = 12개"],
        ['6" 300#', "12개", "5-3", "12 ÷ 5 = 2.4 → 3묶음", "3 × 3 = 9개"],
        ['24" 900#', "4개", "1-0", "4묶음", "4 × 0 = 0개"],
    ], [(2, 3), (4, 4), (5, 5), (6, 7), (8, 9)])
    para("기본 클립 합계 = 12 + 9 + 0 = 21개  →  21 × 1.2 = 25.2  →  최종 26개", fmt=tip)
    para("※ 묶음은 품목 줄마다 따로 나눕니다. 수주번호별 최종 클립도 같은 방법(수주별 합계 × 1.2, 올림)으로 보여 주는데, "
         "수주마다 올림을 하기 때문에 수주별 값을 더하면 전체 최종 클립과 몇 개 차이 날 수 있습니다. 발주 수량은 전체 최종 클립을 보세요.",
         fmt=note)

    heading("6. 주황색 행 · '확인 필요'가 나오면")
    table(["상태", "뜻", "이렇게 하세요"], [
        ["Size 인식 실패", "품명/규격에서 Size를 찾지 못함", '원본 표기 확인 (예: 1-1/2", 6", 50A). 또는 계산상세 E열에 숫자(인치)를 직접 입력'],
        ["Class 인식 실패", "150#, 300LB 같은 압력 등급을 찾지 못함", "원본에 150LB / CL150 형태로 있는지 확인. 또는 계산상세 F열에 150처럼 직접 입력"],
        ["확인 필요 (36인치 초과)", '42"처럼 기준표 최대 Size(36")보다 큰 품목', "클립 계산에서 빠져 있습니다. 담당자 확인 후 따로 반영"],
        ["기준표에 없는 Size", '22", 1/4" 처럼 기준표 범위 안이지만 표에 없는 Size', "담당자와 포장 기준 확인 후 필요하면 클립기준표에 추가"],
        ["N/A (기준 없음)", '기준표 값이 N/A (예: 14" 이상 2500#)', "담당자 확인"],
        ["기준표에 없는 Class", "400#, 2000# 처럼 표에 없는 Class", "담당자 확인"],
        ["수량 확인 필요", "수량 칸이 비었거나 숫자가 아님", "원본 수량 확인. 또는 계산상세 D열에 직접 입력"],
    ], [(2, 3), (4, 6), (7, 9)])
    para("계산상세 시트의 노란 제목 칸(D 수량, E Size, F Class)은 직접 고치면 그 자리에서 다시 계산됩니다. "
         "단, 계산 버튼을 다시 누르면 직접 고친 값은 지워지므로, 원본(수주입력)을 고치는 것이 가장 확실합니다.", fmt=tip)

    heading("7. 자동으로 알아보는 표기")
    table(["항목", "알아보는 예"], [
        ["Size", '1/2"   3/4"   1-1/2"   1 1/2"   1.5"   2IN   6 INCH   NPS 6   2B   50A   DN50   30"(A)\n'
                 "(Size가 별도 열에 있으면 6, 1.5, 1-1/2 처럼 숫자만 있어도 됩니다)"],
        ["Class", "150#   150LB   150LBS   CL150   CLASS 150   ANSI 150   300/600LB   150/300/600LB\n"
                  "(Class가 별도 열에 있으면 150만 있어도 됩니다)\n"
                  "300/600LB처럼 여러 Class가 함께 적혀 있으면, 기준표에서 클립이 더 많이 나오는 쪽을 적용하고 계산상세 '비고' 열에 적어 둡니다."],
        ["열 이름", "수주정보 상세목록 양식(순서 · 품목 · 품명 · 규격 · 수량 …)은 그대로 인식합니다. 그 밖에 "
                  "수주번호(ORDER NO, SO NO, PO NO…) · 품명/규격(DESCRIPTION, ITEM, SPEC…) · SIZE · "
                  "CLASS(RATING, 압력) · 수량(QTY…)\n이름이 달라 못 찾으면 [설정] 시트에서 열 문자(A, B, C…)를 직접 지정하세요."],
        ["기타", "합계 · 소계 행은 자동으로 빠집니다. 수주번호가 첫 줄에만 있고 아래 칸이 비어 있으면 위의 번호를 이어서 씁니다."],
    ], [(2, 3), (4, 9)])

    heading("8. 기준 · 설정 바꾸기")
    para("포장 기준 변경: [클립기준표] 시트의 '10-4' 같은 값을 같은 형식(숫자-숫자)으로 고치면 바로 반영됩니다.", num="•")
    para("여유 계수 변경: [설정] 시트의 1.2를 원하는 값으로 바꾸세요.", num="•")
    para("가스켓이 아닌 품목이 섞여 있으면: [설정] 시트 '품목 필터'에 GASKET 처럼 단어를 넣으면 그 단어가 들어간 행만 계산합니다.",
         num="•")

    heading("9. 시트 구성")
    table(["시트", "용도"], [
        ["사용설명서", "지금 보고 있는 안내서와 실행 버튼"],
        ["결과요약", "보고용 결과 — 전체 및 수주번호별 필요 클립"],
        ["계산상세", "품목 라인별 계산 과정 (확인 · 수정용)"],
        ["수주입력", "수주 상세 내역을 넣는 곳 (예시 데이터가 들어 있습니다)"],
        ["클립기준표", "JIC-3S-PSG-25-001 Rev.9 · 4.3 Gasket Bundles & Spacer Requirements (Table 3)"],
        ["설정", "여유 계수, 열 직접 지정, 품목 필터"],
    ], [(2, 3), (4, 9)])
    row += 1
    ws.merge_range(row, 1, row, 9, "처음 열었을 때는 수주입력 시트에 예시 데이터가 들어 있습니다. "
                   "[② 붙여넣은 내역으로 계산]을 눌러 결과가 어떻게 나오는지 먼저 확인해 보세요.", note)
    ws.set_row(row, 30)

    ws.set_paper(9)
    ws.fit_to_pages(1, 0)
    ws.set_margins(left=0.4, right=0.4, top=0.5, bottom=0.5)
    ws.print_area(1, 1, row, 9)


def build_summary(wb, ws, st):
    ws.hide_gridlines(2)
    widths = {"A": 2, "B": 24, "C": 13, "D": 15, "E": 14, "F": 18, "G": 14, "H": 22, "I": 3, "J": 14}
    for col, w in widths.items():
        ws.set_column(f"{col}:{col}", w)
    ws.set_row(1, 32)
    ws.merge_range("B2:H2", "가스켓 포장 클립(Spacer) 소요량 산출 결과",
                   st(bold=True, font_size=16, font_color=NAVY, bottom=2, bottom_color=NAVY))
    ws.merge_range("B3:H3", "Gasket Bundle & Spacer(Clip) Requirement Report",
                   st(italic=True, font_color="#7F7F7F", font_size=9))
    label = st(bold=True, bg_color=GREY_FILL, border=1, border_color=LINE)
    value = st(border=1, border_color=LINE)
    ws.write("B4", "산출 일시", label)
    ws.merge_range("C4:D4", "", st(border=1, border_color=LINE, num_format="yyyy-mm-dd hh:mm", align="left"))
    ws.write("E4", "원본 데이터", label)
    ws.merge_range("F4:H4", "", value)
    ws.write("B5", "적용 기준", label)
    ws.merge_range("C5:D5", "JIC-3S-PSG-25-001 Rev.9 (Table 3)", value)
    ws.write("E5", "여유 계수", label)
    ws.merge_range("F5:H5", "", value)
    ws.write_formula("F5", "=setFactor", st(border=1, border_color=LINE, num_format='"× "0.0#', align="left"), 1.2)

    ws.set_row(6, 30)
    ws.set_row(7, 40)
    card_label = st(bold=True, font_color="#FFFFFF", bg_color=NAVY, align="center", text_wrap=True,
                    border=1, border_color="#FFFFFF")
    big = dict(bold=True, font_size=20, align="center", border=1, border_color=LINE)
    ws.merge_range("B7:C7", "최종 필요 클립 (전체)", st(bold=True, font_color="#FFFFFF", bg_color="#548235",
                                                    align="center", border=1, border_color="#FFFFFF"))
    ws.merge_range("B8:C8", "", st(bg_color=GREEN_FILL, font_color="#375623", num_format='#,##0" 개"', **big))
    cards = [("D", "기본 클립\n(여유 전)", '#,##0" 개"'), ("E", "수주 건수", '#,##0" 건"'),
             ("F", "품목 라인 수", "#,##0"), ("G", "총 수량 (개)", "#,##0"),
             ("H", "확인 필요 라인", "[Red]#,##0;[Red]-#,##0;0")]
    for col, text, fmt in cards:
        ws.write(f"{col}7", text, card_label)
        ws.write_blank(f"{col}8", None, st(num_format=fmt, **dict(big, font_size=16)))

    ws.set_row(9, 22)
    ws.write("B10", "■ 수주번호별 클립 소요량", st(bold=True, font_size=12, font_color=NAVY))
    ws.set_row(10, 34)
    head = st(bold=True, font_color="#FFFFFF", bg_color=NAVY, align="center", text_wrap=True,
              border=1, border_color=LINE)
    for col, text in zip("BCDEFGH", ["수주번호", "품목 라인 수", "총 수량 (개)", "기본 클립 (개)",
                                     "최종 클립 (개)\n× 여유 계수", "확인 필요 라인", "비고"]):
        ws.write(f"{col}11", text, head)
    ws.write("B12", "아직 계산 전입니다. [② 붙여넣은 내역으로 계산] 버튼을 눌러 주세요.",
             st(font_color="#808080"))

    ws.insert_button("J2", {"macro": "RunClipCalc", "caption": "다시 계산", "width": 110, "height": 34})
    ws.insert_button("J4", {"macro": "ExportSummaryPdf", "caption": "결과 PDF 저장", "width": 110, "height": 34,
                            "y_offset": 6})
    ws.set_paper(9)
    ws.fit_to_pages(1, 0)
    ws.center_horizontally()
    ws.set_margins(left=0.4, right=0.4, top=0.6, bottom=0.6)
    ws.set_footer("&C&8&P / &N")
    ws.print_area("B2:H16")


def build_detail(wb, ws, st):
    ws.hide_gridlines(2)
    ws.write("A1", "계산 상세 (품목 라인별)", st(bold=True, font_size=14, font_color=NAVY))
    ws.write("A2", "주황색 행은 클립 계산에서 빠진 품목입니다(M열 상태 참고).  노란 제목 칸(D 수량 · E Size · F Class)은 "
                   "직접 고치면 즉시 다시 계산됩니다.", st(font_color="#595959", font_size=9))
    center = st(align="center")
    cols = [
        ("A", 6, "No", center, False),
        ("B", 16, "수주번호", st(), False),
        ("C", 52, "품목 내용 (원문)", st(), False),
        ("D", 9, "수량", st(align="center", num_format="#,##0"), True),
        ("E", 10, "Size\n(inch)", center, True),
        ("F", 9, "Class\n(#)", st(align="center", num_format='0"#"'), True),
        ("G", 15, "기준 Size 구분", center, False),
        ("H", 10, "포장 기준\n(묶음-클립)", center, False),
        ("I", 10, "묶음당\n수량", st(align="center", num_format="#,##0"), False),
        ("J", 10, "묶음당\n클립", st(align="center", num_format="#,##0"), False),
        ("K", 9, "묶음 수", st(align="center", num_format="#,##0"), False),
        ("L", 11, "기본 클립", st(align="center", num_format="#,##0", bold=True), False),
        ("M", 20, "상태", center, False),
        ("N", 9, "원본 행", st(align="center", font_color="#7F7F7F"), False),
        ("O", 44, "비고", st(font_color="#595959"), False),
    ]
    ws.set_row(3, 34)
    for col, w, title, fmt, editable in cols:
        ws.set_column(f"{col}:{col}", w, fmt)
        ws.write(f"{col}4", title, st(bold=True, align="center", text_wrap=True, border=1, border_color=LINE,
                                      bg_color="#FFE699" if editable else "#DDEBF7"))
    ws.freeze_panes(4, 0)
    ws.conditional_format("A5:O60000", {"type": "formula", "criteria": '=AND($A5<>"",$M5<>"OK")',
                                        "format": wb.add_format({"bg_color": "#FCE4D6", "font_color": "#9C0006"})})
    ws.conditional_format("M5:M60000", {"type": "cell", "criteria": "==", "value": '"OK"',
                                        "format": wb.add_format({"font_color": "#375623", "bold": True})})
    ws.set_landscape()
    ws.set_paper(9)
    ws.fit_to_pages(1, 0)
    ws.repeat_rows(3)


def build_input(wb, ws, st):
    for col, w in {"A": 10, "B": 18, "C": 30, "D": 46, "E": 9, "F": 8, "G": 6, "H": 12, "I": 16}.items():
        ws.set_column(f"{col}:{col}", w)
    for r in range(3):
        ws.set_row(r, 22)
    ws.write("A1", "수주 상세 내역 입력", st(bold=True, font_size=14, font_color=NAVY))
    ws.write("A2", "파일을 불러오거나, A5 셀부터 붙여넣고 계산 버튼을 누르세요.", st(font_color="#595959"))
    ws.write("A3", "수주번호:", st(bold=True, align="right"))
    ws.write_string("B3", SAMPLE_ORDER_NO, st(bg_color=INPUT_FILL, border=1, border_color=LINE, font_color=BLUE_TEXT))
    ws.write("C3", "← 수주번호 열이 없는 양식이면 여기에 적으세요 (선택)", st(font_color="#7F7F7F", font_size=9))
    wb.define_name("inputOrderNo", f"='{ws.name}'!$B$3")
    ws.write("A4", "▼ 이 아래 5행부터 수주 상세 내역을 넣으세요 (제목 행 포함). 아래는 예시 데이터입니다.",
             st(bold=True, font_color="#C65911"))
    head = st(bold=True, bg_color="#DDEBF7", border=1, border_color=LINE, align="center")
    cell = st(border=1, border_color=LINE)
    num = st(border=1, border_color=LINE, align="center")
    for c, h in enumerate(SAMPLE_HEADER):
        ws.write(4, c, h, head)
    for r, values in enumerate(SAMPLE_ROWS, start=5):
        for c, v in enumerate(values):
            if isinstance(v, (int, float)):
                ws.write_number(r, c, v, num)
            else:
                ws.write_string(r, c, v, cell)
    for k, (macro, caption, w) in enumerate([("ImportAndCalc", "수주 파일 불러와서 계산", 190),
                                             ("RunClipCalc", "붙여넣은 내역으로 계산", 190),
                                             ("ResetAll", "초기화", 90)]):
        ws.insert_button("F1", {"macro": macro, "caption": caption, "width": w, "height": 40,
                                "x_offset": [0, 200, 400][k], "y_offset": 4})
    ws.set_landscape()
    ws.set_paper(9)
    ws.fit_to_pages(1, 0)


def build_table(wb, ws, st):
    ws.hide_gridlines(2)
    ws.set_column("A:A", 22)
    ws.set_column("B:G", 10)
    ws.set_column("H:I", 13)
    ws.set_row(0, 26)
    ws.merge_range("A1:G1", "Gaskets Bundle Quantity - Spacer(Clip) Quantity",
                   st(bold=True, font_size=13, font_color="#2E75B6", align="center", border=2))
    ws.merge_range("A2:I2", "'10-4' = 10개씩 한 묶음 포장, 한 묶음에 클립 4개  /  '1-0' = 1개씩 포장, 클립 불필요  /  "
                   "N/A = 기준 없음.   파란 글자 칸은 같은 형식(숫자-숫자)으로 고칠 수 있습니다.",
                   st(font_size=9, font_color="#595959", text_wrap=True))
    ws.set_row(1, 30)
    border = dict(border=1, border_color="#000000")
    ws.write("A4", "NPS / Pressure Class", st(bold=True, align="center", **border))
    for k, cls in enumerate(CLASSES):
        ws.write_number(3, 1 + k, cls, st(bold=True, align="center", num_format='0"#"', **border))
    hint = st(font_size=9, font_color="#7F7F7F", align="center", text_wrap=True, bg_color=GREY_FILL, border=1,
              border_color=LINE)
    ws.write("H4", "Size 범위 시작\n(inch)", hint)
    ws.write("I4", "Size 범위 끝\n(inch)", hint)
    ws.set_row(3, 30)
    for r, (label, lo, hi, vals) in enumerate(TABLE, start=4):
        ws.set_row(r, 20)
        ws.write_string(r, 0, label, st(align="center", **border))
        for k, v in enumerate(vals):
            ws.write_string(r, 1 + k, v, st(align="center", font_color=BLUE_TEXT, **border))
        ws.write_number(r, 7, lo, st(font_size=9, font_color="#7F7F7F", align="center", border=1, border_color=LINE))
        ws.write_number(r, 8, hi, st(font_size=9, font_color="#7F7F7F", align="center", border=1, border_color=LINE))
    last = 4 + len(TABLE)
    ws.write(last + 1, 0, "출처: JIC-3S-PSG-25-001 Rev.9, Product Specification for Gasket, "
                          "4.3 Gasket Bundles & Spacer Requirements (Table 3) — 사용자 제공 문서",
             st(font_size=9, font_color="#7F7F7F"))
    ws.write(last + 2, 0, "H · I열은 Size를 표의 행에 맞추는 범위입니다 (예: 3/4\" = 0.75 → '1/2\" - 1-1/2\"' 행). "
                          "범위 밖 Size(22\", 1/4\" 등)는 '기준표에 없는 Size'로 표시됩니다.",
             st(font_size=9, font_color="#7F7F7F"))
    for name, ref in [("tblLabel", "$A$5:$A$17"), ("tblClass", "$B$4:$G$4"), ("tblData", "$B$5:$G$17"),
                      ("tblMin", "$H$5:$H$17"), ("tblMax", "$I$5:$I$17")]:
        wb.define_name(name, f"='{ws.name}'!{ref}")
    ws.set_landscape()
    ws.set_paper(9)
    ws.fit_to_pages(1, 0)


def build_setting(wb, ws, st):
    ws.hide_gridlines(2)
    ws.set_column("A:A", 2)
    ws.set_column("B:B", 20)
    ws.set_column("C:C", 12)
    ws.set_column("D:D", 80)
    ws.write("B2", "설정", st(bold=True, font_size=14, font_color=NAVY))
    ws.write("D2", "노란 칸만 고치세요. 평소에는 여유 계수 외에는 비워 두면 됩니다.", st(font_color="#7F7F7F"))
    label = st(bold=True, bg_color=GREY_FILL, border=1, border_color=LINE)
    inp = st(bg_color=INPUT_FILL, border=1, border_color=LINE, align="center", font_color=BLUE_TEXT)
    desc = st(font_color="#595959", text_wrap=True)
    ws.write("B4", "여유 계수", label)
    ws.write_number("C4", 1.2, st(bg_color=INPUT_FILL, border=1, border_color=LINE, align="center",
                                  font_color=BLUE_TEXT, num_format="0.0#", bold=True))
    ws.write("D4", "최종 클립 = 수주별 기본 클립 × 여유 계수 (소수점 올림).  기본값 1.2 = 사용자 요청 기준", desc)
    ws.data_validation("C4", {"validate": "decimal", "criteria": "between", "minimum": 1, "maximum": 5,
                              "error_message": "1 ~ 5 사이 숫자를 넣으세요 (예: 1.2)"})

    ws.write("B6", "열 직접 지정 — 자동으로 열을 못 찾을 때만 입력하세요 (수주입력 시트 기준, 예: A, B, C)",
             st(bold=True, font_color=NAVY))
    rows = [
        ("setColOrder", "수주번호 열", "수주번호가 있는 열"),
        ("setColDesc", "품명/규격 열", 'Size · Class가 적혀 있는 열 (예: 1-1/2" 150LB 가 들어 있는 열)'),
        ("setColSize", "Size 열", "Size가 별도 열에 있을 때만"),
        ("setColClass", "Class 열", "Class(압력 등급)가 별도 열에 있을 때만"),
        ("setColQty", "수량 열", "수량이 있는 열"),
        ("setHeaderRow", "제목 행 번호", "수주입력 시트에서 제목(열 이름)이 있는 행 번호 (예: 5)"),
    ]
    for k, (name, text, help_text) in enumerate(rows):
        r = 6 + k
        ws.write(r, 1, text, label)
        ws.write_blank(r, 2, None, inp)
        ws.write(r, 3, help_text, desc)
        wb.define_name(name, f"='{ws.name}'!$C${r + 1}")
    ws.write("B14", "품목 필터", label)
    ws.write_blank("C14", None, inp)
    ws.write("D14", "이 단어가 들어간 행만 계산합니다 (여러 개는 쉼표로: GASKET,SWG).  비워 두면 모든 행을 계산합니다.", desc)
    wb.define_name("setFilter", f"='{ws.name}'!$C$14")
    ws.write("B17", "마지막으로 불러온 파일", st(bg_color=GREY_FILL, border=1, border_color=LINE, font_color="#7F7F7F"))
    ws.write("C17", "예시 데이터", st(font_color="#7F7F7F"))
    wb.define_name("infoSource", f"='{ws.name}'!$C$17")
    wb.define_name("setFactor", f"='{ws.name}'!$C$4")
    ws.set_landscape()
    ws.set_paper(9)
    ws.fit_to_pages(1, 0)


def build(out_path):
    sheets = [
        ("사용설명서", "shGuide", build_guide),
        ("결과요약", "shSummary", build_summary),
        ("계산상세", "shDetail", build_detail),
        ("수주입력", "shInput", build_input),
        ("클립기준표", "shTable", build_table),
        ("설정", "shSetting", build_setting),
    ]
    wb = xlsxwriter.Workbook(out_path, {"default_format_properties": {"font_name": FONT, "font_size": 10}})
    wb.set_properties({"title": "가스켓 포장 클립 계산기", "subject": "Gasket bundle spacer (clip) calculator"})
    st = Styles(wb)
    worksheets = {}
    for name, code, _ in sheets:
        ws = wb.add_worksheet(name)
        ws.set_vba_name(code)
        worksheets[name] = ws
    for name, _, fn in sheets:
        fn(wb, worksheets[name], st)
    worksheets["사용설명서"].activate()

    with open(os.path.join(ROOT, "vba", "ClipCalc.bas"), encoding="utf-8") as f:
        code = vba_ascii(f.read())
    modules = [("ThisWorkbook", "workbook", "")]
    modules += [(code_name, "sheet", "") for _, code_name, _ in sheets]
    modules.append(("ClipCalc", "std", code))
    bin_path = out_path + ".vbaProject.bin"
    with open(bin_path, "wb") as f:
        f.write(build_vba_project(modules, seed=20261021))
    wb.set_vba_name("ThisWorkbook")
    wb.add_vba_project(bin_path)
    wb.close()
    os.remove(bin_path)
    return out_path


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "GasketClipCalculator.xlsm")
    print(build(out))
