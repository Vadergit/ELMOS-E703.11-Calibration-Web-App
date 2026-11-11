/*
  ELMOS E703.11 · ESP32-C3 SuperMini USB test bridge v0.1
  ======================================================
  Board: ESP32-C3 SuperMini (ESP32-C3 with native USB Serial/JTAG)
  Arduino IDE: ESP32 by Espressif Systems
  Board: "ESP32C3 Dev Module"
  Tools > USB CDC On Boot > Enabled
  Port: the native USB-C device, not an external UART adapter
  Serial monitor: 115200 baud, close it before Chrome/Web Serial.

  This is a SAFE USB TEST, NOT an E703.11 PROGRAMMER:
  - No GPIO is configured, driven, or connected to AODO.
  - GPIO18 USB D- and GPIO19 USB D+ MUST remain dedicated to USB.
  - It answers BRIDGE_INFO with CAPS=CDC_ONLY.
  - PLC register reads, writes, EEPROM programming are NOT implemented.
  - The web app refuses all E703.11 operations via this bridge.
*/
#include <Arduino.h>
#include <string.h>

#if !defined(CONFIG_IDF_TARGET_ESP32C3)
#error "This sketch is specifically for ESP32-C3 SuperMini. Select ESP32C3 Dev Module."
#endif

// Select Tools > USB CDC On Boot > Enabled, otherwise Serial may be UART0.
#if defined(ARDUINO_USB_CDC_ON_BOOT) && !ARDUINO_USB_CDC_ON_BOOT
#warning "Enable USB CDC On Boot for native USB communication in Arduino IDE."
#endif

static char lineBuffer[96];
static size_t lineLength = 0;
static uint32_t requests = 0;

static void answer(const char *message) {
  // Same line-terminator as the existing SSP3-oriented Web Serial parser.
  Serial.print(message);
  Serial.print("\r\n:\r\n");
  Serial.flush();
}

static void onCommand(const char *command) {
  ++requests;
  if (strcmp(command, "BRIDGE_INFO") == 0) {
    answer("# E70311-BRIDGE V1 CAPS=CDC_ONLY");
  } else if (strcmp(command, ".VERSION") == 0) {
    answer("# ESP32-C3 SuperMini USB CDC diagnostic v0.1; no E703 sensor I/O");
  } else if (strcmp(command, "BRIDGE_PING") == 0) {
    answer("# PONG ESP32-C3 SUPERMini CDC_ONLY");
  } else if (strcmp(command, "BRIDGE_STATS") == 0) {
    Serial.printf("# BRIDGE_STATS requests=%lu freeheap=%lu\r\n:\r\n",
                  static_cast<unsigned long>(requests),
                  static_cast<unsigned long>(ESP.getFreeHeap()));
    Serial.flush();
  } else if (strncmp(command, "IF_CFG", 6) == 0 ||
             strncmp(command, "PLC", 3) == 0 ||
             strncmp(command, "#PLC", 4) == 0) {
    answer("!BRIDGE PLC_NOT_IMPLEMENTED");
  } else {
    answer("!BRIDGE UNSUPPORTED_COMMAND");
  }
}

void setup() {
  // Native USB Serial/JTAG on ESP32-C3. This code deliberately has NO pinMode(),
  // digitalWrite(), peripheral initialization or E703.11 electrical interface.
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
