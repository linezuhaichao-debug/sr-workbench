/**
 * 定稿 §5 界面章解析（界面图数据源）
 *
 * ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
 *   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
 * §5.0 表格 + 边界声明 + 每个 UI-M* 小节的图片引用与 UE 条数；不解析 §5.5/5.6。
 */

function parseInterfaceSection(text) {
	const all = String(text || "").split(/\r?\n/);
	// 定位 "## 5." 到下一个 "## " 之间（### 不会被 /^##\s/ 命中）
	let s = -1, e = all.length;
	for (let i = 0; i < all.length; i++) {
		if (s < 0 && /^##\s*5[.、\s]/.test(all[i])) { s = i; continue; }
		if (s >= 0 && /^##\s/.test(all[i])) { e = i; break; }
	}
	if (s < 0) return null;
	const sec = all.slice(s, e);

	// ① §5.0 表格 + 边界声明
	const uiRows = [];
	let boundary = "";
	let on = false;
	for (let i = 0; i < sec.length; i++) {
		const t = sec[i].trim();
		if (/^###\s*5\.0/.test(t)) { on = true; continue; }
		if (!on) continue;
		if (/^###\s/.test(t)) break;
		if (t.startsWith("|")) {
			const cells = t.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
			const isSep = cells.every((c) => /^:?-{2,}:?$/.test(c));
			if (cells.length >= 4 && !isSep && cells[0] !== "界面ID") {
				uiRows.push({ id: cells[0], name: cells[1], enter: cells[2], exit: cells[3] });
			}
		} else if (uiRows.length && t && !boundary) {
			boundary = t.replace(/^边界声明\s*[:：]\s*/, "");
		}
	}

	// ② 各 UI 小节：图片引用 + UE 规则条数
	const uis = [];
	for (let i = 0; i < sec.length; i++) {
		const m = /^###\s*5\.\d+\s+(UI-\S+)\s*(.*)$/.exec(sec[i].trim());
		if (!m) continue;
		let end = sec.length;
		for (let j = i + 1; j < sec.length; j++) { if (/^###\s/.test(sec[j].trim())) { end = j; break; } }
		const body = sec.slice(i + 1, end);
		const images = [];
		let ueCount = 0;
		for (const l of body) {
			const im = /<img[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(l);
			if (im) images.push(im[1]);
			if (/^\|\s*UE\d+/i.test(l.trim())) ueCount += 1;
		}
		uis.push({ id: m[1], title: m[2].trim(), images: images, ueCount: ueCount });
	}
	return { uiRows: uiRows, boundary: boundary, uis: uis, found: true };
}

export { parseInterfaceSection };
