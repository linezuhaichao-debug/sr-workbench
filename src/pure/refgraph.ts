/**
 * 引用图与影响范围（设计 §6.4.1）
 *
 * ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
 *   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
 * ★ 工单 14 补上第六类边：⑥ 契约关联（§4「配置字段」列 ↔ §6 声明的字段行）。
 * 只算结构可判定的边：显式引用 / 编号同族 / 界面归属 / 验收关联 / 文本关联 / 契约关联。不做语义推断。
 */

import { extractFieldDecls, extractFieldRefs, extractRowFieldRefs } from "./vchecks.ts";

// ── 引用图（设计 §6.4.1）────────────────────────────────────────
//   条目 → 全文提到它的位置。**只算结构可判定的边，不做语义推断**
//   （"改了规则会不会让某条验收失效"仍归 sr-gdd-fix 的 D11 影响面闭合）。
//
//   已覆盖的边（**六类**）：
//     ① 显式引用  UI-M1 / UE3 / R3 / AC8 —— 全文搜编号
//     ② 编号同族  UE3 ↔ UE3a / UE3b（小写字母后缀是"同条的子情形"，不占主号）
//     ③ 界面归属  UI-M1 ↔ 它名下的 UE*；UI-M1 ↔ 5.0 清单里的行
//     ④ 验收关联  AC 里提到该编号
//     ⑤ 文本关联  §7 文本键 ↔ 引用它的位置
//     ⑥ 契约关联  §4 规则组「配置字段」列引用的字段 ↔ §6 声明它的那一行（kind = `contract`，
//                 取数与口径直接复用 `./vchecks.ts` 的 V6 —— 见 buildRefGraph 结尾那一段）
//   ★ ①②③④⑤ 的命中是"全文提到它的位置"，只有②带 `kind: "family"`；⑥ 的命中带 `kind: "contract"`。
const REF_TOKEN_RE = /(UE\d+[a-z]?|AC\d+|R\d+|UI-M\d+|[a-z][a-z0-9_]{3,})/g;

/** ⑥ 契约关联边的命中标记（六类边里唯一新增的 kind；②同族是 `family`，其余五类不带 kind） */
const CONTRACT_KIND = "contract";

/**
 * ⑥ 契约关联的账（`buildRefGraph` 返回的 `contract`）—— 如实报数，错了能一眼看见：
 *   · `refs`      §4 的 `表.字段` 引用条数（= V6 的 refCount）
 *   · `decls`     §6 声明出来的字段行数（= V6 的 declCount）
 *   · `rowRefs`   「整表 + 括号里列举字段」那种形态的条数（只服务本边，V6 不算）
 *   · `edges`     实际连出的边数（两个方向各记一次命中）
 *   · `unmatched` §4 引用了、§6 没声明的字段（真实定稿为空；有值说明有字段漏配）
 */
function emptyContract() {
	return { refs: 0, decls: 0, rowRefs: 0, edges: 0, unmatched: [] };
}

/**
 * `g.blocks` → 按**绝对行号**索引的正文行（行号与编辑器一致；块与块之间不重叠，缺的位留空串）。
 * 契约关联要按行号回查"这一行属于哪个组"与"原文是什么"，而解析结果里只有块起始行号。
 */
function linesFromBlocks(blocks) {
	const out = [];
	for (const b of blocks) {
		const seg = String(b.text == null ? "" : b.text).split(/\r?\n/);
		for (let i = 0; i < seg.length; i++) out[b.line + i - 1] = seg[i];
	}
	for (let i = 0; i < out.length; i++) if (out[i] === undefined) out[i] = "";
	return out;
}

/** 行号 → `{ ref, where }`：所在 level-3 组的引用串（`§4 R6`）与定位串（`§4 R6 奖励`，与①扫描同口径） */
function ownersOf(blocks) {
	const owner = new Map();
	for (const b of blocks) {
		const seg = String(b.text == null ? "" : b.text).split(/\r?\n/);
		const where = (b.level === 2) ? ("§" + b.no + " " + b.title)
			: ("§" + (b.chNo || "?") + " " + (b.id || b.no || "") + " " + b.title);
		const ref = (b.level === 3) ? ("§" + (b.chNo || "?") + " " + (b.id || b.no || "")).trim() : "";
		for (let i = 0; i < seg.length; i++) {
			owner.set(b.line + i, { ref: ref, where: where.trim(), title: b.title || "", no: b.no || "" });
		}
	}
	return owner;
}

