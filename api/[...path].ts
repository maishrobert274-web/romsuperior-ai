import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const fastModel = process.env.GEMINI_FAST_MODEL || 'gemini-3.7-flash';
const deepModel = process.env.GEMINI_DEEP_MODEL || 'gemini-3.7-flash';
const imageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';

type Message = { role: 'user' | 'assistant'; content: string; imageUrl?: string; fileName?: string };
function json(res: VercelResponse, status: number, body: unknown) { res.status(status).json(body); }
function getBearer(req: VercelRequest) { const value = req.headers.authorization || ''; return value.startsWith('Bearer ') ? value.slice(7) : ''; }
async function getUser(req: VercelRequest) {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  const token = getBearer(req); if (!token) return null;
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await client.auth.getUser(token);
  return data.user ? { client, user: data.user } : null;
}
function historyToContents(history: Message[] = []) { return history.slice(-14).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })); }

async function chat(req: VercelRequest, res: VercelResponse) {
  const input = req.body || {}; const message = String(input.message || 'Analyze the attached content.').trim();
  const parts: any[] = [{ text: message + (input.fileText ? `\n\nAttached file content:\n${String(input.fileText).slice(0, 40000)}` : '') }];
  if (input.image?.data && input.image?.mimeType) parts.push({ inlineData: { data: input.image.data, mimeType: input.image.mimeType } });
  try {
    const response = await gemini.models.generateContent({ model: input.thinkingMode === 'DEEP' ? deepModel : fastModel, contents: [...historyToContents(input.history), { role: 'user', parts }], config: { systemInstruction: 'You are romsuperior ai, an advanced general-purpose assistant. Be accurate, helpful, concise when appropriate, and clearly state uncertainty. Never reveal private chain-of-thought.' } });
    json(res, 200, { reply: response.text || 'No response was returned.' });
  } catch (e) { console.error(e); json(res, 503, { message: 'AI service temporarily unavailable.' }); }
}

async function research(req: VercelRequest, res: VercelResponse) {
  const url = String(req.body?.url || '').trim(); if (!/^https?:\/\//i.test(url)) return json(res, 400, { message: 'Enter a valid http or https URL.' });
  try {
    const page = await fetch(url, { headers: { 'User-Agent': 'romsuperior-ai/1.0' } });
    const text = (await page.text()).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 40000);
    const response = await gemini.models.generateContent({ model: req.body?.thinkingMode === 'DEEP' ? deepModel : fastModel, contents: `Summarize this web page faithfully. Separate facts from uncertainty.\n\nURL: ${url}\n\nPAGE:\n${text}` });
    json(res, 200, { title: url, summary: response.text || 'No summary returned.' });
  } catch (e) { console.error(e); json(res, 502, { message: 'Could not research that web page.' }); }
}

async function agent(req: VercelRequest, res: VercelResponse) {
  const task = String(req.body?.message || '').trim(); if (!task) return json(res, 400, { message: 'Agent task is required.' });
  const urls = task.match(/https?:\/\/[^\s]+/gi) || []; let evidence = '';
  for (const url of urls.slice(0, 2)) {
    try { const page = await fetch(url, { headers: { 'User-Agent': 'romsuperior-ai/1.0' } }); evidence += `\nSOURCE ${url}\n${(await page.text()).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 12000)}\n`; }
    catch { evidence += `\nSOURCE ${url}: unavailable\n`; }
  }
  try {
    const response = await gemini.models.generateContent({ model: req.body?.thinkingMode === 'DEEP' ? deepModel : fastModel, contents: `Complete this task using the supplied public-web evidence when present. Do not invent source contents.\n\nTASK:\n${task}\n\nEVIDENCE:\n${evidence || 'No URL was supplied; answer using your general knowledge and state uncertainty where relevant.'}` });
    json(res, 200, { reply: response.text || 'No agent response returned.', steps: urls.length ? urls.slice(0, 2).map((url: string) => ({ tool: 'browse_url', url })) : [] });
  } catch (e) { console.error(e); json(res, 503, { message: 'Agent task temporarily unavailable.' }); }
}

async function imageGen(req: VercelRequest, res: VercelResponse) {
  const prompt = String(req.body?.prompt || '').trim(); if (!prompt) return json(res, 400, { message: 'Prompt is required.' });
  try {
    const response = await gemini.models.generateContent({ model: imageModel, contents: prompt, config: { responseModalities: ['IMAGE'] } as any });
    const parts = response.candidates?.[0]?.content?.parts || []; const image = parts.find((part: any) => part.inlineData)?.inlineData;
    if (!image?.data) return json(res, 502, { message: 'No image was returned.' }); json(res, 200, { image: image.data, mimeType: image.mimeType || 'image/png' });
  } catch (e) { console.error(e); json(res, 503, { message: 'Image generation temporarily unavailable.' }); }
}

async function chats(req: VercelRequest, res: VercelResponse, userCtx: any) {
  if (!userCtx) return json(res, 401, { message: 'Sign in required.' }); const { client, user } = userCtx;
  if (req.method === 'GET') {
    const { data, error } = await client.from('chats').select('client_id,title,messages,updated_at').eq('owner_user_id', user.id).order('updated_at', { ascending: false }).limit(50);
    if (error) return json(res, 500, { message: error.message }); return json(res, 200, { chats: (data || []).map((x: any) => ({ id: x.client_id, title: x.title, messages: x.messages, updatedAt: x.updated_at })) });
  }
  if (req.method === 'POST') {
    const { id, title, messages } = req.body || {}; if (!id || !title || !Array.isArray(messages)) return json(res, 400, { message: 'Chat id, title and messages are required.' });
    const { error } = await client.from('chats').upsert({ owner_user_id: user.id, client_id: id, title: String(title).slice(0, 120), messages: messages.slice(-100), updated_at: Date.now() }, { onConflict: 'owner_user_id,client_id' });
    if (error) return json(res, 500, { message: error.message }); return json(res, 200, { saved: true, id });
  }
  if (req.method === 'DELETE') { const id = String(req.query.path || '').split('/').pop(); const { error } = await client.from('chats').delete().eq('owner_user_id', user.id).eq('client_id', id); if (error) return json(res, 500, { message: error.message }); return json(res, 200, { deleted: true }); }
  return json(res, 405, { message: 'Method not allowed.' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = String(req.query.path || '').replace(/^\//, '');
  if (path === '_healthcheck') return json(res, 200, { message: 'Success', provider: 'Gemini', database: 'Supabase' });
  if (path === 'chat' && req.method === 'POST') return chat(req, res);
  if (path === 'research' && req.method === 'POST') return research(req, res);
  if (path === 'agent' && req.method === 'POST') return agent(req, res);
  if (path === 'image' && req.method === 'POST') return imageGen(req, res);
  if (path === 'chats') return chats(req, res, await getUser(req));
  if (path.startsWith('chats/') && req.method === 'DELETE') return chats(req, res, await getUser(req));
  if (path === 'files' && req.method === 'POST') return json(res, 200, { stored: true, note: 'File content is processed in the AI request; persistent file storage will be added with Supabase Storage.' });
  return json(res, 404, { message: 'Not found.' });
}
