// ATmega32U4 test bridge with CRC-checked register reads and volatile PLC startup.
#include <Arduino.h>
#include <string.h>
#include "plc_avr.h"
#include <ElmosI2c.h>

#if !defined(__AVR_ATmega32U4__)
#error "Select an ATmega32U4 board with the matching CPU clock."
#endif

static char lineBuffer[96];
static size_t lineLength = 0;
static uint32_t plcBaud = 100000;
static uint8_t activeSlave = plc::ReadAddress;
static bool recoveryUsed = false;

static void answer(const char *message) {
  // Same line-terminator as the existing SSP3-oriented Web Serial parser.
  // Let USB Serial/JTAG service frames after PLC bit timing masked interrupts.
  delay(2);
  Serial.print(message);
  Serial.print("\r\n:\r\n");
}

static void answer(const __FlashStringHelper *message) {
  delay(2);
  Serial.print(message);
  Serial.print(F("\r\n:\r\n"));
}

static void printUid(uint32_t baud) {
  constexpr uint8_t addresses[] = {0x38, 0x52, 0x50};
  uint16_t words[3];
  for (unsigned i = 0; i < 3; ++i) {
    if (const char *error = plc::readWord(addresses[i], baud, words[i], nullptr, activeSlave)) {
      answer(error);
      return;
    }
  }
  char response[32];
  snprintf(response, sizeof(response), "# E70311 UID=%04X%04X%04X",
           unsigned(words[0]), unsigned(words[1]), unsigned(words[2]));
  answer(response);
}

static int hexDigit(char ch) {
  if (ch >= '0' && ch <= '9') return ch - '0';
  if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
  return -1;
}

static bool nvmArmed = false;
static bool i2cMode = false;
static bool nvmUserIdOnly = false;
static bool nvmHostMode = false;
static bool nvmDataPending = false;
static bool coldStartVerified = false;
static uint32_t nvmArmedAt = 0;
static uint32_t nvmLastCommandAt = 0;
static void disarmNvm() {
  nvmArmed = false;
  nvmUserIdOnly = false;
  nvmHostMode = false;
  nvmDataPending = false;
}
static bool nvmSessionActive() {
  if (!nvmArmed) return false;
  const uint32_t now = millis();
  if (now - nvmLastCommandAt > 20000UL || now - nvmArmedAt > 180000UL) {
    disarmNvm();
    return false;
  }
  nvmLastCommandAt = now;
  return true;
}
static void armNvmSession() {
  nvmArmed = true;
  nvmArmedAt = nvmLastCommandAt = millis();
}

