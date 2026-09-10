import type { IncomingMessage, ServerResponse } from 'node:http';
import { ApiError } from './errors.js';
export function writeJson(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(status === 204 ? undefined : JSON.stringify(value));
}
export async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += b.length; if (size > 1024 * 1024) throw new ApiError(422, 'VALIDATION_ERROR', 'Request body is too large.'); chunks.push(b); }
  if (!size) return {};
  if (String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') throw new ApiError(422, 'VALIDATION_ERROR', 'Content-Type must be application/json.');
  try { const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value as Record<string, unknown>; }
  catch { throw new ApiError(422, 'VALIDATION_ERROR', 'Request body must be valid JSON.'); }
}
export function routeParts(url: string): string[] { return new URL(url, 'http://localhost').pathname.split('/').filter(Boolean).map(decodeURIComponent); }
export function pathId(value: string | undefined, field: string): string { if (!value || value.length > 128) throw new ApiError(422, 'VALIDATION_ERROR', `${field} is invalid.`); return value; }
