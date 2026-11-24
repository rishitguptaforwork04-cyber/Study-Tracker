import 'dotenv/config';
import express, { Request, Response } from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import dns from 'node:dns/promises';
import net from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, Type } from '@google/genai';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import * as cheerio from 'cheerio';

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

const ALLOWED_CHAT_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
]);

const ALLOWED_VOICES = new Set(['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir']);

const ROLE_SYSTEM_INSTRUCTIONS: Record<string, string> = {
  default:
    'You are Study Buddy, your go-to AI tutor and personalized academic coach. Use the student context provided accurately without inventing test scores or authentic PYQ years. Format answers clearly with concise structure and formulas where helpful.',
  socratic_tutor:
    'You are a Socratic Academic Tutor. Guide the student step by step, ask probing checkpoint questions to verify understanding, highlight subtle traps, and build intuition before giving full derivations.',
  exam_coach:
    'You are a High-Stakes Exam Strategy Coach. Focus on exam weightage, time-saving heuristics, common distractor traps, revision cadence, and scoring maximization based on the student profile.',
  concept_simplifier:
    'You are a Concept Simplifier. Break dense academic theorems, formulas, and regulations into crystal-clear everyday analogies, visual mental models, and 5-line memory anchors.',
  deep_researcher:
    'You are an Academic Research & First-Principles Mentor. Provide thorough derivations, edge cases, formal proofs, cross-subject connections, and rigorous analytical breakdowns.',
};

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isPrivateOrLocalIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 127) return true;
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true;
    if (lower.startsWith('::ffff:')) {
      return isPrivateOrLocalIP(lower.slice(7));
    }
  }
  return false;
}

async function validatePublicUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format. Please enter a full http:// or https:// URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// public website URLs are supported.');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Local or internal hostnames cannot be fetched.');
  }
  if (net.isIP(hostname) && isPrivateOrLocalIP(hostname)) {
    throw new Error('Private or loopback IP addresses cannot be fetched.');
  }
  try {
    const records = await dns.lookup(hostname, { all: true });
    for (const r of records) {
      if (isPrivateOrLocalIP(r.address)) {
        throw new Error('Resolved host points to a private or restricted network address.');
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('private')) throw err;
    throw new Error(`Unable to resolve hostname "${hostname}".`);
  }
  return parsed;
}

