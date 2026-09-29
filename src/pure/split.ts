/**
 * 把渲染器支持不稳的两种结构抽出来：围栏代码块 + HTML <img>
 *
 * ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
 *   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
 * 实测定稿的 <img src> 带空格与间隔号、``` 围栏会让 markdown 渲染器崩；抽出来自己渲染。
 */

function splitImgs(text) {
	const s = String(text || "");
	const re = /<img\s+[^>]*?src\s*=\s*["']([^"']+)["'][^>]*?\/?>/gi;
	const parts = [];
	let last = 0, m;
	while ((m = re.exec(s)) !== null) {
		if (m.index > last) parts.push({ t: "md", v: s.slice(last, m.index) });
		const alt = /alt\s*=\s*["']([^"']*)["']/i.exec(m[0]);
		parts.push({ t: "img", v: m[1], alt: alt ? alt[1] : "" });
		last = m.index + m[0].length;
	}
	if (last < s.length) parts.push({ t: "md", v: s.slice(last) });
	return parts.length ? parts : [{ t: "md", v: s }];
}

function splitSpecial(text) {
	const s = String(text || "");
	const parts = [];
	const re = /^[ \t]*(`{3,}|~{3,})[ \t]*([^\n]*)\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm;
	let last = 0, m;
	while ((m = re.exec(s)) !== null) {
		if (m.index > last) parts.push({ t: "md", v: s.slice(last, m.index) });
		parts.push({ t: "code", v: String(m[3]).replace(/\n$/, ""), lang: (m[2] || "").trim() });
		last = m.index + m[0].length;
	}
	if (last < s.length) parts.push({ t: "md", v: s.slice(last) });

	const out = [];
	for (const p of (parts.length ? parts : [{ t: "md", v: s }])) {
		if (p.t !== "md") { out.push(p); continue; }
		for (const q of splitImgs(p.v)) out.push(q);
	}
	return out.length ? out : [{ t: "md", v: s }];
}

export { splitImgs, splitSpecial };
