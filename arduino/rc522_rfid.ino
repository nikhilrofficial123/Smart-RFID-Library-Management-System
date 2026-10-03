/*
  =============================================================
  Smart RFID Library System - Arduino UNO/Nano + MFRC522 Sketch
  =============================================================
  
  Hardware Pinout Connection (Arduino UNO / Nano -> MFRC522):
  -------------------------------------------------------------
  MFRC522 Pin  |  Arduino UNO / Nano Pin
  -------------------------------------------------------------
  SDA (SS)     |  D10
  SCK          |  D13
  MOSI         |  D11
  MISO         |  D12
  IRQ          |  (Unconnected)
  GND          |  GND
  RST          |  D9
  3.3V         |  3.3V  <-- WARNING: Use 3.3V only! Do NOT use 5V!
  -------------------------------------------------------------

  Required Library:
  - "MFRC522" by GitHubCommunity / Arduino (Install via Library Manager)
*/

#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 10
#define RST_PIN 9

MFRC522 rfid(SS_PIN, RST_PIN);

unsigned long lastHealthCheck = 0;
const unsigned long HEALTH_CHECK_INTERVAL = 2000; // 2 seconds

unsigned long lastScanTime = 0;
const unsigned long SCAN_COOLDOWN = 1200; // 1.2s cooldown between consecutive reads

// Function to test SPI communication with MFRC522 IC
bool checkRC522Connected(byte &versionVal) {
  versionVal = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  
  // Version 0x91 / 0x92 = genuine NXP MFRC522
  // Non-0x00 and non-0xFF = compatible MFRC522 IC
  // 0x00 or 0xFF = SPI bus communication error (wiring/power issue or module removed)
  if (versionVal == 0x00 || versionVal == 0xFF) {
    // Attempt auto-recovery re-initialization
    rfid.PCD_Init();
    versionVal = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  }
  
  return (versionVal != 0x00 && versionVal != 0xFF);
}

void performHealthCheck() {
  byte ver = 0;
  if (checkRC522Connected(ver)) {
    Serial.print("STATUS:RC522_OK (v0x");
    if (ver < 0x10) Serial.print("0");
    Serial.print(ver, HEX);
    Serial.println(")");
  } else {
    Serial.println("STATUS:RC522_ERROR");
  }
}

void setup() {
  Serial.begin(9600); // Must match BAUD_RATE=9600 in middleware/.env
  SPI.begin();        // Init SPI bus
  rfid.PCD_Init();    // Init MFRC522 RFID reader module
  
  // Increase Antenna Gain to Maximum (48dB) for superior card reading range
  rfid.PCD_SetAntennaGain(rfid.RxGain_max);

  delay(100);
  performHealthCheck();
}

void loop() {
  // 1. Listen for incoming health check queries from middleware
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    if (command == "CHECK") {
      performHealthCheck();
    }
  }

  // 2. Periodic health check every 2 seconds
  if (millis() - lastHealthCheck >= HEALTH_CHECK_INTERVAL) {
    lastHealthCheck = millis();
    performHealthCheck();
  }

  // 3. Scan cooldown enforcement (non-blocking)
  if (millis() - lastScanTime < SCAN_COOLDOWN) {
    return;
  }

  // 4. Look for new RFID card / tag
  if (!rfid.PICC_IsNewCardPresent()) {
    return;
  }

  // Select one of the cards
  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }

  // Convert UID byte array to Hex String
  String rfidUid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      rfidUid += "0";
    }
    rfidUid += String(rfid.uid.uidByte[i], HEX);
  }
  rfidUid.toUpperCase();

  // Print UID formatted for middleware
  Serial.println(rfidUid);
  lastScanTime = millis();

  // Halt PICC & Stop Encryption on PCD
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}
