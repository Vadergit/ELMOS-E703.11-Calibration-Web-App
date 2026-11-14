// ATmega32U4 test bridge with CRC-checked register reads and volatile PLC startup.
#include <Arduino.h>
#include <string.h>
#include "plc_avr.h"

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
static bool nvmUserIdOnly = false;

static void plcFrame(const char *hex) {
  const size_t length = strlen(hex);
  const bool read = length == 9 && hex[8] == '.';
  if (!read && length != 14) {
    answer("!BRIDGE PLC_BAD_LENGTH");
    return;
  }
  uint8_t frame[7];
  for (size_t i = 0; i < length / 2; ++i) {
    const int high = hexDigit(hex[2 * i]), low = hexDigit(hex[2 * i + 1]);
    if (high < 0 || low < 0) {
      answer("!BRIDGE PLC_BAD_HEX");
      return;
    }
    frame[i] = (high << 4) | low;
  }
  const uint8_t address = frame[2], header = frame[3];
  const uint8_t slave = frame[1] | 1;
  if (frame[0] != plc::Preamble || (frame[1] & 1) != read ||
      (slave != 0x6D && slave != 0x7D) || (address & 1) ||
      header != plc::readHeader(address, slave)) {
    answer("!BRIDGE PLC_BAD_HEADER");
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
    answer("!BRIDGE PLC_BAD_CRC");
    return;
  }
  const bool startMeasurement = address == 0x22 && word == 0x8B93;
  const bool readEepromWord = address == 0x4E && (word & 0xFF81) == 0x4C00;
  // DSP coefficients occupy the even RAM addresses 0x6C through 0x9A.
  const bool writeDspRam = address >= 0x6C && address <= 0x9A;
  // Only the explicit USB maintenance session can program calibration data.
  // Factory, startup, and interface words cannot be programmed by this path.
  const uint8_t nvmIndex = (word & 0xFF) >> 1;
  const bool calibrationWord = nvmIndex == 28 || (nvmIndex >= 30 && nvmIndex <= 54) || nvmIndex == 63;
  const bool programCalibration = (word & 0xFF81) == 0xA300 && calibrationWord &&
    (!nvmUserIdOnly || nvmIndex == 30 || nvmIndex == 63);
  const bool userNvmCommand = address == 0x4E &&
    (word == 0x98BD || word == 0x25BF || word == 0x36D8 ||
     word == 0x0000 || word == 0x8800 || programCalibration);
  const bool writeUserNvm = nvmArmed && (address == 0x4A || userNvmCommand);
  if (slave != activeSlave || (!startMeasurement && !readEepromWord && !writeDspRam && !writeUserNvm)) {
    answer("!BRIDGE PLC_WRITE_DENIED");
    return;
  }
  plc::writeWord(address, word, plcBaud, false, false, slave);
  answer("# PLC FRAME SENT");
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

static void establishAccess(bool powerCycle, bool recover = false) {
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
  if (error) {
    answer(error);
    return;
  }
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
  answer("!BRIDGE PLC_COLD_NO_VALID_FRAME");
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
  answer("!BRIDGE PLC_TIMING_NO_VALID_FRAME");
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
  answer("!BRIDGE PLC_SCAN_NO_VALID_FRAME");
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
  answer("!BRIDGE PLC_RECOVERY_NO_VALID_FRAME");
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
    answer("!BRIDGE USE_D4_MODE");
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

static void onCommand(const char *command) {
  if (strcmp(command, "NVM ARM CALIBRATION") == 0 || strcmp(command, "NVM ARM USER ID") == 0) {
    nvmUserIdOnly = strcmp(command, "NVM ARM USER ID") == 0;
    nvmArmed = true;
    answer("# NVM CALIBRATION ARMED");
    return;
  }
  if (strcmp(command, "NVM DISARM") == 0) {
    nvmArmed = false;
    answer("# NVM DISARMED");
    return;
  }
  if (strncmp(command, "PLC ", 4) == 0 && strncmp(command, "PLC 02", 6) != 0)
    nvmArmed = false;
  if (strcmp(command, "BRIDGE_INFO") == 0) {
    answer("# E70311-BRIDGE V1 CAPS=PLC_UID,PLC_READ,PLC_WRITE,NVM,PRO_MICRO_NVM,PLC_RX_DIAG,POWER_D7,PSSC_RAM");
  } else if (strcmp(command, ".VERSION") == 0) {
    answer(F_CPU == 16000000UL ? "# Pro Micro PLC v0.25 16 MHz" : "# Pro Micro PLC v0.25 8 MHz");
  } else if (strcmp(command, "PLC IO D4") == 0 || strcmp(command, "PLC IO SPLIT") == 0) {
    plc::singlePin = strcmp(command, "PLC IO D4") == 0;
    answer(plc::singlePin ? "# PLC IO D4" : "# PLC IO SPLIT");
  } else if (strcmp(command, "PLC POWER TEST") == 0) {
    PORTC &= ~plc::Enable;
    DDRD &= ~plc::Tx;
    PORTD &= ~plc::Tx;
    digitalWrite(7, LOW);
    pinMode(7, OUTPUT);
    answer("# D7 LOW 15s");
    delay(15000);
    digitalWrite(7, HIGH);
    answer("# D7 HIGH");
  } else if (strcmp(command, "PLC AODO STARTUP") == 0) {
    measureStartupAodo();
  } else if (strcmp(command, "PLC AODO LEVEL") == 0) {
    measureIdleAodo();
  } else if (strcmp(command, "PLC START TIMING") == 0) {
    scanStartupTiming();
  } else if (strcmp(command, "PLC COLD SCAN") == 0) {
    scanColdAddresses();
  } else if (strcmp(command, "PLC GAP HIGH") == 0 || strcmp(command, "PLC GAP LOW") == 0) {
    plc::highInterFrameGap = strcmp(command, "PLC GAP HIGH") == 0;
    answer(plc::highInterFrameGap ? "# GAP HIGH" : "# GAP LOW");
  } else if (strcmp(command, "PLC RECOVERY ADDRESS TEST") == 0) {
    testRecoveryAddress();
  } else if (strcmp(command, "PLC COLD TEST") == 0) {
    testColdStart();
  } else if (strcmp(command, "PLC RX DIAG") == 0) {
    diagnoseRx();
  } else if (strcmp(command, "PLC_UID 25000") == 0) {
    printUid(25000);
  } else if (strcmp(command, "PLC_UID 100000") == 0) {
    printUid(100000);
  } else if (strcmp(command, "IF_CFG 7 0 0") == 0) {
    answer("# PLC");
  } else if (strcmp(command, "PLC_BAUD 25000") == 0 || strcmp(command, "PLC_BAUD 100000") == 0) {
    plcBaud = strcmp(command, "PLC_BAUD 25000") == 0 ? 25000 : 100000;
    answer("# PLC BAUD");
  } else if (strcmp(command, "PLC ACCESS") == 0 || strcmp(command, "PLC START") == 0) {
    establishAccess(strcmp(command, "PLC START") == 0);
  } else if (strcmp(command, "PLC RECOVER") == 0 || strcmp(command, "PLC RECOVER START") == 0) {
    establishAccess(strcmp(command, "PLC RECOVER START") == 0, true);
  } else if (strncmp(command, "PLC ", 4) == 0) {
    plcFrame(command + 4);
  } else if (strncmp(command, "IF_CFG", 6) == 0 ||
             strncmp(command, "PLC", 3) == 0 ||
             strncmp(command, "#PLC", 4) == 0) {
    answer("!BRIDGE PLC_COMMAND_NOT_SUPPORTED");
  } else {
    answer("!BRIDGE UNSUPPORTED_COMMAND");
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
      answer("!BRIDGE INVALID_OR_TOO_LONG");
    }
  }
  delay(1);
}