static void plcFrame(const char *hex) {
  const size_t length = strlen(hex);
  const bool read = length == 9 && hex[8] == '.';
  if (!read && length != 14) {
    answer(F("!BRIDGE PLC_BAD_LENGTH"));
    return;
  }
  uint8_t frame[7];
  for (size_t i = 0; i < length / 2; ++i) {
    const int high = hexDigit(hex[2 * i]), low = hexDigit(hex[2 * i + 1]);
    if (high < 0 || low < 0) {
      answer(F("!BRIDGE PLC_BAD_HEX"));
      return;
    }
    frame[i] = (high << 4) | low;
  }
  const uint8_t address = frame[2], header = frame[3];
  const uint8_t slave = frame[1] | 1;
  if (frame[0] != plc::Preamble || (frame[1] & 1) != read ||
      (slave != 0x6D && slave != 0x7D) || (address & 1) ||
      header != plc::readHeader(address, slave)) {
    answer(F("!BRIDGE PLC_BAD_HEADER"));
    return;
  }
  if (read) {
    uint16_t word;
    uint8_t checksum;
    if (const char *error = plc::readWord(address, plcBaud, word, &checksum, slave)) {
      answer(error);
      return;
    }
    char response[9];
    snprintf(response, sizeof(response), "%02X %02X %02X",
             unsigned(word >> 8), unsigned(word & 0xFF), unsigned(checksum));
    answer(response);
    return;
  }
  const uint16_t word = (uint16_t(frame[4]) << 8) | frame[5];
  if (frame[6] != plc::writeCrc(address, header, frame[4], frame[5])) {
    answer(F("!BRIDGE PLC_BAD_CRC"));
    return;
  }
  // Any aligned RAM word may be sent. NVM controls remain session gated.
  const bool readNvm = address == 0x4E && (word & 0xFF81) == 0x4C00;
  const bool ramLock = address == 0x4E && word == 0x0000;
  const bool program = address == 0x4E && (word & 0xFF81) == 0xA300;
  const uint8_t nvmIndex = (word & 0xFF) >> 1;
  const bool legacyProgram = nvmIndex == 28 || (nvmIndex >= 30 && nvmIndex <= 54) || nvmIndex == 63;
  const bool hostProgram = nvmHostMode && nvmDataPending && nvmIndex >= 16 && nvmIndex <= 63;
  const bool programAllowed = program && nvmSessionActive() &&
    (nvmHostMode ? hostProgram : legacyProgram && (!nvmUserIdOnly || nvmIndex == 30 || nvmIndex == 63));
  const bool maintenance = address == 0x4E &&
     (word == 0x98BD || word == 0x25BF || word == 0x36D8 || word == 0x8800);
  const bool writeAllowed = address == 0x4A ? nvmSessionActive() :
    address == 0x4E ? (readNvm || ramLock || programAllowed ||
      (maintenance && nvmSessionActive())) : true;
  if (slave != activeSlave || !writeAllowed) {
    answer(F("!BRIDGE PLC_WRITE_DENIED"));
    return;
  }
  plc::writeWord(address, word, plcBaud, false, false, slave);
  if (nvmHostMode && address == 0x4A) nvmDataPending = true;
  if (nvmHostMode && program) nvmDataPending = false;
  answer(F("# PLC FRAME SENT"));
}

static const char *probe(uint8_t slave) {
  uint16_t afe, adc, cfg, pads;
  if (const char *e = plc::readWord(0x1C, plcBaud, afe, nullptr, slave)) return e;
  if (!afe) return "!BRIDGE PLC_NO_VALID_FRAME";
  if (const char *e = plc::readWord(0x2A, plcBaud, adc, nullptr, slave)) return e;
  if (const char *e = plc::readWord(0x06, plcBaud, cfg, nullptr, slave)) return e;
  if (const char *e = plc::readWord(0x0A, plcBaud, pads, nullptr, slave)) return e;
  const uint8_t configured = ((cfg >> 8) & 0x7E) | ((pads & 0x1000) ? 0x80 : 0) | 1;
  if (configured != slave) return "!BRIDGE PLC_ADDRESS_MISMATCH";
  activeSlave = slave;
  return nullptr;
}

static const char *probeAddresses() {
  const char *error = probe(activeSlave);
  if (error && strcmp(error, "!BRIDGE PLC_NO_VALID_FRAME") == 0)
    error = probe(activeSlave == 0x6D ? 0x7D : 0x6D);
  return error;
}

// Decoded from a successful SSP3 cold-start capture on AODO.
static constexpr uint8_t startupFirst[] = {0x02, 0xFE, 0xAC, 0x1C, 0x2B, 0x42, 0x86};
static constexpr uint8_t startupSecond[] = {0x02, 0xFE, 0x0E, 0x1A, 0x5C, 0xFD, 0xD5};
static constexpr uint32_t ssp3Rate = 187500;

static bool startLikeSsp3(bool recover) {
  constexpr uint16_t delays[] = {650, 1000, 350, 1500};
  const uint32_t requestedRate = plcBaud;
  for (const uint16_t gap : delays) {
    digitalWrite(7, LOW);
    pinMode(7, OUTPUT);
    delay(100);
    plc::transfer(startupFirst, sizeof(startupFirst), ssp3Rate, nullptr, 0,
                  true, false, nullptr, nullptr, gap, nullptr, true);
    plc::transfer(startupSecond, sizeof(startupSecond), ssp3Rate, nullptr, 0,
                  false, true, nullptr, nullptr, 500, nullptr, false, 14);
    plcBaud = ssp3Rate;
    if (recover) {
      recoveryUsed = true;
      plc::transfer(plc::PsscRamAccess, sizeof(plc::PsscRamAccess), ssp3Rate,
                    nullptr, 0, false, true);
      if (!probe(0x6D)) return true;
    } else if (!probeAddresses()) {
      return true;
    }
  }
  plcBaud = requestedRate;
  return false;
}

