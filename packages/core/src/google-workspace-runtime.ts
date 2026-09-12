import { googleAccessToken } from './integration-runtime.js';

async function googleJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await googleAccessToken();
  const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, accept: 'application/json', ...(init.headers ?? {}) } });
  const text = await response.text();
  let data: unknown = undefined;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = { raw: text.slice(0, 2000) }; }
  if (!response.ok) throw new Error(`Google Workspace request failed (${response.status}).`);
  return data as T;
}

export interface GmailMessage { id: string; threadId?: string; snippet?: string; }
export interface CalendarEvent { id?: string; summary?: string; start?: unknown; end?: unknown; }
export interface DriveFile { id?: string; name?: string; mimeType?: string; webViewLink?: string; }

export function gmailList(query = '', maxResults = 20) {
  const q = new URLSearchParams({ maxResults: String(maxResults) }); if (query) q.set('q', query);
  return googleJson<{ messages?: GmailMessage[]; resultSizeEstimate?: number }>(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${q}`);
}
export function gmailGet(id: string) {
  return googleJson<GmailMessage & { payload?: unknown }>(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`);
}
export function calendarList(timeMin?: string, timeMax?: string) {
  const q = new URLSearchParams({ maxResults: '50', singleEvents: 'true', orderBy: 'startTime' });
  if (timeMin) q.set('timeMin', timeMin); if (timeMax) q.set('timeMax', timeMax);
  return googleJson<{ items?: CalendarEvent[] }>(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`);
}
export function driveList(query = '') {
  const q = new URLSearchParams({ pageSize: '50', fields: 'files(id,name,mimeType,webViewLink)' }); if (query) q.set('q', query);
  return googleJson<{ files?: DriveFile[] }>(`https://www.googleapis.com/drive/v3/files?${q}`);
}
