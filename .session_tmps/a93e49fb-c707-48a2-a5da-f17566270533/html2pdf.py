import asyncio
from playwright.async_api import async_playwright
import sys

HTML = sys.argv[1]
PDF = sys.argv[2]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("file://" + HTML, wait_until="networkidle")
        await page.pdf(
            path=PDF,
            format="A4",
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
        )
        await browser.close()
        print("PDF written:", PDF)

asyncio.run(main())
