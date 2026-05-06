const WHATSAPP_NUMBER = '212659183528';

const form = document.getElementById('bookingForm');
const statusMessage = document.getElementById('formStatus');
const dateInput = document.getElementById('date');
const hourInput = document.getElementById('timeHour');
const minuteInput = document.getElementById('timeMinute');

const firebaseConfig = {
  apiKey: "AIzaSyCs2kimiWLLgxXAKUT6pp3kUMyFrufFQOE",
  authDomain: "barber-booking-304d1.firebaseapp.com",
  databaseURL: "https://barber-booking-304d1-default-rtdb.firebaseio.com",
  projectId: "barber-booking-304d1",
  storageBucket: "barber-booking-304d1.firebasestorage.app",
  messagingSenderId: "541672823474",
  appId: "1:541672823474:web:865f5ad3d803e4c59c07ab",
  measurementId: "G-YSVRM0RKTP"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

dateInput.min = new Date().toISOString().split('T')[0];

function clean(value) {
  return String(value || '').trim();
}

function setStatus(text, isError = false) {
  statusMessage.textContent = text;
  statusMessage.classList.toggle('error', isError);
}

function formatSlotKey(date, hour, minute) {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${date}_${hh}-${mm}`;
}

function getAdjacentSlot(date, hour, minute, offsetMinutes) {
  const slotDate = new Date(`${date}T00:00:00`);
  slotDate.setHours(Number(hour), Number(minute) + offsetMinutes);
  const adjDate = slotDate.toISOString().slice(0, 10);
  const adjHour = String(slotDate.getHours()).padStart(2, '0');
  const adjMinute = String(slotDate.getMinutes()).padStart(2, '0');
  return `${adjDate}_${adjHour}-${adjMinute}`;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const name = clean(formData.get('name'));
  const phone = clean(formData.get('phone'));
  const service = clean(formData.get('service'));
  const date = clean(formData.get('date'));
  const hour = clean(formData.get('timeHour'));
  const minute = clean(formData.get('timeMinute'));
  const note = clean(formData.get('note')) || 'No additional notes.';

  const time = hour && minute ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : '';

  if (!name || !phone || !service || !date || !hour || !minute) {
    setStatus('Please complete all fields before sending.', true);
    return;
  }

  if (Number(hour) > 23 || Number(hour) < 0 || Number(minute) > 59 || Number(minute) < 0) {
    setStatus('Please enter a valid 24-hour time.', true);
    return;
  }

  const slotKey = formatSlotKey(date, hour, minute);
  const prevSlotKey = getAdjacentSlot(date, hour, minute, -30);
  const nextSlotKey = getAdjacentSlot(date, hour, minute, 30);
  const slotRef = db.ref(`slots/${slotKey}`);
  const prevSlotRef = db.ref(`slots/${prevSlotKey}`);
  const nextSlotRef = db.ref(`slots/${nextSlotKey}`);
  const appointmentRef = db.ref(`appointments/${slotKey}`);

  statusMessage.textContent = 'Checking availability...';

  Promise.all([
    slotRef.once('value'),
    prevSlotRef.once('value'),
    nextSlotRef.once('value'),
  ]).then(([slotSnap, prevSnap, nextSnap]) => {
    if (slotSnap.exists()) {
      setStatus('This time slot is already reserved. Please choose another time.', true);
      return;
    }

    if (prevSnap.exists()) {
      setStatus('This time is too close to an existing booking. Please choose another time.', true);
      return;
    }

    if (nextSnap.exists()) {
      setStatus('This time is too close to an existing booking. Please choose another time.', true);
      return;
    }

   // حفظ مباشرة بلا transaction
slotRef.set(true);

appointmentRef.set({
  name,
  phone,
  service,
  date,
  time,
  note,
  reservedAt: Date.now(),
});

const message = [
  'New barber appointment request:',
  `Name: ${name}`,
  `Phone: ${phone}`,
  `Service: ${service}`,
  `Date: ${date}`,
  `Time: ${time}`,
  `Notes: ${note}`,
].join('\n');

const whatsappUrl = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}`;

setStatus('Opening WhatsApp...', false);
window.location.href = whatsappUrl;

      nextSlotRef.transaction((currentValue) => {
        if (currentValue === null) {
          return true;
        }
        return currentValue;
      }, (error) => {
        if (error) {
          console.error('Error reserving next slot:', error);
        }

        const message = [
          'New barber appointment request:',
          `Name: ${name}`,
          `Phone: ${phone}`,
          `Service: ${service}`,
          `Date: ${date}`,
          `Time: ${time}`,
          `Notes: ${note}`,
        ].join('\n');

        const whatsappUrl = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}`;
        setStatus('Slot reserved. Opening WhatsApp in a new tab...', false);
        window.location.href = whatsappUrl;
      });
    });
  }).catch((error) => {
    setStatus('Error checking availability. Please try again.', true);
    console.error('Error:', error);
  });
});
