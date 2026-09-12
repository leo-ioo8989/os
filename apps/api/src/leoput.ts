import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { requireOrganization } from './auth-context.js';
import { ApiError } from './errors.js';
import { AUDIT_EVENTS } from '@founder-os/db';

export type LeOpUTIntent = {
  raw: string;
  kind: 'website' | 'research' | 'automation' | 'company-work' | 'general';
  title: string;
  risk: 'GREEN' | 'YELLOW' | 'RED';
  steps: string[];
};

function classify(raw: string): LeOpUTIntent {
  const text = raw.trim();
  if (!text || text.length > 4000) throw new ApiError(422, 'VALIDATION_ERROR', 'LeOpUT input must be 1–4000 characters.');
  const lower = text.toLowerCase();
  const website = /\b(build|create|make|design|develop)\b.*\b(website|web app|landing page|site)\b/.test(lower) || /\bwebsite\b/.test(lower);
  const research = /\b(research|analy[sz]e|compare|find out|investigate)\b/.test(lower);
  const automation = /\b(automate|schedule|workflow|recurring|every day|every week)\b/.test(lower);
  const risk = /\b(delete|send|publish|deploy|purchase|pay|transfer|remove|invite)\b/.test(lower) ? 'YELLOW' : 'GREEN';
  const kind = website ? 'website' : research ? 'research' : automation ? 'automation' : /\b(company|business|sales|marketing|finance|operations|hr)\b/.test(lower) ? 'company-work' : 'general';
  const title = text.length > 96 ? `${text.slice(0, 93)}...` : text;
  const steps = website
    ? ['Understand requirements and target audience', 'Create governed website workspace', 'Generate structure, styling and assets', 'Preview and iterate inside Workbench', 'Export or deploy only after policy approval']
    : research
      ? ['Clarify the requested question and evidence boundary', 'Gather authorized context and sources', 'Analyze findings', 'Prepare an auditable result workspace']
      : automation
        ? ['Define trigger and desired outcome', 'Resolve required capabilities', 'Evaluate policy and approval requirements', 'Create controlled workflow', 'Run with audit and recovery']
        : ['Interpret the requested outcome', 'Decompose into governed work', 'Select authorized capabilities', 'Execute through registered workers', 'Record result and provenance'];
  return { raw: text, kind, title, risk, steps };
}

function websiteSeed(intent: LeOpUTIntent) {
  return {
    files: {
      'index.html': '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LEO OS Workspace</title><link rel="stylesheet" href="styles.css"></head><body><main><span class="eyebrow">LEO OS</span><h1>Website workspace</h1><p>Your governed website workspace is ready.</p><button>Get started</button></main><script src="app.js"></script></body></html>',
      'styles.css': 'body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#0b1020;color:#fff}main{max-width:720px;padding:48px}h1{font-size:clamp(42px,8vw,88px);margin:.2em 0}button{padding:12px 18px;border:0;border-radius:999px}',
      'app.js': 'document.querySelector("button")?.addEventListener("click",()=>alert("Workspace is running inside LEO OS."));'
    },
    next: 'Use Workbench to edit, preview and version the generated site.',
    intent: intent.raw
  };
}

export async function createLeOpUT(db: PrismaClient, headers: Record<string, string | string[] | undefined>, raw: string) {
  const c = await requireOrganization(db, headers, 'objective:write');
  const intent = classify(raw);
  const workspaceId = randomUUID();
  const objectiveId = randomUUID();
  const taskId = randomUUID();
  const workflowId = randomUUID();
  const jobId = randomUUID();
  const content = intent.kind === 'website' ? websiteSeed(intent) : { steps: intent.steps, intent: intent.raw };
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "Objective" ("id","organizationId","title","description","createdBy","priority","status","riskLevel","successCriteria","metadata") VALUES (${objectiveId},${c.organizationId},${intent.title},${intent.raw},${c.userId},'MEDIUM','PLANNING',${intent.risk},${JSON.stringify(intent.steps)}::jsonb,${JSON.stringify({source:'LeOpUT',workspaceId,kind:intent.kind})}::jsonb)`;
    await tx.$executeRaw`INSERT INTO "Task" ("id","objectiveId","title","description","status","riskLevel","metadata") VALUES (${taskId},${objectiveId},${intent.steps[0]},${intent.steps.join(' → ')},'READY',${intent.risk},${JSON.stringify({source:'LeOpUT',workspaceId,kind:intent.kind,handlerId:'internal.leoput.plan',capability:'workspace.plan',risk:'LOW',action:'plan',target:workspaceId,parameters:{workspaceId,intent:intent.raw,kind:intent.kind,steps:intent.steps}})}::jsonb)`;
    await tx.$executeRaw`INSERT INTO "Workflow" ("id","organizationId","objectiveId","currentState","status","currentTaskId","resumableState","metadata") VALUES (${workflowId},${c.organizationId},${objectiveId},'LEOPUT_PLANNED','PENDING',${taskId},${JSON.stringify({workspaceId,intent})}::jsonb,${JSON.stringify({source:'LeOpUT'})}::jsonb)`;
    await tx.$executeRaw`INSERT INTO "Job" ("id","organizationId","objectiveId","taskId","workflowId","idempotencyKey","status","maxAttempts","resumableState","metadata") VALUES (${jobId},${c.organizationId},${objectiveId},${taskId},${workflowId},${`leoput:${workspaceId}`},'QUEUED',3,${JSON.stringify({workspaceId})}::jsonb,${JSON.stringify({source:'LeOpUT',handlerId:'internal.leoput.plan',capability:'workspace.plan',risk:'LOW',action:'plan',target:workspaceId})}::jsonb)`;
    await tx.$executeRaw`INSERT INTO "Workspace" ("id","organizationId","createdBy","title","kind","status","intent","content","version","updatedAt") VALUES (${workspaceId},${c.organizationId},${c.userId},${intent.title},${intent.kind},'ACTIVE',${intent.raw},${JSON.stringify(content)}::jsonb,1,NOW())`;
    await tx.$executeRaw`INSERT INTO "AuditEvent" ("id","organizationId","actorId","actorType","eventType","resourceType","resourceId","action","result","metadata") VALUES (${randomUUID()},${c.organizationId},${c.userId},'USER',${AUDIT_EVENTS.OBJECTIVE_CREATED},'Workspace',${workspaceId},'leoput.plan','SUCCESS',${JSON.stringify({objectiveId,taskId,workflowId,jobId,kind:intent.kind,risk:intent.risk})}::jsonb)`;
  });
  return { intent, workspaceId, objectiveId, taskId, workflowId, jobId, state: 'PLANNED' };
}

export async function listWorkspaces(db: PrismaClient, headers: Record<string, string | string[] | undefined>) {
  const c = await requireOrganization(db, headers, 'objective:read');
  return db.$queryRaw`SELECT "id","title","kind","status","intent","content","version","createdAt","updatedAt" FROM "Workspace" WHERE "organizationId"=${c.organizationId} ORDER BY "updatedAt" DESC LIMIT 100`;
}

export async function getWorkspace(db: PrismaClient, headers: Record<string, string | string[] | undefined>, id: string) {
  const c = await requireOrganization(db, headers, 'objective:read');
  const rows = await db.$queryRaw<Array<Record<string, unknown>>>`SELECT "id","title","kind","status","intent","content","version","createdAt","updatedAt" FROM "Workspace" WHERE "organizationId"=${c.organizationId} AND "id"=${id} LIMIT 1`;
  if (!rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found.');
  return rows[0];
}
