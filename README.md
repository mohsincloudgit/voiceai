# 🎙️ AI Voice Agent CRM & Knowledge Base Studio

A full-stack, enterprise-grade **CRM-based AI Voice Sales Agent** system with an embeddable widget that can be placed in any website footer using a single line of script or iframe code.

---

## 🌟 Key Features

1. **Website Footer Embed (Iframe & Script Options)**:
   - **Smart Floating Footer Script**: Automatically displays an animated glowing microphone button with soundwave pulses and a *"Talk with AI"* badge at the bottom-right of any webpage.
   - **Pure Iframe Code**: Direct copy-paste iframe snippet with microphone permissions (`allow="microphone; speech-recognition; autoplay"`).
   - Works seamlessly with **WordPress, Shopify, Webflow, Wix, Squarespace, React, Vue, Next.js, and static HTML**.

2. **Custom Service Knowledge Base Engine**:
   - Create custom voice agents tailored to specific services (e.g., Digital Agency, Real Estate, Dental Clinic, Solar Energy, SaaS, E-commerce).
   - Custom **Sales Pitches & Value Propositions**.
   - Custom **Q&A / Knowledge Topics** (Pricing, Packages, Turnaround Times, Guarantees).
   - Targeted **Qualification Questions** (e.g., budget, timeline, current website, inquiry volume).
   - **Objection Handling Matrix** (counters for common hesitations).
   - Automated **Closing & Confirmation Script**.

3. **Complete Conversation & Lead Email Dispatcher**:
   - Automatically compiles:
     - Customer contact info (Name, Phone, Email, Preferred Appointment Slot, Budget, Notes).
     - AI Executive Summary of customer intent.
     - Full color-coded, timestamped Audio Conversation Transcript (Agent vs Customer).
   - Dispatches via **Nodemailer SMTP** (supports Gmail App Passwords, Brevo, Sendgrid, custom SMTP) with instant preview support.

4. **Executive CRM Dashboard**:
   - **Overview Analytics**: Real-time stats on active agents, incoming leads, qualification rate, and emailed transcripts.
   - **Voice Agent Builder**: Visual editor to add, edit, or remove knowledge base topics, qualification flows, avatars, and brand colors.
   - **Leads & Transcripts Manager**: Searchable and filterable lead table with full conversation drawer and 1-click **Resend Email** button.
   - **Embed Code Generator**: Live interactive widget preview with 1-click clipboard copy for iframe, script tag, or direct URL.
   - **SMTP & Gemini Settings**: Configure notification recipients and optional Google Gemini API key.

---

## 🚀 Quick Start Guide

### 1. Installation & Running

```bash
# Clone or navigate to the directory
cd d:\voice-agent

# Install dependencies (already completed)
npm install

# Start Next.js Development Server
npm run dev

# Or Build & Start Production
npm run build
npm start
```

The application will be live at:
- **CRM Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Live Footer Demo Website**: [http://localhost:3000/demo](http://localhost:3000/demo)
- **Direct Widget Preview**: [http://localhost:3000/widget/agent_digital_agency](http://localhost:3000/widget/agent_digital_agency)

---

## 📋 How to Embed in Any Website Footer

### Option A: Smart Floating Script (Recommended)
Paste this snippet right before the closing `</body>` tag of your website:

```html
<!-- AI Voice Agent Floating Widget -->
<script src="http://YOUR_SERVER_URL/embed.js" data-agent-id="agent_digital_agency" async></script>
```

### Option B: Pure Iframe Code
Paste this snippet inside your website footer:

```html
<!-- AI Voice Agent Iframe Embed -->
<iframe
  src="http://YOUR_SERVER_URL/widget/agent_digital_agency"
  style="position:fixed;bottom:20px;right:20px;width:390px;height:610px;border:none;border-radius:22px;box-shadow:0 16px 50px rgba(0,0,0,0.5);z-index:999999;"
  allow="microphone; speech-recognition; autoplay"
  title="AI Voice Sales Agent"
></iframe>
```

---

## ✉️ Setting Up Email Notifications (Gmail / SMTP)

You can configure automated email notifications and full voice transcript delivery in two ways:

### Method 1: Via `.env` File (Recommended for Servers & Deployments)
Create a `.env` file in the root directory (based on `.env.example`):
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_digit_app_password
NOTIFICATION_EMAIL=admin_leads@yourcompany.com
```

### Method 2: Via CRM Dashboard UI
1. Open the CRM Dashboard: [http://localhost:3000](http://localhost:3000).
2. Click on **"Settings"** in the sidebar.
3. Enter your SMTP details:
   - **SMTP Host**: `smtp.gmail.com`
   - **SMTP Port**: `587`
   - **SMTP User**: `your-email@gmail.com`
   - **SMTP Pass**: Your 16-character Google **App Password** (Generate directly at: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
   - **Admin Notification Recipient**: Email address where all qualified leads and audio transcripts should be delivered.
4. Click **"Save CRM Settings"** and then **"Send Test Email"** to verify the connection.

---

## 🤖 Customizing Knowledge Base for Different Services

1. In the CRM Dashboard, navigate to **"Voice Agents & KB"**.
2. Click **"New Voice Agent"** (or click **"Edit KB & Agent"** on an existing agent).
3. Fill in:
   - **Service Being Sold**: (e.g., *Solar Roofing Installation*, *Real Estate Villa Sales*, *SaaS Automation*).
   - **Welcome Greeting**: Spoken by the agent when a customer opens the widget.
   - **Knowledge Items**: Add topics like *Pricing*, *Timeline*, *Packages*, *Guarantees*.
   - **Qualification Questions**: Enter the questions the agent should ask (e.g. *What is your monthly power bill?*).
   - **Closing Script**: How the agent confirms the contact details.
4. Click **"Save Agent & Knowledge Base"**. The embed code and live widget update instantly!

---

## 📁 Project Architecture

```
d:\voice-agent\
├── server.js              # Express API server, Gemini AI reasoning, Nodemailer dispatcher
├── public/
│   ├── index.html         # CRM Dashboard interface
│   ├── widget.html        # Floating Voice Agent widget interface
│   ├── demo.html          # Realistic client website demonstrating footer embed
│   ├── embed.js           # Lightweight embed loader script
│   ├── css/
│   │   ├── dashboard.css  # Dark glassmorphic CRM styling
│   │   └── widget.css     # Siri / Gemini Live inspired glowing visualizer styles
│   └── js/
│       ├── dashboard.js   # Dashboard logic, KB editor, leads management, embed generator
│       └── widget.js      # Browser Web Speech API, voice synthesis, auto form detection
├── data/
│   ├── agents.json        # Preloaded agent templates & custom knowledge bases
│   ├── leads.json         # Captured leads, conversation transcripts, audio logs
│   └── settings.json      # SMTP settings, Gemini API key, notification config
└── package.json
```
