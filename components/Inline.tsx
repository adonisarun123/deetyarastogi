import { Fragment } from "react";
import { parseInline, type InlineNode } from "@/lib/text";

function render(nodes: InlineNode[], key = "n"): React.ReactNode {
  return nodes.map((n, i) => {
    const k = `${key}-${i}`;
    switch (n.t) {
      case "text":
        return <Fragment key={k}>{n.v}</Fragment>;
      case "b":
        return <strong key={k}>{render(n.c, k)}</strong>;
      case "i":
        return <em key={k}>{render(n.c, k)}</em>;
      case "a": {
        const external = /^https?:\/\//i.test(n.href);
        return (
          <a key={k} href={n.href} {...(external ? { rel: "noopener noreferrer nofollow", target: "_blank" } : {})}>
            {render(n.c, k)}
            {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
          </a>
        );
      }
    }
  });
}

/** Renders the safe inline markup (**bold**, *italic*, [link](url)). Line breaks become <br>. */
export function Inline({ text }: { text: string }) {
  const lines = (text ?? "").split(/\n/);
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {render(parseInline(line), `l${i}`)}
        </Fragment>
      ))}
    </>
  );
}