async function extractTextFromUploadedFile(
  fileName: string,
  mimeType: string,
  base64Data: string
): Promise<{ text?: string; inlinePart?: { mimeType: string; data: string } }> {
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const buffer = Buffer.from(cleanBase64, 'base64');
  const lower = fileName.toLowerCase();

  if (
    mimeType === 'application/pdf' ||
    lower.endsWith('.pdf') ||
    mimeType.startsWith('image/')
  ) {
    const resolvedMime =
      mimeType ||
      (lower.endsWith('.pdf')
        ? 'application/pdf'
        : lower.endsWith('.png')
          ? 'image/png'
          : 'image/jpeg');
    return {
      inlinePart: {
        mimeType: resolvedMime,
        data: cleanBase64,
      },
    };
  }

  if (
    lower.endsWith('.docx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value };
  }

  if (
    lower.endsWith('.xlsx') ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const lines: string[] = [];
    workbook.eachSheet((sheet) => {
      lines.push(`Sheet: ${sheet.name}`);
      sheet.eachRow((row) => {
        const vals = Array.isArray(row.values)
          ? row.values
              .slice(1)
              .map((v) => (v === null || v === undefined ? '' : String(v)))
              .filter(Boolean)
          : [];
        if (vals.length > 0) lines.push(vals.join(' | '));
      });
    });
    return { text: lines.join('\n') };
  }

  return { text: buffer.toString('utf-8') };
}

function handleGeminiError(err: unknown, res: Response) {
  const msg = err instanceof Error ? err.message : 'Unexpected AI service error';
  const status =
    msg.includes('403') || msg.includes('PERMISSION_DENIED')
      ? 403
      : msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')
        ? 429
        : msg.includes('API_KEY_INVALID') || msg.includes('400')
          ? 400
          : 500;
  res.status(status).json({ error: msg });
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, aiConfigured: Boolean(getAiClient()) });
  });

  // 1. Syllabus Extraction & Parsing
  app.post('/api/syllabus/parse', async (req: Request, res: Response) => {
    try {
      const { mode, text, url, fileName, mimeType, base64Data, courseName, examNames } = req.body ?? {};
      if (!mode || !['text', 'url', 'file'].includes(mode)) {
        res.status(400).json({ error: 'Invalid import mode. Expected text, url, or file.' });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets. Add a valid key to run AI syllabus extraction.',
        });
        return;
      }

      let extractedText = typeof text === 'string' ? text.trim() : '';
      let inlinePart: { mimeType: string; data: string } | undefined;

      if (mode === 'url') {
        if (typeof url !== 'string' || !url.trim()) {
          res.status(400).json({ error: 'Please provide a public website URL.' });
          return;
        }
        const safeUrl = await validatePublicUrl(url.trim());
        const response = await fetch(safeUrl.toString(), {
          headers: { 'User-Agent': 'StudyBuddyBot/1.0' },
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) {
          res.status(400).json({ error: `Failed to fetch URL (HTTP ${response.status}).` });
          return;
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        $('script, style, nav, footer, noscript').remove();
        extractedText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 32000);
        if (!extractedText) {
          res.status(400).json({ error: 'No readable text content found at that URL.' });
          return;
        }
      } else if (mode === 'file') {
        if (typeof base64Data !== 'string' || !base64Data) {
          res.status(400).json({ error: 'Uploaded file payload is missing.' });
          return;
        }
        const parsedFile = await extractTextFromUploadedFile(
          String(fileName || 'upload.txt'),
          String(mimeType || ''),
          base64Data
        );
        if (parsedFile.text) extractedText = parsedFile.text.slice(0, 35000);
        if (parsedFile.inlinePart) inlinePart = parsedFile.inlinePart;
      }

      if (!extractedText && !inlinePart) {
        res.status(400).json({ error: 'Please provide syllabus text, a public URL, or a supported file.' });
        return;
      }

      const promptText = `Extract and structure the provided academic or exam syllabus into a clean hierarchy:
Course context: ${courseName || 'General Course'}
Target exam(s): ${Array.isArray(examNames) && examNames.length > 0 ? examNames.join(', ') : 'General Exam'}

Organize into Subjects -> Units -> Chapters -> Topics -> Subtopics.
For each topic estimate:
- difficulty: "Easy", "Medium", or "Hard"
- weightage: relative importance integer 5..30
- estimatedMinutes: realistic study duration in minutes (e.g. 45, 60, 90, 120)
- prerequisites: array of prerequisite topic titles (empty array if none)
- examNames: which target exams from [${Array.isArray(examNames) ? examNames.join(', ') : ''}] this subject relates to.

Only extract topics actually present or clearly implied by the source content.`;

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (inlinePart) parts.push({ inlineData: inlinePart });
      parts.push({
        text: extractedText ? `${promptText}\n\nSOURCE CONTENT:\n${extractedText}` : promptText,
      });

      const result = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts },
        config: {
          systemInstruction:
            'You are an academic curriculum architect. Extract clean, accurate, non-duplicated syllabus hierarchies strictly grounded in the provided document or text.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              extractionNotes: { type: Type.STRING },
              subjects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    code: { type: Type.STRING },
                    examNames: { type: Type.ARRAY, items: { type: Type.STRING } },
                    units: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          chapters: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                name: { type: Type.STRING },
                                topics: {
                                  type: Type.ARRAY,
                                  items: {
                                    type: Type.OBJECT,
                                    properties: {
                                      name: { type: Type.STRING },
                                      subtopics: { type: Type.ARRAY, items: { type: Type.STRING } },
                                      difficulty: { type: Type.STRING },
                                      weightage: { type: Type.INTEGER },
                                      estimatedMinutes: { type: Type.INTEGER },
                                      prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const draft = JSON.parse((result.text ?? '{}').trim());
      res.json({ draft, rawTextPreview: extractedText.slice(0, 600) });
    } catch (err) {
      handleGeminiError(err, res);
    }
  });

  // 2. AI Personalized Study Plan Generator
  app.post('/api/ai/study-plan', async (req: Request, res: Response) => {
    try {
      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
        });
        return;
      }

      const { profile, exams, topics, startDateISO, days = 7 } = req.body ?? {};
      const topicSummary = Array.isArray(topics)
        ? topics.slice(0, 40).map((t: Record<string, unknown>) => ({
            id: t.id,
            name: t.name,
            subjectId: t.subjectId,
            status: t.status,
            difficulty: t.difficulty,
            weightage: t.weightage,
            priority: t.priority,
            masteryScore: t.masteryScore,
            estimatedMinutes: t.estimatedMinutes,
            nextRevisionAt: t.nextRevisionAt,
          }))
        : [];

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Create a ${days}-day study & revision schedule starting on ${startDateISO}.
Student profile: ${JSON.stringify(profile)}
Exam targets: ${JSON.stringify(exams)}
Topics to prioritize: ${JSON.stringify(topicSummary)}

Consider exam dates, weak areas, revision due dates, weightage, difficulty, and daily hours target. Return 2-3 focused tasks per day.`,
        config: {
          systemInstruction:
            'You are a precision academic planner. Generate realistic, balanced study blocks tied to exact topicId values from the input.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rationale: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    date: { type: Type.STRING },
                    startTime: { type: Type.STRING },
                    durationMinutes: { type: Type.INTEGER },
                    topicId: { type: Type.STRING },
                    subjectId: { type: Type.STRING },
                    taskType: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const plan = JSON.parse((response.text ?? '{}').trim());
      res.json(plan);
    } catch (err) {
      handleGeminiError(err, res);
    }
  });

  // 3. AI Practice Question Generator
  app.post('/api/ai/generate-questions', async (req: Request, res: Response) => {
    try {
      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
        });
        return;
      }

      const {
        courseName,
        examName,
        subjectName,
        topicName,
        difficulty = 'Medium',
        questionType = 'MCQ',
        count = 3,
      } = req.body ?? {};

      const safeCount = Math.max(1, Math.min(8, Number(count) || 3));

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Generate ${safeCount} original practice questions for:
Course: ${courseName || 'Academic Study'}
Exam context: ${examName || 'General Exam'}
Subject: ${subjectName || 'Core Subject'}
Topic: ${topicName || 'Core Concepts'}
Difficulty: ${difficulty}
Question Type: ${questionType}

Rules:
- Never claim these are genuine Previous Year Questions (PYQs) or assign fake historical exam years.
- For MCQ, provide exactly 4 clear options and set correctAnswer to the exact text of the winning option.
- Provide a step-by-step solution and conceptual explanation.`,
        config: {
          systemInstruction:
            'You are an expert exam question author. Create rigorous, original practice problems with clear step-by-step solutions.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    statement: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.STRING },
                    solution: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    difficulty: { type: Type.STRING },
                    questionType: { type: Type.STRING },
                    marks: { type: Type.INTEGER },
                  },
                },
              },
            },
          },
        },
      });

      const data = JSON.parse((response.text ?? '{"questions":[]}').trim());
      res.json(data);
    } catch (err) {
      handleGeminiError(err, res);
    }
  });

  // 3b. Parse Unstructured Bulk Uploaded Question Text (preserves user-uploaded attribution)
  app.post('/api/questions/parse', async (req: Request, res: Response) => {
    try {
      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
        });
        return;
      }

      const { rawText, subjectName, topicName } = req.body ?? {};
      if (typeof rawText !== 'string' || !rawText.trim()) {
        res.status(400).json({ error: 'Raw question text is required.' });
        return;
      }

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Extract structured practice questions strictly from the user's pasted text below.
Context hint: Subject=${subjectName || 'General'}, Topic=${topicName || 'General'}.
Rules:
- Extract ONLY questions present in the input text; do not invent unrelated questions or fake historical exam years.
- For MCQs, keep the exact options listed and set correctAnswer to the full winning option text (resolve A/B/C/D keys if only a letter key is given).
- Preserve any stated explanation/solution, or summarize concisely from the answer if absent.

