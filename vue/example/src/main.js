import { createApp } from 'vue';
import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
import App from './App.vue';

const cal = await (await fetch('/nepali_calendar_data.json')).json();
initializeCalendar(new InlineCalendarDataSource(cal.years, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough));
createApp(App).mount('#app');
