import sys
from playwright.sync_api import sync_playwright

html_path = sys.argv[1]
pdf_path = sys.argv[2]

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(f"file://{html_path}", wait_until="networkidle")
    page.pdf(
        path=pdf_path,
        format="A4",
        margin={"top": "25mm", "right": "20mm", "bottom": "20mm", "left": "20mm"},
        print_background=True,
    )
    browser.close()

print(f"PDF generated: {pdf_path}")
