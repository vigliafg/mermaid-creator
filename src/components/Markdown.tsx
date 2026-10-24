import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Workflow } from "lucide-react";
import { stripThemeCommands } from "../lib/diagram/themeCommand";

export function Markdown({ content }: { content: string }) {
  const visible = stripThemeCommands(content);
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          pre: ({ children }) => <pre className="code-block">{children}</pre>,
          code: ({ className, children, ...props }) => {
            if (className?.includes("language-mermaid")) {
              return (
                <span className="mermaid-placeholder">
                  <Workflow size={15} /> Diagramma Mermaid nel workspace
                </span>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {visible}
      </ReactMarkdown>
    </div>
  );
}
