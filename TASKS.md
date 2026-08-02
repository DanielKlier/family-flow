# FamilyFlow Task List

Diese Task-Liste ist phasenbasiert. Nach jeder Phase muss der Stand commitfaehig, deploybar und nachvollziehbar sein.

Jede Phase endet mit einem Conventional Commit. Vor jedem Commit muessen Formatierung, Linting, Tests, Build und relevante E2E Tests erfolgreich laufen.

## Globale Definition Of Done

- Kein Feature ohne vorherigen fehlschlagenden E2E Test.
- Kein Produktivcode ohne vorherige fehlschlagende Tests.
- Core-Logik liegt in `src/core` und ist ohne Adapter testbar.
- Ports definieren Abhaengigkeiten des Core.
- Adapter enthalten Web, DB, OIDC, CSV, Logging und Template-Integration.
- `pnpm format` wurde ausgefuehrt.
- `pnpm lint` ist gruen.
- `pnpm test` ist gruen.
- `pnpm test:e2e` ist fuer relevante Features gruen.
- `pnpm build` ist gruen.
- Docker Image baut erfolgreich.
- Docker Compose startet die App erfolgreich.
- Operations Manual ist fuer neue Betriebsablaeufe aktualisiert.
- Commit Message folgt Conventional Commits.

## Phase 0: Repository Bootstrap

Ziel: Ein leeres, lauffaehiges Node.js/TypeScript-Projekt mit Qualitaets-Gates und Grunddokumentation.

Tasks:

- `package.json` mit Scripts fuer `dev`, `build`, `test`, `test:e2e`, `lint`, `format`, `format:check` anlegen.
- TypeScript konfigurieren.
- Biome fuer Formatierung und Linting konfigurieren.
- Test-Framework fuer Unit- und Integrationstests einrichten.
- E2E-Test-Framework einrichten.
- Minimale Fastify-App mit Healthcheck vorbereiten.
- Dockerfile anlegen.
- Docker Compose mit App und PostgreSQL anlegen.
- `.env.example` anlegen.
- Grundstruktur fuer Ports-and-Adapters anlegen.
- Erstes Operations Manual als `OPERATIONS.md` anlegen.
- README mit Projektstart und lokalen Kommandos anlegen.

Tests:

- Fehlschlagender E2E Test fuer `GET /health` schreiben.
- Minimalen Healthcheck implementieren.
- Unit-Test fuer Konfigurationsvalidierung schreiben.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `chore: bootstrap node project`

## Phase 1: Request Lifecycle, Logging Und Request IDs

Ziel: Jeder Request hat eine eindeutige Request ID, jede Response enthaelt `X-Request-Id`, und jeder Request erzeugt exakt einen strukturierten Request-Log-Entry.

Tasks:

- Request-ID-Port im Core definieren, falls fachlich benoetigt.
- HTTP Adapter Middleware fuer Request IDs implementieren.
- Logging-Port definieren.
- Human-readable stdout Logger implementieren.
- JSON Logger Interface vorbereiten, ohne zentrale Senke zu integrieren.
- Genau-ein-Request-Log-Entry-Verhalten implementieren.
- Fehler-Logging in denselben Request-Log-Entry integrieren.
- Operations Manual um Logging, Request IDs und Debugging erweitern.

Tests:

- Fehlschlagender E2E Test: `X-Request-Id` ist bei erfolgreicher Response vorhanden.
- Fehlschlagender E2E Test: `X-Request-Id` ist bei Fehlerresponse vorhanden.
- Fehlschlagender Integrationstest: ein Request erzeugt exakt einen Request-Log-Entry.
- Unit-Tests fuer Log-Kontext-Normalisierung ohne Secrets.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `feat: add request logging and request ids`

## Phase 2: Datenbank, Migrationen Und Stammdaten-Core

Ziel: PostgreSQL, Drizzle, Migrationen und Core-Modelle fuer Konten und Kategorien sind einsatzbereit.

Tasks:

