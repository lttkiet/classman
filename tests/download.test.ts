import assert from "node:assert/strict";
import test from "node:test";
import { attachmentDisposition } from "../src/lib/download.ts";

test("Unicode filenames produce valid response headers and preserve the original name", () => {
  for (const name of ["Bài tập.pdf", "课程.pdf", "lesson 📚.pdf", "teacher's (notes).txt"]) {
    const header = attachmentDisposition(name);
    const response = new Response("document", { headers: { "Content-Disposition": header } });
    assert.equal(response.status, 200);
    assert.match(header, /^[\x20-\x7e]+$/);
    assert.equal(decodeURIComponent(header.split("filename*=UTF-8''")[1]), name);
  }
});

test("filename fallback cannot inject headers or break its quoted value", () => {
  const header = attachmentDisposition('notes"\\\r\n.pdf');
  assert.match(header, /^attachment; filename="notes____\.pdf";/);
  assert.doesNotThrow(() => new Response("", { headers: { "Content-Disposition": header } }));
});
