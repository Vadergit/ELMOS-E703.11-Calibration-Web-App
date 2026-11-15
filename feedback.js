// Set this to the deployed HTTPS Worker URL ending in /feedback.
const endpoint = 'https://elmos-calibration-feedback.dario-neuenschwander.workers.dev/feedback';
const form = document.querySelector('#feedback');
const fields = document.querySelector('#fields');
const status = document.querySelector('#status');
const submit = document.querySelector('#submit');
let token = '', widget;

function loadChallenge() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = false;
    script.onload = () => window.turnstile?.render ? resolve() : reject();
    script.onerror = reject;
    document.head.append(script);
  });
}

async function start() {
  if (!endpoint) {
    status.textContent = 'Der Meldedienst ist noch nicht eingerichtet.';
    return;
  }
  const response = await fetch(endpoint);
  if (!response.ok) throw Error();
  const { siteKey } = await response.json();
  await loadChallenge();
  const clear = () => { token = ''; submit.disabled = true; };
  widget = window.turnstile.render('#challenge', {
    sitekey: siteKey, action: 'feedback',
    callback: value => { token = value; submit.disabled = false; },
    'expired-callback': clear,
    'error-callback': clear,
  });
  fields.disabled = false;
  status.textContent = '';
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!token || fields.disabled) return;
  const data = new FormData(form);
  const images = data.getAll('images').filter(file => file.size);
  if (images.length > 3 || images.some(image => image.size > 2 * 1024 * 1024)) {
    status.textContent = 'Wähle höchstens 3 Bilder zu je maximal 2 MB.';
    return;
  }
  data.delete('images');
  for (const image of images) data.append('images', image);
  data.set('token', token);
  data.set('version', new URLSearchParams(location.search).get('version') || '');
  fields.disabled = true;
  status.textContent = 'Meldung wird gesendet …';
  try {
    const response = await fetch(endpoint, { method: 'POST', body: data });
    const message = await response.json();
    if (!response.ok) throw Error({
      rate: 'Bitte warte kurz und versuche es nochmals.',
      size: 'Wähle höchstens 3 Bilder zu je maximal 2 MB.',
      type: 'Als Screenshots sind PNG und JPG erlaubt.',
      attachment: 'GitHub konnte den Screenshot nicht annehmen. Du kannst es nochmals oder ohne Bild versuchen.',
      form: 'Prüfe Titel, Beschreibung und die Bestätigung zur Veröffentlichung.',
      challenge: 'Bitte wiederhole den Spamschutz.',
    }[message.code] || 'Die Meldung konnte nicht bestätigt werden.');
    if (!/^https:\/\/github\.com\/Vadergit\/ELMOS-E703\.11-Calibration-Web-App\/issues\/\d+$/.test(message.url))
      throw Error('Der Link zur Meldung konnte nicht bestätigt werden.');
    document.querySelector('#issue').href = message.url;
    document.querySelector('#result').hidden = false;
    form.hidden = true;
    status.textContent = 'Deine Meldung wurde veröffentlicht.';
  } catch (error) {
    status.textContent = error.message;
    fields.disabled = false;
    token = '';
    submit.disabled = true;
    window.turnstile.reset(widget);
  }
});

start().catch(() => { status.textContent = 'Der Meldedienst ist gerade nicht erreichbar.'; });
