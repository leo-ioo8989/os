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
  const dangerous = /\b(delete|send|publish|deploy|purchase|pay|transfer|remove|invite)\b/.test(lower);
  const negatedDangerous = /\b(do not|don't|dont|never|avoid|without)\s+(?:\w+\s+){0,3}(delete|send|publish|deploy|purchase|pay|transfer|remove|invite)\b/.test(lower);
  const risk = dangerous && !negatedDangerous ? 'YELLOW' : 'GREEN';
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
    await tx.objective.create({data:{id:objectiveId,organizationId:c.organizationId,title:intent.title,description:intent.raw,createdBy:c.userId,priority:'MEDIUM',status:'PLANNING',riskLevel:intent.risk,successCriteria:intent.steps,metadata:{source:'LeOpUT',workspaceId,kind:intent.kind}}});
    await tx.task.create({data:{id:taskId,objectiveId,title:intent.steps[0],description:intent.steps.join(' → '),status:'READY',riskLevel:intent.risk,metadata:{source:'LeOpUT',workspaceId,kind:intent.kind,handlerId:'internal.leoput.plan',capability:'workspace.plan',risk:'LOW',action:'plan',target:workspaceId,parameters:{workspaceId,intent:intent.raw,kind:intent.kind,steps:intent.steps}}}});
    await tx.workflow.create({data:{id:workflowId,organizationId:c.organizationId,objectiveId,currentState:'LEOPUT_PLANNED',status:'PENDING',currentTaskId:taskId,resumableState:{workspaceId,intent},metadata:{source:'LeOpUT'}}});
    await tx.job.create({data:{id:jobId,organizationId:c.organizationId,objectiveId,taskId,workflowId,idempotencyKey:`leoput:${workspaceId}`,status:'QUEUED',maxAttempts:3,resumableState:{workspaceId},metadata:{source:'LeOpUT',handlerId:'internal.leoput.plan',capability:'workspace.plan',risk:'LOW',action:'plan',target:workspaceId}}});
    await tx.workspace.create({data:{id:workspaceId,organizationId:c.organizationId,createdBy:c.userId,title:intent.title,kind:intent.kind,status:'ACTIVE',intent:intent.raw,content,version:1,updatedAt:new Date()}});
    await tx.auditEvent.create({data:{id:randomUUID(),organizationId:c.organizationId,actorId:c.userId,actorType:'USER',eventType:AUDIT_EVENTS.OBJECTIVE_CREATED,resourceType:'Workspace',resourceId:workspaceId,action:'leoput.plan',result:'SUCCESS',metadata:{objectiveId,taskId,workflowId,jobId,kind:intent.kind,risk:intent.risk}}});
  });
  return { intent, workspaceId, objectiveId, taskId, workflowId, jobId, state: 'PLANNED' };
}

export async function listWorkspaces(db: PrismaClient, headers: Record<string, string | string[] | undefined>) {
  const c = await requireOrganization(db, headers, 'objective:read');
  return db.workspace.findMany({where:{organizationId:c.organizationId},select:{id:true,title:true,kind:true,status:true,intent:true,content:true,version:true,createdAt:true,updatedAt:true},orderBy:{updatedAt:'desc'},take:100});
}

export async function getWorkspace(db: PrismaClient, headers: Record<string, string | string[] | undefined>, id: string) {
  const c = await requireOrganization(db, headers, 'objective:read');
  const row = await db.workspace.findFirst({where:{organizationId:c.organizationId,id},select:{id:true,title:true,kind:true,status:true,intent:true,content:true,version:true,createdAt:true,updatedAt:true}});
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found.');
  return row;
}