static const char *openPlcAccess(bool powerCycle, bool recover = false) {
  const char *error = nullptr;
  if (powerCycle && startLikeSsp3(recover)) {
    // The captured SSP3 sequence returned valid register data.
  } else if (recover) {
    // Mark the session before attempting the write, including on a lost reply.
    recoveryUsed = true;
    plc::enableAccess(plcBaud, powerCycle, true);
    error = probe(0x6D);
    if (powerCycle) {
      // The power-up delay depends on the board and on the VDD rise time.
      const uint16_t startupDelays[] = {0, 100, 500, 1200, 2200};
      for (uint16_t startupDelay : startupDelays) {
        if (!error || strcmp(error, "!BRIDGE PLC_NO_VALID_FRAME") != 0) break;
        plc::recoverAtPowerOn(plcBaud, startupDelay);
        error = probe(0x6D);
      }
    }
  } else {
    if (powerCycle) plc::enableAccess(plcBaud, true, false);
    error = probeAddresses();
    if (error && strcmp(error, "!BRIDGE PLC_NO_VALID_FRAME") == 0) {
      plc::enableAccess(plcBaud, false, false, 0x6D);
      error = probe(0x6D);
      if (error && strcmp(error, "!BRIDGE PLC_NO_VALID_FRAME") == 0) {
        plc::enableAccess(plcBaud, powerCycle, false, 0x7D);
        error = probe(0x7D);
      }
    }
  }
  return error;
}

static void establishAccess(bool powerCycle, bool recover = false) {
  if (powerCycle || recover) { disarmNvm(); coldStartVerified = false; }
  if (const char *error = openPlcAccess(powerCycle, recover)) {
    answer(error);
    return;
  }
  if (powerCycle) coldStartVerified = true;
  char response[40];
  snprintf(response, sizeof(response), "# PLC ACCESS ADDR=%02X RAM_RECOVERY=%u",
           unsigned(activeSlave & 0xFE), unsigned(recoveryUsed));
  answer(response);
}

static void diagnoseRx() {
  for (uint8_t slave = 0x6D; slave <= 0x7D; slave += 0x10) {
    uint16_t word = 0;
    size_t edges = 0;
    bool initial = false;
    uint8_t echo = 0;
    uint16_t firstEdgeTicks = 0;
    const char *error = plc::readWord(0x1C, plcBaud, word, nullptr, slave, &edges, &initial, &echo, &firstEdgeTicks);
    char response[120];
    snprintf(response, sizeof(response), "# RX ADDR=%02X D%u=%u ECHO=%s EDGES=%u FIRST_US=%u RESULT=%s",
             unsigned(slave & 0xFE), plc::singlePin ? 4u : 6u, unsigned(initial),
             echo == 3 ? "BOTH" : echo == 2 ? "HIGH" : "LOW",
             unsigned(edges), unsigned(firstEdgeTicks / (F_CPU / 1000000UL)), error ? error + 8 : "CRC_OK");
    Serial.println(response);
  }
  Serial.print(":\r\n");
}

