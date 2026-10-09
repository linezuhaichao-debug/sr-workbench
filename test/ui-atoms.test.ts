/**
 * `src/ui/atoms.js`：官方组件库的取用判据。
 *
 * ★ 这一份是**回归钉子**：5.1.0 的判据只认 `typeof === "function"`，而官方的 `Button`
 *   是 `forwardRef(...)`、`MarkdownText` 是 `memo(...)` —— 都是**对象**。
 *   结果真机上 require 成功了却被判成"没拿到"，整片退回自绘（底部那行还写"未知原因"）。
 *   形状判据必须按 React 的真实形状写，所以这里把四种形状都钉住。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HAS_PRIMITIVES, PRIMITIVES, PRIMITIVES_WHY, isComponent, primitivesNote } from "../src/ui/atoms.js";

test("形状判据：函数、forwardRef 对象、memo 对象都算组件；其它一律不算", () => {
	// ① 普通函数组件（官方的 Tag 就是）
	assert.equal(isComponent(function Tag() {}), true);
	assert.equal(isComponent(() => {}), true);
	// ② forwardRef 的产物（官方的 Button）—— 对象，带 $$typeof
	assert.equal(isComponent({ $$typeof: Symbol.for("react.forward_ref"), render: () => {} }), true);
	// ③ memo 的产物（官方的 MarkdownText）
	assert.equal(isComponent({ $$typeof: Symbol.for("react.memo"), type: () => {}, compare: null }), true);
	// ④ 不算的：随便一个对象、null、字符串、数字、布尔
	assert.equal(isComponent({}), false, "没有 $$typeof 的裸对象不是组件");
	assert.equal(isComponent({ render: () => {} }), false, "只有 render 也不算（缺 $$typeof）");
	assert.equal(isComponent(null), false);
	assert.equal(isComponent(undefined), false);
	assert.equal(isComponent("Button"), false);
	assert.equal(isComponent(42), false);
	assert.equal(isComponent(true), false);
});

test("Node 里没有 ModuleLoader 外壳 ⇒ 一个都拿不到，且**原因说得清**（不是「未知原因」）", () => {
	// Node ESM 里没有 require，所以这条路必然走"环境里没有 require"那一支
	assert.equal(PRIMITIVES, null);
	assert.equal(HAS_PRIMITIVES, false);
	assert.ok(PRIMITIVES_WHY.length > 0, "拿不到必须给得出原因：" + JSON.stringify(PRIMITIVES_WHY));
	assert.ok(PRIMITIVES_WHY.includes("require"), PRIMITIVES_WHY);
	const note = primitivesNote();
	assert.ok(note.includes("自绘"), note);
	assert.ok(note.includes(PRIMITIVES_WHY), "说明里要带上原因：" + note);
	assert.equal(note.includes("未知原因"), false, "不该出现「未知原因」—— 那是判据写坏了的症状");
});
