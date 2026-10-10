export const money=(value:number|null)=>value===null?"Unavailable":new Intl.NumberFormat("en-MY",{style:"currency",currency:"MYR",maximumFractionDigits:2}).format(value);
export const number=(value:number)=>new Intl.NumberFormat("en-MY").format(value);
export const percent=(value:number|null)=>value===null?"—":`${value.toFixed(1)}%`;
export const shortDate=(value:string)=>new Intl.DateTimeFormat("en-MY",{day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(`${value}T00:00:00Z`));
