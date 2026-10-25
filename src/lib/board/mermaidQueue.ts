/**
 * Coda Mermaid condivisa con il fork. Il fork la esporta dal package index e la
 * usa per le proprie chiamate; l'app la usa per il fallback Mermaid così le due
 * superfici non si sovrappongono su `mermaid.initialize`/`render`.
 *
 * L'import resta lazy: il fork viene caricato solo quando serve davvero.
 */
let loader: Promise<typeof import("@excalidraw/mermaid-to-excalidraw")> | null =
  null;

export async function runInSharedMermaidQueue<T>(
  task: () => Promise<T>,
): Promise<T> {
  loader ??= import("@excalidraw/mermaid-to-excalidraw");
  const { runMermaidTaskSequentially } = await loader;
  return runMermaidTaskSequentially(task);
}
