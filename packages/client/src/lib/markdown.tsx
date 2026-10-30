import { Fragment, type ReactNode } from "react";
import { assetUrl } from "../api";

// Images only from the world's own assets, links only to http(s): nothing in a handout can run script or load from elsewhere.
const INLINE = /!\[([^\]]*)\]\(asset:([0-9a-f-]{36})\)|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = m.index;
    if (m[2]) out.push(<img key={key} src={assetUrl(m[2])} alt={m[1] ?? ""} className="max-w-full rounded-md" />);
    else if (m[4])
      out.push(
        <a key={key} href={m[4]} target="_blank" rel="noopener noreferrer">
          {m[3]}
        </a>,
      );
    else if (m[5]) out.push(<strong key={key}>{m[5]}</strong>);
    else if (m[6]) out.push(<em key={key}>{m[6]}</em>);
    else out.push(<code key={key}>{m[7]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** A small, safe subset of markdown: `#` headings, `-` lists, paragraphs, bold, italic, code, links and world images. */
export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length)
      blocks.push(
        <p key={blocks.length}>
          {paragraph.map((line, i) => (
            <Fragment key={i}>
              {i > 0 && <br />}
              {inline(line)}
            </Fragment>
          ))}
        </p>,
      );
    if (list.length)
      blocks.push(
        <ul key={blocks.length}>
          {list.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>,
      );
    paragraph = [];
    list = [];
  };
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    if (!line.trim()) flush();
    else if (heading) {
      flush();
      // Handouts sit under the panel's own h3, so their headings start one level lower.
      const Tag = (["h4", "h5", "h6"] as const)[heading[1]!.length - 1]!;
      blocks.push(<Tag key={blocks.length}>{inline(heading[2]!)}</Tag>);
    } else if (item) {
      if (paragraph.length) flush();
      list.push(item[1]!);
    } else {
      if (list.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return <div className="markdown">{blocks}</div>;
}
