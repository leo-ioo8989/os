import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { readJson, pathId, writeJson } from '../src/http.js';
import { ApiError } from '../src/errors.js';

function request(body:string,contentType='application/json'){const req=Readable.from([body]) as Readable & {headers:Record<string,string>};req.headers={'content-type':contentType};return req;}

test('V1.09 rejects non-JSON and malformed JSON request bodies',async()=>{await assert.rejects(()=>readJson(request('{}','text/plain') as never),(error:unknown)=>error instanceof ApiError&&error.status===422);await assert.rejects(()=>readJson(request('{bad') as never),(error:unknown)=>error instanceof ApiError&&error.status===422);await assert.deepEqual(await readJson(request('{"ok":true}') as never),{ok:true});});

test('V1.09 rejects oversized request bodies and invalid identifiers',async()=>{const oversized='x'.repeat(1024*1024+1);await assert.rejects(()=>readJson(request(oversized) as never),(error:unknown)=>error instanceof ApiError&&error.status===422);assert.throws(()=>pathId('', 'id'),(error:unknown)=>error instanceof ApiError&&error.status===422);assert.throws(()=>pathId('x'.repeat(129), 'id'),(error:unknown)=>error instanceof ApiError&&error.status===422);assert.equal(pathId('valid-id','id'),'valid-id');});

test('V1.09 HTTP JSON responses carry no-store and nosniff controls',()=>{const headers:any={};const res:any={writeHead:(status:number,h:Record<string,string>)=>{headers.status=status;Object.assign(headers,h)},end:()=>{}};writeJson(res,200,{ok:true});assert.equal(headers['cache-control'],'no-store');assert.equal(headers['x-content-type-options'],'nosniff');});
