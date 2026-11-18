// Arduino Caterina implements AVR109 on the USB serial port.
const pageSize = 128;
const bootStart = 0x7000;
const encoder = new TextEncoder();

export function parseFirmware(hex) {
  const image = new Uint8Array(bootStart).fill(0xff);
  let end = 0;
  let eof = false;
  for (const line of hex.trim().split(/\r?\n/)) {
    if (eof || !/^:(?:[\da-f]{2})+$/i.test(line)) throw Error('Ungültiges HEX-Format.');
    const record = Uint8Array.from(line.slice(1).match(/../g), byte => parseInt(byte, 16));
    const [count, high, low, type] = record;
    const offset = high * 256 + low;
    if (record.length !== count + 5 || record.reduce((sum, byte) => sum + byte, 0) % 256)
      throw Error('Die Firmware-Datei ist beschädigt.');
    if (type === 1 && count === 0 && offset === 0) {
      eof = true;
    } else if (type === 0 && offset + count <= bootStart) {
      image.set(record.subarray(4, 4 + count), offset);
      end = Math.max(end, offset + count);
    } else {
      throw Error('Die Firmware passt nicht in den Anwendungsbereich des Pro Micro.');
    }
  }
  if (!eof || end < 2 || (image[0] === 0xff && image[1] === 0xff))
    throw Error('Die Firmware-Datei ist unvollständig.');
  return image.slice(0, Math.ceil(end / pageSize) * pageSize);
}

export async function flashCaterina(port, image, report) {
  if (!image.length || image.length > bootStart || image.length % pageSize)
    throw Error('Ungültige Firmware-Grösse.');
  await port.open({ baudRate: 57600 });
  let reader, writer;
  try {
    reader = port.readable.getReader();
    writer = port.writable.getWriter();
    let buffered = new Uint8Array();
    async function exchange(command, length) {
      let timer;
      const reply = async () => {
        await writer.write(command);
        const result = new Uint8Array(length);
        let received = 0;
        while (received < length) {
          if (!buffered.length) {
            const { value, done } = await reader.read();
            if (done) throw Error('Die USB-Verbindung wurde getrennt.');
            buffered = value;
          }
          const count = Math.min(length - received, buffered.length);
          result.set(buffered.subarray(0, count), received);
          buffered = buffered.subarray(count);
          received += count;
        }
        return result;
      };
      try {
        return await Promise.race([reply(), new Promise((_, reject) => {
          timer = setTimeout(() => reject(Error('Der Bootloader antwortet nicht.')), 2000);
        })]);
      } finally {
        clearTimeout(timer);
      }
    }
    async function acknowledge(command) {
      const [byte] = await exchange(command, 1);
      if (byte !== 13) throw Error('Der Bootloader hat den Befehl abgelehnt.');
    }
    const identify = await exchange(encoder.encode('S'), 7);
    if (new TextDecoder().decode(identify) !== 'CATERIN')
      throw Error('Dieser USB-Port meldet keinen Caterina-Bootloader.');
    const [low, middle, high] = await exchange(encoder.encode('s'), 3);
    if (high !== 0x1e || middle !== 0x95 || low !== 0x87)
      throw Error('Der Bootloader meldet keinen ATmega32U4.');
    const [supported, sizeHigh, sizeLow] = await exchange(encoder.encode('b'), 3);
    if (supported !== 89 || sizeHigh * 256 + sizeLow !== pageSize)
      throw Error('Der Bootloader unterstützt die benötigte Flash-Seitengrösse nicht.');

    const seek = offset => acknowledge(Uint8Array.of(65, (offset / 2) >> 8, (offset / 2) & 255));
    const writePage = new Uint8Array(4 + pageSize);
    writePage.set([66, 0, pageSize, 70]); // B, byte count, flash
    await seek(0);
    for (let offset = 0; offset < image.length; offset += pageSize) {
      writePage.set(image.subarray(offset, offset + pageSize), 4);
      await acknowledge(writePage);
      report('Firmware wird geschrieben', offset + pageSize, image.length);
    }
    await seek(0);
    for (let offset = 0; offset < image.length; offset += pageSize) {
      const readback = await exchange(Uint8Array.of(103, 0, pageSize, 70), pageSize); // g
      if (readback.some((byte, index) => byte !== image[offset + index]))
        throw Error('Die Kontrolle der geschriebenen Firmware ist fehlgeschlagen.');
      report('Firmware wird geprüft', offset + pageSize, image.length);
    }
    await acknowledge(encoder.encode('E'));
  } finally {
    await Promise.allSettled([reader?.cancel(), writer?.abort()]);
    reader?.releaseLock();
    writer?.releaseLock();
    await port.close().catch(() => {});
  }
}

