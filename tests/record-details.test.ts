import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import type { ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { moduleLoader } from "./load-module.ts";
import { recordPayload } from "../src/lib/record-form.ts";

const load = moduleLoader({
  "@/components/LanguageProvider": { useLanguage: () => ({ language: "en", t: (text: string) => text }) },
  "@/lib/record-form": { recordPayload },
});
const { RecordDetails, baseConfigs } = load<{
  RecordDetails: ComponentType<{ config: unknown; row: object; lookups: object; onClose: () => void }>;
  baseConfigs: Record<string, unknown>;
}>("src/components/WorkspacePage.tsx", "\nexport { RecordDetails, baseConfigs };");

test("read-only details expose assignment instructions without an edit form", () => {
  const html = renderToStaticMarkup(createElement(RecordDetails, {
    config: baseConfigs.assignments,
    row: { title: "Reading", description: "Read chapter three and explain the ending.", learner: { name: "Student" } },
    lookups: {}, onClose() {},
  }));
  assert.match(html, /Read chapter three and explain the ending\./);
  assert.match(html, /Student/);
  assert.doesNotMatch(html, /<(?:form|input|textarea|select)\b/);
});

test("read-only lesson details expose materials and escape user-supplied content", () => {
  const html = renderToStaticMarkup(createElement(RecordDetails, {
    config: baseConfigs.lessons,
    row: { title: "Reading", materials: "https://example.test/worksheet.pdf", content: "<script>alert(1)</script>" },
    lookups: {}, onClose() {},
  }));
  assert.match(html, /https:\/\/example\.test\/worksheet\.pdf/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});
