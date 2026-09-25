import { getAccessToken, getCurrentUser, signInWithPassword, signOut as supabaseSignOut } from './supabase';

type ApiResult<T = unknown> = { data: T };

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = await getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(path, { ...init, headers });
  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  if (!response.ok) throw Object.assign(new Error(data.message || `Request failed (${response.status})`), { status: response.status, data });
  return { data };
}

export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  delete: <T = any>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export const auth = {
  async getUser() {
    const user = await getCurrentUser();
    return user ? { id: user.id, userId: user.id, name: user.user_metadata?.name || user.email?.split('@')[0], email: user.email } : null;
  },
  async isSignedIn() { return Boolean(await getCurrentUser()); },
  async signIn() {
    const email = window.prompt('Email address')?.trim();
    if (!email) throw new Error('Email is required.');
    const password = window.prompt('Password') || '';
    const existing = await signInWithPassword(email, password);
    return { user: { name: existing?.user_metadata?.name || email.split('@')[0], email: existing?.email || email } };
  },
  async signOut() { await supabaseSignOut(); },
};

export const image = {
  async resizeIfNeeded(file: File) {
    const max = 1600;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) throw new Error('Could not prepare image.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    return { data: btoa(binary), mimeType: 'image/jpeg' };
  },
};
