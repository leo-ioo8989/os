export const V407_VERSION='4.07.0';
export interface Budget { id:string; organizationId:string; limit:number; used:number; currency:string; }
export interface Quota { id:string; organizationId:string; limit:number; used:number; }
export function reserveBudget(b:Budget,cost:number):Budget { if(!Number.isFinite(cost)||cost<0)throw new Error('V407_INVALID_COST'); if(b.used+cost>b.limit)throw new Error('V407_BUDGET_EXCEEDED');return {...b,used:b.used+cost}; }
export function consumeQuota(q:Quota,units:number):Quota { if(!Number.isInteger(units)||units<0)throw new Error('V407_INVALID_QUOTA');if(q.used+units>q.limit)throw new Error('V407_QUOTA_EXCEEDED');return {...q,used:q.used+units}; }
export function costAttribution(organizationId:string,usage:number,currency:string){if(!organizationId||usage<0||!currency)return {ok:false,reason:'INVALID_ACCOUNTING'};return {ok:true,organizationId,usage,currency};}
