import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);

type CodeBlockProps = {
  language?: "bash" | "javascript" | "json" | "yaml";
  code: string;
  className?: string;
};

/**
 * Server-rendered syntax-highlighted code block backed by highlight.js.
 * Emits `<pre><code class="hljs">` so the theme stylesheet in globals.css
 * can color tokens without pulling in a runtime client bundle.
 */
export function CodeBlock({ language, code, className }: CodeBlockProps) {
  const highlighted = language
    ? hljs.highlight(code, { language }).value
    : hljs.highlightAuto(code).value;

  return (
    <pre className={className}>
      <code
        className={`hljs${language ? ` language-${language}` : ""}`}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </pre>
  );
}
