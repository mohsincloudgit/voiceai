import { NextResponse } from 'next/server';
import { getAgents, getSettings, getLeads, saveLead } from '@/lib/db';
import { getEmailTransporter, generateLeadEmailHtml } from '@/lib/email';
import { GoogleGenAI } from '@google/genai';

export async function POST(request) {
  try {
    const { agentId, message, conversationHistory = [] } = await request.json();
    const agents = await getAgents();
    const settings = await getSettings();
    const agent = agents.find(a => a.id === agentId) || agents[0];

    if (!agent) {
      return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    }

    // Build custom knowledge base prompt
    const kbText = (agent.knowledgeBase || [])
      .map(k => `[Topic: ${k.topic}]\n${k.content}`)
      .join('\n\n');

    const qualificationQuestions = (agent.qualificationQuestions || []).join('\n- ');
    const objections = (agent.objectionHandling || [])
      .map(o => `Objection: "${o.objection}" -> Counter-Response: "${o.counter}"`)
      .join('\n');

    const systemPrompt = `
You are "${agent.name}", a friendly, professional voice sales representative and booking consultant for "${agent.serviceName}".
Persona & Tone: ${agent.voicePitch || 'Consultative, warm, natural speaking voice, concise.'}

### CRITICAL 3-PHASE CONVERSATIONAL FLOW:
- PHASE 1 (COLLECT CONTACT DETAILS FIRST):
  * When the conversation starts or user greets, welcome them warmly and ask for their name:
    e.g. in Roman Urdu: "Salam! Main ${agent.name} hoon. Kya main aapka naam jaan sakta hoon?" (or in English: "Hello! May I know your name please?").
  * Once their Name is provided, immediately ask for their Email and Phone/WhatsApp number:
    e.g. "Shukriya [Name]! Aapka email address aur WhatsApp/phone number kya hai taake main tailored details aur appointment confirmation bhej sakoon?"
  * EXCEPTION: If the user asks a specific question before giving details, answer their question in ONE short sentence first, then immediately say: "Aapko tailored solution aur booking confirmation bhejney ke liye, kya main aapka naam aur contact number jaan sakta hoon?"

- PHASE 2 (TO-THE-POINT SOLUTION):
  * Once details are provided (or during conversation), speak strictly to the point and provide the solution using your KNOWLEDGE BASE below.
  * Clearly mention the price, package, or delivery time without unnecessary fluff.
  * Propose a quick consultation / appointment call:
    e.g. "Aapki requirement ke liye hamara package best hai. Kya hum aapke liye ek 15-minute consultation appointment book kar dein?"

- PHASE 3 (BOOKING CONFIRMATION & EMAIL DISPATCH):
  * When the user agrees to book or gives a time/day (e.g. "haan book kardo", "yes confirm it", "kal 3 baje", "theek hai"), warmly confirm:
    "Aapki appointment confirm ho gayi hai! Maine complete details aapke email par bhej di hain."

### RULES:
1. Match the user's language (Roman Urdu or English).
2. Keep answers concise (1 to 2 spoken sentences per turn). No markdown formatting (*, #).
3. At the VERY END of every single response, append this structured metadata line:
[LEAD_DATA: {"name": "<detected name or empty>", "email": "<detected email or empty>", "phone": "<detected phone or empty>", "bookingConfirmed": <true if user confirmed booking or appointment, else false>}]

### KNOWLEDGE BASE:
${kbText || 'High quality professional services tailored to customer goals.'}

### QUALIFICATION & APPOINTMENT QUESTIONS:
- ${qualificationQuestions || 'What is your current requirement and budget?'}
- ${agent.confirmationFlow ? agent.confirmationFlow.closingQuestion : 'Would you like to book a quick consultation? What is your preferred time?'}
`;

    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    let aiResponseText = '';

    // If Gemini API Key is configured, use Google GenAI with native systemInstruction
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        // Clean conversation history into valid alternating turns
        const historyTurns = [];
        (conversationHistory || []).forEach(item => {
          if (!item.text) return;
          const role = item.role === 'agent' ? 'model' : 'user';
          historyTurns.push({ role, text: item.text.trim() });
        });

        // Avoid duplicating current message if client already appended it to history
        if (historyTurns.length > 0 && historyTurns[historyTurns.length - 1].role === 'user' && historyTurns[historyTurns.length - 1].text === (message || '').trim()) {
          historyTurns.pop();
        }

        // Build valid Gemini contents array starting with user turn
        const contents = [];
        let nextExpectedRole = 'user';

        for (const turn of historyTurns) {
          if (turn.role === nextExpectedRole) {
            contents.push({
              role: turn.role,
              parts: [{ text: turn.text }]
            });
            nextExpectedRole = nextExpectedRole === 'user' ? 'model' : 'user';
          }
        }

        contents.push({
          role: 'user',
          parts: [{ text: message }]
        });

        let response;
        try {
          response = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: contents,
            config: {
              systemInstruction: systemPrompt,
            }
          });
        } catch (mErr) {
          response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: contents,
            config: {
              systemInstruction: systemPrompt,
            }
          });
        }

        if (response && response.text) {
          aiResponseText = response.text.trim();
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, using intelligent rule-based knowledge fallback:', geminiErr.message);
      }
    }

    // High-fidelity fallback dialogue manager (handles Urdu, Roman Urdu & English)
    if (!aiResponseText) {
      const lower = (message || '').toLowerCase().trim();

      // Greetings (Hello, Salam, Hi)
      if (lower.match(/\b(hi|hello|hey|salam|assalam|kese ho|kaise ho|hal chal)\b/)) {
        if (lower.match(/\b(salam|kese ho|kaise ho|hal)\b/)) {
          aiResponseText = `Walaikum Assalam! Main ${agent.name} hoon. Hum ${agent.serviceName} provide karte hain. Kya main aapka shubh naam jaan sakta hoon? [LEAD_DATA: {"name": "", "email": "", "phone": "", "bookingConfirmed": false}]`;
        } else {
          aiResponseText = `Hi there! I am ${agent.name} for ${agent.serviceName}. May I know your name to get started? [LEAD_DATA: {"name": "", "email": "", "phone": "", "bookingConfirmed": false}]`;
        }
      }
      // Pricing & Cost
      else if (lower.includes('price') || lower.includes('cost') || lower.includes('package') || lower.includes('rate') || lower.includes('how much') || lower.includes('kitne') || lower.includes('pese') || lower.includes('charges')) {
        const priceKb = (agent.knowledgeBase || []).find(k =>
          (k.topic || '').toLowerCase().includes('price') || (k.content || '').toLowerCase().includes('$') || (k.content || '').toLowerCase().includes('package')
        );
        const pText = priceKb ? priceKb.content : `Starter package 999 dollar se shuru hota hai.`;
        aiResponseText = `${pText} Aapka shubh naam aur WhatsApp number kya hai taake main details send karoon? [LEAD_DATA: {"name": "", "email": "", "phone": "", "bookingConfirmed": false}]`;
      }
      // What services / What do you do
      else if (lower.includes('service') || lower.includes('kya karte ho') || lower.includes('kaam') || lower.includes('offer') || lower.includes('detail') || lower.includes('what do you do')) {
        const serviceKb = (agent.knowledgeBase || []).find(k => (k.topic || '').toLowerCase().includes('service'));
        const sText = serviceKb ? serviceKb.content : `Hum custom web development aur AI voice solutions banate hain.`;
        aiResponseText = `${sText} Aapka naam aur email kya hai taake custom quotation bhej sakoon? [LEAD_DATA: {"name": "", "email": "", "phone": "", "bookingConfirmed": false}]`;
      }
      // Booking confirmation triggers
      else if (lower.includes('book') || lower.includes('confirm') || lower.includes('theek hai') || lower.includes('done') || lower.includes('kal') || lower.includes('tomorrow')) {
        aiResponseText = `Aapki appointment confirm ho gayi hai! Maine complete details aapke email par dispatch kar di hain. [LEAD_DATA: {"name": "", "email": "", "phone": "", "bookingConfirmed": true}]`;
      }
      // General
      else {
        aiResponseText = `Ji zaroor! Aapka shubh naam aur contact number kya hai taake main booking schedule kar sakoon? [LEAD_DATA: {"name": "", "email": "", "phone": "", "bookingConfirmed": false}]`;
      }
    }

    // Parse LEAD_DATA tag if present
    let cleanResponseText = aiResponseText;
    let detectedName = null;
    let detectedEmail = null;
    let detectedPhone = null;
    let detectedBookingConfirmed = false;

    const leadDataMatch = aiResponseText.match(/\[LEAD_DATA:\s*(\{[\s\S]*?\})\]/i);
    if (leadDataMatch) {
      try {
        cleanResponseText = aiResponseText.replace(leadDataMatch[0], '').trim();
        const rawJson = leadDataMatch[1].replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        const parsed = JSON.parse(rawJson);
        detectedName = (parsed.name && parsed.name.trim()) ? parsed.name.trim() : null;
        detectedEmail = (parsed.email && parsed.email.trim()) ? parsed.email.trim() : null;
        detectedPhone = (parsed.phone && parsed.phone.trim()) ? parsed.phone.trim() : null;
        detectedBookingConfirmed = !!parsed.bookingConfirmed;
      } catch (pErr) {
        cleanResponseText = aiResponseText.replace(leadDataMatch[0], '').trim();
      }
    }

    // Safety regex scan on current message and full history
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const phoneRegex = /(\+?[0-9]{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?[\d]{3}[-.\s]?[\d]{4}/;
    const nameRegex = /(?:mera naam|my name is|i am|this is|naam hai|naam)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;

    const allUserTexts = [...(conversationHistory || []).map(h => h.text || ''), message].join(' ');

    if (!detectedEmail) {
      const eM = allUserTexts.match(emailRegex);
      if (eM) detectedEmail = eM[0];
    }
    if (!detectedPhone) {
      const pM = allUserTexts.match(phoneRegex);
      if (pM && pM[0].trim().length >= 7) detectedPhone = pM[0].trim();
    }
    if (!detectedName) {
      const nM = allUserTexts.match(nameRegex);
      if (nM && nM[1]) detectedName = nM[1].trim();
    }

    // Check if user confirmed booking in current message
    const lowerMessage = message.toLowerCase();
    if (!detectedBookingConfirmed && (detectedEmail || detectedPhone)) {
      if (lowerMessage.includes('book') || lowerMessage.includes('confirm') || lowerMessage.includes('kal') || lowerMessage.includes('tomorrow') || lowerMessage.includes('theek hai') || lowerMessage.includes('yes please') || lowerMessage.includes('haan')) {
        detectedBookingConfirmed = true;
      }
    }

    // AUTOMATIC BOOKING & EMAIL DISPATCH
    let autoEmailSent = false;
    let bookedLeadId = null;

    if (detectedBookingConfirmed && (detectedEmail || detectedPhone)) {
      try {
        const leads = await getLeads();
        const existingIndex = leads.findIndex(l =>
          (detectedEmail && l.customerEmail === detectedEmail) ||
          (detectedPhone && l.customerPhone === detectedPhone)
        );

        const fullTranscript = [...conversationHistory];
        fullTranscript.push({ role: 'customer', text: message, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
        fullTranscript.push({ role: 'agent', text: cleanResponseText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });

        const bookedLead = {
          id: existingIndex >= 0 ? leads[existingIndex].id : 'lead_' + Date.now(),
          agentId: agent.id || agentId,
          agentName: agent.name,
          serviceName: agent.serviceName,
          customerName: detectedName || 'Website Client',
          customerEmail: detectedEmail || 'N/A',
          customerPhone: detectedPhone || 'N/A',
          budget: 'Confirmed in Consultation',
          preferredTime: 'Scheduled via Voice Agent',
          notes: 'Auto-confirmed via AI voice conversational booking flow.',
          status: 'Booked',
          summary: `Appointment confirmed for ${detectedName || 'Customer'} regarding ${agent.serviceName}.`,
          transcript: fullTranscript,
          emailSent: false,
          emailSentTo: '',
          createdAt: new Date().toISOString()
        };

        // Send Email via SMTP
        const transporter = getEmailTransporter(settings);
        if (transporter) {
          const recipients = new Set();
          if (settings.notificationEmail) recipients.add(settings.notificationEmail);
          if (agent.notificationEmail) recipients.add(agent.notificationEmail);
          if (process.env.NOTIFICATION_EMAIL) recipients.add(process.env.NOTIFICATION_EMAIL);
          if (detectedEmail && detectedEmail.includes('@')) recipients.add(detectedEmail);

          const toAddresses = Array.from(recipients).filter(Boolean).join(', ');
          if (toAddresses) {
            try {
              const html = generateLeadEmailHtml(bookedLead, agent);
              const fromEmail = settings.smtpUser || process.env.SMTP_USER;
              await transporter.sendMail({
                from: `"${settings.emailFromName || 'AI Voice Agent CRM'}" <${fromEmail}>`,
                to: toAddresses,
                subject: `🎉 Booking Confirmed: ${bookedLead.customerName} - ${agent.serviceName}`,
                html: html
              });
              bookedLead.emailSent = true;
              bookedLead.emailSentTo = toAddresses;
              autoEmailSent = true;
            } catch (eErr) {
              console.warn('Auto email dispatch warning:', eErr.message);
            }
          }
        }

        const savedLead = await saveLead(bookedLead);
        bookedLeadId = savedLead.id;
      } catch (leadSaveErr) {
        console.error('Failed to auto-save booked lead:', leadSaveErr);
      }
    }

    return NextResponse.json({
      success: true,
      response: cleanResponseText.replace(/[*#_`]/g, '').trim(),
      bookingConfirmed: detectedBookingConfirmed,
      emailSent: autoEmailSent,
      leadId: bookedLeadId,
      detectedInfo: {
        name: detectedName,
        email: detectedEmail,
        phone: detectedPhone
      }
    });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
