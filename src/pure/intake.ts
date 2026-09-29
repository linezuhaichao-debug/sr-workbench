/**
 * 收件箱纯逻辑：素材解析 / 主题派生 / 四种输入方式的指令组装
 *
 * ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
 *   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
 * 这一份原来内联在 client.js 里（因为当时只能有一个文件）；现在它是真模块，legacy 的两份副本与防漂移比对脚本随之删除。
 */

const INTAKE = (function () {
	/** 文档类扩展名（导入时只复制这些，跳过图片/视频等大文件） */
	const DOC_EXT = [
		"md", "markdown", "txt", "json", "jsonc", "yaml", "yml", "csv", "tsv",
		"html", "htm", "xml", "doc", "docx", "xls", "xlsx", "xlsm", "ppt", "pptx", "pdf"
	];
	/** 浏览器能直接读成文本的扩展名（拖进来即可内联，不需要 agent 再读盘） */
	const TEXT_EXT = [
		"md", "markdown", "txt", "json", "jsonc", "yaml", "yml", "csv", "tsv",
		"html", "htm", "xml", "log", "ini", "conf", "css", "js", "svg"
	];
	/** 四种输入方式的元数据（UI 与测试共用一份口径） */
	const INTAKE_KINDS = [
		{ id: "analysis", label: "竞品分析", hint: "跑 sr-analysis", needs: "素材：目录 / 文件路径 / 链接（截图、录屏、PV、商店页）" },
		{ id: "concept", label: "问答式访谈", hint: "跑 sr-concept", needs: "一句话创意（可附参考素材路径）" },
		{ id: "import", label: "旧文档导入", hint: "只登记进收集箱", needs: "旧方案 / 旧文档的目录或文件路径" },
		{ id: "manual", label: "人工补充", hint: "只登记进收集箱", needs: "标题 + 正文（想到什么写什么）" }
	];

	const isWinAbs = (p) => /^[A-Za-z]:[\\/]/.test(p) || /^\\\\/.test(p) || /^[\\/]/.test(p);
	const isHttp = (p) => /^https?:\/\//i.test(p);

	/** 单个素材字符串 → [{ kind, path|text }] */
	function parseMaterial(raw) {
		const s = String(raw == null ? "" : raw).trim();
		if (s === "") return [];
		if (isHttp(s)) return [{ kind: "url", path: s }];
		if (isWinAbs(s)) {
			const bare = s.replace(/[\\/]+$/, "");
			const isDir = /^[A-Za-z]:$/.test(bare) || /^\\\\[^\\]+$/.test(bare) || (!/\.[A-Za-z0-9]{1,8}$/.test(bare));
			return [{ kind: isDir ? "dir" : "file", path: bare }];
		}
		return [{ kind: "text", text: s }];
	}

	/** 文本块 → 素材数组（按行拆：绝对路径/URL 逐行成项，其余并为 text） */
	function parseMaterials(raw) {
		const out = [];
		const pending = [];
		const flush = () => {
			const t = pending.join("\n").trim();
			if (t !== "") out.push({ kind: "text", text: t });
			pending.length = 0;
		};
		for (const line of String(raw == null ? "" : raw).split(/\r?\n/)) {
			const t = line.trim();
			if (t !== "" && (isWinAbs(t) || isHttp(t))) {
				flush();
				for (const it of parseMaterial(t)) out.push(it);
			} else {
				pending.push(line);
			}
		}
		flush();
		return out;
	}

	/** 路径尾段 → 名字（两平台分隔符都认） */
	function baseName(p) {
		const s = String(p == null ? "" : p).replace(/[\\/]+$/, "");
		const parts = s.split(/[\\/]/);
		return parts[parts.length - 1] || s;
	}

	/** 扩展名（小写，无点；没有则空串） */
	function extOf(name) {
		const m = /\.([A-Za-z0-9]{1,8})$/.exec(String(name == null ? "" : name));
		return m ? m[1].toLowerCase() : "";
	}

	/** 是不是文档类（导入时用它决定复制哪些） */
	function isDoc(name) { return DOC_EXT.indexOf(extOf(name)) >= 0; }

	/** 浏览器能否直接读成文本 */
	function isTextExt(name) { return TEXT_EXT.indexOf(extOf(name)) >= 0; }

	/** 从素材派生功能主题（去扩展名、去日期、去尾部噪音） */
	function deriveTopic(materials) {
		const list = materials || [];
		const pick = list.filter((m) => m && (m.kind === "file" || m.kind === "dir"))[0]
			|| list.filter((m) => m && m.kind === "url")[0]
			|| list.filter((m) => m && m.kind === "text")[0];
		if (!pick) return "";
		let n;
		if (pick.kind === "url") {
			n = String(pick.path).replace(/^https?:\/\//i, "").split(/[/?#]/).filter((x) => x !== "")[0] || "";
		} else if (pick.kind === "text") {
			// ★ 文本素材没有 path —— 取 text（此前取 path，导致主题恒为空）
			n = String(pick.text || "").split(/\r?\n/)[0];
		} else {
			n = baseName(pick.path || "");
		}
		if (pick.kind === "dir") return n;
		n = n.replace(/\.[A-Za-z0-9]{1,8}$/, "");
		n = n.replace(/[_\-\s]*\d{8}(?:[_\-\s.]|$)/, " ");
		n = n.replace(/[_\-\s]*(定稿_审查|定稿|审查|宣讲|修订点|UIUE|UI|md版本|人读版|设计稿|初稿|草案)$/, "");
		n = n.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
		return n;
	}

	/** 文件名/标题里的非法字符 → _（写盘用） */
	function safeName(p, limit) {
		const s = String(p == null ? "" : p)
			.replace(/[\\/:*?"<>|]/g, "_")
			.replace(/[\r\n\t]/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		const cap = limit || 60;
		return s.length > cap ? s.slice(0, cap) : s;
	}

	/** 素材清单 → 中文可读列表 */
	function describeMaterials(materials) {
		const list = materials || [];
		if (list.length === 0) return "（无）";
		return list.map((m, i) => {
			const no = i + 1;
			if (m.kind === "dir") return no + ". 目录：" + m.path;
			if (m.kind === "file") return no + ". 文件：" + m.path;
			if (m.kind === "url") return no + ". 链接：" + m.path;
			const one = String(m.text || "").replace(/\s+/g, " ");
			return no + ". 文本：" + (one.length > 300 ? one.slice(0, 300) + "…" : one);
		}).join("\n");
	}

	/** 素材清单里有没有可当"路径素材"的东西 */
	function hasPathMaterial(materials) {
		return (materials || []).some((m) => m && (m.kind === "file" || m.kind === "dir" || m.kind === "url"));
	}

	/** 组装四种输入方式各自发给 agent 的指令 */
	function buildInstruction(kind, input) {
		const inp = input || {};
		const materials = inp.materials || [];
		const topic = String(inp.topic || "").trim() || deriveTopic(materials);
		const note = String(inp.note == null ? "" : inp.note).trim();
		const root = String(inp.srWs || "").replace(/\//g, "\\").replace(/\\+$/, "");
		const inbox = root + "\\inbox";
		const NOT_A_SKILL = "注意：不要改动任何 sr skill；只登记为 inbox / needs_review，不提升为正式资产。";

		if (kind === "analysis") {
			if (!hasPathMaterial(materials)) {
				return { instruction: "", blocked: "「竞品分析」需要一份素材：目录、文件路径或链接（截图、录屏、PV、商店页 / 视频链接）。" };
			}
			const lines = [
				"【输入方式 1 · 竞品分析】请执行 `/sr-analysis`（走 `/sr-analysis <素材路径或链接>` 的正常调用，不要改动该 skill）。",
				"素材：",
				describeMaterials(materials),
				"分析目标：" + (note || "（未指定——按 sr-analysis 第 1 步 VOI 门现场确认）")
			];
			if (topic) lines.push("功能主题（用于产出命名与归档）：" + topic);
			lines.push("按 sr-analysis 的既有流程执行，在它的决策门停下来等我拍板。");
			return { instruction: lines.join("\n"), blocked: "" };
		}

		if (kind === "concept") {
			const seed = note || (materials.filter((m) => m.kind === "text")[0] || {}).text || "";
			if (String(seed).trim() === "") {
				return { instruction: "", blocked: "「问答式访谈」需要一句创意：在输入框里写下你想做的玩法或功能。" };
			}
			const pathMats = materials.filter((m) => m.kind !== "text");
			const lines = [
				"【输入方式 2 · 问答式访谈】请执行 `/sr-concept`（走 `/sr-concept <一句话创意>` 的正常调用，不要改动该 skill）。",
				"创意：" + String(seed).replace(/\s+/g, " ").trim()
			];
			if (pathMats.length > 0) {
				lines.push("已有材料（有就给路径）：");
				lines.push(describeMaterials(pathMats));
			} else {
				lines.push("已有材料：没有。");
			}
			if (topic) lines.push("功能主题（用于产出命名与归档）：" + topic);
			lines.push("定位：本项目（文明之跃）新功能/新玩法。");
			lines.push("按 sr-concept 的既有流程执行，在它的决策门停下来等我拍板。");
			return { instruction: lines.join("\n"), blocked: "" };
		}

		if (kind === "import") {
			const pathMats = materials.filter((m) => m.kind === "file" || m.kind === "dir");
			if (pathMats.length === 0) {
				return { instruction: "", blocked: "「旧文档导入」需要至少一个目录或文件路径（可拖进来，也可直接粘贴）。" };
			}
			const lines = [
				"【输入方式 3 · 旧文档导入】把下列资料作为**参考材料**导入工作区：",
				describeMaterials(pathMats),
				"步骤：",
				"1) 逐条处理：" +
					"目录 → 在 " + inbox + "\\imported\\ 下建一个以该目录名命名的子目录，递归复制其中的文档（只复制文档类文件：" +
					DOC_EXT.join(" / ") + "；跳过图片、视频等大文件；不转换格式、不改内容）；" +
					"文件 → 在 " + inbox + "\\imported\\<文件名（去扩展名）>\\ 下复制这一个文件。",
				"2) 在 " + root + " 下运行 `python scripts/refresh_asset_index.py` 重新生成索引（相对路径以 " + root + " 为基准，不要依赖当前工作目录）。",
				"3) 报告导入了哪些文件、索引新增了几条。"
			];
			if (note) lines.push("补充说明：" + note);
			lines.push(NOT_A_SKILL);
			return { instruction: lines.join("\n"), blocked: "" };
		}

		if (kind === "manual") {
			const title = String(inp.title || "").trim() || topic;
			if (title === "") return { instruction: "", blocked: "「人工补充」需要一个标题。" };
			if (note === "") return { instruction: "", blocked: "「人工补充」需要正文。" };
			const lines = [
				"【输入方式 4 · 人工补充】在 " + inbox + "\\manual\\ 下新建 " + safeName(title) + ".md，内容如下：",
				"---",
				"title: " + title,
				"source: human"
			];
			if (inp.upstream) lines.push("upstream_asset: " + String(inp.upstream));
			lines.push("---", "", note, "");
			lines.push("然后运行 `python scripts/refresh_asset_index.py` 重新生成索引，并报告新增条目。");
			lines.push(NOT_A_SKILL);
			return { instruction: lines.join("\n"), blocked: "" };
		}

		return { instruction: "", blocked: "未知的输入方式：" + String(kind) };
	}

	return {
		INTAKE_KINDS: INTAKE_KINDS,
		parseMaterial: parseMaterial, parseMaterials: parseMaterials,
		baseName: baseName, extOf: extOf, isDoc: isDoc, isTextExt: isTextExt,
		deriveTopic: deriveTopic, safeName: safeName,
		describeMaterials: describeMaterials, hasPathMaterial: hasPathMaterial,
		buildInstruction: buildInstruction
	};
})();

export { INTAKE };