// Bench test for a sensor configured with a fixed PLC rate. Only the
// documented RAM-access cookies and CRC-checked register reads are sent.
static void testColdStart() {
  constexpr uint32_t rates[] = {100000, 25000, 200000};
  constexpr uint16_t delays[] = {350, 800, 1600};
  constexpr uint8_t slaves[] = {0x6D, 0x7D};
  for (uint32_t rate : rates) {
    for (uint8_t slave : slaves) {
      for (uint16_t startupDelay : delays) {
        digitalWrite(7, LOW);
        pinMode(7, OUTPUT);
        delay(100);
        uint16_t earlyVersion = 0;
        size_t earlyEdges = 0;
        const char *earlyError = plc::readWord(0x38, rate, earlyVersion, nullptr, slave,
                                               &earlyEdges, nullptr, nullptr, nullptr, false, true, startupDelay);
        if (!earlyError) {
          plc::writeWord(0xAC, 0x2B42, rate, false, true, slave);
          plc::writeWord(0x0E, 0x5CFD, rate, false, true, slave);
        } else {
          plc::enableAccess(rate, true, false, slave, startupDelay);
        }
        uint16_t version;
        const char *error = plc::readWord(0x38, rate, version, nullptr, slave, nullptr, nullptr, nullptr, nullptr, true);
        if (earlyEdges >= 8 || !earlyError) {
          Serial.print("# EARLY ");
          Serial.print(rate);
          Serial.print(" EDGES=");
          Serial.println(earlyEdges);
        }
        if (!error && version != 0 && version != 0xFFFF) {
          plcBaud = rate;
          activeSlave = slave;
          char response[70];
          snprintf(response, sizeof(response), "# PLC COLD %lu ADDR=%02X DELAY=%u VERSION=%04X",
                   (unsigned long)rate, unsigned(slave & 0xFE), unsigned(startupDelay), unsigned(version));
          answer(response);
          return;
        }
      }
    }
  }
  // PSSC may switch the volatile address before the access cookies.
  // At 100 and 200 kBd all three frames fit in the shortest startup window.
  for (uint32_t rate : rates) {
    if (rate == 25000) continue;
    for (uint16_t startupDelay : delays) {
      plc::recoverAtPowerOn(rate, startupDelay);
      plc::writeWord(0xAC, 0x2B42, rate, false, true, plc::ReadAddress);
      plc::writeWord(0x0E, 0x5CFD, rate, false, true, plc::ReadAddress);
      uint16_t version;
      if (!plc::readWord(0x38, rate, version) && version && version != 0xFFFF) {
        plcBaud = rate;
        activeSlave = plc::ReadAddress;
        recoveryUsed = true;
        printUid(rate);
        return;
      }
    }
  }
  // Replay the order observed from PSSC, including its initial wake read.
  constexpr uint8_t wakeRead[] = {0x02, 0x01, 0x00, 0x0A};
  constexpr uint16_t wakeDelays[] = {300, 600, 900, 1500, 2200};
  for (uint16_t wakeDelay : wakeDelays) {
    digitalWrite(7, LOW);
    pinMode(7, OUTPUT);
    delay(100);
    plc::transfer(wakeRead, sizeof(wakeRead), 100000, nullptr, 0,
                  true, false, nullptr, nullptr, wakeDelay, nullptr, true);
    plc::transfer(plc::PsscRamAccess, sizeof(plc::PsscRamAccess), 100000, nullptr, 0,
                  false, true);
    uint16_t version = 0;
    if (!plc::readWord(0x38, 100000, version, nullptr, plc::ReadAddress,
                       nullptr, nullptr, nullptr, nullptr, true) && version && version != 0xFFFF) {
      plcBaud = 100000;
      activeSlave = plc::ReadAddress;
      recoveryUsed = true;
      printUid(plcBaud);
      return;
    }
  }
  answer(F("!BRIDGE PLC_COLD_NO_VALID_FRAME"));
}

// Power-cycle per address so every read lands in the startup window.
static void scanStartupTiming() {
  constexpr uint32_t rates[] = {25000, 50000, 100000, 200000};
  constexpr uint8_t slaves[] = {0x6D, 0x7D};
  for (uint32_t rate : rates) {
    for (uint8_t slave : slaves) {
      size_t bestEdges = 0;
      uint16_t bestDelay = 0;
      for (uint16_t gap = 250; gap <= 3000; gap += 125) {
        digitalWrite(7, LOW);
        pinMode(7, OUTPUT);
        delay(100);
        uint16_t version = 0;
        size_t edges = 0;
        const char *error = plc::readWord(0x38, rate, version, nullptr, slave,
                                          &edges, nullptr, nullptr, nullptr, false, true, gap);
        if (edges > bestEdges) {
          bestEdges = edges;
          bestDelay = gap;
        }
        if (!error) {
          char result[80];
          snprintf(result, sizeof(result), "# START CRC_OK RATE=%lu ADDR=%02X US=%u VERSION=%04X",
                   (unsigned long)rate, unsigned(slave & 0xFE), unsigned(gap), unsigned(version));
          answer(result);
          return;
        }
      }
      char result[80];
      snprintf(result, sizeof(result), "# START RATE=%lu ADDR=%02X MAX_EDGES=%u US=%u",
               (unsigned long)rate, unsigned(slave & 0xFE), unsigned(bestEdges), unsigned(bestDelay));
      Serial.println(result);
    }
  }
  answer(F("!BRIDGE PLC_TIMING_NO_VALID_FRAME"));
}

