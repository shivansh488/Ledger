import axios from "axios";
import { Request, Response } from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { extractTextFromImage } from "../helper/getCaptcha";

export const loginSimple = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true, // Set to true for production
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      // Removed slowMo for faster execution
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Set up parallel tasks for faster execution
    const [_, captchaPromise] = await Promise.all([
      page.goto("https://webportal.juit.ac.in:6011/studentportal/#/", {
        waitUntil: "networkidle2",
        timeout: 30000,
      }),
      page.waitForSelector('input[formcontrolname="userid"]', {
        timeout: 10000,
      }),
    ]);

    // Fill username directly using evaluate (faster than typing)
    await page.evaluate((username) => {
      const input = document.querySelector(
        'input[formcontrolname="userid"]'
      ) as HTMLInputElement;
      if (input) {
        input.value = username;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, username);

    // Process CAPTCHA
    const captchaDataUrl = await page.evaluate(() => {
      const img = document.querySelector(
        'img[src^="data:image"]'
      ) as HTMLImageElement;
      return img ? img.src : "";
    });

    if (!captchaDataUrl) {
      throw new Error("CAPTCHA image not found");
    }

    // Write CAPTCHA image in parallel with other operations
    const base64Data = captchaDataUrl.split(",")[1];
    const imagePath = path.join(__dirname, "../src/captcha/captcha.jpg");
    const dir = path.dirname(imagePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(imagePath, Buffer.from(base64Data, "base64"));
    const captchaText = await extractTextFromImage("src/captcha/captcha.jpg");

    if (!captchaText) {
      throw new Error("Failed to extract CAPTCHA text");
    }

    // Fill CAPTCHA directly
    await page.evaluate((text) => {
      const input = document.querySelector(
        'input[formcontrolname="captcha"]'
      ) as HTMLInputElement;
      if (input) {
        input.value = text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, captchaText);

    // Submit first form and wait for navigation
    await Promise.all([
      page.click('button[aria-label="LOGIN"]'),
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }),
    ]);

    // Fill password directly
    await page.evaluate((password) => {
      const input = document.querySelector(
        'input[formcontrolname="password"]'
      ) as HTMLInputElement;
      if (input) {
        input.value = password;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, password);

    // Submit final form
    await page.evaluate(() => {
      // Find the login button
      const loginButton = document.querySelector('button[aria-label="LOGIN"]');

      if (loginButton) {
        // Remove disabled attribute
        loginButton.removeAttribute("disabled");

        // Remove disabled class if exists
        loginButton.classList.remove("mat-mdc-button-touch-target");

        // Trigger click
        loginButton.click();
      }
    });

    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 });

    // Check login status
    const [currentUrl, bodyText, token] = await Promise.all([
      page.url(),
      page.evaluate(() => document.body.innerText),
      page.evaluate(() => localStorage.getItem("Token")),
    ]);

    const isLoginSuccessful =
      !bodyText.includes("Enter Password") &&
      !bodyText.includes("Invalid") &&
      !bodyText.includes("Error") &&
      !bodyText.includes("LOGIN");

    await browser.close();

    res.status(200).json({
      message: isLoginSuccessful ? "Login successful" : "Login may have failed",
      bodyText: bodyText.substring(0, 500),
      currentUrl,
      token,
      isLoginSuccessful,
      captchaText,
    });
  } catch (error) {
    console.error("Login automation failed:", error);

    if (browser) {
      await browser.close();
    }

    res.status(500).json({
      error: "Login automation failed",
      details: error.message,
    });
  }
};

//

// Controller to fetch attendance details from JUIT web portal
export const fetchAttendanceDetails = async (req: Request, res: Response) => {
  try {
    const token = req.query.token;
    console.log("this is token", token);

    const url =
      "https://webportal.juit.ac.in:6011/StudentPortalAPI/StudentClassAttendance/getstudentattendancedetail";

    const oldAuthorization = "Bearer " + token;

    const headers = {
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "Accept-Language": "en-US,en;q=0.5",
      Authorization: oldAuthorization,
      Connection: "keep-alive",
      "Content-Type": "application/json",
      Host: "webportal.juit.ac.in:6011",
      LocalName: "MHMIzQaIeBrB+xmuN1SUTA2xHLmkxVTkLwzlJmvnMBk=", // Updated to match curl
      Origin: "https://webportal.juit.ac.in:6011",
      Referer: "https://webportal.juit.ac.in:6011/studentportal/",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
      "Sec-GPC": "1",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      "sec-ch-ua": '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
    };

    // Fixed: Remove the extra quotes around the data to match curl's --data-raw
    const data = `E+gXA49xuaSGCc49U2XEmr5rGRNLmMVwNae6fZEmf/RJMTMMUeaJNCnL6xhHc7OtXky33v5GaQ3y9TGbEnZ9YdmuW6JJnFuR5PTKAT5cycOdRSqhdk1ds58a02AtCZB1iS8YpJsqStoWfZKkzMws8x3cPHeCi3G2fc4m37hDlqk=`;

    const response = await axios.post(url, data, { headers });

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Failed to fetch attendance details:", error);
    res.status(500).json({
      error: "Failed to fetch attendance details",
      details: error.message || error.toString(),
    });
  }
};
