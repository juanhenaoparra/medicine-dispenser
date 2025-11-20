// /*
//  * Test WiFi - Diagnóstico
//  *
//  * Este código prueba SOLO la conexión WiFi con información detallada
//  */

// #include <WiFi.h>

// // ← CAMBIAR con tus credenciales
// const char* ssid = "S25 Ultra de Julian";
// const char* password = "21jejAlo.";

// void setup() {
//   Serial.begin(115200);
//   delay(2000);

//   Serial.println("\n\n=== TEST WIFI ESP32 ===");
//   Serial.println();

//   // Información del ESP32
//   Serial.print("Chip Model: ");
//   Serial.println(ESP.getChipModel());
//   Serial.print("Chip Revision: ");
//   Serial.println(ESP.getChipRevision());
//   Serial.print("MAC Address: ");
//   Serial.println(WiFi.macAddress());
//   Serial.println();

//   // Configuración WiFi
//   Serial.println("=== Intentando conectar ===");
//   Serial.print("SSID: ");
//   Serial.println(ssid);
//   Serial.print("Password length: ");
//   Serial.println(strlen(password));
//   Serial.println();

//   WiFi.mode(WIFI_STA);
//   WiFi.disconnect(true);  // Limpiar conexiones previas
//   delay(100);

//   WiFi.begin(ssid, password);

//   Serial.println("Conectando");
//   int attempts = 0;
//   while (WiFi.status() != WL_CONNECTED && attempts < 40) {
//     delay(500);
//     Serial.print(".");

//     // Mostrar estado cada 10 intentos
//     if (attempts % 10 == 9) {
//       Serial.println();
//       Serial.print("  Status: ");
//       Serial.print(WiFi.status());
//       Serial.print(" (");

//       switch(WiFi.status()) {
//         case WL_IDLE_STATUS:
//           Serial.print("IDLE");
//           break;
//         case WL_NO_SSID_AVAIL:
//           Serial.print("NO SSID - Red no encontrada!");
//           break;
//         case WL_SCAN_COMPLETED:
//           Serial.print("SCAN COMPLETED");
//           break;
//         case WL_CONNECTED:
//           Serial.print("CONNECTED");
//           break;
//         case WL_CONNECT_FAILED:
//           Serial.print("CONNECT FAILED - Password incorrecto?");
//           break;
//         case WL_CONNECTION_LOST:
//           Serial.print("CONNECTION LOST");
//           break;
//         case WL_DISCONNECTED:
//           Serial.print("DISCONNECTED");
//           break;
//         default:
//           Serial.print("UNKNOWN");
//       }
//       Serial.println(")");
//       Serial.print("  Intento: ");
//       Serial.print(attempts + 1);
//       Serial.println("/40");
//     }

//     attempts++;
//   }

//   Serial.println("\n");

//   // Resultado
//   if (WiFi.status() == WL_CONNECTED) {
//     Serial.println("╔════════════════════════════════╗");
//     Serial.println("║   ✓ WIFI CONECTADO!           ║");
//     Serial.println("╚════════════════════════════════╝");
//     Serial.println();
//     Serial.print("IP Address: ");
//     Serial.println(WiFi.localIP());
//     Serial.print("Gateway: ");
//     Serial.println(WiFi.gatewayIP());
//     Serial.print("Subnet Mask: ");
//     Serial.println(WiFi.subnetMask());
//     Serial.print("DNS: ");
//     Serial.println(WiFi.dnsIP());
//     Serial.print("RSSI (Signal): ");
//     Serial.print(WiFi.RSSI());
//     Serial.println(" dBm");
//     Serial.print("Channel: ");
//     Serial.println(WiFi.channel());

//   } else {
//     Serial.println("╔════════════════════════════════╗");
//     Serial.println("║   ✗ ERROR: NO SE CONECTÓ      ║");
//     Serial.println("╚════════════════════════════════╝");
//     Serial.println();
//     Serial.print("Status final: ");
//     Serial.println(WiFi.status());

//     Serial.println("\n=== DIAGNÓSTICO ===");

//     if (WiFi.status() == WL_NO_SSID_AVAIL) {
//       Serial.println("❌ Red no encontrada");
//       Serial.println("   Posibles causas:");
//       Serial.println("   1. SSID escrito incorrectamente");
//       Serial.println("   2. Router apagado o fuera de alcance");
//       Serial.println("   3. Red en 5GHz (ESP32 solo soporta 2.4GHz)");
//       Serial.println();
//       Serial.println("   SOLUCIÓN: Verifica que la red sea 2.4GHz");

//     } else if (WiFi.status() == WL_CONNECT_FAILED) {
//       Serial.println("❌ Conexión fallida");
//       Serial.println("   Posibles causas:");
//       Serial.println("   1. Password incorrecto");
//       Serial.println("   2. Seguridad WiFi incompatible (usa WPA2)");
//       Serial.println("   3. MAC filtering activado en router");
//       Serial.println();
//       Serial.println("   SOLUCIÓN: Verifica el password");

//     } else {
//       Serial.println("❌ Error desconocido");
//       Serial.println("   Intenta:");
//       Serial.println("   1. Reiniciar el router");
//       Serial.println("   2. Acercar el ESP32 al router");
//       Serial.println("   3. Verificar que WiFi no tenga portal cautivo");
//     }

//     Serial.println("\n=== REDES DISPONIBLES ===");
//     Serial.println("Escaneando...");

//     int n = WiFi.scanNetworks();
//     if (n == 0) {
//       Serial.println("No se encontraron redes");
//     } else {
//       Serial.print("Se encontraron ");
//       Serial.print(n);
//       Serial.println(" redes:");
//       Serial.println();

//       for (int i = 0; i < n; i++) {
//         Serial.print(i + 1);
//         Serial.print(": ");
//         Serial.print(WiFi.SSID(i));
//         Serial.print(" (");
//         Serial.print(WiFi.RSSI(i));
//         Serial.print(" dBm) ");

//         // Mostrar si es abierta o segura
//         switch (WiFi.encryptionType(i)) {
//           case WIFI_AUTH_OPEN:
//             Serial.print("OPEN");
//             break;
//           case WIFI_AUTH_WEP:
//             Serial.print("WEP");
//             break;
//           case WIFI_AUTH_WPA_PSK:
//             Serial.print("WPA");
//             break;
//           case WIFI_AUTH_WPA2_PSK:
//             Serial.print("WPA2");
//             break;
//           case WIFI_AUTH_WPA_WPA2_PSK:
//             Serial.print("WPA/WPA2");
//             break;
//           case WIFI_AUTH_WPA2_ENTERPRISE:
//             Serial.print("WPA2-Enterprise");
//             break;
//           default:
//             Serial.print("Unknown");
//         }

//         // Indicar si es tu red
//         if (WiFi.SSID(i) == ssid) {
//           Serial.print(" ← TU RED!");
//         }

//         Serial.println();
//       }
//     }
//   }

//   Serial.println("\n=== FIN DEL TEST ===");
// }

// void loop() {
//   // Nada aquí
//   delay(1000);
// }
