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
    'phone', 'call', 'karo', 'karna', 'kardo', 'whatsapp', 'website', 'chahiye', 'need',
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

  if (lower.includes('e-commerce') || lower.includes('ecommerce') || lower.includes('online store') || lower.includes('shop')) {
    res.category = 'E-Commerce Website';
  } else if (lower.includes('crm') || lower.includes('cms') || lower.includes('portal') || lower.includes('dashboard')) {
    res.category = 'Custom CRM / CMS Portal';
  } else if (lower.includes('portfolio') || lower.includes('corporate') || lower.includes('business website') || lower.includes('landing page')) {
    res.category = 'Business Website';
  } else if (lower.includes('voice agent') || lower.includes('ai voice') || lower.includes('automation')) {
    res.category = 'AI Voice Agent';
  } else if (lower.includes('website') || lower.includes('web development')) {
    res.category = 'Website Development';
  }

  if (lower.includes('payment') || lower.includes('gateway') || lower.includes('stripe') || lower.includes('easypaisa') || lower.includes('jazzcash')) {
    res.features.push('Payment Gateway');
  }
  if (lower.includes('seo') || lower.includes('ranking') || lower.includes('marketing')) {
    res.features.push('SEO & Marketing');
  }
  if (lower.includes('admin') || lower.includes('panel')) {
    res.features.push('Admin Dashboard');
  }

  const bM = text.match(/(?:budget|pese|cost|range)\s*(?:hai|is|:)?\s*([0-9kK$,]+(?:\s*(?:rs|pkr|usd|\$|dollars|thousand|lakh))?)/i) ||
             text.match(/(\$\s*\d+[\d,]*|\b\d+[\d,]*\s*(?:rs|pkr|dollars|lakh|k)\b)/i);
  if (bM) res.budget = bM[1].trim();

  const tM = text.match(/(?:timeline|time|duration|ready|deadline)\s*(?:hai|is|:)?\s*([0-9]+(?:\s*(?:days|din|weeks|months|haftay))?)/i) ||
             text.match(/(\b\d+\s*(?:days|weeks|months|din|haftay)\b)/i);
  if (tM) res.timeline = tM[1].trim();

  return res;
}

// Check if user is confirming or agreeing to a call/booking
function checkBookingConfirmation(message, lastAgentTurn = '') {
  const lowerMsg = (message || '').toLowerCase().trim();
  const lowerAgent = (lastAgentTurn || '').toLowerCase().trim();

  // If user explicitly asks to book/schedule or confirms time
  const explicitPhrases = [
    'confirm', 'book', 'theek hai', 'thik hai', 'done', 'sure', 'kal', 'tomorrow', 'parso',
    'kar do', 'kardo', 'kr do', 'krdo', 'kar dein', 'kardein', 'kr dein', 'krdein',
    'call kar', 'demo kar', 'yes please', 'bilkul', 'zaroor', 'inshaallah', 'inshallah',
    'schedule', 'appointment', 'baje'
  ];

  const hasExplicitPhrase = explicitPhrases.some(p => lowerMsg.includes(p));

  if (hasExplicitPhrase) {
    const isOnlyRequirement = lowerMsg.includes('chahiye') && (lowerMsg.includes('store') || lowerMsg.includes('website') || lowerMsg.includes('ecommerce') || lowerMsg.includes('crm')) && !lowerMsg.includes('call') && !lowerMsg.includes('schedule') && !lowerMsg.includes('krdein');
    if (!isOnlyRequirement) {
      return true;
    }
  }

  // If previous agent message asked to schedule / call / consultation
  const agentAskedToSchedule = lowerAgent.includes('schedule') ||
                               lowerAgent.includes('consultation') ||
                               lowerAgent.includes('book') ||
                               lowerAgent.includes('call kar dein') ||
                               lowerAgent.includes('call kar do') ||
                               lowerAgent.includes('appointment');

  if (agentAskedToSchedule) {
    const affirmativeTokens = [
      'yes', 'yeah', 'yup', 'haan', 'han', 'g', 'ji', 'jee', 'ok', 'okay',
      'sure', 'done', 'krdo', 'krdein', 'kardo', 'kardein', 'karlo', 'krlo',
      'theek', 'thik', 'sahi', 'great', 'fine', 'perfect', 'good', 'call'
    ];

    const words = lowerMsg.split(/[\s,!.?]+/);
    if (words.some(w => affirmativeTokens.includes(w))) {
      return true;
    }
  }

  return false;
}

