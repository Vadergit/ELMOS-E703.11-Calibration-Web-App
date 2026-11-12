'use strict';

const ELMOS_DEMO = {
 create(protocol, calibration, readStimulus) {
  const bootRegisters = [[16, 4], [17, 6], [18, 8], [19, 10], [20, 12], [22, 16]];
  const nvm = Array(64).fill(0);
  nvm[0] = 0xDE01;
  nvm[1] = 0x600D;
  nvm[16] = 0x0200;
  nvm[17] = 4;
  nvm[19] = 0x0980;
  nvm[15] = calibration.crc8(nvm) << 8;
  nvm[63] = calibration.crc16(nvm);

  const ram = new Map([[0x1A, 0x0C40], [0x1C, 0x0800], [0x38, 0x0703], [0x50, nvm[0]], [0x52, nvm[1]]]);
  let opened = false;
  let readback = 0;
  let pendingWord = 0;
  let writeEnabled = false;
  let pressure;
  let temperature = 25;
  const word = value => Math.max(-32768, Math.min(32767, Math.round(value))) & 0xFFFF;

  function reboot() {
   for (const [index, address] of bootRegisters) ram.set(address, nvm[index]);
   writeEnabled = false;
  }
  reboot();

  function read(address) {
   const {lower, upper, limit} = readStimulus();
   const span = upper - lower;
   const fraction = span > 0 ? ((pressure ?? (lower + upper) / 2) - lower) / span : 0.5;
   const gain = protocol.decAFE(ram.get(0x1C));
   switch (address) {
    case 0x26:
    case 0x28:
    case 0x2E: return word(387.88 * temperature - 16485);
    case 0x2A: return word((fraction - 0.5) * 20000 * (1 + gain.pga1 * 0.25 + gain.pga2 * 0.12) + gain.offset * 750);
    case 0x30: return word((2 * fraction - 1) * limit);
    case 0x46: return writeEnabled ? 8 : 0;
    case 0x48: return readback;
    default: return ram.get(address) ?? 0;
   }
  }

  function write(address, value) {
   if (address === 0x4A) {
    pendingWord = value;
   } else if (address === 0x4E) {
    const index = (value & 0xFF) >> 1;
    if ((value >> 8) === 0x4C && index < 64) readback = nvm[index];
    else if ((value >> 8) === 0xA3 && index >= 16 && index < 64 && writeEnabled) nvm[index] = pendingWord;
    else if (value === 0x36D8) writeEnabled = true;
    else if (value === 0) writeEnabled = false;
   } else {
    ram.set(address, value);
   }
  }

  return {
   async open() { opened = true; },
   async close() { opened = false; },
   setReference(value, temp = temperature) { pressure = value; temperature = temp; },
   reboot,
   exchange(command) {
    if (!opened) throw Error('Demo-Verbindung ist geschlossen');
    const reply = value => value + '\r\n:\r\n';
    if (command === '.VERSION') return reply('ELMOS Demo');
    if (['IF_CFG 7 0 0', 'PLC P', 'PLC T'].includes(command)) return reply('# OK');
    const frame = /^PLC 02(6[CD])([0-9A-F]{2})([0-9A-F]{2})(\.|[0-9A-F]{6})$/.exec(command);
    if (!frame) throw Error('Unbekannter Demo-Befehl: ' + command);
    const address = parseInt(frame[2], 16);
    if (frame[1] === '6D') {
     const value = read(address);
     const bytes = [value >> 8, value & 0xFF];
     const crc = protocol.crc8PLC([address, parseInt(frame[3],16), 2, ...bytes]);
     return reply([...bytes, crc].map(byte => protocol.hx(byte)).join(' '));
    }
    write(address, parseInt(frame[4].slice(0, 4), 16));
    return reply('# OK');
   }
  };
 }
};
