from __future__ import annotations

from html import escape
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.utils import ImageReader


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "naver-login-service-introduction.pdf"
FONT = Path("C:/Windows/Fonts/malgun.ttf")
FONT_BOLD = Path("C:/Windows/Fonts/malgunbd.ttf")
pdfmetrics.registerFont(TTFont("Malgun", str(FONT)))
pdfmetrics.registerFont(TTFont("Malgun-Bold", str(FONT_BOLD)))

NAVY = colors.HexColor("#0B2545")
BLUE = colors.HexColor("#2E74B5")
DARK_BLUE = colors.HexColor("#1F4D78")
INK = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#667085")
LIGHT_BLUE = colors.HexColor("#E8EEF5")
LIGHT_GRAY = colors.HexColor("#F2F4F7")
CALLOUT = colors.HexColor("#F4F6F9")
YELLOW = colors.HexColor("#FFF8E8")
GREEN = colors.HexColor("#0B6B42")
GRID = colors.HexColor("#D7DBE2")

ASSETS = {
    "home": ROOT / "apps" / "mobile" / "01-home-screen.png",
    "ranking": ROOT / "apps" / "mobile" / "store-assets" / "google-play" / "phone-01-ranking.png",
    "reels": ROOT / "apps" / "mobile" / "store-assets" / "google-play" / "phone-02-reels.png",
    "detail": ROOT / "apps" / "mobile" / "store-assets" / "google-play" / "phone-03-detail.png",
    "calendar": ROOT / "screenshots" / "gonggu-calendar-20260614-193459.png",
    "submit": ROOT / "screenshots" / "03-submit-screen.png",
    "auth": ROOT / "apps" / "mobile" / "evidence" / "gon-132-reverify-02-auth-login.png",
}


def p(text, style):
    return Paragraph(escape(text).replace("\n", "<br/>"), style)


def hyperlink(text, url, style):
    return Paragraph(f'<link href="{url}" color="#2E74B5"><u>{escape(text)}</u></link>', style)


def image(path, width):
    reader = ImageReader(str(path))
    source_width, source_height = reader.getSize()
    height = width * source_height / source_width
    return Image(str(path), width=width, height=height, hAlign="CENTER")


