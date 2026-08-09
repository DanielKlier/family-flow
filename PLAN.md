# FamilyFlow MVP Plan

FamilyFlow ist eine lokale Web-Anwendung fuer Haushalts- und Familienfinanzplanung. Der erste MVP laeuft im lokalen Netzwerk unter `finances.home.arpa`, wird per Docker Compose deployed und nutzt Authentik als OIDC Provider.

## Ziele

- Monatliche Ausgaben ueber mehrere Bankkonten erfassen und kategorisieren.
- Monatliche Einnahmen erfassen und fuer Planungen verwenden.
- Laufende Schaetzung der monatlichen Gesamtausgaben anzeigen.
- Szenarien fuer Elternzeit, Elterngeld und Teilzeitbeschaeftigung planen.
- Finanzielle Entwicklung bis zum Kita-Start des Kindes ueber 18 bis 24 Monate abschaetzen.
- Die Anwendung soll lokal, nachvollziehbar, testbar und sicher betreibbar sein.

## Nicht-Ziele Im MVP

- Keine automatische Bankanbindung via FinTS, HBCI oder Open Banking.
- Keine interne Steuer-, Gehalts- oder Elterngeldberechnung.
- Keine komplexen Rollen oder Berechtigungen zwischen den beiden Nutzern.
- Keine Mehrmandantenfaehigkeit.
- Keine Mobile App.
- Keine zentrale Logging-Integration im MVP, aber die Architektur muss sie vorbereiten.

## Nutzer Und Konten

Die Anwendung wird initial von zwei gleichberechtigten Personen genutzt. Alle authentifizierten Nutzer duerfen alle Daten sehen und bearbeiten. Es gibt keine Zugriffstrennung auf Rollenebene.

Konten werden mit einem fachlichen Besitzer-Kontext versehen:

- `person_a`: persoenliches Girokonto Person A
- `person_b`: persoenliches Girokonto Person B
- `shared`: gemeinsames Girokonto

Diese Zuordnung dient ausschliesslich der Filterung und Auswertung, nicht der Zugriffskontrolle.

## Technischer Stack

- Runtime: Node.js mit TypeScript
- Web Framework: Fastify
- UI: server-rendered Nunjucks templates through `@fastify/view`, plus HTMX
- Template engine: Nunjucks with global automatic escaping
- Datenbank: PostgreSQL
- Datenzugriff: Drizzle ORM
- Authentifizierung: OIDC gegen Authentik mit Session-Cookies
- Deployment: Docker Compose
- Reverse Proxy: vorhandener Caddy
- Formatierung und Linting: Biome
- Tests: Unit-/Integrationstests fuer Core und Adapter, E2E Tests fuer Features

## Architektur

FamilyFlow wird nach Ports-and-Adapters organisiert.

Der Core enthaelt die vollstaendige Anwendungslogik und ist ohne Webserver, Datenbank, Templates oder externe Services testbar. Adapter implementieren Datenbankzugriff, HTTP, OIDC, Logging, CSV-Verarbeitung und UI.

Geplante Struktur:

```text
src/
  core/
    accounts/
    categories/
    transactions/
    imports/
    income/
    forecasting/
    scenarios/
    shared/
  ports/
    repositories/
    auth/
    logging/
    clock/
  adapters/
    db/
    http/
    oidc/
    logging/
    csv/
    templates/
  app/
    composition-root.ts
    config.ts
    server.ts
  views/
    layouts/
    pages/
    partials/
  tests/
    e2e/
    integration/
    unit/
```

### Server-Rendered UI And Template Boundary

Nunjucks is the single server-side template engine and is integrated through `@fastify/view`. Automatic escaping is enabled globally.

HTTP and template adapters prepare typed view models before rendering. View models contain presentation-ready labels, translated messages, formatted money and date strings, links, and simple display flags. Templates are limited to presentation, simple conditions, and list rendering. They do not parse input, calculate financial values, choose business outcomes, access repositories, or call use cases.

Untrusted values remain ordinary escaped template values. Any use of pre-rendered or explicitly safe HTML requires a narrow, reviewed adapter boundary and must not be used for user-controlled content.

The core does not depend on Nunjucks, `@fastify/view`, HTMX, translation catalogs, or presentation view models.

### Localization Boundaries

Core values are locale-neutral. Money is represented as integer minor units, dates and months use canonical domain representations, and business failures use typed domain error codes rather than translated user-facing strings.

Translation catalogs, German UI text, `de-DE` money and date formatting, and parsing of human-entered amounts and dates belong to HTTP, template, or localization adapters. These adapters convert accepted human input into canonical core values and map typed domain errors to translated messages.

CSV encoding, delimiter, decimal, date, and bank-profile formats belong to the CSV adapter. The CSV adapter validates and converts source-specific values before passing canonical rows to the import core.

