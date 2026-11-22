<script setup>
import { ref } from 'vue';
import {
  JhiguDatePicker, JhiguDateRangePicker, JhiguCalendar, JhiguAddressSelect, JhiguMoneyInput, JhiguPhoneInput,
} from 'jhigu-patro-vue';

const TODAY = '2082-05-10';
const log = ref([]);
const note = (s) => { log.value = [s, ...log.value].slice(0, 12); };
const lang = ref('en');
const dob = ref('2082-05-12');
const form = ref('(not submitted)');
const renders = ref(0);
const events = { '2082-05-12': ['Teej'], '2082-05-15': ['Fulpati', 'Holiday'] };
const picker = ref(null);
const brand = ref('brand');

function submit(e) {
  form.value = JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)), null, 1);
}
</script>

<template>
  <h1>jhigu-patro-vue</h1>
  <p>
    <button data-testid="lang" @click="lang = lang === 'en' ? 'ne' : 'en'">language: {{ lang }}</button>
    <button data-testid="rerender" @click="renders++">rerender ({{ renders }})</button>
    <button data-testid="setdob" @click="dob = '2082-06-02'">parent sets date to 2082-06-02</button>
    <button data-testid="restyle" @click="brand = brand === 'brand' ? 'other' : 'brand'">toggle class</button>
  </p>
  <form @submit.prevent="submit">
    <div class="row">
      <section>
        <label>Date (form field "dob", required)</label>
        <JhiguDatePicker ref="picker" name="dob" :language="lang" :value="dob" :today="TODAY" required
          :class="brand" data-testid="dp"
          @change="d => { dob = d.bs; note(`date: ${d.bs}`); }" />
      </section>
      <section>
        <label>Range (themed with a custom property)</label>
        <JhiguDateRangePicker name="stay" :language="lang" :today="TODAY"
          :style="{ '--jhigu-color-primary': '#047857' }"
          @change="d => note(`range: ${d.start} to ${d.end} (${d.days} days)`)" />
      </section>
      <section>
        <label>Calendar with events</label>
        <JhiguCalendar :language="lang" :year="2082" :month="5" :today="TODAY" :events="events"
          @select="d => note(`calendar: ${d.bs} ${JSON.stringify(d.events)}`)"
          @month-change="d => note(`month: ${d.year}-${d.month}`)" />
      </section>
    </div>
    <div class="row">
      <section>
        <label>Address</label>
        <JhiguAddressSelect name="addr" :language="lang" @change="d => note(`address: ${d.complete ? d.text : '...'}`)" />
      </section>
      <section>
        <label>Amount (Rs.)</label>
        <JhiguMoneyInput name="amount" symbol="Rs." label="Amount" :language="lang" @change="d => note(`money: ${d.paisa}`)" />
        <label>Mobile</label>
        <JhiguPhoneInput name="phone" label="Mobile" :language="lang" @change="d => note(`phone: ${d.e164}`)" />
        <p><button type="submit">Submit form</button></p>
      </section>
    </div>
  </form>
  <h2>form data</h2>
  <pre data-testid="form">{{ form }}</pre>
  <h2>events</h2>
  <pre data-testid="log">{{ log.join('\n') || '(events appear here)' }}</pre>
</template>
