import assert from "node:assert/strict";
import test from "node:test";
import { translate } from "../src/lib/i18n.ts";

test("translates portal terms and interpolates dynamic values", () => {
  assert.equal(translate("vi", "Grades"), "Khối lớp");
  assert.equal(translate("vi", "A good day to make progress, {name}.", { name: "Minh" }), "Một ngày tốt để cùng tiến bộ, Minh.");
  assert.equal(translate("vi", "Open the invitation link from the center administrator to create an account."), "Mở liên kết mời từ quản trị viên trung tâm để tạo tài khoản.");
  assert.equal(translate("vi", "Needs Review"), "Cần xem lại");
  assert.equal(translate("vi", "Document library"), "Thư viện tài liệu");
  assert.equal(translate("vi", "Class · {grade} · {name}", { grade: "Khối 6", name: "6A" }), "Lớp · Khối 6 · 6A");
});

test("keeps English as the default and falls back for unknown translations", () => {
  assert.equal(translate("en", "Grades"), "Grades");
  assert.equal(translate("vi", "Learner-entered content"), "Learner-entered content");
});
