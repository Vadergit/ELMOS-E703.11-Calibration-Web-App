#pragma once

#include <Arduino.h>
#include <driver/gpio.h>
#include <esp_cpu.h>
#include <esp_private/esp_clk.h>
#include <soc/gpio_struct.h>

namespace plc {

// TX and active-high OE feed an external tri-state driver.
// RX receives a 3.3 V logic signal from the AODO receiver.
constexpr gpio_num_t Tx = GPIO_NUM_4;
constexpr gpio_num_t Enable = GPIO_NUM_5;
constexpr gpio_num_t Rx = GPIO_NUM_6;
constexpr gpio_num_t Power = GPIO_NUM_7;
constexpr uint32_t TxMask = 1u << Tx;
constexpr uint32_t EnableMask = 1u << Enable;
constexpr uint32_t RxMask = 1u << Rx;
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

constexpr uint8_t readHeader(uint8_t address) {
  return crc(crc(crc(0x0F, ReadAddress, 8, 4, 0x03), address, 8, 4, 0x03), 0, 4, 4, 0x03);
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

inline void waitUntil(uint32_t deadline) {
  while (static_cast<int32_t>(esp_cpu_get_cycle_count() - deadline) < 0) {}
}

inline void txLevel(bool high) {
  if (high) GPIO.out_w1ts.val = TxMask;
  else GPIO.out_w1tc.val = TxMask;
}

struct Edge {
  uint32_t time;
  bool high;
};

inline bool decode(const Edge *edges, size_t count, uint32_t bitTime, uint8_t (&reply)[4]) {
  // The first six zero bits provide six rising midpoint edges.
  const uint32_t tolerance = bitTime / 4;
  for (size_t start = 0; start < count; ++start) {
    if (!edges[start].high) continue;
    memset(reply, 0, sizeof(reply));
    size_t index = start;
    uint32_t expected = edges[start].time;
    unsigned bit = 0;
    for (; bit < ReplyBits; ++bit) {
      while (index < count && static_cast<int32_t>(edges[index].time - expected) <
                                     -static_cast<int32_t>(tolerance)) ++index;
      if (index == count || static_cast<int32_t>(edges[index].time - expected) >
                                static_cast<int32_t>(tolerance)) break;
      reply[bit / 8] = (reply[bit / 8] << 1) | !edges[index].high;
      expected = edges[index++].time + bitTime;
      if (bit == 7 && reply[0] != Preamble) break;
    }
    if (bit == ReplyBits) return true;
  }
  return false;
}

inline void configurePins() {
  gpio_set_level(Enable, 0);
  gpio_set_level(Tx, 0);
  gpio_set_pull_mode(Rx, GPIO_FLOATING);
  gpio_set_direction(Enable, GPIO_MODE_OUTPUT);
  gpio_set_direction(Tx, GPIO_MODE_OUTPUT);
  gpio_set_direction(Rx, GPIO_MODE_INPUT);
}

inline size_t transfer(const uint8_t *request, size_t length, unsigned baud,
                       Edge *edges, size_t capacity, bool startup = false, bool shortGap = false) {
  static portMUX_TYPE timingLock = portMUX_INITIALIZER_UNLOCKED;
  const uint32_t half = esp_clk_cpu_freq() / baud;
  const uint32_t bitTime = 2 * half;
  size_t count = 0;

  // Establish a stable low IFG, including the initial autobaud gap.
  txLevel(false);
  GPIO.out_w1ts.val = EnableMask;
  if (startup) {
    gpio_set_level(Power, 1);
    delayMicroseconds(500);
  } else {
    delayMicroseconds(shortGap ? 10 * (1000000 / baud) : 3500);
  }

  portENTER_CRITICAL(&timingLock);
  uint32_t next = esp_cpu_get_cycle_count();
  for (size_t i = 0; i < length; ++i) {
    const uint8_t byte = request[i];
    for (int bit = 7; bit >= 0; --bit) {
      const bool one = byte & (1u << bit);
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
  GPIO.out_w1tc.val = EnableMask;

  bool last = GPIO.in.val & RxMask;
  const uint32_t end = next + 42 * bitTime;
  while (count < capacity) {
    const uint32_t now = esp_cpu_get_cycle_count();
    if (static_cast<int32_t>(now - end) >= 0) break;
    const bool high = GPIO.in.val & RxMask;
    if (high != last) {
      edges[count++] = {now, high};
      last = high;
    }
  }
  portEXIT_CRITICAL(&timingLock);

  return count;
}

constexpr uint8_t writeCrc(uint8_t address, uint8_t header, uint8_t high, uint8_t low) {
  uint8_t state = crc(0xF3, address, 8, 8, 0x07);
  state = crc(state, header, 8, 8, 0x07);
  state = crc(state, high, 8, 8, 0x07);
  return crc(state, low, 8, 8, 0x07);
}

static_assert(writeCrc(0x6A, 0x0A, 0x67, 0x89) == 0x5F);

inline void writeWord(uint8_t address, uint16_t word, unsigned baud, bool startup = false, bool shortGap = false) {
  const uint8_t header = readHeader(address);
  const uint8_t high = word >> 8;
  const uint8_t low = word & 0xFF;
  const uint8_t request[] = {Preamble, ReadAddress & 0xFE, address, header, high, low,
                             writeCrc(address, header, high, low)};
  transfer(request, sizeof(request), baud, nullptr, 0, startup, shortGap);
}

inline void enableAccess(unsigned baud, bool powerCycle) {
  if (powerCycle) {
    gpio_set_level(Power, 0);
    gpio_set_direction(Power, GPIO_MODE_OUTPUT);
    delay(100);
  }
  writeWord(0xAC, 0x2B42, baud, powerCycle);
  // During a cold start the first preamble has already established the bit rate.
  // The second frame still needs a gap, but must fit inside the 4 ms window.
  writeWord(0x0E, 0x5CFD, baud, false, powerCycle);
}

inline const char *readWord(uint8_t address, unsigned baud, uint16_t &word, uint8_t *checksum = nullptr) {
  const uint8_t header = readHeader(address);
  const uint8_t request[] = {Preamble, ReadAddress, address, header};
  Edge edges[80];
  const size_t count = transfer(request, sizeof(request), baud, edges, 80);
  const uint32_t bitTime = 2 * (esp_clk_cpu_freq() / baud);
  uint8_t reply[4];
  if (!decode(edges, count, bitTime, reply)) return "!BRIDGE PLC_NO_VALID_FRAME";
  if (replyCrc(address, header, reply) != reply[3]) return "!BRIDGE PLC_BAD_CRC";
  if (checksum) *checksum = reply[3];
  word = (static_cast<uint16_t>(reply[1]) << 8) | reply[2];
  return nullptr;
}

} // namespace plc