Templates receive already translated and formatted view models. Neither templates nor the core perform locale-sensitive parsing or formatting.

## Authentifizierung

- OIDC login uses Authentik.
- All application routes except explicitly public health, authentication, and static-asset routes are protected.
- Callback URL: `https://finances.home.arpa/auth/callback`.
- The signed-cookie session implementation delivered in historical Phase 3 is an interim implementation and will be replaced through the test-first remediation in Phase 10A of `TASKS.md`.
- The target session cookie contains only an opaque, cryptographically random 256-bit bearer token.
- PostgreSQL stores only the SHA-256 hash of the bearer token together with a session ID, user context, creation time, expiry time, and optional revocation time. The raw bearer token is never persisted.
- A session is accepted only when its token hash exists and the record is neither expired nor revoked.
- Logout revokes the matching server-side record before expiring the browser cookie, so a copied token cannot be replayed after logout.
- Expired and revoked records are removed by an idempotent, bounded cleanup operation. Authentication correctness does not depend on cleanup having already run.
- Session data is included in PostgreSQL backup scope and is security-sensitive. Restore procedures invalidate all restored sessions before the application is reopened to users.
- Existing signed cookies are not migrated and become invalid when the remediation is deployed.
- Redis or another session service is not part of the architecture.
- Authenticated users are identified locally from validated OIDC claims stored in the server-side session record.

## Hauptfunktionen

### Dashboard

Das Dashboard zeigt fuer den aktuellen Monat:

- Bisherige Ausgaben.
- Bisherige Einnahmen.
- Aktueller Saldo.
- Geschaetzte Ausgaben bis Monatsende.
- Ausgaben nach Kategorie.
- Ausgaben nach Konto und Besitzer-Kontext.
- Vergleich mit Durchschnitt der letzten 3, 6 und 12 Monate.

Filter:

- Alle Konten.
- Person A.
- Person B.
- Gemeinsam.
- Einzelnes Konto.
- Kategorie.
- Monat.

### Transaktionen

Transaktionen bilden Ausgaben und optional geplante Ausgaben ab.

Felder:

- Konto.
- Datum.
- Betrag.
- Beschreibung.
- Empfaenger optional.
- Kategorie.
- Quelle: `csv` oder `manual`.
- Status: `booked` oder `planned`.
- Fixkosten-Markierung.
- Notiz.
- Import-Hash fuer Duplikaterkennung.

Der MVP unterstuetzt:

- Manuelle Ausgabe erfassen.
- Geplante Ausgabe erfassen.
- CSV-importierte Ausgaben anzeigen.
- Transaktionen bearbeiten.
- Transaktionen loeschen.
- Nach Monat, Konto, Besitzer-Kontext, Kategorie und Status filtern.

### CSV-Import

Der MVP unterstuetzt CSV-Import fuer manuell konfigurierte Bankprofile.

Der Import ist profilbasiert:

- Datei hochladen.
- Konto auswaehlen.
- Importprofil auswaehlen oder anlegen.
- CSV-Trennzeichen und Encoding erkennen bzw. anpassen.
- Spalten fuer Datum, Betrag, Beschreibung, Empfaenger und Verwendungszweck mappen.
- Vorschau anzeigen.
- Kategorisierungsregeln anwenden.
- Duplikate markieren.
- Import bestaetigen.

Duplikaterkennung erfolgt zunaechst ueber eine stabile Kombination aus Konto, Datum, Betrag, normalisiertem Beschreibungstext und normalisiertem Empfaenger.

Upload security and confirmation requirements:

- A CSV file is limited to 5 MiB and 10,000 data rows, counted before ignored rows are filtered.
- Multipart body size and extracted file size are both bounded.
- Filename and MIME type are advisory; the actual bytes, selected encoding, CSV structure, mapped columns, and row content are validated before preview.
- Malformed UTF-8, binary or NUL-containing content, malformed quoting, unsupported encodings, and structurally invalid rows are rejected.
- Encoding, delimiter, decimal, date, and profile-specific interpretation remain in the CSV adapter. The import core receives canonical locale-neutral rows.
- Confirmation revalidates canonical rows and recomputes import hashes instead of trusting client-provided hashes.
- All accepted rows are persisted in one PostgreSQL transaction. Unexpected failure rolls back the entire confirmation.
- A database uniqueness constraint and conflict-safe insertion make repeated and concurrent confirmation idempotent.
- CSV content and unnecessary financial details are never written to logs. Rejections remain correlated through `X-Request-Id`.

### Kategorien Und Regeln

Initiale Kategorien:

- Wohnen/Miete
- Lebensmittel
- Drogerie
- Versicherungen
- Mobilitaet
- Gesundheit
- Kind/Baby
- Abos
- Freizeit
- Urlaub
- Kleidung
- Sonstiges

