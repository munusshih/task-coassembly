import {weekStartForDateKey} from '../components/taskBoardRules.js';
export function weekForCalendarDay(date) {
 if(!(date instanceof Date)||Number.isNaN(date.getTime()))return null;
 return weekStartForDateKey(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`);
}
export function weekDateLabel(week) {
 const from=new Date(`${week}T12:00:00`),to=new Date(from);to.setDate(to.getDate()+6);
 if(Number.isNaN(from.getTime()))return 'Choose week';
 return `${from.toLocaleDateString('en-US',{month:'short',day:'numeric',year:from.getFullYear()!==to.getFullYear()?'numeric':undefined})}–${to.toLocaleDateString('en-US',{month:to.getMonth()===from.getMonth()?undefined:'short',day:'numeric'})}, ${to.getFullYear()}`;
}
