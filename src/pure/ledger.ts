/**
 * 设计台账派生（设计 §7）
 *
 * ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
 *   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
 * 从已有结构化源实时派生：决策记录 / 校准 jsonl / 交接 JSON。不新增文件。
 */

// ── 设计台账派生（设计 §7）──────────────────────────────────────
//   从**已有的结构化源**派生可读台账 —— 不新增文件、零 skill 改动：
//     · decision_result.calibrations[]     Gate 前迭代的权威汇总（含事后补录）
//     · decision_result.post_gate_fixes[]  定稿门之后的修改
//     · decision_result.diagram_swap       图替换
//     · decision_result.conditions_completed / remaining_items
//     · evidence/calibration_*.jsonl       实时留痕
//   ★ 实测教训：两个源**都不能少** —— decision_联盟悬赏_20260921.json 汇总了
//     round 12–17、19，**唯独漏了 18**；round 18 只在 calibration jsonl 里。
//     只读 decision 就会丢掉那一次"改回"的结论（收口条款并非万无一失）。
//   纯函数：输入已读到的文本，输出台账条目，不碰 IO。
function stageOfGate(gate) {
	const g = String(gate || "");
	if (/设计核|交接门|概念|设计稿迭代/.test(g)) return 1;
	if (/gdd-fix|修订门|定稿修订|定稿门后/i.test(g)) return 3;
	if (/成稿门|定稿门|成稿|定稿/.test(g)) return 2;
	return 2;
}
/** 没有 gate 字段时，用 decision_type 判阶段 */
function stageOfDecision(dt) {
	const t = String(dt || "");
	// ★ 阶段一（头脑风暴）：设计核 / 概念 / 信息类，**外加 sr-analysis 的两道门** ——
	//   `validation`（报告门）与 `scope_gate`（范围门）。实测这两个原来被错归到阶段二，
	//   于是神话宝库、诸神降临的头脑风暴阶段全空。
	if (/concept|prototype|idea|information|validation|scope_gate/.test(t)) return 1;
	return 2;
}
const LEDGER_STAGES = ["阶段一 · 头脑风暴", "阶段二 · 文档生成", "阶段三 · 定稿修订"];