function buildRefGraph(g) {
	if (!g || !g.outline) return { byRef: new Map(), vocabSize: 0, edgeCount: 0, contract: emptyContract() };

	// ① 词表：哪些 token 算"可被引用的实体"
	const vocab = new Map();   // token → { kind, ref }
	const add = (tk, kind, ref) => { if (tk && !vocab.has(tk)) vocab.set(tk, { kind: kind, ref: ref }); };
	for (const c of g.outline) {
		for (const r of c.rows) {                       // 章级表格（§7 文本键 / §10 AC）
			if (/^AC\d+$/.test(r.key)) add(r.key, "ac", "§" + c.no + " " + r.key);
			else if (/^[a-z][a-z0-9_]{3,}$/.test(r.key) && c.no === "7") add(r.key, "textkey", "§7 " + r.key);
		}
		for (const gr of c.children) {
			if (gr.id) add(gr.id, "group", "§" + c.no + " " + gr.id);
			for (const r of gr.rows) {
				if (/^(UE\d+[a-z]?|AC\d+)$/.test(r.key)) {
					add(r.key, "row", "§" + c.no + " " + (gr.id || gr.no || "") + " " + r.key);
				}
			}
		}
	}
	if (!vocab.size) return { byRef: new Map(), vocabSize: 0, edgeCount: 0, contract: emptyContract() };

	// ② 扫全文：每行只跑一次正则，命中候选再查词表
	const hits = new Map();    // token → [{line, where, text}]
	for (const b of g.blocks) {
		const where = (b.level === 2) ? ("§" + b.no + " " + b.title)
			: ("§" + (b.chNo || "?") + " " + (b.id || b.no || "") + " " + b.title);
		const lines = String(b.text || "").split(/\r?\n/);
		for (let i = 0; i < lines.length; i++) {
			const txt = lines[i];
			if (!txt) continue;
			REF_TOKEN_RE.lastIndex = 0;
			let m, seen;
			while ((m = REF_TOKEN_RE.exec(txt)) !== null) {
				const tk = m[1];
				if (!vocab.has(tk)) continue;
				seen = seen || {};
				if (seen[tk]) continue;               // 同一行同一 token 只记一次
				seen[tk] = 1;
				if (!hits.has(tk)) hits.set(tk, []);
				hits.get(tk).push({ line: b.line + i, where: where.trim(), text: txt.trim() });
			}
		}
	}

	const byRef = new Map();
	let edges = 0;
	for (const kv of vocab.entries()) {
		const tk = kv[0], meta = kv[1];
		const list = hits.get(tk) || [];
		byRef.set(meta.ref, { token: tk, kind: meta.kind, hits: list });
		edges += list.length;
	}

	// ③ 编号同族边：同组内 UE3 ↔ UE3a / UE3b
	//    （小写字母后缀 = "同条的子情形"，不占主号；改主条必须连带看子条 —— §6.5 的典型例子）
	for (const c of g.outline) {
		for (const gr of c.children) {
			const fam = {};
			for (const r of gr.rows) {
				const m = /^([A-Za-z][A-Za-z\-]*\d+)([a-z])?$/.exec(r.key);
				if (!m) continue;
				if (!fam[m[1]]) fam[m[1]] = [];
				fam[m[1]].push(r);
			}
			for (const k in fam) {
				if (fam[k].length < 2) continue;      // 只处理真有多态的（UE2/UE2a、UE3/UE3a…）
				const grpRef = "§" + c.no + " " + (gr.id || gr.no || "");
				for (const me of fam[k]) {
					const e = byRef.get((grpRef + " " + me.key).trim());
					if (!e) continue;
					for (const other of fam[k]) {
						if (other === me) continue;
						e.hits.push({
							line: other.line, where: (grpRef + " " + other.key).trim(),
							text: other.text || "", kind: "family"
						});
						edges++;
					}
				}
			}
		}
	}
	// ⑥ 契约关联：§4 规则组「配置字段」列 ←→ §6 声明该字段的那一行
	//    与 V6 **同一份取数、不同用途**：V6 判"引用了但没声明"（单向、报问题）；
	//    这里两个方向都连边，因为影响范围问的是"这儿改了会牵动哪儿"。
	const contract = emptyContract();
	const cblocks = Array.isArray(g.blocks) ? g.blocks : [];
	if (cblocks.length) {
		const lines = linesFromBlocks(cblocks);
		const owner = ownersOf(cblocks);
		const decls = extractFieldDecls(lines);
		contract.decls = decls.length;

		// §6 侧的可引用键：`§6 <表名>.<字段>`（表名取 §6 组标题"（"之前那一段）。
		// 同表同名字段不静默合并：依次退化成 `§6 <组号>.<字段>` → `§6 …（L行号）`。
		const byField = new Map();
		const declKey = new Map();
		const used = new Set();
		for (const d of decls) {
			const o = owner.get(d.line) || { title: "", no: "" };
			const table = String(o.title || "").split(/[（(]/)[0].trim() || String(o.no || "?");
			let key = "§6 " + table + "." + d.field;
			if (used.has(key) || byRef.has(key)) key = "§6 " + (o.no || "?") + "." + d.field;
			if (used.has(key) || byRef.has(key)) key = key + "（L" + d.line + "）";
			used.add(key);
			declKey.set(d.line, key);
			byRef.set(key, { token: d.field, kind: "field", field: d.field, table: table, line: d.line, hits: [] });
			const at = byField.get(d.field);
			if (at) at.push(d);
			else byField.set(d.field, [d]);
		}

		// 连一条边：组侧记"§6 的那一行"，§6 侧记"§4 的那一行"；同一行只报一次（kind = contract）
		const link = (groupRef, groupWhere, viaLine, d) => {
			const key = declKey.get(d.line);
			const entry = key ? byRef.get(key) : null;
			if (!entry) return;
			const groupEntry = groupRef ? byRef.get(groupRef) : null;
			if (groupEntry && !groupEntry.hits.some((h) => h.line === d.line)) {
				groupEntry.hits.push({
					line: d.line, where: key, text: d.text,
					kind: CONTRACT_KIND, field: d.field, via: viaLine
				});
				edges++; contract.edges++;
			}
			if (!entry.hits.some((h) => h.line === viaLine)) {
				entry.hits.push({
					line: viaLine, where: groupWhere, text: lines[viaLine - 1] || "",
					kind: CONTRACT_KIND, field: d.field
				});
				edges++; contract.edges++;
			}
		};

		const refs = extractFieldRefs(lines);
		contract.refs = refs.length;
		for (const r of refs) {
			const o = owner.get(r.line) || {};
			const ds = byField.get(r.field) || [];
			if (!ds.length) {
				contract.unmatched.push({ line: r.line, field: r.field, ref: r.ref, form: "table.field" });
				continue;
			}
			for (const d of ds) link(o.ref || "", o.where || "", r.line, d);
		}

		const rowRefs = extractRowFieldRefs(lines);
		contract.rowRefs = rowRefs.length;
		for (const rr of rowRefs) {
			const o = owner.get(rr.line) || {};
			for (const f of rr.fields) {
				const ds = byField.get(f) || [];
				if (!ds.length) {
					contract.unmatched.push({ line: rr.line, field: f, ref: rr.ref, form: "row" });
					continue;
				}
				for (const d of ds) link(o.ref || "", o.where || "", rr.line, d);
			}
		}
	}
	return { byRef: byRef, vocabSize: vocab.size, edgeCount: edges, contract: contract };
}

/** 某个条目的影响范围：它自己的定义处 + 全文提到它的其他地方（去掉自身） */
function impactOf(graph, ref, selfLine) {
	if (!graph || !graph.byRef) return [];
	const e = graph.byRef.get(ref);
	if (!e) return [];
	return e.hits.filter((h) => h.line !== selfLine);
}

export { CONTRACT_KIND, REF_TOKEN_RE, buildRefGraph, impactOf };