Kategorisierungsregeln:

- Regel basiert auf Textfragmenten in Beschreibung, Empfaenger oder Verwendungszweck.
- Regel kann optional auf ein Konto beschraenkt werden.
- Regeln werden beim CSV-Import und bei manueller Aktualisierung angewendet.

### Einnahmen

Einnahmen werden im MVP als Planwerte erfasst, nicht primaer aus Banktransaktionen abgeleitet.

Unterstuetzt werden:

- Wiederkehrende Einnahmen.
- Zeitraum mit Startmonat und optionalem Endmonat.
- Besitzer-Kontext: Person A, Person B oder gemeinsam.
- Monatliche Ueberschreibungen fuer abweichende Monate.

Beispiele:

- Gehalt Person A.
- Gehalt Person B.
- Kindergeld.
- Elterngeld.
- Teilzeitgehalt.
- Sonstige Einnahmen.

### Monatsprognose

Die erste Prognose berechnet:

```text
geschaetzte_monatsausgaben = bereits_gebuchte_fixkosten
  + erwartete_noch_offene_fixkosten
  + variable_ausgaben_bisher / vergangene_tage_im_monat * tage_im_monat
```

Fixkosten koennen an Transaktionen markiert werden. Geplante Ausgaben koennen in die Prognose einfliessen, werden aber im UI klar von gebuchten Ausgaben getrennt.

### Szenarienplanung

Szenarien dienen der groben Vorausplanung fuer Elternzeit, Elterngeld und Teilzeit.

Ein Szenario enthaelt:

- Name.
- Startmonat.
- Endmonat.
- Startpuffer.
- Basis-Ausgabenmodus: Durchschnitt der letzten 3, 6 oder 12 Monate oder manueller Wert.
- Monatliche Einnahmen.
- Monatliche Ausgaben.
- Anpassungen fuer einzelne Monate oder Zeitraeume.

Typische Anpassungen:

- Elternzeit Person A.
- Elternzeit Person B.
- Teilzeit-Netto Person A.
- Teilzeit-Netto Person B.
- Elterngeld.
- Kindergeld.
- Zusaetzliche Kinderkosten.
- Kita-Kosten ab Monat X.

Ergebnisse:

- Monatlicher Saldo.
- Kumulierter Puffer.
- Niedrigster Puffer.
- Monatliche Finanzierungsluecke.
- Benoetigtes Zusatznetto.

Der MVP arbeitet mit manuell eingegebenen Netto-Werten. Fuer Gehalt, Teilzeit und Elterngeld werden externe Rechner verlinkt.

### Rechner Und Links

Eine Hilfeseite enthaelt Links zu kostenlosen externen Rechnern:

- Elterngeldrechner des Familienportals: `https://familienportal.de/familienportal/rechner-antraege/elterngeldrechner`
- BMF Steuerrechner: `https://www.bmf-steuerrechner.de`

Die berechneten Werte werden manuell in FamilyFlow uebernommen.

## Logging Und Request IDs

Jeder HTTP Request erhaelt eine eindeutige Request ID.

Anforderungen:

- Jede HTTP Response enthaelt `X-Request-Id`.
- Jeder Request erzeugt exakt einen strukturierten Request-Log-Entry.
- Logs in stdout muessen fuer Docker menschenlesbar sein.
- JSON Logs mit viel Kontext muessen architektonisch vorbereitet sein.
- Zentrale Logging-Loesung ist tbd und nicht Teil des MVP.

Request-Log-Kontext:

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

## Operations Manual

Das Projekt enthaelt ein ausfuehrliches Operations Manual mit Run Books fuer:

- Lokale Entwicklung.
- Erstdeployment.
- Updates.
- Datenbankmigrationen.
- Backup und Restore.
- Debugging.
- OIDC-Probleme.
- CSV-Import-Probleme.
- Log-Analyse.
- Server-side session cleanup, forced logout during migration, and invalidation after restore.
- CSV upload limits, validation failures, atomic rollback, and concurrency-safe retry behavior.
- Nunjucks template packaging and rendering diagnostics.

## Deploybares MVP-Ergebnis

Ein MVP gilt als deploybar, wenn:

- Docker Image gebaut werden kann.
- Docker Compose die Anwendung startet.
- Datenbankmigrationen laufen.
- OIDC-Konfiguration dokumentiert ist.
- `pnpm format:check` is green.
- `pnpm lint` is green.
- `pnpm test` is green.
- `pnpm test:e2e` is fully green.
- `pnpm build` is green.
- New features have behavior-focused E2E tests that were observed failing before implementation.
- Operations Manual fuer den aktuellen Stand aktualisiert ist.