Input text:
${rawText.slice(0, 24000)}`,
        config: {
          systemInstruction:
            'You are a careful academic document parser. Convert pasted exam questions and answer keys into clean JSON records without altering factual meaning.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    statement: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.STRING },
                    solution: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    difficulty: { type: Type.STRING },
                    questionType: { type: Type.STRING },
                    year: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const data = JSON.parse((response.text ?? '{"questions":[]}').trim());
      res.json(data);
    } catch (err) {
      handleGeminiError(err, res);
    }
  });

  // 4. Multi-Turn AI Tutor Chat & Google Search Grounding
  app.post('/api/ai/tutor', async (req: Request, res: Response) => {
    try {
      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
        });
        return;
      }

      const {
        message,
        mode = 'general',
        context = {},
        history = [],
        model = 'gemini-4-hydrogen',
        rolePersona = 'default',
        useGoogleSearch = false,
      } = req.body ?? {};

      if (typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'Message prompt is required.' });
        return;
      }

      const baseSystem =
        ROLE_SYSTEM_INSTRUCTIONS[String(rolePersona)] || ROLE_SYSTEM_INSTRUCTIONS.default;

      const contextBanner = `Active Study Context (for grounding in the student's real progress — never invent missing metrics or fake PYQ years):
${JSON.stringify(context)}`;

      const fullSystemInstruction = `${baseSystem}\n\n${contextBanner}`;

      // When Google Search Grounding is active, use gemini-4-hydrogen + tools: [{ googleSearch: {} }]
      if (useGoogleSearch) {
        const recentHistoryText = Array.isArray(history)
          ? history
              .slice(-8)
              .map((h: { role?: string; content?: string }) =>
                `${h.role === 'assistant' ? 'Tutor' : 'Student'}: ${String(h.content || '').slice(0, 600)}`
              )
              .join('\n')
          : '';

        const searchPrompt = recentHistoryText
          ? `Previous conversation:\n${recentHistoryText}\n\nMode: ${mode}\nCurrent Question: ${message.trim()}`
          : `Mode: ${mode}\nQuestion: ${message.trim()}`;

        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: searchPrompt,
          config: {
            systemInstruction: fullSystemInstruction,
            tools: [{ googleSearch: {} }],
          },
        });

        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        const groundingSources: Array<{ title: string; uri: string }> = [];
        const seenUris = new Set<string>();
        for (const chunk of chunks) {
          const web = (chunk as { web?: { uri?: string; title?: string } }).web;
          if (web?.uri && !seenUris.has(web.uri)) {
            seenUris.add(web.uri);
            groundingSources.push({
              title: web.title || web.uri,
              uri: web.uri,
            });
          }
        }

        res.json({
          reply: response.text ?? 'Unable to generate a search-grounded response.',
          modelUsed: 'gemini-4-hydrogen (Google Search Grounding)',
          groundingSources,
          isAiGenerated: true,
        });
        return;
      }

      // Standard Multi-Turn Chat via ai.chats.create
      const requestedModel = ALLOWED_CHAT_MODELS.has(String(model))
        ? String(model)
        : 'gemini-4-hydrogen';

      const formattedHistory = Array.isArray(history)
        ? history
            .slice(-16)
            .filter(
              (item: { role?: string; content?: string }) =>
                item && typeof item.content === 'string' && item.content.trim().length > 0
            )
            .map((item: { role?: string; content?: string }) => ({
              role: item.role === 'assistant' ? ('model' as const) : ('user' as const),
              parts: [{ text: String(item.content) }],
            }))
        : [];

      const chat = ai.chats.create({
        model: requestedModel,
        history: formattedHistory,
        config: {
          systemInstruction: fullSystemInstruction,
        },
      });

      const response = await chat.sendMessage({
        message: `[Study Mode: ${mode}]\n${message.trim()}`,
      });

      res.json({
        reply: response.text ?? 'Unable to generate a response.',
        modelUsed: requestedModel,
        groundingSources: [],
        isAiGenerated: true,
      });
    } catch (err) {
      handleGeminiError(err, res);
    }
  });

  // Vite dev middleware or production static assets
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const server = http.createServer(app);

  // 6. Real-Time Bidirectional Voice WebSocket (/api/live -> gemini-3.8-live)
  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on('connection', async (clientWs: WebSocket, req) => {
    const ai = getAiClient();
    if (!ai) {
      clientWs.send(
        JSON.stringify({
          error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
        })
      );
      clientWs.close();
      return;
    }

    const reqUrl = new URL(req.url || '/api/live', 'http://localhost');
    const requestedVoice = reqUrl.searchParams.get('voice') || 'Zephyr';
    const voiceName = ALLOWED_VOICES.has(requestedVoice) ? requestedVoice : 'Zephyr';
    const topicContext = (reqUrl.searchParams.get('topic') || 'General academic study').slice(0, 200);

    let liveSession: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
    let isClosed = false;

    try {
      liveSession = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are Study Buddy, the student's go-to tutor inside a calm rainy study room. The student is currently studying: ${topicContext}. Speak warmly, concisely, and interactively — quiz them verbally, clarify doubts clearly, and pause for their response.`,
        },
        callbacks: {
          onopen: () => {
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ status: 'connected', voiceName }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onerror: (err: unknown) => {
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              const errMsg =
                err instanceof Error ? err.message : 'Live voice stream encountered an error.';
              clientWs.send(JSON.stringify({ error: errMsg }));
            }
          },
          onclose: () => {
            if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ status: 'closed' }));
              clientWs.close();
            }
          },
        },
      });
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : 'Failed to connect to Gemini Live API.';
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: errMsg }));
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (raw) => {
      if (isClosed || !liveSession) return;
      try {
        const payload = JSON.parse(raw.toString());
        if (typeof payload.audio === 'string' && payload.audio.length > 0) {
          liveSession.sendRealtimeInput({
            audio: {
              data: payload.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (typeof payload.text === 'string' && payload.text.trim()) {
          liveSession.sendRealtimeInput({
            text: payload.text.trim(),
          });
        }
      } catch {
        // Ignore malformed frame
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      try {
        liveSession?.close();
      } catch {
        // Ignore close cleanup errors
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Study Buddy server listening on http://localhost:${PORT}`);
  });
}

createApp();
