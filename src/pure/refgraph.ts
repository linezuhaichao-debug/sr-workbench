/**
 * 引用图与影响范围（设计 §6.4.1）
 *
 * ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
 *   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
 * 只算结构可判定的边：显式引用 / 编号同族 / 界面归属 / 验收关联 / 文本关联。不做语义推断。
 */

// ── 引用图（设计 §6.4.1）────────────────────────────────────────
//   条目 → 全文提到它的位置。**只算结构可判定的边，不做语义推断**
//   （"改了规则会不会让某条验收失效"仍归 sr-gdd-fix 的 D11 影响面闭合）。
//
//   已覆盖的边（六类里的五类）：
//     ① 显式引用  UI-M1 / UE3 / R3 / AC8 —— 全文搜编号
//     ② 编号同族  UE3 ↔ UE3a / UE3b（小写字母后缀是"同条的子情形"，不占主号）
//     ③ 界面归属  UI-M1 ↔ 它名下的 UE*；UI-M1 ↔ 5.0 清单里的行
//     ④ 验收关联  AC 里提到该编号
//     ⑤ 文本关联  §7 文本键 ↔ 引用它的位置
//   未覆盖：⑥ 契约关联（§4「配置字段」列 ↔ §6 行）—— 需要读表格语义，留下一轮。
const REF_TOKEN_RE = /(UE\d+[a-z]?|AC\d+|R\d+|UI-M\d+|[a-z][a-z0-9_]{3,})/g;

function buildRefGraph(g) {
	if (!g || !g.outline) return { byRef: new Map(), vocabSize: 0, edgeCount: 0 };

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
	if (!vocab.size) return { byRef: new Map(), vocabSize: 0, edgeCount: 0 };

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
	return { byRef: byRef, vocabSize: vocab.size, edgeCount: edges };
}

/** 某个条目的影响范围：它自己的定义处 + 全文提到它的其他地方（去掉自身） */
function impactOf(graph, ref, selfLine) {
	if (!graph || !graph.byRef) return [];
	const e = graph.byRef.get(ref);
	if (!e) return [];
	return e.hits.filter((h) => h.line !== selfLine);
}

export { REF_TOKEN_RE, buildRefGraph, impactOf };