static void scanColdAddresses() {
  for (uint16_t addr = 0; addr < 0xFE; addr += 2) {
    const uint8_t slave = addr | 1;
    plc::enableAccess(plcBaud, true, false, slave, 500);
    uint16_t version;
    if (plc::readWord(0x38, plcBaud, version, nullptr, slave,
                      nullptr, nullptr, nullptr, nullptr, true) || !version || version == 0xFFFF)
      continue;
    char response[64];
    snprintf(response, sizeof(response), "# SCAN ADDR=%02X VERSION=%04X", unsigned(addr), unsigned(version));
    answer(response);
    return;
  }
  answer(F("!BRIDGE PLC_SCAN_NO_VALID_FRAME"));
}

// The PSSC frame changes CFG_SPI_I2C, but does not change the upper
// address bit in CFG_PADS1. Test both possible addresses after that frame.
static void testRecoveryAddress() {
  constexpr uint32_t rates[] = {50000, 100000, 200000};
  constexpr uint8_t slaves[] = {0x6D, 0xED};
  for (uint32_t rate : rates) {
    for (uint8_t slave : slaves) {
      for (uint16_t gap = 300; gap <= 1500; gap += 300) {
        plc::recoverAtPowerOn(rate, gap);
        uint16_t version = 0;
        if (!plc::readWord(0x38, rate, version, nullptr, slave,
                           nullptr, nullptr, nullptr, nullptr, true) && version && version != 0xFFFF) {
          activeSlave = slave;
          plcBaud = rate;
          recoveryUsed = true;
          printUid(rate);
          return;
        }
      }
    }
  }
  answer(F("!BRIDGE PLC_RECOVERY_NO_VALID_FRAME"));
}

static void measureStartupAodo() {
  constexpr size_t sampleCount = 48;
  uint16_t samples[sampleCount];
  pinMode(4, INPUT);
  digitalWrite(4, LOW);
  digitalWrite(7, LOW);
  pinMode(7, OUTPUT);
  delay(100);
  analogRead(A6);
  digitalWrite(7, HIGH);
  const uint32_t start = micros();
  for (size_t i = 0; i < sampleCount; ++i) {
    while (uint32_t(micros() - start) < i * 250UL) {}
    samples[i] = analogRead(A6);
  }
  Serial.print("# AODO ADC10 STEP_US=250 ");
  for (unsigned sample : samples) {
    Serial.print(sample);
    Serial.print(' ');
  }
  Serial.print("\r\n:\r\n");
}

static void measureIdleAodo() {
  if (!plc::singlePin) {
    answer(F("!BRIDGE USE_D4_MODE"));
    return;
  }
  // D4 is also ADC8. Sample passively while the target powers up.
  pinMode(4, INPUT);
  digitalWrite(4, LOW);
  digitalWrite(7, LOW);
  pinMode(7, OUTPUT);
  delay(100);
  const unsigned off = analogRead(A6);
  digitalWrite(7, HIGH);
  delayMicroseconds(500);
  const unsigned early = analogRead(A6);
  delay(20);
  const unsigned mid = analogRead(A6);
  delay(230);
  const unsigned late = analogRead(A6);
  char response[75];
  snprintf(response, sizeof(response), "# AODO ADC10 OFF=%u EARLY=%u MID=%u LATE=%u",
           off, early, mid, late);
  answer(response);
}

