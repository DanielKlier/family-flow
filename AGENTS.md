# AGENTS.md

Dieses Dokument enthaelt verbindliche Guardrails fuer alle menschlichen und automatisierten Beitraege zu FamilyFlow.

## Projektkontext

FamilyFlow ist eine lokale Web-Anwendung fuer Haushalts- und Familienfinanzplanung. Die Anwendung laeuft im lokalen Netzwerk unter `finances.home.arpa`, wird per Docker Compose betrieben und nutzt Authentik als OIDC Provider.

Der geplante Stack ist Node.js, TypeScript, Fastify, PostgreSQL, Drizzle, serverseitige Templates und HTMX.

## Arbeitsmodus

- Arbeite in kleinen, reviewbaren Schritten.
- Bevor du Code aenderst, lies die relevanten Dateien und verstehe die vorhandene Architektur.
- Veraendere keine fremden oder unerwarteten Worktree-Aenderungen, ausser der Nutzer fordert es explizit.
- Waehle die kleinste korrekte Loesung.
- Fuege keine Rueckwaertskompatibilitaet hinzu, wenn es keinen konkreten Bedarf gibt.
- Halte Dokumentation, Tests und Operations Manual synchron mit dem Code.
- Code, Bezeichner, Kommentare, Commit Messages und technische Dokumentation werden auf Englisch geschrieben.

## Zwingende Guardrails

### 1. Tests First

- Kein Feature ohne E2E Test, der zuerst fehlschlaegt.
- Kein Produktivcode ohne vorige Tests, die zuerst fehlschlagen.
- Fuer reine Core-Logik sind Unit-Tests Pflicht.
- Fuer Adapter mit Datenbank, HTTP, OIDC, CSV oder Logging sind Integrationstests Pflicht.
- Bugs werden zuerst durch einen reproduzierenden Test abgesichert.
- Flaky Tests sind Defekte und weder erlaubt noch akzeptabel.
- Ein sporadischer Testfehler darf nicht als Rerun-Rauschen abgetan werden, nur weil der Test bei einer Wiederholung besteht.
- Die Ursache eines Flaky Tests muss vor Commit und Push behoben werden.
- Automatische oder manuelle Retries duerfen die Behebung der eigentlichen Ursache nicht ersetzen.

### 2. Red-Green-Refactor

Jede fachliche Aenderung folgt einer kurzen Red-Green-Refactor-Schleife:

- Red: Schreibe zuerst einen Test, der das gewuenschte Verhalten beschreibt und fehlschlaegt.
- Green: Implementiere die kleinste korrekte Aenderung, die den Test gruen macht.
- Refactor: Verbessere Struktur, Namen, Duplikate, Abhaengigkeiten und Tests, ohne Verhalten zu aendern.

Waehrend Refactor gilt:

- Keine neuen Features.
- Keine Verhaltensaenderungen ohne neuen Test.
- Tests muessen vor und nach dem Refactoring gruen sein.
- Refactorings bleiben klein und reviewbar.
- Wenn Refactoring Risiken fuer Verhalten birgt, werden zusaetzliche Charakterisierungstests ergaenzt.
- Refactorings duerfen Architekturgrenzen schaerfen, aber nicht umgehen.

### 3. Ports And Adapters

- Die Anwendung wird als Ports-and-Adapters organisiert.
- Der Core enthaelt die komplette Anwendungslogik.
- Der Core darf nicht von Fastify, Drizzle, PostgreSQL, Templates, HTMX, OIDC oder Docker abhaengen.
- Der Core muss getrennt vollstaendig testbar sein.
- Ports definieren, was der Core von aussen braucht.
- Adapter implementieren technische Details wie HTTP, DB, Auth, Logging, CSV und Templates.
- Business-Regeln gehoeren niemals in Routen, Templates oder Datenbankadapter.

### 4. Formatierung Und Quality Gates

