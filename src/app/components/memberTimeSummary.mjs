export function memberTimeSummary(units, start, end) {
 const hours=Math.max(0,Number(units)||0)/4;
 const first=Date.parse(start+'T00:00:00Z'),last=Date.parse(end+'T00:00:00Z')+6*86400000;
 if(!hours||!Number.isFinite(first)||!Number.isFinite(last)||last<first)return '';
 const days=Math.floor((last-first)/86400000)+1;
 let weekdays=Math.floor(days/7)*5;
 for(let i=0;i<days%7;i++){const day=new Date(first+(Math.floor(days/7)*7+i)*86400000).getUTCDay();if(day!==0&&day!==6)weekdays++;}
 return `≈ ${(hours/8).toLocaleString('en-US',{maximumFractionDigits:1})} eight-hour workdays\n${(hours/Math.max(1,weekdays)).toLocaleString('en-US',{maximumFractionDigits:1})} team hours per weekday across this period.`;
}