- Drizzle konfigurieren.
- Datenbankadapter einrichten.
- Migrations-Script anlegen.
- Tabellen fuer Accounts und Categories anlegen.
- Core Entities und Value Objects fuer Accounts und Categories implementieren.
- Repository Ports fuer Accounts und Categories definieren.
- Drizzle Repository Adapter implementieren.
- Seed fuer initiale Konten und Kategorien vorbereiten.
- Admin-/Stammdaten-Routen mit serverseitigen Templates anlegen.
- Operations Manual um Migrationen und Seeds erweitern.

Tests:

- Fehlschlagender E2E Test: Kontenliste ist nach Seed sichtbar.
- Fehlschlagender E2E Test: Kategorienliste ist nach Seed sichtbar.
- Unit-Tests fuer Account- und Category-Core-Regeln.
- Integrationstests fuer Repository Adapter gegen Testdatenbank.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`
- `docker compose up` startet mit Migrationen.

Commit:

- `feat: add accounts and categories`

## Phase 3: OIDC Authentifizierung Mit Authentik

Ziel: Alle App-Routen sind geschuetzt und Login/Logout laufen ueber Authentik.

Tasks:

- OIDC-Konfiguration validieren.
- Auth-Port fuer Nutzerkontext definieren.
- OIDC Adapter mit Authentik integrieren.
- Session Handling implementieren.
- Login-, Callback- und Logout-Routen implementieren.
- Protected-route Hook implementieren.
- Lokalen Testmodus fuer E2E Tests bereitstellen, ohne echte Authentik-Instanz zu benoetigen.
- Nutzerkontext in Request-Logging aufnehmen.
- Operations Manual um Authentik Setup und OIDC Debugging erweitern.

Tests:

- Fehlschlagender E2E Test: nicht authentifizierter Zugriff redirectet zum Login.
- Fehlschlagender E2E Test: authentifizierter Testnutzer sieht Dashboard-Shell.
- Fehlschlagender E2E Test: Logout beendet Session.
- Unit-Tests fuer Auth-Konfiguration.
- Integrationstests fuer Session Handling.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `feat: add oidc authentication`

## Phase 4: Manuelle Transaktionen Und Filter

Ziel: Ausgaben koennen manuell als gebucht oder geplant erfasst, bearbeitet, geloescht und gefiltert werden.

Tasks:

- Transaction Core Entity und Regeln implementieren.
- Transaction Repository Port definieren.
- Drizzle Schema und Migration fuer Transaktionen anlegen.
- Transaction Repository Adapter implementieren.
- Routen und Templates fuer Transaktionsliste anlegen.
- HTMX-Formular fuer neue manuelle Ausgabe anlegen.
- Bearbeiten und Loeschen implementieren.
- Filter fuer Monat, Konto, Besitzer-Kontext, Kategorie, Status und Fixkostenstatus implementieren.
- Fixkosten-Markierung unterstuetzen.
- Operations Manual um manuelle Korrektur und Datenpflege erweitern.

Tests:

- Fehlschlagender E2E Test: manuelle Ausgabe anlegen.
- Fehlschlagender E2E Test: geplante Ausgabe anlegen.
- Fehlschlagender E2E Test: Transaktion bearbeiten.
- Fehlschlagender E2E Test: Transaktion loeschen.
- Fehlschlagender E2E Test: nach Person/Gemeinsam filtern.
- Unit-Tests fuer Transaction-Core-Regeln.
- Integrationstests fuer Transaction Repository.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `feat: add manual transactions`

## Phase 5: Initiales Styling Und Einsatz Von HTMX

Ziel: Die bestehende serverseitige UI wird bedienbar gestaltet, Styling wird aus HTML ausgelagert, und Formularinteraktionen aktualisieren relevante Bereiche per HTMX statt die ganze Seite neu zu laden.

Tasks:

- Zentrales Stylesheet fuer die Web-Oberflaeche anlegen und ueber alle HTML-Seiten ausliefern.
- Inline-Styles aus ausgeliefertem HTML entfernen.
- Stabile IDs und CSS-Klassen fuer Layout, Navigation, Formulare, Tabellen, Meldungen und HTMX-Zielbereiche einfuehren.
- Gemeinsames Seitenlayout fuer Dashboard, Stammdaten und Transaktionen etablieren.
- Transaktionsformular per HTMX so umbauen, dass erfolgreiche Erstellung, Bearbeitung und Loeschung nur die Transaktionsliste bzw. relevante Fragmente aktualisieren.
- Filterformular per HTMX so umbauen, dass Filterergebnisse ohne Full-Page-Reload aktualisiert werden.
- Fehler- und Validierungsmeldungen in Formularfragmenten nutzerfreundlich anzeigen.
- Progressive Enhancement sicherstellen: Basisfunktionen muessen ohne JavaScript weiterhin nutzbar bleiben.
- Operations Manual um statische Assets, Stylesheet-Auslieferung und HTMX-Debugging erweitern.

Tests:

- Fehlschlagender E2E Test: Stylesheet wird mit Transaktionsseite ausgeliefert.
- Fehlschlagender E2E Test: ausgeliefertes App-HTML enthaelt keine Inline-Style-Attribute.
- Fehlschlagender E2E Test: Transaktion anlegen aktualisiert per HTMX die Liste ohne Full-Page-Reload.
- Fehlschlagender E2E Test: Filter aktualisiert per HTMX die Liste ohne Full-Page-Reload.
- Fehlschlagender E2E Test: Transaktionsformular bleibt ohne JavaScript nutzbar.
- Integrationstest fuer statische Asset-Auslieferung mit korrektem Content-Type.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `feat: add initial styling and htmx interactions`

## Phase 6: CSV-Import Fuer Bank-CSV-Dateien

Ziel: CSV-Dateien koennen mit Importprofilen hochgeladen, geprueft, kategorisiert und importiert werden.

Tasks:

- ImportProfile Core Entity implementieren.
- CSV Parser Port definieren.
- CSV Adapter implementieren.
- Drizzle Schema fuer Importprofile anlegen.
- Importprofile ohne konkrete Default-Daten anlegbar machen.
- Upload-Route implementieren.
- Mapping-UI implementieren.
- Vorschau-UI implementieren.
- Duplikaterkennung im Core implementieren.
- Import-Bestaetigung implementieren.
- Import-Fehler menschenlesbar anzeigen.
- Operations Manual um CSV-Import Run Book erweitern.

Tests:

- Fehlschlagender E2E Test: Beispiel-CSV mit Importprofil A importieren.
- Fehlschlagender E2E Test: Beispiel-CSV mit Importprofil B importieren.
- Fehlschlagender E2E Test: Duplikate werden markiert und nicht doppelt importiert.
- Unit-Tests fuer CSV-Normalisierung.
- Unit-Tests fuer Import-Hash und Duplikaterkennung.
- Integrationstests fuer Importprofile.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `feat: add csv transaction imports`

## Phase 7: Kategorisierungsregeln

Ziel: Transaktionen koennen automatisch anhand einfacher Textregeln kategorisiert werden.

Tasks:

- CategorizationRule Core Entity implementieren.
- Rule Matching im Core implementieren.
- Repository Port und Drizzle Adapter fuer Regeln implementieren.
- Migration fuer Regeln anlegen.
- UI fuer Regelverwaltung implementieren.
- Optionale Konto-Einschraenkung fuer Regeln implementieren.
- Regeln beim CSV-Import anwenden.
- Regeln auf bestehende Transaktionen anwenden.
- Operations Manual um Regelpflege erweitern.

Tests:

- Fehlschlagender E2E Test: Regel anlegen und beim Import anwenden.
- Fehlschlagender E2E Test: Regel auf bestehende Transaktionen anwenden.
- Unit-Tests fuer Rule Matching, Normalisierung und Prioritaet.
- Integrationstests fuer Rule Repository.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `feat: add categorization rules`

## Phase 8: Stammdaten Bearbeiten

Ziel: Konten und Kategorien koennen nach dem initialen Seed ueber die Web-Oberflaeche gepflegt werden.

Tasks:

- [x] Account-Core-Regeln fuer Bearbeiten, Aktivieren und Deaktivieren ergaenzen.
- [x] Category-Core-Regeln fuer Bearbeiten, Aktivieren und Deaktivieren ergaenzen.
- [x] Repository Ports und Drizzle Adapter um notwendige Schreiboperationen erweitern.
- [x] Migrationen nur ergaenzen, falls fuer Aktiv-/Sortierstatus oder fachliche Constraints notwendig.
- [x] UI fuer Kontenverwaltung um Anlegen, Bearbeiten und Deaktivieren erweitern.
- [x] UI fuer Kategorienverwaltung um Anlegen, Bearbeiten und Deaktivieren erweitern.
- [x] Validierungsfehler nutzerfreundlich in Stammdatenformularen anzeigen.
- [x] Sicherstellen, dass deaktivierte Stammdaten bestehende Transaktionen nicht beschaedigen.
- [x] Operations Manual um Stammdatenpflege erweitern.

Tests:

- [x] Fehlschlagender E2E Test: Konto anlegen und in Transaktionsformular verwenden.
- [x] Fehlschlagender E2E Test: Konto bearbeiten.
- [x] Fehlschlagender E2E Test: Konto deaktivieren, ohne bestehende Transaktionen zu verlieren.
- [x] Fehlschlagender E2E Test: Kategorie anlegen und in Transaktionsformular verwenden.
- [x] Fehlschlagender E2E Test: Kategorie bearbeiten.
- [x] Fehlschlagender E2E Test: Kategorie deaktivieren, ohne bestehende Transaktionen zu verlieren.
- [x] Unit-Tests fuer Account- und Category-Core-Regeln.
- [x] Integrationstests fuer Account- und Category-Repository-Schreiboperationen.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `feat: add master data management`

## Phase 9: Einnahmenplanung

Ziel: Wiederkehrende Einnahmen und monatliche Abweichungen koennen gepflegt und ausgewertet werden.

Tasks:

- [x] IncomePlan Core Entity implementieren.
- [x] Monthly Income Override Core Logik implementieren.
- [x] Repository Port und Adapter implementieren.
- [x] Migrationen fuer Einnahmen anlegen.
- [x] UI fuer Einnahmenliste anlegen.
- [x] HTMX-Formulare fuer Einnahmen anlegen und bearbeiten.
- [x] Besitzer-Kontext fuer Einnahmen unterstuetzen.
- [x] Monatsberechnung fuer geplante Einnahmen implementieren.
- [x] Operations Manual um Einnahmenpflege erweitern.

Tests:

- [x] Fehlschlagender E2E Test: wiederkehrende Einnahme anlegen.
- [x] Fehlschlagender E2E Test: monatliche Abweichung erfassen.
- [x] Fehlschlagender E2E Test: Einnahmen nach Person filtern.
- [x] Unit-Tests fuer Monatsberechnung.
- [x] Integrationstests fuer Income Repository.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `feat: add income planning`

## Phase 10: Bearbeitbare Account-Owner

Ziel: Die Anzeigenamen der fachlichen Account-Owner koennen bearbeitet werden; diese Owner bleiben reine Auswertungs- und Filterkontexte und haben keinen Bezug zum eingeloggten Nutzer.

Tasks:

- [x] OwnerContext Core Entity oder Value Object fuer stabile Owner-Schluessel und editierbare Anzeigenamen implementieren.
- [x] Repository Port und Drizzle Adapter fuer Owner-Anzeigenamen implementieren.
- [x] Migration fuer persistierte Owner-Anzeigenamen anlegen und idempotente Defaults fuer `person_a`, `person_b` und `shared` bereitstellen.
- [x] Account-Core-Regeln so anpassen, dass Konten weiterhin stabile Owner-Schluessel referenzieren.
- [x] UI fuer Owner-Namen in der Stammdatenverwaltung implementieren.
- [x] Owner-Anzeigenamen in Kontenlisten, Transaktionsfiltern, Einnahmenfiltern und Auswertungen anzeigen.
- [x] Sicherstellen, dass Owner-Anzeigenamen nicht aus OIDC Claims oder eingeloggten Nutzern abgeleitet werden.
- [x] Operations Manual um Pflege der Owner-Anzeigenamen erweitern.

Tests:

- [x] Fehlschlagender E2E Test: Owner-Anzeigenamen bearbeiten und in der Kontenverwaltung sehen.
- [x] Fehlschlagender E2E Test: geaenderte Owner-Anzeigenamen erscheinen in Transaktions- und Einnahmenfiltern.
- [x] Unit-Tests fuer OwnerContext-Core-Regeln und stabile Owner-Schluessel.
- [x] Integrationstests fuer OwnerContext Repository.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `feat: add editable account owner names`

## Phase 11: Interne Umbuchungen Ausschliessen

Ziel: Geldbewegungen zwischen eigenen Familienkonten fliessen nicht in Kosten-, Ausgaben- oder Prognoseberechnungen ein; nur Geld, das eines der Familienkonten verlaesst, wird als Ausgabe beruecksichtigt.

Tasks:

- Transaction-Core-Regeln um interne Transfer-Klassifikation erweitern.
- Modellieren, wie ein interner Transfer manuell markiert oder beim CSV-Import erkannt werden kann, ohne Buchungen zwischen Konten doppelt als Kosten zu zaehlen.
- Repository- und Query-Modelle so erweitern, dass interne Transfers gespeichert und gezielt ausgeschlossen werden koennen.
- UI fuer manuelle Transaktionen und importierte Transaktionen um interne Transfer-Markierung erweitern.
- Dashboard-, Durchschnitts- und Forecasting-Core so anpassen, dass interne Transfers aus Kostenberechnungen ausgeschlossen sind.
- Filter oder Kennzeichnung bereitstellen, damit interne Transfers in Transaktionslisten weiterhin nachvollziehbar bleiben.
- Operations Manual um Umgang mit internen Umbuchungen und Korrekturen erweitern.

Tests:

- Fehlschlagender E2E Test: Umbuchung zwischen zwei eigenen Konten veraendert die Monatsausgaben nicht.
- Fehlschlagender E2E Test: interne Transfers bleiben in der Transaktionsliste sichtbar und sind als solche erkennbar.
- Unit-Tests fuer Transfer-Klassifikation und Ausgabenaggregation.
- Integrationstests fuer Persistenz und Dashboard Queries mit internen Transfers.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `feat: exclude internal transfers from expenses`

## Phase 12: Deutsche Lokalisierung

Ziel: Die Anwendung ist fuer deutsche Nutzer lokalisiert; UI-Texte sind deutsch, Betraege und Datumswerte werden im deutschen Format angezeigt und eingegeben.

Tasks:

- Zentrale Ports oder Core-nahe Services fuer Geld- und Datumsformatierung definieren, ohne Locale-Logik in Templates zu verteilen.
- Deutsche Anzeigeformate fuer Betraege, Datumswerte und Monate in Listen, Formularen, Filtern, Dashboard und Szenarien verwenden.
- Deutsche Eingabeformate fuer Betraege und Datumswerte validieren und in Core-Werte normalisieren.
- Bestehende UI-Texte, Formularlabels, Validierungsfehler und Hilfetexte ins Deutsche ueberfuehren.
- CSV-Import so pruefen, dass deutsche Dezimal- und Datumsformate robust verarbeitet werden, sofern sie im Importprofil konfiguriert sind.
- Operations Manual und README um deutsche Eingabeformate und Lokalisierungsverhalten erweitern.

Tests:

- Fehlschlagender E2E Test: Betrag im Format `1.234,56` eingeben und korrekt gespeichert sowie angezeigt bekommen.
- Fehlschlagender E2E Test: Datum im Format `31.12.2026` eingeben und korrekt gespeichert sowie angezeigt bekommen.
- Fehlschlagender E2E Test: zentrale Nutzerflaechen zeigen deutsche Texte.
- Unit-Tests fuer Geld- und Datumsformatierung sowie Parsing.
- Integrationstests fuer Formularverarbeitung mit deutschen Eingabeformaten.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `feat: add german localization`

## Phase 13: Dashboard Und Monatsprognose

Ziel: Dashboard zeigt Ist-Ausgaben, Einnahmen, Saldo, Kategorien und Monatsprognose.

Tasks:

- Forecasting Core Service implementieren.
- Aggregations-Ports definieren oder bestehende Repositories nutzen.
- Dashboard Query im Core formulieren.
- Dashboard Route und Template implementieren.
- HTMX-Filter fuer Monat, Konto, Person/Gemeinsam und Kategorie implementieren.
- Prognose fuer Fixkosten, geplante Ausgaben und variable Ausgaben implementieren.
- Vergleich mit 3-, 6- und 12-Monatsdurchschnitt implementieren.
- Operations Manual um Dashboard-Interpretation und bekannte Grenzen erweitern.

Tests:

- Fehlschlagender E2E Test: Dashboard zeigt Monatsausgaben.
- Fehlschlagender E2E Test: Dashboard zeigt Monatsprognose.
- Fehlschlagender E2E Test: Dashboard-Filter nach Person aktualisiert Werte.
- Unit-Tests fuer Forecasting Core.
- Unit-Tests fuer Durchschnittsberechnung.
- Integrationstests fuer Dashboard Queries.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `feat: add dashboard forecasting`

## Phase 14: Szenarienplanung

Ziel: Elternzeit-, Elterngeld- und Teilzeit-Szenarien koennen ueber 18 bis 24 Monate geplant werden.

Tasks:

- Scenario Core Entities implementieren.
- Scenario Adjustment Core Entities implementieren.
- Szenario-Berechnungsservice implementieren.
- Repository Ports und Adapter implementieren.
- Migrationen fuer Szenarien anlegen.
- UI fuer Szenarienliste anlegen.
- UI fuer Szenario-Erstellung anlegen.
- Monats-Tabelle fuer Einnahmen, Ausgaben, Saldo und Puffer implementieren.
- Anpassungen fuer Zeitraeume implementieren.
- Startpuffer und Basis-Ausgabenmodus implementieren.
- Hilfeseite mit externen Rechner-Links implementieren.
- Operations Manual um Szenarienpflege erweitern.

Tests:

- Fehlschlagender E2E Test: Szenario anlegen.
- Fehlschlagender E2E Test: Elternzeit-/Elterngeld-Anpassung eintragen.
- Fehlschlagender E2E Test: Pufferverlauf wird berechnet.
- Fehlschlagender E2E Test: Linkseite fuer Rechner ist erreichbar.
- Unit-Tests fuer Szenario-Berechnungen.
- Unit-Tests fuer Zeitraum-Anpassungen.
- Integrationstests fuer Scenario Repository.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`

