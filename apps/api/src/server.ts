import { createServer } from 'node:http';
import { db } from '@founder-os/db';
import { requireOrganization } from './auth-context.js';
import { ApiError, errorBody } from './errors.js';
import { readJson, routeParts, pathId, writeJson } from './http.js';
import { addDependency, changeObjectiveStatus, changeTaskStatus, createObjective, createTask, deleteObjective, deleteTask, getObjective, getTask, listObjectives, listTasks, removeDependency, updateObjective, updateTask } from './control-plane.js';
import { callback, integrationCatalog, listIntegrations, revokeIntegration, startOAuth, type OAuthProvider } from './integration-vault.js';
const port = Number(process.env.PORT ?? 4000);
const commandCenterOrigin = process.env.COMMAND_CENTER_ORIGIN ?? 'http://localhost:4173';
const objectiveStatuses = ['DRAFT','PLANNING','READY','RUNNING','WAITING_APPROVAL','BLOCKED','PAUSED','COMPLETED','FAILED','CANCELLED'] as const;
const taskStatuses = ['PENDING','READY','RUNNING','WAITING_APPROVAL','BLOCKED','FAILED','COMPLETED','CANCELLED'] as const;
function bodyStatus(body: Record<string, unknown>, allowed: readonly string[]): string { if (typeof body.status !== 'string' || !allowed.includes(body.status)) throw new ApiError(422, 'VALIDATION_ERROR', 'status is invalid.'); return body.status; }
function securityHeaders(res: import('node:http').ServerResponse) { res.setHeader('x-content-type-options','nosniff'); res.setHeader('x-frame-options','DENY'); res.setHeader('referrer-policy','no-referrer'); res.setHeader('permissions-policy','camera=(),microphone=(),geolocation=()'); res.setHeader('cache-control','no-store'); }
function cors(res: import('node:http').ServerResponse) { securityHeaders(res); res.setHeader('access-control-allow-origin', commandCenterOrigin); res.setHeader('access-control-allow-credentials', 'true'); res.setHeader('vary', 'Origin'); }
function redirect(res: import('node:http').ServerResponse,url:string){res.writeHead(302,{location:url,'cache-control':'no-store'});res.end();}
async function route(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
  cors(res);
  const method = req.method ?? 'GET'; const p = routeParts(req.url ?? '/'); const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (method === 'OPTIONS') { res.setHeader('access-control-allow-methods','GET,POST,PATCH,DELETE,OPTIONS'); res.setHeader('access-control-allow-headers','authorization,content-type,x-organization-id'); res.writeHead(204); return res.end(); }
  if (p.length === 1 && p[0] === 'health' && method === 'GET') return writeJson(res, 200, { status: 'ok', service: 'leo-os-api' });
  if (p.length === 1 && p[0] === 'ready' && method === 'GET') { await db.$queryRaw`SELECT 1`; return writeJson(res, 200, { status: 'ready', service: 'leo-os-api', database: 'ok' }); }
  if (p[0] === 'v1' && p[1] === 'integrations') {
    if (p.length === 2 && method === 'GET') return writeJson(res,200,{data:await listIntegrations(db,req.headers),catalog:integrationCatalog()});
    if (p.length === 3 && p[2] === 'catalog' && method === 'GET') { await requireOrganization(db,req.headers,'integration:manage'); return writeJson(res,200,{data:integrationCatalog()}); }
    const provider=p[2] as OAuthProvider;
    if (p.length === 4 && p[3] === 'start' && method === 'GET') return redirect(res,await startOAuth(db,req.headers,provider));
    if (p.length === 4 && p[3] === 'callback' && method === 'GET') { const s=await callback(db,provider,url.searchParams); return redirect(res,`${commandCenterOrigin}/?integration=${encodeURIComponent(provider)}&connected=1&account=${encodeURIComponent(s.organizationId)}`); }
    if (p.length === 3 && method === 'DELETE') { await revokeIntegration(db,req.headers,provider); return writeJson(res,204,null); }
  }
  if (p[0] !== 'v1') throw new ApiError(404, 'NOT_FOUND', 'Route not found.');
  const body = ['POST','PATCH','PUT'].includes(method) ? await readJson(req) : {};
  if (p[1] === 'objectives') {
    if (p.length === 2 && method === 'GET') { const c = await requireOrganization(db, req.headers, 'objective:read'); return writeJson(res, 200, { data: await listObjectives(db, c.organizationId) }); }
    if (p.length === 2 && method === 'POST') { const c = await requireOrganization(db, req.headers, 'objective:write'); return writeJson(res, 201, { data: await createObjective(db, c.organizationId, c.userId, body) }); }
    const oid = pathId(p[2], 'objectiveId');
    if (p.length === 3 && method === 'GET') { const c = await requireOrganization(db, req.headers, 'objective:read'); return writeJson(res, 200, { data: await getObjective(db, c.organizationId, oid) }); }
    if (p.length === 3 && method === 'PATCH') { const c = await requireOrganization(db, req.headers, 'objective:write'); return writeJson(res, 200, { data: await updateObjective(db, c.organizationId, oid, body, c.userId) }); }
    if (p.length === 3 && method === 'DELETE') { const c = await requireOrganization(db, req.headers, 'objective:write'); await deleteObjective(db, c.organizationId, oid, c.userId); return writeJson(res, 204, null); }
    if (p[3] === 'status' && p.length === 4 && method === 'POST') { const c = await requireOrganization(db, req.headers, 'objective:write'); await changeObjectiveStatus(db, c.organizationId, oid, bodyStatus(body, objectiveStatuses) as never, c.userId); return writeJson(res, 200, { data: await getObjective(db, c.organizationId, oid) }); }
    if (p[3] === 'tasks' && p.length === 4 && method === 'GET') { const c = await requireOrganization(db, req.headers, 'task:read'); return writeJson(res, 200, { data: await listTasks(db, c.organizationId, oid) }); }
    if (p[3] === 'tasks' && p.length === 4 && method === 'POST') { const c = await requireOrganization(db, req.headers, 'task:write'); return writeJson(res, 201, { data: await createTask(db, c.organizationId, oid, body, c.userId) }); }
  }
  if (p[1] === 'tasks') {
    const tid = pathId(p[2], 'taskId');
    if (p.length === 3 && method === 'GET') { const c = await requireOrganization(db, req.headers, 'task:read'); return writeJson(res, 200, { data: await getTask(db, c.organizationId, tid) }); }
    if (p.length === 3 && method === 'PATCH') { const c = await requireOrganization(db, req.headers, 'task:write'); return writeJson(res, 200, { data: await updateTask(db, c.organizationId, tid, body, c.userId) }); }
    if (p.length === 3 && method === 'DELETE') { const c = await requireOrganization(db, req.headers, 'task:write'); await deleteTask(db, c.organizationId, tid, c.userId); return writeJson(res, 204, null); }
    if (p[3] === 'status' && p.length === 4 && method === 'POST') { const c = await requireOrganization(db, req.headers, 'task:write'); await changeTaskStatus(db, c.organizationId, tid, bodyStatus(body, taskStatuses) as never, c.userId); return writeJson(res, 200, { data: await getTask(db, c.organizationId, tid) }); }
    if (p[3] === 'dependencies' && p.length === 4 && method === 'POST') { const c = await requireOrganization(db, req.headers, 'task:write'); const dep = pathId(typeof body.dependencyId === 'string' ? body.dependencyId : undefined, 'dependencyId'); await addDependency(db, c.organizationId, tid, dep, c.userId); return writeJson(res, 201, { data: await getTask(db, c.organizationId, tid) }); }
    if (p[3] === 'dependencies' && p.length === 5 && method === 'DELETE') { const c = await requireOrganization(db, req.headers, 'task:write'); await removeDependency(db, c.organizationId, tid, pathId(p[4], 'dependencyId'), c.userId); return writeJson(res, 204, null); }
  }
  throw new ApiError(404, 'NOT_FOUND', 'Route not found.');
}
const server = createServer(async (req, res) => { try { await route(req, res); } catch (error) { cors(res); writeJson(res, error instanceof ApiError ? error.status : 500, errorBody(error)); } });
server.listen(port, () => console.log(`LEO OS API listening on :${port}`));