// Check if current message is describing a project requirement
function isRequirementInput(msg) {
  const lower = (msg || '').toLowerCase();
  const keywords = [
    'website', 'store', 'crm', 'cms', 'ecommerce', 'e-commerce', 'payment', 'gateway',
    'app', 'chahiye', 'banani', 'banwana', 'bana dein', 'redesign', 'seo', 'features',
    'portal', 'dashboard', 'landing page', 'portfolio', 'online shop'
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
    const contactNewlyProvided = !!(currentPhone || currentEmail || (currentName && !extractName(priorUserTexts.join(' '))));

    // Check existing lead in DB
    const existingLead = leads.find(l =>
      (detectedEmail && l.customerEmail === detectedEmail) ||
      (detectedPhone && l.customerPhone === detectedPhone)
    );
    const isBookedAlready = existingLead?.status === 'Booked';

    // 3. Detect Booking Confirmation intent
    const hasContact = !!(detectedPhone || detectedEmail);
    const hasName = !!detectedName;
    let detectedBookingConfirmed = checkBookingConfirmation(message, lastAgentTurn);

    if (detectedBookingConfirmed && hasContact) {
      detectedBookingConfirmed = true;
    }

    // Check if user is asking about email / why email wasn't taken
    const isAskingAboutEmail = lowerMessage.includes('email') ||
                               lowerMessage.includes('mail') ||
                               lowerMessage.includes('knsi') ||
                               lowerMessage.includes('konsi') ||
                               lowerMessage.includes('kahan bheja');

    // 4. State checks
    const hasRequirement = !!(reqDetails.category || reqDetails.features.length > 0 || reqDetails.budget);

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
You are "${agent.name}", a professional sales representative and booking consultant for "${agent.serviceName}".
Persona: Consultative, warm, natural speaking voice, strictly concise.
Interaction Channel: ${channelName} (${isText ? 'Live Text Messaging' : 'Live Voice Call'}).

CURRENT COLLECTED STATE:
- Customer Name: ${detectedName || 'Not collected yet'}
- Customer Phone: ${detectedPhone || 'Not collected yet'}
- Customer Email: ${detectedEmail || 'Not collected yet'}
- Service Requirement: ${reqDetails.category || 'Not specified yet'}
- Booking Status: ${isBookedAlready || detectedBookingConfirmed ? 'Booked' : 'Pending'}

CRITICAL RULES:
1. If Customer Name is already collected, NEVER ask for their name again.
2. If Customer Phone is already collected, NEVER ask for phone number again.
3. If Customer Email is NOT yet collected and user confirms booking or asks about email, politely ask for their email address to dispatch the written summary.
4. If Customer just gave their email, confirm it warmly ("Shukriya! Aapka email save kar liya hai.").
5. Keep response strictly under 2 sentences in natural Roman Urdu or English.

KNOWLEDGE BASE:
${kbText || 'Professional bespoke services tailored to client requirements.'}
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

          const respLower = aiResponseText.toLowerCase();
          if (hasContact && (respLower.includes('naam jaan') || respLower.includes('contact number') || respLower.includes('shubh naam') || respLower.includes('phone number kya'))) {
            aiResponseText = '';
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, using stateful dialogue manager:', geminiErr.message);
      }
    }

    // --- HIGH-FIDELITY STATEFUL DIALOGUE MANAGER ---
    if (!aiResponseText) {
      const nameGreeting = detectedName ? ` ${detectedName}` : '';
      const serviceDisplay = reqDetails.category || agent.serviceName || 'website development';

      // SCENARIO 0: User just provided their Email Address
      if (currentEmail) {
        aiResponseText = `Bohat shukriya${nameGreeting}! Aapka email address (${currentEmail}) maine save kar liya hai aur complete consultation details wahan dispatch kar di gayi hain.`;
      }
      // SCENARIO 0.5: User asks about Email ("knsi email pe bhja hei email toh li nh", "email knsi hai")
      else if (isAskingAboutEmail) {
        if (detectedEmail) {
          aiResponseText = `Humne aapke provided email (${detectedEmail}) par details send kar di hain. Agar aap koi aur email update karwana chahte hain to share kar dein.`;
        } else {
          aiResponseText = `Aapka bilkul theek kehna hai! Maine abhi aapka email address note nahi kiya tha. Kindly apna email address share kar dein taake main details foran wahan bhej sakoon.`;
        }
      }
      // SCENARIO 1: Booking Confirmed by User in this turn
      else if (detectedBookingConfirmed && hasContact) {
        const timeNote = reqDetails.timeline || 'kal ke liye';
        if (detectedEmail) {
          aiResponseText = `🎉 Zabardast${nameGreeting}! Aapki consultation call ${timeNote} confirm ho chuki hai. Complete booking details aapke email (${detectedEmail}) par dispatch kar di gayi hain aur hamari team aapke number (${detectedPhone}) par rabta karegi!`;
        } else {
          aiResponseText = `🎉 Zabardast${nameGreeting}! Aapki consultation call ${timeNote} confirm ho chuki hai. Hamari team aapke number (${detectedPhone}) par rabta karegi. Meeting link aur written summary receive karne ke liye aapka email address kya hai?`;
        }
      }
      // SCENARIO 1.5: Booking is ALREADY confirmed in prior turn
      else if (isBookedAlready) {
        if (!detectedEmail) {
          aiResponseText = `Aapki consultation booking already confirm ho chuki hai. Hamari team aapke number (${detectedPhone}) par rabta karegi. Written summary aur meeting link ke liye kindly apna email address share kar dein!`;
        } else {
          aiResponseText = `Aapki appointment already confirm ho chuki hai aur details ${detectedEmail} par dispatched hain. Agar aapka koi aur sawal hai to zaroor batayein!`;
        }
      }
      // SCENARIO 2: Contact info was just provided in this turn (Name and/or Phone)
      else if (contactNewlyProvided && hasContact) {
        const contactSavedMsg = detectedPhone
          ? `Aapka contact number (${detectedPhone}) maine note aur save kar liya hai.`
          : `Aapka email (${detectedEmail}) maine note aur save kar liya hai.`;

        if (hasRequirement) {
          aiResponseText = `Bohat shukriya${nameGreeting}! ${contactSavedMsg} Aapko ${serviceDisplay} ke liye kya specific features chahiye? (Jaise e-commerce store, payment gateway, ya portfolio?)`;
        } else {
          aiResponseText = `Bohat shukriya${nameGreeting}! ${contactSavedMsg} Aapki project requirement kya hai taake hum aapko best quotation aur solution guide kar sakein?`;
        }
      }
      // SCENARIO 3: User answers Service Requirement in THIS message (Contact is ALREADY saved)
      else if (hasContact && !detectedBookingConfirmed && isRequirementInput(lowerMessage)) {
        const kbMatch = (agent.knowledgeBase || []).find(k =>
          lowerMessage.includes((k.topic || '').toLowerCase()) || (k.content || '').toLowerCase().includes('package')
        );
        const solutionText = kbMatch ? kbMatch.content : `Hum custom ${serviceDisplay} responsive design, fast performance aur dedicated support ke sath deliver karte hain.`;
        aiResponseText = `Behtareen! ${solutionText} Aapka contact number already hamare paas saved hai. Kya hum aapke liye kal ek quick consultation call schedule kar dein?`;
      }
      // SCENARIO 4: Pricing & Cost Questions
      else if (lowerMessage.match(/\b(price|cost|package|rate|charges|kitne|pese|how much)\b/)) {
        const priceKb = (agent.knowledgeBase || []).find(k =>
          (k.topic || '').toLowerCase().includes('price') || (k.content || '').toLowerCase().includes('$') || (k.content || '').toLowerCase().includes('package')
        );
        const pText = priceKb ? priceKb.content : `Hamara starter package 999 dollar se shuru hota hai jisme complete custom design aur setup included hai.`;

        if (!hasContact) {
          aiResponseText = `${pText} Aapko complete quotation aur tailored breakdown share karne ke liye, aapka naam aur WhatsApp number kya hai?`;
        } else {
          aiResponseText = `${pText} Aapka contact already hamare paas saved hai. Kya main aapke liye demo session book kar doon?`;
        }
      }
      // SCENARIO 5: What services / Questions about capabilities
      else if (lowerMessage.match(/\b(service|services|offer|what do you do|kya karte ho|kaam|detail)\b/)) {
        const serviceKb = (agent.knowledgeBase || []).find(k => (k.topic || '').toLowerCase().includes('service'));
        const sText = serviceKb ? serviceKb.content : `Hum custom web development, CRM systems aur AI solutions provide karte hain.`;

        if (!hasContact) {
          aiResponseText = `${sText} Aapka naam aur contact number kya hai taake main portfolio aur quotation bhej sakoon?`;
        } else {
          aiResponseText = `${sText} Aapko isme se kis type ka solution apne project ke liye chahiye?`;
        }
      }
      // SCENARIO 6: Greetings (Salam, Hello, Hi)
      else if (lowerMessage.match(/\b(hi|hello|hey|salam|assalam|kese ho|kaise ho|hal chal)\b/)) {
        if (!hasContact) {
          if (lowerMessage.match(/\b(salam|assalam|kese|kaise)\b/)) {
            aiResponseText = `Walaikum Assalam! Main ${agent.name} hoon ${agent.serviceName} se. Main aapki kya madad kar sakta hoon? Aur kya main aapka naam jaan sakta hoon?`;
          } else {
            aiResponseText = `Hello! I am ${agent.name} with ${agent.serviceName}. How can I assist you today? May I have your name?`;
          }
        } else {
          aiResponseText = `Walaikum Assalam${nameGreeting}! Aapka contact already note hai. Aapki requirement ke mutabiq main aapki mazeed kya madad karoon?`;
        }
      }
      // SCENARIO 7: General / Fallback
      else {
        if (!hasContact) {
          aiResponseText = `Ji zaroor! Hum ${agent.serviceName} provide karte hain. Aapka naam aur contact/WhatsApp number kya hai taake main details note kar sakoon?`;
        } else if (!hasRequirement) {
          aiResponseText = `Aapki specific project requirement kya hai taake main aapko exact quotation aur timeline guide kar sakoon?`;
        } else {
          aiResponseText = `Aapka project requirement aur contact number already saved hai. Kya main aapke liye consultation demo schedule kar doon?`;
        }
      }
    }

    // Clean up text
    const cleanResponseText = aiResponseText.replace(/\[LEAD_DATA:[\s\S]*?\]/gi, '').replace(/[*#_`]/g, '').trim();

    // 5. IMMEDIATE LEAD RECORDING & DATABASE PERSISTENCE
    let autoEmailSent = false;
    let savedLeadId = null;

    if (hasContact) {
      try {
        const fullTranscript = [...(conversationHistory || [])];
        fullTranscript.push({ role: 'customer', text: message, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
        fullTranscript.push({ role: 'agent', text: cleanResponseText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });

        const leadSourceTag = isText ? 'Text Chat' : 'Voice Agent';
        const currentNotes = reqDetails.features.length > 0
          ? `Features: ${reqDetails.features.join(', ')}. Budget: ${reqDetails.budget || 'Flexible'}. Timeline: ${reqDetails.timeline || 'Standard'}.`
          : (reqDetails.category || agent.serviceName);

        const currentLeadStatus = (detectedBookingConfirmed || isBookedAlready) ? 'Booked' : 'Contact Acquired';

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
          summary: `${currentLeadStatus}: ${detectedName || 'Customer'} regarding ${reqDetails.category || agent.serviceName} (via ${leadSourceTag}).`,
          transcript: fullTranscript,
          emailSent: existingLead?.emailSent || false,
          emailSentTo: existingLead?.emailSentTo || '',
          createdAt: existingLead?.createdAt || new Date().toISOString()
        };

        // If email is available and booking is confirmed (or email newly provided on a booked lead), send email!
        const shouldSendEmail = (detectedBookingConfirmed || isBookedAlready) &&
                                detectedEmail &&
                                detectedEmail.includes('@') &&
                                (!existingLead?.emailSent || currentEmail);

        if (shouldSendEmail) {
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
      bookingConfirmed: detectedBookingConfirmed || isBookedAlready,
      emailSent: autoEmailSent,
      leadId: savedLeadId,
      detectedInfo: {
        name: detectedName,
        email: detectedEmail,
        phone: detectedPhone,
        requirement: reqDetails.category
      }
    });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
