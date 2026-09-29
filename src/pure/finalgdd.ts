/**
 * 定稿解析与定稿有效性校验（设计 §6.1 / §6.2 / §8 V1）
 *
 * ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
 *   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
 * frontmatter 标量 · checkFinals（多份 active / 旧稿未归档 / 无 active）· parseFinalGdd（章/组/条目 + 1-based 行号）。
 *
 * ★ 修复（工单 03 收尾）：`checkFinals` 排序用的 `dateOf` 漏了 import —— 在 client.js 里它是同层自由变量，
 *   搬成模块后就成了自由变量，调用即 `ReferenceError: dateOf is not defined`。
 *   这正是 ADR 0001 删掉 `check-sandbox.js` 后必须补回的那张网（见 eslint.config.js 在 pure/ 上开的 no-undef）。
 */

import { dateOf } from "./topic.ts";

/** 解析 md 顶部 frontmatter 的简单标量字段 */
function parseFrontmatter(text) {
	const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text || "");
	if (!m) return null;
	const out = {};
	for (const line of m[1].split(/\r?\n/)) {
		const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
		if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
	}
	return out;
}

// ── 定稿有效性校验（设计 §6.1 / §8 V1）──────────────────────────
//   纯函数，不碰 IO —— 便于离线测试（见 test-finalcheck.js）
//   规则：① 组内按文件名日期倒序
//         ② "当前有效" = 日期最新的 active；没有 active 时退回按日期取最新
//         ③ active 份数 > 1 → 告警
//   ★ 口径声明：文件的取代关系是**派生结论**，不是文件声明——
//     定稿 frontmatter 只有 doc_type + status 两个字段，没有任何 superseded 标记。
function checkFinals(finals) {
	const list = (Array.isArray(finals) ? finals : []).slice().sort((a, b) => (dateOf(a.name) < dateOf(b.name) ? 1 : -1));
	const st = (f) => String((f && f.status) || "").trim().toLowerCase();
	const actives = list.filter((f) => st(f) === "active").map((f) => f.name);
	const pending = list.filter((f) => st(f) === "pending").map((f) => f.name);
	const issues = [];
	if (actives.length > 1) {
		issues.push({
			code: "V1", level: "error", files: actives,
			msg: "同时有 " + actives.length + " 份 active 定稿——文件自身没有 archived 标记，取代关系是派生的"
		});
	} else if (list.length > 1 && actives.length === 1) {
		// 只有一份 active，但要确认其余份**真的**标了 archived，而不是"没标"
		const others = list.filter((f) => f.name !== actives[0] && st(f) !== "archived");
		if (others.length) {
			issues.push({
				code: "V1c", level: "warn", files: others.map((f) => f.name),
				msg: others.length + " 份旧定稿未标 archived（当前按日期视为历史版本）"
			});
		}
	}
	if (list.length && !actives.length && !pending.length) {
		issues.push({
			code: "V1b", level: "warn", files: list.map((f) => f.name),
			msg: "没有 active 定稿——provisional / blocked / 或缺头部字段"
		});
	}
	return {
		current: actives.length ? actives[0] : (list[0] ? list[0].name : null),
		currentFrom: actives.length ? "active" : "date",   // 判定依据，如实标注
		actives: actives,
		pending: pending,
		issues: issues,
		all: list
	};
}

// ── 定稿结构解析（设计 §6.2 大纲树 / §6.3 条目引用的基础）──────────
//   纯函数。产出：章 → 组 → 条目行，**每个都带 1-based 行号**（与编辑器一致），
//   行号是"定位"与"就地改这条"的锚点。
//   骨架依据实测定稿：`## N. 章` / `### R{n} 组名` / `### 5.x UI-M{n} 名称` /
//   `### 6.x 表名`，组内条目是两~三列表格的第一列。
function parseFinalGdd(text) {
	const src = String(text || "");
	const lines = src.split(/\r?\n/);
	const meta = parseFrontmatter(src) || {};
	let title = "", fence = false, cur = null;
	const blocks = [];      // ★ 平铺块：每块 = 一个标题 + 它名下的原文（渲染用）
	const outline = [];     // 大纲树：章 → 组（引用 blocks 的下标）

	const start = (level, no, id, t, ln) => {
		const b = { level: level, no: no, id: id, title: t, line: ln, text: [], rows: [] };
		blocks.push(b);
		cur = b;
		if (level === 2) {
			outline.push({ no: no, title: t, line: ln, idx: blocks.length - 1, rows: b.rows, children: [] });
		} else if (outline.length) {
			const parent = outline[outline.length - 1];
			b.chNo = parent.no;     // ★ level-3 块记住自己属于哪一章（错误边界的 label 要用）
			parent.children.push(
				{ no: no, id: id, title: t, line: ln, idx: blocks.length - 1, rows: b.rows });
		}
		return b;
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const ln = i + 1;

		if (/^\s*(```|~~~)/.test(line)) { fence = !fence; if (cur) cur.text.push(line); continue; }
		if (fence) { if (cur) cur.text.push(line); continue; }

		if (!blocks.length && !cur) {
			const mt = /^#\s+(.+?)\s*$/.exec(line);
			if (mt) { title = mt[1]; continue; }
		}

		const m2 = /^##\s+(\d+)[.、]?\s*(.*)$/.exec(line);
		if (m2) { start(2, m2[1], "", (m2[2] || "").trim(), ln).text.push(line); continue; }

		const m3 = /^###\s+(.+?)\s*$/.exec(line);
		if (m3) {
			const raw = m3[1];
			let no = "", id = "", t = raw;
			const a = /^(R\d+)\s+(.+)$/.exec(raw);                  // §4：R1 活动周期与开启
			const b2 = /^(\d+\.\d+)\s+(UI-M\d+)\s*(.*)$/.exec(raw);  // §5：5.1 UI-M1 联盟悬赏主面板
			const c2 = /^(\d+\.\d+)\s+(.+)$/.exec(raw);             // §6：6.2 BOSS表（…）
			if (a) { id = a[1]; t = a[2]; }
			else if (b2) { no = b2[1]; id = b2[2]; t = (b2[3] || b2[2]).trim(); }
			else if (c2) { no = c2[1]; t = c2[2]; }
			start(3, no, id, t, ln).text.push(line);
			continue;
		}

		if (!cur) continue;    // 第一个章标题之前的内容（引言/用途块）不进块

		// 表格行 → 条目（第一列作 key；表头靠在分隔行出现时回剔）
		if (/^\s*\|.*\|\s*$/.test(line)) {
			const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((s) => s.trim());
			const first = cells[0] || "";
			const isSep = /^:?-{2,}:?$/.test(first.replace(/\s/g, ""));
			if (isSep) {
				const last = cur.rows[cur.rows.length - 1];
				if (last && last.line === ln - 1) cur.rows.pop();      // 剔表头
			} else if (first) {
				cur.rows.push({ key: first, line: ln, cells: cells.length, text: line.trim() });
			}
		}
		cur.text.push(line);
	}

	for (const b of blocks) b.text = b.text.join("\n").replace(/^\s+|\s+$/g, "");

	let groups = 0, rows = 0;
	for (const b of blocks) {
		rows += b.rows.length;
		if (b.level === 3) groups++;
	}
	return {
		meta: meta, title: title, blocks: blocks, outline: outline,
		stats: { chapters: outline.length, groups: groups, rows: rows }
	};
}

export { parseFrontmatter, checkFinals, parseFinalGdd };