Commit:

- `feat: add scenario planning`

## Phase 15: Deployment Hardening Und MVP Release

Ziel: Der MVP ist lokal stabil deploybar, dokumentiert und betreibbar.

Tasks:

- Docker Compose fuer Produktionsbetrieb pruefen.
- Caddy-Reverse-Proxy-Beispiel dokumentieren.
- Environment-Variablen vollstaendig dokumentieren.
- Healthchecks fuer App und Datenbank ergaenzen.
- Backup- und Restore-Runbook finalisieren.
- Update-Runbook finalisieren.
- Debugging-Runbooks finalisieren.
- Security Review fuer Cookies, Headers und Secrets durchfuehren.
- Testdaten und Beispiel-CSV-Dateien anonymisieren und dokumentieren.
- README finalisieren.
- MVP Release Checklist anlegen.

Tests:

- Voller E2E Smoke Test gegen Docker Compose.
- Build-Test des Docker Images.
- Migrationstest auf leerer Datenbank.
- Restore-Test anhand eines Test-Backups dokumentieren oder automatisieren.

Quality Gate:

- `pnpm format:check`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `docker compose build`
- `docker compose up` Smoke Test.

Commit:

- `chore: prepare mvp deployment`

## Conventional Commit Beispiele

- `feat: add manual transactions`
- `fix: prevent duplicate csv imports`
- `test: cover scenario buffer calculations`
- `docs: add backup runbook`
- `chore: update lint configuration`
- `refactor: isolate transaction core service`

## Laufende Backlog-Ideen Nach Dem MVP

- Automatischer Bankimport via FinTS/HBCI.
- Interner Brutto-Netto- oder Teilzeit-Rechner.
- Interner Elterngeldrechner.
- Bessere Prognosemodelle fuer variable Ausgaben.
- Wiederkehrende Ausgaben automatisch erkennen und als Fixkosten vorschlagen.
- Matching von geplanten und gebuchten Transaktionen.
- Export nach CSV oder PDF.
- Diagramme fuer Szenarien und Kategorieentwicklung.
- Zentrale JSON-Logging-Integration.