def callout(title, text, accent=BLUE, fill=CALLOUT):
    content = [
        Paragraph(escape(title), styles["CalloutTitle"]),
        Paragraph(escape(text).replace("\n", "<br/>"), styles["CalloutBody"]),
    ]
    table = Table([[content]], colWidths=[6.5 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fill),
        ("BOX", (0, 0), (-1, -1), 0.5, GRID),
        ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    return KeepTogether([table, Spacer(1, 0.08 * inch)])


def label_detail(rows):
    data = []
    for label, value in rows:
        data.append([p(label, styles["TableLabel"]), p(value, styles["TableBody"])])
    table = Table(data, colWidths=[1.875 * inch, 4.625 * inch], repeatRows=0)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_BLUE),
        ("GRID", (0, 0), (-1, -1), 0.45, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return table


def menu_table():
    headers = ["메뉴", "콘텐츠", "주요 기능", "로그인과의 관계"]
    rows = [
        ("홈", "이번주·추천 공구, 프로모션, 카테고리", "공구 카드 확인, 카테고리 필터, 검색 진입, 날짜별 공구 이동", "공개 탐색 가능; 저장·알림은 계정 기능"),
        ("랭킹", "인기 공구·인플루언서/판매자 순위", "오늘·이번주·이번달, 카테고리, 인기 셀러·인기 공구·신규 오픈·마감 임박 필터", "공개 열람 가능; 팔로우 상태 저장에 로그인 사용"),
        ("릴스", "공구 상품 이미지·영상 기반 세로 피드", "영상/이미지 탐색, 상품 요약, 판매자, 가격·마감, 북마크·알림·구매 링크", "공개 열람 가능; 개인화 액션에 로그인 사용"),
        ("검색", "브랜드명·제품명·셀러명과 공구 데이터", "키워드 검색, 인기 검색어, 카테고리 및 결과 탐색", "공개 검색 가능"),
        ("캘린더", "날짜별 승인 공구 일정", "월간 날짜 이동, 오늘 이동, 공구 목록, 북마크·알림 필터, 상세 이동", "공개 일정 열람; 개인 활동 필터에 로그인/저장 상태 사용"),
        ("상품 상세", "상품·브랜드·판매자·기간·할인·요약·원본/구매 링크", "상세 정보 확인, 북마크, 알림, 공유, 외부 구매 페이지 이동", "공개 상세 확인; 저장·알림에 로그인 사용"),
        ("공구 제보", "Instagram 원본 URL과 상품·기간·구매 정보", "URL 입력, 콘텐츠 자동 보강, 추가 정보 수정, 운영자 검수 제출", "공개 제보 경로 제공; 제출 정책에 따라 계정 확인이 적용될 수 있음"),
        ("마이", "프로필과 사용자 활동", "북마크, 최근 본 공구, 알림 공구, 팔로우, 설정, 계정 삭제", "네이버 로그인 적용 핵심 메뉴"),
    ]
    data = [[p(h, styles["TableHeader"]) for h in headers]]
    data.extend([[p(value, styles["SmallTable"]) for value in row] for row in rows])
    table = Table(data, colWidths=[0.95 * inch, 1.7 * inch, 2.6 * inch, 1.25 * inch], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GRAY),
        ("TEXTCOLOR", (0, 0), (-1, 0), NAVY),
        ("GRID", (0, 0), (-1, -1), 0.45, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def figure(path, caption, width):
    return KeepTogether([
        image(path, width),
        p(caption, styles["Caption"]),
        Spacer(1, 0.04 * inch),
    ])


def two_figures(left_path, left_caption, right_path, right_caption, width=3.0 * inch):
    data = [[image(left_path, width), image(right_path, width)],
            [p(left_caption, styles["Caption"]), p(right_caption, styles["Caption"])]]
    table = Table(data, colWidths=[3.25 * inch, 3.25 * inch])
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return table


def bullet_list(items, numbered=False):
    flow = []
    for item in items:
        flow.append(ListItem(p(item, styles["Body"]), leftIndent=16))
    kwargs = {
        "bulletType": "1" if numbered else "bullet",
        "bulletFontName": "Malgun",
        "bulletFontSize": 9,
        "leftIndent": 18,
        "bulletOffsetY": 1,
        "spaceAfter": 5,
    }
    if numbered:
        kwargs["start"] = "1"
    return ListFlowable(flow, **kwargs)


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(MUTED)
    canvas.setFont("Malgun-Bold", 8)
    canvas.drawString(doc.leftMargin, letter[1] - 0.56 * inch, "GongGu Wish  |  네이버 로그인 검수 소명자료")
    canvas.setFont("Malgun", 8)
    canvas.drawRightString(letter[0] - doc.rightMargin, 0.52 * inch, f"GongGu Wish  |  Page {doc.page}")
    canvas.restoreState()


styles = getSampleStyleSheet()
styles.add(ParagraphStyle("Body", parent=styles["BodyText"], fontName="Malgun", fontSize=10.5, leading=15, textColor=INK, spaceAfter=7, wordWrap="CJK"))
styles.add(ParagraphStyle("Kicker", parent=styles["BodyText"], fontName="Malgun-Bold", fontSize=8.5, leading=11, textColor=BLUE, spaceAfter=8, wordWrap="CJK"))
styles.add(ParagraphStyle("TitleKo", parent=styles["Title"], fontName="Malgun-Bold", fontSize=25, leading=31, textColor=NAVY, spaceAfter=5, wordWrap="CJK"))
styles.add(ParagraphStyle("Subtitle", parent=styles["BodyText"], fontName="Malgun", fontSize=12, leading=18, textColor=MUTED, spaceAfter=14, wordWrap="CJK"))
styles.add(ParagraphStyle("H1Ko", parent=styles["Heading1"], fontName="Malgun-Bold", fontSize=16, leading=21, textColor=BLUE, spaceBefore=8, spaceAfter=8, wordWrap="CJK", keepWithNext=True))
styles.add(ParagraphStyle("H2Ko", parent=styles["Heading2"], fontName="Malgun-Bold", fontSize=12.5, leading=17, textColor=BLUE, spaceBefore=8, spaceAfter=6, wordWrap="CJK", keepWithNext=True))
styles.add(ParagraphStyle("CalloutTitle", parent=styles["BodyText"], fontName="Malgun-Bold", fontSize=10, leading=14, textColor=BLUE, spaceAfter=3, wordWrap="CJK"))
styles.add(ParagraphStyle("CalloutBody", parent=styles["BodyText"], fontName="Malgun", fontSize=9.8, leading=14, textColor=INK, wordWrap="CJK"))
styles.add(ParagraphStyle("TableLabel", parent=styles["BodyText"], fontName="Malgun-Bold", fontSize=9, leading=12, textColor=NAVY, wordWrap="CJK"))
styles.add(ParagraphStyle("TableBody", parent=styles["BodyText"], fontName="Malgun", fontSize=9, leading=12, textColor=INK, wordWrap="CJK"))
styles.add(ParagraphStyle("TableHeader", parent=styles["BodyText"], fontName="Malgun-Bold", fontSize=8.2, leading=11, textColor=NAVY, alignment=TA_CENTER, wordWrap="CJK"))
styles.add(ParagraphStyle("SmallTable", parent=styles["BodyText"], fontName="Malgun", fontSize=7.7, leading=10.2, textColor=INK, wordWrap="CJK"))
styles.add(ParagraphStyle("Caption", parent=styles["BodyText"], fontName="Malgun", fontSize=8.3, leading=11, textColor=MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=6, wordWrap="CJK"))
styles.add(ParagraphStyle("Small", parent=styles["BodyText"], fontName="Malgun", fontSize=8.5, leading=11, textColor=MUTED, wordWrap="CJK"))


def build():
    for path in ASSETS.values():
        if not path.exists():
            raise FileNotFoundError(path)

    doc = BaseDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=1 * inch,
        rightMargin=1 * inch,
        topMargin=0.86 * inch,
        bottomMargin=0.82 * inch,
        title="네이버 로그인 검수 소명자료 - GongGu Wish",
        author="GongGu Wish",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=on_page)])
    story = []

    # Page 1.
    story += [p("NAVER LOGIN REVIEW  /  SERVICE EXPLANATION", styles["Kicker"]),
              p("네이버 로그인 검수 소명자료", styles["TitleKo"]),
              p("GongGu Wish (공구위시) 서비스 소개 및 서비스 URL 안내", styles["Subtitle"])]
    story.append(label_detail([
        ("서비스명", "공구위시 (GongGu Wish)"),
        ("콘텐츠 유형", "인플루언서 공동구매 정보 큐레이션·일정 관리·알림 서비스"),
        ("운영 표면", "iOS/Android 모바일 앱 + 공개 웹 서비스"),
        ("작성일", "2026년 8월 10일"),
        ("자료 목적", "네이버 로그인 적용 서비스의 업종, 콘텐츠, 메뉴별 기능, 로그인 사용 목적 소명"),
    ]))
    story += [Spacer(1, 0.12 * inch),
              callout("검수자 확인 포인트", "공구위시는 상품을 직접 판매하는 쇼핑몰이 아니라, 공개 게시물에서 확인한 인플루언서 공동구매 정보를 검수·정리하여 제공하는 정보 서비스입니다. 네이버 로그인은 공개 콘텐츠를 보기 위한 필수 로그인보다, 북마크·팔로우·알림·계정 관리 등 개인화 기능을 위한 계정 인증에 사용됩니다.")]
    story += [p("반려 사유 대응 요약", styles["H2Ko"])]
    response_data = [[p(v, styles["TableHeader"]) for v in ["검수 요청 항목", "자료에 포함한 내용", "확인 위치"]]]
    response_data += [[p(v, styles["SmallTable"]) for v in row] for row in [
        ("서비스 콘텐츠 확인", "공동구매 상품·판매자·기간·할인·구매 링크를 제공하는 서비스임을 설명", "2~3쪽"),
        ("메뉴별 상세 설명 및 화면", "홈·랭킹·릴스·상세·캘린더·제보·로그인 화면과 기능을 정리", "4~8쪽"),
        ("전자상거래 여부", "직접 결제·배송 없이 외부 판매처로 연결하는 정보 서비스임을 명시", "3쪽"),
    ]]
    response = Table(response_data, colWidths=[1.5 * inch, 2.7 * inch, 2.3 * inch], repeatRows=1)
    response.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GRAY), ("GRID", (0, 0), (-1, -1), 0.45, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(response)

    # Page 2.
    story += [PageBreak(), p("1. 서비스 개요", styles["H1Ko"]),
              p("공구위시(GongGu Wish)는 인스타그램 등 공개 게시물에 흩어진 인플루언서 공동구매 정보를 모아 이용자가 일정과 상품 정보를 한눈에 확인할 수 있도록 제공하는 모바일 중심 서비스입니다.", styles["Body"]),
              p("공개 게시물에서 상품명, 브랜드명, 카테고리, 공동구매 시작일·마감일, 할인 정보, 인플루언서 정보, 원본 게시물 및 외부 구매 링크를 확인하고, 운영자 검수 후 승인된 정보만 사용자 화면에 노출합니다.", styles["Body"]),
              p("서비스 콘텐츠의 흐름", styles["H2Ko"]),
              bullet_list([
                  "공개 Instagram 게시물 또는 이용자 제보에서 공동구매 후보 정보를 수집합니다.",
                  "상품명·기간·할인·구매 링크 등 콘텐츠를 구조화하고 운영자가 공동구매 여부와 정보 품질을 확인합니다.",
                  "승인된 공구를 홈, 랭킹, 릴스, 검색, 캘린더, 상품 상세 화면에 제공하고, 사용자가 외부 구매 페이지를 확인할 수 있도록 연결합니다.",
              ], numbered=True),
              p("2. 접근 가능한 서비스 URL", styles["H1Ko"])]
    urls = [
        ("서비스 소개", "https://gongguwish.com/", "공구위시 서비스의 업종과 핵심 기능을 소개하는 공개 웹 페이지"),
        ("공동구매 캘린더", "https://gongguwish.com/calendar", "날짜별 공동구매 콘텐츠를 확인하는 공개 페이지"),
        ("공동구매 제보", "https://gongguwish.com/submit", "발견한 공동구매 정보를 운영자에게 제보하는 공개 페이지"),
        ("이용약관", "https://gongguwish.com/terms", "공동구매 탐색·캘린더·제보·계정 기능의 이용 조건"),
        ("개인정보처리방침", "https://gongguwish.com/privacy", "앱과 웹 서비스의 개인정보 처리 안내"),
        ("계정 삭제 안내", "https://gongguwish.com/account-deletion", "서비스 계정 삭제 절차 안내"),
    ]
    url_data = []
    for label, url, desc in urls:
        url_data.append([p(label, styles["TableLabel"]), hyperlink(url, url, styles["TableBody"])])
        url_data[-1][1] = Table([[url_data[-1][1]], [p(desc, styles["TableBody"])]], colWidths=[4.45 * inch], style=TableStyle([("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    url_table = Table(url_data, colWidths=[1.875 * inch, 4.625 * inch])
    url_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT_BLUE), ("GRID", (0, 0), (-1, -1), 0.45, GRID),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story += [url_table, callout("모바일 앱 접근 안내", "네이버 로그인이 적용된 화면은 공구위시 모바일 앱에서 확인합니다. 앱 실행 후 공개 콘텐츠를 탐색할 수 있으며, 마이페이지 -> 로그인 -> 네이버로 계속하기 순서로 로그인 화면에 접근합니다. 공개 웹 URL은 서비스 콘텐츠 유형과 웹에서 제공되는 캘린더·제보 기능을 확인하기 위한 접근 경로입니다.", accent=GREEN)]

    # Page 3.
    story += [PageBreak(), p("3. 서비스 업종 및 콘텐츠 형태", styles["H1Ko"]),
              label_detail([
                  ("서비스 업종", "콘텐츠 정보 서비스 / 공동구매 일정·검색·알림·큐레이션"),
                  ("주요 이용자", "인플루언서 공동구매 상품과 오픈·마감 일정을 빠르게 확인하려는 이용자"),
                  ("콘텐츠 형태", "상품 카드, 인플루언서·판매자 정보, 이미지·영상, 일정, 할인 정보, 원본 게시물 링크, 외부 구매 링크"),
                  ("상품 범위", "식품, 생활용품, 뷰티, 패션, 홈·리빙, 육아 등 인플루언서 공동구매에서 다뤄지는 상품 정보"),
                  ("운영 방식", "공개 콘텐츠 자동 수집·정보 보강 + 이용자 제보 + 운영자 검수·승인"),
              ]),
              p("전자상거래 관련 소명", styles["H2Ko"]),
              callout("직접 판매·결제 서비스가 아님", "공구위시는 상품을 직접 매입하거나 판매하지 않습니다. 앱과 웹에서는 공동구매 상품의 정보와 일정, 판매자, 할인 정보 및 외부 구매 링크를 제공합니다. 구매 링크를 누르면 각 인플루언서 또는 외부 판매처의 구매 페이지로 이동하며, 공구위시 안에서는 주문, 결제, 재고, 배송, 환불을 처리하지 않습니다.", accent=colors.HexColor("#7A5A00"), fill=YELLOW),
              p("따라서 본 서비스의 핵심 콘텐츠는 전자상거래 거래 자체가 아니라, 여러 공개 출처에 흩어진 공동구매 정보를 일정과 탐색 화면으로 정리해 제공하는 큐레이션 콘텐츠입니다.", styles["Body"]),
              p("4. 네이버 로그인 적용 목적", styles["H1Ko"]),
              p("공개 콘텐츠는 로그인 없이 확인할 수 있습니다. 네이버 로그인은 서비스 계정을 생성·식별하고 다음 개인화 기능을 이용하기 위한 선택적 인증 수단입니다.", styles["Body"]),
              bullet_list([
                  "관심 공동구매 북마크 및 마이페이지에서 저장 목록 확인",
                  "관심 인플루언서·판매자 팔로우 및 관련 콘텐츠 탐색",
                  "공구 시작·마감 알림과 알림 설정 관리",
                  "최근 본 공구, 계정 설정, 개인정보·회원탈퇴 등 계정 관리",
              ]),
              p("네이버 로그인 이용 순서", styles["H2Ko"]),
              bullet_list([
                  "앱 실행 후 홈·랭킹·릴스·검색 등 공개 콘텐츠를 확인합니다.",
                  "마이페이지에서 로그인 화면을 엽니다.",
                  "로그인 화면의 네이버로 계속하기를 선택합니다.",
                  "네이버 인증을 완료하면 공구위시 앱으로 돌아와 마이페이지와 개인화 기능을 이용합니다.",
              ], numbered=True)]

    # Page 4.
    story += [PageBreak(), p("5. 메뉴별 상세 기능", styles["H1Ko"]),
              p("아래 표는 네이버 로그인이 적용되는 모바일 앱의 주요 메뉴와, 각 메뉴에서 제공하는 콘텐츠·기능을 정리한 것입니다.", styles["Body"]),
              menu_table(), Spacer(1, 0.05 * inch),
              p("※ 화면 캡처의 상품명·판매자명·수량은 테스트 또는 스토어 소개용 샘플일 수 있으며, 실제 공개 데이터는 공구 진행 상태와 검수 결과에 따라 달라질 수 있습니다.", styles["Small"])]

    # Page 5.
    story += [PageBreak(), p("6. 화면 예시 - 홈과 랭킹", styles["H1Ko"]),
              p("홈은 서비스의 핵심 콘텐츠인 공동구매 정보를 처음 만나는 화면입니다. 랭킹은 기간·카테고리별로 인기 공구와 판매자를 탐색하는 화면입니다.", styles["Body"]),
              two_figures(ASSETS["home"], "그림 1. 홈/공구 탐색 화면 예시", ASSETS["ranking"], "그림 2. 랭킹/공구 탐색 화면 예시", width=2.75 * inch),
              p("홈에서는 인기 공구 카드, 카테고리와 일정 정보를 확인하고, 랭킹에서는 기간·카테고리별 인기 공구와 판매자를 탐색합니다. 상품명, 가격·마감, 판매자 정보가 카드에 함께 표시되어 서비스 콘텐츠 유형을 즉시 파악할 수 있습니다.", styles["Body"]),
              callout("검수 포인트", "서비스의 중심 콘텐츠는 상품 자체의 판매 페이지가 아니라, 공동구매 상품 정보와 진행 기간을 모아 보여주는 정보 카드입니다.")]

    # Page 6.
    story += [PageBreak(), p("7. 화면 예시 - 릴스와 상품 상세", styles["H1Ko"]),
              p("릴스는 공동구매 상품의 이미지·영상 콘텐츠를 세로로 빠르게 탐색하는 화면입니다. 상품 상세에서는 해당 공구의 기간, 가격, 판매자, 카테고리, 요약과 외부 구매 링크를 확인합니다.", styles["Body"]),
              two_figures(ASSETS["reels"], "그림 3. 릴스형 공동구매 콘텐츠 탐색", ASSETS["detail"], "그림 4. 상품 상세의 상품·판매자·구매 링크 정보"),
              p("상품 상세의 구매 링크는 각 공구 판매자 또는 외부 쇼핑몰이 제공하는 페이지로 이동하기 위한 링크입니다. 공구위시의 역할은 해당 링크를 포함한 공구 정보를 검수·정리하여 탐색 가능하게 제공하는 것입니다.", styles["Body"]),
              callout("상품 취급 범위", "현재 서비스에서 소개하는 상품은 인플루언서 공동구매 콘텐츠에 포함된 식품, 생활용품, 뷰티, 패션, 홈·리빙, 육아 등의 상품 정보입니다. 공구위시가 직접 상품을 보유하거나 판매하지는 않습니다.", accent=colors.HexColor("#7A5A00"), fill=YELLOW)]

    # Page 7.
    story += [PageBreak(), p("8. 화면 예시 - 공개 웹 캘린더와 공구 제보", styles["H1Ko"]),
              p("공개 웹은 모바일 앱과 동일한 서비스의 콘텐츠 확인용 접근 경로입니다. 캘린더 페이지에서는 승인된 공동구매의 상품명, 판매자, 요약, 할인 및 마감 시점을 확인할 수 있습니다.", styles["Body"]),
              figure(ASSETS["calendar"], "그림 5. 공개 웹 공동구매 캘린더 화면 예시", 5.8 * inch),
              p("공구 제보 화면에서는 Instagram 원본 게시물 URL을 입력하고 제품명, 카테고리, 시작일·종료일, 구매 링크, 할인 정보, 요약을 제출합니다. 게시물 정보가 확인되면 상품 정보 자동 보강을 활용할 수 있으며, 제출된 정보는 운영자 검수 후 서비스에 반영됩니다.", styles["Body"]),
              figure(ASSETS["submit"], "그림 6. 공동구매 제보 입력 화면 예시", 3.2 * inch)]

    # Page 8.
    story += [PageBreak(), p("9. 화면 예시 - 로그인과 마이페이지", styles["H1Ko"]),
              p("네이버 로그인은 마이페이지의 개인화 기능을 이용하기 위한 인증 단계입니다. 공개 화면을 먼저 탐색한 뒤, 저장·팔로우·알림·계정 관리가 필요한 경우 로그인 화면으로 이동합니다.", styles["Body"])]
    auth_right = [
        Paragraph("현재 구현 기준: 네이버로 계속하기", styles["CalloutTitle"]),
        bullet_list([
            "로그인 화면에서 네이버로 계속하기를 선택합니다.",
            "인증 완료 후 공구위시 앱으로 복귀합니다.",
            "마이페이지에서 북마크·최근 본 공구·알림 공구·팔로우·설정을 확인합니다.",
            "계정 삭제 안내와 개인정보처리방침 링크를 제공합니다.",
        ]),
    ]
    auth_image_cell = [image(ASSETS["auth"], 2.45 * inch), p("그림 7. 로그인 화면 예시(공급자 구성은 빌드별 차이 가능)", styles["Caption"])]
    auth_table = Table([[auth_image_cell, auth_right]], colWidths=[2.75 * inch, 3.75 * inch])
    auth_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOX", (0, 0), (-1, -1), 0.45, GRID),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [auth_table, callout("로그인 없이 가능한 이용", "홈·랭킹·릴스·검색·캘린더·상품 상세 같은 공개 콘텐츠는 로그인 없이 확인할 수 있습니다. 네이버 로그인은 개인 활동을 저장하고 계정별 설정을 관리하기 위한 기능입니다.", accent=GREEN, fill=LIGHT_BLUE),
              PageBreak(),
              p("10. 검수자가 확인할 수 있는 서비스 예정 URL", styles["H1Ko"]),
              p("웹 서비스는 현재 위 공개 URL을 통해 콘텐츠 확인이 가능하며, 모바일 앱은 같은 공구위시 서비스의 iOS/Android 표면으로 제공합니다. 모바일 앱에서의 네이버 로그인 적용 화면은 다음 경로로 확인할 수 있습니다.", styles["Body"]),
              bullet_list(["공구위시 앱 실행 -> 마이페이지", "로그인 또는 개인화 기능 선택", "네이버로 계속하기 선택", "인증 후 마이페이지로 복귀"], numbered=True),
              p("앱 검수용 설치 경로 또는 테스터 접근 정보가 필요한 경우에는 네이버 로그인 검수 신청 페이지의 앱 접근 정보란에 해당 빌드/테스트 계정을 함께 기재해 주시면 됩니다.", styles["Body"])]

    # Page 9.
    story += [PageBreak(), p("부록 A. 검수 신청 페이지 소명 내용", styles["H1Ko"]),
              p("아래 문안은 네이버 로그인 검수 신청 페이지의 소명 내용 입력 란에 그대로 붙여 넣을 수 있도록 작성했습니다.", styles["Body"])]
    submission = (ROOT / "output" / "naver-login-review" / "naver-login-submission-explanation.txt").read_text(encoding="utf-8")
    story.append(callout("복사하여 제출할 문안", submission))
    story += [p("부록 B. 자료 작성 기준", styles["H1Ko"]),
              p("본 자료는 공구위시의 모바일 앱 화면 구조, 공개 웹 서비스 페이지, 서비스 이용약관·개인정보처리방침에 기재된 서비스 기능을 기준으로 작성했습니다. 화면 캡처에는 테스트 또는 스토어 소개용 샘플 데이터가 포함될 수 있으며, 서비스 운영 데이터는 검수·기간·콘텐츠 상태에 따라 변경될 수 있습니다.", styles["Body"]),
              p("검수자가 접근할 URL: https://gongguwish.com/  |  캘린더: https://gongguwish.com/calendar  |  제보: https://gongguwish.com/submit", styles["Small"])]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.build(story)
    print(OUT)


if __name__ == "__main__":
    build()
