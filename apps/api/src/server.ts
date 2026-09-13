import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { db, createSession, verifyPassword, hashSessionToken } from '@founder-os/db';
import { requireOrganization, authenticateRequest } from './auth-context.js';
import { ApiError, errorBody } from './errors.js';
import { readJson, routeParts, pathId, writeJson } from './http.js';
import { addDependency, changeObjectiveStatus, changeTaskStatus, createObjective, createTask, deleteObjective, deleteTask, getObjective, getTask, listObjectives, listTasks, removeDependency, updateObjective, updateTask } from './control-plane.js';
import { callback, integrationCatalog, listIntegrations, revokeIntegration, startOAuth, type OAuthProvider } from './integration-vault.js';
import { capabilities, getAccessToken } from './integration-runtime.js';
import { createLeOpUT, getWorkspace, listWorkspaces } from './leoput.js';
const port=Number(process.env.PORT??4000);const commandCenterOrigin=process.env.COMMAND_CENTER_ORIGIN??'http://localhost:4173';const objectiveStatuses=['DRAFT','PLANNING','READY','RUNNING','WAITING_APPROVAL','BLOCKED','PAUSED','COMPLETED','FAILED','CANCELLED'] as const;const taskStatuses=['PENDING','READY','RUNNING','WAITING_APPROVAL','BLOCKED','FAILED','COMPLETED','CANCELLED'] as const;
const LOGIN_WINDOW_MS=15*60*1000;const LOGIN_MAX_ATTEMPTS=10;const LOGIN_MAX_KEYS=10000;const loginAttempts=new Map<string,{count:number;resetAt:number}>();function loginKey(req:import('node:http').IncomingMessage,email:string){const ip=req.socket.remoteAddress||'unknown';return `${ip}|${email}`;}function checkLoginRateLimit(req:import('node:http').IncomingMessage,email:string){const now=Date.now();for(const [key,item] of loginAttempts){if(item.resetAt<=now)loginAttempts.delete(key);}const key=loginKey(req,email);const item=loginAttempts.get(key);if(item&&item.resetAt>now&&item.count>=LOGIN_MAX_ATTEMPTS)throw new ApiError(429,'CONFLICT','Too many login attempts. Try again later.');if(loginAttempts.size>=LOGIN_MAX_KEYS&&!item){const oldest=loginAttempts.keys().next().value;if(typeof oldest==='string')loginAttempts.delete(oldest);}loginAttempts.set(key,{count:(item?.count??0)+1,resetAt:item?.resetAt&&item.resetAt>now?item.resetAt:now+LOGIN_WINDOW_MS});}
