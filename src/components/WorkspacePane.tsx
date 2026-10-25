import { save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  FileCode2,
  Hand,
  History,
  Link2,
  Loader2,
  MousePointer2,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Star,
  Trash2,
  Undo2,
  Redo2,
  Maximize2,
  MoreHorizontal,
  PenTool,
  Workflow,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { toast } from "sonner";
import { api } from "../lib/ipc";
import {
  renderDiagram,
  sanitizeSvgForExport,
  svgToPngBase64,
  validateSourceSync,
} from "../lib/diagram";
import { readDocument, writeStyleBlock } from "../lib/diagram/document";
import {
  addEdge,
  addNode,
  ARROW_OPTIONS,
  deleteSelectionLine,
  DIRECTION_OPTIONS,
  nodeLabel,
  normalizeDirection,
  replaceNodeLabel,
  reverseEdge,
  setDirection,
  setEdgeArrow,
  setNodeShape,
  type DiagramDirection,
} from "../lib/diagram/flowchart";
import {
  buildSourceIndex,
  rangeForSelection,
  selectionAtCursor,
} from "../lib/diagram/sourceIndex";
import {
  makeSelection,
  selectionLabel,
  toggleSelection,
  type Selection,
} from "../lib/diagram/selection";
import {
  allClusterKeys,
  allEdgeKeys,
  allNodeKeys,
  effectiveStyle,
  resetKeys,
  withPatch,
  type VisualStyle,
} from "../lib/diagram/styles";
import {
  customTheme,
  defaultTheme,
  resolveTheme,
  themeForId,
  themeLabel,
  type DiagramTheme,
  type DiagramTokens,
  type PresetId,
} from "../lib/diagram/theme";
import { useApp } from "../store";
import type { Diagram } from "../types";
import {
  convertMermaidToBoard,
  conversionQualityMessage,
  BoardConversionError,
  type ConversionResult,
} from "../lib/board/conversion";
import {
  boardExcalidrawJson,
  boardPngBase64,
  boardSvg,
  copyBoardPng,
  copyBoardSvg,
  copyTextFallback,
} from "../lib/board/export";
import { imageSceneFromSvg } from "../lib/board/image";
import {
  emptyBoardScene,
  isBoardStale,
  parseBoardScene,
  serializeBoardScene,
  type BoardScene,
} from "../lib/board/scene";
import { useBoardAutosave } from "../lib/board/useBoardAutosave";
import { BoardCanvas, type BoardCanvasHandle } from "./board/BoardCanvas";
import { BoardFirstRun } from "./board/BoardFirstRun";
import { BoardStatusBar } from "./board/BoardStatusBar";
import { DiagramStage, type DiagramStageHandle, type LabelEditState } from "./workspace/DiagramStage";
import { Inspector } from "./workspace/Inspector";
import { SourceEditor } from "./workspace/SourceEditor";
import { ThemePanel } from "./workspace/ThemePanel";

function slug(value: string): string {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || "diagramma";
}

function date(value: number): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function DiagramGallery({ onOpen }: { onOpen: (id: string) => void }) {
  const diagrams = useApp((s) => s.diagrams);
  return (
    <div className="workspace-empty">
      <div className="workspace-empty-head">
        <div>
          <div className="eyebrow">Workspace</div>
          <h2>I tuoi diagrammi</h2>
        </div>
        <span className="count">{diagrams.length}</span>
      </div>
      {diagrams.length === 0 ? (
        <div className="empty-inline tall">
          <Workflow size={26} />
          <p>I diagrammi generati dalla conversazione appariranno qui.</p>
        </div>
      ) : (
        <div className="diagram-gallery">
          {diagrams.map((diagram) => (
            <button key={diagram.id} className="gallery-card" onClick={() => onOpen(diagram.id)}>
              <span className="gallery-card-top">
                <span className="badge">{diagram.diagramType}</span>
                {diagram.favorite && <Star size={13} className="star-on" />}
              </span>
              <strong>{diagram.title}</strong>
              <small>{diagram.source.split("\n").slice(0, 2).join(" ")}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type BottomTab = "element" | "theme" | "versions" | "source";

function RestoreRail({ onRestore }: { onRestore: () => void }) {
  return (
    <div className="viewer-restore-rail">
      <button
        className="icon-btn"
        title="Riapri chat e cronologia"
        onClick={onRestore}
      >
        <ChevronsRight size={15} />
      </button>
      <span>Chat</span>
    </div>
  );
}

export function WorkspacePane() {
  const selectedDiagramId = useApp((s) => s.selectedDiagramId);
  const diagrams = useApp((s) => s.diagrams);
  const library = useApp((s) => s.library);
  const versions = useApp((s) => s.versions);
  const viewerExpanded = useApp((s) => s.viewerExpanded);
  const toggleViewerExpanded = useApp((s) => s.toggleViewerExpanded);
  const settings = useApp((s) => s.settings);
  const mode = (settings.theme === "light" ? "light" : "dark") as "dark" | "light";
  const workspaceMode = useApp((s) => s.workspaceMode);
  const streaming = useApp((s) => s.streaming);
  const board = useApp((s) => s.board);
  const boardLoading = useApp((s) => s.boardLoading);
  const boardEpoch = useApp((s) => s.boardEpoch);
  const boardError = useApp((s) => s.boardError);
  const boardSaveError = useApp((s) => s.boardSaveError);
  const setWorkspaceMode = useApp((s) => s.setWorkspaceMode);
  const loadBoard = useApp((s) => s.loadBoard);
  const replaceBoard = useApp((s) => s.replaceBoard);
  const setBoardSaveError = useApp((s) => s.setBoardSaveError);
  const registerBoardFlush = useApp((s) => s.registerBoardFlush);
  const flushBoard = useApp((s) => s.flushBoard);
  const focusChat = useApp((s) => s.focusChat);
  const selectDiagram = useApp((s) => s.selectDiagram);
  const saveDiagram = useApp((s) => s.saveDiagram);
  const restoreVersion = useApp((s) => s.restoreVersion);
  const toggleLibrary = useApp((s) => s.toggleLibrary);
  const toggleFavorite = useApp((s) => s.toggleFavorite);
  const deleteDiagram = useApp((s) => s.deleteDiagram);
  const setDiagramDirty = useApp((s) => s.setDiagramDirty);
  const setDiagramTheme = useApp((s) => s.setDiagramTheme);
  const setSetting = useApp((s) => s.setSetting);

  const diagram: Diagram | undefined =
    diagrams.find((item) => item.id === selectedDiagramId) ??
    library.find((item) => item.id === selectedDiagramId);

  const [source, setSource] = useState("");
  const [savedSource, setSavedSource] = useState("");
  const [theme, setTheme] = useState<DiagramTheme>(defaultTheme());
  const [render, setRender] = useState<Awaited<ReturnType<typeof renderDiagram>> | null>(null);
  const [renderError, setRenderError] = useState("");
  const [rendering, setRendering] = useState(false);
  const [sideTab, setSideTab] = useState<BottomTab>("element");
  const [sideOpen, setSideOpen] = useState(true);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [labelEdit, setLabelEdit] = useState<LabelEditState | null>(null);

  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [connectArrow, setConnectArrow] = useState("-->");
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [reveal, setReveal] = useState<{ from: number; to: number; line: number } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [conversionError, setConversionError] = useState("");
  const [conversionMeta, setConversionMeta] = useState<{
    quality: "semantic" | "generic" | "image";
    type: string;
  } | null>(null);
  const [boardBusy, setBoardBusy] = useState(false);
  const [boardActionError, setBoardActionError] = useState("");
  const boardHandleRef = useRef<BoardCanvasHandle | null>(null);

  const stageRef = useRef<DiagramStageHandle>(null);
  const sourceRef = useRef(source);
  const lastPersistedSourceRef = useRef("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorTimer = useRef<number | null>(null);
  const lastCommitRef = useRef(0);

  const doc = useMemo(
    () => readDocument(source, diagram?.diagramType),
    [source, diagram?.diagramType],
  );
  const tokens = useMemo(() => resolveTheme(theme, mode), [theme, mode]);
  const dirty = Boolean(diagram) && source !== savedSource;
  const workspaceBg = settings.workspace_bg ?? "auto";
  const workspaceGrid = settings.workspace_grid !== "0";
  const canEditLabels = doc.capabilities.structure && doc.kind === "flowchart";
  const boardSceneResult = useMemo(() => {
    if (!board) return { scene: null as BoardScene | null, error: "" };
    try {
      return { scene: parseBoardScene(board.sceneJson), error: "" };
    } catch (error) {
      return {
        scene: null as BoardScene | null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [board]);

  const autosave = useBoardAutosave({
    diagramId: workspaceMode === "board" ? (diagram?.id ?? null) : null,
    onError: (message) => setBoardSaveError(message),
  });

  useEffect(() => {
    registerBoardFlush(autosave.flush);
    return () => registerBoardFlush(null);
  }, [autosave.flush, registerBoardFlush]);

  const workspaceStyle = {
    "--workspace-bg": workspaceBg === "auto" ? "var(--bg)" : workspaceBg,
    "--workspace-grid": workspaceGrid
      ? "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--text) 12%, transparent) 1px, transparent 0) 0 0 / 18px 18px"
      : "none",
  } as CSSProperties;

  useEffect(() => {
    if (!diagram) return;
    const loadedTheme = themeForId(settings, diagram.id);
    setTheme(loadedTheme);
    sourceRef.current = diagram.source;
    setSource(diagram.source);
    setSavedSource(diagram.source);
    lastPersistedSourceRef.current = diagram.source;
    setSelections([]);
    setLabelEdit(null);
    setConnectMode(false);
    setConnectFrom(null);
    setSideTab("element");
    setRender(null);
    setRenderError("");
    setPast([]);
    setFuture([]);
    // Intenzionalmente solo al cambio diagramma: il tema viene riletto qui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram?.id]);

  // Aggiornamento esterno (AI o ripristino versione) diverso dal testo locale.
  useEffect(() => {
    if (!diagram) return;
    if (
      diagram.source !== lastPersistedSourceRef.current &&
      diagram.source !== savedSource &&
      diagram.source !== source
    ) {
      lastPersistedSourceRef.current = diagram.source;
      sourceRef.current = diagram.source;
      setSource(diagram.source);
      setSavedSource(diagram.source);
      setSelections([]);
      setLabelEdit(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagram?.source]);

  // Il tema può essere cambiato dall'AI o da un'altra parte: riallinea lo stato locale.
  useEffect(() => {
    if (!diagram) return;
    const persisted = themeForId(settings, diagram.id);
    if (JSON.stringify(persisted) !== JSON.stringify(theme)) setTheme(persisted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.diagram_themes, diagram?.id]);

  useEffect(() => {
    sourceRef.current = source;
  }, [source]);

  useEffect(() => {
    if (workspaceMode === "board" && board) {
      autosave.reset(board.sceneJson);
    }
    // Solo al cambio modalità/epoca: l'autosave non deve risettare se stesso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceMode, boardEpoch]);

  useEffect(() => {
    setDiagramDirty(dirty);
  }, [dirty, setDiagramDirty]);

  useEffect(() => () => setDiagramDirty(false), [setDiagramDirty]);

  useEffect(() => {
    if (!source.trim()) {
      setRender(null);
      setRenderError("");
      setRendering(false);
      return;
    }
    let cancelled = false;
    setRendering(true);
    const timer = window.setTimeout(() => {
      void renderDiagram(source, theme, mode)
        .then((result) => {
          if (cancelled) return;
          setRender(result);
          setRenderError("");
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setRender(null);
          setRenderError(error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          if (!cancelled) setRendering(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [source, theme, mode]);

  const commitSource = (next: string, validate = true): boolean => {
    if (next === source) return true;
    if (validate) {
      const result = validateSourceSync(next);
      if (!result.ok) {
        toast.error(`Modifica non applicata: ${result.error}`);
        return false;
      }
    }
    const now = Date.now();
    if (now - lastCommitRef.current > 600) {
      setPast((items) => [...items.slice(-19), source]);
      setFuture([]);
    }
    lastCommitRef.current = now;
    sourceRef.current = next;
    setSource(next);
    return true;
  };

  const undo = () => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [source, ...items].slice(0, 20));
    sourceRef.current = previous;
    setSource(previous);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, source].slice(-20));
    sourceRef.current = next;
    setSource(next);
  };

  const persistTheme = (next: DiagramTheme) => {
    setTheme(next);
    if (diagram) void setDiagramTheme(diagram.id, next);
  };

  const select = (selection: Selection | null, additive: boolean) => {
    if (connectMode && selection?.kind === "node") {
      if (!connectFrom) {
        setConnectFrom(selection.id);
        toast.info(`Origine: ${selection.id}. Ora clicca il nodo di arrivo`);
      } else if (selection.id !== connectFrom) {
        const next = addEdge(source, connectFrom, selection.id, connectArrow);
        if (commitSource(next)) {
          toast.success(`Arco creato: ${connectFrom} → ${selection.id}`);
          setConnectFrom(null);
          setConnectMode(false);
        }
      }
      return;
    }
    if (!selection) {
      setSelections([]);
      setLabelEdit(null);
      return;
    }
    setSideTab("element");
    setSelections((current) => (additive ? toggleSelection(current, selection) : [selection]));
  };

  const applyPatch = (patch: Partial<VisualStyle>) => {
    if (!selections.length) return;
    let nextStyles = { ...doc.styles };
    for (const selection of selections) {
      const allowed: Partial<VisualStyle> =
        selection.kind === "edge"
          ? {
              stroke: patch.stroke,
              strokeWidth: patch.strokeWidth,
              dash: patch.dash,
              opacity: patch.opacity,
            }
          : patch;
      nextStyles = withPatch(nextStyles, [selection.key], allowed);
    }
    commitSource(writeStyleBlock(source, nextStyles));
  };

  const resetSelected = () => {
    if (!selections.length) return;
    const nextStyles = resetKeys(doc.styles, selections.map((selection) => selection.key));
    commitSource(writeStyleBlock(source, nextStyles));
  };

  const applyBulk = (scope: "nodes" | "edges") => {
    const primary = selections[0];
    if (!primary) return;
    const style = doc.styles[primary.key];
    const effective = effectiveStyle(tokens, primary.kind, style);
    const patch: Partial<VisualStyle> =
      scope === "edges"
        ? {
            stroke: effective.stroke,
            strokeWidth: effective.strokeWidth,
            dash: effective.dash,
            opacity: effective.opacity,
          }
        : {
            fill: effective.fill,
            stroke: effective.stroke,
            textColor: effective.textColor,
            strokeWidth: effective.strokeWidth,
            dash: effective.dash,
            opacity: effective.opacity,
            radius: effective.radius,
            fontSize: effective.fontSize,
            fontWeight: effective.fontWeight,
          };
    const keys =
      scope === "nodes"
        ? [
            ...allNodeKeys(doc.model),
            ...(doc.capabilities.clusters ? allClusterKeys(doc.model) : []),
          ]
        : allEdgeKeys(doc.model);
    if (!keys.length) {
      toast.info(scope === "nodes" ? "Nessun nodo da aggiornare" : "Nessun arco da aggiornare");
      return;
    }
    const nextStyles = withPatch(doc.styles, keys, patch);
    if (commitSource(writeStyleBlock(source, nextStyles))) {
      toast.success(`Stile applicato a ${keys.length} element${keys.length === 1 ? "o" : "i"}`);
    }
  };

  const switchToBoard = async () => {
    if (!diagram || workspaceMode === "board") return;
    if (dirty) {
      const ok = await saveCurrent();
      if (!ok) return;
    }
    setConversionError("");
    setBoardActionError("");
    setConversionMeta(null);
    setWorkspaceMode("board");
    await loadBoard();
  };

  const switchToDiagram = async () => {
    if (workspaceMode !== "board") return;
    if (!(await flushBoard())) return;
    boardHandleRef.current = null;
    setWorkspaceMode("diagram");
  };

  const createBoard = async (kind: "convert" | "manual" | "image") => {
    if (!diagram) return;
    if (streaming) {
      toast.info("Attendi la fine della generazione prima di creare la lavagna");
      return;
    }
    setConversionError("");
    setBoardActionError("");
    setConverting(true);
    try {
      let scene: BoardScene;
      let origin: "diagram" | "manual";
      let baseSource: string | null = null;
      let meta: { quality: "semantic" | "generic" | "image"; type: string } | null =
        null;
      if (kind === "convert") {
        const result: ConversionResult = await convertMermaidToBoard(
          source,
          theme,
          mode,
        );
        scene = result.scene;
        origin = "diagram";
        baseSource = source;
        meta = { quality: result.quality, type: result.type };
        if (result.quality !== "semantic") {
          setConversionMeta(meta);
        }
      } else if (kind === "manual") {
        scene = emptyBoardScene(mode);
        origin = "manual";
      } else {
        const fresh = await withFreshRender();
        scene = imageSceneFromSvg(
          fresh.svg,
          fresh.width,
          fresh.height,
          theme,
          mode,
        );
        origin = "diagram";
        baseSource = source;
        meta = { quality: "image", type: doc.kind };
        setConversionMeta(meta);
      }
      const created = await api.boardCreate(
        diagram.id,
        serializeBoardScene(scene),
        origin,
        baseSource,
      );
      replaceBoard(created);
      autosave.reset(created.sceneJson);
      if (kind === "manual") {
        toast.success("Lavagna pronta: disegna liberamente");
      } else if (meta?.quality === "image") {
        toast.info("Lavagna creata con un'immagine Mermaid");
      } else {
        toast.success("Lavagna creata");
      }
    } catch (error) {
      const detail =
        error instanceof BoardConversionError || error instanceof Error
          ? error.message
          : String(error);
      setConversionError(detail);
    } finally {
      setConverting(false);
    }
  };

  const regenerateBoard = async (saveFirst: boolean) => {
    if (!diagram) return;
    if (streaming) {
      toast.info("Attendi la fine della generazione prima di aggiornare la lavagna");
      return;
    }
    if (!source.trim()) {
      toast.error("Il sorgente è vuoto: correggilo prima di rigenerare");
      return;
    }
    if (saveFirst) {
      const ok = await saveCurrent(true);
      if (!ok) return;
    } else if (
      !window.confirm(
        "La lavagna attuale sarà sostituita dalla conversione del sorgente. Se vuoi poterla ripristinare, usa «Salva e aggiorna». Continuare?",
      )
    ) {
      return;
    }
    setBoardBusy(true);
    setBoardActionError("");
    try {
      const result = await convertMermaidToBoard(source, theme, mode);
      const saved = await api.boardCreate(
        diagram.id,
        serializeBoardScene(result.scene),
        "diagram",
        source,
      );
      replaceBoard(saved);
      autosave.reset(saved.sceneJson);
      setConversionMeta({ quality: result.quality, type: result.type });
      toast.success("Lavagna aggiornata dal diagramma");
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : String(error);
      setBoardActionError(detail);
      toast.error(`Aggiornamento lavagna: ${detail}`);
    } finally {
      setBoardBusy(false);
    }
  };

  const openDiagramFromBoard = async () => {
    await switchToDiagram();
  };

  const editBoardWithAi = async () => {
    if (!diagram) return;
    if (!(await flushBoard())) return;
    setWorkspaceMode("diagram");
    focusChat(diagram.id);
  };

  const openBoardSource = () => {
    boardHandleRef.current = null;
    setWorkspaceMode("diagram");
    setSideOpen(true);
    setSideTab("source");
  };

  const saveCurrent = async (force = false): Promise<boolean> => {
    if (!diagram) return false;
    if (!source.trim()) {
      toast.error("Il sorgente è vuoto");
      return false;
    }
    const savingSource = source;
    const previousPersisted = lastPersistedSourceRef.current;
    lastPersistedSourceRef.current = savingSource;
    const ok = await saveDiagram(savingSource, diagram.title, force);
    if (ok) {
      setSavedSource(savingSource);
      setDiagramDirty(sourceRef.current !== savingSource);
    } else {
      lastPersistedSourceRef.current = previousPersisted;
    }
    return ok;
  };

  const revealSelection = () => {
    const selection = selections[0];
    if (!selection) return;
    const index = buildSourceIndex(source, doc.model);
    const range = rangeForSelection(index, selection);
    if (!range) {
      toast.info("Nessuna riga sorgente associata a questo elemento");
      return;
    }
    setSideOpen(true);
    setSideTab("source");
    setReveal({ from: range.from, to: range.to, line: range.line });
  };

  useEffect(() => {
    if (!reveal || sideTab !== "source") return;
    const timer = window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(reveal.from, reveal.to);
        const lineHeight = 17.05;
        textarea.scrollTop = Math.max(0, (reveal.line - 3) * lineHeight);
      }
      setReveal(null);
    });
    return () => window.cancelAnimationFrame(timer);
  }, [sideTab, reveal]);

  const startLabelEdit = (
    nodeId: string,
    rect: { left: number; top: number; width: number; height: number },
  ) => {
    const selection = makeSelection("node", nodeId);
    setSelections([selection]);
    setLabelEdit({
      nodeId,
      value: nodeLabel(source, nodeId),
      ...rect,
    });
  };

  const commitLabel = (value: string) => {
    if (!labelEdit) return;
    const next = replaceNodeLabel(source, labelEdit.nodeId, value);
    if (commitSource(next)) setLabelEdit(null);
  };

  const addNewNode = () => {
    const used = new Set(doc.model.nodes.map((node) => node.id));
    let index = 1;
    while (used.has(`N${index}`)) index += 1;
    const id = `N${index}`;
    if (commitSource(addNode(source, id, "Nuovo nodo"))) {
      setSelections([makeSelection("node", id)]);
      setSideOpen(true);
      setSideTab("element");
    }
  };

  const deleteSelected = () => {
    const selection = selections[0];
    if (!selection) return;
    if (selection.kind === "cluster") {
      toast.info("L'eliminazione dei gruppi va fatta dal sorgente");
      return;
    }
    const target = selection.kind === "edge" ? `l'arco ${selection.id}` : `il nodo ${selection.id}`;
    const description = selectionLabel(doc.model, selection);
    if (!window.confirm(`Eliminare ${target} (${description})? Verranno rimosse le righe che lo contengono.`)) {
      return;
    }
    const result = deleteSelectionLine(source, selection, doc.model);
    if (!result.removed) {
      toast.error(result.note ?? "Elemento non eliminabile dal pannello");
      return;
    }
    if (commitSource(result.source)) {
      setSelections([]);
      setLabelEdit(null);
      toast.success(result.note ?? "Elemento eliminato");
    }
  };

  const changeShape = (id: string, shapeId: string) => {
    commitSource(setNodeShape(source, id, shapeId));
  };

  const changeDirection = (direction: DiagramDirection) => {
    commitSource(setDirection(source, direction));
  };

  const changeEdgeArrow = (styleId: string) => {
    const selection = selections[0];
    if (!selection || selection.kind !== "edge") return;
    const result = setEdgeArrow(
      source,
      doc.model,
      selection.index ?? Number(selection.id),
      styleId,
    );
    if (!result.ok) {
      toast.error(result.note ?? "Punte non modificabili");
      return;
    }
    commitSource(result.source);
  };

  const flipSelectedEdge = () => {
    const selection = selections[0];
    if (!selection || selection.kind !== "edge") return;
    const result = reverseEdge(source, doc.model, selection.index ?? Number(selection.id));
    if (!result.ok) {
      toast.error(result.note ?? "Direzione non modificabile");
      return;
    }
    commitSource(result.source);
  };

  const handleSourceChange = (value: string) => {
    sourceRef.current = value;
    setSource(value);
    setPast([]);
    setFuture([]);
  };

  const handleCursor = (offset: number) => {
    if (cursorTimer.current) window.clearTimeout(cursorTimer.current);
    cursorTimer.current = window.setTimeout(() => {
      const selection = selectionAtCursor(source, offset, doc.model);
      if (selection) setSelections([selection]);
    }, 160);
  };

  const withFreshRender = async () => {
    if (!source.trim()) throw new Error("Sorgente vuoto");
    return renderDiagram(source, theme, mode);
  };

  const exportSvg = async (background: boolean) => {
    if (!diagram) return;
    setExporting(true);
    try {
      const fresh = await withFreshRender();
      const path = await save({
        defaultPath: `${slug(diagram.title)}.svg`,
        filters: [{ name: "SVG", extensions: ["svg"] }],
      });
      if (path) {
        await api.saveFile(
          path,
          sanitizeSvgForExport(fresh.svg, theme, { background, mode }),
          false,
        );
        toast.success(`SVG ${background ? "con sfondo" : "trasparente"} esportato`);
      }
    } catch (error) {
      toast.error(`Export SVG: ${String(error)}`);
    } finally {
      setExporting(false);
    }
  };

  const exportPng = async (scale: number) => {
    if (!diagram) return;
    setExporting(true);
    try {
      const fresh = await withFreshRender();
      const path = await save({
        defaultPath: `${slug(diagram.title)}-${scale}x.png`,
        filters: [{ name: "PNG", extensions: ["png"] }],
      });
      if (path) {
        const data = await svgToPngBase64(fresh.svg, scale, "theme", theme, mode);
        await api.saveFile(path, data, true);
        toast.success(`PNG ${scale}x esportato`);
      }
    } catch (error) {
      toast.error(`Export PNG: ${String(error)}`);
    } finally {
      setExporting(false);
    }
  };

  const exportMmd = async () => {
    if (!diagram) return;
    try {
      const path = await save({
        defaultPath: `${slug(diagram.title)}.mmd`,
        filters: [{ name: "Mermaid", extensions: ["mmd"] }],
      });
      if (path) {
        await api.saveFile(path, source, false);
        toast.success("Sorgente Mermaid esportato");
      }
    } catch (error) {
      toast.error(`Export sorgente: ${String(error)}`);
    }
  };

  const copySvg = async () => {
    try {
      const fresh = await withFreshRender();
      await navigator.clipboard.writeText(
        sanitizeSvgForExport(fresh.svg, theme, { background: true, mode }),
      );
      toast.success("SVG copiato");
    } catch (error) {
      toast.error(`Copia SVG: ${String(error)}`);
    }
  };

  const copyMmd = async () => {
    try {
      await navigator.clipboard.writeText(source);
      toast.success("Sorgente Mermaid copiato");
    } catch (error) {
      toast.error(`Copia sorgente: ${String(error)}`);
    }
  };

  const boardFileStem = () => `${slug(diagram?.title ?? "lavagna")}-lavagna`;

  const exportBoardPngFile = async (scale: 1 | 2 | 3, background: boolean) => {
    if (!diagram) return;
    setExporting(true);
    try {
      const path = await save({
        defaultPath: `${boardFileStem()}-${scale}x${background ? "" : "-trasparente"}.png`,
        filters: [{ name: "PNG", extensions: ["png"] }],
      });
      if (path) {
        const data = await boardPngBase64(boardHandleRef.current, scale, background);
        await api.saveFile(path, data, true);
        toast.success(`PNG ${scale}x ${background ? "con sfondo" : "trasparente"} esportato`);
      }
    } catch (error) {
      toast.error(`Export lavagna PNG: ${String(error)}`);
    } finally {
      setExporting(false);
    }
  };

  const exportBoardSvgFile = async (background: boolean) => {
    if (!diagram) return;
    setExporting(true);
    try {
      const path = await save({
        defaultPath: `${boardFileStem()}${background ? "" : "-trasparente"}.svg`,
        filters: [{ name: "SVG", extensions: ["svg"] }],
      });
      if (path) {
        const data = await boardSvg(boardHandleRef.current, background);
        await api.saveFile(path, data, false);
        toast.success(`SVG ${background ? "con sfondo" : "trasparente"} esportato`);
      }
    } catch (error) {
      toast.error(`Export lavagna SVG: ${String(error)}`);
    } finally {
      setExporting(false);
    }
  };

  const exportBoardScene = async () => {
    if (!diagram) return;
    setExporting(true);
    try {
      const path = await save({
        defaultPath: `${boardFileStem()}.excalidraw`,
        filters: [{ name: "Excalidraw", extensions: ["excalidraw"] }],
      });
      if (path) {
        await api.saveFile(path, boardExcalidrawJson(boardHandleRef.current), false);
        toast.success("Scena .excalidraw esportata");
      }
    } catch (error) {
      toast.error(`Export scena: ${String(error)}`);
    } finally {
      setExporting(false);
    }
  };

  const copyBoard = async (kind: "png" | "svg") => {
    try {
      if (kind === "png") {
        const result = await copyBoardPng(boardHandleRef.current);
        if (result === "ok") {
          toast.success("PNG copiato");
          return;
        }
        const svg = await boardSvg(boardHandleRef.current, true);
        if (copyTextFallback(svg)) {
          toast.info("Copia PNG non disponibile: ho copiato l'SVG");
        } else {
          toast.error("Copia non supportata: usa Esporta");
        }
        return;
      }
      const result = await copyBoardSvg(boardHandleRef.current);
      if (result === "ok") {
        toast.success("SVG copiato");
        return;
      }
      const svg = await boardSvg(boardHandleRef.current, true);
      if (copyTextFallback(svg)) toast.success("SVG copiato");
      else toast.error("Copia non supportata: usa Esporta");
    } catch (error) {
      toast.error(`Copia lavagna: ${String(error)}`);
    }
  };

  const openBoardLink = async (url: string) => {
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Apro solo link http/https nel browser di sistema");
      return;
    }
    try {
      await openUrl(url);
    } catch (error) {
      toast.error(`Apertura link: ${String(error)}`);
    }
  };

  const rename = async () => {
    if (!diagram) return;
    const title = window.prompt("Titolo del diagramma", diagram.title);
    if (!title || title.trim() === diagram.title) return;
    const savingSource = source;
    const previousPersisted = lastPersistedSourceRef.current;
    lastPersistedSourceRef.current = savingSource;
    const ok = await saveDiagram(savingSource, title.trim());
    if (ok) {
      setSavedSource(savingSource);
      setDiagramDirty(sourceRef.current !== savingSource);
    } else {
      lastPersistedSourceRef.current = previousPersisted;
    }
    return ok;
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest("input, textarea, select"));
      const inWorkspace = Boolean(target?.closest(".workspace-pane"));
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveCurrent();
        return;
      }
      // In lavagna le scorciatoie dell'app non devono intercettare Excalidraw.
      if (workspaceMode === "board") return;
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "z" &&
        !typing &&
        inWorkspace
      ) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (
        !typing &&
        inWorkspace &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const key = event.key.toLowerCase();
        if (key === "v") {
          event.preventDefault();
          setTool("select");
          return;
        }
        if (key === "h") {
          event.preventDefault();
          setTool("pan");
          return;
        }
      }
      if (event.key === "Escape") {
        setConnectMode(false);
        setConnectFrom(null);
        setLabelEdit(null);
      }
      if (event.key === "Delete" && !typing && inWorkspace && selections.length) {
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, selections, past, future, diagram?.id, workspaceMode]);

  if (!diagram) {
    return (
      <aside className={`workspace-pane ${viewerExpanded ? "is-expanded" : ""}`}>
        {viewerExpanded && <RestoreRail onRestore={toggleViewerExpanded} />}
        <div className="workspace-core">
          <DiagramGallery onOpen={(id) => void selectDiagram(id)} />
        </div>
      </aside>
    );
  }

  return (
    <aside className={`workspace-pane ${viewerExpanded ? "is-expanded" : ""}`}>
      {viewerExpanded && <RestoreRail onRestore={toggleViewerExpanded} />}
      <div className="workspace-core">
      <header className={`workspace-header ${workspaceMode === "board" ? "is-board" : ""}`}>
        <div className="workspace-heading">
          {!viewerExpanded && (
            <button
              className="icon-btn workspace-expand"
              title="Espandi il viewer a sinistra"
              onClick={toggleViewerExpanded}
            >
              <ChevronsLeft size={16} />
            </button>
          )}
          <div className="workspace-title">
            <div className="eyebrow">
              {workspaceMode === "board"
                ? `lavagna · ${themeLabel(theme)}`
                : `${render ? `render: ${render.renderer}` : "diagramma"} · ${doc.kind} · ${themeLabel(theme)}`}
            </div>
            <h2>{diagram.title}</h2>
          </div>
        </div>

        <div className="workspace-header-center">
          <div className="workspace-switch" role="tablist" aria-label="Superficie di lavoro">
            <button
              role="tab"
              aria-selected={workspaceMode === "diagram"}
              className={workspaceMode === "diagram" ? "active" : ""}
              onClick={() => void switchToDiagram()}
              disabled={converting}
            >
              <Workflow size={13} />
              <span>Diagramma</span>
            </button>
            <button
              role="tab"
              aria-selected={workspaceMode === "board"}
              className={workspaceMode === "board" ? "active" : ""}
              onClick={() => void switchToBoard()}
              disabled={converting}
              title="Apri la lavagna Excalidraw"
            >
              <PenTool size={13} />
              <span>Lavagna</span>
            </button>
          </div>
        </div>

        <div className="workspace-actions">
          {workspaceMode === "diagram" ? (
            <>
              <button
                className="icon-btn"
                title="Torna alla galleria"
                onClick={() => void selectDiagram(null)}
              >
                <Workflow size={16} />
              </button>
              <button
                className="icon-btn"
                title={diagram.inLibrary ? "Rimuovi dalla libreria" : "Salva in libreria"}
                onClick={() => void toggleLibrary(diagram.id)}
              >
                {diagram.inLibrary ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
              </button>
              <button
                className={`icon-btn ${diagram.favorite ? "star-on" : ""}`}
                title="Preferito"
                onClick={() => void toggleFavorite(diagram.id)}
              >
                <Star size={17} />
              </button>
              <button className="icon-btn" title="Rinomina" onClick={() => void rename()}>
                <Pencil size={16} />
              </button>
              <button
                className="icon-btn danger"
                title="Elimina diagramma"
                onClick={() => {
                  if (dirty) {
                    toast.warning("Salva o annulla le modifiche al diagramma prima di eliminarlo");
                    return;
                  }
                  if (window.confirm(`Eliminare “${diagram.title}”?`)) {
                    void deleteDiagram(diagram.id);
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-ghost"
                onClick={() => void saveCurrent()}
                title="Salva una versione con il sorgente e la lavagna (Ctrl+S)"
              >
                <Save size={15} /> Salva versione
              </button>
              <details className="export-menu">
                <summary className="icon-btn" title="Esporta la lavagna">
                  <Download size={16} />
                </summary>
                <div className="export-popover" onClick={(event) => {
                  (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                }}>
                  <button disabled={exporting} onClick={() => void exportBoardPngFile(1, true)}>PNG 1x con sfondo</button>
                  <button disabled={exporting} onClick={() => void exportBoardPngFile(2, true)}>PNG 2x con sfondo</button>
                  <button disabled={exporting} onClick={() => void exportBoardPngFile(3, true)}>PNG 3x con sfondo</button>
                  <button disabled={exporting} onClick={() => void exportBoardPngFile(1, false)}>PNG 1x trasparente</button>
                  <button disabled={exporting} onClick={() => void exportBoardPngFile(2, false)}>PNG 2x trasparente</button>
                  <button disabled={exporting} onClick={() => void exportBoardPngFile(3, false)}>PNG 3x trasparente</button>
                  <button disabled={exporting} onClick={() => void exportBoardSvgFile(true)}>SVG con sfondo</button>
                  <button disabled={exporting} onClick={() => void exportBoardSvgFile(false)}>SVG trasparente</button>
                  <button disabled={exporting} onClick={() => void exportBoardScene()}>.excalidraw</button>
                  <button onClick={() => void copyBoard("png")}><Copy size={13} /> Copia PNG</button>
                  <button onClick={() => void copyBoard("svg")}><FileCode2 size={13} /> Copia SVG</button>
                </div>
              </details>
              <details className="workspace-menu">
                <summary className="icon-btn" title="Altre azioni">
                  <MoreHorizontal size={17} />
                </summary>
                <div
                  className="workspace-menu-popover"
                  onClick={(event) => {
                    (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute(
                      "open",
                    );
                  }}
                >
                  <button onClick={() => void selectDiagram(null)}>
                    <Workflow size={14} /> Torna alla galleria
                  </button>
                  <button onClick={() => void toggleLibrary(diagram.id)}>
                    {diagram.inLibrary ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                    {diagram.inLibrary ? "Rimuovi dalla libreria" : "Salva in libreria"}
                  </button>
                  <button onClick={() => void toggleFavorite(diagram.id)}>
                    <Star size={14} /> {diagram.favorite ? "Rimuovi preferito" : "Preferito"}
                  </button>
                  <button onClick={() => void rename()}>
                    <Pencil size={14} /> Rinomina
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (window.confirm(`Eliminare “${diagram.title}” e la sua lavagna?`)) {
                        void deleteDiagram(diagram.id);
                      }
                    }}
                  >
                    <Trash2 size={14} /> Elimina diagramma
                  </button>
                </div>
              </details>
            </>
          )}
        </div>
      </header>

      {workspaceMode === "diagram" && (
      <div className="workspace-toolbar">
        <div className="toolbar-spacer" />
        <button
          className={`icon-btn ${tool === "select" ? "active" : ""}`}
          title="Seleziona oggetti (V)"
          aria-pressed={tool === "select"}
          onClick={() => setTool("select")}
        >
          <MousePointer2 size={16} />
        </button>
        <button
          className={`icon-btn ${tool === "pan" ? "active" : ""}`}
          title="Sposta la vista (H)"
          aria-pressed={tool === "pan"}
          onClick={() => setTool("pan")}
        >
          <Hand size={16} />
        </button>
        <span className="toolbar-divider" />
        <button className="icon-btn" title="Zoom out" onClick={() => stageRef.current?.zoomOut()}>
          <ZoomOut size={16} />
        </button>
        <button className="icon-btn" title="Zoom in" onClick={() => stageRef.current?.zoomIn()}>
          <ZoomIn size={16} />
        </button>
        <button className="icon-btn" title="Adatta" onClick={() => stageRef.current?.fit()}>
          <Maximize2 size={16} />
        </button>
        <button
          className="icon-btn"
          title="Dimensione reale"
          onClick={() => stageRef.current?.actualSize()}
        >
          <span className="actual-size">1:1</span>
        </button>
        <span className="toolbar-divider" />
        <button className="icon-btn" title="Annulla modifica visuale" onClick={undo} disabled={!past.length}>
          <Undo2 size={16} />
        </button>
        <button className="icon-btn" title="Ripeti modifica visuale" onClick={redo} disabled={!future.length}>
          <Redo2 size={16} />
        </button>
        <span className="toolbar-divider" />
        {doc.capabilities.structure && (
          <>
            <button className="icon-btn" title="Aggiungi nodo" onClick={addNewNode}>
              <Plus size={16} />
            </button>
            <button
              className={`icon-btn ${connectMode ? "active" : ""}`}
              title="Connetti nodi: clicca sorgente e destinazione"
              onClick={() => {
                if (connectMode) {
                  setConnectMode(false);
                  setConnectFrom(null);
                } else {
                  setConnectMode(true);
                  setConnectFrom(null);
                  setTool("select");
                  toast.info("Clicca il nodo di partenza, poi quello di arrivo");
                }
              }}
            >
              <Link2 size={16} />
            </button>
            <select
              className="toolbar-select"
              value={connectArrow}
              onChange={(event) => setConnectArrow(event.target.value)}
              title="Tipo di freccia per la connessione"
            >
              {ARROW_OPTIONS.map((arrow) => (
                <option key={arrow.id} value={arrow.value}>
                  {arrow.label}
                </option>
              ))}
            </select>
          </>
        )}
        {doc.capabilities.direction && (
          <select
            className="toolbar-select"
            value={normalizeDirection(doc.model.direction)}
            onChange={(event) => changeDirection(event.target.value as DiagramDirection)}
            title="Direzione del layout"
          >
            {DIRECTION_OPTIONS.map((direction) => (
              <option key={direction.id} value={direction.id} title={direction.hint}>
                {direction.label}
              </option>
            ))}
          </select>
        )}
        {(doc.capabilities.structure ||
          (doc.capabilities.edgeSelection && selections[0]?.kind === "edge")) && (
          <button
            className="icon-btn danger"
            title={
              doc.capabilities.structure
                ? "Elimina elemento selezionato"
                : "Elimina la connessione selezionata"
            }
            onClick={deleteSelected}
            disabled={doc.capabilities.structure ? !selections.length : false}
          >
            <Trash2 size={16} />
          </button>
        )}
        <span className="toolbar-divider" />
        {dirty && (
          <button
            className="icon-btn"
            title="Annulla modifiche non salvate"
            onClick={() => {
              if (!window.confirm("Annullare le modifiche non salvate?")) return;
              sourceRef.current = savedSource;
              setSource(savedSource);
              setSelections([]);
              setLabelEdit(null);
              setConnectMode(false);
              setConnectFrom(null);
              setPast([]);
              setFuture([]);
            }}
          >
            <RotateCcw size={16} />
          </button>
        )}
        <button
          className={`btn btn-ghost ${dirty ? "dirty" : ""}`}
          onClick={() => void saveCurrent()}
          title="Salva versione (Ctrl+S)"
        >
          <Save size={15} /> {dirty ? "Salva*" : "Salvato"}
        </button>
        <details
          className="export-menu"
          open={exportOpen}
          onToggle={(event) => setExportOpen((event.target as HTMLDetailsElement).open)}
        >
          <summary className="icon-btn" title="Esporta">
            <Download size={16} />
          </summary>
          <div
            className="export-popover"
            onClick={(event) => {
              (event.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute(
                "open",
              );
            }}
          >
            <button onClick={() => void exportSvg(true)} disabled={exporting}>
              SVG con sfondo
            </button>
            <button onClick={() => void exportSvg(false)} disabled={exporting}>
              SVG trasparente
            </button>
            <button onClick={() => void exportPng(1)} disabled={exporting}>
              PNG 1x
            </button>
            <button onClick={() => void exportPng(2)} disabled={exporting}>
              PNG 2x
            </button>
            <button onClick={() => void exportPng(3)} disabled={exporting}>
              PNG 3x
            </button>
            <button onClick={() => void exportMmd()}>Sorgente .mmd</button>
            <button onClick={() => void copySvg()}>
              <Copy size={13} /> Copia SVG
            </button>
            <button onClick={() => void copyMmd()}>
              <FileCode2 size={13} /> Copia sorgente
            </button>
          </div>
        </details>
      </div>

      )}

      {workspaceMode === "board" ? (
        <div className="board-body">
          {board && (
            <BoardStatusBar
              board={board}
              source={source}
              themeLabelText={themeLabel(theme)}
              saveState={autosave.state}
              lastSavedAt={autosave.lastSavedAt}
              saveError={boardSaveError}
              busy={boardBusy || converting}
              onUpdate={() => void regenerateBoard(false)}
              onSaveAndUpdate={() => void regenerateBoard(true)}
              onRetrySave={() => void flushBoard()}
              onOpenDiagram={() => void openDiagramFromBoard()}
              onEditWithAi={() => void editBoardWithAi()}
            />
          )}
          {conversionMeta && conversionMeta.quality !== "semantic" && (
            <div className="board-quality-banner" role="status">
              <AlertTriangle size={14} />
              <span>{conversionQualityMessage(conversionMeta.quality, conversionMeta.type)}</span>
              <button
                className="btn btn-ghost tiny"
                onClick={() => setConversionMeta(null)}
              >
                Chiudi
              </button>
            </div>
          )}
          {boardActionError && (
            <div className="board-quality-banner" role="alert">
              <AlertTriangle size={14} />
              <span>{boardActionError}</span>
              <button
                className="btn btn-ghost tiny"
                onClick={() => void regenerateBoard(false)}
              >
                Riprova
              </button>
              <button
                className="btn btn-ghost tiny"
                onClick={() => setBoardActionError("")}
              >
                Chiudi
              </button>
            </div>
          )}
          {boardLoading ? (
            <div className="board-first-run">
              <div className="empty-inline">
                <Loader2 className="spin" size={20} /> Caricamento lavagna…
              </div>
            </div>
          ) : boardError || boardSceneResult.error ? (
            <div className="board-first-run">
              <div className="render-error">
                <AlertTriangle size={22} />
                <h3>Lavagna non disponibile</h3>
                <pre>{boardError || boardSceneResult.error}</pre>
                <p className="muted">
                  Il diagramma è intatto. Puoi riprovare, rigenerare la lavagna o
                  crearne una vuota.
                </p>
                <div className="board-error-actions">
                  <button className="btn btn-ghost" onClick={() => void loadBoard()}>
                    <RefreshCw size={14} /> Riprova
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => void regenerateBoard(false)}
                  >
                    Rigenera dalla sorgente
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => void createBoard("manual")}
                  >
                    Lavagna vuota
                  </button>
                </div>
              </div>
            </div>
          ) : board && boardSceneResult.scene ? (
            <BoardCanvas
              scene={boardSceneResult.scene}
              sceneKey={String(boardEpoch)}
              onSceneChange={autosave.notify}
              onReady={(handle) => {
                boardHandleRef.current = handle;
              }}
              onLinkOpen={(url) => void openBoardLink(url)}
            />
          ) : (
            <BoardFirstRun
              busy={converting}
              error={conversionError}
              onConvert={() => void createBoard("convert")}
              onManual={() => void createBoard("manual")}
              onImage={() => void createBoard("image")}
              onRetry={() => void createBoard("convert")}
              onOpenSource={openBoardSource}
            />
          )}
        </div>
      ) : (
      <div className="workspace-body" style={workspaceStyle}>
        <div className="workspace-stage-area">
          {renderError ? (
            <div className="render-error">
              <AlertTriangle size={22} />
              <h3>Il diagramma non è renderizzabile</h3>
              <pre>{renderError}</pre>
              <p className="muted">
                Correggi il sorgente: le modifiche visuali non vengono applicate se
                rompono il rendering.
              </p>
              <button className="btn btn-ghost" onClick={() => setSideTab("source")}>
                <Pencil size={15} /> Apri sorgente
              </button>
            </div>
          ) : render ? (
            <DiagramStage
              ref={stageRef}
              svg={render.svg}
              diagramKey={diagram.id}
              renderer={render.renderer}
              model={doc.model}
              tool={tool}
              selections={selections}
              onSelect={select}
              onStartLabelEdit={startLabelEdit}
              labelEdit={labelEdit}
              onLabelCommit={commitLabel}
              onLabelCancel={() => setLabelEdit(null)}
              canEditLabels={canEditLabels}
            />
          ) : (
            <div className="empty-inline tall">
              <Loader2 className="spin" size={22} /> Rendering…
            </div>
          )}
          {rendering && render && <div className="rendering-badge">Aggiornamento…</div>}
          {connectMode && (
            <div className="connect-banner">
              <Link2 size={14} />{" "}
              {connectFrom ? (
                <>
                  Connetti da <strong>{connectFrom}</strong>: clicca il nodo di arrivo
                </>
              ) : (
                <>Connetti: clicca il nodo di partenza</>
              )}
              <button
                onClick={() => {
                  setConnectMode(false);
                  setConnectFrom(null);
                }}
              >
                Annulla
              </button>
            </div>
          )}
        </div>
        {sideOpen ? (
          <>
            <aside className="workspace-side">
              <div className="side-head">
                <div className="side-tabs">
                  <button
                    className={sideTab === "element" ? "active" : ""}
                    onClick={() => setSideTab("element")}
                  >
                    Elemento
                  </button>
                  <button
                    className={sideTab === "theme" ? "active" : ""}
                    onClick={() => setSideTab("theme")}
                  >
                    Tema
                  </button>
                  <button
                    className={sideTab === "versions" ? "active" : ""}
                    onClick={() => setSideTab("versions")}
                  >
                    Versioni <span className="count">{versions.length}</span>
                  </button>
                  <button
                    className={sideTab === "source" ? "active" : ""}
                    onClick={() => setSideTab("source")}
                  >
                    Sorgente {dirty && <span className="dirty-dot" />}
                  </button>
                </div>
                <button
                  className="icon-btn"
                  title="Comprimi i controlli"
                  onClick={() => setSideOpen(false)}
                >
                  <PanelRightClose size={15} />
                </button>
              </div>
              <div className="side-content">
            {sideTab === "element" && (
              <Inspector
                kind={doc.kind}
                model={doc.model}
                source={source}
                capabilities={doc.capabilities}
                selections={selections}
                styles={doc.styles}
                tokens={tokens}
                onSelect={select}
                onPatch={applyPatch}
                onReset={resetSelected}
                onBulk={applyBulk}
                onLabelChange={(id, label) => {
                  if (commitSource(replaceNodeLabel(source, id, label))) {
                    setSelections([makeSelection("node", id)]);
                  }
                }}
                onShapeChange={changeShape}
                onReveal={revealSelection}
                onApplyPreset={(preset: PresetId) => persistTheme({ preset })}
                onEdgeArrow={changeEdgeArrow}
                onReverseEdge={flipSelectedEdge}
              />
            )}
            {sideTab === "theme" && (
              <ThemePanel
                theme={theme}
                tokens={tokens}
                workspaceBg={workspaceBg}
                workspaceGrid={workspaceGrid}
                onPreset={(preset) => persistTheme({ preset })}
                onToken={(patch) => persistTheme(customTheme(tokens, patch))}
                onWorkspaceBg={(value) => void setSetting("workspace_bg", value)}
                onWorkspaceGrid={(value) => void setSetting("workspace_grid", value ? "1" : "0")}
                onReset={() => persistTheme(defaultTheme())}
              />
            )}
            {sideTab === "versions" && (
              <div className="versions-panel">
                <div className="panel-head">
                  <h3>Versioni</h3>
                  <span className="count">{versions.length}</span>
                </div>
                <div className="version-list">
                  {versions.length === 0 ? (
                    <div className="empty-inline">Nessuna versione</div>
                  ) : (
                    versions.map((version) => (
                      <div className="version-row" key={version.id}>
                        <div>
                          <strong>
                            v{version.versionNo}
                            {version.boardSnapshot && (
                              <span className="version-board-badge">Lavagna</span>
                            )}
                          </strong>
                          <small>
                            {version.origin} · {date(version.createdAt)}
                          </small>
                        </div>
                        <button
                          className="btn btn-ghost tiny"
                          title="Ripristina questa versione"
                          onClick={() => {
                            if (
                              window.confirm(
                                version.boardSnapshot
                                  ? `Ripristinare la versione v${version.versionNo}? Verranno ripristinati sorgente e lavagna.`
                                  : `Ripristinare la versione v${version.versionNo}? La lavagna attuale resta e sarà marcata «Da aggiornare» se il sorgente cambia.`,
                              )
                            ) {
                              void restoreVersion(version.id);
                            }
                          }}
                        >
                          <RotateCcw size={13} /> Ripristina
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            {sideTab === "source" && (
              <SourceEditor
                value={source}
                onChange={handleSourceChange}
                textareaRef={textareaRef}
                onCursor={handleCursor}
                onSave={() => void saveCurrent()}
                dirty={dirty}
                error={renderError || undefined}
              />
            )}
              </div>
            </aside>
          </>
        ) : (
          <div className="side-rail">
            <button
              className="icon-btn"
              title="Apri i controlli"
              onClick={() => setSideOpen(true)}
            >
              <PanelRightOpen size={15} />
            </button>
            <span>Controlli</span>
          </div>
        )}
      </div>
      )}

      {diagram.conversationId === null && (
        <button className="back-to-chat" onClick={() => void selectDiagram(null)}>
          <ChevronLeft size={14} /> Torna alla galleria
        </button>
      )}
      </div>
    </aside>
  );
}
