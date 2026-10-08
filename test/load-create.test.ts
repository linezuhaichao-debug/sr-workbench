/**
 * 新建功能的**加载层**（工单 22）：建前事实 + 建后窄回读 + 看板的身份/桶标注。
 *
 * 口径（spec「Testing Decisions」）：对着**真实文件系统**跑 —— 这里用一个**临时沙箱**
 * 当真工作区（`os.tmpdir()` 下的目录），在它上面真的建目录、真的写 `feature.json`，
 * 再让加载器去读。沙箱用完就删。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadCreateFacts, readBackCreated } from "../src/load/create.ts";
import { loadDashboard } from "../src/load/dashboard.ts";
import { BUCKET_ORDER } from "../src/pure/createfeature.ts";
import { identityJsonText } from "../src/pure/featureid.ts";
import { testPort } from "./paths.ts";

const signal = new AbortController().signal;

/** 一个临时沙箱：`<tmp>/sr-wb-22-*`，里面有一个 features 目录，按需往里放功能目录。 */
function sandbox(t: { after: (fn: () => void) => void }): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sr-wb-22-"));
	t.after(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* 临时目录删不掉不影响断言 */ } });
	fs.mkdirSync(path.join(dir, "features"), { recursive: true });
	return dir;
}

/** 在沙箱里"按指令建出"一个功能（模拟 agent 侧的动作：目录 + 六个桶 + 身份声明） */
function makeFeature(ws: string, topic: string, json: string | null, buckets: string[] = BUCKET_ORDER): string {
	const root = path.join(ws, "features", topic);
	fs.mkdirSync(root, { recursive: true });
	for (const b of buckets) fs.mkdirSync(path.join(root, b), { recursive: true });
	if (json !== null) fs.writeFileSync(path.join(root, "feature.json"), json, "utf8");
	return root;
}

test("建前事实：列出已有目录 + 认出身份（没有 feature.json 的按目录名认，不假装有 id）", async (t) => {
	const ws = sandbox(t);
	makeFeature(ws, "英雄圣物", null);
	makeFeature(ws, "神话宝库", identityJsonText("feat-20260930-002", "诸神降临", "2026-09-30", ["神话宝库"]));

	const facts = await loadCreateFacts(testPort({ roots: [ws] }), { srWs: ws, signal });
	assert.deepEqual(facts.dirNames, ["神话宝库", "英雄圣物"]);
	assert.equal(facts.note, "");
	const hero = facts.features.filter((f) => f.topic === "英雄圣物")[0];
	assert.equal(hero.identity.present, false);
	assert.equal(hero.identity.note, "没有身份声明（按目录名认功能）");
	const myth = facts.features.filter((f) => f.topic === "神话宝库")[0];
	assert.equal(myth.identity.present, true);
	assert.equal(myth.identity.feature_id, "feat-20260930-002");
	assert.deepEqual(myth.identity.aliases, ["神话宝库"]);
});

test("建前事实：锚点为空 = 读不了；工作区根列不出来 = 如实说（**不假装没有冲突**）", async (t) => {
	const ws = sandbox(t);
	const empty = await loadCreateFacts(testPort({ roots: [ws] }), { srWs: "", signal });
	assert.equal(empty.note.length > 0, true);
	assert.deepEqual(empty.dirNames, []);

	// features\ 还没有（全新工作区）⇒ 不算错误，也不是"读不到"
	fs.rmSync(path.join(ws, "features"), { recursive: true, force: true });
	const fresh = await loadCreateFacts(testPort({ roots: [ws] }), { srWs: ws, signal });
	assert.deepEqual(fresh.dirNames, []);
	assert.equal(fresh.note, "", "工作区根列得出来 ⇒ 只是还没有功能");

	// 工作区根也列不出来（沙箱外）⇒ 如实说
	const out = await loadCreateFacts(testPort({ roots: [path.join(ws, "nope")] }), { srWs: ws, signal });
	assert.match(out.note, /读不到 sr 工作区|读不到已有的功能目录/);
});

test("建后窄回读：absent → dir-only → partial → done；id 不是算好的那个 ⇒ identity-mismatch", async (t) => {
	const ws = sandbox(t);
	const port = testPort({ roots: [ws] });
	const root = path.join(ws, "features", "联盟讨伐");
	const id = "feat-20261008-001";
	const json = identityJsonText(id, "联盟讨伐", "2026-10-08");

	assert.equal((await readBackCreated(port, root, id, signal)).state, "absent", "还没建");

	fs.mkdirSync(root, { recursive: true });
	const dirOnly = await readBackCreated(port, root, id, signal);
	assert.equal(dirOnly.state, "dir-only");
	assert.match(dirOnly.progress, /功能目录 ✓/);

	for (const b of ["source", "analysis", "gdd"]) fs.mkdirSync(path.join(root, b), { recursive: true });
	const partial = await readBackCreated(port, root, id, signal);
	assert.equal(partial.state, "partial");
	assert.deepEqual(partial.missing, ["delivery", "decisions", "evidence"]);

	for (const b of ["delivery", "decisions", "evidence"]) fs.mkdirSync(path.join(root, b), { recursive: true });
	fs.writeFileSync(path.join(root, "feature.json"), json, "utf8");
	const done = await readBackCreated(port, root, id, signal);
	assert.equal(done.state, "done");
	assert.equal(done.identity.feature_id, id);
	assert.equal(done.note, "六个桶 + 身份声明都在");

	// 换成别人的 id 写进去 ⇒ 绝不当成建好
	fs.writeFileSync(path.join(root, "feature.json"), identityJsonText("feat-20260101-001", "别的", "2026-01-01"), "utf8");
	const wrong = await readBackCreated(port, root, id, signal);
	assert.equal(wrong.state, "identity-mismatch");
});

test("看板：身份与六个桶的标注（真实加载器，临时沙箱）", async (t) => {
	const ws = sandbox(t);
	makeFeature(ws, "英雄圣物", null);                                        // 老功能：没有身份声明
	makeFeature(ws, "联盟讨伐", identityJsonText("feat-20261008-001", "联盟讨伐", "2026-10-08"));
	makeFeature(ws, "半成品", null, ["source", "analysis"]);                   // 桶只建了两个
	fs.writeFileSync(path.join(ws, "config.local.json"), JSON.stringify({ sr_workspace: ws, config_root: ws }), "utf8");

	const d = await loadDashboard(testPort({ roots: [ws] }), { configPath: path.join(ws, "config.local.json"), signal });
	const by = (t2: string) => d.features.filter((f) => f.topic === t2)[0];
	assert.equal(d.srWs, ws);
	assert.equal(by("英雄圣物").identity.present, false);
	assert.equal(by("英雄圣物").identity.note, "没有身份声明（按目录名认功能）");
	assert.deepEqual(by("英雄圣物").bucketsMissing, [], "沙箱里六个桶都建了");
	assert.equal(by("联盟讨伐").identity.feature_id, "feat-20261008-001");
	assert.deepEqual(by("半成品").bucketsMissing, ["gdd", "delivery", "decisions", "evidence"]);
});