// Some AODO sensors boot with SPI/I2C disabled. Only change the interface
// selector for this session, after confirming the chip over One-Wire.
static const char *activateI2cThroughPlc() {
  Wire.end();
  plc::configurePins();
  const char *error = openPlcAccess(true);
  if (error && !strcmp(error, "!BRIDGE PLC_NO_VALID_FRAME"))
    error = openPlcAccess(true, true);
  if (error) return error;
  uint16_t version, ser0, ser1, config, verified;
  if (plc::readWord(0x38, plcBaud, version, nullptr, activeSlave) ||
      plc::readWord(0x50, plcBaud, ser0, nullptr, activeSlave) ||
      plc::readWord(0x52, plcBaud, ser1, nullptr, activeSlave) ||
      (version & 0xFFF8) != 0x0020 || !(ser0 || ser1) || (ser0 == 0xFFFF && ser1 == 0xFFFF) ||
      plc::readWord(0x06, plcBaud, config, nullptr, activeSlave))
    return "!BRIDGE I2C_PLC_IDENTITY_UNVERIFIED";
  if ((config & 3) == 1 || (config & 3) == 2)
    return "!BRIDGE I2C_SENSOR_NOT_FOUND";
  const uint16_t updated = (config & 0xFFFC) | 2;
  plc::writeWord(0x06, updated, plcBaud, false, false, activeSlave);
  if (plc::readWord(0x06, plcBaud, verified, nullptr, activeSlave) || verified != updated)
    return "!BRIDGE I2C_RAM_ENABLE_FAILED";
  uint16_t period;
  if (const char *error = plc::readWord(0x0E, plcBaud, period, nullptr, activeSlave))
    return error;
  if (period == 0x5CFD) {
    plc::writeWord(0x0E, 1, plcBaud, false, false, activeSlave);
    if (plc::readWord(0x0E, plcBaud, period, nullptr, activeSlave) || period != 1)
      return "!BRIDGE PLC_PERIOD_READBACK_FAILED";
    plc::writeWord(0x22, 0x8B93, plcBaud, false, false, activeSlave);
  }
  return nullptr;
}

static void i2cCommand(const char *command) {
  if (!i2cMode) {
    answer(F("!BRIDGE I2C_MODE_REQUIRED"));
    return;
  }
  if (!strcmp_P(command, PSTR("ACCESS")) || !strcmp_P(command, PSTR("START"))) {
    const bool start = !strcmp_P(command, PSTR("START"));
    bool enabledInRam = false;
    const char *error = elmosI2c::connect(start);
    if (start && error && !strcmp(error, "!BRIDGE I2C_SENSOR_NOT_FOUND")) {
      error = activateI2cThroughPlc();
      if (!error) {
        enabledInRam = true;
        error = elmosI2c::connect(false);
      }
    }
    if (error) {
      answer(error);
      return;
    }
    char reply[48];
    snprintf(reply, sizeof(reply), "# I2C ACCESS ADDR=%02X RAM_ENABLE=%u",
             unsigned(elmosI2c::slave), unsigned(enabledInRam));
    answer(reply);
    return;
  }
  const bool read = strncmp_P(command, PSTR("READ "), 5) == 0 && strlen(command) == 7;
  const bool write = strncmp_P(command, PSTR("WRITE "), 6) == 0 && strlen(command) == 12;
  if ((!read && !write) || !elmosI2c::slave) {
    answer(F("!BRIDGE I2C_COMMAND_OR_ACCESS_REQUIRED"));
    return;
  }
  const char *hex = command + (read ? 5 : 6);
  unsigned data = 0;
  for (unsigned i = 0; i < (read ? 2u : 6u); ++i) {
    const int digit = hexDigit(hex[i]);
    if (digit < 0) {
      answer(F("!BRIDGE I2C_BAD_HEX"));
      return;
    }
    data = (data << 4) | digit;
  }
  const uint8_t reg = read ? data : data >> 16;
  if (reg & 1) {
    answer(F("!BRIDGE I2C_UNALIGNED_REGISTER"));
    return;
  }
  uint16_t word = data;
  if (read) {
    if (const char *error = elmosI2c::readWord(elmosI2c::slave, reg, word)) {
      answer(error);
      return;
    }
    char reply[8];
    snprintf(reply, sizeof(reply), "%02X %02X", unsigned(word & 0xFF), unsigned(word >> 8));
    answer(reply);
  } else {
    // Generic I2C RAM access. NVM operations still require an armed session.
    const bool readNvm = reg == 0x4E && (word & 0xFF81) == 0x4C00;
    const bool ramLock = reg == 0x4E && word == 0;
    const bool program = reg == 0x4E && (word & 0xFF81) == 0xA300;
    const unsigned index = (word & 0xFF) >> 1;
    const bool permission = reg == 0x4A ? nvmSessionActive() :
       reg == 0x4E ? (readNvm || ramLock ||
         (program && nvmHostMode && nvmDataPending && nvmSessionActive() && index >= 16 && index <= 63) ||
         ((word == 0x98BD || word == 0x25BF || word == 0x36D8 || word == 0x8800) && nvmSessionActive())) : true;
    if (!permission) {
      answer(F("!BRIDGE I2C_WRITE_DENIED"));
      return;
    }
    const char *error = elmosI2c::writeWord(reg, word);
    if (!error && nvmHostMode && reg == 0x4A) nvmDataPending = true;
    if (!error && nvmHostMode && program) nvmDataPending = false;
    answer(error ? error : "# I2C WRITE");
  }
}