const runtimeFilters = [
  { usbVendorId: 0x2341, usbProductId: 0x8036 },
  { usbVendorId: 0x2a03, usbProductId: 0x8036 },
  { usbVendorId: 0x1b4f, usbProductId: 0x9204 },
  { usbVendorId: 0x1b4f, usbProductId: 0x9206 },
];
const bootFilters = [
  { usbVendorId: 0x2341, usbProductId: 0x0036 },
  { usbVendorId: 0x2a03, usbProductId: 0x0036 },
  { usbVendorId: 0x1b4f, usbProductId: 0x9203 },
  { usbVendorId: 0x1b4f, usbProductId: 0x9205 },
];
const release = './firmware/releases/pro-micro/v0.29/';

export function setupProMicroInstaller() {
  const clock = document.getElementById('proMicroClock');
  const start = document.getElementById('proMicroStart');
  const choose = document.getElementById('proMicroChoose');
  const status = document.getElementById('proMicroStatus');
  if (!window.isSecureContext || !('serial' in navigator)) {
    status.textContent = 'Für die Direktinstallation Chrome oder Edge öffnen.';
    return;
  }
  let firmware;
  let ready = false;
  function loadFirmware() {
    ready = false;
    start.disabled = choose.disabled = true;
    if (!clock.value) {
      status.textContent = 'Wähle zuerst die Ausführung deines Boards.';
      return;
    }
    const request = fetch(release + `pro-micro-${clock.value}mhz.hex`).then(response => {
      if (!response.ok) throw Error('Die Firmware konnte nicht geladen werden.');
      return response.text();
    }).then(parseFirmware);
    firmware = request;
    status.textContent = 'Firmware wird geladen …';
    request.then(() => {
      if (firmware !== request) return;
      ready = true;
      start.disabled = choose.disabled = false;
      status.textContent = 'Starte den Bootloader oder wähle einen bereits gestarteten Bootloader.';
    }).catch(error => {
      if (firmware === request) status.textContent = error.message + ' Lade die Seite neu.';
    });
  }
  clock.addEventListener('change', loadFirmware);
  loadFirmware();

  function run(action) {
    return async () => {
      clock.disabled = start.disabled = choose.disabled = true;
      try {
        await action();
      } catch (error) {
        status.textContent = error.name === 'NotFoundError'
          ? 'Kein Port ausgewählt. Falls der Bootloader verschwunden ist, starte ihn erneut.'
          : error.message;
      } finally {
        clock.disabled = false;
        start.disabled = choose.disabled = !ready;
      }
    };
  }
  function checkClock(port) {
    const { usbVendorId, usbProductId } = port.getInfo();
    if (usbVendorId !== 0x1b4f) return;
    const detected = [0x9203, 0x9204].includes(usbProductId) ? '8' : '16';
    if (clock.value !== detected) throw Error('Die gewählte Ausführung passt nicht zum erkannten Board.');
  }
  start.addEventListener('click', run(async () => {
    const port = await navigator.serial.requestPort({ filters: runtimeFilters });
    checkClock(port);
    await port.open({ baudRate: 1200 });
    try {
      await port.setSignals({ dataTerminalReady: true });
      await port.setSignals({ dataTerminalReady: false });
    } finally {
      await port.close().catch(() => {});
    }
    status.textContent = 'Klicke jetzt auf «Pro Micro installieren» und wähle den neu erschienenen Bootloader-Port.';
  }));

  choose.addEventListener('click', run(async () => {
    status.textContent = 'Wähle den Bootloader-Port. Falls er fehlt, setze den Pro Micro zweimal kurz zurück.';
    const port = await navigator.serial.requestPort({ filters: bootFilters });
    checkClock(port);
    const image = await firmware;
    status.textContent = 'Bootloader wird geprüft …';
    let lastPercent;
    await flashCaterina(port, image, (label, done, total) => {
      const percent = Math.floor(done / total * 100);
      const message = `${label} · ${percent} %`;
      if (message !== lastPercent) status.textContent = lastPercent = message;
    });
    status.textContent = 'Firmware installiert und geprüft. Der Pro Micro startet neu.';
  }));
}
