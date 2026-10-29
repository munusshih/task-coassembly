export function dateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function monthDays(month) {
  const [year,index]=month.split('-').map(Number);
  const first=new Date(year,index-1,1,12);
  const start=1-(first.getDay()+6)%7;
  const count=Math.ceil(((first.getDay()+6)%7+new Date(year,index,0).getDate())/7)*7;
  return Array.from({length:count},(_,i)=>dateKey(new Date(year,index-1,start+i,12)));
}
export function shiftMonth(month,amount) {
  const [year,index]=month.split('-').map(Number);
  return dateKey(new Date(year,index-1+amount,1,12)).slice(0,7);
}