static void onCommand(const char *command) {
  if (strcmp_P(command, PSTR("IF_CFG 2 1 0")) == 0 || strcmp_P(command, PSTR("IF_CFG 7 0 0")) == 0) {
    if (i2cMode) Wire.end();
    i2cMode = strcmp_P(command, PSTR("IF_CFG 2 1 0")) == 0;
    elmosI2c::slave = 0;
    disarmNvm();coldStartVerified = false;
    answer(i2cMode ? "# I2C" : "# PLC");
    return;
  }
  if (strncmp_P(command, PSTR("I2C "), 4) == 0) {
    i2cCommand(command + 4);
    return;
  }
  if (i2cMode && ((strncmp_P(command, PSTR("PLC"), 3) == 0 &&
                   strncmp_P(command, PSTR("PLC IO "), 7) != 0 &&
                   strncmp_P(command, PSTR("PLC_BAUD "), 9) != 0) ||
                  strncmp_P(command, PSTR("NVM ARM "), 8) == 0)) {
    answer(F("!BRIDGE I2C_MODE_ACTIVE"));
    return;
  }
  if (strcmp_P(command, PSTR("NVM ARM CALIBRATION")) == 0 || strcmp_P(command, PSTR("NVM ARM USER ID")) == 0) {
    disarmNvm();
    nvmUserIdOnly = strcmp_P(command, PSTR("NVM ARM USER ID")) == 0;
    armNvmSession();
    answer(F("# NVM CALIBRATION ARMED"));
    return;
  }
  if (strcmp_P(command, PSTR("NVM ARM HOST")) == 0) {
    disarmNvm();
    if (!coldStartVerified || probe(activeSlave)) {
      answer(F("!BRIDGE NVM_COLD_START_REQUIRED"));
    } else {
      nvmHostMode = true;
      armNvmSession();
      answer(F("# NVM HOST ARMED"));
    }
    return;
  }
  if (strcmp_P(command, PSTR("NVM DISARM")) == 0) {
    disarmNvm();
    answer(F("# NVM DISARMED"));
    return;
  }
  if (strncmp_P(command, PSTR("PLC "), 4) == 0 && strncmp_P(command, PSTR("PLC 02"), 6) != 0)
    disarmNvm();
  if (strcmp_P(command, PSTR("BRIDGE_INFO")) == 0) {
    answer(F("# E70311-BRIDGE V1 CAPS=PLC_UID,PLC_READ,PLC_WRITE,NVM,PRO_MICRO_NVM,PLC_RX_DIAG,POWER_D7,PSSC_RAM,AFE_FILTER,BRIDGE_GENERIC_RAM_V1,BRIDGE_USER_NVM_V1,I2C_CRC,PLC_D4_IO"));
  } else if (strcmp_P(command, PSTR(".VERSION")) == 0) {
    #if F_CPU == 16000000UL
    answer(F("# Pro Micro PLC/I2C v0.28-dev 16 MHz"));
#else
    answer(F("# Pro Micro PLC/I2C v0.28-dev 8 MHz"));
#endif
  } else if (strcmp_P(command, PSTR("PLC IO D4")) == 0 || strcmp_P(command, PSTR("PLC IO SPLIT")) == 0) {
    disarmNvm();coldStartVerified = false;
    plc::singlePin = strcmp_P(command, PSTR("PLC IO D4")) == 0;
    answer(plc::singlePin ? "# PLC IO D4" : "# PLC IO SPLIT");
  } else if (strcmp_P(command, PSTR("PLC POWER TEST")) == 0) {
    PORTC &= ~plc::Enable;
    DDRD &= ~plc::Tx;
    PORTD &= ~plc::Tx;
    digitalWrite(7, LOW);
    pinMode(7, OUTPUT);
    answer(F("# D7 LOW 15s"));
    delay(15000);
    digitalWrite(7, HIGH);
    answer(F("# D7 HIGH"));
  } else if (strcmp_P(command, PSTR("PLC AODO STARTUP")) == 0) {
    measureStartupAodo();
  } else if (strcmp_P(command, PSTR("PLC AODO LEVEL")) == 0) {
    measureIdleAodo();
  } else if (strcmp_P(command, PSTR("PLC START TIMING")) == 0) {
    scanStartupTiming();
  } else if (strcmp_P(command, PSTR("PLC COLD SCAN")) == 0) {
    scanColdAddresses();
  } else if (strcmp_P(command, PSTR("PLC GAP HIGH")) == 0 || strcmp_P(command, PSTR("PLC GAP LOW")) == 0) {
    plc::highInterFrameGap = strcmp_P(command, PSTR("PLC GAP HIGH")) == 0;
    answer(plc::highInterFrameGap ? "# GAP HIGH" : "# GAP LOW");
  } else if (strcmp_P(command, PSTR("PLC RECOVERY ADDRESS TEST")) == 0) {
    testRecoveryAddress();
  } else if (strcmp_P(command, PSTR("PLC COLD TEST")) == 0) {
    testColdStart();
  } else if (strcmp_P(command, PSTR("PLC RX DIAG")) == 0) {
    diagnoseRx();
  } else if (strcmp_P(command, PSTR("PLC_UID 25000")) == 0) {
    printUid(25000);
  } else if (strcmp_P(command, PSTR("PLC_UID 100000")) == 0) {
    printUid(100000);
  } else if (strcmp_P(command, PSTR("PLC_BAUD 25000")) == 0 || strcmp_P(command, PSTR("PLC_BAUD 100000")) == 0) {
    disarmNvm();coldStartVerified = false;
    plcBaud = strcmp_P(command, PSTR("PLC_BAUD 25000")) == 0 ? 25000 : 100000;
    answer(F("# PLC BAUD"));
  } else if (strcmp_P(command, PSTR("PLC ACCESS")) == 0 || strcmp_P(command, PSTR("PLC START")) == 0) {
    establishAccess(strcmp_P(command, PSTR("PLC START")) == 0);
  } else if (strcmp_P(command, PSTR("PLC RECOVER")) == 0 || strcmp_P(command, PSTR("PLC RECOVER START")) == 0) {
    establishAccess(strcmp_P(command, PSTR("PLC RECOVER START")) == 0, true);
  } else if (strncmp_P(command, PSTR("PLC "), 4) == 0) {
    plcFrame(command + 4);
  } else if (strncmp_P(command, PSTR("IF_CFG"), 6) == 0 ||
             strncmp_P(command, PSTR("PLC"), 3) == 0 ||
             strncmp_P(command, PSTR("#PLC"), 4) == 0) {
    answer(F("!BRIDGE PLC_COMMAND_NOT_SUPPORTED"));
  } else {
    answer(F("!BRIDGE UNSUPPORTED_COMMAND"));
  }
}

void setup() {
  plc::configurePins();
  Serial.begin(115200);
  // Don't wait for Serial: the sketch must start even without a USB host.
}

void loop() {
  while (Serial.available() > 0) {
    int incoming = Serial.read();
    if (incoming < 0) break;
    const char c = static_cast<char>(incoming);
    if (c == '\r' || c == '\n') {
      if (lineLength) {
        lineBuffer[lineLength] = '\0';
        onCommand(lineBuffer);
        lineLength = 0;
      }
    } else if (static_cast<unsigned char>(c) >= 32 &&
               lineLength < sizeof(lineBuffer) - 1) {
      lineBuffer[lineLength++] = c;
    } else {
      lineLength = 0;
      answer(F("!BRIDGE INVALID_OR_TOO_LONG"));
    }
  }
  delay(1);
}
