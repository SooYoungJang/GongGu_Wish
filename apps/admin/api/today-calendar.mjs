import { handleTodayCalendar } from '../server/today-calendar.mjs';
export default { fetch: request => handleTodayCalendar(request, process.env) };
