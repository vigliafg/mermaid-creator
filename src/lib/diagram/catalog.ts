import type { DiagramKind } from "./document";

export type DiagramCategory =
  | "Processi"
  | "Software"
  | "Dati"
  | "Tempo"
  | "Idee"
  | "Decisioni";

export interface DiagramVariant {
  id: string;
  name: string;
  description: string;
  source: string;
}

export interface DiagramCatalogEntry {
  id: string;
  name: string;
  category: DiagramCategory;
  kind: DiagramKind;
  description: string;
  useWhen: string;
  tags: string[];
  variants: DiagramVariant[];
}

export const DIAGRAM_CATEGORIES: DiagramCategory[] = [
  "Processi",
  "Software",
  "Dati",
  "Tempo",
  "Idee",
  "Decisioni",
];

export const DIAGRAM_CATALOG: DiagramCatalogEntry[] = [
  {
    id: "flowchart",
    name: "Flowchart",
    category: "Processi",
    kind: "flowchart",
    description: "Passaggi, decisioni e percorsi di un processo.",
    useWhen: "Devi spiegare come funziona una procedura o un flusso operativo.",
    tags: ["processo", "decisione", "flusso", "workflow", "nodi"],
    variants: [
      {
        id: "base",
        name: "Flusso lineare",
        description: "Una sequenza semplice da sinistra a destra.",
        source: `flowchart LR
  A[Ideazione] --> B[Produzione]
  B --> C[Distribuzione]`,
      },
      {
        id: "decisioni",
        name: "Decisioni",
        description: "Bivi con condizioni ed etichette sui rami.",
        source: `flowchart TD
  A[Richiesta] --> B{Approvata?}
  B -- Sì --> C[Pubblica]
  B -- No --> D[Revisione]
  D --> B`,
      },
      {
        id: "gruppi",
        name: "Gruppi e attori",
        description: "Sottografi per separare aree o responsabilità.",
        source: `flowchart LR
  subgraph Cliente
    A[Ordina] --> B[Paga]
  end
  subgraph Sistema
    C[Verifica] --> D[Spedisce]
  end
  B --> C`,
      },
    ],
  },
  {
    id: "sequence",
    name: "Sequence",
    category: "Software",
    kind: "sequence",
    description: "Scambi di messaggi fra attori in ordine temporale.",
    useWhen: "Devi documentare un'interazione fra utenti, servizi o API.",
    tags: ["api", "messaggi", "attori", "interazione", "tempo"],
    variants: [
      {
        id: "base",
        name: "Richiesta e risposta",
        description: "Tre partecipanti e un giro completo di chiamata.",
        source: `sequenceDiagram
  participant U as Utente
  participant A as Applicazione
  participant S as Server
  U->>A: Invia richiesta
  A->>S: Chiama API
  S-->>A: Risposta
  A-->>U: Mostra risultato`,
      },
      {
        id: "alt",
        name: "Alternative",
        description: "Percorso positivo e percorso di errore con alt/else.",
        source: `sequenceDiagram
  participant U as Utente
  participant A as App
  U->>A: Login
  alt Credenziali valide
    A-->>U: Accesso consentito
  else Credenziali errate
    A-->>U: Errore
  end`,
      },
      {
        id: "note",
        name: "Note e attivazioni",
        description: "Evidenzia il lavoro di un servizio durante la chiamata.",
        source: `sequenceDiagram
  participant C as Cliente
  participant S as Servizio
  C->>+S: Avvia ordine
  Note over S: Controlla disponibilità
  S-->>-C: Conferma`,
      },
    ],
  },
  {
    id: "class",
    name: "Class",
    category: "Software",
    kind: "class",
    description: "Classi, attributi, metodi e relazioni del modello.",
    useWhen: "Devi rappresentare la struttura di un software o di un dominio.",
    tags: ["oop", "classi", "ereditarietà", "modello", "uml"],
    variants: [
      {
        id: "base",
        name: "Classi ed ereditarietà",
        description: "Attributi, metodi e una relazione di estensione.",
        source: `classDiagram
  class Animale {
    +String nome
    +mangia()
  }
  class Cane {
    +abbaia()
  }
  Animale <|-- Cane`,
      },
      {
        id: "relazioni",
        name: "Associazioni e composizione",
        description: "Molteplicità e contenimento fra oggetti.",
        source: `classDiagram
  class Ordine
  class Cliente
  class RigaOrdine
  Cliente "1" --> "*" Ordine : effettua
  Ordine "1" *-- "*" RigaOrdine : contiene`,
      },
      {
        id: "generics",
        name: "Generics e interfacce",
        description: "Un repository generico e la sua implementazione.",
        source: `classDiagram
  class Repository~T~ {
    +salva(T entita)
    +trova(id) T
  }
  class UtenteRepository
  Repository <|.. UtenteRepository`,
      },
    ],
  },
  {
    id: "state",
    name: "State",
    category: "Software",
    kind: "state",
    description: "Stati di un oggetto e transizioni fra stati.",
    useWhen: "Devi descrivere un ciclo di vita, una macchina a stati o un workflow.",
    tags: ["stati", "transizioni", "ciclo di vita", "macchina a stati"],
    variants: [
      {
        id: "base",
        name: "Ciclo di vita",
        description: "Stato iniziale, transizioni con eventi e stato finale.",
        source: `stateDiagram-v2
  [*] --> Bozza
  Bozza --> InRevisione : invia
  InRevisione --> Pubblicato : approva
  InRevisione --> Bozza : rifiuta
  Pubblicato --> [*]`,
      },
      {
        id: "composito",
        name: "Stato composto",
        description: "Uno stato che contiene a sua volta una sotto-macchina.",
        source: `stateDiagram-v2
  [*] --> Attivo
  state Attivo {
    [*] --> InAttesa
    InAttesa --> InCorso : avvia
    InCorso --> Completato : termina
  }
  Attivo --> Sospeso : pausa
  Sospeso --> Attivo : riprendi`,
      },
      {
        id: "scelta",
        name: "Punto di scelta",
        description: "Un nodo di scelta esplicito fra due esiti.",
        source: `stateDiagram-v2
  [*] --> Verifica
  state scelta <<choice>>
  Verifica --> scelta
  scelta --> Accettato : ok
  scelta --> Rifiutato : no`,
      },
    ],
  },
  {
    id: "er",
    name: "ER",
    category: "Dati",
    kind: "er",
    description: "Entità, attributi e relazioni di un modello dati.",
    useWhen: "Devi progettare o spiegare uno schema di database.",
    tags: ["database", "entità", "relazioni", "schema", "cardinalità"],
    variants: [
      {
        id: "base",
        name: "Entità e cardinalità",
        description: "Tre entità collegate con relazioni uno-a-molti.",
        source: `erDiagram
  CLIENTE ||--o{ ORDINE : effettua
  ORDINE ||--|{ RIGA : contiene
  PRODOTTO ||--o{ RIGA : appare`,
      },
      {
        id: "attributi",
        name: "Attributi",
        description: "Campi tipizzati dentro le entità.",
        source: `erDiagram
  CLIENTE {
    string id
    string nome
    string email
  }
  ORDINE {
    string id
    date data
  }
  CLIENTE ||--o{ ORDINE : effettua`,
      },
      {
        id: "molti-a-molti",
        name: "Molti-a-molti",
        description: "Relazioni con cardinalità su entrambi i lati.",
        source: `erDiagram
  DOCENTE }o--o{ CORSO : insegna
  CORSO ||--|{ LEZIONE : programma
  STUDENTE }o--o{ CORSO : frequenta`,
      },
    ],
  },
  {
    id: "gantt",
    name: "Gantt",
    category: "Tempo",
    kind: "gantt",
    description: "Attività, durate e dipendenze su una linea temporale.",
    useWhen: "Devi pianificare un progetto o mostrare una roadmap.",
    tags: ["progetto", "pianificazione", "roadmap", "attività", "milestone"],
    variants: [
      {
        id: "base",
        name: "Piano di progetto",
        description: "Sezioni, date e attività in sequenza.",
        source: `gantt
  title Piano di lancio
  dateFormat YYYY-MM-DD
  section Progettazione
  Requisiti :a1, 2026-01-05, 10d
  Design     :a2, after a1, 8d
  section Rilascio
  Sviluppo   :a3, after a2, 20d
  Test       :a4, after a3, 7d`,
      },
      {
        id: "milestone",
        name: "Milestone",
        description: "Attività completate e una pietra miliare.",
        source: `gantt
  title Roadmap
  dateFormat YYYY-MM-DD
  section Ricerca
  Interviste :done, r1, 2026-02-01, 5d
  Sintesi    :r2, after r1, 3d
  section Build
  Prototipo  :b1, after r2, 10d
  Milestone  :milestone, m1, after b1, 0d`,
      },
      {
        id: "dipendenze",
        name: "Dipendenze",
        description: "Attività legate da precedenze esplicite.",
        source: `gantt
  title Produzione
  dateFormat YYYY-MM-DD
  section Materiali
  Ordine :m1, 2026-03-01, 3d
  Consegna :m2, after m1, 4d
  section Assemblaggio
  Montaggio :a1, after m2, 6d
  Collaudo :a2, after a1, 2d`,
      },
    ],
  },
  {
    id: "pie",
    name: "Pie",
    category: "Dati",
    kind: "pie",
    description: "Proporzioni di un totale in una torta.",
    useWhen: "Devi mostrare una ripartizione semplice in percentuale o valori.",
    tags: ["torta", "percentuali", "ripartizione", "quote"],
    variants: [
      {
        id: "base",
        name: "Ripartizione",
        description: "Quattro categorie con valori.",
        source: `pie title Ripartizione del tempo
  "Sviluppo" : 45
  "Riunioni" : 20
  "Test" : 25
  "Documentazione" : 10`,
      },
      {
        id: "showdata",
        name: "Con valori",
        description: "Mostra i valori accanto alle etichette.",
        source: `pie showData
  title Canali di acquisizione
  "Organico" : 42
  "Social" : 28
  "Referral" : 18
  "Altro" : 12`,
      },
      {
        id: "semplice",
        name: "Minimale",
        description: "Solo tre voci, per una lettura immediata.",
        source: `pie
  title Preferenze
  "A" : 3
  "B" : 5
  "C" : 2`,
      },
    ],
  },
  {
    id: "mindmap",
    name: "Mindmap",
    category: "Idee",
    kind: "mindmap",
    description: "Una mappa radiale di concetti e sotto-concetti.",
    useWhen: "Devi esplorare un tema, organizzare appunti o fare brainstorming.",
    tags: ["brainstorming", "mappa", "concetti", "appunti", "idee"],
    variants: [
      {
        id: "base",
        name: "Mappa a due livelli",
        description: "Un tema centrale con rami principali e foglie.",
        source: `mindmap
  root((Mermaid))
    Diagrammi
      Flowchart
      Sequence
      Mappe
    Strumenti
      Editor
      Export`,
      },
      {
        id: "progetto",
        name: "Obiettivi e rischi",
        description: "Due rami contrapposti per analizzare un progetto.",
        source: `mindmap
  root((Progetto))
    Obiettivi
      Ridurre i tempi
      Migliorare la qualità
    Rischi
      Budget
      Competenze`,
      },
      {
        id: "viaggio",
        name: "Pianificazione",
        description: "Una mappa per organizzare opzioni e dettagli.",
        source: `mindmap
  root((Viaggio))
    Mare
      Spiaggia
      Snorkeling
    Montagna
      Trekking
      Rifugi`,
      },
    ],
  },
  {
    id: "timeline",
    name: "Timeline",
    category: "Tempo",
    kind: "timeline",
    description: "Eventi in ordine cronologico, con sezioni opzionali.",
    useWhen: "Devi raccontare una storia, una cronologia o un'evoluzione.",
    tags: ["cronologia", "storia", "eventi", "date", "tappe"],
    variants: [
      {
        id: "base",
        name: "Cronologia",
        description: "Un evento per periodo.",
        source: `timeline
  title Storia del progetto
  2024 : Ideazione
  2025 : Prototipo : Primi utenti
  2026 : Lancio`,
      },
      {
        id: "sezioni",
        name: "Sezioni",
        description: "Raggruppa gli eventi per fase.",
        source: `timeline
  title Tappe
  section Ricerca
    2024 : Interviste
    2025 : Report
  section Sviluppo
    2025 : MVP
    2026 : Rilascio`,
      },
      {
        id: "eventi",
        name: "Più eventi per periodo",
        description: "Accumula più avvenimenti nello stesso anno.",
        source: `timeline
  title Evoluzione
  2024 : Nascita : Prima versione
  2025 : Crescita : Nuove funzioni : Nuovo team
  2026 : Espansione`,
      },
    ],
  },
  {
    id: "journey",
    name: "Journey",
    category: "Processi",
    kind: "journey",
    description: "Esperienza utente per fasi, con punteggio e attori.",
    useWhen: "Devi analizzare l'esperienza di un cliente o di un utente.",
    tags: ["ux", "esperienza", "cliente", "fasi", "punteggio"],
    variants: [
      {
        id: "base",
        name: "Esperienza di acquisto",
        description: "Fasi, azioni, punteggi e attori.",
        source: `journey
  title Esperienza di acquisto
  section Scoperta
    Cerca : 5: Cliente
    Confronta : 3: Cliente
  section Acquisto
    Paga : 4: Cliente
    Riceve : 5: Cliente`,
      },
      {
        id: "supporto",
        name: "Supporto clienti",
        description: "Più attori coinvolti nella stessa fase.",
        source: `journey
  title Supporto clienti
  section Contatto
    Apre ticket : 4: Cliente
    Riceve risposta : 3: Cliente, Supporto
  section Risoluzione
    Verifica : 4: Supporto
    Chiude : 5: Cliente`,
      },
      {
        id: "onboarding",
        name: "Onboarding",
        description: "Dal primo accesso al primo valore percepito.",
        source: `journey
  title Onboarding
  section Primo accesso
    Registrazione : 3: Utente
    Configurazione : 2: Utente
  section Primo valore
    Prova : 4: Utente
    Invita colleghi : 5: Utente`,
      },
    ],
  },
  {
    id: "quadrant",
    name: "Quadrant",
    category: "Decisioni",
    kind: "quadrant",
    description: "Posiziona elementi su due assi e quattro quadranti.",
    useWhen: "Devi prioritizzare, confrontare opzioni o fare una matrice decisionale.",
    tags: ["priorità", "matrice", "decisione", "assi", "posizionamento"],
    variants: [
      {
        id: "priorita",
        name: "Matrice di priorità",
        description: "Impatto contro urgenza.",
        source: `quadrantChart
  title Priorità
  x-axis Basso impatto --> Alto impatto
  y-axis Bassa urgenza --> Alta urgenza
  quadrant-1 Fai subito
  quadrant-2 Pianifica
  quadrant-3 Scarta
  quadrant-4 Delega
  Feature A: [0.8, 0.9]
  Feature B: [0.3, 0.7]
  Feature C: [0.6, 0.4]`,
      },
      {
        id: "rischi",
        name: "Rischi",
        description: "Probabilità contro impatto.",
        source: `quadrantChart
  title Rischi
  x-axis Bassa probabilità --> Alta probabilità
  y-axis Basso impatto --> Alto impatto
  quadrant-1 Critico
  quadrant-2 Monitorare
  quadrant-3 Accettabile
  quadrant-4 Mitigare
  Fornitore: [0.7, 0.8]
  Budget: [0.4, 0.9]
  Competenze: [0.6, 0.5]`,
      },
      {
        id: "competenze",
        name: "Competenze",
        description: "Padronanza contro importanza.",
        source: `quadrantChart
  title Competenze del team
  x-axis Bassa padronanza --> Alta padronanza
  y-axis Bassa importanza --> Alta importanza
  quadrant-1 Mentor
  quadrant-2 Formare
  quadrant-3 Delegare
  quadrant-4 Monitorare
  Frontend: [0.8, 0.7]
  Backend: [0.6, 0.9]
  DevOps: [0.3, 0.8]`,
      },
    ],
  },
  {
    id: "xychart",
    name: "XY Chart",
    category: "Dati",
    kind: "xychart",
    description: "Barre e linee su assi cartesiani.",
    useWhen: "Devi mostrare un andamento o confrontare valori numerici.",
    tags: ["grafico", "barre", "linee", "andamento", "numeri"],
    variants: [
      {
        id: "barre",
        name: "Barre",
        description: "Confronto fra categorie.",
        source: `xychart-beta
  title Vendite mensili
  x-axis [Gen, Feb, Mar, Apr, Mag]
  y-axis "Unità" 0 --> 500
  bar [120, 180, 150, 220, 260]`,
      },
      {
        id: "linea",
        name: "Linea",
        description: "Andamento nel tempo.",
        source: `xychart-beta
  title Andamento
  x-axis [Q1, Q2, Q3, Q4]
  y-axis "Ricavi" 0 --> 100
  line [25, 40, 55, 80]`,
      },
      {
        id: "misto",
        name: "Barre e linea",
        description: "Confronta un volume con un trend.",
        source: `xychart-beta
  title Confronto
  x-axis [A, B, C, D]
  y-axis 0 --> 100
  bar [30, 50, 40, 70]
  line [20, 45, 60, 65]`,
      },
    ],
  },
];

export function catalogEntry(id: string): DiagramCatalogEntry | undefined {
  return DIAGRAM_CATALOG.find((entry) => entry.id === id);
}