- Code wird automatisch mit Biome formatiert.
- Vor jedem Commit muss der Code getestet, gelintet und formatiert sein.
- Erwartete lokale Gates:
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm test:e2e`
  - `pnpm build`
- Wenn Docker betroffen ist, muss auch `docker compose build` erfolgreich sein.
- Wenn Deployment betroffen ist, muss ein Docker-Compose-Smoke-Test erfolgen.

### 5. Code Quality Metrics Und Tools

Metriken sind Refactoring-Signale, keine blinden Ziele. Sie werden genutzt, um Code gezielt einfacher, testbarer und architekturell sauberer zu machen.

Beobachtete Qualitaeten und Metriken:

- Cyclomatic Complexity und Cognitive Complexity pro Funktion.
- Laenge von Funktionen und Dateien.
- Anzahl Parameter pro Funktion.
- Anzahl oeffentlicher Exporte pro Modul.
- Test-Coverage fuer Core-Logik.
- Mutation Score fuer kritische Finanzlogik.
- Code-Duplizierung.
- Architekturverletzungen durch Imports ueber Schichtgrenzen hinweg.
- Anzahl von `any`, Type Assertions und Non-Null Assertions.
- Anzahl uebersprungener Tests.
- Anzahl `TODO`- und `FIXME`-Kommentare.
- Dauer und Flakiness der Test-Suite.

Erlaubte oder empfohlene Tools:

- Biome fuer Formatierung und grundlegendes Linting.
- TypeScript `--noEmit` fuer strikte Typpruefung.
- Vitest fuer Unit- und Integrationstests.
- Playwright fuer E2E-Tests.
- Vitest Coverage oder `c8` fuer Coverage-Messung.
- StrykerJS fuer Mutation Testing kritischer Finanzlogik.
- `dependency-cruiser` fuer Architekturgrenzen.
- `knip` fuer ungenutzte Dateien, Exporte und Dependencies.
- `jscpd` fuer Code-Duplizierung.

### 6. Conventional Commits

- Git Commits folgen Conventional Commits.
- Beispiele:
  - `feat: add manual transactions`
  - `fix: prevent duplicate csv imports`
  - `test: cover scenario calculations`
  - `docs: add backup runbook`
  - `chore: configure biome`
  - `refactor: isolate forecasting core`
- Jeder Phasenabschluss aus `TASKS.md` endet in einem Commit.
- Nicht committen, wenn Tests, Linting, Formatierung oder Build fehlschlagen.

### 7. Operations Manual

- Das Projekt braucht ein ausfuehrliches `OPERATIONS.md`.
- Jedes Feature, das Betrieb, Deployment, Daten, Auth, Logs oder Debugging beeinflusst, muss das Operations Manual aktualisieren.
- Run Books muessen mindestens abdecken:
  - Deployment.
  - Updates.
  - Datenbankmigrationen.
  - Backup.
  - Restore.
  - Debugging.
  - OIDC/Auth-Probleme.
  - CSV-Import-Probleme.
  - Log-Analyse.

### 8. Logging

- Jeder HTTP Request erzeugt exakt einen Log-Entry.
- Logging ist strukturiert.
- Logs muessen menschenlesbar in stdout ausgegeben werden, damit Docker Logs nuetzlich bleiben.
- JSON Logs mit viel Kontext muessen architektonisch moeglich sein.
- Die zentrale Logging-Loesung ist tbd und nicht Teil des MVP.
- Jeder Request bekommt eine eindeutige Request ID.

Request-Logs enthalten mindestens:

- Request ID.
- Zeitstempel.
- HTTP Methode.
- Pfad.
- Query-Informationen ohne Secrets.
- Status Code.
- Dauer.
- Nutzerkontext, soweit vorhanden.
- Ergebnisstatus.
- Fehlerdetails, falls vorhanden.

Logging-Regeln:

- Keine Secrets loggen.
- Keine Session-Cookies loggen.
- Keine OIDC Tokens loggen.
- Keine kompletten CSV-Dateien loggen.
- Finanzdaten nur loggen, wenn sie fuer Debugging zwingend erforderlich und minimiert sind.
- Fehler muessen im Request-Log-Kontext sichtbar sein.
- Keine separaten Erfolgs- und Abschlusslogs pro Request erzeugen, wenn dadurch mehr als ein Request-Log-Entry entsteht.

### 9. HTTP Responses Und Request ID

- Jede HTTP-Antwort enthaelt die Request ID im Header `X-Request-Id`.
- Das gilt fuer erfolgreiche Responses, Redirects und Fehlerresponses.
- Fehlerseiten sollen die Request ID sichtbar machen, damit Debugging ueber Logs moeglich ist.

## Architekturregeln

### Refactoring Triggers

Refactoring ist verpflichtend zu pruefen, wenn mindestens einer dieser Punkte zutrifft:

- Eine Funktion ueberschreitet 40 Zeilen produktiven Code.
- Eine Datei ueberschreitet 300 Zeilen produktiven Code.
- Eine Funktion hat mehr als 4 Parameter.
- Eine Funktion vermischt Validierung, Fachentscheidung, Persistenz und Rendering.
- Business-Regeln befinden sich in HTTP-Routen, Templates oder Datenbankadaptern.
- Derselbe fachliche Ablauf kommt an mehr als einer Stelle vor.
- Tests benoetigen komplexes Mocking fuer eigentlich fachliche Logik.
- Ein Modul importiert ueber eine verbotene Architekturgrenze hinweg.
- Ein Bug wurde durch unklare Struktur, unklare Namen oder Kopplung verursacht.
- Eine Aenderung erfordert Anpassungen an vielen unzusammenhaengenden Stellen.
- Fehlerbehandlung, Validierung oder Mapping wird inkonsistent umgesetzt.

### Code Structure Rules

- Core-Code darf keine Adapter-Imports enthalten.
- HTTP-Routen duerfen Use Cases orchestrieren, aber keine Business-Regeln enthalten.
- Datenbankadapter mappen zwischen DB-Records und Core-Modellen.
- Templates enthalten keine Berechnungen und keine fachlichen Entscheidungen.
- Validierung fachlicher Regeln gehoert in den Core.
- Validierung technischer Request-Formate gehoert in den HTTP-Adapter.
- Neue Abhaengigkeiten werden nur eingefuehrt, wenn Standardbibliothek oder vorhandene Tools nicht ausreichen.
- `any`, Type Assertions und Non-Null Assertions sind zu vermeiden und muessen lokal begruendet sein.
- Fehler werden explizit modelliert oder kontrolliert behandelt, nicht verschluckt.
- Module sollen klare Verantwortlichkeiten haben und nur die kleinste noetige API exportieren.

### Core

Der Core darf enthalten:

- Entities.
- Value Objects.
- Use Cases.
- Domain Services.
- Berechnungslogik.
- Validierungsregeln.
- Repository Port Interfaces.
- Clock Port Interfaces.
- Logging Port Interfaces, falls fachlich benoetigt.

Der Core darf nicht enthalten:

- Fastify Imports.
- Drizzle Imports.
- SQL-Verbindungslogik.
- Template Rendering.
- HTMX Details.
- OIDC Client Code.
- Prozessumgebungszugriff.
- Docker- oder Dateisystemannahmen, ausser ueber Ports.

### HTTP Adapter

- Routen orchestrieren Use Cases und rendern Responses.
- Routen enthalten keine Business-Regeln.
- HTMX Endpunkte liefern HTML-Fragmente.
- Nicht-HTMX Endpunkte liefern vollstaendige Seiten oder Redirects.
- Validierungsfehler werden nutzerfreundlich im UI dargestellt.

### Datenbankadapter

- Drizzle Schema und SQL-spezifische Details bleiben im Adapter.
- Adapter mappen zwischen DB-Records und Core-Modellen.
- Transaktionen werden explizit verwendet, wenn mehrere Schreiboperationen zusammengehoeren.

### Templates Und HTMX

- Templates duerfen keine Business-Logik enthalten.
- Templates duerfen nur Darstellung, einfache Bedingungen und Listenrendering enthalten.
- HTMX soll Interaktion vereinfachen, aber keine zweite Client-App erzeugen.

## Teststrategie

- E2E Tests pruefen Nutzerverhalten und Features.
- Unit-Tests pruefen Core-Regeln und Berechnungen.
- Integrationstests pruefen Adapter gegen echte oder realistische Infrastruktur.
- Testdaten muessen deterministisch sein.
- Finanzberechnungen brauchen explizite Randfalltests.
- Datumslogik muss mit kontrollierbarer Clock getestet werden.

## Sicherheitsregeln

- Secrets nur ueber Environment-Variablen.
- Keine Secrets in Repository-Dateien.
- `.env.example` darf nur Platzhalter enthalten.
- Cookies muessen sicher konfiguriert werden.
- OIDC Tokens duerfen nicht geloggt werden.
- CSV Uploads muessen begrenzt und validiert werden.
- Fehlerausgaben duerfen keine Secrets enthalten.

## Dokumentationsregeln

- `PLAN.md` beschreibt Produkt- und Architekturziel.
- `TASKS.md` beschreibt die phasenweise Umsetzung.
- `OPERATIONS.md` beschreibt Betrieb und Run Books.
- README beschreibt lokalen Start und Entwicklerkommandos.
- Wenn sich Verhalten, Setup oder Betrieb aendert, muss die passende Dokumentation aktualisiert werden.

## Deployment-Regeln

- Jeder Phasenstand muss deploybar sein.
- Docker Compose ist der Referenzbetrieb.
- Caddy laeuft extern und routet auf die App.
- Die App muss hinter Reverse Proxy korrekt mit `BASE_URL=https://finances.home.arpa` funktionieren.
- Healthchecks muessen fuer Betrieb und Debugging geeignet sein.

## Definition Of Ready Fuer Neue Features

- Fachliches Ziel ist klar.
- E2E-Szenario ist formulierbar.
- Betroffene Core-Regeln sind identifiziert.
- Betroffene Adapter sind identifiziert.
- Auswirkungen auf Operations Manual sind bekannt.

## Definition Of Done Fuer Neue Features

- Fehlschlagender E2E Test wurde zuerst erstellt.
- Fehlschlagende Core-/Integrationstests wurden zuerst erstellt, falls relevant.
- Produktivcode implementiert die kleinste korrekte Loesung.
- Core-Logik ist im Core und isoliert testbar.
- Adapter enthalten nur technische Integration.
- Dokumentation ist aktualisiert.
- `pnpm format:check` ist gruen.
- `pnpm lint` ist gruen.
- `pnpm test` ist gruen.
- `pnpm test:e2e` ist gruen.
- `pnpm build` ist gruen.
- Docker Build ist gruen, wenn Infrastruktur betroffen ist.
- Commit nutzt Conventional Commits.
