import asyncio
import base64
from playwright.async_api import async_playwright
import nest_asyncio
import os
import time

nest_asyncio.apply()

async def download_more_captchas(start=101, end=5000, save_dir="captchas"):
    os.makedirs(save_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Use headless=True if you prefer
        context = await browser.new_context()

        for i in range(start, end + 1):
            page = await context.new_page()

            try:
                await page.goto("https://webportal.juit.ac.in:6011/studentportal/#/")
                await page.wait_for_selector('img[src^="data:image"]', timeout=10000)

                await asyncio.sleep(2)  # Wait to ensure new CAPTCHA is rendered

                # Get CAPTCHA base64 data
                captcha_data_url = await page.get_attribute('img[src^="data:image"]', 'src')
                base64_data = captcha_data_url.split(",")[1]

                # Save image
                file_path = os.path.join(save_dir, f"captcha_{i}.png")
                with open(file_path, "wb") as f:
                    f.write(base64.b64decode(base64_data))

                print(f"✅ Saved: {file_path}")

            except Exception as e:
                print(f"❌ Failed to fetch CAPTCHA {i}: {e}")
            finally:
                await page.close()
                time.sleep(1)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(download_more_captchas(start=101, end=5000))
