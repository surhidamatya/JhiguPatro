import { StrictMode, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
import {
  JhiguDatePicker, JhiguDateRangePicker, JhiguCalendar, JhiguAddressSelect, JhiguMoneyInput, JhiguPhoneInput,
} from 'jhigu-patro-react';

const cal = await (await fetch('/nepali_calendar_data.json')).json();
initializeCalendar(new InlineCalendarDataSource(cal.years, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough));

const TODAY = '2082-05-10';

function App() {
  const [log, setLog] = useState([]);
  const note = (s) => setLog((l) => [s, ...l].slice(0, 12));
  const [lang, setLang] = useState('en');
  const [dob, setDob] = useState('2082-05-12');
  const [form, setForm] = useState('(not submitted)');
  const [renders, setRenders] = useState(0);
  const events = useMemo(() => ({ '2082-05-12': ['Teej'], '2082-05-15': ['Fulpati', 'Holiday'] }), []);
  const picker = useRef(null);

  return (
    <>
      <h1>jhigu-patro-react</h1>
      <p>
        <button data-testid="lang" onClick={() => setLang((l) => (l === 'en' ? 'ne' : 'en'))}>language: {lang}</button>{' '}
        <button data-testid="rerender" onClick={() => setRenders((n) => n + 1)}>rerender ({renders})</button>{' '}
        <button data-testid="setdob" onClick={() => setDob('2082-06-02')}>parent sets date to 2082-06-02</button>
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setForm(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)), null, 1));
        }}
      >
        <div className="row">
          <section>
            <label>Date (form field "dob", required)</label>
            <JhiguDatePicker ref={picker} name="dob" language={lang} value={dob} today={TODAY} required
              onChange={(d) => { setDob(d.bs); note(`date: ${d.bs}`); }} />
          </section>
          <section className="brand">
            <label>Range (themed with custom properties)</label>
            <JhiguDateRangePicker name="stay" language={lang} today={TODAY}
              style={{ '--jhigu-color-primary': '#047857' }}
              onChange={(d) => note(`range: ${d.start} to ${d.end} (${d.days} days)`)} />
          </section>
          <section>
            <label>Calendar with events</label>
            <JhiguCalendar language={lang} year={2082} month={5} today={TODAY} events={events}
              onSelect={(d) => note(`calendar: ${d.bs} ${JSON.stringify(d.events)}`)}
              onMonthChange={(d) => note(`month: ${d.year}-${d.month}`)} />
          </section>
        </div>
        <div className="row">
          <section>
            <label>Address</label>
            <JhiguAddressSelect name="addr" language={lang} onChange={(d) => note(`address: ${d.complete ? d.text : '...'}`)} />
          </section>
          <section>
            <label>Amount (Rs.)</label>
            <JhiguMoneyInput name="amount" symbol="Rs." label="Amount" language={lang}
              onChange={(d) => note(`money: ${d.paisa}`)} />
            <label>Mobile</label>
            <JhiguPhoneInput name="phone" label="Mobile" language={lang}
              onChange={(d) => note(`phone: ${d.e164}`)} />
            <p><button type="submit">Submit form</button></p>
          </section>
        </div>
      </form>
      <h2>form data</h2>
      <pre data-testid="form">{form}</pre>
      <h2>events</h2>
      <pre data-testid="log">{log.join('\n') || '(events appear here)'}</pre>
    </>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
