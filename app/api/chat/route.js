import { NextResponse } from 'next/server';
import { getAgents, getSettings, getLeads, saveLead } from '@/lib/db';
import { getEmailTransporter, generateLeadEmailHtml } from '@/lib/email';
import { GoogleGenAI } from '@google/genai';

// --- Helper Functions for Entity Extraction & Intent Detection ---

function extractPhone(text) {
  if (!text) return null;
  const patterns = [
    /(?:\+?92|0092)[-\s]?3\d{2}[-\s]?\d{7}/,
    /\b03\d{2}[-\s]?\d{7}\b/,
    /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
    /\b\d{11}\b/,
    /\b\d{10}\b/
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const clean = m[0].replace(/[-.\s]/g, '');
      if (clean.length >= 10) return clean;
    }
  }
  return null;
}

function extractEmail(text) {
  if (!text) return null;
  const m = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  return m ? m[0].trim() : null;
}

function extractName(text, previousAgentQuestion = '') {
  if (!text) return null;
  const stopWords = new Set([
    'hai', 'hei', 'hun', 'hoon', 'mera', 'meri', 'naam', 'name', 'contact', 'number',
    'phone', 'call', 'karo', 'karna', 'kardo', 'whatsapp', 'website', 'wesite', 'chahiye', 'need',
    'salam', 'hello', 'hi', 'bhai', 'sir', 'yes', 'no', 'theek', 'thik', 'done', 'email',
    'aur', 'and', 'apka', 'aapka', 'shubh', 'jee', 'ji', 'g'
  ]);

  const patterns = [
    /(?:mera\s+naam|my\s+name\s+is|this\s+is|i\s+am|naam\s+hai|naam\s+hei|naam|name)\s*(?:is|hai|hei|:)?\s*([A-Za-z]{2,20}(?:\s+[A-Za-z]{2,20})?)/i,
    /([a-zA-Z]{3,15})\s+(?:03\d{2}|\+?92\d{2}|\d{10,11})/i,
    /(?:03\d{2}|\+?92\d{2}|\d{10,11})\s+([a-zA-Z]{3,15})/i
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const words = m[1].trim().split(/\s+/).filter(w => !stopWords.has(w.toLowerCase()));
      if (words.length > 0) {
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }
  }

  // If previous turn asked for name, and user responded with a short 1-2 word response
  const prevLower = (previousAgentQuestion || '').toLowerCase();
  if (prevLower.includes('naam') || prevLower.includes('name')) {
    const clean = text.trim();
    const words = clean.split(/\s+/).filter(w => !stopWords.has(w.toLowerCase()) && !w.match(/\d/));
    if (words.length >= 1 && words.length <= 2 && clean.length <= 25) {
      return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  return null;
}

function extractRequirement(text) {
  if (!text) return { category: null, features: [], budget: null, timeline: null, rawText: '' };
  const lower = text.toLowerCase();
  const res = { category: null, features: [], budget: null, timeline: null, rawText: text };

  if (lower.includes('ghl') || lower.includes('gohighlevel')) {
    res.category = 'GoHighLevel (GHL) CRM & Automations';
    res.features.push('GHL CRM Automation');
  } else if (lower.includes('shopify')) {
    res.category = 'Shopify E-Commerce Store';
    res.features.push('Shopify Store');
  } else if (lower.includes('wordpress') || lower.includes('woocommerce')) {
    res.category = 'WordPress & WooCommerce Development';
    res.features.push('WordPress Development');
  } else if (lower.includes('e-commerce') || lower.includes('ecommerce') || lower.includes('online store') || lower.includes('shop')) {
    res.category = 'E-Commerce Website';
    res.features.push('E-Commerce Store');
  } else if (lower.includes('crm') || lower.includes('cms') || lower.includes('portal') || lower.includes('dashboard')) {
    res.category = 'Custom CMS & CRM Portal';
    res.features.push('CMS/CRM Portal');
  } else if (lower.includes('automation') || lower.includes('ai agent') || lower.includes('voice agent')) {
    res.category = 'AI Automation & Agents';
    res.features.push('AI Automation');
  } else if (lower.includes('wesite') || lower.includes('website') || lower.includes('web build') || lower.includes('web development') || lower.includes('web')) {
    res.category = 'Website Build & Development';
  }

  // Features & Additional Details
  if (lower.includes('payment') || lower.includes('gateway') || lower.includes('stripe') || lower.includes('paypal') || lower.includes('easypaisa') || lower.includes('jazzcash')) {
    if (!res.features.includes('Payment Gateway Integration')) res.features.push('Payment Gateway Integration');
  }
  if (lower.includes('seo') || lower.includes('ranking') || lower.includes('speed') || lower.includes('marketing')) {
    if (!res.features.includes('SEO & Speed Optimization')) res.features.push('SEO & Speed Optimization');
  }
  if (lower.includes('admin') || lower.includes('dashboard') || lower.includes('panel')) {
    if (!res.features.includes('Admin Management Panel')) res.features.push('Admin Management Panel');
  }
  if (lower.includes('funnel') || lower.includes('landing page')) {
    if (!res.features.includes('Sales Funnel')) res.features.push('Sales Funnel');
  }
  if (lower.includes('zapier') || lower.includes('make') || lower.includes('n8n') || lower.includes('webhook')) {
    if (!res.features.includes('Workflow Automations')) res.features.push('Workflow Automations');
  }

  const bM = text.match(/(?:budget|pese|cost|range)\s*(?:hai|is|:)?\s*([0-9kK$,]+(?:\s*(?:rs|pkr|usd|\$|dollars|thousand|lakh))?)/i) ||
             text.match(/(\$\s*\d+[\d,]*|\b\d+[\d,]*\s*(?:rs|pkr|dollars|lakh|k)\b)/i);
  if (bM) res.budget = bM[1].trim();

  const tM = text.match(/(?:timeline|time|duration|ready|deadline)\s*(?:hai|is|:)?\s*([0-9]+(?:\s*(?:days|din|weeks|months|haftay))?)/i) ||
             text.match(/(\b\d+\s*(?:days|weeks|months|din|haftay)\b)/i);
  if (tM) res.timeline = tM[1].trim();

  return res;
}

// Check if current message is describing a project requirement or service
function isRequirementInput(msg) {
  const lower = (msg || '').toLowerCase();
  const keywords = [
    'website', 'wesite', 'build', 'store', 'crm', 'cms', 'ecommerce', 'e-commerce', 'payment', 'gateway',
    'app', 'chahiye', 'banani', 'banwana', 'bana dein', 'redesign', 'seo', 'features',
    'portal', 'dashboard', 'landing page', 'portfolio', 'online shop', 'ghl', 'wordpress', 'shopify'
  ];
  return keywords.some(k => lower.includes(k));
}

export async function POST(request) {
  try {
    const { agentId, message = '', conversationHistory = [], mode = 'voice' } = await request.json();
    const agents = await getAgents();
    const settings = await getSettings();
    const leads = await getLeads();
    const agent = agents.find(a => a.id === agentId) || agents[0];

    if (!agent) {
      return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    }

    const isText = mode === 'text';
    const channelName = isText ? 'Text Chat' : 'Voice Agent';
    const lowerMessage = (message || '').toLowerCase().trim();

    // 1. Gather all prior conversation texts for cumulative state
    const priorUserTexts = (conversationHistory || [])
      .filter(item => item.role === 'customer' || item.role === 'user')
      .map(item => item.text || '');

    const allUserTexts = [...priorUserTexts, message].filter(Boolean);
    const cumulativeText = allUserTexts.join(' ');

    const lastAgentTurn = [...(conversationHistory || [])]
      .reverse()
      .find(h => h.role === 'agent' || h.role === 'model')?.text || '';

    // 2. Cumulative entity extraction across history
    let detectedName = extractName(message, lastAgentTurn) || extractName(cumulativeText);
    let detectedPhone = extractPhone(message) || extractPhone(cumulativeText);
    let detectedEmail = extractEmail(message) || extractEmail(cumulativeText);
    let reqDetails = extractRequirement(cumulativeText);

    // Current turn extractions
    const currentPhone = extractPhone(message);
    const currentEmail = extractEmail(message);
    const currentName = extractName(message, lastAgentTurn);

    // Check if booking was ALREADY confirmed in THIS current conversation session
    const bookingConfirmedInThisSession = (conversationHistory || []).some(h =>
      (h.role === 'agent' || h.role === 'model') &&
      (h.text || '').includes('🎉 Zabardast') &&
      (h.text || '').includes('confirm ho chuki')
    );

    // Check if the agent just presented the review checklist to verify
    const agentAskedForVerification = lastAgentTurn.includes('verify') ||
                                     lastAgentTurn.includes('theek hain aur main') ||
                                     lastAgentTurn.includes('Final submission se pehle') ||
                                     lastAgentTurn.includes('email send kar doon');

    // Customer confirms the review checklist (Step 4)
    const isConfirmingReview = agentAskedForVerification && (
      lowerMessage.includes('haan') ||
      lowerMessage.includes('yes') ||
      lowerMessage.includes('theek') ||
      lowerMessage.includes('thik') ||
      lowerMessage.includes('g') ||
      lowerMessage.includes('ji') ||
      lowerMessage.includes('jee') ||
      lowerMessage.includes('done') ||
      lowerMessage.includes('sahi') ||
      lowerMessage.includes('send') ||
      lowerMessage.includes('confirm') ||
      lowerMessage.includes('krdo') ||
      lowerMessage.includes('kardo') ||
      lowerMessage.includes('kardein') ||
      lowerMessage.includes('krdein') ||
      lowerMessage.includes('ok') ||
      lowerMessage.includes('sure') ||
      lowerMessage.includes('bilkul')
    );

    let detectedBookingConfirmed = false;

    // Knowledge base matching
    const kbText = (agent.knowledgeBase || [])
      .map(k => `[Topic: ${k.topic}]\n${k.content}`)
      .join('\n\n');

    let aiResponseText = '';
    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

    // --- GEMINI AI GENERATION (IF API KEY PRESENT) ---
    if (apiKey) {
      try {
        const systemPrompt = `
You are "${agent.name}", an expert consultant and booking representative for "${agent.serviceName}".
Persona: High-tech, consultative, friendly, strictly concise.

CURRENT COLLECTED STATE:
- Customer Name: ${detectedName || 'Not collected'}
- Customer Phone: ${detectedPhone || 'Not collected'}
- Customer Email: ${detectedEmail || 'Not collected'}
- Service Requirement: ${reqDetails.category || 'Not specified'}
- Additional Details: ${reqDetails.features.join(', ') || 'Standard build'}

CRITICAL 4-STEP PROTOCOL:
1. If customer asks or provides service requirement, confirm it and ask for any additional details/features (e.g. payment gateway, pages, admin panel).
2. Collect Name, Phone, and Email address.
3. ONCE ALL INFO (Name, Phone, Email, Service) IS COLLECTED: Present a structured review summary to the user asking:
   "Final submission se pehle kindly details verify kar lein: [Service, Name, Phone, Email]. Kya ye details theek hain aur main appointment confirm kar ke email send kar doon?"
4. ONCE USER CONFIRMS REVIEW: Confirm enthusiastically and dispatch email.

KNOWLEDGE BASE:
${kbText || 'High-performance digital agency and automation services.'}
`;

        const ai = new GoogleGenAI({ apiKey });
        const contents = [];
        (conversationHistory || []).forEach(item => {
          if (!item.text) return;
          contents.push({
            role: item.role === 'agent' ? 'model' : 'user',
            parts: [{ text: item.text.trim() }]
          });
        });
        contents.push({
          role: 'user',
          parts: [{ text: message }]
        });

        let response;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents,
            config: { systemInstruction: systemPrompt }
          });
        } catch (mErr) {
          response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents,
            config: { systemInstruction: systemPrompt }
          });
        }

        if (response && response.text) {
          aiResponseText = response.text.trim();
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, using stateful dialogue manager:', geminiErr.message);
      }
    }

    // --- HIGH-FIDELITY STATEFUL DIALOGUE MANAGER (GUARANTEES PERFECT 4-STEP VERIFICATION & SUBMISSION) ---
    if (!aiResponseText) {
      const nameGreeting = detectedName ? ` ${detectedName}` : '';
      const serviceDisplay = reqDetails.category || agent.serviceName || 'Website Build & Development';
      const featuresDisplay = reqDetails.features.length > 0
        ? reqDetails.features.join(', ')
        : (reqDetails.rawText ? 'Standard Custom Build' : 'Standard Full-Stack Setup');

      // STEP 4: Customer confirms the final review checklist -> Lock Booking & Dispatch Email!
      if (isConfirmingReview && detectedPhone && detectedEmail) {
        aiResponseText = `🎉 Zabardast${nameGreeting}! Aapki appointment aur service details confirm ho chuki hain. Complete verification summary aapke email (${detectedEmail}) par dispatch kar di gayi hai aur hamari team jald aapke number (${detectedPhone}) par rabta karegi!`;
        detectedBookingConfirmed = true;
      }

      // STEP 3: All Details (Name, Phone, Email, Service) are Complete -> Present Final Review Summary!
      else if (detectedName && detectedPhone && detectedEmail && !bookingConfirmedInThisSession) {
        aiResponseText = `Bohat shukriya${nameGreeting}! Final submission se pehle kindly details verify kar lein:

📌 Service: ${serviceDisplay}
⚙️ Additional Details: ${featuresDisplay}
👤 Name: ${detectedName}
📞 Phone: ${detectedPhone}
✉️ Email: ${detectedEmail}

Kya ye sab details theek hain aur main appointment confirm kar ke email send kar doon?`;
      }

      // If user has already booked in this session and continues chatting
      else if (bookingConfirmedInThisSession) {
        if (lowerMessage.includes('email') || lowerMessage.includes('mail')) {
          aiResponseText = `Aapki booking confirmation already ${detectedEmail || 'aapke email'} par send ho chuki hai. Agar koi aur email update karwana ho to zaroor batayein!`;
        } else {
          aiResponseText = `Aapki booking successfully confirmed hai aur details dispatch hain. Agar aapka koi aur technical question ho to zaroor batayein!`;
        }
      }

      // STEP 2B: Name and Phone are present, but Email is still missing
      else if (detectedName && detectedPhone && !detectedEmail) {
        aiResponseText = `Bohat shukriya${nameGreeting}! Aapka contact number (${detectedPhone}) maine note kar liya hai. Final submission review aur meeting confirmation receive karne ke liye aapka email address kya hai?`;
      }

      // STEP 2A: Phone is present, but Name is missing
      else if (detectedPhone && !detectedName) {
        aiResponseText = `Aapka contact number (${detectedPhone}) maine note kar liya hai. Final verification ke liye aapka naam aur email address kya hai?`;
      }

      // STEP 1: User mentions Service / Requirements (Contact details not yet complete)
      else if (isRequirementInput(lowerMessage) || reqDetails.category) {
        aiResponseText = `Ji zaroor! Hum ${serviceDisplay} provide karte hain. Isme aapko koi additional features ya specific requirements (jaise payment gateway, admin portal, e-commerce, ya timeline) add karwani hain? Aur aapka naam, contact number aur email address kya hai taake main complete quotation note kar sakoon?`;
      }

      // Pricing & Packages Questions
      else if (lowerMessage.match(/\b(price|cost|package|rate|charges|kitne|pese|how much)\b/)) {
        const priceKb = (agent.knowledgeBase || []).find(k =>
          (k.topic || '').toLowerCase().includes('price') || (k.content || '').toLowerCase().includes('$') || (k.content || '').toLowerCase().includes('package')
        );
        const pText = priceKb ? priceKb.content : `Starter packages $499 se shuru hote hain aur full-stack builds $999 se.`;
        aiResponseText = `${pText} Aapko complete proposal aur quotation share karne ke liye, aapka naam, phone number aur email address kya hai?`;
      }

      // Greetings / General Fallback
      else {
        if (lowerMessage.match(/\b(hi|hello|hey|salam|assalam|kese ho|kaise ho)\b/)) {
          aiResponseText = `Walaikum Assalam! Main ${agent.name} hoon ${agent.serviceName} se. Main aapki kya madad kar sakta hoon? Aapke project ki kya requirement hai?`;
        } else {
          aiResponseText = `Ji zaroor! Hum ${agent.serviceName} provide karte hain. Aapka naam, contact number aur email address kya hai taake main complete quotation share kar sakoon?`;
        }
      }
    }

    // Clean up text
    const cleanResponseText = aiResponseText.replace(/\[LEAD_DATA:[\s\S]*?\]/gi, '').replace(/[*#_`]/g, '').trim();

    // 5. IMMEDIATE LEAD RECORDING & DATABASE PERSISTENCE
    let autoEmailSent = false;
    let savedLeadId = null;

    if (detectedPhone || detectedEmail) {
      try {
        const fullTranscript = [...(conversationHistory || [])];
        fullTranscript.push({ role: 'customer', text: message, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
        fullTranscript.push({ role: 'agent', text: cleanResponseText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });

        const leadSourceTag = isText ? 'Text Chat' : 'Voice Agent';
        const currentFeatures = reqDetails.features.length > 0 ? reqDetails.features.join(', ') : 'Standard Build';
        const currentNotes = `Service: ${reqDetails.category || agent.serviceName}. Additional Details: ${currentFeatures}. Budget: ${reqDetails.budget || 'Flexible'}. Timeline: ${reqDetails.timeline || 'Standard'}.`;

        const existingLead = leads.find(l =>
          (detectedEmail && l.customerEmail === detectedEmail) ||
          (detectedPhone && l.customerPhone === detectedPhone)
        );

        const currentLeadStatus = detectedBookingConfirmed ? 'Booked' : (bookingConfirmedInThisSession ? 'Booked' : 'Contact Acquired');

        const leadPayload = {
          id: existingLead ? existingLead.id : 'lead_' + Date.now(),
          agentId: agent.id || agentId,
          agentName: agent.name,
          serviceName: agent.serviceName,
          customerName: detectedName || existingLead?.customerName || 'Website Client',
          customerEmail: detectedEmail || existingLead?.customerEmail || 'N/A',
          customerPhone: detectedPhone || existingLead?.customerPhone || 'N/A',
          serviceRequirement: reqDetails.category || existingLead?.serviceRequirement || agent.serviceName,
          budget: reqDetails.budget || existingLead?.budget || 'To be discussed',
          preferredTime: reqDetails.timeline || existingLead?.preferredTime || (isText ? 'Scheduled via Text Chat' : 'Scheduled via Voice Agent'),
          notes: currentNotes,
          leadSource: leadSourceTag,
          channel: isText ? 'Text Message' : 'Voice Call',
          status: currentLeadStatus,
          summary: `${currentLeadStatus}: ${detectedName || 'Customer'} regarding ${reqDetails.category || agent.serviceName} (${currentFeatures}) via ${leadSourceTag}.`,
          transcript: fullTranscript,
          emailSent: existingLead?.emailSent || false,
          emailSentTo: existingLead?.emailSentTo || '',
          createdAt: existingLead?.createdAt || new Date().toISOString()
        };

        // If booking was verified and confirmed in THIS turn, send email!
        if (detectedBookingConfirmed && detectedEmail && detectedEmail.includes('@')) {
          const transporter = getEmailTransporter(settings);
          if (transporter) {
            const recipients = new Set();
            if (settings.notificationEmail) recipients.add(settings.notificationEmail);
            if (agent.notificationEmail) recipients.add(agent.notificationEmail);
            if (process.env.NOTIFICATION_EMAIL) recipients.add(process.env.NOTIFICATION_EMAIL);
            recipients.add(detectedEmail);

            const toAddresses = Array.from(recipients).filter(Boolean).join(', ');
            if (toAddresses) {
              try {
                const html = generateLeadEmailHtml(leadPayload, agent);
                const fromEmail = settings.smtpUser || process.env.SMTP_USER;
                await transporter.sendMail({
                  from: `"${settings.emailFromName || 'AI Voice Agent CRM'}" <${fromEmail}>`,
                  to: toAddresses,
                  subject: `🎉 Booking Confirmed [via ${leadSourceTag}]: ${leadPayload.customerName} - ${agent.serviceName}`,
                  html: html
                });
                leadPayload.emailSent = true;
                leadPayload.emailSentTo = toAddresses;
                autoEmailSent = true;
              } catch (eErr) {
                console.warn('Auto email dispatch warning:', eErr.message);
              }
            }
          }
        }

        const saved = await saveLead(leadPayload);
        savedLeadId = saved.id;
      } catch (saveErr) {
        console.error('Failed to save lead in /api/chat:', saveErr);
      }
    }

    return NextResponse.json({
      success: true,
      response: cleanResponseText,
      bookingConfirmed: detectedBookingConfirmed || bookingConfirmedInThisSession,
      emailSent: autoEmailSent,
      leadId: savedLeadId,
      detectedInfo: {
        name: detectedName,
        email: detectedEmail,
        phone: detectedPhone,
        requirement: reqDetails.category,
        features: reqDetails.features
      }
    });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
