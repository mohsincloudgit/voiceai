import { NextResponse } from 'next/server';
import { AGENTS_FILE, SETTINGS_FILE, readJson } from '@/lib/db';
import { GoogleGenAI } from '@google/genai';

export async function POST(request) {
  try {
    const { agentId, message, conversationHistory = [] } = await request.json();
    const agents = readJson(AGENTS_FILE, []);
    const settings = readJson(SETTINGS_FILE, {});
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
You are "${agent.name}", a professional, friendly, high-converting voice sales representative.
Service You Are Selling: ${agent.serviceName}
Your Persona and Voice Tone: ${agent.voicePitch || 'Helpful, consultative, concise, natural speaking voice.'}

### STRICT VOICE CONVERSATION GUIDELINES:
1. You are speaking through audio (Text-to-Speech). Keep your answers punchy, natural, conversational, and direct (1 to 3 short sentences per turn). Avoid robotic lists or long bullet points.
2. Answer the user's questions strictly using your KNOWLEDGE BASE below. If something isn't in your knowledge base, answer courteously and guide them towards booking a tailored consultation.
3. Your primary sales goal is to qualify the prospect, answer objections gracefully, and collect/confirm their booking details:
   - Full Name
   - Phone Number
   - Email Address
   - Budget or Timeline
4. When the user provides contact details or confirms they want the service, warmly thank them and confirm that their request has been logged and the full conversation transcript and details are being sent to their email.

### CUSTOM KNOWLEDGE BASE:
${kbText || 'High quality professional services tailored to customer goals.'}

### KEY QUALIFICATION QUESTIONS TO ASK NATURALLY:
- ${qualificationQuestions || 'What is your current requirement and budget?'}

### OBJECTION HANDLING RULES:
${objections || 'Address concerns respectfully and focus on ROI.'}

### CLOSING CONFIRMATION:
${agent.confirmationFlow ? agent.confirmationFlow.closingQuestion : 'Would you like to book a quick consultation? What is your name and phone number?'}

Respond directly with your spoken response. Do not include markdown bold or internal monologue. Keep it ready to be spoken aloud.
`;

    const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
    let aiResponseText = '';

    // If Gemini API Key is configured, use Google GenAI
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const contents = [
          { role: 'user', parts: [{ text: `SYSTEM INSTRUCTION:\n${systemPrompt}` }] },
          { role: 'model', parts: [{ text: `Understood! I am ${agent.name}. I will speak concisely and follow my knowledge base.` }] }
        ];

        conversationHistory.forEach(item => {
          contents.push({
            role: item.role === 'agent' ? 'model' : 'user',
            parts: [{ text: item.text }]
          });
        });

        contents.push({
          role: 'user',
          parts: [{ text: message }]
        });

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: contents
        });

        if (response && response.text) {
          aiResponseText = response.text.trim();
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, using intelligent rule-based knowledge fallback:', geminiErr.message);
      }
    }

    // High-fidelity fallback dialogue manager (zero downtime even without API key!)
    if (!aiResponseText) {
      const lower = (message || '').toLowerCase();

      if (lower.includes('price') || lower.includes('cost') || lower.includes('package') || lower.includes('rate') || lower.includes('how much')) {
        const priceKb = (agent.knowledgeBase || []).find(k =>
          k.topic.toLowerCase().includes('price') || k.content.toLowerCase().includes('$') || k.content.toLowerCase().includes('package')
        );
        if (priceKb) {
          aiResponseText = `${priceKb.content} Does that align with your budget?`;
        } else {
          aiResponseText = `Our pricing starts flexibly based on your specific requirements. Would you like a custom estimate?`;
        }
      } else if (lower.includes('expensive') || lower.includes('high') || lower.includes('discount') || lower.includes('cheaper')) {
        const obj = (agent.objectionHandling || [])[0];
        aiResponseText = obj ? obj.counter : `We offer flexible payment terms and proven ROI. What budget did you have in mind?`;
      } else if (lower.includes('@') || lower.match(/\b\d{7,14}\b/) || lower.includes('my name is') || lower.includes('call me')) {
        aiResponseText = agent.confirmationFlow && agent.confirmationFlow.successMessage
          ? agent.confirmationFlow.successMessage
          : `Thank you! I have recorded your details and sent our team and your email the full conversation summary. We look forward to speaking with you!`;
      } else if (lower.includes('service') || lower.includes('what do you do') || lower.includes('help') || lower.includes('offer')) {
        const serviceKb = (agent.knowledgeBase || []).find(k => k.topic.toLowerCase().includes('service'));
        aiResponseText = serviceKb
          ? `${serviceKb.content} What specific goal are you looking to achieve?`
          : `We specialize in ${agent.serviceName}. May I ask what specific outcome you are targeting?`;
      } else {
        const nextQ = (agent.qualificationQuestions || [])[0] || 'Could you share what you are looking to get done?';
        aiResponseText = `Understood! Regarding ${agent.serviceName}: ${nextQ}`;
      }
    }

    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const phoneRegex = /(\+?[0-9]{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?[\d]{3}[-.\s]?[\d]{4}/;
    const detectedEmail = (message.match(emailRegex) || [])[0] || null;
    const detectedPhone = (message.match(phoneRegex) || [])[0] || null;

    return NextResponse.json({
      success: true,
      response: aiResponseText,
      detectedInfo: {
        email: detectedEmail,
        phone: detectedPhone
      }
    });
  } catch (error) {
    console.error('Error in /api/chat:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
