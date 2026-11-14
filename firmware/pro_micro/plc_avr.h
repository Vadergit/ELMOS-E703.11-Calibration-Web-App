#pragma once
#include <Arduino.h>
#include <util/atomic.h>

namespace plc {
// ATmega32U4 Pro Micro / Leonardo mapping: D4=PD4, D5=PC6, D6=PD7.
constexpr uint8_t Tx = _BV(PD4);
constexpr uint8_t Enable = _BV(PC6);
constexpr uint8_t Rx = _BV(PD7);

constexpr uint8_t Preamble = 0x02;
constexpr uint8_t ReadAddress = 0x6D;
constexpr size_t ReplyBits = 32;

constexpr uint8_t crc(uint8_t state, uint8_t byte, unsigned bits, unsigned width, uint8_t polynomial) {
  for (unsigned i = 0; i < bits; ++i) {
    const bool feedback = ((state >> (width - 1)) ^ (byte >> (7 - i))) & 1;
    state = (state << 1) ^ (feedback ? polynomial : 0);
  }
  return state & ((1u << width) - 1);
}

constexpr uint8_t readHeader(uint8_t address, uint8_t slave = ReadAddress) {
  return crc(crc(crc(0x0F, slave, 8, 4, 0x03), address, 8, 4, 0x03), 0, 4, 4, 0x03);
}

constexpr uint8_t replyCrc(uint8_t address, uint8_t header, const uint8_t (&reply)[4]) {
  uint8_t state = crc(0xF3, address, 8, 8, 0x07);
  state = crc(state, header, 8, 8, 0x07);
  for (unsigned i = 0; i < 3; ++i) state = crc(state, reply[i], 8, 8, 0x07);
  return state;
}

// Validate the request and reply against the datasheet random-read example.
constexpr uint8_t ExampleReply[] = {0x02, 0x12, 0x34, 0x65};
static_assert(readHeader(0x6A) == 0x0A);
static_assert(replyCrc(0x6A, readHeader(0x6A), ExampleReply) == ExampleReply[3]);

struct Edge {
  uint16_t time;
  bool high;
};

inline bool decode(const Edge *edges, size_t count, uint32_t bitTime, uint8_t address,
                   uint8_t header, uint8_t (&reply)[4], bool &badCrc) {
  // The first six zero bits provide six rising midpoint edges.
  const uint32_t tolerance = bitTime / 4;
  for (size_t start = 0; start < count; ++start) {
    if (!edges[start].high) continue;
    // The first six rising midpoints are spaced one sensor bit apart.
    // Recover the sensor's actual clock from this run, rather than assuming
    // the master and sensor use exactly the same oscillator frequency.
    uint16_t last = edges[start].time;
    size_t sync = start + 1;
    unsigned intervals = 0;
    for (; sync < count && intervals < 5; ++sync) {
      if (!edges[sync].high) continue;
      const uint16_t spacing = edges[sync].time - last;
      if (spacing < bitTime - tolerance || spacing > bitTime + tolerance) break;
      last = edges[sync].time;
      ++intervals;
    }
    if (intervals != 5) continue;
    const uint32_t recoveredBitTime = (uint16_t(last - edges[start].time) + 2) / 5;
    memset(reply, 0, sizeof(reply));
    size_t index = start;
    uint16_t expected = edges[start].time;
    unsigned bit = 0;
    for (; bit < ReplyBits; ++bit) {
      while (index < count && static_cast<int16_t>(edges[index].time - expected) <
                                     -static_cast<int16_t>(tolerance)) ++index;
      if (index == count || static_cast<int16_t>(edges[index].time - expected) >
                                static_cast<int16_t>(tolerance)) break;
      reply[bit / 8] = (reply[bit / 8] << 1) | !edges[index].high;
      expected = edges[index++].time + recoveredBitTime;
      if (bit == 7 && reply[0] != Preamble) break;
    }
    if (bit == ReplyBits) {
      if (replyCrc(address, header, reply) == reply[3]) return true;
      badCrc = true;
    }
  }
  return false;
}


inline void configurePins() {
  PORTC &= ~Enable;
  DDRC |= Enable;
  PORTD &= ~(Tx | Rx);
  DDRD = (DDRD | Tx) & ~Rx;
  // Timer1 is dedicated to PLC, with one tick per CPU cycle.
  TCCR1A = 0;
  TCCR1B = _BV(CS10);
}

inline void waitUntil(uint16_t deadline) {
  while (int16_t(TCNT1 - deadline) < 0) {}
}

inline void txLevel(bool high) {
  if (high) PORTD |= Tx;
  else PORTD &= ~Tx;
}

inline size_t transfer(const uint8_t *request, size_t length, uint32_t baud,
                       Edge *edges, size_t capacity, bool startup = false, bool shortGap = false,
                       bool *rxStart = nullptr, uint8_t *txEcho = nullptr) {
  const uint16_t half = F_CPU / baud;
  const uint16_t bitTime = 2 * half;
  size_t count = 0;
  txLevel(false);
  PORTC |= Enable;
  if (startup) {
    digitalWrite(7, HIGH);
    delayMicroseconds(500);
  } else {
    delayMicroseconds(shortGap ? 10 * (1000000UL / baud) : 3500);
  }
  ATOMIC_BLOCK(ATOMIC_RESTORESTATE) {
    uint16_t next = TCNT1;
    for (size_t i = 0; i < length; ++i) {
      for (uint8_t mask = 0x80; mask; mask >>= 1) {
        const bool one = request[i] & mask;
        txLevel(one);
        next += half;
        waitUntil(next);
        txLevel(!one);
        next += half;
        waitUntil(next);
      }
    }
    txLevel(true);
    waitUntil(next + half);
    PORTC &= ~Enable;
    bool last = PIND & Rx;
    if (rxStart) *rxStart = last;
    if (txEcho) *txEcho = 0;
    const uint16_t captureTicks = 48 * bitTime;
    while (count < capacity) {
      const bool high = PIND & Rx;
      const uint16_t now = TCNT1;
      if (uint16_t(now - next) >= captureTicks) break;
      if (high != last) {
        edges[count++] = {now, high};
        last = high;
      }
    }
  }
  return count;
}

constexpr uint8_t writeCrc(uint8_t address, uint8_t header, uint8_t high, uint8_t low) {
  uint8_t state = crc(0xF3, address, 8, 8, 0x07);
  state = crc(state, header, 8, 8, 0x07);
  state = crc(state, high, 8, 8, 0x07);
  return crc(state, low, 8, 8, 0x07);
}

static_assert(writeCrc(0x6A, 0x0A, 0x67, 0x89) == 0x5F);

inline void writeWord(uint8_t address, uint16_t word, uint32_t baud, bool startup = false, bool shortGap = false, uint8_t slave = ReadAddress) {
  const uint8_t header = readHeader(address, slave);
  const uint8_t high = word >> 8;
  const uint8_t low = word & 0xFF;
  const uint8_t request[] = {Preamble, static_cast<uint8_t>(slave & 0xFE), address, header, high, low,
                             writeCrc(address, header, high, low)};
  transfer(request, sizeof(request), baud, nullptr, 0, startup, shortGap);
}

// PSSC 3.2.1 trace: 02 FE 06 07 6C 04 4E. Do not expose generic broadcast writes.
constexpr uint8_t PsscRamAccess[] = {0x02, 0xFE, 0x06, 0x07, 0x6C, 0x04, 0x4E};
static_assert(writeCrc(0x06, 0x07, 0x6C, 0x04) == 0x4E);

inline void enableAccess(uint32_t baud, bool powerCycle, bool recover, uint8_t slave = ReadAddress) {
  if (powerCycle) {
    digitalWrite(7, LOW);
    pinMode(7, OUTPUT);
    delay(100);
  }
  writeWord(0xAC, 0x2B42, baud, powerCycle, false, slave);
  // During a cold start the first preamble has already established the bit rate.
  // The second frame still needs a gap, but must fit inside the 4 ms window.
  writeWord(0x0E, 0x5CFD, baud, false, powerCycle, slave);
  if (recover) transfer(PsscRamAccess, sizeof(PsscRamAccess), baud, nullptr, 0, false, powerCycle);
}

inline const char *readWord(uint8_t address, uint32_t baud, uint16_t &word, uint8_t *checksum = nullptr, uint8_t slave = ReadAddress,
                            size_t *rxEdges = nullptr, bool *rxStart = nullptr,
                            uint8_t *txEcho = nullptr) {
  const uint8_t header = readHeader(address, slave);
  const uint8_t request[] = {Preamble, slave, address, header};
  Edge edges[80];
  const size_t count = transfer(request, sizeof(request), baud, edges, 80, false, false, rxStart, txEcho);
  if (rxEdges) *rxEdges = count;
  const uint32_t bitTime = 2 * (F_CPU / baud);
  uint8_t reply[4];
  bool badCrc = false;
  if (!decode(edges, count, bitTime, address, header, reply, badCrc))
    return badCrc ? "!BRIDGE PLC_BAD_CRC" : "!BRIDGE PLC_NO_VALID_FRAME";
  if (checksum) *checksum = reply[3];
  word = (static_cast<uint16_t>(reply[1]) << 8) | reply[2];
  return nullptr;
}

} // namespace plc
