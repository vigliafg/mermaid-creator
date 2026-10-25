import type { DiagramVariant } from "./catalog";

/**
 * Sette varianti aggiuntive per ogni tipo del catalogo. Insieme alle tre
 * varianti storiche fanno 10 esempi per tipo, mostrati dentro la card.
 */
export const EXTRA_VARIANTS: Record<string, DiagramVariant[]> = {
  flowchart: [
    {
      id: "ciclo",
      name: "Ciclo",
      description: "Un ritorno al passo precedente finché la condizione è falsa.",
      source: `flowchart TD
  A[Avvia] --> B[Elabora]
  B --> C{Completato?}
  C -- No --> B
  C -- Sì --> D[Fine]`,
    },
    {
      id: "parallelo",
      name: "Rami paralleli",
      description: "Un evento che si dirama su persistenza e notifica.",
      source: `flowchart TD
  A[Evento] --> B[Validazione]
  B --> C[Persistenza]
  B --> D[Notifica]
  C --> E[(Database)]
  D --> F[Email]`,
    },
    {
      id: "dati",
      name: "Servizi e dati",
      description: "API, database e coda nello stesso flusso.",
      source: `flowchart LR
  U[Utente] --> API[API]
  API --> DB[(Database)]
  API --> Q[[Coda]]
  Q --> W[Worker]`,
    },
    {
      id: "errori",
      name: "Percorsi di errore",
      description: "Esiti alternativi per richiesta non valida o errore interno.",
      source: `flowchart TD
  A[Richiesta] --> B{Valida?}
  B -- No --> E[Errore 400]
  B -- Sì --> C[Elabora]
  C --> D{Successo?}
  D -- No --> F[Errore 500]
  D -- Sì --> G[200 OK]`,
    },
    {
      id: "onboarding",
      name: "Onboarding",
      description: "Due aree separate per visitatore e prodotto.",
      source: `flowchart LR
  subgraph Visitatore
    A[Landing] --> B[Registrazione]
  end
  subgraph Prodotto
    C[Onboarding] --> D[Primo valore]
  end
  B --> C`,
    },
    {
      id: "approvazione",
      name: "Approvazione",
      description: "Forme iniziali e finali per un flusso di pubblicazione.",
      source: `flowchart TD
  Start([Inizio]) --> Draft[Draft]
  Draft --> Review{Revisione}
  Review -- Approva --> Done([Pubblicato])
  Review -- Richiedi modifiche --> Draft`,
    },
    {
      id: "deploy",
      name: "Deploy",
      description: "Build, test, deploy e ritorno in caso di test falliti.",
      source: `flowchart LR
  Dev[Commit] --> Build[Build]
  Build --> Test{Test}
  Test -- OK --> Deploy[Deploy]
  Test -- KO --> Fix[Fix]
  Fix --> Build
  Deploy --> Monitor[Monitoraggio]`,
    },
  ],
  sequence: [
    {
      id: "loop",
      name: "Ciclo",
      description: "Un polling ripetuto con risposta del servizio.",
      source: `sequenceDiagram
  participant C as Client
  participant S as Server
  loop Ogni 5 minuti
    C->>S: Richiedi stato
    S-->>C: Stato aggiornato
  end`,
    },
    {
      id: "parallelo",
      name: "Chiamate parallele",
      description: "Due servizi interrogati nello stesso momento.",
      source: `sequenceDiagram
  participant A as App
  participant U as Utenti
  participant O as Ordini
  A->>U: Elenco utenti
  A->>O: Elenco ordini
  U-->>A: Risposta
  O-->>A: Risposta`,
    },
    {
      id: "auth",
      name: "Autenticazione",
      description: "Credenziali, verifica su database e token.",
      source: `sequenceDiagram
  participant U as Utente
  participant A as Auth
  participant D as Database
  U->>A: Credenziali
  A->>D: Verifica
  D-->>A: Hash
  A-->>U: Token`,
    },
    {
      id: "pagamento",
      name: "Pagamento",
      description: "Un passaggio opzionale di verifica 3D Secure.",
      source: `sequenceDiagram
  participant C as Cliente
  participant P as Pagamento
  participant B as Banca
  C->>P: Paga
  opt 3D Secure
    P->>B: Verifica
    B-->>P: OK
  end
  P-->>C: Ricevuta`,
    },
    {
      id: "coda",
      name: "Coda asincrona",
      description: "API, coda e worker con acknowledgement.",
      source: `sequenceDiagram
  participant A as API
  participant Q as Coda
  participant W as Worker
  A->>Q: Pubblica evento
  Q-->>A: Ack
  Q->>W: Consegna
  W-->>Q: Completato`,
    },
    {
      id: "ritentativo",
      name: "Ritentativo",
      description: "Un errore seguito da un nuovo tentativo.",
      source: `sequenceDiagram
  participant C as Client
  participant S as Servizio
  C->>S: Richiesta
  S-->>C: Errore 503
  C->>S: Riprova
  S-->>C: OK 200`,
    },
    {
      id: "attivazioni",
      name: "Attivazioni annidate",
      description: "Due servizi attivi contemporaneamente.",
      source: `sequenceDiagram
  participant C as Client
  participant A as API
  participant S as Service
  C->>+A: Richiesta
  A->>+S: Chiamata
  S-->>-A: Risultato
  A-->>-C: Risposta`,
    },
  ],
  class: [
    {
      id: "interfacce",
      name: "Interfacce",
      description: "Un contratto implementato da due classi.",
      source: `classDiagram
  class Shape {
    <<interface>>
    +area() double
  }
  class Circle {
    +radius double
    +area() double
  }
  class Square {
    +side double
    +area() double
  }
  Shape <|.. Circle
  Shape <|.. Square`,
    },
    {
      id: "aggregazione",
      name: "Aggregazione",
      description: "Un contenitore che aggrega elementi.",
      source: `classDiagram
  class Squadra
  class Giocatore
  Squadra o-- "*" Giocatore : schiera`,
    },
    {
      id: "dipendenze",
      name: "Dipendenze",
      description: "Un servizio che usa un repository.",
      source: `classDiagram
  class ServizioOrdini
  class RepositoryOrdini
  ServizioOrdini ..> RepositoryOrdini : usa`,
    },
    {
      id: "ruoli",
      name: "Utenti e ruoli",
      description: "Associazioni molti-a-molti nel dominio.",
      source: `classDiagram
  class Utente
  class Ruolo
  class Permesso
  Utente "1" --> "*" Ruolo
  Ruolo "1" --> "*" Permesso`,
    },
    {
      id: "servizi",
      name: "Servizi",
      description: "Ordine collegato a pagamento e spedizione.",
      source: `classDiagram
  class Ordine
  class Pagamento
  class Spedizione
  Ordine --> Pagamento : paga
  Ordine --> Spedizione : spedisce`,
    },
    {
      id: "repository",
      name: "Repository astratto",
      description: "Classe astratta e implementazione concreta.",
      source: `classDiagram
  class Repository~T~ {
    <<abstract>>
    +save(T)
    +find(id) T
  }
  class UserRepository
  Repository <|-- UserRepository`,
    },
    {
      id: "dominio",
      name: "Modello di dominio",
      description: "Entità, valore e servizio di dominio.",
      source: `classDiagram
  class Cliente
  class Indirizzo
  class Ordine
  Cliente "1" *-- "1" Indirizzo
  Cliente "1" --> "*" Ordine : effettua`,
    },
  ],
  state: [
    {
      id: "retry",
      name: "Errore e retry",
      description: "Uno stato di errore con nuovo tentativo.",
      source: `stateDiagram-v2
  [*] --> Idle
  Idle --> Running : start
  Running --> Failed : error
  Failed --> Running : retry
  Running --> Done : complete
  Done --> [*]`,
    },
    {
      id: "auth",
      name: "Autenticazione",
      description: "Login, sessione attiva e scadenza.",
      source: `stateDiagram-v2
  [*] --> LoggedOut
  LoggedOut --> LoggingIn : login
  LoggingIn --> LoggedIn : ok
  LoggingIn --> LoggedOut : fail
  LoggedIn --> Expired : timeout
  Expired --> LoggedOut : logout`,
    },
    {
      id: "pagamento",
      name: "Pagamento",
      description: "Autorizzazione, cattura e rimborso.",
      source: `stateDiagram-v2
  [*] --> Pending
  Pending --> Authorized : autorizza
  Authorized --> Captured : cattura
  Captured --> Refunded : rimborsa
  Refunded --> [*]`,
    },
    {
      id: "transizioni",
      name: "Transizioni multiple",
      description: "Più percorsi verso lo stato finale.",
      source: `stateDiagram-v2
  [*] --> Nuovo
  Nuovo --> Attivo : attiva
  Nuovo --> Archiviato : archivia
  Attivo --> Sospeso : sospendi
  Sospeso --> Attivo : riprendi
  Attivo --> Chiuso : chiudi
  Sospeso --> Chiuso : chiudi
  Chiuso --> [*]`,
    },
    {
      id: "deploy",
      name: "Deploy",
      description: "Preparazione, rilascio e rollback.",
      source: `stateDiagram-v2
  [*] --> Preparato
  Preparato --> Rilasciato : deploy
  Rilasciato --> Verificato : smoke test
  Verificato --> [*]
  Rilasciato --> Rollback : errore
  Rollback --> Preparato : ripristina`,
    },
    {
      id: "editor",
      name: "Editor",
      description: "Bozza, modifica, salvataggio ed errore.",
      source: `stateDiagram-v2
  [*] --> Bozza
  Bozza --> Modifica : apri
  Modifica --> Salvataggio : salva
  Salvataggio --> Modifica : ok
  Salvataggio --> Errore : fail
  Errore --> Modifica : riprova`,
    },
    {
      id: "ordine",
      name: "Ordine",
      description: "Ciclo di vita di un ordine e-commerce.",
      source: `stateDiagram-v2
  [*] --> Carrello
  Carrello --> Pagato : checkout
  Pagato --> Spedito : spedisci
  Spedito --> Consegnato : consegna
  Consegnato --> [*]
  Carrello --> Annullato : annulla`,
    },
  ],
  er: [
    {
      id: "uno-a-uno",
      name: "Uno a uno",
      description: "Un utente con un solo profilo.",
      source: `erDiagram
  UTENTE ||--|| PROFILO : possiede
  PROFILO ||--o{ IMMAGINE : contiene`,
    },
    {
      id: "gerarchia",
      name: "Gerarchia",
      description: "Una entità che contiene sotto-entità.",
      source: `erDiagram
  CATEGORIA ||--o{ SOTTOCATEGORIA : contiene
  SOTTOCATEGORIA ||--o{ PRODOTTO : include`,
    },
    {
      id: "prenotazioni",
      name: "Prenotazioni",
      description: "Clienti, camere e soggiorni.",
      source: `erDiagram
  CLIENTE ||--o{ PRENOTAZIONE : effettua
  CAMERA ||--o{ PRENOTAZIONE : ospita
  PRENOTAZIONE ||--|| PAGAMENTO : richiede`,
    },
    {
      id: "ecommerce",
      name: "E-commerce",
      description: "Ordine, pagamento e spedizione collegati.",
      source: `erDiagram
  ORDINE ||--|| PAGAMENTO : salda
  ORDINE ||--|| SPEDIZIONE : genera
  CLIENTE ||--o{ ORDINE : effettua`,
    },
    {
      id: "contenuti",
      name: "Contenuti",
      description: "Articoli, autori e tag molti-a-molti.",
      source: `erDiagram
  AUTORE ||--o{ ARTICOLO : scrive
  ARTICOLO }o--o{ TAG : etichetta`,
    },
    {
      id: "catalogo",
      name: "Catalogo",
      description: "Prodotti, categorie e fornitori.",
      source: `erDiagram
  CATEGORIA ||--o{ PRODOTTO : raggruppa
  FORNITORE ||--o{ PRODOTTO : fornisce`,
    },
    {
      id: "chiavi",
      name: "Attributi e chiavi",
      description: "Entità con campi tipizzati e relazione.",
      source: `erDiagram
  CLIENTE {
    string id PK
    string nome
    string email
  }
  ORDINE {
    string id PK
    string cliente_id FK
    date data
  }
  CLIENTE ||--o{ ORDINE : effettua`,
    },
  ],
  gantt: [
    {
      id: "sprint",
      name: "Sprint",
      description: "Due settimane di lavoro per storie e test.",
      source: `gantt
  title Sprint 12
  dateFormat YYYY-MM-DD
  section Sviluppo
  Storie :s1, 2026-04-06, 6d
  Bug fix :s2, after s1, 2d
  section Verifica
  Test :s3, after s2, 2d
  Demo :milestone, s4, after s3, 0d`,
    },
    {
      id: "editoriale",
      name: "Calendario editoriale",
      description: "Pianificazione di articoli e pubblicazioni.",
      source: `gantt
  title Calendario editoriale
  dateFormat YYYY-MM-DD
  section Contenuti
  Ricerca :e1, 2026-05-04, 3d
  Scrittura :e2, after e1, 5d
  Revisione :e3, after e2, 2d
  Pubblicazione :milestone, e4, after e3, 0d`,
    },
    {
      id: "migrazione",
      name: "Migrazione",
      description: "Passaggio a un nuovo sistema con collaudo.",
      source: `gantt
  title Migrazione
  dateFormat YYYY-MM-DD
  section Analisi
  Inventario :m1, 2026-06-01, 4d
  Piano :m2, after m1, 3d
  section Esecuzione
  Migrazione :m3, after m2, 7d
  Collaudo :m4, after m3, 4d`,
    },
    {
      id: "evento",
      name: "Evento",
      description: "Preparazione di un evento con data fissa.",
      source: `gantt
  title Evento
  dateFormat YYYY-MM-DD
  section Organizzazione
  Location :v1, 2026-09-01, 5d
  Inviti :v2, after v1, 4d
  section Giorno evento
  Allestimento :v3, 2026-10-09, 1d
  Evento :milestone, v4, 2026-10-10, 0d`,
    },
    {
      id: "manutenzione",
      name: "Manutenzione",
      description: "Finestra di manutenzione e verifica.",
      source: `gantt
  title Manutenzione
  dateFormat YYYY-MM-DD
  section Preparazione
  Backup :n1, 2026-07-13, 1d
  section Intervento
  Aggiornamento :n2, after n1, 2d
  Verifica :n3, after n2, 1d`,
    },
    {
      id: "formazione",
      name: "Formazione",
      description: "Percorso di formazione per il team.",
      source: `gantt
  title Formazione
  dateFormat YYYY-MM-DD
  section Corso
  Fondamenti :f1, 2026-02-02, 5d
  Laboratorio :f2, after f1, 3d
  Certificazione :milestone, f3, after f2, 0d`,
    },
    {
      id: "rilascio",
      name: "Rilascio",
      description: "Release con test e comunicazione.",
      source: `gantt
  title Rilascio 2.0
  dateFormat YYYY-MM-DD
  section Preparazione
  Feature freeze :r1, 2026-11-02, 1d
  Test :r2, after r1, 5d
  section Rilascio
  Deploy :r3, after r2, 1d
  Comunicazione :r4, after r3, 2d`,
    },
  ],
  pie: [
    {
      id: "budget",
      name: "Budget",
      description: "Ripartizione delle spese di un progetto.",
      source: `pie title Budget del progetto
  "Personale" : 50
  "Infrastruttura" : 20
  "Software" : 15
  "Formazione" : 10
  "Imprevisti" : 5`,
    },
    {
      id: "traffico",
      name: "Traffico",
      description: "Origine delle visite a un sito.",
      source: `pie title Origine del traffico
  "Organico" : 45
  "Diretto" : 25
  "Social" : 20
  "Referral" : 10`,
    },
    {
      id: "team",
      name: "Team",
      description: "Composizione di un team per ruolo.",
      source: `pie title Composizione del team
  "Sviluppo" : 6
  "Design" : 3
  "Prodotto" : 2
  "QA" : 2
  "Supporto" : 1`,
    },
    {
      id: "costi",
      name: "Costi",
      description: "Costi fissi e variabili di un servizio.",
      source: `pie title Costi del servizio
  "Hosting" : 35
  "Supporto" : 30
  "Marketing" : 20
  "Altro" : 15`,
    },
    {
      id: "priorita",
      name: "Priorità",
      description: "Distribuzione del lavoro per priorità.",
      source: `pie title Lavoro per priorità
  "Alta" : 40
  "Media" : 35
  "Bassa" : 25`,
    },
    {
      id: "canali",
      name: "Canali",
      description: "Vendite per canale.",
      source: `pie showData
  title Vendite per canale
  "Online" : 55
  "Negozio" : 30
  "Partner" : 15`,
    },
    {
      id: "tempo",
      name: "Tempo",
      description: "Come si distribuisce una giornata di lavoro.",
      source: `pie title Distribuzione della giornata
  "Deep work" : 40
  "Riunioni" : 25
  "Email" : 15
  "Pausa" : 10
  "Altro" : 10`,
    },
  ],
  mindmap: [
    {
      id: "prodotto",
      name: "Prodotto",
      description: "Aree funzionali di un prodotto software.",
      source: `mindmap
  root((Prodotto))
    Esperienza
      Onboarding
      Accessibilità
    Tecnologia
      API
      Performance
      Sicurezza`,
    },
    {
      id: "studio",
      name: "Studio",
      description: "Organizzazione di un piano di studio.",
      source: `mindmap
  root((Studio))
    Materie
      Matematica
      Storia
      Informatica
    Metodo
      Lettura
      Esercizi
      Ripasso`,
    },
    {
      id: "evento",
      name: "Evento",
      description: "Le aree da curare per un evento.",
      source: `mindmap
  root((Evento))
    Prima
      Location
      Inviti
    Durante
      Accoglienza
      Programma
    Dopo
      Feedback
      Materiali`,
    },
    {
      id: "lettura",
      name: "Lettura",
      description: "Mappa per organizzare appunti di un libro.",
      source: `mindmap
  root((Libro))
    Temi
      Cambiamento
      Fiducia
    Personaggi
      Protagonista
      Antagonista
    Citazioni
      Inizio
      Fine`,
    },
    {
      id: "casa",
      name: "Casa",
      description: "Suddivisione di un progetto domestico.",
      source: `mindmap
  root((Casa))
    Interni
      Cucina
      Soggiorno
    Esterni
      Giardino
      Facciata
    Budget
      Materiali
      Manodopera`,
    },
    {
      id: "competenze",
      name: "Competenze",
      description: "Mappa di competenze tecniche e trasversali.",
      source: `mindmap
  root((Competenze))
    Tecniche
      Frontend
      Backend
      Dati
    Trasversali
      Comunicazione
      Problem solving`,
    },
    {
      id: "strategia",
      name: "Strategia",
      description: "Obiettivi, leve e rischi di una strategia.",
      source: `mindmap
  root((Strategia))
    Obiettivi
      Crescita
      Qualità
    Leve
      Prodotto
      Marketing
    Rischi
      Mercato
      Team`,
    },
  ],
  timeline: [
    {
      id: "azienda",
      name: "Azienda",
      description: "Tappe fondamentali di un'azienda.",
      source: `timeline
  title Storia dell'azienda
  2018 : Fondazione
  2020 : Primo cliente
  2022 : Nuova sede
  2024 : Espansione internazionale`,
    },
    {
      id: "release",
      name: "Release",
      description: "Versioni principali di un prodotto.",
      source: `timeline
  title Release del prodotto
  section Anno 1
    v1.0 : Primo rilascio
    v1.1 : Correzioni
  section Anno 2
    v2.0 : Nuova interfaccia
    v2.1 : API pubbliche`,
    },
    {
      id: "viaggio",
      name: "Viaggio",
      description: "Tappe di un viaggio.",
      source: `timeline
  title Viaggio
  section Andata
    Giorno 1 : Partenza : Arrivo
    Giorno 2 : Visita
  section Ritorno
    Giorno 5 : Ultimo giorno
    Giorno 6 : Rientro`,
    },
    {
      id: "progetto",
      name: "Progetto",
      description: "Fasi di un progetto in ordine cronologico.",
      source: `timeline
  title Fasi del progetto
  Q1 : Analisi
  Q2 : Sviluppo
  Q3 : Test
  Q4 : Rilascio`,
    },
    {
      id: "formazione",
      name: "Formazione",
      description: "Percorso di crescita professionale.",
      source: `timeline
  title Percorso di formazione
  2023 : Corso base
  2024 : Progetto guidato
  2025 : Certificazione
  2026 : Mentor`,
    },
    {
      id: "prodotto",
      name: "Evoluzione",
      description: "Come è cambiato un prodotto nel tempo.",
      source: `timeline
  title Evoluzione del prodotto
  2022 : Prototipo
  2023 : Beta : Primi utenti
  2024 : Lancio : Piano a pagamento
  2025 : Mobile`,
    },
    {
      id: "tappe",
      name: "Tappe personali",
      description: "Obiettivi personali distribuiti negli anni.",
      source: `timeline
  title Obiettivi
  2024 : Nuovo ruolo
  2025 : Corso : Viaggio
  2026 : Progetto personale`,
    },
  ],
  journey: [
    {
      id: "rinnovo",
      name: "Rinnovo abbonamento",
      description: "Dal promemoria alla conferma del rinnovo.",
      source: `journey
  title Rinnovo abbonamento
  section Promemoria
    Email : 4: Cliente
    Verifica piano : 3: Cliente
  section Rinnovo
    Paga : 4: Cliente
    Conferma : 5: Cliente, Sistema`,
    },
    {
      id: "checkout",
      name: "Checkout",
      description: "Carrello, pagamento e ricevuta.",
      source: `journey
  title Checkout
  section Carrello
    Rivedi : 4: Cliente
    Modifica : 3: Cliente
  section Pagamento
    Inserisci dati : 3: Cliente
    Conferma : 5: Cliente`,
    },
    {
      id: "registrazione",
      name: "Registrazione",
      description: "Primo accesso e attivazione dell'account.",
      source: `journey
  title Registrazione
  section Dati
    Compila : 3: Utente
    Verifica email : 4: Utente
  section Attivazione
    Primo accesso : 4: Utente
    Tutorial : 5: Utente`,
    },
    {
      id: "formazione",
      name: "Formazione",
      description: "Esperienza di un corso online.",
      source: `journey
  title Corso online
  section Iscrizione
    Scelta corso : 4: Utente
    Pagamento : 3: Utente
  section Apprendimento
    Lezioni : 4: Utente, Docente
    Esame : 5: Utente`,
    },
    {
      id: "assistenza",
      name: "Assistenza",
      description: "Apertura e chiusura di un ticket.",
      source: `journey
  title Assistenza
  section Segnalazione
    Apri ticket : 3: Cliente
    Allega dettagli : 3: Cliente
  section Risoluzione
    Diagnosi : 4: Supporto
    Conferma : 5: Cliente`,
    },
    {
      id: "consegna",
      name: "Consegna",
      description: "Tracciamento di una consegna.",
      source: `journey
  title Consegna
  section Ordine
    Acquisto : 4: Cliente
    Spedizione : 5: Cliente
  section Ricezione
    Tracciamento : 4: Cliente
    Consegna : 5: Cliente`,
    },
    {
      id: "feedback",
      name: "Feedback",
      description: "Richiesta e gestione del feedback.",
      source: `journey
  title Feedback
  section Richiesta
    Invito : 3: Cliente
    Compilazione : 4: Cliente
  section Follow-up
    Analisi : 4: Team
    Risposta : 5: Team, Cliente`,
    },
  ],
  quadrant: [
    {
      id: "prodotti",
      name: "Prodotti",
      description: "Valore percepito contro sforzo di realizzazione.",
      source: `quadrantChart
  title Prodotti
  x-axis Basso sforzo --> Alto sforzo
  y-axis Basso valore --> Alto valore
  quadrant-1 Strategici
  quadrant-2 Quick win
  quadrant-3 Scartare
  quadrant-4 Ripensare
  Feature A: [0.2, 0.8]
  Feature B: [0.7, 0.9]
  Feature C: [0.8, 0.3]`,
    },
    {
      id: "fornitori",
      name: "Fornitori",
      description: "Costo contro affidabilità.",
      source: `quadrantChart
  title Fornitori
  x-axis Basso costo --> Alto costo
  y-axis Bassa affidabilità --> Alta affidabilità
  quadrant-1 Preferiti
  quadrant-2 Valutare
  quadrant-3 Critici
  quadrant-4 Alternative
  Fornitore A: [0.3, 0.9]
  Fornitore B: [0.8, 0.8]
  Fornitore C: [0.7, 0.3]`,
    },
    {
      id: "idee",
      name: "Idee",
      description: "Impatto contro fattibilità.",
      source: `quadrantChart
  title Idee
  x-axis Bassa fattibilità --> Alta fattibilità
  y-axis Basso impatto --> Alto impatto
  quadrant-1 Fare ora
  quadrant-2 Pianificare
  quadrant-3 Parcheggiare
  quadrant-4 Sperimentare
  Idea A: [0.8, 0.9]
  Idea B: [0.3, 0.8]
  Idea C: [0.7, 0.4]`,
    },
    {
      id: "clienti",
      name: "Clienti",
      description: "Valore e rischio di concentrazione.",
      source: `quadrantChart
  title Clienti
  x-axis Basso valore --> Alto valore
  y-axis Basso rischio --> Alto rischio
  quadrant-1 Strategici
  quadrant-2 Monitorare
  quadrant-3 Standard
  quadrant-4 Diversificare
  Cliente A: [0.9, 0.7]
  Cliente B: [0.4, 0.3]
  Cliente C: [0.3, 0.8]`,
    },
    {
      id: "team",
      name: "Team",
      description: "Padronanza contro carico di lavoro.",
      source: `quadrantChart
  title Team
  x-axis Bassa padronanza --> Alta padronanza
  y-axis Basso carico --> Alto carico
  quadrant-1 Sovraccarico
  quadrant-2 Esperti
  quadrant-3 Disponibili
  quadrant-4 Formare
  Persona A: [0.8, 0.9]
  Persona B: [0.7, 0.3]
  Persona C: [0.3, 0.4]`,
    },
    {
      id: "campagne",
      name: "Campagne",
      description: "Costo contro conversione.",
      source: `quadrantChart
  title Campagne
  x-axis Basso costo --> Alto costo
  y-axis Bassa conversione --> Alta conversione
  quadrant-1 Scala
  quadrant-2 Ottimizza
  quadrant-3 Sospendi
  quadrant-4 Test
  Campagna A: [0.3, 0.9]
  Campagna B: [0.8, 0.8]
  Campagna C: [0.7, 0.3]`,
    },
    {
      id: "investimenti",
      name: "Investimenti",
      description: "Rischio contro rendimento atteso.",
      source: `quadrantChart
  title Investimenti
  x-axis Basso rischio --> Alto rischio
  y-axis Basso rendimento --> Alto rendimento
  quadrant-1 Aggressivi
  quadrant-2 Bilanciati
  quadrant-3 Conservativi
  quadrant-4 Rivedere
  Opzione A: [0.8, 0.9]
  Opzione B: [0.3, 0.7]
  Opzione C: [0.4, 0.3]`,
    },
  ],
  xychart: [
    {
      id: "trend",
      name: "Trend",
      description: "Andamento annuale su una linea.",
      source: `xychart-beta
  title Trend annuale
  x-axis [2022, 2023, 2024, 2025]
  y-axis "Valore" 0 --> 100
  line [20, 38, 61, 84]`,
    },
    {
      id: "temperatura",
      name: "Temperature",
      description: "Temperature medie mese per mese.",
      source: `xychart-beta
  title Temperature medie
  x-axis [Gen, Feb, Mar, Apr, Mag, Giu]
  y-axis "°C" 0 --> 35
  line [8, 10, 14, 18, 23, 28]`,
    },
    {
      id: "utenti",
      name: "Utenti",
      description: "Utenti attivi per trimestre.",
      source: `xychart-beta
  title Utenti attivi
  x-axis [Q1, Q2, Q3, Q4]
  y-axis "Utenti" 0 --> 1000
  bar [220, 380, 610, 840]`,
    },
    {
      id: "ricavi",
      name: "Ricavi",
      description: "Ricavi mensili in crescita.",
      source: `xychart-beta
  title Ricavi mensili
  x-axis [Gen, Feb, Mar, Apr, Mag, Giu]
  y-axis "EUR" 0 --> 50000
  line [12000, 15500, 19000, 24500, 31000, 38000]`,
    },
    {
      id: "ordini",
      name: "Ordini",
      description: "Ordini giornalieri in una settimana.",
      source: `xychart-beta
  title Ordini settimanali
  x-axis [Lun, Mar, Mer, Gio, Ven, Sab, Dom]
  y-axis "Ordini" 0 --> 200
  bar [120, 140, 135, 160, 180, 90, 60]`,
    },
    {
      id: "soddisfazione",
      name: "Soddisfazione",
      description: "Punteggio di soddisfazione per reparto.",
      source: `xychart-beta
  title Soddisfazione
  x-axis [Supporto, Vendite, Prodotto, Tecnico]
  y-axis "Punteggio" 0 --> 10
  bar [8, 7, 9, 8]`,
    },
    {
      id: "previsione",
      name: "Previsione",
      description: "Storico e previsione sullo stesso grafico.",
      source: `xychart-beta
  title Previsione
  x-axis [T1, T2, T3, T4, T5]
  y-axis "Valore" 0 --> 120
  bar [30, 45, 60, 75, 95]
  line [28, 48, 58, 80, 100]`,
    },
  ],
};
