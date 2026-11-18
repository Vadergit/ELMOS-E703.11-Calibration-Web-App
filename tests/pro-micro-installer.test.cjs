const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'pro-micro-installer.js'));
const installer = import('data:text/javascript;base64,' + js.toString('base64'));
const variant = mhz => fs.readFileSync(path.join(root,
  `firmware/releases/pro-micro/v0.29/pro-micro-${mhz}mhz.hex`), 'ascii');

function caterina({ signature = [0x87, 0x95, 0x1e], corrupt = false } = {}) {
  const flash = new Uint8Array(0x7000).fill(0xff);
  const commands = [];
  let position = 0, controller, closed = false;
  return {
    flash, commands,
    get closed() { return closed; },
    readable: new ReadableStream({ start(stream) { controller = stream; } }),
    writable: new WritableStream({
      write(packet) {
        const command = String.fromCharCode(packet[0]);
        commands.push(command);
        let bytes = [13];
        if (command === 'S') bytes = Buffer.from('CATERIN');
        else if (command === 's') bytes = signature;
        else if (command === 'b') bytes = [89, 0, 128];
        else if (command === 'A') position = (packet[1] * 256 + packet[2]) * 2;
        else if (command === 'B' || command === 'g') {
          assert.deepEqual(Array.from(packet.slice(1, 4)), [0, 128, 70]);
          assert.equal(position % 128, 0);
          assert.ok(position + 128 <= flash.length);
          if (command === 'B') flash.set(packet.slice(4), position);
          else {
            bytes = flash.slice(position, position + 128);
            if (corrupt) bytes[0] ^= 1;
          }
          position += 128;
        } else assert.equal(command, 'E');
        const reply = Uint8Array.from(bytes);
        // Serial reads may split a reply in the middle of any block.
        controller.enqueue(reply.slice(0, 1));
        if (reply.length > 1) controller.enqueue(reply.slice(1));
      },
    }),
    async open(options) { assert.equal(options.baudRate, 57600); },
    async close() { closed = true; },
  };
}

test('both published Pro Micro variants fit in application flash', async () => {
  const { parseFirmware } = await installer;
  const images = [8, 16].map(mhz => parseFirmware(variant(mhz)));
  for (const image of images) {
    assert.ok(image.length <= 0x7000);
    assert.equal(image.length % 128, 0);
  }
  assert.notDeepEqual(...images);
  assert.throws(() => parseFirmware(variant(16).replace(/:[\da-f]/i, ':F')), /beschädigt/);
});

test('installer writes flash pages, verifies readback, then tells Caterina to exit', async () => {
  const { flashCaterina, parseFirmware } = await installer;
  const image = parseFirmware(variant(16));
  const port = caterina();
  await flashCaterina(port, image, () => {});
  assert.deepEqual(port.flash.slice(0, image.length), image);
  assert.equal(port.commands.at(-1), 'E');
  assert.equal(port.closed, true);
});

test('installer rejects the wrong MCU before writing and refuses to report success on bad readback', async () => {
  const { flashCaterina, parseFirmware } = await installer;
  const image = parseFirmware(variant(8));
  const wrongPart = caterina({ signature: [0x0f, 0x95, 0x1e] });
  await assert.rejects(flashCaterina(wrongPart, image, () => {}), /ATmega32U4/);
  assert.equal(wrongPart.commands.includes('B'), false);
  assert.equal(wrongPart.closed, true);
  const corrupt = caterina({ corrupt: true });
  await assert.rejects(flashCaterina(corrupt, image, () => {}), /Kontrolle/);
  assert.equal(corrupt.commands.includes('E'), false);
  assert.equal(corrupt.closed, true);
});