function buildLedger(inputs) {
	const decs = (inputs && inputs.decisions) || [];
	const cals = (inputs && inputs.calibrations) || [];
	const hoffs = (inputs && inputs.handoffs) || [];
	const items = [];
	const notes = [];
	const d8 = (s) => String(s || "").slice(0, 10).replace(/-/g, "");

	// ⓪ 交接 JSON（`analysis\sr-gdd-handoff_*.json`）—— **头脑风暴结论的主要载体**
	//   ★ 2026-09-29 实测漏项：原实现只读 `decisions\`，整个 `analysis\` 没读，
	//     于是 `calibrated_facts`（活动周期 / 出刀配额 / 奖励结构 / 退盟边界…）
	//     这些**已经确认下来的设计口径**一条都没进台账，头脑风暴阶段显得极空。
	for (const h of hoffs) {
		if (!h) continue;
		let j = h.doc || null;
		if (!j && h.text) { try { j = JSON.parse(h.text); } catch (e) { continue; } }
		if (!j) continue;
		const date = d8(j.created_at);
		const ts = String(j.created_at || "");
		const src = h.name + " · 交接";
		const cn = j.chosen_nucleus;
		if (cn && cn.statement) {
			items.push({ stage: 1, date: date, ts: ts, src: src, text: "设计核：" + cn.statement });
		}
		for (const f of (j.calibrated_facts || [])) {
			if (f) items.push({ stage: 1, date: date, ts: ts, src: src, text: String(f) });
		}
		const al = j.assumption_ledger;
		if (al && Array.isArray(al.closed) && al.closed.length) {
			items.push({
				stage: 1, date: date, ts: ts, src: src,
				text: "已确认假设（" + al.closed.length + " 项）：" + al.closed.join(" / ")
			});
		}
	}

	// ① 决策记录
	//   ★ 2026-09-29 用户澄清后的取舍 —— **只记"拍板的设计结论"**：
	//     台账的用途是"让写文档的思考过程可追溯"，**不是"记录所有改动"**。
	//     所以每条决策只取**一行结论**（决策标题 / 设计核组合）+ **用户迭代时的拍板要点**；
	//     而 changes[]（agent 的技术改动清单）、post_gate_fix*（改动汇总）、
	//     conditions_completed / remaining_items / diagram_swap（执行细节）
	//     **一律不进台账** —— 它们属于审计面，去「决策台账」页签看。
	for (const d of decs) {
		if (!d) continue;
		let j = d.doc || null;                    // 面板路径：调用方已 parse
		if (!j && d.text) {                       // 离线/测试路径：原始 JSON 文本
			try { j = JSON.parse(d.text); } catch (e) { notes.push("决策记录解析失败：" + d.name); continue; }
		}
		if (!j) continue;
		const r = (j && j.decision_result) || {};
		const date = d8(j.updated_at || j.created_at);
		const ts = String(j.created_at || j.updated_at || "");
		const stage = r.gate ? stageOfGate(r.gate) : stageOfDecision(j.decision_type);

		// 结论一行：有设计核组合就用它；否则用决策标题（标题本身就是完整一句话）
		const line = r.combination ? ("选定设计核：" + r.combination) : String(j.title || "").trim();
		if (line) items.push({ stage: stage, date: date, ts: ts, src: d.name, text: line });

		// ★ 逐条拍板的选择（`settled_choices`）—— **"人拍板结论"最直接的一种形态**。
		//   2026-09-29 实测漏项：诸神降临的 T1–T7 七条**一条都没进台账**，
		//   而那正是这个功能最关键的设计口径（命名、奖励角色、概率逻辑归属…）。
		const sc = r.settled_choices;
		if (sc && typeof sc === "object") {
			for (const k in sc) {
				let v = sc[k];
				if (v && typeof v === "object") v = v.text || v.note || v.value || "";   // 防 [object Object]
				if (!v) continue;
				items.push({ stage: stage, date: date, ts: ts, src: d.name, text: String(v).trim() });
			}
		}

		// ★ 门的结果（成稿门 / 交接门）—— "什么时候过了哪道门、走向哪"是思考过程的一部分
		for (const gk of ["gdd_draft_gate", "handoff_gate"]) {
			const g = r[gk];
			if (!g || typeof g !== "object") continue;
			const label = (gk === "gdd_draft_gate") ? "成稿门" : "交接门";
			const what = String(g.chosen || g.result || "").trim();
			const to = g.handoff_target ? (" → " + String(g.handoff_target).trim()) : "";
			const why = g.note ? ("（" + String(g.note).trim() + "）") : "";
			if (what || to || why) {
				items.push({ stage: stage, date: date, ts: ts, src: d.name, text: label + "：" + what + to + why });
			}
		}

		// ★ 决策记录自己的 note（交代"为什么这么选"，如"报告门选 accept_diagnosis 后随即 enter_dissection"）
		if (typeof r.note === "string" && r.note.trim()) {
			items.push({ stage: stage, date: date, ts: ts, src: d.name, text: r.note.trim() });
		}

		// ★ 设计核的证伪条件（属设计约束，不是待办）
		if (typeof r.kill_signal === "string" && r.kill_signal.trim()) {
			items.push({ stage: 1, date: date, ts: ts, src: d.name, text: "证伪条件：" + r.kill_signal.trim() });
		}

		// 门内迭代：用户每一次拍板的要点（"思考过程"的主体）
		for (const c of (r.calibrations || [])) {
			if (!c || !c.input) continue;
			items.push({
				stage: stageOfGate(c.gate), date: d8(c.ts), ts: String(c.ts || ""),
				src: d.name + " · 迭代", round: c.round, text: c.input
			});
		}
	}

	// ② 校准 jsonl（补 decision 漏汇总的轮次；同 round 以 decision 汇总为准）
	const seen = new Set(items.filter((i) => i.round !== undefined && i.round !== null).map((i) => String(i.round)));
	let fromJsonl = 0;
	for (const c of cals) {
		let rows = (c && c.rows) || null;         // 面板路径：调用方已 parse
		if (!rows) {                              // 离线/测试路径：jsonl 原文
			rows = [];
			for (const ln of String((c && c.text) || "").split(/\r?\n/)) {
				const s = ln.trim();
				if (!s || s.charAt(0) !== "{") continue;
				try { rows.push(JSON.parse(s)); } catch (e) { /* 跳过坏行 */ }
			}
		}
		for (const o of rows) {
			if (!o || !o.input) continue;
			const rk = String(o.round);
			if (seen.has(rk)) continue;
			seen.add(rk);
			fromJsonl++;
			items.push({
				stage: stageOfGate(o.gate), date: d8(o.ts), ts: String(o.ts || ""),
				src: c.name, round: o.round, text: o.input
			});
		}
	}

	// ③ 组装：阶段 → 日期（阶段内按时间升序）
	const stages = [];
	for (let s = 1; s <= 3; s++) {
		const mine = items.filter((i) => i.stage === s).sort((a, b) => (String(a.ts) < String(b.ts) ? -1 : 1));
		const byDate = new Map();
		for (const it of mine) {
			if (!byDate.has(it.date)) byDate.set(it.date, []);
			byDate.get(it.date).push(it);
		}
		stages.push({
			id: s, name: LEDGER_STAGES[s - 1], count: mine.length,
			days: Array.from(byDate.entries()).map((kv) => ({ date: kv[0], items: kv[1] }))
		});
	}
	return {
		stages: stages, total: items.length, notes: notes,
		stats: { fromDecision: items.length - fromJsonl, fromJsonl: fromJsonl }
	};
}

/**
 * 从 loadLedger 的产物派生设计台账（设计 §7）。
 *
 * ★ 刻意放在**渲染期**算，而不是加载期：
 *   ① 加载期算的话，`ledger` 这坨 state 就把"当时的派生结果"冻住了——
 *      代码热更新后，state 还是旧结构（没有新字段），于是界面上明明有数据却显示"台账为空"；
 *   ② 渲染期算则数据一变就重算，不依赖"加载那一刻的代码版本"。
 *   纯函数、零 IO，代价可忽略。
 */
function ledgerOf(L) {
	if (!L || !L.records) return null;
	if (L.error) {
		return { error: L.error, stages: [], total: 0, notes: [], stats: { fromDecision: 0, fromJsonl: 0 } };
	}
	const calByFile = new Map();
	for (const c of (L.calibration || [])) {
		if (!calByFile.has(c.file)) calByFile.set(c.file, []);
		calByFile.get(c.file).push(c.row);
	}
	return buildLedger({
		decisions: L.records.map((r) => ({ name: r.file, doc: r.doc })),
		calibrations: Array.from(calByFile.entries()).map((kv) => ({ name: kv[0], rows: kv[1] })),
		handoffs: L.handoffs || []
	});
}

export { stageOfGate, stageOfDecision, LEDGER_STAGES, buildLedger, ledgerOf };
