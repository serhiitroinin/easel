import { Fragment, type ReactNode } from "react";

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).filter((part) => part !== "").map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** Enough Markdown for chat prose. Anything richer belongs on the canvas. */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.split("\n");
  let paragraph: string[] = [];
  let list: string[] = [];
  let fence: string[] | null = null;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push(<p key={blocks.length}>{inline(paragraph.join(" "))}</p>);
      paragraph = [];
    }
    if (list.length > 0) {
      blocks.push(
        <ul key={blocks.length}>
          {list.map((item, index) => <li key={index}>{inline(item)}</li>)}
        </ul>,
      );
      list = [];
    }
  };

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      if (fence) {
        blocks.push(<pre key={blocks.length}><code>{fence.join("\n")}</code></pre>);
        fence = null;
      } else {
        flush();
        fence = [];
      }
      continue;
    }
    if (fence) {
      fence.push(line);
      continue;
    }
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (item?.[1] !== undefined) {
      if (paragraph.length > 0) flush();
      list.push(item[1]);
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (list.length > 0) flush();
    paragraph.push(line.trim());
  }
  if (fence) blocks.push(<pre key={blocks.length}><code>{fence.join("\n")}</code></pre>);
  flush();

  return <div className="prose">{blocks}</div>;
}
