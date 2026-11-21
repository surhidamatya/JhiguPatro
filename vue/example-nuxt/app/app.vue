<script setup lang="ts">
import { ref } from 'vue';
import { initializeCalendar, InlineCalendarDataSource } from 'jhigu-patro-utils-ts';
import cal from 'jhigu-patro-utils-ts/nepali_calendar_data.json';
import { JhiguDatePicker, JhiguCalendar, JhiguAddressSelect, JhiguMoneyInput, JhiguPhoneInput } from 'jhigu-patro-vue';

// Runs on the server (during the render) and in the browser: the data is bundled, so no fetch is needed.
initializeCalendar(new InlineCalendarDataSource(
  cal.years as unknown as Record<string, number[]>, cal.supportedRange.start, cal.supportedRange.end, cal.verifiedThrough,
));

const dob = ref('2082-05-12');
const out = ref('(not submitted)');
function submit(e: Event) {
  out.value = JSON.stringify(Object.fromEntries(new FormData(e.currentTarget as HTMLFormElement) as unknown as Iterable<[string, string]>));
}
</script>

<template>
  <main>
    <h1 data-testid="title">jhigu-patro-vue in Nuxt</h1>
    <form @submit.prevent="submit">
      <JhiguDatePicker name="dob" :value="dob" today="2082-05-10" required @change="(d: any) => (dob = d.bs)" />
      <JhiguCalendar :year="2082" :month="5" today="2082-05-10" />
      <JhiguAddressSelect name="addr" />
      <JhiguMoneyInput name="amount" symbol="Rs." label="Amount" />
      <JhiguPhoneInput name="phone" label="Mobile" />
      <p><button type="submit" data-testid="submit">Submit</button></p>
      <pre data-testid="out">{{ out }}</pre>
      <p data-testid="dob">{{ dob }}</p>
    </form>
  </main>
</template>
