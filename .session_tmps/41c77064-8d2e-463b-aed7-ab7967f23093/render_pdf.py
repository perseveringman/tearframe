#!/usr/bin/env python3
"""复用 hv-analysis 的 HTML 模板，用 Playwright(Chromium) 渲染 PDF（替代 weasyprint）。"""
import sys, os, asyncio
sys.path.insert(0, "/Users/ryanbzhou/Library/Application Support/Box/engine/skills/user/hv-analysis/scripts")

# 直接复用脚本里的 md_to_html（它在 import weasyprint 之前定义，import 该模块会触发顶层无副作用部分）
import importlib.util
spec = importlib.util.spec_from_file_location(
    "md2pdf",
    "/Users/ryanbzhou/Library/Application Support/Box/engine/skills/user/hv-analysis/scripts/md_to_pdf.py",
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)  # 模块顶层不 import weasyprint，安全

INPUT = "/Users/ryanbzhou/Developer/vibe-coding/freedom/tearframe/.session_tmps/41c77064-8d2e-463b-aed7-ab7967f23093/采访能力_横纵分析报告.md"
OUTPUT = "/Users/ryanbzhou/Developer/vibe-coding/freedom/tearframe/output/41c77064-8d2e-463b-aed7-ab7967f23093/播客采访能力_横纵分析报告.pdf"
HTMLP = "/Users/ryanbzhou/Developer/vibe-coding/freedom/tearframe/.session_tmps/41c77064-8d2e-463b-aed7-ab7967f23093/采访能力_横纵分析报告.html"

with open(INPUT, encoding="utf-8") as f:
    md_text = f.read()

meta_line = ""
for line in md_text.split("\n"):
    s = line.strip().lstrip(">").strip()
    if "研究时间" in s or "所属领域" in s:
        meta_line = s
        break

html = mod.md_to_html(md_text, title="采访这门手艺", meta_line=meta_line, author="数字生命卡兹克")
# Playwright 用 @page size 控制纸张；@top/@bottom 的 CSS Paged Media 页眉页脚 Chromium 不支持，
# 改用 Chromium 的 headerTemplate/footerTemplate。先把 @page 里的 margin 保留即可。
with open(HTMLP, "w", encoding="utf-8") as f:
    f.write(html)
print("[OK] HTML:", HTMLP)

async def render():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("file://" + HTMLP, wait_until="networkidle")
        header = ('<div style="font-size:8px;color:#95a5a6;width:100%;text-align:center;'
                  'padding:0 20mm;">采访这门手艺 &nbsp;|&nbsp; 横纵分析法深度研究报告</div>')
        footer = ('<div style="font-size:8px;color:#95a5a6;width:100%;text-align:center;">'
                  '第 <span class="pageNumber"></span> 页</div>')
        await page.pdf(
            path=OUTPUT, format="A4", print_background=True,
            display_header_footer=True,
            header_template=header, footer_template=footer,
            margin={"top": "22mm", "bottom": "18mm", "left": "18mm", "right": "18mm"},
        )
        await browser.close()

asyncio.run(render())
print("[OK] PDF:", OUTPUT, round(os.path.getsize(OUTPUT)/1024, 1), "KB")
