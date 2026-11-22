# @protocolwealthos/document-gen

> Document model, RFC 4180 CSV generation, and a built-in plain-text renderer for advisor reports.

MIT-0 OR Apache-2.0 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Quick start

```ts
import { PlainTextRenderer, type Document } from "@protocolwealthos/document-gen";

const doc: Document = {
  title: "Q1 Portfolio Review",
  blocks: [
    { type: "heading", level: 1, text: "Summary" },
    { type: "paragraph", text: "Positive quarter." },
    {
      type: "table",
      headers: ["Asset", "Weight"],
      rows: [["AAPL", "20%"], ["MSFT", "15%"]],
    },
  ],
};

const text = new PlainTextRenderer().render(doc);
```

```ts
import { objectsToCsv } from "@protocolwealthos/document-gen";

const csv = objectsToCsv([{ a: 1, b: 2 }, { a: 3, b: 4 }]);
```

## Renderers

This package ships the document model, `objectsToCsv` / `rowsToCsv`, and `PlainTextRenderer`. PDF, PPTX, or DOCX output belongs behind the `DocumentRenderer` interface in your own code, so only the libraries you actually use end up in your bundle.

## License

Licensed under MIT-0 OR Apache-2.0, at your option.
