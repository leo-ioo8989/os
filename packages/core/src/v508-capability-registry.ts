export const V508_VERSION='5.08';
export type CapabilitySideEffect='NONE'|'READ'|'WRITE';
export interface Capability{key:string;version:string;sideEffect:CapabilitySideEffect;requiredScope:string;enabled:boolean;provider?:string;category?:'NATIVE'|'CONNECTABLE_APP'|'AI_SERVICE'|'TOOL_SERVICE'}
export interface IntegrationDescriptor{id:string;label:string;kind:'APP'|'AI';connectable:boolean;authentication:'OAUTH'|'API_KEY'|'NATIVE';capabilities:string[]}
export const BUILT_IN_INTEGRATIONS:readonly IntegrationDescriptor[]=[
{id:'google-workspace',label:'Google Workspace',kind:'APP',connectable:true,authentication:'OAUTH',capabilities:['gmail.read','gmail.send','calendar.read','calendar.write','drive.read','drive.write']},
{id:'slack',label:'Slack',kind:'APP',connectable:true,authentication:'OAUTH',capabilities:['slack.read','slack.send']},
{id:'github',label:'GitHub',kind:'APP',connectable:true,authentication:'OAUTH',capabilities:['github.read','github.write','github.workflow']},
{id:'openai',label:'OpenAI',kind:'AI',connectable:true,authentication:'API_KEY',capabilities:['ai.reason']},
{id:'anthropic',label:'Anthropic',kind:'AI',connectable:true,authentication:'API_KEY',capabilities:['ai.reason']},
];
export const BUILT_IN_CAPABILITIES:readonly Capability[]=Object.freeze([]);
export class CapabilityRegistry{private readonly entries=new Map<string,Capability>();register(c:Capability){if(!c.key||!c.version||!c.requiredScope)throw new Error('invalid capability');if(this.entries.has(c.key))throw new Error('duplicate capability');this.entries.set(c.key,structuredClone(c))}registerMany(entries:readonly Capability[]){for(const c of entries)this.register(c)}resolve(key:string,scope:string):Capability{const c=this.entries.get(key);if(!c||!c.enabled||c.requiredScope!==scope)throw new Error('capability denied');return structuredClone(c)}list():Capability[]{return[...this.entries.values()].map(value=>structuredClone(value))}}
export function createDefaultCapabilityRegistry():CapabilityRegistry{const r=new CapabilityRegistry();for(const i of BUILT_IN_INTEGRATIONS)for(const key of i.capabilities)r.register({key,version:'1',sideEffect:key.endsWith('.send')||key.endsWith('.write')||key.endsWith('.workflow')?'WRITE':key==='ai.reason'?'NONE':'READ',requiredScope:`capability:${key}`,enabled:true,provider:i.id,category:i.kind==='AI'?'AI_SERVICE':'CONNECTABLE_APP'});return r}
