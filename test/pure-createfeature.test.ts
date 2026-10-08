/**
 * 新建功能（工单 22）的纯函数层：主题名合法性 / 四种冲突 / 指令与脚本 / 回读判定 / 卡片人话。
 *
 * 这些断言就是"一个动作"的规格：面板显示什么、发出去什么、什么算建好了。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DIR_BUCKET } from "../src/pure/buckets.ts";
import {
	BUCKET_ORDER,
	buildCreateInstruction,
	cardStateOf,
	bucketsNote,
	checkTopicName,
	createCancelNotice,
	createDoneNotice,
	createSentNotice,
	createTimeoutNotice,
	featureRootFor,
	planNewFeature,
	scaffoldScript,
	TOPIC_MAX,
	verifyCreated
} from "../src/pure/createfeature.ts";
import { identityJsonText, identityOf } from "../src/pure/featureid.ts";

const SR = "D:\\TimeMachine\\GameDesignOS\\workspace";
const today = { compact: "20261008", created: "2026-10-08" };
const facts = (over) => Object.assign({
	dirNames: ["联盟悬赏", "英雄圣物"],
	features: [
		{ topic: "神话宝库", root: SR + "/features/神话宝库", identity: identityOf(identityJsonText("feat-20260930-002", "诸神降临", "2026-09-30", ["神话宝库"]), "神话宝库") },
		{ topic: "英雄圣物", root: SR + "/features/英雄圣物", identity: identityOf(null, "英雄圣物") }
	],
	wsPaths: ["D:\\TimeMachine\\GameDesignOS\\workspace"],
	srWs: SR
}, today, over || {});

test("六个桶的规范顺序 = 进 / 出 / 留痕，且与 `DIR_BUCKET` 的键集**恰好一致**（防两处漂移）", () => {
	assert.deepEqual(BUCKET_ORDER, ["source", "analysis", "gdd", "delivery", "decisions", "evidence"]);
	assert.deepEqual(BUCKET_ORDER.slice().sort(), Object.keys(DIR_BUCKET).sort());
});

test("主题名合法性：Windows 的真实约束 + 工作台的长度口径", () => {
	assert.equal(checkTopicName("联盟讨伐").ok, true);
	assert.equal(checkTopicName("新建功能验收-20261008").ok, true);
	assert.equal(checkTopicName("A B  C").ok, true, "中间的空格没问题");

	const cases = [
		["", "empty"], ["   ", "empty"],
		[" 联盟讨伐", "padded"], ["联盟讨伐 ", "padded"], ["联盟讨伐.", "padded"],
		["联盟/讨伐", "illegal"], ["a\\b", "illegal"], ["a:b", "illegal"], ["a*b", "illegal"],
		["a?b", "illegal"], ['a"b', "illegal"], ["a<b", "illegal"], ["a>b", "illegal"], ["a|b", "illegal"],
		["con", "reserved"], ["CON", "reserved"], ["NUL.txt", "reserved"], ["com1", "reserved"], ["lpt9", "reserved"],
		[".", "dot"], ["..", "dot"],
		["a\u0000b", "control"],
		["甲".repeat(TOPIC_MAX + 1), "too-long"]
	];
	for (const [topic, code] of cases) {
		const c = checkTopicName(topic);
		assert.equal(c.ok, false, "应拒绝：" + JSON.stringify(topic));
		assert.equal(c.code, code, "码要对上：" + JSON.stringify(topic));
		assert.ok(c.message.length > 0 && c.next.length > 0, "拒绝时必须给「人话 + 下一步」：" + JSON.stringify(topic));
	}
	// 边界：正好 TOPIC_MAX 个字可以
	assert.equal(checkTopicName("甲".repeat(TOPIC_MAX)).ok, true);
	// 控制台设备名只保留"真保留"的那些：com0 / lpt0 不是保留名（Windows 只保留 1-9）
	assert.equal(checkTopicName("com0").ok, true);
});

test("planNewFeature：算得出 root / id / 身份 JSON / 指令（一次算完，显示的 = 发出去的）", () => {
	const p = planNewFeature("联盟讨伐", facts(), SR);
	assert.equal(p.ok, true);
	assert.equal(p.root, SR + "/features/联盟讨伐");
	assert.equal(p.id, "feat-20261008-001", "今天第一个（已有的两个功能都没有身份 ⇒ 不占号）");
	assert.equal(p.created, "2026-10-08");
	assert.deepEqual(JSON.parse(p.json), {
		feature_id: "feat-20261008-001", name: "联盟讨伐", aliases: [], created: "2026-10-08"
	});
	assert.match(p.instruction, /## 新建功能：联盟讨伐/);
	assert.equal(featureRootFor(SR, "联盟讨伐"), p.root);
});

test("四种拒绝：非法字符 / 目录已存在 / 已存在同标识（名字或别名）/ 工作区已登记", () => {
	const bad = planNewFeature("a/b", facts(), SR);
	assert.equal(bad.ok, false);
	assert.equal(bad.code, "illegal");
	assert.equal(bad.instruction, "", "拒绝时**没有指令可发**（= 一个字节都不写）");

	const dup = planNewFeature("英雄圣物", facts(), SR);
	assert.equal(dup.code, "dir-exists");
	assert.match(dup.message, /已经有这个目录/);
	assert.match(dup.next, /换个名字/);

	const nameTaken = planNewFeature("诸神降临", facts(), SR);
	assert.equal(nameTaken.code, "name-taken");
	assert.match(nameTaken.message, /另一个功能/);
	assert.match(nameTaken.message, /神话宝库/, "要说清是哪个目录");

	const aliasTaken = planNewFeature("神话宝库", facts(), SR);
	assert.equal(aliasTaken.code, "name-taken", "**旧名（别名）也算冲突**");

	const wsTaken = planNewFeature("联盟讨伐", facts({ wsPaths: [SR + "\\features\\联盟讨伐\\"] }), SR);
	assert.equal(wsTaken.code, "workspace-taken");
	assert.match(wsTaken.next, /工作区/);

	// 大小写不敏感（Windows 目录名就这样）
	assert.equal(planNewFeature("英雄圣物".toUpperCase(), facts(), SR).code, "dir-exists");

	// 拿不到锚点 ⇒ 不猜路径、直接拒绝
	assert.equal(planNewFeature("联盟讨伐", facts({ srWs: "" }), "").code, "no-anchor");
});

test("id 冲突处理落到 planNewFeature：已有的 id 参与占号", () => {
	const f = facts({
		features: [
			{ topic: "甲", root: SR + "/features/甲", identity: identityOf(identityJsonText("feat-20261008-001", "甲", "2026-10-08"), "甲") },
			{ topic: "乙", root: SR + "/features/乙", identity: identityOf(identityJsonText("feat-20261008-004", "乙", "2026-10-08"), "乙") }
		]
	});
	assert.equal(planNewFeature("丙", f, SR).id, "feat-20261008-005");
});

test("指令：建哪儿 / 六个桶逐个 / 逐字 JSON / 一把做完的脚本 / 规矩都写清", () => {
	const p = planNewFeature("联盟讨伐", facts(), SR);
	const ins = p.instruction;
	for (const b of BUCKET_ORDER) assert.match(ins, new RegExp("^\\s+" + b + "\\\\", "m"), "桶要逐个列：" + b);
	assert.match(ins, /feat-20261008-001/);
	assert.match(ins, /"aliases": \[\]/);
	assert.match(ins, /```powershell/);
	assert.match(ins, /目录已存在/);
	assert.match(ins, /删干净/);
	assert.match(ins, /别动别的功能目录/);
	assert.match(ins, /已建立 联盟讨伐/);
	assert.ok(ins.indexOf(p.root) >= 0);
});

test("脚本：已存在就拒绝（exit 3，什么都不写）；失败就删掉这次建的东西（exit 1）", () => {
	const s = scaffoldScript("D:\\x\\features\\甲", identityJsonText("feat-20261008-001", "甲", "2026-10-08"));
	assert.match(s, /Test-Path -LiteralPath \$root/);
	assert.match(s, /exit 3/);
	// ★ id 唯一性由脚本自己兜一层（两个面板同时建 ⇒ 第二个不许写出重复身份）
	assert.match(s, /\$fid = \(\$json \| ConvertFrom-Json\)\.feature_id/);
	assert.match(s, /REFUSED feature_id 已被占用/);
	assert.match(s, /Join-Path \$_\.FullName 'feature\.json'/);
	assert.match(s, /New-Item -ItemType Directory -Path \(Join-Path \$root \$b\)/);
	assert.match(s, /Set-Content -LiteralPath \(Join-Path \$root 'feature\.json'\) -Value \$json -Encoding utf8NoBOM/);
	assert.match(s, /Remove-Item -LiteralPath \$root -Recurse -Force/);
	assert.match(s, /FAILED-CLEANED/);
	// 反引号/单引号要能安全嵌进 PowerShell 单引号串
	assert.match(scaffoldScript("D:\\x\\it's", "{}"), /\$root = 'D:\\x\\it''s'/);
	// 指令里要写明这两条拒绝语义（agent 照做）
	const ins = buildCreateInstruction({ srWs: "D:\\x", root: "D:\\x\\features\\甲", topic: "甲", id: "feat-20261008-001", created: "2026-10-08", json: identityJsonText("feat-20261008-001", "甲", "2026-10-08") });
	assert.match(ins, /REFUSED feature_id 已被占用/);
});

test("回读判定：absent / dir-only / partial / done / id 对不上（**绝不默认成功**）", () => {
	const json = identityJsonText("feat-20261008-001", "联盟讨伐", "2026-10-08");
	const all = BUCKET_ORDER.concat(["feature.json"]);

	assert.equal(verifyCreated({ entries: null, identityText: null }).state, "absent");
	assert.equal(verifyCreated({ entries: null, identityText: null }).missing.length, 6);

	const dirOnly = verifyCreated({ entries: [], identityText: null });
	assert.equal(dirOnly.state, "dir-only");
	assert.match(dirOnly.progress, /六个桶 0\/6/);

	const partial = verifyCreated({ entries: ["source", "analysis", "gdd", "feature.json"], identityText: json, expectId: "feat-20261008-001" });
	assert.equal(partial.state, "partial");
	assert.deepEqual(partial.missing, ["delivery", "decisions", "evidence"]);
	assert.match(partial.note, /缺 delivery、decisions、evidence 桶/);

	const done = verifyCreated({ entries: all, identityText: json, expectId: "feat-20261008-001" });
	assert.equal(done.state, "done");
	assert.deepEqual(done.missing, []);
	assert.equal(done.identity.feature_id, "feat-20261008-001");

	// 大小写不敏感（Windows）
	assert.equal(verifyCreated({ entries: all.map((n) => n.toUpperCase()), identityText: json, expectId: "feat-20261008-001" }).state, "done");

	// ★ id 不是算好的那一个 ⇒ 不当成建好
	const wrong = verifyCreated({ entries: all, identityText: identityJsonText("feat-20260101-001", "别的", "2026-01-01"), expectId: "feat-20261008-001" });
	assert.equal(wrong.state, "identity-mismatch");
	assert.match(wrong.note, /不是同一份/);

	// 身份文本坏了也算没建完
	assert.equal(verifyCreated({ entries: all, identityText: "{坏了", expectId: "feat-20261008-001" }).state, "partial");
});

test("卡片人话：新建、还没有任何产物要说出来；桶缺了要说缺哪几个", () => {
	const bare = {
		latestFinal: null, status: null, finals: 0, reviews: 0, speeches: 0, decisions: 0,
		evidence: 0, sources: 0, others: 0, files: { concept: [], draft: [] }
	};
	assert.equal(cardStateOf(bare).line, "还没有原料 —— 往 source\\ 放素材，或从「头脑风暴」开始");
	assert.equal(cardStateOf(bare).tone, "new");
	assert.equal(bucketsNote(bare), "", "不传 bucketsMissing 就一个字都不说");
	assert.equal(bucketsNote({ bucketsMissing: ["source", "evidence"] }), "桶没建全：缺 source、evidence —— 让工作会话补齐，或删掉这个目录重建。");

	const withSource = Object.assign({}, bare, { sources: 2, files: { concept: [], draft: [] } });
	assert.equal(cardStateOf(withSource).line, "卡在：尚未出定稿");
	const finished = Object.assign({}, bare, { latestFinal: "x_定稿.md", status: "active", finals: 1 });
	assert.equal(cardStateOf(finished).line, "已定稿 · 可交程序");
});

test("三句话术（发出去 / 建好了 / 还在等 / 不再等）都点明下一步", () => {
	assert.match(createSentNotice("联盟讨伐"), /不用刷新|自己出现/);
	const done = createDoneNotice("联盟讨伐", "feat-20261008-001", SR + "/features/联盟讨伐");
	assert.match(done, /feat-20261008-001/);
	assert.match(done, /删掉这个目录/, "要说清怎么撤（面板不写盘、也删不了盘）");
	const to = createTimeoutNotice("联盟讨伐", { progress: "已看到：功能目录 ✓ ／ 六个桶 3/6" }, "session-1");
	assert.match(to, /打开工作会话/);
	assert.match(to, /六个桶 3\/6/);
	assert.match(createCancelNotice("联盟讨伐", { progress: "已看到：功能目录 —" }), /刷新看板/);
});
