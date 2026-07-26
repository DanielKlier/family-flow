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
- UI: serverseitige Templates plus HTMX
- Template Engine: Nunjucks oder Eta
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

## Authentifizierung

- OIDC Login ueber Authentik.
- Alle App-Routen sind geschuetzt.
- Callback URL: `https://finances.home.arpa/auth/callback`.
- Sessions werden serverseitig bzw. signiert gespeichert.
- Authentifizierte Nutzer werden lokal anhand der OIDC Claims erkannt.

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

Der MVP unterstuetzt CSV-Import fuer:

- BW-Bank bzw. Sparkassen-CSV.
- Comdirect-CSV.

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

Duplikaterkennung erfolgt zunaechst ueber eine stabile Kombination aus Konto, Datum, Betrag und normalisiertem Beschreibungstext.

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

## Deploybares MVP-Ergebnis

Ein MVP gilt als deploybar, wenn:

- Docker Image gebaut werden kann.
- Docker Compose die Anwendung startet.
- Datenbankmigrationen laufen.
- OIDC-Konfiguration dokumentiert ist.
- Tests gruen sind.
- Linting gruen ist.
- Biome angewendet wurde.
- E2E Tests fuer neue Features existieren und gruen sind.
- Operations Manual fuer den aktuellen Stand aktualisiert ist.
