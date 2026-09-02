# 🏆 Pulari Club - Monthly Fee Management Web App

A modern, responsive, mobile-first Web Application built with **HTML5, CSS3, and Vanilla JavaScript** for collecting and managing monthly club fees. Designed specifically for **100% free hosting on GitHub Pages** and backed by **Google Sheets** via **Google Apps Script**.

---

## ✨ Features

- ✉️ **Free Real Email OTP Login**: Members log in with their email address. Real 6-digit OTP codes are delivered directly to their inbox for free using Google Sheets & `GmailApp.sendEmail()`.
- 💳 **Direct UPI QR Code Payment**: Dynamic UPI QR code generation supporting Google Pay, PhonePe, Paytm, BHIM, and direct mobile intent links.
- 🧾 **Digital Payment Receipts**: Instant printable digital receipts with verification stamp and UTR reference number.
- 🛡️ **Admin Dashboard**:
  - Financial overview: Total collected, pending dues, collection rate %.
  - 1-Click payment approval & status updates.
  - Member management: Add new members with email and custom monthly fee rates.
  - WhatsApp payment reminder links.
  - Export collection reports to CSV.
- 📊 **Google Sheets Backend**: Zero server costs. Direct two-way sync with Google Sheets for storing members, emails, and payments.
- ⚡ **Offline & Demo Mode**: Fully functional offline/demo mode with pre-seeded realistic data for instant testing.

---

## 🚀 How to Run Locally

You can open the project immediately in any web browser:

1. Double-click [index.html](file:///c:/Users/asimj/Desktop/pulari/index.html) or run a local lightweight server:
   ```bash
   npx serve .
   ```
2. Open `http://localhost:3000` (or `http://localhost:8080`) in your browser.

---

## 🌐 How to Deploy to GitHub Pages (Free Hosting)

1. **Initialize Git & Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Pulari Club Fee Portal"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub.
   - Click on **Settings** > **Pages** (in the left sidebar).
   - Under **Build and deployment** > **Source**, choose `Deploy from a branch`.
   - Select the `main` branch and `/ (root)` folder, then click **Save**.
   - Your website will be live in ~30 seconds at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

---

## 📊 How to Connect with Google Sheets (Enables Real Free Email OTP)

Follow these quick steps to use your Google Sheet as the live database and send real email OTPs:

1. Create a blank Google Sheet at [sheets.new](https://sheets.new) and name it **"Pulari Club Fee Database"**.
2. In the top menu, click **Extensions** > **Apps Script**.
3. Delete any default code in the editor, and copy-paste the entire code from [google-apps-script/Code.gs](file:///c:/Users/asimj/Desktop/pulari/google-apps-script/Code.gs).
4. Click the blue **Deploy** button (top-right) > **New deployment**.
5. Click the **Gear icon (⚙️)** next to "Select type" and choose **Web app**.
6. Set the fields:
   - **Description**: `Pulari Fee API & Email OTP`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone` *(Important so your website can communicate with your sheet)*
7. Click **Deploy** and authorize permissions when prompted (this allows Google Apps Script to send emails from your account for free).
8. Copy the **Web App URL** (looks like `https://script.google.com/macros/s/AKfycb.../exec`).
9. In your deployed GitHub Pages website (or local `index.html`), click the **⚙️ Settings icon** in the top navbar, paste the URL into **Google Apps Script Web App URL**, and click **Save Settings**!

---

## 🔑 Default Credentials for Testing

| Role | Email / PIN | Notes |
| :--- | :--- | :--- |
| **Member 1** | `rahul.pulari@gmail.com` | Rahul Sharma (Status: Pending) |
| **Member 2** | `anoop.pulari@gmail.com` | Anoop Krishnan (Status: Paid) |
| **Member 3** | `priya.pulari@gmail.com` | Priya Nair (Status: Under Verification) |
| **Admin PIN** | `1234` | Click the **Admin** tab to unlock the dashboard |

*(You can change the Admin PIN, Club Name, and Club UPI ID anytime inside the Settings modal)*
