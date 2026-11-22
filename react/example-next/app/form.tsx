'use client';

import { useState } from 'react';
import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
import cal from 'jhigu-patro-utils-ts/nepali_calendar_data.json';
import { JhiguDatePicker, JhiguMoneyInput, JhiguPhoneInput, JhiguCalendar, JhiguAddressSelect } from 'jhigu-patro-react';

// Runs on the server (during prerender) and in the browser: the data is bundled, so no fetch is needed.
initializeCalendar(new InlineCalendarDataSource(
  cal.years as unknown as Record<string, number[]>, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough,
));

export default function Form() {
  const [dob, setDob] = useState('2082-05-12');
  const [out, setOut] = useState('(not submitted)');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setOut(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))));
      }}
    >
      <JhiguDatePicker name="dob" value={dob} today="2082-05-10" required onChange={(d) => setDob(d.bs)} />
      <JhiguCalendar year={2082} month={5} today="2082-05-10" />
      <JhiguAddressSelect name="addr" />
      <JhiguMoneyInput name="amount" symbol="Rs." label="Amount" />
      <JhiguPhoneInput name="phone" label="Mobile" />
      <p><button type="submit" data-testid="submit">Submit</button></p>
      <pre data-testid="out">{out}</pre>
      <p data-testid="dob">{dob}</p>
    </form>
  );
}
