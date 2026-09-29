window.__ModuleLoader__.load({
	id: "dsh-client-ui-sr-workbench",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const h = React.createElement;

		/**
		 * DSH 的静态 UI 库（`@deepseek-ai/dsh-client-ui-primitives`）在外壳播种的**冻结模块表**里，
		 * 可以直接 require —— 不需要改 package.json、不需要重启。
		 * ★ 但取不到时**不能让插件挂掉**：整块降级成 <pre> 纯文本渲染。
		 */
		let primitives = null;
		try { primitives = require("@deepseek-ai/dsh-client-ui-primitives"); }
		catch (e) { primitives = null; }

		/**
		 * 「收件箱」的纯逻辑（素材解析 / 主题派生 / 四种方式的指令组装）—— **内联版**。
		 *
		 * ★ 为什么内联而不是 import：实测 `/plugins/<pkg>/intake-parse.js` 返回 **404**，
		 *   插件运行期只服务 `<pkg>/client.js` 这一个入口（`__ModuleLoader__` 也只有 load({id,factory})，
		 *   没有"再注册一个模块"的口子）。所以跨文件复用在这个加载器下不成立。
		 *
		 * ★ 防漂移：`lib/intake-parse.js` 是同一份逻辑的 ESM 源（可被 node 直接跑回归 test-intake.mjs）。
		 *   两份的**函数体指纹**由 `sync-intake.js` 比对，不一致就报错 —— 改一份忘改另一份会在自查里暴露。
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

		/** 兼容旧命名：下面的组件与 handler 原本读 contract.*，统一指向内联实现 */
		const contract = INTAKE;
		const contractErr = "";

		/** 二进制 → base64（分块，避免 String.fromCharCode.apply 在大文件上爆栈） */
		function bytesToBase64(bytes) {
			const CH = 0x8000;
			let s = "";
			for (let i = 0; i < bytes.length; i += CH) {
				const chunk = bytes.subarray(i, i + CH);
				s += String.fromCharCode.apply(null, chunk);
			}
			return btoa(s);
		}

		/** 读文件字节（upload 通道要 base64 字符串；这一条只用于"大小未知的二进制"） */
		function readFileBytes(file, cap) {
			return new Promise((resolve, reject) => {
				const fr = new FileReader();
				fr.onerror = () => reject(new Error("读取文件失败"));
				fr.onload = () => {
					const buf = fr.result;
					if (cap && buf.byteLength > cap) { reject(new Error("文件超过 " + Math.round(cap / 1024) + " KB 上限")); return; }
					resolve(new Uint8Array(buf));
				};
				fr.readAsArrayBuffer(file);
			});
		}

		/** 读文件文本（浏览器能读就内联，省掉 agent 再读一次盘） */
		function readFileText(file, cap) {
			return new Promise((resolve, reject) => {
				const fr = new FileReader();
				fr.onerror = () => reject(new Error("读取文件失败"));
				fr.onload = () => resolve(String(fr.result || "").slice(0, cap || 200000));
				fr.readAsText(file);
			});
		}

		/** 面板 id：main keyed slot 与 sidebar.panellist 用同一个 id 关联 */
		const PANEL_ID = "sr-workbench";
		/** sr 工作区与配置表目录，相对会话 workspace 根 */
		const SR_WS = "GameDesignOS/workspace";
		const CONFIG_DIR = "planner/策划配置";

		// ════════════════════════════════════════════════════════════════
		// 一、文件名 → 功能主题（去重是这段的核心）
		// ════════════════════════════════════════════════════════════════

		const PREFIXES = [
			"sr-gdd-handoff_", "concept-triage_", "feature-concept_", "experience-report_",
			"issue-cards_", "replication-spec_", "evidence-index_", "calibration_",
			"smoke_", "readback_", "decision_", "write_CS-"
		];
		/** 尾部噪音后缀（成对剥，直到剥不动） */
		const TAIL = /[_\-\s]*(定稿_审查|定稿|审查|宣讲|修订点|UIUE|UI|md版本|人读版|设计稿)$/;

		/**
		 * 从文件名派生功能主题。目标：同一功能的不同阶段/版本**收敛到同一个键**。
		 * `联盟悬赏_20260921_定稿.md` / `联盟悬赏（联盟boss）.txt` / `联盟悬赏-md版本.rar` → 联盟悬赏
		 * `readback_A079_神话宝库_20260916.md` / `smoke_英雄圣物_20260923.png` → 神话宝库 / 英雄圣物
		 */
		function topicOf(name) {
			// ① 去全部扩展名（.content.json 这类多段也要去干净）
			let s = String(name).replace(/(\.[A-Za-z0-9]+)+$/, "");
			// ② 去已知前缀
			for (const p of PREFIXES) { if (s.startsWith(p)) { s = s.slice(p.length); break; } }
			// ③ 去表号前缀 A079_ / B008-
			s = s.replace(/^[AB]\d{3}[_\-]/, "");
			// ④ 截到第一个日期之前
			const d = s.search(/[_\-\s]\d{8}(?:[_\-\s.]|$)/);
			if (d > 0) s = s.slice(0, d);
			// ⑤ 去括号补充（（联盟boss）这类）
			s = s.replace(/[（(][^）)]*[）)]/g, "");
			// ⑥ 循环剥尾部噪音后缀
			let prev;
			do { prev = s; s = s.replace(TAIL, ""); } while (s !== prev);
			return s.replace(/[_\-\s]+$/, "").trim();
		}

		/** 明显的噪音主题（脚本名、编号、过短）——不当作功能 */
		function isNoise(t) {
			if (!t || t.length <= 1) return true;
			if (/^\d/.test(t)) return true;
			if (/^(CS|DEC|EVD|ASM|EXP|GATE|WRUN|LRN|VOI|ISSUE)[-_]/i.test(t)) return true;
			if (/^[A-Za-z]{1,2}$/.test(t)) return true;
			return false;
		}

		/** 文件名里的日期 YYYYMMDD（没有则空串） */
		function dateOf(name) {
			const m = /(\d{8})/.exec(String(name));
			return m ? m[1] : "";
		}

		// ── 产物分类（设计 §3.2：**功能 = 目录**）──────────────────────────
		//   产物落在 `features\<主题>\` 的**子目录**里，所以分类就是"看子目录"——零猜测。
		//   `artifactBucket()` 是给 `gdd\` 内部用的：那一个子目录里混着成稿/定稿/审查/宣讲 HTML，
		//   得按文件名再分一次。
		//   ★ 这一层存在的意义：**别再往兼容层加东西**。
		//     新结构 `features\<主题>\`：按**子目录**分类，零猜测（目录本身就是答案）；
		//     旧结构（平铺的 proposals/analysis/decisions/evidence）：按**文件名前缀**分类 +
		//     `topicOf` 派生主题 —— 这是**兼容层，只减不增**。
		//   两种结构经这里产出**同一组桶**，下游（阶段条 / 产物页签 / 计数）不用分叉。
		//
		//   ⚠️ 2026-09-29 实测缺口：原实现只认 `concept-triage_ / feature-concept_ / sr-gdd-handoff_`
		//      三个前缀，于是 sr-analysis 的**体验报告 / 问题卡 / 复刻规格被静默丢弃**，
		//      `evidence\` 目录更是整个没扫 —— 竞品分析只剩"交接 JSON"能被看见。
		//   ★ `source\` —— **所有发给 agent 的源文件**（2026-09-29 你定义）：
		//      分析用的截图 / 录屏 / PV、旧文档原件、外部交付包（UE 交互交付物）…
		//      它是**输入**；`evidence\` 是分析**产出**的证据（抽帧 / 索引 / 时间戳账本 / readback）——
		//      两者是"喂进去的原料"与"做出来的证据"，不能混。
		//   ✗ `assets\` 不要：线框图跟着定稿走（`gdd\UI\`），没有独立的素材目录需求。
		const DIR_BUCKET = {
			analysis: "analysis", gdd: "gdd", decisions: "decisions",
			evidence: "evidence", source: "source", delivery: "delivery"
		};
		/** 桶 → byTopic 里的数组字段名（没有字段的进 others） */
		const BUCKET_FIELD = {
			final: "finals", review: "reviews", speech: "speeches",
			// ★ analysis 桶落到 `concept` 字段：**沿用旧字段名**，免得阶段条 / 产物页签 / PipelinePanel
			//   跟着改一遍。含义已从"3 种概念产物"扩为**全部头脑风暴产物**（6 种 analysis 产出）。
			analysis: "concept",
			evidence: "evidence", decisions: "decisions", source: "source",
			draft: "drafts", gdd: "drafts"
		};
		/** 旧结构：文件名前缀 → 桶。sr-* 各 skill 的产出全在这里 */
		const PREFIX_BUCKET = [
			["concept-triage_", "analysis"], ["feature-concept_", "analysis"],
			["experience-report_", "analysis"], ["issue-cards_", "analysis"],
			["replication-spec_", "analysis"], ["sr-gdd-handoff_", "analysis"],
			["evidence-index_", "evidence"], ["calibration_", "evidence"],
			["readback_", "evidence"], ["decision_", "decisions"],
			["smoke_", "others"], ["write_CS-", "others"]
		];
		/** 文件名 → 产物桶。**旧结构用**；新结构的 gdd\ 子目录里也要再细分，所以也会用到 */
		function artifactBucket(name) {
			const n = String(name || "");
			if (!n) return "others";
			if (/_定稿\.md$/i.test(n)) return "final";
			if (/_定稿_审查\.md$/i.test(n) || /_审查\.md$/i.test(n)) return "review";
			if (/_宣讲_.*\.html$/i.test(n)) return "speech";
			if (/_宣讲_.*\.content\.json$/i.test(n)) return "speechSrc";   // 派生件，不单独显示
			if (/_修订点\.md$/i.test(n)) return "gdd";
			for (const pk of PREFIX_BUCKET) if (n.indexOf(pk[0]) === 0) return pk[1];
			if (/\.md$/i.test(n)) return "draft";
			return "others";
		}

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
			// Array.isArray 而非 || ：让 check-sandbox 的探测调用能真正执行进来（提升扫描覆盖率）
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

		function errText(r, fallback) {
			if (!r) return fallback;
			const e = r.error;
			return e ? (e.message || e.code || fallback) : fallback;
		}

		// ════════════════════════════════════════════════════════════════
		// 二、数据加载
		// ════════════════════════════════════════════════════════════════

		/**
		 * 从 sr 本地配置读**绝对路径锚点**。
		 * ★ 不能硬编码相对路径让面板跟着"当前会话的工作区"走——你切到别的工作区的会话时就会读不到。
		 *   `read` 允许读工作区外路径（只有目录列举受限），所以这一步任何会话都能做。
		 */
		async function loadSrPaths(read, sid, configPath, signal) {
			const cands = [];
			if (configPath) cands.push(configPath);
			cands.push(".agents/skills/sr-askme/config.local.json");
			for (const p of cands) {
				const text = await readAllText(read, sid, p, signal, 200);
				if (!text) continue;
				try {
					const cfg = JSON.parse(text);
					if (cfg && cfg.sr_workspace) {
						return {
							srWs: String(cfg.sr_workspace).replace(/[\\/]+$/, ""),
							configRoot: String(cfg.config_root || "").replace(/[\\/]+$/, ""),
							// 从配置路径反推 skills 根（形状：<X>/.agents/skills || <X>/.agents/skills/sr-askme/config.local.json）
							skillsRoot: p.replace(/[\\/]sr-askme[\\/]config\.local\.json$/i, ""),
							configFile: p
						};
					}
				} catch (e) { /* 换下一个候选 */ }
			}
			return { srWs: "", configRoot: "", configFile: "(未找到 sr 配置)" };
		}

		/** 从各种目录列举返回值里取出文件名 */
		function fileNamesOf(v) {
			const e = (v && (v.entries || v.children || v.items)) || [];
			return e
				.filter((x) => {
					const k = x && (x.type || x.kind);
					return k === "file" || k === undefined;
				})
				.map((x) => x.name)
				.filter((n) => typeof n === "string" && n.length > 0);
		}

		/** 只取**子目录**名（fileNamesOf 只取文件，两者互补） */
		function dirNamesOf(v) {
			const e = (v && (v.entries || v.children || v.items)) || [];
			return e
				.filter((x) => x && (x.type === "directory" || x.kind === "directory"))
				.map((x) => x.name)
				.filter((n) => typeof n === "string" && n.length > 0);
		}

		/** 列子目录：与 listDir 同两条通道，但取目录 */
		async function listDirs(ctx, sid, absPath, signal, optional) {
			const ns = (ctx && ctx.remote) || {};
			if (ns.workspaceFiles && typeof ns.workspaceFiles.list === "function") {
				try {
					const r = await ns.workspaceFiles.list(sid, absPath, signal);
					if (r && r.ok === true) return dirNamesOf(r.value);
				} catch (e) { /* 落到通道② */ }
			}
			if (ns.workspace && typeof ns.workspace.list === "function") {
				try {
					const r = await ns.workspace.list(absPath, signal);
					if (r && r.ok === true) return dirNamesOf(r.value);
				} catch (e) { /* 继续 */ }
			}
			if (optional) return [];
			throw new Error("无法列举目录：" + absPath);
		}

		/**
		 * 目录列举：两条通道都试。
		 *   ① workspaceFiles.list(sessionId, path) —— 会话端口，**仅当该目录在会话工作区内**才可列
		 *   ② workspace.list(path) —— 工作区无关端口（若部署提供）
		 */
		async function listDir(ctx, sid, absPath, signal, optional) {
			const ns = (ctx && ctx.remote) || {};
			if (ns.workspaceFiles && typeof ns.workspaceFiles.list === "function") {
				try {
					const r = await ns.workspaceFiles.list(sid, absPath, signal);
					if (r && r.ok === true) return fileNamesOf(r.value);
				} catch (e) { /* 落到通道② */ }
			}
			if (ns.workspace && typeof ns.workspace.list === "function") {
				try {
					const r = await ns.workspace.list(absPath, signal);
					if (r && r.ok === true) return fileNamesOf(r.value);
				} catch (e) { /* 继续 */ }
			}
			if (optional) return [];
			throw new Error("无法列举目录：" + absPath);
		}

		async function readHead(read, sid, path, signal) {
			try {
				const r = await read(sid, path, { offset: 1, limit: 14 }, signal);
				if (!r || r.ok !== true) return null;
				return r.value.text;
			} catch (e) { return null; }
		}

		/** 分页读完整文本（read 按行分页，maxLines 默认 5000） */
		async function readAllText(read, sid, path, signal, capLines) {
			const cap = capLines || 20000;
			let offset = 1, out = [], guard = 0;
			while (guard++ < 40) {
				let r;
				try { r = await read(sid, path, { offset: offset, limit: 2000 }, signal); }
				catch (e) { return null; }
				if (!r || r.ok !== true) return out.length ? out.join("\n") : null;
				out.push(r.value.text);
				if (r.value.eof || r.value.lines === 0) break;
				offset += r.value.lines;
				if (offset > cap) break;
			}
			return out.join("\n");
		}

		/** 读契约 schema（决策记录以它为准绳；读不到就退化为"只列结构问题"） */
		async function loadDecisionSchema(read, sid, skillsRoot, signal) {
			const cands = [];
			if (skillsRoot) cands.push(skillsRoot + "/sr-askme/references/decision.schema.json");
			cands.push(".agents/skills/sr-askme/references/decision.schema.json");
			for (const p of cands) {
				const text = await readAllText(read, sid, p, signal, 2000);
				if (!text) continue;
				try { return JSON.parse(text); } catch (e) { /* 换下一个 */ }
			}
			return null;
		}

		/**
		 * 按 schema 校验一条决策记录（JSON Schema 的实用子集：
		 * required / enum / const / pattern / minItems / 数组元素 pattern / additionalProperties）
		 */
		function validateDecision(doc, schema) {
			const issues = [];
			const push = (field, value, rule) => issues.push({ field: field, value: value, rule: rule });
			if (!schema) return issues;
			const P = schema.properties || {};
			for (const k of (schema.required || [])) {
				if (doc[k] === undefined) push(k, "(缺失)", "必填字段缺失");
			}
			for (const k of Object.keys(P)) {
				const spec = P[k];
				const v = doc[k];
				if (v === undefined) continue;
				if (spec.const !== undefined && v !== spec.const) push(k, JSON.stringify(v), "必须为 " + JSON.stringify(spec.const));
				if (spec.enum && spec.enum.indexOf(v) < 0) push(k, JSON.stringify(v), "枚举外 · 合法值：" + spec.enum.join(" / "));
				if (spec.pattern && typeof v === "string" && !(new RegExp(spec.pattern)).test(v)) push(k, JSON.stringify(v), "不匹配 " + spec.pattern);
				if (spec.minItems !== undefined && Array.isArray(v) && v.length < spec.minItems) {
					push(k, v.length + " 条", "少于下限 minItems: " + spec.minItems);
				}
				const itemPat = spec.items && spec.items.pattern;
				if (itemPat && Array.isArray(v)) {
					for (const item of v) {
						if (typeof item === "string" && !(new RegExp(itemPat)).test(item)) {
							push(k, JSON.stringify(item), "元素不匹配 " + itemPat);
						}
					}
				}
			}
			if (schema.additionalProperties === false) {
				for (const k of Object.keys(doc)) {
					if (!P[k]) push(k, JSON.stringify(doc[k]).slice(0, 40), "schema 未声明的字段（additionalProperties: false）");
				}
			}
			return issues;
		}

		/** 读某功能的决策记录 + 校验 + 校准流水 */
		/**
		 * 决策台账（审计面）：决策记录 + 校准流水。
		 * ★ 收**功能根目录**而不是 srWs —— 功能 = 目录（§3.2），所以**不再需要 topicOf 过滤**：
		 *   目录已经天然隔离了。这是"新结构做扎实"的直接收益，少一层猜测、少一类错。
		 */
		async function loadLedger(ctx, read, sid, root, skillsRoot, signal) {
			const dir = root + "/decisions";
			const names = await listDir(ctx, sid, dir, signal, true);
			const mine = names.filter((n) => /^decision_.*\.json$/i.test(n));

			const schema = await loadDecisionSchema(read, sid, skillsRoot, signal);
			const records = [];
			for (const n of mine.slice().sort().reverse()) {
				const text = await readAllText(read, sid, dir + "/" + n, signal, 2000);
				let doc = null, parseErr = null;
				try { doc = JSON.parse(text); } catch (e) { parseErr = String((e && e.message) || e); }
				records.push({
					file: n,
					doc: doc,
					parseErr: parseErr,
					issues: doc ? validateDecision(doc, schema) : []
				});
			}

			// 校准流水（evidence\calibration_*.jsonl）
			const ev = await listDir(ctx, sid, root + "/evidence", signal, true);
			const calFiles = ev.filter((n) => /^calibration_.*\.jsonl$/i.test(n));
			const calibration = [];
			for (const n of calFiles) {
				const text = await readAllText(read, sid, root + "/evidence/" + n, signal, 2000);
				if (!text) continue;
				for (const line of text.split(/\r?\n/)) {
					const s = line.trim();
					if (!s) continue;
					try { calibration.push({ file: n, row: JSON.parse(s) }); } catch (e) { /* 跳过坏行 */ }
				}
			}

			// ★ 交接 JSON（analysis\sr-gdd-handoff_*.json）—— 头脑风暴结论的主要载体
			const an = await listDir(ctx, sid, root + "/analysis", signal, true);
			const handoffs = [];
			for (const n of an.filter((x) => /^sr-gdd-handoff_.*\.json$/i.test(x))) {
				const text = await readAllText(read, sid, root + "/analysis/" + n, signal, 2000);
				if (text) handoffs.push({ name: n, text: text });
			}

			return {
				records: records, schema: schema, schemaOk: !!schema,
				calibration: calibration, calFiles: calFiles,
				handoffs: handoffs
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

		/** 扫工作区 → 功能列表 */
		async function loadDashboard(ctx, read, sid, cwd, configPath, signal) {
			// ★ 先从 sr 配置拿**绝对路径**，不跟着当前会话的工作区走
			const P = await loadSrPaths(read, sid, configPath, signal);
			const srWs = P.srWs || SR_WS;
			const cfgDir = P.configRoot || CONFIG_DIR;
			if (!P.srWs) {
				const rel = await loadDashboardInner(ctx, read, sid, SR_WS, CONFIG_DIR, signal);
				rel.pathNote = "未读到 sr 配置（试过 " + P.configFile + "），已退回相对路径 " + SR_WS;
				rel.configFile = P.configFile;
				rel.cwd = cwd || "";
				return rel;
			}
			const out = await loadDashboardInner(ctx, read, sid, srWs, cfgDir, signal);
			out.srWs = srWs;
			out.configRoot = cfgDir;
			out.skillsRoot = P.skillsRoot || "";
			out.configFile = P.configFile;
			out.cwd = cwd || "";
			return out;
		}

		async function loadDashboardInner(ctx, read, sid, srWs, cfgDir, signal) {
			// ★★ 功能 = 目录（设计 §3.2）。**只认 `features\<主题>\`，代码里零兼容。**
			//    旧结构（平铺的 proposals/analysis/decisions/evidence）是"待清理的素材仓库"：
			//    素材已由 `migrate-to-features.js` 搬进新结构，面板**不再读它**，
			//    只统计还剩多少文件 —— 那个数字的唯一用途是提示你"可以删了"。
			const [featDirs, configNames] = await Promise.all([
				listDirs(ctx, sid, srWs + "/features", signal, true),
				listDir(ctx, sid, cfgDir, signal, true)
			]);

			const feats = [];
			for (const t of featDirs) {
				if (isNoise(t)) continue;
				const root = srWs + "/features/" + t;
				const f = {
					topic: t, root: root, ledgerFile: null,
					// concept 沿用旧字段名，含义 = **全部头脑风暴产物**（6 种 analysis 产出）
					concept: [], drafts: [], finals: [], reviews: [], speeches: [],
					decisions: [], evidence: [], source: [], evPacks: [], others: 0
				};
				// ① 七个标准子目录
				for (const sub in DIR_BUCKET) {
					const names = await listDir(ctx, sid, root + "/" + sub, signal, true);
					for (const n of names) {
						// gdd\ 里混着成稿/定稿/审查，要再细分；其余子目录直接按目录归桶
						const bucket = (sub === "gdd") ? artifactBucket(n) : DIR_BUCKET[sub];
						const field = BUCKET_FIELD[bucket];
						if (field) f[field].push(n); else f.others += 1;
					}
				}
				// ② 功能根下的设计台账（§7.2：台账在功能根，不在任何子目录）
				const rootFiles = await listDir(ctx, sid, root, signal, true);
				f.ledgerFile = rootFiles.filter((n) => /^设计台账.*\.md$/i.test(n))[0] || null;
				// ③ 证据包（`evidence\<名字>\` 这种子目录）
				for (const d of await listDirs(ctx, sid, root + "/evidence", signal, true)) {
					const inside = await listDir(ctx, sid, root + "/evidence/" + d, signal, true);
					f.evPacks.push({ dir: d, files: inside.length, sample: inside.slice(0, 6) });
				}
				feats.push(f);
			}

			// 旧结构残留统计 —— **只用于提示，不产出功能**
			let legacyLeft = 0;
			for (const d of ["proposals", "analysis", "decisions", "evidence", "inbox"]) {
				legacyLeft += (await listDir(ctx, sid, srWs + "/" + d, signal, true)).length;
			}

			// ★ 配置表只按主题**挂到已有功能上**，自己绝不创建功能
			//   （策划配置目录有 92 张表，它们不是功能，是功能的落地资源）
			const configByTopic = new Map();
			for (const n of configNames) {
				if (!/\.xlsx?m?$/i.test(n)) continue;
				const t = topicOf(n);
				if (isNoise(t)) continue;
				if (!configByTopic.has(t)) configByTopic.set(t, []);
				configByTopic.get(t).push(n);
			}

			const features = [];
			/** 定稿的绝对路径：**只有一种结构** —— `features\<主题>\gdd\` */
			const finalAbs = (f, name) => f.root + "/gdd/" + name;

			for (const f of feats) {
				f.finals.sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : -1));
				f.reviews.sort().reverse();
				f.decisions.sort().reverse();
				const latest = f.finals[0] || null;   // finals 已按日期倒序
				// ★ 定稿以**日期**定最终版（口径不变）；但为了暴露"多份 active 并存"这个真实缺陷，
				//   这里把**每一份定稿的头部**都读一遍，交给 checkFinals 判（设计 §6.1 / §8 V1）。
				//   代价：每功能多 N-1 次 readHead；定稿通常 1–3 份，可接受。
				//   ★ 路径统一走 finalAbs —— 新结构 `features\<主题>\gdd\` 与旧结构 `proposals\` 都能读
				const finalHeads = await Promise.all(f.finals.map(async (name) => {
					const h = parseFrontmatter(await readHead(read, sid, finalAbs(f, name), signal));
					return { name: name, doc_type: h ? h.doc_type : null, status: h ? h.status : null };
				}));
				const finalCheck = checkFinals(finalHeads);
				const head = finalHeads.length ? finalHeads[0] : null;

				features.push({
					topic: f.topic,
					root: f.root,                    // ★ 功能的根目录 —— 一切读取都从它出发
					ledgerFile: f.ledgerFile,        // ★ 功能根下的设计台账（§7.2）
					docType: head ? head.doc_type : null,
					status: head ? head.status : null,
					finalCheck: finalCheck,          // ★ 定稿有效性（§6.1 / §8 V1）
					latestFinal: latest,
					latestDate: latest ? dateOf(latest) : "",
					finals: f.finals.length,
					reviews: f.reviews.length,
					speeches: f.speeches.length,
					decisions: f.decisions.length,
					evidence: f.evidence.length,
					evPacks: f.evPacks,
					sources: f.source.length,
					configs: configByTopic.get(f.topic) || [],
					others: f.others,
					historyCount: Math.max(0, f.finals.length - 1),
					openPath: latest ? finalAbs(f, latest) : null,
					// ★ A3 产物：留全文件名，按阶段分组
					files: {
						concept: f.concept.slice().sort(),
						draft: f.drafts.slice().sort(),
						final: f.finals.slice(),                    // 已按日期倒序
						review: f.reviews.slice().sort().reverse(),
						speech: f.speeches.slice().sort().reverse(),
						config: (configByTopic.get(f.topic) || []).slice().sort(),
						decision: f.decisions.slice().sort().reverse(),
						evidence: f.evidence.slice().sort(),
						source: f.source.slice().sort()
					},
					stageCounts: {
						concept: f.concept.length,
						draft: f.drafts.length,
						config: (configByTopic.get(f.topic) || []).length,
						final: f.finals.length,
						review: f.reviews.length,
						speech: f.speeches.length
					},
					stages: {
						concept: f.concept.length > 0,
						draft: f.drafts.length > 0 || f.finals.length > 0,
						config: (configByTopic.get(f.topic) || []).length > 0,
						final: f.finals.length > 0,
						review: f.reviews.length > 0,
						speech: f.speeches.length > 0
					}
				});
			}

			// ★ 不再过滤：**目录存在就是功能**（哪怕它暂时是空的）—— 这是"功能 = 目录"的直接推论
			features.sort((a, b) => (a.latestDate < b.latestDate ? 1 : -1));

			return {
				features: features,
				legacyLeft: legacyLeft,      // 旧结构还剩多少文件（唯一用途：提示你"可以删了"）
				counts: { features: features.length, configs: configNames.length },
				srWs: srWs,
				configRoot: cfgDir
			};
		}

		// ════════════════════════════════════════════════════════════════
		// 三、样式
		// ════════════════════════════════════════════════════════════════
		const C = {
			ink: "#1a1a1a", soft: "#c8c8c8", faint: "#e8e8e8", panel: "#fff", bg: "#fafafa",
			warn: "#b45309", bad: "#b91c1c", ok: "#15803d", muted: "#6b6b6b", link: "#2b6cb0"
		};
		function badge(text, tone) {
			const color = tone === "ok" ? C.ok : tone === "warn" ? C.warn : tone === "bad" ? C.bad : C.muted;
			return h("span", {
				key: "b:" + text,
				style: {
					display: "inline-block", fontFamily: "monospace", fontSize: "10px",
					border: "1px solid " + (tone ? color : C.soft), color: tone ? color : C.muted,
					borderRadius: "3px", padding: "0 5px", marginRight: "4px", whiteSpace: "nowrap"
				}
			}, text);
		}
		const STAGE_LABELS = [
			["concept", "概念"], ["draft", "成稿"], ["config", "配置"],
			["final", "定稿"], ["review", "审查"], ["speech", "宣讲"]
		];

		// ════════════════════════════════════════════════════════════════
		// 四、组件
		// ════════════════════════════════════════════════════════════════

		function Glyph({ size }) {
			return h("span", { style: { fontSize: (size === void 0 ? 16 : size) + "px", lineHeight: 1, fontWeight: 700 } }, "策");
		}

		/** 阶段进度：六段小徽章，完成的实心 */
		function StageBar(props) {
			const stages = props.stages || {};
			return h("div", { style: { display: "flex", gap: "3px", marginBottom: "7px", flexWrap: "wrap" } },
				STAGE_LABELS.map(([k, label]) => {
					const on = !!stages[k];
					return h("span", {
						key: k,
						style: {
							fontSize: "10px", fontFamily: "monospace", borderRadius: "3px", padding: "1px 5px",
							border: "1px solid " + (on ? C.ink : C.soft),
							background: on ? C.ink : "transparent",
							color: on ? "#fff" : "#aaa"
						}
					}, label);
				}));
		}

		/** 单个功能卡（作为组件渲染，不要当普通函数调用——它内部有 hooks） */
		function FeatureCard(props) {
			const f = props.feature;
			const onOpen = props.onOpen;
			const [hover, setHover] = React.useState(false);
			const clickable = !!f.openPath;
			const finalActive = f.status === "active";
			const waiting = props.attention === "pending";
			const stuck = !f.latestFinal
				? "卡在：尚未出定稿"
				: (finalActive ? "已定稿 · 可交程序" : "最终版状态：" + (f.status || "?"));

			// ★ 整张卡片**不可点**——只有底部的文件链接可点（对齐 DSH 会话里的文件链接习惯）
			return h("div", {
				onMouseEnter: () => setHover(true),
				onMouseLeave: () => setHover(false),
				style: {
					border: "1px solid " + (waiting ? C.warn : C.faint),
					borderLeft: "3px solid " + (waiting ? C.warn : (finalActive ? C.ok : C.soft)),
					borderRadius: "4px", padding: "10px 12px",
					background: C.panel,
					minWidth: "250px", flex: "1 1 250px"
				}
			}, [
				// ★ 待拍板横幅：放在最上面，一眼能看见，且可直接点进去回答
				waiting ? h("div", {
					key: "attn",
					onClick: (e) => { e.stopPropagation(); props.onAttention(f); },
					title: "点这里去回答",
					style: {
						margin: "-10px -12px 9px", padding: "7px 12px",
						background: C.warn, color: "#fff", fontSize: "12px", fontWeight: 600,
						cursor: "pointer", borderRadius: "3px 3px 0 0",
						display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px"
					}
				}, [
					h("span", { key: "t" }, "⚠ 等你拍板"),
					h("span", { key: "g", style: { fontWeight: 400, fontSize: "11px", opacity: 0.9 } }, "去回答 ›")
				]) : null,
				h("div", { key: "n", style: { display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px", flexWrap: "wrap" } }, [
					h("b", { key: "t", style: { fontSize: "13px" } }, f.topic),
					f.docType
						? badge(f.docType + " / " + (f.status || "?"), finalActive ? "ok" : null)
						: badge("无定稿", "warn")
				]),
				h(StageBar, { key: "s", stages: f.stages }),
				h("div", { key: "m", style: { fontSize: "11px", color: finalActive ? C.ok : C.muted, marginBottom: "5px" } }, stuck),
				h("div", { key: "c", style: { fontSize: "11px", color: C.muted } },
					"定稿 " + f.finals + " · 审查 " + f.reviews + " · 宣讲 " + f.speeches +
					" · 配置表 " + f.configs.length + " · 决策 " + f.decisions),
				// 最终版明确标出（按日期，最新即最终版）
				f.latestFinal ? h("div", {
					key: "v",
					style: {
						fontSize: "11px", color: C.muted, marginTop: "4px",
						borderTop: "1px solid " + C.faint, paddingTop: "4px"
					}
				}, [
					h("span", { key: "a", style: { fontFamily: "monospace" } },
						"最终版 " + f.latestDate.slice(0, 4) + "-" + f.latestDate.slice(4, 6) + "-" + f.latestDate.slice(6, 8)),
					f.historyCount > 0
						? h("span", { key: "b", style: { color: "#999" } }, " · 另有 " + f.historyCount + " 个历史版本")
						: null
				]) : null,
				// 底部：**可点的文件超链接**（对齐 DSH 会话里的文件链接）+「详情 ›」
				h("div", {
					key: "o",
					style: {
						display: "flex", justifyContent: "space-between", alignItems: "center",
						marginTop: "6px", gap: "8px", borderTop: "1px solid " + C.faint, paddingTop: "5px"
					}
				}, [
					clickable ? h("button", {
						key: "lnk", type: "button",
						onClick: () => onOpen(f),
						title: "点击打开：" + f.openPath,
						style: {
							font: "inherit", fontSize: "11px", fontFamily: "monospace",
							padding: 0, border: "none", background: "none",
							color: hover ? C.link : "#3b6ea5",
							cursor: "pointer",
							textDecoration: hover ? "underline" : "none",
							overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "175px"
						}
					}, "📄 " + f.latestFinal) : h("span", { key: "none", style: { fontSize: "11px", color: "#bbb" } }, "（无可打开文件）"),
					h("button", {
						key: "d", type: "button",
						onClick: () => props.onDetail(f),
						style: {
							font: "inherit", fontSize: "10px", padding: "1px 7px",
							border: "1px solid " + C.soft, background: "#fff",
							borderRadius: "3px", cursor: "pointer", color: C.ink, whiteSpace: "nowrap"
						}
					}, "详情 ›")
				])
			]);
		}

		/** 打开结果提示（成功/失败/诊断都显示在面板上，不藏 console） */
		function NoticeBar(props) {
			const n = props.notice;
			if (!n) return null;
			const isErr = n.kind === "err";
			return h("div", {
				style: {
					border: "1px solid " + (isErr ? C.bad : C.faint),
					borderLeft: "3px solid " + (isErr ? C.bad : n.kind === "ok" ? C.ok : C.soft),
					background: "#fff", borderRadius: "4px", padding: "8px 11px",
					fontSize: "12px", marginBottom: "12px",
					color: isErr ? C.bad : n.kind === "ok" ? C.ok : C.muted
				}
			}, [
				h("div", { key: "t", style: { wordBreak: "break-all", lineHeight: 1.7 } }, n.text),
				n.diag ? h("pre", {
					key: "d",
					style: {
						marginTop: "7px", marginBottom: 0, padding: "8px", fontSize: "11px",
						whiteSpace: "pre-wrap", background: C.bg, border: "1px solid " + C.faint,
						borderRadius: "3px", color: C.ink, fontFamily: "monospace", lineHeight: 1.65,
						userSelect: "text"
					}
				}, n.diag) : null
			]);
		}

		function RiskBar(d) {
			const noFinal = d.features.filter((f) => !f.latestFinal).length;
			const multi = d.features.filter((f) => f.historyCount > 0).length;
			const waiting = (d.features || []).filter((f) => d.attentionOf && d.attentionOf(f.topic) === "pending");
			// ★ V1 定稿有效性（设计 §6.1 / §8）：多份 active 并存 / 旧定稿未标 archived / 没有 active
			const hasIssue = (f, code) => !!(f.finalCheck && f.finalCheck.issues.some((i) => i.code === code));
			const dupActive = (d.features || []).filter((f) => f.finalCheck && f.finalCheck.actives.length > 1);
			const noActive = (d.features || []).filter((f) => hasIssue(f, "V1b"));
			const unarchived = (d.features || []).filter((f) => hasIssue(f, "V1c"));
			const items = [];
			if (dupActive.length) items.push("⛔ " + dupActive.length + " 个功能有多份 active 定稿：" +
				dupActive.map((f) => f.topic + "（" + f.finalCheck.actives.length + " 份）").join("、"));
			if (waiting.length) items.push("⚠ " + waiting.length + " 个功能在等你拍板：" + waiting.map((f) => f.topic).join("、"));
			if (noActive.length) items.push(noActive.length + " 个功能没有 active 定稿");
			if (unarchived.length) items.push(unarchived.length + " 个功能的旧定稿未标 archived");
			if (noFinal) items.push("尚未出定稿 " + noFinal + " 个");
			if (multi) items.push("有历史版本的 " + multi + " 个（以最新为最终版）");
			if (!items.length) items.push("未发现待办风险");
			const bad = dupActive.length > 0;
			const warn = bad || noFinal > 0 || waiting.length > 0;
			return h("div", {
				style: {
					border: "1px solid " + (bad ? C.bad : waiting.length ? C.warn : C.faint),
					borderLeft: "3px solid " + (bad ? C.bad : warn ? C.warn : C.ok),
					background: bad ? "#fef2f2" : waiting.length ? "#fff7ed" : "#fffdf7",
					borderRadius: "4px", padding: "9px 12px", fontSize: "12px",
					marginBottom: "12px", fontWeight: (bad || waiting.length) ? 600 : 400
				}
			}, items.join(" · "));
		}

		/** 错误边界：任何渲染异常都显示在面板里，而不是白屏 */
		class PanelErrorBoundary extends React.Component {
			constructor(props) { super(props); this.state = { err: null }; }
			static getDerivedStateFromError(err) { return { err: err }; }
			componentDidCatch(err, info) { console.error("[sr-workbench] 渲染失败", err, info); }
			render() {
				const e = this.state.err;
				if (!e) return this.props.children;
				return h("div", {
					style: {
						padding: "20px 24px", fontFamily: "system-ui, monospace", color: C.bad,
						height: "100%", overflow: "auto", boxSizing: "border-box", background: C.bg
					}
				}, [
					h("h1", { key: "t", style: { fontSize: "16px", margin: "0 0 10px", color: C.ink } }, "策划工作台 · 渲染失败"),
					h("div", { key: "m", style: { fontSize: "13px", marginBottom: "10px" } }, String((e && e.message) || e)),
					h("pre", {
						key: "s",
						style: {
							fontSize: "11px", whiteSpace: "pre-wrap", background: "#fff",
							border: "1px solid " + C.faint, borderRadius: "4px", padding: "10px", color: C.muted
						}
					}, String((e && e.stack) || "").slice(0, 3000))
				]);
			}
		}

		// ── 一级导航 ──────────────────────────────────────────────────
		const NAV = [
			{ id: "dashboard", label: "功能看板" },
			{ id: "assets", label: "设计资产" },
			{ id: "config", label: "配置表与多语言", soon: true },
			{ id: "knowledge", label: "知识库", soon: true }
		];
		/** 功能详情的二级导航 */
		const DETAIL_TABS = [
			{ id: "design", label: "设计台账" },     // ★ §7：第一个页签（"读懂这个功能"的入口）
			{ id: "final", label: "定稿" },          // ★ §6.2：定稿工作面（大纲 + 正文 + 定位）
			{ id: "ledger", label: "决策台账" },
			{ id: "pipeline", label: "流水线" },
			{ id: "artifacts", label: "产物" },
			{ id: "ui", label: "界面图" }
		];

		function TabBar(props) {
			return h("div", {
				style: {
					display: "flex", gap: "4px", marginBottom: "14px",
					borderBottom: "1px solid " + C.faint, paddingBottom: "8px", flexWrap: "wrap"
				}
			}, props.items.map((it) => {
				const on = props.view === it.id;
				const soon = !!it.soon;
				return h("button", {
					key: it.id, type: "button",
					disabled: soon,
					onClick: soon ? void 0 : () => props.onPick(it.id),
					style: {
						font: "inherit", fontSize: "12px", padding: "4px 10px",
						border: "1px solid " + (on ? C.ink : C.faint),
						background: on ? C.ink : "transparent",
						color: soon ? "#c0c0c0" : (on ? "#fff" : C.ink),
						borderRadius: "4px", cursor: soon ? "default" : "pointer"
					}
				}, it.label + (soon ? " · 待做" : ""));
			}));
		}

		// ── A4 决策台账 ───────────────────────────────────────────────
		const TH = { border: "1px solid " + C.faint, background: "#f7f7f7", padding: "5px 7px", textAlign: "left", fontSize: "11px", fontWeight: 600 };
		const TD = { border: "1px solid " + C.faint, padding: "5px 7px", verticalAlign: "top", fontSize: "11px" };

		function IssueTable(issues) {
			return h("table", { style: { width: "100%", borderCollapse: "collapse", marginTop: "6px" } }, [
				h("thead", { key: "h" }, h("tr", null, [
					h("th", { key: "f", style: Object.assign({}, TH, { width: "22%" }) }, "字段"),
					h("th", { key: "v", style: Object.assign({}, TH, { width: "26%" }) }, "实际值"),
					h("th", { key: "r", style: TH }, "违反")
				])),
				h("tbody", { key: "b" }, issues.map((it, i) => h("tr", { key: i }, [
					h("td", { key: "f", style: Object.assign({}, TD, { fontFamily: "monospace" }) }, it.field),
					h("td", { key: "v", style: Object.assign({}, TD, { fontFamily: "monospace" }) }, String(it.value)),
					h("td", { key: "r", style: Object.assign({}, TD, { color: C.bad }) }, it.rule)
				])))
			]);
		}

		/** 从可能是字符串/包装对象的返回值里取出 id 文本 */
		function idText(v) {
			if (typeof v === "string") return v;
			if (v && typeof v === "object") {
				const inner = v.value || v.sessionId || v.id;
				if (typeof inner === "string") return inner;
			}
			return "";
		}

		/** 小标题 + 内容块 */
		function blk(title, content) {
			return h("div", { key: title, style: { marginTop: "12px" } }, [
				h("div", { key: "t", style: { fontSize: "11px", fontWeight: 600, marginBottom: "5px", color: C.ink } }, title),
				h("div", { key: "c", style: { fontSize: "12px", lineHeight: 1.75 } }, content)
			]);
		}

		/**
		 * 把 decision_result 渲染成人话 —— **不显示原文 JSON**。
		 * 只显示：结论 / 条件完成 / 剩余待办 / 涉及文件 / 下一步 / 定稿门之后的修改。
		 */
		function ResultView(props) {
			const r = props.result;
			const doc = props.doc;
			if (!r || typeof r !== "object") return null;
			const out = [];

			// ① 结论（chosen 是选项 ID，回查选项正文）
			if (r.chosen) {
				const opts = (doc && Array.isArray(doc.options)) ? doc.options : [];
				const hit = opts.filter((o) => o && o.option_id === r.chosen)[0];
				out.push(blk("结论", [
					h("div", { key: "id", style: { fontFamily: "monospace", color: C.ok, marginBottom: "3px" } }, String(r.chosen)),
					hit && hit.action ? h("div", { key: "a" }, String(hit.action)) : null,
					hit && hit.expected_benefit ? h("div", { key: "b", style: { color: C.muted, fontSize: "11px", marginTop: "3px" } }, "预期收益：" + hit.expected_benefit) : null,
					hit && hit.main_risk ? h("div", { key: "c", style: { color: C.warn, fontSize: "11px" } }, "主要风险：" + hit.main_risk) : null
				]));
			}

			// ② 条件完成情况
			const cond = Array.isArray(r.conditions_completed) ? r.conditions_completed : [];
			if (cond.length) {
				const done = cond.filter((c) => c && c.done).length;
				out.push(blk("条件（已完成 " + done + " / " + cond.length + "）", cond.map((c, i) =>
					h("div", { key: i, style: { marginBottom: "6px" } }, [
						h("span", { key: "m", style: { color: c && c.done ? C.ok : C.warn, fontFamily: "monospace" } }, (c && c.done) ? "✓ " : "○ "),
						h("span", { key: "i" }, String((c && c.item) || "")),
						c && c.note ? h("div", { key: "n", style: { marginLeft: "17px", color: C.muted, fontSize: "11px" } }, String(c.note)) : null
					]))));
			}

			// ③ 剩余待办
			const rem = Array.isArray(r.remaining_items) ? r.remaining_items : [];
			if (rem.length) {
				out.push(blk("剩余待办（" + rem.length + "）", rem.map((x, i) =>
					h("div", { key: i, style: { marginBottom: "3px" } }, "· " + String((x && x.item) || x)))));
			}

			// ④ 涉及文件
			if (r.files && typeof r.files === "object" && !Array.isArray(r.files)) {
				const LBL = { final_gdd: "定稿", archived_draft: "已归档成稿", final_review: "审查报告", config_changed: "改动配置表" };
				out.push(blk("涉及文件", Object.keys(r.files).map((k) =>
					h("div", { key: k, style: { marginBottom: "3px" } }, [
						h("span", { key: "k", style: { color: C.muted } }, (LBL[k] || k) + "："),
						h("span", { key: "v", style: { fontFamily: "monospace" } }, Array.isArray(r.files[k]) ? r.files[k].join(" · ") : String(r.files[k]))
					]))));
			}

			// ⑤ 下一步
			if (r.next_step) out.push(blk("下一步", h("div", null, String(r.next_step))));

			// ⑥ 定稿门之后的修改
			const fixes = Array.isArray(r.post_gate_fixes) ? r.post_gate_fixes : [];
			if (fixes.length) {
				out.push(blk("定稿门之后的修改（" + fixes.length + " 条）", fixes.map((x, i) =>
					h("div", {
						key: i,
						style: { marginBottom: "7px", paddingLeft: "8px", borderLeft: "2px solid " + C.faint }
					}, [
						h("div", { key: "d", style: { fontFamily: "monospace", fontSize: "11px", color: C.muted } }, String((x && x.date) || "")),
						h("div", { key: "c" }, String((x && x.change) || "")),
						x && Array.isArray(x.sections) && x.sections.length
							? h("div", { key: "s", style: { marginTop: "3px" } }, x.sections.map((s, j) => h("span", {
								key: j,
								style: { fontSize: "10px", fontFamily: "monospace", border: "1px solid " + C.faint, borderRadius: "3px", padding: "0 4px", marginRight: "3px", color: C.muted }
							}, String(s))))
							: null
					]))));
			}

			if (!out.length) return h("div", { style: { fontSize: "12px", color: C.muted } }, "（这条记录的 decision_result 没有可读结论）");
			return h("div", null, out);
		}

		/**
		 * 拼绝对路径。
		 * ★ rel 可能**已经是绝对路径**（openPath 现在存的是 srWs 拼出来的绝对路径），
		 *   无条件前缀 cwd 会拼成 `D:\TimeMachine/D:\TimeMachine\...`。
		 * Windows 绝对路径同时把 `/` 归一成 `\`，避免混合分隔符。
		 */
		function toAbs(cwd, rel) {
			if (!rel) return "";
			let p = String(rel);
			const isWinAbs = /^[A-Za-z]:[\\/]/.test(p);
			const isAbs = isWinAbs || /^[\\/]/.test(p) || /^\\\\/.test(p);
			if (!isAbs) p = (cwd ? String(cwd).replace(/[\\/]+$/, "") + "\\" : "") + p;
			if (isWinAbs || /^[A-Za-z]:/.test(p)) p = p.replace(/\//g, "\\");
			return p;
		}

		/**
		 * 设计台账（设计 §7）—— 一份"过程叙述"，不是数据列表。
		 *
		 * 渲染纪律（§7.4，可读性第一）：
		 *   ✅ 只有：阶段 → 日期 → 一句话结论
		 *   ❌ 不加徽章 / 不加记录 ID / 不加来源链接 / 不加搜索高亮
		 *   唯一允许的交互：点日期折叠当天条目（阅读辅助，不是信息掺杂）
		 * 来源校验区默认收起，并明确标注"这是校验信息，不是台账内容"。
		 */
		function DesignLedger(props) {
			const led = props.ledger;
			const [folded, setFolded] = React.useState({});
			const [showSrc, setShowSrc] = React.useState(false);
			if (!led) return h("p", { style: { color: C.muted, fontSize: "12px" } }, "正在读设计台账…");
			if (led.error) {
				return h("p", { style: { color: C.bad, fontSize: "12px", userSelect: "text" } }, "读台账失败：" + led.error);
			}
			if (!led.total) {
				return h("p", { style: { color: C.muted, fontSize: "12px" } },
					"台账为空 —— 这个功能还没有决策记录或校准流水。");
			}
			const fmtDate = (d) => (d && d.length === 8)
				? d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8)
				: (d || "（无日期）");

			const blocks = [];
			for (const st of led.stages) {
				if (!st.count) continue;
				blocks.push(h("div", {
					key: "s" + st.id,
					style: {
						marginTop: blocks.length ? "24px" : "0", fontSize: "13px", fontWeight: 700,
						color: C.ink, paddingBottom: "6px", borderBottom: "2px solid " + C.faint
					}
				}, st.name + "（" + st.count + " 条）"));

				for (const day of st.days) {
					const dk = st.id + "|" + day.date;
					const isFolded = !!folded[dk];
					const kids = [h("div", {
						key: "dt",
						onClick: () => { const nx = Object.assign({}, folded); nx[dk] = !isFolded; setFolded(nx); },
						style: {
							fontSize: "12px", fontWeight: 600, color: C.muted, marginTop: "12px",
							marginBottom: isFolded ? "0" : "5px", cursor: "pointer", userSelect: "none"
						}
					}, (isFolded ? "▸ " : "▾ ") + fmtDate(day.date) + "（" + day.items.length + " 条）")];
					if (!isFolded) {
						for (let i = 0; i < day.items.length; i++) {
							kids.push(h("div", {
								key: "i" + i,
								style: {
									fontSize: "12.5px", lineHeight: 1.75, color: C.ink,
									paddingLeft: "15px", marginBottom: "2px", userSelect: "text"
								}
							}, "· " + day.items[i].text));
						}
					}
					blocks.push(h("div", { key: "d" + dk }, kids));
				}
			}

			// 来源校验：默认收起，措辞明确它是"关于台账的元信息"，不是台账内容
			const st2 = (led.stats || { fromDecision: 0, fromJsonl: 0 });
			blocks.push(h("div", {
				key: "src",
				style: { marginTop: "28px", paddingTop: "10px", borderTop: "1px dashed " + C.faint }
			}, [
				h("div", {
					key: "t",
					onClick: () => setShowSrc(!showSrc),
					style: { fontSize: "11px", color: C.muted, cursor: "pointer", userSelect: "none" }
				}, (showSrc ? "▾ " : "▸ ") + "来源校验 —— 决策记录汇总 " + st2.fromDecision +
					" 条 · 校准流水补录 " + st2.fromJsonl + " 条（校验信息，不是台账内容）"),
				showSrc ? h("div", {
					key: "b",
					style: { fontSize: "11px", color: C.muted, marginTop: "6px", lineHeight: 1.75 }
				}, [
					"两个源缺一不可：决策记录的 calibrations 是权威汇总，但实测会漏——" +
					"联盟悬赏的 round 18（把 UI 文案改回）就只在校准 jsonl 里；" +
					"校准 jsonl 是 Gate 前的实时留痕，收口后归档。",
					(led.notes && led.notes.length)
						? h("div", { key: "n", style: { marginTop: "4px", color: C.warn } }, led.notes.join("；"))
						: null
				]) : null
			]));

			return h("div", { style: { maxWidth: "880px" } }, blocks);
		}

		/**
		 * 把定稿里的 HTML `<img …>` **抽出来单独渲染**，不交给 markdown 渲染器。
		 *
		 * ★ 为什么不用 `![](url)`：实测定稿的图是
		 *   `<img src="联盟悬赏UI/UI-M1 联盟悬赏主面板 · 常规难度.png" width="420" />`
		 *   —— URL 里**带空格和间隔号**，塞进 `![]()` 会让 markdown 解析崩掉
		 *   （实测症状：整个面板报 `Cannot read properties of undefined (reading 'code')`）。
		 *   抽出来自己渲染，既绕开解析器，也顺带能控制尺寸和做失败降级。
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

		/** 等宽代码块：**不经 markdown 渲染器**（实测它对 ``` 围栏会崩） */
		function CodeBlock(props) {
			return h("pre", {
				style: {
					margin: "6px 0", padding: "9px 11px", background: C.bg,
					border: "1px solid " + C.faint, borderRadius: "4px",
					fontSize: "11.5px", lineHeight: 1.65, fontFamily: "monospace",
					whiteSpace: "pre", overflowX: "auto", color: C.ink, userSelect: "text"
				}
			}, props.text);
		}

		/**
		 * 把**渲染器支持不稳的两种结构**抽出来单独渲染：围栏代码块 + HTML `<img>`。
		 *
		 * ★ 实测两次崩溃都出在这里（症状都是 `Cannot read properties of undefined (reading 'code')`）：
		 *   ① `<img src="… 含空格和间隔号 ….png">` 塞进 `![]()` → 崩；
		 *   ② ```text 围栏代码块（定稿的循环图 / 流程图 / ASCII 骨架全用它）→ 崩。
		 *   抽出来自己渲染就没有这些问题，顺带：代码块能 `white-space: pre` 保证 ASCII 对齐，
		 *   图片能控制尺寸、失败退化成文件名。
		 */
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

		/** 单张图：解析成 /api/file URL；加载失败退化成文件名，不显示破图 */
		function ImgTag(props) {
			const [bad, setBad] = React.useState(false);
			const url = (props.pathImages && props.pathImages.resolve) ? props.pathImages.resolve(props.src) : void 0;
			if (!url || bad) {
				return h("div", {
					style: {
						fontSize: "11px", color: C.muted, padding: "6px 9px", margin: "6px 0",
						border: "1px dashed " + C.soft, borderRadius: "4px", background: C.bg, userSelect: "text"
					}
				}, "🖼 " + (props.alt || props.src) + (url ? "（图片加载失败）" : "（路径解析失败）"));
			}
			return h("img", {
				src: url, alt: props.alt || "",
				onError: () => setBad(true),
				style: {
					maxWidth: "440px", width: "100%", display: "block", margin: "6px 0",
					border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff"
				}
			});
		}

		/** 块级错误边界：一块崩了不影响其他块，并且**说出是哪一块崩的** */
		class BlockBoundary extends React.Component {
			constructor(props) { super(props); this.state = { err: null }; }
			static getDerivedStateFromError(err) { return { err: err }; }
			componentDidCatch(err) { console.error("[sr-workbench] 块渲染失败", this.props.label, err); }
			render() {
				if (this.state.err) {
					return h("div", {
						style: {
							fontSize: "11px", color: C.bad, padding: "6px 9px", margin: "4px 0",
							border: "1px solid " + C.bad, borderRadius: "4px", background: "#fef2f2",
							userSelect: "text", lineHeight: 1.7
						}
					}, "⚠ 这一块渲染失败 · " + this.props.label + " —— " +
						String((this.state.err && this.state.err.message) || this.state.err));
				}
				return this.props.children;
			}
		}

		/**
		 * 定稿工作面（设计 §6.2 三栏的简化版 / §6.3 条目定位）。
		 *
		 * ★ 分块渲染：解析器把定稿切成「章 / 组」块，每块一个带 `data-blk` 的 div，
		 *   点左栏大纲 → scrollIntoView 定位。**不依赖 markdown 渲染器支持行锚点**。
		 * ★ 左栏是结构导航，右栏是正文；选中的块左边有竖线 + 淡蓝底，便于"知道自己在哪"。
		 */
		function FinalDoc(props) {
			const d = props.doc;
			const [sel, setSel] = React.useState(null);
			const [openGrp, setOpenGrp] = React.useState({});
			const [item, setItem] = React.useState(null);
			const [intent, setIntent] = React.useState("");
			const [sendMsg, setSendMsg] = React.useState(null);
			const bodyRef = React.useRef(null);
			const graph = React.useMemo(() => (d && d.blocks ? buildRefGraph(d) : null), [d]);

			if (!d) return h("p", { style: { color: C.muted, fontSize: "12px" } }, "正在读定稿…");
			if (d.empty) return h("p", { style: { color: C.muted, fontSize: "12px" } }, d.empty);
			if (d.error) return h("p", { style: { color: C.bad, fontSize: "12px", userSelect: "text" } }, d.error);
			if (!d.blocks || !d.blocks.length) {
				return h("p", { style: { color: C.muted, fontSize: "12px" } }, "定稿里没解析出章节结构。");
			}

			const pathImages = {
				resolve: (v) => {
					if (!v || typeof v !== "string") return void 0;
					if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(v)) return void 0;
					const isAbs = /^[A-Za-z]:[\\/]/.test(v) || v.charAt(0) === "/";
					return fileUrl(isAbs ? v : String(d.dir).replace(/[\\/]+$/, "") + "/" + v);
				}
			};
			const goto = (idx) => {
				setSel(idx);
				const box = bodyRef.current;
				if (!box || !box.querySelector || idx < 0) return;
				const el = box.querySelector('[data-blk="' + idx + '"]');
				if (el && el.scrollIntoView) el.scrollIntoView({ block: "start" });
			};
			/** 行号 → 它所在的块 idx（影响范围里点一条，跳过去看） */
			const blockIdxOfLine = (line) => {
				for (let i = 0; i < d.blocks.length; i++) {
					const b = d.blocks[i];
					const n = String(b.text || "").split(/\r?\n/).length;
					if (line >= b.line && line < b.line + n) return i;
				}
				return -1;
			};
			const pickItem = (ref, row, grpIdx) => {
				setItem({ ref: ref, row: row, group: false });
				setSendMsg(null);
				goto(grpIdx);
			};
			/**
			 * 组级选中（§6.3 的引用表里，§4 的规则**只到组级** —— D1 纪律规定"组内不编小号"）。
			 * 所以点 `R2 BOSS 与难度推进` 也要出卡片：给出组级引用 + 组内条目清单 + 该组的引用面。
			 */
			const pickGroup = (chNo, g) => {
				const ref = ("§" + chNo + " " + (g.id || g.no || "")).trim();
				const names = g.rows.map((r) => r.key).slice(0, 14);
				setItem({
					ref: ref, group: true,
					row: {
						line: g.line,
						text: g.title + "（组内 " + g.rows.length + " 条：" + names.join(" / ") +
							(g.rows.length > 14 ? " …" : "") + "）"
					}
				});
				setSendMsg(null);
				goto(g.idx);
			};
			const impact = (item && graph) ? impactOf(graph, item.ref, item.row.line) : [];

			const send = () => {
				if (!item || !intent.trim() || !props.onFix) return;
				setSendMsg({ kind: "pending", text: "正在发给工作会话…" });
				props.onFix({
					path: d.path, ref: item.ref, before: item.row.text, intent: intent.trim(),
					impact: impact.map((h) => ({ line: h.line, where: h.where, kind: h.kind || "" }))
				}).then(
					(r) => setSendMsg(r && r.ok
						? { kind: "ok", text: "已发进工作会话 —— 去会话里看它改；改完回来点「重读」。" }
						: { kind: "err", text: (r && r.note) || "发送失败" }),
					(e) => setSendMsg({ kind: "err", text: String((e && e.message) || e) })
				);
			};

			// 左栏：大纲树（章 → 组 → 条目）
			//   ★ 三处刻意的设计，都是为了让"能点的东西"一眼可见：
			//     ① **默认展开**（openGrp[key] !== false）—— 收起状态下看不到条目，用户不知道能点
			//     ② **整行可点**（展开/收起 + 定位一起做）—— 原来只有 10px 宽的 ▸，基本点不到
			//     ③ **章级条目也列**（§10 的 AC、§7 的文本键）—— 它们同样是可引用实体
			const isItemKey = (k) => /^(UE\d+[a-z]?|AC\d+)$/.test(k);
			const isTextKey = (k) => /^[a-z][a-z0-9_]{3,}$/.test(k);
			const toc = [h("div", {
				key: "head",
				style: { fontSize: "11px", color: C.muted, marginBottom: "8px", lineHeight: 1.6, userSelect: "text" }
			}, d.name + " · " + d.stats.chapters + " 章 / " + d.stats.rows + " 条目" + "　点条目 → 看影响范围")];

			const itemRow = (row, ref, grpIdx) => {
				const on = item && item.ref === ref;
				return h("div", {
					key: "it" + ref,
					onClick: () => pickItem(ref, row, grpIdx),
					title: ref,                      // 悬停看完整引用
					style: {
						fontSize: "11px", cursor: "pointer", userSelect: "none",
						padding: "1px 4px 1px 22px", borderRadius: "3px",
						color: on ? "#fff" : C.muted,
						background: on ? C.link : "transparent",
						fontWeight: on ? 600 : 400,
						whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
					}
				}, row.key);
			};

			for (const c of d.outline) {
				// 章级条目（§10 的 AC、§7 的文本键）—— 默认**收起**：成批看的对象，展开会淹没界面
				const chItems = c.rows.filter((r) => /^AC\d+$/.test(r.key) || (c.no === "7" && isTextKey(r.key)));
				const chKey = "ch" + c.no;
				const chOpen = !!openGrp[chKey];
				toc.push(h("div", {
					key: "c" + c.no,
					onClick: () => {
						if (chItems.length) {
							const nx = Object.assign({}, openGrp);
							nx[chKey] = !chOpen;
							setOpenGrp(nx);
						}
						goto(c.idx);
					},
					style: {
						display: "flex", alignItems: "baseline", cursor: "pointer", userSelect: "none",
						fontSize: "12px", fontWeight: 600, margin: "8px 0 3px",
						color: sel === c.idx ? C.link : C.ink
					}
				}, [
					h("span", {
						key: "t",
						style: {
							fontSize: "9px", color: C.muted, marginRight: "4px",
							width: "9px", flex: "0 0 9px", textAlign: "center"
						}
					}, chItems.length ? (chOpen ? "▾" : "▸") : "·"),
					h("span", { key: "l" },
						"§" + c.no + " " + c.title + (chItems.length && !chOpen ? "  (" + chItems.length + ")" : ""))
				]));
				if (chOpen) {
					for (const r of chItems) toc.push(itemRow(r, ("§" + c.no + " " + r.key).trim(), c.idx));
				}

				// 组
				for (const g of c.children) {
					const tag = g.id || g.no || "";
					const gkey = "g" + g.idx;
					const items = g.rows.filter((r) => isItemKey(r.key));
					const isOpen = openGrp[gkey] !== false;      // ★ 默认展开
					toc.push(h("div", {
						key: gkey,
						onClick: () => {
							if (items.length) {
								const nx = Object.assign({}, openGrp);
								nx[gkey] = !isOpen;
								setOpenGrp(nx);
							}
							// 有 id 的组（R1 / UI-M1…）出卡片；没有 id 的组只定位
							if (g.id || /^R\d+$/.test(g.no)) pickGroup(c.no, g);
							else goto(g.idx);
						},
						style: {
							display: "flex", alignItems: "baseline", cursor: "pointer", userSelect: "none",
							padding: "2px 0 2px 10px", borderRadius: "3px",
							borderLeft: "2px solid " + (sel === g.idx ? C.link : "transparent")
						}
					}, [
						h("span", {
							key: "t",
							style: {
								fontSize: "9px", color: C.muted, marginRight: "4px",
								width: "9px", flex: "0 0 9px", textAlign: "center"
							}
						}, items.length ? (isOpen ? "▾" : "▸") : "·"),
						h("span", {
							key: "l",
							style: { fontSize: "11.5px", color: sel === g.idx ? C.link : C.muted }
						}, (tag ? tag + "  " : "") + g.title + (g.rows.length ? "  (" + g.rows.length + ")" : ""))
					]));
					if (isOpen) {
						for (const r of items) {
							const ref = ("§" + c.no + " " + (g.id || g.no || "") + " " + r.key).trim();
							toc.push(itemRow(r, ref, g.idx));
						}
					}
				}
			}

			// 右栏：定位卡（选中条目时）+ 分块正文
			const labelOf = (b) => {
				if (b.level === 2) return "§" + b.no + " " + (b.title || "");
				const id = b.id || b.no || "";
				const dup = b.no && b.chNo && String(b.no).indexOf(String(b.chNo) + ".") === 0;
				return (dup ? "" : "§" + (b.chNo || "?") + " ") + id + " " + (b.title || "");
			};
			const card = item ? h("div", {
				key: "card",
				style: {
					border: "1px solid " + C.soft, borderLeft: "3px solid " + C.link, background: "#f8fbff",
					borderRadius: "4px", padding: "9px 11px", marginBottom: "10px",
					maxHeight: "34vh", overflow: "auto", flex: "0 0 auto"
				}
			}, [
				h("div", {
					key: "h",
					style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }
				}, [
					h("b", { key: "r", style: { fontSize: "12.5px", color: C.ink } }, item.ref),
					h("span", {
						key: "x",
						onClick: () => { setItem(null); setIntent(""); setSendMsg(null); },
						style: { fontSize: "11px", color: C.muted, cursor: "pointer", userSelect: "none" }
					}, "✕ 取消选择")
				]),
				h("div", { key: "b", style: { fontSize: "11.5px", marginBottom: "7px", userSelect: "text" } }, [
					h("div", { key: "t", style: { color: C.muted } }, "原文（L" + item.row.line + "）"),
					h("div", {
						key: "v",
						style: {
							color: C.ink, background: "#fff", border: "1px solid " + C.faint,
							borderRadius: "3px", padding: "5px 7px", marginTop: "3px", lineHeight: 1.7
						}
					}, item.row.text)
				]),
				h("div", { key: "i", style: { fontSize: "11.5px", marginBottom: "7px" } }, [
					h("div", { key: "t", style: { color: C.muted } },
						"影响范围 —— 面板只扫**结构引用**；语义影响（改了会不会让某条自相矛盾）由 sr-gdd-fix 的影响面闭合负责"),
					impact.length ? h("div", { key: "l", style: { marginTop: "3px" } },
						impact.map((hh, ii) => h("div", {
							key: ii,
							onClick: () => goto(blockIdxOfLine(hh.line)),
							style: { cursor: "pointer", color: C.link, lineHeight: 1.7, userSelect: "text" }
						}, "· L" + hh.line + (hh.kind === "family" ? " [同族] " : " ") + hh.where + " —— " +
							String(hh.text || "").slice(0, 62) + "…"))
					) : h("div", { key: "n", style: { color: C.muted, marginTop: "3px" } }, "· 全文没有其他地方提到它")
				]),
				h("div", { key: "act", style: { display: "flex", gap: "6px", alignItems: "center" } }, [
					h("input", {
						key: "in", value: intent, placeholder: "要改成什么（一句话）",
						onChange: (e) => setIntent(e.target.value),
						style: {
							flex: "1 1 auto", font: "inherit", fontSize: "11.5px", padding: "5px 8px",
							border: "1px solid " + C.soft, borderRadius: "4px"
						}
					}),
					h("button", {
						key: "go", type: "button", disabled: !intent.trim(),
						onClick: send,
						style: {
							font: "inherit", fontSize: "11.5px", padding: "5px 12px", borderRadius: "4px",
							border: "1px solid " + (intent.trim() ? C.link : C.soft),
							background: intent.trim() ? C.link : "#fff",
							color: intent.trim() ? "#fff" : C.muted,
							cursor: intent.trim() ? "pointer" : "default"
						}
					}, "发到工作会话")
				]),
				sendMsg ? h("div", {
					key: "m",
					style: {
						fontSize: "11px", marginTop: "6px", lineHeight: 1.7, userSelect: "text",
						color: sendMsg.kind === "err" ? C.bad : (sendMsg.kind === "ok" ? C.ok : C.muted)
					}
				}, sendMsg.text) : null
			]) : null;

			const body = d.blocks.map((b, i) => h("div", {
				key: "b" + i,
				"data-blk": String(i),
				style: {
					padding: "2px 8px 4px 10px", marginBottom: "6px", borderRadius: "3px",
					borderLeft: "3px solid " + (sel === i ? C.link : "transparent"),
					background: sel === i ? "#f0f7ff" : "transparent"
				}
			}, h(BlockBoundary, { key: "bb", label: labelOf(b).trim() + "（L" + b.line + "）" },
				splitSpecial(b.text).map((p, j) => {
					if (p.t === "img") return h(ImgTag, { key: "i" + j, src: p.v, alt: p.alt, pathImages: pathImages });
					if (p.t === "code") return h(CodeBlock, { key: "c" + j, text: p.v });
					return h(Md, { key: "m" + j, text: p.v, pathImages: pathImages });
				})
			)));

			return h("div", { style: { display: "flex", gap: "16px", alignItems: "flex-start" } }, [
				h("div", {
					key: "toc",
					style: {
						flex: "0 0 252px", width: "252px", maxHeight: "68vh", overflow: "auto",
						borderRight: "1px solid " + C.faint, paddingRight: "10px"
					}
				}, toc),
				h("div", {
					key: "right",
					style: { flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" }
				}, [
					card,
					h("div", {
						key: "body", ref: bodyRef,
						style: { flex: "1 1 auto", minHeight: 0, maxHeight: "68vh", overflow: "auto" }
					}, body)
				])
			]);
		}

		function DecisionLedger(props) {
			const L = props.ledger;
			const [open, setOpen] = React.useState(null);
			if (!L) return h("p", { style: { color: C.muted, fontSize: "12px" } }, "正在读决策台账…");

			const bad = L.records.filter((r) => r.issues.length > 0 || r.parseErr);
			const sel = open === null ? null : L.records[open];
			const d = sel && sel.doc;

			return h("div", null, [
				// ① 契约校验
				h("div", {
					key: "v",
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + (bad.length ? C.bad : C.ok),
						background: "#fff", borderRadius: "4px", padding: "10px 12px", marginBottom: "12px"
					}
				}, [
					h("div", { key: "t", style: { fontSize: "12px", marginBottom: "4px" } }, [
						h("b", { key: "a" }, "契约校验"),
						h("span", { key: "b", style: { color: C.muted } },
							"　对照 " + (L.schemaOk ? "sr-askme/references/decision.schema.json" : "（schema 读不到，仅列结构问题）") +
							"　共 " + L.records.length + " 条，不合规 " + bad.length + " 条")
					]),
					bad.length
						? h("div", { key: "l" }, bad.map((r) => h("div", { key: r.file, style: { marginTop: "6px" } }, [
							h("div", { key: "n", style: { fontFamily: "monospace", fontSize: "11px", color: C.bad } }, r.file + (r.parseErr ? "（JSON 解析失败：" + r.parseErr + "）" : "")),
							r.issues.length ? IssueTable(r.issues) : null
						])))
						: h("div", { key: "ok", style: { fontSize: "11px", color: C.ok } }, "全部记录符合契约。")
				]),

				// ② 已拍板列表
				h("div", { key: "list", style: { background: "#fff", border: "1px solid " + C.faint, borderRadius: "4px", padding: "10px 12px", marginBottom: "12px" } }, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "6px" } }, "已拍板列表（点一行看详情）"),
					L.records.length ? h("table", { key: "tb", style: { width: "100%", borderCollapse: "collapse" } }, [
						h("thead", { key: "h" }, h("tr", null, [
							h("th", { key: "1", style: TH }, "decision_id"),
							h("th", { key: "2", style: TH }, "标题"),
							h("th", { key: "3", style: Object.assign({}, TH, { width: "15%" }) }, "type"),
							h("th", { key: "4", style: Object.assign({}, TH, { width: "12%" }) }, "status"),
							h("th", { key: "5", style: Object.assign({}, TH, { width: "11%" }) }, "日期")
						])),
						h("tbody", { key: "b" }, L.records.map((r, i) => {
							const dd = r.doc || {};
							const tOk = L.schemaOk && L.schema.properties && L.schema.properties.decision_type &&
								L.schema.properties.decision_type.enum.indexOf(dd.decision_type) >= 0;
							const on = open === i;
							return h("tr", {
								key: r.file,
								onClick: () => setOpen(on ? null : i),
								style: { cursor: "pointer", background: on ? "#f0f6ff" : "transparent" }
							}, [
								h("td", { key: "1", style: Object.assign({}, TD, { fontFamily: "monospace" }) }, String(dd.decision_id || "—")),
								h("td", { key: "2", style: TD }, String(dd.title || r.file)),
								h("td", { key: "3", style: Object.assign({}, TD, { fontFamily: "monospace", color: tOk ? C.ink : C.bad }) }, String(dd.decision_type || "—") + (tOk ? "" : " ✗")),
								h("td", { key: "4", style: Object.assign({}, TD, { fontFamily: "monospace" }) }, String(dd.status || "—")),
								h("td", { key: "5", style: Object.assign({}, TD, { fontFamily: "monospace" }) }, String(dd.updated_at || dd.created_at || "").slice(0, 10))
							]);
						}))
					]) : h("div", { key: "n", style: { fontSize: "12px", color: C.muted } }, "本功能没有决策记录。")
				]),

				// ③ 决策详情
				sel ? h("div", { key: "detail", style: { background: "#fff", border: "1px solid " + C.faint, borderRadius: "4px", padding: "10px 12px", marginBottom: "12px" } }, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "6px" } }, "决策详情 · " + sel.file),
					d ? h("table", { key: "tb", style: { width: "100%", borderCollapse: "collapse" } }, h("tbody", null,
						[
							["决策问题", d.decision_question],
							["当前默认动作", d.current_default_action],
							["边界状态", d.boundary_status],
							["stakes", d.stakes],
							["reversibility", d.reversibility],
							["owner", d.owner],
							["rollback_trigger", d.rollback_trigger]
						].map(([k, v]) => h("tr", { key: k }, [
							h("th", { key: "k", style: Object.assign({}, TH, { width: "20%" }) }, k),
							h("td", { key: "v", style: TD }, String(v === undefined || v === null ? "—" : v))
						]))
					)) : h("div", { key: "e", style: { fontSize: "12px", color: C.bad } }, "JSON 解析失败：" + sel.parseErr),
					d && Array.isArray(d.options) ? h("div", { key: "opt", style: { marginTop: "10px" } }, [
						h("div", { key: "t", style: { fontSize: "11px", fontWeight: 600, marginBottom: "4px" } }, "选项（" + d.options.length + " 条）"),
						h("table", { key: "tb", style: { width: "100%", borderCollapse: "collapse" } }, [
							h("thead", { key: "h" }, h("tr", null, [
								h("th", { key: "1", style: TH }, "option_id"),
								h("th", { key: "2", style: TH }, "action"),
								h("th", { key: "3", style: TH }, "expected_benefit"),
								h("th", { key: "4", style: TH }, "main_risk")
							])),
							h("tbody", { key: "b" }, d.options.map((o, i) => h("tr", { key: i }, [
								h("td", { key: "1", style: Object.assign({}, TD, { fontFamily: "monospace" }) }, String(o.option_id || "")),
								h("td", { key: "2", style: TD }, String(o.action || "")),
								h("td", { key: "3", style: TD }, String(o.expected_benefit || "")),
								h("td", { key: "4", style: TD }, String(o.main_risk || ""))
							])))
						])
					]) : null,
					d ? h(ResultView, { key: "res", result: d.decision_result, doc: d }) : null
				]) : null,

				// ④ 校准流水
				h("div", { key: "cal", style: { background: "#fff", border: "1px solid " + C.faint, borderRadius: "4px", padding: "10px 12px" } }, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "6px" } },
						"校准流水（" + L.calibration.length + " 条 · " + L.calFiles.length + " 个文件）"),
					L.calibration.length ? h("div", { key: "tb" }, L.calibration.map((c, i) => {
						const row = c.row || {};
						return h("div", {
							key: i,
							style: { padding: "7px 0", borderTop: i ? "1px solid " + C.faint : "none" }
						}, [
							h("div", { key: "h", style: { fontSize: "10px", color: C.muted, fontFamily: "monospace", marginBottom: "3px" } },
								"第 " + (row.round === undefined ? "?" : row.round) + " 轮 · " + String(row.gate || "") +
								" · " + String(row.ts || "").slice(0, 16) + " · " + String(row.status || "")),
							// ★ 改动内容本身（这才是要看的）
							h("div", { key: "i", style: { fontSize: "12px", lineHeight: 1.7 } }, String(row.input || "(无描述)")),
							Array.isArray(row.affected) && row.affected.length
								? h("div", { key: "a", style: { marginTop: "4px" } }, row.affected.map((x, j) => h("span", {
									key: j,
									style: {
										fontSize: "10px", fontFamily: "monospace", border: "1px solid " + C.faint,
										borderRadius: "3px", padding: "0 5px", marginRight: "3px", color: C.muted
									}
								}, String(x))))
								: null
						]);
					})) : h("div", { key: "n", style: { fontSize: "12px", color: C.muted } }, "本功能没有校准流水。"),
					h("div", {
						key: "w",
						style: {
							marginTop: "8px", padding: "8px 10px", background: "#fff7ed",
							borderLeft: "3px solid " + C.warn, fontSize: "11px"
						}
					}, "⚠️ 校准流水不逐字存原话（sr 的既定口径）。这里能看到「第几轮、哪道门、影响了哪些条目」，看不到当时逐字的答复。")
				])
			]);
		}

		// ── A2 流水线：阶段 → 斜杠命令 ──────────────────────────────
		const STAGE_ORDER = ["concept", "draft", "config", "final", "review", "speech"];
		const STAGE_META = {
			concept: { label: "概念", cmd: "/sr-concept", desc: "创意评估与设计核三角" },
			draft: { label: "成稿", cmd: "/sr-gdd-human", desc: "写成稿（只有纯规则与设计）" },
			config: { label: "配置", cmd: "/sr-config", desc: "把规则落成配置表" },
			final: { label: "定稿", cmd: "/sr-gdd-ai", desc: "整合定稿，交程序" },
			review: { label: "审查", cmd: "/sr-gdd-review", desc: "只读审查定稿" },
			speech: { label: "宣讲", cmd: "/sr-gdd-html", desc: "出宣讲 HTML" }
		};

		/**
		 * 工作会话缓存：**可响应**，跨组件重挂载保留。
		 * key = `<预设>|<功能名>`；值 = 会话 id。
		 * 看板要靠它把「哪个功能在等你拍板」显示出来，所以写入时必须通知订阅者
		 * （否则在详情页建的会话，看板不知道）。
		 */
		const WORK_SESSIONS = new Map();
		const WORK_LISTENERS = new Set();
		const workKey = (presetId, topic) => presetId + "|" + (topic || "");
		const setWorkSession = (key, sid) => {
			if (!key) return;
			WORK_SESSIONS.set(key, sid);
			for (const l of [...WORK_LISTENERS]) { try { l(); } catch (e) { /* ignore */ } }
		};
		/** 订阅工作会话缓存（返回 Map；写入时会触发重渲染） */
		function useWorkSessions() {
			const [, bump] = React.useState(0);
			React.useEffect(() => {
				const l = () => bump((n) => n + 1);
				WORK_LISTENERS.add(l);
				return () => { WORK_LISTENERS.delete(l); };
			}, []);
			return WORK_SESSIONS;
		}

		/** 把 Remote 的原始错误翻成人话 */
		function humanError(r) {
			const m = String((r && r.error && (r.error.message || r.error.code)) || r || "");
			if (/without inject/.test(m)) return "工作台缺少必要权限声明，需要更新插件";
			if (/not found|no entry|不存在/i.test(m)) return "找不到目标（路径或会话可能已变）";
			if (/timeout|超时/i.test(m)) return "对方没有响应（超时）";
			if (/cancel|abort/i.test(m)) return "操作被取消";
			return m || "未知原因";
		}

		/**
		 * 工作会话的实时状态。
		 * 数据全部来自客户端会话模型（hook 订阅，**自动更新，不用轮询**）：
		 *   useSessions                      → SessionSummary { running, blank, updatedAt, projections }
		 *   useSessionPendingInteraction     → 该会话是否有待用户回答的交互
		 * ⚠ 不自己渲染问题正文：SessionPendingInteractionBase 只有 {key, kind, sessionId}，
		 *   正文由各领域插件声明合并贡献，猜不得。这里只报"有/无"并给跳转。
		 */
		function WorkSessionStatus(props) {
			const sid = props.sessionId;
			const useSessions = props.useSessions;
			const usePending = props.useSessionPendingInteraction;
			const onOpen = props.onOpen;

			// ★ hooks 必须无条件调用：条件放进 selector，不放在调用上
			const summary = useSessions ? useSessions((s) => (sid ? s.byId[sid] : void 0)) : void 0;
			const pending = usePending ? usePending((m) => (sid ? m.get(sid) : void 0)) : void 0;

			if (!sid) return null;

			const running = !!(summary && summary.running);
			const blank = !!(summary && summary.blank);
			const proj = (summary && summary.projections && summary.projections.values) || {};
			const title = typeof proj.title === "string" ? proj.title : "";
			const meta = proj.sessionListMetadata || {};
			const lastAt = meta.lastPromptAt || (summary && summary.updatedAt) || 0;

			const fmt = (t) => {
				if (!t) return "—";
				try {
					const d = new Date(t);
					const p = (n) => (n < 10 ? "0" : "") + n;
					return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
						" " + p(d.getHours()) + ":" + p(d.getMinutes());
				} catch (e) { return "—"; }
			};

			const state = running
				? { text: "运行中", color: C.ok, dot: "●" }
				: (pending ? { text: "等你回答", color: C.warn, dot: "⚠" }
					: (blank ? { text: "空白（还没开始）", color: C.muted, dot: "○" }
						: { text: "空闲", color: C.muted, dot: "○" }));

			const row = (k, v, color) => h("div", { key: k, style: { display: "flex", gap: "8px", fontSize: "12px", lineHeight: 1.95 } }, [
				h("span", { key: "k", style: { color: C.muted, minWidth: "62px", flex: "0 0 auto" } }, k),
				h("span", { key: "v", style: { color: color || C.ink, wordBreak: "break-all" } }, v)
			]);

			return h("div", {
				style: {
					border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff",
					padding: "10px 13px", marginTop: "12px"
				}
			}, [
				h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "5px" } }, "工作会话"),
				row("状态", state.dot + " " + state.text, state.color),
				title ? row("标题", title) : null,
				pending ? row("待回答", "有 1 项在等你（" + String(pending.kind || "未知类型") + "）", C.warn) : null,
				row("最近活动", fmt(lastAt)),
				row("会话 id", h("span", { style: { fontFamily: "monospace", fontSize: "11px" } }, String(sid))),
				h("div", { key: "act", style: { marginTop: "8px" } }, h("button", {
					type: "button",
					onClick: () => onOpen(sid),
					style: {
						font: "inherit", fontSize: "12px", padding: "4px 12px",
						border: "1px solid " + C.ink, background: "#fff", color: C.ink,
						borderRadius: "4px", cursor: "pointer"
					}
				}, "在会话里查看 ›"))
			]);
		}

		/**
		 * 待拍板问题卡片 —— A2 的闭环。
		 *
		 * 依据（读 `dsh-client-ui-user-questions` 得到）：注册进 pending 快照的就是
		 * `PendingQuestion` 实例，它的 `questions` 与 `answer()` 都是**公开成员**：
		 *   questions: AskUserQuestionItem[]  { id, question, detail?, header?, options?, multiSelect? }
		 *   answer({ answers: [{ id, selected: [标签], custom? }] })
		 * 所以面板里能读问题、能回答，不必跳去会话。
		 */
		function PendingQuestionCard(props) {
			const pending = props.pending;
			const questions = (pending && Array.isArray(pending.questions)) ? pending.questions : [];
			const [sel, setSel] = React.useState({});      // qid → [标签]
			const [text, setText] = React.useState({});    // qid → 自定义文本
			const [busy, setBusy] = React.useState(false);
			const [err, setErr] = React.useState("");
			const [done, setDone] = React.useState("");

			if (!questions.length) return null;

			const submit = (answers) => {
				setBusy(true); setErr(""); setDone("");
				let r;
				try { r = pending.answer({ answers: answers }); }
				catch (e) { setBusy(false); setErr(String((e && e.message) || e)); return; }
				Promise.resolve(r).then(
					() => { setBusy(false); setDone("已提交，等 skill 继续"); },
					(e) => { setBusy(false); setErr(String((e && e.message) || e)); }
				);
			};

			const pickSingle = (q, label) => submit([{ id: q.id, selected: [label] }]);
			const submitMulti = (q) => submit([{
				id: q.id,
				selected: sel[q.id] || [],
				custom: (text[q.id] || "").trim() || void 0
			}]);

			const toggle = (qid, label) => setSel((s) => {
				const cur = s[qid] || [];
				const next = cur.indexOf(label) >= 0 ? cur.filter((x) => x !== label) : cur.concat([label]);
				const out = {}; for (const k in s) out[k] = s[k]; out[qid] = next; return out;
			});

			return h("div", {
				style: {
					border: "1px solid " + C.warn, borderLeft: "3px solid " + C.warn,
					background: "#fffdf7", borderRadius: "4px", padding: "11px 13px", marginTop: "12px"
				}
			}, [
				h("div", { key: "h", style: { fontSize: "12px", fontWeight: 600, marginBottom: "7px", color: C.warn } },
					"⚠ 等你拍板（" + questions.length + " 个问题）"),

				...questions.map((q, qi) => {
					const opts = Array.isArray(q.options) ? q.options : [];
					const picked = sel[q.id] || [];
					return h("div", {
						key: "q" + qi,
						style: { borderTop: qi ? "1px solid " + C.faint : "none", paddingTop: qi ? "9px" : "0", marginTop: qi ? "9px" : "0" }
					}, [
						q.header ? h("div", { key: "hd", style: { fontSize: "11px", color: C.muted, fontFamily: "monospace", marginBottom: "2px" } }, String(q.header)) : null,
						h("div", { key: "q", style: { fontSize: "13px", lineHeight: 1.7, marginBottom: q.detail ? "3px" : "7px" } }, String(q.question || "")),
						q.detail ? h("div", { key: "d", style: { fontSize: "11px", color: C.muted, lineHeight: 1.7, marginBottom: "7px", whiteSpace: "pre-wrap" } }, String(q.detail)) : null,

						// 选项：单选点即答；多选累积后提交
						opts.length ? h("div", { key: "opts", style: { display: "flex", flexDirection: "column", gap: "5px" } },
							opts.map((o, oi) => {
								const label = typeof o === "string" ? o : String((o && (o.label || o.value)) || "");
								const desc = (o && typeof o === "object" && o.description) ? String(o.description) : "";
								const on = picked.indexOf(label) >= 0;
								return h("button", {
									key: oi, type: "button", disabled: busy,
									onClick: () => (q.multiSelect ? toggle(q.id, label) : pickSingle(q, label)),
									style: {
										font: "inherit", textAlign: "left", padding: "7px 10px",
										border: "1px solid " + (on ? C.ink : C.soft),
										background: on ? "#eef4ff" : "#fff",
										borderRadius: "4px", cursor: busy ? "default" : "pointer",
										opacity: busy ? 0.6 : 1
									}
								}, [
									h("div", { key: "l", style: { fontSize: "12px", fontWeight: on ? 600 : 400 } },
										(q.multiSelect ? (on ? "☑ " : "☐ ") : "") + label),
									desc ? h("div", { key: "dd", style: { fontSize: "11px", color: C.muted, marginTop: "2px", lineHeight: 1.6 } }, desc) : null
								]);
							})) : null,

						// 自由文本（"其他"）
						h("div", { key: "free", style: { display: "flex", gap: "6px", marginTop: "7px", alignItems: "center" } }, [
							h("input", {
								key: "i",
								value: text[q.id] || "",
								placeholder: opts.length ? "或直接写你的决定…" : "写下你的决定…",
								onChange: (e) => { const v = e.target.value; setText((t) => { const o = {}; for (const k in t) o[k] = t[k]; o[q.id] = v; return o; }); },
								style: {
									flex: "1 1 220px", fontSize: "12px", padding: "5px 8px",
									border: "1px solid " + C.soft, borderRadius: "4px", outline: "none", background: "#fff"
								}
							}),
							h("button", {
								key: "s", type: "button", disabled: busy || !(text[q.id] || "").trim(),
								onClick: () => submit([{ id: q.id, selected: [], custom: (text[q.id] || "").trim() }]),
								style: {
									font: "inherit", fontSize: "12px", padding: "5px 12px",
									border: "1px solid " + C.ink, background: "#fff", color: C.ink,
									borderRadius: "4px", cursor: busy ? "default" : "pointer"
								}
							}, "提交")
						]),

						q.multiSelect ? h("div", { key: "ms", style: { marginTop: "6px" } }, h("button", {
							type: "button", disabled: busy || !picked.length,
							onClick: () => submitMulti(q),
							style: {
								font: "inherit", fontSize: "12px", padding: "5px 12px",
								border: "1px solid " + C.ink, background: C.ink, color: "#fff",
								borderRadius: "4px", cursor: busy ? "default" : "pointer"
							}
						}, "提交所选（" + picked.length + "）")) : null
					]);
				}),

				done ? h("div", { key: "ok", style: { marginTop: "8px", fontSize: "12px", color: C.ok } }, done) : null,
				err ? h("div", { key: "er", style: { marginTop: "8px", fontSize: "12px", color: C.bad } }, "提交失败：" + err) : null
			]);
		}

		// ── A3 产物：阶段 → 子目录（用于拼绝对路径）──────────────────
		//   ★ `sub` 是**功能根目录下**的子目录名（单轨，§9.1.4）—— 打开文件时拼 `f.root + "/" + sub + "/" + name`。
		//     2026-09-29 修：原来拼的是旧结构 `srWs + "/" + sub`，单轨之后全部指错；
		//     同时补上 `evidence` / `source` 两组（原先根本没有，证据与源文件在页签里看不见）。
		const ARTIFACT_GROUPS = [
			{ key: "concept", label: "概念", sub: "analysis" },
			{ key: "draft", label: "成稿", sub: "gdd" },
			{ key: "final", label: "定稿", sub: "gdd" },
			{ key: "review", label: "审查", sub: "gdd" },
			{ key: "speech", label: "宣讲", sub: "delivery" },
			{ key: "evidence", label: "证据", sub: "evidence" },
			{ key: "source", label: "源文件", sub: "source" },
			{ key: "config", label: "配置表", sub: null },   // 在 config_root，不在功能目录
			{ key: "decision", label: "决策", sub: "decisions" }
		];

		/** 文件名里的日期 → YYYY-MM-DD */
		function fmtNameDate(name) {
			const m = /(\d{4})(\d{2})(\d{2})/.exec(String(name || ""));
			return m ? m[1] + "-" + m[2] + "-" + m[3] : "";
		}

		/**
		 * A3 · 功能详情 · 产物
		 * 按阶段分组列出该功能的全部产物，每行可点开（系统默认程序）。
		 */
		function ArtifactList(props) {
			const f = props.feature;
			const srWs = props.srWs || "";
			const configRoot = props.configRoot || "";
			const onOpen = props.onOpen;
			const [fold, setFold] = React.useState({});

			if (!f || !f.files) return h("div", { style: { color: C.muted, fontSize: "12px" } }, "没有产物数据。");

			const absOf = (groupKey, name) => {
				const g = ARTIFACT_GROUPS.filter((x) => x.key === groupKey)[0];
				if (!g) return "";
				if (g.sub === null) return (configRoot || srWs) + "/" + name;   // 配置表在 config_root
				return (f.root || srWs) + "/" + g.sub + "/" + name;            // ★ 从**功能根目录**出发
			};

			const total = ARTIFACT_GROUPS.reduce((n, g) => n + ((f.files[g.key] || []).length), 0);

			// 一致性提示（能算的都算，不算的不装作算了）
			const notes = [];
			if ((f.files.speech || []).length > 1) {
				notes.push("有 " + f.files.speech.length + " 份宣讲 HTML —— 源一致性需人工确认（工作台不解析 HTML 页脚）");
			}
			if ((f.files.final || []).length > 1) {
				notes.push("有 " + f.files.final.length + " 个定稿版本 —— 按日期，最新的是最终版");
			}

			return h("div", null, [
				h("div", { key: "sum", style: { fontSize: "12px", color: C.muted, marginBottom: "10px" } },
					"共 " + total + " 个产物　" + ARTIFACT_GROUPS
						.map((g) => g.label + " " + ((f.files[g.key] || []).length))
						.filter((s) => !/ 0$/.test(s))
						.join(" · ")),

				...notes.map((t, i) => h("div", {
					key: "n" + i,
					style: {
						border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn,
						background: "#fffdf7", borderRadius: "4px", padding: "8px 11px",
						fontSize: "12px", marginBottom: "8px"
					}
				}, "⚠ " + t)),

				...ARTIFACT_GROUPS.map((g) => {
					const names = f.files[g.key] || [];
					if (!names.length) return null;
					const isFinal = g.key === "final";
					return h("div", {
						key: g.key,
						style: {
							border: "1px solid " + C.faint, borderRadius: "4px",
							background: "#fff", marginBottom: "9px", overflow: "hidden"
						}
					}, [
						h("div", {
							key: "h",
							onClick: () => setFold((s) => { const o = {}; for (const k in s) o[k] = s[k]; o[g.key] = !s[g.key]; return o; }),
							style: {
								display: "flex", justifyContent: "space-between", alignItems: "center",
								padding: "7px 11px", background: C.bg, cursor: "pointer",
								borderBottom: fold[g.key] ? "none" : "1px solid " + C.faint
							}
						}, [
							h("span", { key: "l", style: { fontSize: "12px", fontWeight: 600 } }, g.label + "（" + names.length + "）"),
							h("span", { key: "t", style: { fontSize: "10px", color: C.muted } }, fold[g.key] ? "展开 ▸" : "收起 ▾")
						]),
						fold[g.key] ? null : h("div", { key: "b", style: { padding: "4px 0" } },
							names.map((n, i) => {
							 const abs = absOf(g.key, n);
							 const st = (isFinal && n === f.latestFinal) ? (f.status || "") : "";
							 return h("div", {
								key: i,
								style: {
									display: "flex", alignItems: "center", gap: "8px",
									padding: "5px 11px", borderTop: i ? "1px solid " + C.faint : "none"
								}
							 }, [
								h("span", {
									key: "b",
									style: {
										fontSize: "10px", fontFamily: "monospace", padding: "0 5px",
										border: "1px solid " + C.soft, borderRadius: "3px",
										color: (isFinal && n === f.latestFinal) ? C.ok : C.muted,
										whiteSpace: "nowrap"
									}
								}, (isFinal && n === f.latestFinal) ? "最终版" : g.label),
								h("button", {
									key: "n", type: "button",
									onClick: () => onOpen(abs),
									title: "点击打开：" + abs,
									style: {
										font: "inherit", fontSize: "12px", fontFamily: "monospace",
										padding: 0, border: "none", background: "none",
										color: "#3b6ea5", cursor: "pointer", textAlign: "left",
										overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
										flex: "1 1 auto", textDecoration: "none"
									}
								}, n),
								st ? h("span", { key: "s", style: { fontSize: "10px", color: C.ok, fontFamily: "monospace" } }, st) : null,
								fmtNameDate(n) ? h("span", { key: "d", style: { fontSize: "10px", color: C.muted, fontFamily: "monospace", whiteSpace: "nowrap" } }, fmtNameDate(n)) : null
							 ]);
							}))
					]);
				}),

				h("div", { key: "foot", style: { marginTop: "12px", fontSize: "11px", color: C.muted, lineHeight: 1.85 } }, [
					h("div", { key: "a" }, "产物来自工作区实时读取；类型由文件名派生，不另存索引。"),
					h("div", { key: "b" }, "点文件名用系统默认程序打开。")
				])
			]);
		}

		/**
		 * 解析定稿的 §5 界面章 —— A5 的数据源。
		 *
		 * **真实格式**（实测 `联盟悬赏_20260923_定稿.md`）：
		 *   ## 5. 用户体验与界面流程
		 *   ### 5.0 界面清单总览
		 *   | 界面ID | 名称 | 进入方式 | 退出方式 |
		 *   | --- | --- | --- | --- |
		 *   | UI-M1 | 联盟悬赏主面板 | 联盟面板内【联盟悬赏】入口 | 返回联盟面板 |
		 *   边界声明：出刀战斗本体复用 BOSS 挑战……（紧跟表格的一段）
		 *   ### 5.1 UI-M1 联盟悬赏主面板
		 *   <img src="联盟悬赏UI/UI-M1 联盟悬赏主面板 · 常规难度.png" alt="…" width="420" />
		 *   | 编号 | 规则 |
		 *   | UE1 | … |
		 *
		 * 只做这几件事；**不解析 §5.5/5.6**（流程与全局规范不是"界面图"）。
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

		/** 读某功能最新定稿的 §5 界面章（A5 数据源） */
		/** 读定稿的 §5（界面图用）。收**绝对路径** —— 只有 `features\<主题>\gdd\` 一种结构 */
		async function loadInterface(read, sid, absPath, signal) {
			if (!absPath) return { empty: "本功能还没有定稿，界面图在定稿的 §5。" };
			const text = await readAllText(read, sid, absPath, signal, 4000);
			if (!text) return { error: "读不到定稿：" + absPath };
			let parsed = null;
			try { parsed = parseInterfaceSection(text); }
			catch (e) { return { error: "解析 §5 失败：" + String((e && e.message) || e) }; }
			if (!parsed) return { empty: "定稿里没有 §5 界面章。" };
			parsed.file = String(absPath).split(/[\\/]/).pop();
			return parsed;
		}

		/** 本机图片 → 同源 URL（DSH 的 /api/file 路由；Windows 盘符绝对路径服务端也接受） */
		function fileUrl(abs) {
			try {
				const o = (typeof window !== "undefined" && window.location && window.location.origin) || "";
				return o + "/api/file?path=" + encodeURIComponent(abs);
			} catch (e) { return ""; }
		}

		/** 读资产索引（第一部分的数据源；由 scripts/refresh_asset_index.py 生成） */
		/**
		 * 读定稿全文并解析结构（设计 §6.2 定稿工作面）。
		 * ★ 收**绝对路径**（= 功能的 `openPath`）—— 面板不自己拼路径，
		 *   路径由调用方从功能目录算出来，所以目录结构怎么变都不用改这里。
		 */
		async function loadFinal(read, sid, absPath, signal) {
			if (!absPath) return { empty: "这个功能还没有定稿。" };
			const text = await readAllText(read, sid, absPath, signal, 6000);
			if (!text) return { error: "读不到定稿：" + absPath };
			const g = parseFinalGdd(text);
			g.path = absPath;
			g.dir = String(absPath).replace(/[\\/][^\\/]*$/, "");
			g.name = String(absPath).split(/[\\/]/).pop();
			return g;
		}

		async function loadIndex(read, sid, srWs, signal) {
			const text = await readAllText(read, sid, srWs + "/design-asset-index.json", signal, 8000);
			if (!text) return { error: "读不到 design-asset-index.json。先点「刷新索引」让 agent 生成它。" };
			let j = null;
			try { j = JSON.parse(text); }
			catch (e) { return { error: "索引 JSON 解析失败：" + String((e && e.message) || e) }; }
			if (!j || !Array.isArray(j.assets)) return { error: "索引结构不对：assets 不是数组。" };
			return {
				assets: j.assets, schemaVersion: j.schema_version, workspaceId: j.workspace_id,
				srWs: srWs
			};
		}

		// ── B1 设计资产列表 ──────────────────────────────────────────
		const ASSET_TYPE_LABEL = {
			concept: "概念", analysis: "分析", proposal: "成稿文档", decision: "决策",
			evidence: "证据", validation: "验证", inbox: "收集箱",
			assumption: "假设", experiment: "实验", "gate-result": "门结果",
			"workflow-run": "工作流", learning: "复盘规则", retrospective: "复盘",
			knowledge: "知识", "information-assessment": "信息评估"
		};
		const REVIEW_TONE = {
			accepted: "ok", reviewed: "ok", draft: null, needs_review: "warn",
			rejected: "bad", superseded: "warn"
		};
		const REVIEW_LABEL = {
			draft: "草稿", needs_review: "待审", reviewed: "已审", accepted: "已接受",
			rejected: "已驳回", superseded: "已被取代"
		};

		/** 收件箱允许内联的文本文件大小上限（超过就不内联，只记路径） */
		const INLINE_TEXT_CAP = 200000;

		/**
		 * 一个待发送的素材 → 显示用的 { name, size, err }
		 * 文本文件用 FileReader 读出来内联（浏览器自己就能读，省掉 agent 再读一次盘）；
		 * 二进制只记 fullPath（agent 读盘），拿不到路径就退化成大小未知的上传件。
		 */
		async function ingestFile(file) {
			const name = String((file && file.name) || "未命名文件");
			const size = Number((file && file.size) || 0);
			const fullPath = String((file && file.path) || "");
			const C0 = contract;
			const textExt = C0 ? C0.isTextExt(name) : false;
			const docExt = C0 ? C0.isDoc(name) : false;
			if (textExt) {
				try {
					const text = await readFileText(file, INLINE_TEXT_CAP);
					return { name: name, size: size, fullPath: fullPath, isText: true, text: text, orig: file };
				} catch (e) {
					return { name: name, size: size, fullPath: fullPath, isText: false, isDoc: docExt, upload: !fullPath, orig: file, err: "读取失败：" + String((e && e.message) || e) };
				}
			}
			// 二进制：有绝对路径 → 交给 agent 读盘；没有 → 走上传通道
			return { name: name, size: size, fullPath: fullPath, isText: false, isDoc: docExt, upload: !fullPath, orig: file };
		}

		/**
		 * ★ 收件箱 —— 四种输入方式的**统一入口**（拍板 2026-09-28：单框 + 四按钮并排，不做自动判型）。
		 *
		 * 分工（依据 outputs/四种输入方式产出规范-v1.md）：
		 *   方式 1 竞品分析   → 跑 sr-analysis（有决策门、有花费）
		 *   方式 2 问答式访谈 → 跑 sr-concept（有决策门、有花费）
		 *   方式 3 旧文档导入 → 只登记进 inbox/imported/（不跑 skill）
		 *   方式 4 人工补充   → 只登记进 inbox/manual/（不跑 skill）
		 *
		 * ★ 这个组件**不判断你输入的是哪一种** —— 四个按钮就是分类，按哪个就走哪条。
		 *   工作台读不到工作区文件系统之外的东西，也不猜你的意图。
		 */
		function IntakeBox(props) {
			const [raw, setRaw] = React.useState("");
			const [note, setNote] = React.useState("");
			const [files, setFiles] = React.useState([]);
			const [busyId, setBusyId] = React.useState("");
			const [msg, setMsg] = React.useState(null);
			const [drag, setDrag] = React.useState(false);
			const fileRef = React.useRef(null);

			if (!contract) {
				return h("div", {
					style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.bad, background: "#fff", borderRadius: "4px", padding: "10px 12px", marginBottom: "12px", fontSize: "12px", color: C.bad }
				}, "收件箱逻辑没加载上（intake-parse.js）：" + (contractErr || "未知原因") + "　—— 其余屏不受影响。");
			}

			const materials = contract.parseMaterials(raw);
			const pathMats = materials.filter((m) => m.kind !== "text");
			const textMats = materials.filter((m) => m.kind === "text");
			const fullPathCount = files.filter((f) => f.fullPath).length;
			const noPath = files.filter((f) => !f.fullPath).map((f) => f.name);
			const derived = contract.deriveTopic(materials.concat(
				files.filter((f) => f.fullPath).map((f) => ({ kind: "file", path: f.fullPath }))
			));
			const noteAuto = note.trim() === "" && textMats.length > 0;
			const effectiveNote = noteAuto
				? textMats.map((m) => m.text).join("\n\n")
				: note;

			const addFiles = (list) => {
				const arr = [];
				for (const f of list) arr.push(f);
				if (arr.length === 0) return;
				setMsg(null);
				Promise.all(arr.map(ingestFile)).then((out) => setFiles((cur) => cur.concat(out)));
			};

			const removeFile = (i) => setFiles((cur) => cur.filter((_, k) => k !== i));

			const go = (id) => {
				if (busyId) return;
				setBusyId(id);
				setMsg(null);
				// ★ 必须接住**同步**抛错：submitIntake 是 async 函数、本身不会同步抛，
				//   但 handler 万一被换成同步实现，异常会跳过 .then 让 busyId 永久卡住（按钮全灰）。
				let p;
				try {
					p = props.onSubmit({
						kind: id,
						materials: materials,
						topic: derived,
						note: effectiveNote,
						files: files,
						upstream: ""
					});
				} catch (e) {
					setBusyId("");
					setMsg({ ok: false, text: "提交失败（同步抛错）：" + String((e && e.message) || e) });
					return;
				}
				Promise.resolve(p).then((r) => {
					setBusyId("");
					if (r && r.ok) {
						setMsg({ ok: true, text: r.note });
						setRaw("");
						setNote("");
						setFiles([]);
					} else {
						setMsg({ ok: false, text: (r && r.note) || "没能发出指令。" });
					}
				}, (e) => { setBusyId(""); setMsg({ ok: false, text: "失败：" + String((e && e.message) || e) }); });
			};

			const zone = {
				border: "1px dashed " + (drag ? C.ink : C.soft),
				background: drag ? "#f2f2f2" : "#fff",
				borderRadius: "4px", padding: "9px 11px", marginTop: "8px",
				fontSize: "11px", color: C.muted, textAlign: "center", cursor: "pointer"
			};

			const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

			return h("div", {
				key: "intake",
				style: { border: "1px solid " + C.ink, borderRadius: "6px", padding: "12px 14px", marginBottom: "13px", background: "#fff" }
			}, [
				h("div", { key: "hd", style: { display: "flex", alignItems: "baseline", gap: "9px", flexWrap: "wrap", marginBottom: "8px" } }, [
					h("span", { key: "t", style: { fontSize: "13px", fontWeight: 600 } }, "收件箱"),
					h("span", { key: "s", style: { fontSize: "11px", color: C.muted } },
						"四种输入方式都从这里进 —— 按你要做的那一种，别猜它算哪类")
				]),

				h("textarea", {
					key: "raw", value: raw, rows: 3,
					placeholder: "粘路径 / 贴链接 / 直接写一段话（多个路径请各占一行）",
					onChange: (e) => { setRaw(e.target.value); setMsg(null); },
					style: {
						width: "100%", boxSizing: "border-box", fontSize: "12px", lineHeight: 1.7,
						padding: "7px 9px", border: "1px solid " + C.soft, borderRadius: "4px",
						outline: "none", resize: "vertical", fontFamily: "inherit", background: "#fff"
					}
				}),

				h("div", {
					key: "zone", style: zone,
					onClick: () => { if (fileRef.current) fileRef.current.click(); },
					onDragOver: (e) => { e.preventDefault(); if (!drag) setDrag(true); },
					onDragLeave: () => setDrag(false),
					onDrop: (e) => {
						e.preventDefault(); setDrag(false);
						const dt = e.dataTransfer;
						if (dt && dt.files && dt.files.length > 0) addFiles(dt.files);
					}
				}, "把文件 / 文件夹拖到这里，或点这里选择文件（文本类自动读成内容；其余记路径，由 agent 去读）"),

				h("input", {
					key: "fi", type: "file", multiple: true, ref: fileRef,
					style: { display: "none" },
					onChange: (e) => { addFiles(e.target.files || []); e.target.value = ""; }
				}),

				files.length > 0 ? h("div", { key: "fl", style: { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "7px" } },
					files.map((f, i) => h("span", {
						key: "f" + i,
						style: {
							display: "inline-flex", alignItems: "center", gap: "6px",
							fontSize: "11px", padding: "3px 8px", borderRadius: "12px",
							border: "1px solid " + (f.err ? C.bad : C.soft),
							background: f.err ? "#fff" : "#f7f7f7", color: f.err ? C.bad : C.ink
						}
					}, [
						h("span", { key: "n" }, f.name + "　" + (f.size ? kb(f.size) : "大小未知") +
							(f.isText ? "　已读入" : f.fullPath ? "　记路径" : "　上传")),
						h("button", {
							key: "x", type: "button", onClick: () => removeFile(i),
							style: { font: "inherit", border: "none", background: "transparent", cursor: "pointer", color: C.muted, padding: 0 }
						}, "✕")
					])) ) : null,

				h("input", {
					key: "nt", value: note, placeholder: "备注 / 分析目标 / 正文（可空；空则自动取输入框里的散文）",
					onChange: (e) => { setNote(e.target.value); setMsg(null); },
					style: {
						width: "100%", boxSizing: "border-box", fontSize: "12px", padding: "5px 8px",
						border: "1px solid " + C.soft, borderRadius: "4px", outline: "none",
						background: "#fff", marginTop: "7px"
					}
				}),

				h("div", { key: "meta", style: { fontSize: "11px", color: C.muted, lineHeight: 1.9, marginTop: "6px" } }, [
					h("div", { key: "a" }, "识别到的素材：" + materials.length + " 项（其中路径/链接 " + pathMats.length + " 项，散文 " + textMats.length + " 段）" +
						(files.length > 0 ? "，文件 " + files.length + " 个" : "")),
					h("div", { key: "b" }, "将归档到功能主题：" + (derived || "（还看不出来 —— 给个素材或写一句标题）")),
					noteAuto ? h("div", { key: "c" }, "备注自动取输入框里的散文：" + String(effectiveNote).replace(/\s+/g, " ").slice(0, 80) + (String(effectiveNote).length > 80 ? "…" : "")) : null,
					noPath.length > 0 ? h("div", { key: "d", style: { color: C.warn } }, "⚠ 这些文件拿不到本机路径，只能作为会话附件上传（agent 读不到内容）：" + noPath.join("、")) : null
				]),

				h("div", { key: "btns", style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" } },
					contract.INTAKE_KINDS.map((k) => h("button", {
						key: k.id, type: "button", disabled: !!busyId,
						title: k.needs,
						onClick: () => go(k.id),
						style: {
							font: "inherit", textAlign: "left", cursor: busyId ? "default" : "pointer",
							padding: "7px 11px", borderRadius: "4px",
							border: "1px solid " + (busyId === k.id ? C.ink : C.soft),
							background: busyId === k.id ? C.ink : "#fff",
							color: busyId === k.id ? "#fff" : C.ink
						}
					}, [
						h("div", { key: "l", style: { fontSize: "12px", fontWeight: 600 } },
							(busyId === k.id ? "已发出 · " : "") + k.label),
						h("div", { key: "h", style: { fontSize: "10px", color: busyId === k.id ? "#ddd" : C.muted } }, k.hint)
					]))),

				msg ? h("div", {
					key: "m",
					style: {
						marginTop: "9px", padding: "7px 10px", borderRadius: "4px", fontSize: "11px", lineHeight: 1.85,
						border: "1px solid " + (msg.ok ? C.ok : C.bad), color: msg.ok ? C.ok : C.bad, background: "#fff"
					}
				}, msg.text) : null,

				props.refs ? h("div", {
					key: "rf",
					style: { marginTop: "9px", paddingTop: "8px", borderTop: "1px solid " + C.faint, fontSize: "11px", color: C.muted, lineHeight: 1.9 }
				}, [
					h("div", { key: "a" }, "跑这一趟的下游产物（点开看）："),
					props.refs.map((x, i) => h("div", { key: "r" + i }, [
						h("button", {
							key: "b", type: "button",
							onClick: () => props.onOpenRef(x.abs),
							style: { font: "inherit", fontSize: "11px", border: "none", background: "transparent", color: C.ink, cursor: "pointer", padding: 0, textDecoration: "underline" }
						}, x.label)
					]))
				]) : null
			]);
		}

		/**
		 * B1 · 设计资产列表
		 * 数据源：workspace/design-asset-index.json（由 refresh_asset_index.py 生成）
		 */
		function AssetsPanel(props) {
			const data = props.data;
			const [type, setType] = React.useState("__all__");
			const [rev, setRev] = React.useState("__all__");
			const [q, setQ] = React.useState("");
			const [busy, setBusy] = React.useState(false);
			const [note, setNote] = React.useState(null);
			const [openAsset, setOpenAsset] = React.useState(null);
			const [tool, setTool] = React.useState("");
			const [impPath, setImpPath] = React.useState("");
			const [impNote, setImpNote] = React.useState("");
			const [mTitle, setMTitle] = React.useState("");
			const [mBody, setMBody] = React.useState("");
			const [mUp, setMUp] = React.useState("");
			const onOpen = props.onOpen;
			const onRefresh = props.onRefresh;

			const tbtn = (key, label, active, onPick) => h("button", {
				key: key, type: "button", disabled: busy,
				onClick: onPick,
				style: {
					font: "inherit", fontSize: "12px", padding: "5px 13px",
					border: "1px solid " + (active ? C.ink : C.soft),
					background: active ? C.ink : "#fff",
					color: active ? "#fff" : C.ink,
					borderRadius: "4px", cursor: busy ? "default" : "pointer"
				}
			}, label);

			if (!data) return h("div", { style: { color: C.muted, fontSize: "12px" } }, "正在读资产索引…");

			// 阅读器（B2）
			if (openAsset) {
				return h(AssetReader, {
					asset: openAsset, srWs: data.srWs, read: props.read,
					onBack: () => setOpenAsset(null), onOpen: onOpen
				});
			}
			if (data.error) {
				return h("div", null, [
					h("div", { key: "e", style: { border: "1px solid " + C.bad, borderLeft: "3px solid " + C.bad, background: "#fff", borderRadius: "4px", padding: "10px 12px", fontSize: "12px", color: C.bad, marginBottom: "10px" } }, data.error),
					props.onRefresh ? h("div", { key: "a" }, h("button", {
						type: "button",
						onClick: () => { setBusy(true); setNote(null); props.onRefresh().then((t) => { setBusy(false); setNote(t); }); },
						disabled: busy,
						style: { font: "inherit", fontSize: "12px", padding: "6px 14px", border: "1px solid " + C.ink, background: C.ink, color: "#fff", borderRadius: "4px", cursor: "pointer" }
					}, busy ? "已发出指令，等 agent 跑完…" : "刷新资产索引")) : null,					note ? h("div", { key: "n", style: { marginTop: "9px", fontSize: "12px", color: C.muted } }, note) : null
				]);
			}

			const all = data.assets;
			const byId = {};
			for (const a of all) byId[a.asset_id] = a;

			// 计数
			const typeCounts = {}, revCounts = {};
			for (const a of all) {
				typeCounts[a.asset_type] = (typeCounts[a.asset_type] || 0) + 1;
				revCounts[a.review_status] = (revCounts[a.review_status] || 0) + 1;
			}

			const filtered = all.filter((a) => {
				if (type !== "__all__" && a.asset_type !== type) return false;
				if (rev !== "__all__" && a.review_status !== rev) return false;
				if (q) {
					const hay = (a.asset_id + " " + a.path + " " + (a.title || "")).toLowerCase();
					if (hay.indexOf(q.toLowerCase()) < 0) return false;
				}
				return true;
			}).sort((x, y) => (x.asset_id < y.asset_id ? -1 : 1));

			const chip = (label, count, active, onPick, key) => h("button", {
				key: key, type: "button", onClick: onPick,
				style: {
					font: "inherit", fontSize: "11px", padding: "3px 10px",
					border: "1px solid " + (active ? C.ink : C.faint),
					background: active ? C.ink : "#fff",
					color: active ? "#fff" : C.ink,
					borderRadius: "12px", cursor: "pointer", whiteSpace: "nowrap"
				}
			}, label + (count === void 0 ? "" : " " + count));

			const linkRefs = (refs) => (refs || []).map((r) => {
				const t = byId[r];
				return t ? (ASSET_TYPE_LABEL[t.asset_type] || t.asset_type) + " " + r : r;
			}).join("、");

			return h("div", null, [
				h("div", { key: "sum", style: { fontSize: "12px", color: C.muted, marginBottom: "10px" } },
					"索引 schema " + (data.schemaVersion || "?") + " · 工作区 " + (data.workspaceId || "?") + "　共 " + all.length + " 条资产"),

				// ★ 收件箱：四种输入方式的统一入口（拍板 2026-09-28）
				props.onIntake ? h(IntakeBox, {
					key: "intake",
					onSubmit: props.onIntake,
					refs: props.intakeRefs,
					onOpenRef: onOpen
				}) : null,

				// ↓ 旧的「导入旧文档 / 人工补充」双窗口已并入上面的收件箱；保留代码仅为回退，入口不再显示。
				// 工具栏：三种"改文件"的动作，全部交给 agent（工作台自己写不了文件）
				(onRefresh && tool === "__legacy__") ? h("div", { key: "rf", style: { marginBottom: "11px" } }, [
					h("div", { key: "btns", style: { display: "flex", gap: "7px", flexWrap: "wrap", marginBottom: "7px" } }, [
						tbtn("b1", busy ? "已发出指令…" : "刷新资产索引", tool === "", () => { setTool(""); setNote(null); setBusy(true); props.onRefresh().then((t) => { setBusy(false); setNote(t); }); }),
						tbtn("b2", "导入旧文档", tool === "import", () => { setTool(tool === "import" ? "" : "import"); setNote(null); }),
						tbtn("b3", "人工补充", tool === "manual", () => { setTool(tool === "manual" ? "" : "manual"); setNote(null); })
					]),
					h("div", { key: "hint", style: { fontSize: "11px", color: C.muted } },
						"工作台不自己改文件 —— 这三个动作都只是把意图发给 agent，由它执行")
				]) : null,

				// 方式 3 · 导入旧文档
				tool === "import" ? h("div", {
					key: "imp",
					style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.ink, background: "#fff", borderRadius: "4px", padding: "11px 13px", marginBottom: "11px" }
				}, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "6px" } }, "方式 3 · 导入旧文档"),
					h("div", { key: "d", style: { fontSize: "11px", color: C.muted, lineHeight: 1.8, marginBottom: "8px" } }, [
						h("div", { key: "a" }, "选一个旧方案 / 旧文档所在目录（本机任意位置）。"),
						h("div", { key: "b" }, "导入件放 " + "inbox/imported/" + "，登记为 inbox / 待审，**不提升为正式资产**（旧文档是参考材料，供成稿时按章节对照）。")
					]),
					h("div", { key: "row", style: { display: "flex", gap: "7px", alignItems: "center", flexWrap: "wrap", marginBottom: "7px" } }, [
						h("button", {
							key: "p", type: "button", disabled: busy || !props.onPickDir,
							onClick: () => {
								setBusy(true);
								props.onPickDir().then((r) => {
									setBusy(false);
									if (r && r.ok && r.value) { setImpPath(String(r.value)); setNote(null); }
									else if (r && r.ok && !r.value) setNote("已取消选择。");
									else setNote("选择目录失败：" + humanError(r));
								});
							},
							style: { font: "inherit", fontSize: "12px", padding: "5px 12px", border: "1px solid " + C.ink, background: "#fff", borderRadius: "4px", cursor: "pointer" }
						}, "选择目录…"),
						h("input", {
							key: "i", value: impPath, placeholder: "或直接粘贴目录路径",
							onChange: (e) => setImpPath(e.target.value),
							style: { flex: "1 1 260px", fontSize: "12px", padding: "5px 8px", border: "1px solid " + C.soft, borderRadius: "4px", outline: "none", fontFamily: "monospace", background: "#fff" }
						})
					]),
					h("input", {
						key: "n", value: impNote, placeholder: "备注（可选，例如：V0.3 完整策划案，成稿时按章节对照）",
						onChange: (e) => setImpNote(e.target.value),
						style: { width: "100%", boxSizing: "border-box", fontSize: "12px", padding: "5px 8px", border: "1px solid " + C.soft, borderRadius: "4px", outline: "none", background: "#fff", marginBottom: "8px" }
					}),
					h("button", {
						key: "go", type: "button", disabled: busy || !impPath,
						onClick: () => { setBusy(true); setNote(null); props.onImport(impPath, impNote).then((t) => { setBusy(false); setNote(t); setTool(""); }); },
						style: { font: "inherit", fontSize: "12px", padding: "6px 15px", border: "1px solid " + C.ink, background: busy || !impPath ? "#888" : C.ink, color: "#fff", borderRadius: "4px", cursor: busy || !impPath ? "default" : "pointer" }
					}, "确认导入")
				]) : null,

				// 方式 4 · 人工补充
				tool === "manual" ? h("div", {
					key: "man",
					style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.ink, background: "#fff", borderRadius: "4px", padding: "11px 13px", marginBottom: "11px" }
				}, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "6px" } }, "方式 4 · 人工补充"),
					h("div", { key: "d", style: { fontSize: "11px", color: C.muted, lineHeight: 1.8, marginBottom: "8px" } },
						"写入 inbox/manual/，登记为 inbox / 待审。想到一条规则、边界情况或口径，随手记下来即可 —— 不用先想归类。"),
					h("input", {
						key: "ti", value: mTitle, placeholder: "标题（例如：联盟榜同分时的排序口径）",
						onChange: (e) => setMTitle(e.target.value),
						style: { width: "100%", boxSizing: "border-box", fontSize: "12px", padding: "5px 8px", border: "1px solid " + C.soft, borderRadius: "4px", outline: "none", background: "#fff", marginBottom: "7px" }
					}),
					h("textarea", {
						key: "bo", value: mBody, placeholder: "正文（自由文本）",
						onChange: (e) => setMBody(e.target.value),
						rows: 7,
						style: { width: "100%", boxSizing: "border-box", fontSize: "12px", lineHeight: 1.7, padding: "7px 9px", border: "1px solid " + C.soft, borderRadius: "4px", outline: "none", background: "#fff", resize: "vertical", fontFamily: "inherit", marginBottom: "7px" }
					}),
					h("div", { key: "up", style: { display: "flex", gap: "7px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" } }, [
						h("span", { key: "l", style: { fontSize: "11px", color: C.muted } }, "补充的是哪份资产（可选）"),
						h("select", {
							key: "s", value: mUp, onChange: (e) => setMUp(e.target.value),
							style: { flex: "1 1 280px", fontSize: "12px", padding: "4px 7px", border: "1px solid " + C.soft, borderRadius: "4px", background: "#fff" }
						}, [
							h("option", { key: "", value: "" }, "（不指定）"),
							...all.filter((a) => a.asset_type !== "inbox").map((a) =>
								h("option", { key: a.asset_id, value: a.asset_id }, a.asset_id + "　" + String(a.path)))
						])
					]),
					h("button", {
						key: "go", type: "button", disabled: busy || !mTitle.trim() || !mBody.trim(),
						onClick: () => {
							setBusy(true); setNote(null);
							props.onManual(mTitle.trim(), mBody, mUp).then((t) => {
								setBusy(false); setNote(t); setTool(""); setMTitle(""); setMBody(""); setMUp("");
							});
						},
						style: { font: "inherit", fontSize: "12px", padding: "6px 15px", border: "1px solid " + C.ink, background: busy || !mTitle.trim() || !mBody.trim() ? "#888" : C.ink, color: "#fff", borderRadius: "4px", cursor: "pointer" }
					}, "保存到收集箱")
				]) : null,

				note ? h("div", { key: "nt", style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.ok, background: "#fff", borderRadius: "4px", padding: "8px 11px", fontSize: "12px", marginBottom: "11px", color: C.ok } }, note) : null,

				// 筛选
				h("div", { key: "f1", style: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "7px" } }, [
					chip("全部", all.length, type === "__all__", () => setType("__all__"), "t0"),
					...Object.keys(typeCounts).sort().map((k) => chip(ASSET_TYPE_LABEL[k] || k, typeCounts[k], type === k, () => setType(k), "t" + k))
				]),
				h("div", { key: "f2", style: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "9px", alignItems: "center" } }, [
					chip("全部审核态", void 0, rev === "__all__", () => setRev("__all__"), "r0"),
					...Object.keys(revCounts).sort().map((k) => chip(REVIEW_LABEL[k] || k, revCounts[k], rev === k, () => setRev(k), "r" + k)),
					h("input", {
						key: "q", value: q, placeholder: "搜索 id / 路径 / 标题…",
						onChange: (e) => setQ(e.target.value),
						style: {
							flex: "1 1 180px", maxWidth: "280px", fontSize: "12px", padding: "3px 8px",
							border: "1px solid " + C.soft, borderRadius: "12px", outline: "none", background: "#fff"
						}
					}),
					h("span", { key: "n", style: { fontSize: "11px", color: C.muted } }, "显示 " + filtered.length + " / " + all.length)
				]),

				// 列表
				filtered.length ? h("div", { key: "list", style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", overflow: "hidden" } },
					filtered.map((a, i) => {
						const tone = REVIEW_TONE[a.review_status] === void 0 ? null : REVIEW_TONE[a.review_status];
						const refs = [];
						if (a.supersedes && a.supersedes.length) refs.push("取代 " + linkRefs(a.supersedes));
						if (a.upstream_assets && a.upstream_assets.length) refs.push("上游 " + linkRefs(a.upstream_assets));
						if (a.downstream_assets && a.downstream_assets.length) refs.push("下游 " + linkRefs(a.downstream_assets));
						return h("div", {
							key: a.asset_id || i,
							style: { padding: "8px 11px", borderTop: i ? "1px solid " + C.faint : "none" }
						}, [
							h("div", { key: "r1", style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" } }, [
								h("span", { key: "id", style: { fontFamily: "monospace", fontSize: "11px", color: C.muted, minWidth: "150px" } }, String(a.asset_id || "")),
								badge(ASSET_TYPE_LABEL[a.asset_type] || a.asset_type, null),
								a.review_status ? badge(REVIEW_LABEL[a.review_status] || a.review_status, tone) : null,
								a.format ? badge(a.format, null) : null,
								a.source_skill ? h("span", { key: "sk", style: { fontSize: "10px", color: C.muted, fontFamily: "monospace" } }, a.source_skill) : null
							]),
							h("div", { key: "r2", style: { marginTop: "3px" } }, h("button", {
								type: "button",
								onClick: () => setOpenAsset(a),
								title: "在面板里阅读：" + a.path,
								style: {
									font: "inherit", fontSize: "12px", fontFamily: "monospace", padding: 0,
									border: "none", background: "none", color: "#3b6ea5", cursor: "pointer",
									textAlign: "left", maxWidth: "100%", overflow: "hidden",
									textOverflow: "ellipsis", whiteSpace: "nowrap"
								}
							}, String(a.path || ""))),
							refs.length ? h("div", { key: "r3", style: { marginTop: "3px", fontSize: "11px", color: C.muted } }, refs.join("　·　")) : null
						]);
					})) : h("div", { key: "none", style: { color: C.muted, fontSize: "12px" } }, "没有匹配的资产。"),

				h("div", { key: "foot", style: { marginTop: "12px", fontSize: "11px", color: C.muted, lineHeight: 1.85 } }, [
					h("div", { key: "a" }, "资产索引由 scripts/refresh_asset_index.py 生成；工作台只读它，不自己维护。"),
					h("div", { key: "b" }, "扫描范围：analysis / decisions / evidence / proposals 四个目录。运行包与副本不在索引内。")
				])
			]);
		}

		// ── 内容阅读器（B2）──────────────────────────────────────────
		/** 按扩展名判类型 */
		function extOf(p) {
			const m = /\.([A-Za-z0-9]+)$/.exec(String(p || ""));
			return m ? m[1].toLowerCase() : "";
		}
		const IMG_EXT = { png: 1, jpg: 1, jpeg: 1, gif: 1, webp: 1, svg: 1, bmp: 1 };
		const MD_EXT = { md: 1, markdown: 1 };
		const JSON_EXT = { json: 1 };
		const TEXT_EXT = { txt: 1, yml: 1, yaml: 1, csv: 1, py: 1, js: 1, ts: 1, html_: 1 };

		/** 值 → 一行短文本 */
		function shortVal(v) {
			if (v === null) return "null";
			if (v === void 0) return "—";
			if (typeof v === "boolean") return v ? "true" : "false";
			if (typeof v === "number") return String(v);
			if (typeof v === "string") return v;
			if (Array.isArray(v)) return "[" + v.length + " 项]";
			return "{" + Object.keys(v).length + " 个字段}";
		}
		const isScalar = (v) => v === null || typeof v !== "object";
		const isObjArray = (v) => Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && !Array.isArray(x));

		/**
		 * 通用「可读 JSON」渲染器 —— 这是"json 不方便阅读"的正解。
		 * 标量成行 / 对象成节 / 对象数组成表 / 长文本成块。
		 */
		function ReadableJson(props) {
			const v = props.value;
			const depth = props.depth || 0;
			const pad = 12 + depth * 12;

			if (isScalar(v)) {
				return h("div", { style: { fontSize: "12px", lineHeight: 1.75, whiteSpace: "pre-wrap", wordBreak: "break-word" } }, shortVal(v));
			}
			if (Array.isArray(v)) {
				if (v.length === 0) return h("div", { style: { fontSize: "12px", color: C.muted } }, "（空）");
				if (isObjArray(v)) {
					const keys = [];
					for (const it of v) for (const k of Object.keys(it)) if (keys.indexOf(k) < 0) keys.push(k);
					return h("div", { style: { overflowX: "auto" } }, h("table", { style: { borderCollapse: "collapse", width: "100%", fontSize: "11px" } }, [
						h("thead", { key: "h" }, h("tr", null, keys.map((k) => h("th", {
							key: k, style: { border: "1px solid " + C.faint, background: C.bg, padding: "4px 7px", textAlign: "left", whiteSpace: "nowrap" }
						}, k)))),
						h("tbody", { key: "b" }, v.map((it, i) => h("tr", { key: i }, keys.map((k) => {
							const cell = it[k];
							return h("td", {
								key: k,
								style: { border: "1px solid " + C.faint, padding: "4px 7px", verticalAlign: "top", maxWidth: "320px" }
							}, isScalar(cell)
								? h("span", { style: { whiteSpace: "pre-wrap", wordBreak: "break-word" } }, shortVal(cell))
								: h("span", { style: { color: C.muted } }, shortVal(cell)));
						}))))
					]));
				}
				return h("div", { style: { display: "flex", flexDirection: "column", gap: "4px" } },
					v.map((x, i) => h("div", { key: i, style: { display: "flex", gap: "7px" } }, [
						h("span", { key: "i", style: { color: C.muted, fontFamily: "monospace", fontSize: "11px" } }, String(i + 1) + "."),
						h("span", { key: "v", style: { flex: "1 1 auto" } }, isScalar(x)
							? h("span", { style: { fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word" } }, shortVal(x))
							: h(ReadableJson, { value: x, depth: depth + 1 }))
					])));
			}
			// 对象
			const keys = Object.keys(v);
			if (!keys.length) return h("div", { style: { fontSize: "12px", color: C.muted } }, "（空对象）");
			return h("div", null, keys.map((k) => {
				const val = v[k];
				const scalar = isScalar(val);
				return h("div", {
					key: k,
					style: { display: "flex", gap: "9px", paddingLeft: pad + "px", marginBottom: "3px", alignItems: "flex-start" }
				}, [
					h("span", {
						key: "k",
						style: {
							fontSize: "11px", fontFamily: "monospace", color: C.muted,
							minWidth: "120px", flex: "0 0 auto", paddingTop: scalar ? "1px" : "0"
						}
					}, k),
					h("span", { key: "v", style: { flex: "1 1 auto", minWidth: 0 } }, scalar
						? h("span", {
							style: {
								fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-word",
								display: "block", lineHeight: 1.7
							}
						}, shortVal(val))
						: h(ReadableJson, { value: val, depth: depth + 1 }))
				]);
			}));
		}

		/** 单个资产的内容阅读器（B2）*/
		function AssetReader(props) {
			const a = props.asset;
			const srWs = props.srWs || "";
			const onBack = props.onBack;
			const onOpen = props.onOpen;
			const [text, setText] = React.useState(void 0);   // undefined=加载中 null=读不到
			const [docDir, setDocDir] = React.useState("");
			const read = props.read;

			const abs = a ? srWs + "/" + a.path : "";
			const ext = extOf(a ? a.path : "");

			React.useEffect(() => {
				if (!a || !read || !srWs) { setText(null); return; }
				if (IMG_EXT[ext]) { setText(""); return; }        // 图片不需要读文本
				let cancelled = false;
				setText(void 0);
				const dir = String(a.path).replace(/[^\\/]+$/, "");
				setDocDir(dir);
				read(srWs + "/" + a.path).then(
					(t) => { if (!cancelled) setText(t); },
					() => { if (!cancelled) setText(null); }
				);
				return () => { cancelled = true; };
			}, [a ? a.asset_id : "", a ? a.path : "", srWs]);

			if (!a) return null;

			const body = [];

			// 图片
			if (IMG_EXT[ext]) {
				body.push(h("img", {
					key: "img", src: fileUrl(abs), alt: a.path,
					style: { maxWidth: "100%", border: "1px solid " + C.faint, borderRadius: "4px", background: C.bg, display: "block" }
				}));
			}
			// HTML：/api/file 带 `CSP: sandbox; default-src 'none'`，内嵌会变成无样式文本 → 不内嵌
			else if (ext === "html" || ext === "htm") {
				body.push(h("div", {
					key: "html",
					style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn, background: "#fffdf7", borderRadius: "4px", padding: "11px 13px", fontSize: "12px", lineHeight: 1.8 }
				}, [
					h("div", { key: "a" }, "HTML 交付物不在面板里内嵌渲染。"),
					h("div", { key: "b", style: { color: C.muted } },
						"原因：/api/file 路由带 `Content-Security-Policy: sandbox; default-src 'none'`，内嵌会丢掉全部样式。"),
					h("div", { key: "c", style: { color: C.muted } }, "点上面的「用默认程序打开」会在浏览器里正常显示。")
				]));
			}
			// markdown —— 按产出规范渲染（有规范走 SpecMdView，没有才按原文）
			else if (MD_EXT[ext] && typeof text === "string") {
				const absDir = srWs + (docDir ? "/" + String(docDir).replace(/\/$/, "") : "");
				const pathImages = {
					resolve: (v) => {
						if (!v || typeof v !== "string") return void 0;
						if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(v)) return void 0;
						const isAbs = /^[A-Za-z]:[\\/]/.test(v) || v.charAt(0) === "/";
						return fileUrl(isAbs ? v : absDir.replace(/[\\/]+$/, "") + "/" + v);
					}
				};
				const spec = mdSpecOf(a.path);
				body.push(h("div", {
					key: "note",
					style: {
						fontSize: "11px", marginBottom: "9px", padding: "6px 10px",
						border: "1px solid " + C.faint, borderLeft: "3px solid " + (spec ? C.ok : C.soft),
						background: spec ? "#f0fdf4" : C.bg, borderRadius: "4px", color: spec ? C.ok : C.muted
					}
				}, spec
					? "按产出规范渲染 · " + spec.name + "（治理/备料/样本元信息已折叠；未见过的章节收进「其他章节」不会丢）"
					: "这类产出还没有规范，按原文渲染"));
				body.push(spec
					? h(SpecMdView, { key: "md", text: text, spec: spec, pathImages: pathImages })
					: h(Md, { key: "md", text: text, pathImages: pathImages }));
			}
			// JSON / JSONL
			else if ((JSON_EXT[ext] || ext === "jsonl") && typeof text === "string") {
				if (ext === "jsonl") {
					const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
					body.push(h("div", { key: "l", style: { fontSize: "11px", color: C.muted, marginBottom: "7px" } }, rows.length + " 行"));
					body.push(h("div", { key: "r" }, rows.map((l, i) => {
						let v = null, bad = false;
						try { v = JSON.parse(l); } catch (e) { bad = true; }
						return h("div", {
							key: i,
							style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "8px 10px", marginBottom: "6px" }
						}, bad
							? h("pre", { style: PRESTYLE }, l)
							: h(ReadableJson, { value: v }));
					})));
				} else {
					let v = null, bad = false;
					try { v = JSON.parse(text); } catch (e) { bad = true; }
					const base = String(a.path).split("/").pop() || "";
					if (bad) {
						body.push(h("div", {
							key: "j",
							style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "11px 13px" }
						}, [h("div", { key: "e", style: { fontSize: "12px", color: C.bad, marginBottom: "6px" } }, "JSON 解析失败，原始文本如下："),
							h("pre", { key: "p", style: PRESTYLE }, text)]));
					} else if (/^issue-cards_/i.test(base)) {
						body.push(h("div", {
							key: "note",
							style: { fontSize: "11px", marginBottom: "9px", padding: "6px 10px", border: "1px solid " + C.faint, borderLeft: "3px solid " + C.ok, background: "#f0fdf4", borderRadius: "4px", color: C.ok }
						}, "按产出规范渲染 · 问题卡（只显示设计相关字段；路径与素材源已省略）"));
						body.push(h(IssueCardsView, { key: "ic", data: v }));
					} else if (/^sr-gdd-handoff_/i.test(base)) {
						body.push(h("div", {
							key: "note",
							style: { fontSize: "11px", marginBottom: "9px", padding: "6px 10px", border: "1px solid " + C.faint, borderLeft: "3px solid " + C.ok, background: "#f0fdf4", borderRadius: "4px", color: C.ok }
						}, "按产出规范渲染 · 交接件（设计核 / 已拍板事实 / 未闭合假设 / 待决问题 / 已闭合假设；路径与 id 收进溯源）"));
						body.push(h(HandoffView, { key: "ho", data: v }));
					} else {
						body.push(h("div", {
							key: "note",
							style: { fontSize: "11px", marginBottom: "9px", padding: "6px 10px", border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn, background: "#fffdf7", borderRadius: "4px", color: C.warn }
						}, "这类 JSON 还没有产出规范，按结构渲染（可能含元数据噪声）"));
						body.push(h("div", {
							key: "j",
							style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "11px 13px" }
						}, h(ReadableJson, { value: v })));
					}
				}
			}
			// 其他文本
			else if (typeof text === "string") {
				body.push(h("pre", { key: "t", style: PRESTYLE }, text.slice(0, 200000)));
			}
			else if (text === void 0) {
				body.push(h("div", { key: "l", style: { color: C.muted, fontSize: "12px" } }, "正在读取…"));
			}
			else {
				body.push(h("div", { key: "n", style: { color: C.muted, fontSize: "12px" } }, "读不到内容（可能不是文本文件）。用默认程序打开试试。"));
			}

			const refLine = [];
			if (a.supersedes && a.supersedes.length) refLine.push("取代 " + a.supersedes.join("、"));
			if (a.upstream_assets && a.upstream_assets.length) refLine.push("上游 " + a.upstream_assets.join("、"));
			if (a.downstream_assets && a.downstream_assets.length) refLine.push("下游 " + a.downstream_assets.join("、"));

			return h("div", null, [
				h("div", { key: "bar", style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" } }, [
					h("button", {
						key: "b", type: "button", onClick: onBack,
						style: { font: "inherit", fontSize: "12px", padding: "4px 11px", border: "1px solid " + C.soft, background: "#fff", borderRadius: "4px", cursor: "pointer" }
					}, "‹ 返回列表"),
					badge(ASSET_TYPE_LABEL[a.asset_type] || a.asset_type, null),
					a.review_status ? badge(REVIEW_LABEL[a.review_status] || a.review_status, REVIEW_TONE[a.review_status]) : null,
					h("button", {
						key: "o", type: "button", onClick: () => onOpen(abs),
						style: { font: "inherit", fontSize: "12px", padding: "4px 11px", border: "1px solid " + C.ink, background: "#fff", borderRadius: "4px", cursor: "pointer" }
					}, "用默认程序打开")
				]),
				h("div", { key: "meta", style: { fontSize: "11px", color: C.muted, marginBottom: "10px", lineHeight: 1.8 } }, [
					h("div", { key: "p", style: { fontFamily: "monospace", wordBreak: "break-all" } }, String(a.asset_id || "") + "　" + a.path),
					a.source_skill ? h("div", { key: "s" }, "来源技能：" + a.source_skill) : null,
					refLine.length ? h("div", { key: "r" }, refLine.join("　·　")) : null
				]),
				...body
			]);
		}
		const PRESTYLE = {
			fontSize: "11px", fontFamily: "monospace", whiteSpace: "pre-wrap",
			wordBreak: "break-word", background: C.bg, border: "1px solid " + C.faint,
			borderRadius: "3px", padding: "10px", margin: 0,
			maxHeight: "70vh", overflow: "auto", userSelect: "text", lineHeight: 1.6
		};

		// ══════════════════════════════════════════════════════════════
		// 产出规范驱动的读取（依据：四种输入方式产出规范-v1.md §五）
		//   三分法：设计信息（显示）/ 元数据（省略）/ 治理自检（折叠）
		//   通用规则：置顶区 → 主体区 → 折叠区（含"未知章节不丢"）
		// ══════════════════════════════════════════════════════════════

		/** 把 md 按 `## ` 切成顶层章节（`###` 子节留在父节体内） */
		function parseMdSections(text) {
			const lines = String(text || "").split(/\r?\n/);
			const out = [];
			let cur = null;
			for (const line of lines) {
				const m = /^(#{1,2})\s+(.*)$/.exec(line);
				if (m && m[1].length === 2) {
					if (cur) out.push(cur);
					cur = { title: m[2].trim(), body: [] };
					continue;
				}
				if (cur) cur.body.push(line);
				// `# ` 一级标题（文档标题）不进章节
			}
			if (cur) out.push(cur);
			return out.map((s) => ({ title: s.title, body: s.body.join("\n").replace(/^\s+|\s+$/g, "") }));
		}

		/** 标题 → 归类；cls: top(置顶) / body(主体) / fold(折叠) / skip(省略) */
		function classifyHeading(title, rules) {
			for (const r of rules) if (r.re.test(title)) return r.cls;
			return null;   // 未知 → 收进「其他章节」，绝不丢弃
		}

		// 每种产出的章节规范（正则按真实标题写，见规范文档 §二 §三）
		const MD_SPECS = [
			{
				name: "体验报告", match: /^experience-report_/i, sections: [
					{ re: /一句话总评/, cls: "top" },
					{ re: /是否值得复刻/, cls: "top" },
					{ re: /核心机制拆解/, cls: "body" },
					{ re: /功能账本/, cls: "body" },
					{ re: /问题列表与问题卡/, cls: "body" },
					{ re: /画面序列拆解/, cls: "body" },
					{ re: /验证计划/, cls: "body" },
					{ re: /样本边界门|决策声明|品类路由|工具与访问状态/, cls: "fold" },
					{ re: /治理检查/, cls: "fold" },
					{ re: /样本元信息|结构化输出/, cls: "skip" }
				]
			},
			{
				name: "复刻规格", match: /^replication-spec_/i, sections: [
					{ re: /待裁决取舍清单/, cls: "top" },
					{ re: /迁移边界/, cls: "top" },
					{ re: /功能规则候选/, cls: "body" },
					{ re: /UI 结构与交互流程/, cls: "body" },
					{ re: /数值表现/, cls: "fold" },
					{ re: /推断配置项/, cls: "fold" },
					{ re: /样本边界/, cls: "fold" }
				]
			},
			{
				name: "设计核三角报告", match: /^concept-triage_/i, sections: [
					{ re: /Design Nucleus Options/, cls: "top" },
					{ re: /Assumption Ledger/, cls: "top" },
					{ re: /Original Idea/, cls: "body" },
					{ re: /Concept Seed Extraction/, cls: "body" },
					{ re: /Player Verb Inventory/, cls: "body" },
					{ re: /Action-Goal Alignment/, cls: "body" },
					{ re: /Recommended Next Step/, cls: "body" },
					{ re: /Case Visibility|External Evidence Status|Quality Gate/, cls: "fold" },
					{ re: /治理引用/, cls: "skip" }
				]
			},
			{
				name: "功能设计稿", match: /^feature-concept_/i, sections: [
					{ re: /Player Promise/, cls: "top" },
					{ re: /Core Loop/, cls: "top" },
					{ re: /Validation Plan/, cls: "top" },
					{ re: /Key Systems/, cls: "body" },
					{ re: /Uncertainty Calibration/, cls: "body" },
					{ re: /Scope Gate/, cls: "body" },
					{ re: /Assumption Ledger/, cls: "body" },
					{ re: /Risk Register/, cls: "body" },
					{ re: /下一步/, cls: "body" },
					{ re: /Production Feasibility/, cls: "fold" },
					{ re: /配置项预测/, cls: "fold" }
				]
			},
			{
				name: "证据索引", match: /^evidence-index_/i, sections: [
					{ re: /Evidence Index/, cls: "top" },
					{ re: /置信度说明/, cls: "body" },
					{ re: /时间戳账本/, cls: "fold" }
				]
			},
			{
				name: "读回验收报告", match: /^readback_/i, sections: [
					{ re: /结论/, cls: "top" },
					{ re: /必达项对照/, cls: "body" },
					{ re: /追加项/, cls: "fold" },
					{ re: /报告头/, cls: "fold" }
				]
			}
		];

		function mdSpecOf(path) {
			const name = String(path || "").split("/").pop() || "";
			for (const s of MD_SPECS) if (s.match.test(name)) return s;
			return null;
		}

		/** 一段 markdown（用 DSH 的 MarkdownText；取不到则降级 <pre>） */
		function Md(props) {
			const text = props.text || "";
			if (primitives && primitives.MarkdownText) {
				return h("div", { style: { fontSize: "13px", lineHeight: 1.85, color: C.ink } },
					h(primitives.MarkdownText, { text: text, pathImages: props.pathImages }));
			}
			return h("pre", { style: PRESTYLE }, text);
		}

		function SectionBlock(props) {
			const s = props.section;
			return h("div", { key: props.k, style: { marginBottom: "14px" } }, [
				h("div", {
					key: "h",
					style: {
						fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: C.ink,
						borderBottom: "1px solid " + C.faint, paddingBottom: "4px"
					}
				}, s.title),
				h(Md, { key: "b", text: s.body, pathImages: props.pathImages })
			]);
		}

		/**
		 * 按规范渲染一份 markdown 产出：
		 * 置顶区 → 主体区 → 折叠区（治理/备料）→「其他章节」（未知的不丢）
		 */
		function SpecMdView(props) {
			const text = props.text;
			const spec = props.spec;
			const pathImages = props.pathImages;
			const [open, setOpen] = React.useState({});

			const sections = parseMdSections(text);
			if (!sections.length) return h("pre", { style: PRESTYLE }, text);

			const top = [], body = [], fold = [], unknown = [];
			for (const s of sections) {
				const cls = classifyHeading(s.title, spec ? spec.sections : []);
				if (cls === "skip") continue;
				if (cls === "top") top.push(s);
				else if (cls === "body") body.push(s);
				else if (cls === "fold") fold.push(s);
				else unknown.push(s);      // ★ 未知章节不丢
			}

			const foldGroup = (label, items, keyPrefix, tone) => items.length ? h("div", {
				key: keyPrefix,
				style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", marginBottom: "9px", overflow: "hidden" }
			}, [
				h("div", {
					key: "h",
					onClick: () => setOpen((o) => { const n = {}; for (const k in o) n[k] = o[k]; n[keyPrefix] = !o[keyPrefix]; return n; }),
					style: {
						display: "flex", justifyContent: "space-between", alignItems: "center",
						padding: "7px 11px", background: C.bg, cursor: "pointer",
						borderBottom: open[keyPrefix] ? "1px solid " + C.faint : "none"
					}
				}, [
					h("span", { key: "t", style: { fontSize: "11px", color: tone || C.muted } }, label + "（" + items.length + " 节）"),
					h("span", { key: "g", style: { fontSize: "10px", color: C.muted } }, open[keyPrefix] ? "收起 ▾" : "展开 ▸")
				]),
				open[keyPrefix] ? h("div", { key: "b", style: { padding: "10px 11px" } },
					items.map((s, i) => h(SectionBlock, { key: i, k: keyPrefix + i, section: s, pathImages: pathImages }))) : null
			]) : null;

			return h("div", null, [
				// 置顶区
				top.length ? h("div", {
					key: "top",
					style: {
						border: "1px solid " + C.faint, borderLeft: "3px solid " + C.ink,
						background: "#fff", borderRadius: "4px", padding: "11px 13px", marginBottom: "12px"
					}
				}, top.map((s, i) => h(SectionBlock, { key: i, k: "top" + i, section: s, pathImages: pathImages }))) : null,
				// 主体区
				body.map((s, i) => h(SectionBlock, { key: i, k: "b" + i, section: s, pathImages: pathImages })),
				// 折叠区
				foldGroup("治理 / 自检 / 备料", fold, "fold"),
				foldGroup("其他章节（未在规范白名单内，保留不丢）", unknown, "unk", C.warn)
			]);
		}

		/** 问题卡（issue-cards_*.json 规范） */
		function IssueCardsView(props) {
			const d = props.data || {};
			const meta = d.meta || {};
			const cards = Array.isArray(d.issue_cards) ? d.issue_cards : [];
			const unc = Array.isArray(d.uncertain_observations) ? d.uncertain_observations : [];
			const row = (k, v, color) => v ? h("div", { key: k, style: { display: "flex", gap: "9px", fontSize: "12px", lineHeight: 1.8 } }, [
				h("span", { key: "k", style: { color: C.muted, minWidth: "78px", flex: "0 0 auto" } }, k),
				h("span", { key: "v", style: { color: color || C.ink, flex: "1 1 auto", whiteSpace: "pre-wrap", wordBreak: "break-word" } }, v)
			]) : null;
			return h("div", null, [
				h("div", { key: "m", style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", padding: "10px 13px", marginBottom: "12px" } }, [
					row("主题", (meta.topic || "") + (meta.date ? "　" + meta.date : "")),
					row("诊断包", meta.diagnosis_pack),
					row("分析视角", (meta.analysis_modes || []).join(" · ")),
					row("样本边界", meta.sample_boundary),
					row("置信上限", meta.confidence_cap, C.warn)
				]),
				...cards.map((c, i) => h("div", {
					key: i,
					style: {
						border: "1px solid " + C.faint,
						borderLeft: "3px solid " + (c.priority === "P1" ? C.bad : c.priority === "P2" ? C.warn : C.soft),
						borderRadius: "4px", background: "#fff", padding: "10px 13px", marginBottom: "9px"
					}
				}, [
					h("div", { key: "h", style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" } }, [
						badge(String(c.priority || ""), c.priority === "P1" ? "bad" : c.priority === "P2" ? "warn" : null),
						h("span", { key: "i", style: { fontFamily: "monospace", fontSize: "11px", color: C.muted } }, String(c.issue_id || "")),
						c.owner ? badge(c.owner, null) : null,
						c.unsupported_by_sample ? badge("无样本支持", "warn") : null
					]),
					cardRow("症状", c.symptom, C.ink),
					cardRow("根因假设", c.root_cause_hypothesis),
					cardRow("影响", c.impact),
					cardRow("修法", c.fix_action, C.ok),
					c.validation ? h("div", { key: "v", style: { marginTop: "5px", borderTop: "1px solid " + C.faint, paddingTop: "5px" } }, [
						h("div", { key: "t", style: { fontSize: "11px", color: C.muted, marginBottom: "2px" } }, "验证方案"),
						h("div", { key: "b", style: { fontSize: "12px", lineHeight: 1.8, paddingLeft: "9px" } }, [
							cardRow("指标", c.validation.metric, C.ink, true),
							cardRow("方法", c.validation.method, C.ink, true),
							cardRow("通过线", c.validation.pass_threshold, C.ok, true),
							cardRow("停止条件", c.validation.stop_condition, C.bad, true)
						])
					]) : null,
					(c.evidence_refs && c.evidence_refs.length) ? h("div", { key: "e", style: { marginTop: "5px", fontSize: "11px", color: C.muted, fontFamily: "monospace" } },
						"证据：" + c.evidence_refs.join("　")) : null
				])),
				unc.length ? h("div", { key: "u", style: { border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn, background: "#fffdf7", borderRadius: "4px", padding: "10px 13px" } }, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "5px" } }, "不确定观察（" + unc.length + "）"),
					...unc.map((u, i) => h("div", { key: i, style: { fontSize: "12px", lineHeight: 1.8 } }, [
						h("span", { key: "i", style: { fontFamily: "monospace", fontSize: "11px", color: C.muted } }, String(u.evidence_id || "") + "　"),
						h("span", { key: "n" }, String(u.note || ""))
					]))
				]) : null
			]);
		}
		function cardRow(k, v, color, compact) {
			if (!v) return null;
			return h("div", { key: k, style: { display: "flex", gap: "8px", fontSize: compact ? "11px" : "12px", lineHeight: 1.8, alignItems: "flex-start" } }, [
				h("span", { key: "k", style: { color: C.muted, minWidth: compact ? "52px" : "60px", flex: "0 0 auto" } }, k),
				h("span", { key: "v", style: { color: color || C.ink, flex: "1 1 auto", whiteSpace: "pre-wrap", wordBreak: "break-word" } }, String(v))
			]);
		}

		/** 交接件（sr-gdd-handoff_*.json 规范）：5 区块，其余折叠 */
		function HandoffView(props) {
			const d = props.data || {};
			const [showSrc, setShowSrc] = React.useState(false);
			const nucleus = d.chosen_nucleus || {};
			const al = d.assumption_ledger || {};
			const facts = Array.isArray(d.calibrated_facts) ? d.calibrated_facts : [];
			const openA = Array.isArray(al.open) ? al.open : [];
			const closedA = Array.isArray(al.closed) ? al.closed : [];
			const questions = Array.isArray(d.open_questions_for_gdd) ? d.open_questions_for_gdd : [];
			const materials = d.materials || {};

			const block = (key, title, tone, children) => children ? h("div", {
				key: key,
				style: {
					border: "1px solid " + C.faint,
					borderLeft: "3px solid " + (tone || C.soft),
					borderRadius: "4px", background: "#fff", padding: "10px 13px", marginBottom: "10px"
				}
			}, [
				h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, marginBottom: "6px" } }, title),
				...children
			]) : null;

			return h("div", null, [
				h("div", { key: "top", style: { fontSize: "12px", color: C.muted, marginBottom: "10px" } },
					(d.topic || "") + "　" + (d.source_skill || "") + " → " + (d.target_skill || "")),

				// ① 设计核
				block("n", "① 设计核" + (nucleus.id ? "（" + nucleus.id + "）" : ""), C.ink, [
					nucleus.statement ? h("div", { key: "s", style: { fontSize: "13px", lineHeight: 1.85, marginBottom: "6px" } }, String(nucleus.statement)) : null,
					cardRow("核心张力", nucleus.key_tension),
					cardRow("组合", nucleus.combination),
					nucleus.kill_signal ? h("div", {
						key: "k",
						style: { marginTop: "6px", borderTop: "1px solid " + C.faint, paddingTop: "6px", fontSize: "12px", lineHeight: 1.8, color: C.bad }
					}, [h("span", { key: "l", style: { color: C.muted } }, "Kill Signal　"), String(nucleus.kill_signal)]) : null
				]),

				// ② 已拍板事实
				block("f", "② 已拍板事实（" + facts.length + "）", C.ok,
					facts.map((t, i) => h("div", { key: i, style: { fontSize: "12px", lineHeight: 1.85, marginBottom: "4px", paddingLeft: "9px", borderLeft: "2px solid " + C.faint } }, String(t)))),

				// ③ 未闭合假设
				block("o", "③ 未闭合假设（" + openA.length + "）", C.warn,
					openA.map((a, i) => h("div", { key: i, style: { fontSize: "12px", lineHeight: 1.8, marginBottom: "7px" } }, [
						h("div", { key: "d" }, [
							h("span", { key: "i", style: { fontFamily: "monospace", color: C.muted } }, String(a.id || "") + "　"),
							h("span", { key: "t" }, String(a.desc || ""))
						]),
						h("div", { key: "m", style: { marginLeft: "9px", color: C.muted, fontSize: "11px" } },
							"影响 " + String(a.impact || "?") + "　·　怎么验：" + String(a.validate || "?"))
					]))),

				// ④ 待决问题
				block("q", "④ 留给成稿的待决问题（" + questions.length + "）", C.ink,
					questions.map((t, i) => h("div", { key: i, style: { fontSize: "12px", lineHeight: 1.85, marginBottom: "4px" } }, "· " + String(t)))),

				// ⑤ 已闭合假设（一行带过）
				closedA.length ? h("div", { key: "c", style: { fontSize: "11px", color: C.muted, marginBottom: "10px" } },
					"⑤ 已闭合假设：" + closedA.join("、")) : null,

				d.next_step ? h("div", { key: "ns", style: { fontSize: "12px", lineHeight: 1.8, marginBottom: "10px" } }, [
					h("span", { key: "l", style: { color: C.muted } }, "下一步　"),
					String(d.next_step)
				]) : null,

				// 溯源（折叠）
				h("div", { key: "src", style: { border: "1px solid " + C.faint, borderRadius: "4px", background: C.bg, overflow: "hidden" } }, [
					h("div", {
						key: "h",
						onClick: () => setShowSrc(!showSrc),
						style: { padding: "7px 11px", cursor: "pointer", display: "flex", justifyContent: "space-between", fontSize: "11px", color: C.muted }
					}, [h("span", { key: "t" }, "溯源（路径 / id / 引用）"), h("span", { key: "g" }, showSrc ? "收起 ▾" : "展开 ▸")]),
					showSrc ? h("div", { key: "b", style: { padding: "0 11px 10px", fontSize: "11px", fontFamily: "monospace", color: C.muted, lineHeight: 1.8, wordBreak: "break-all" } }, [
						h("div", { key: "i" }, "handoff_id: " + String(d.handoff_id || "") + "　created_at: " + String(d.created_at || "")),
						Object.keys(materials).filter((k) => k !== "original_brief_note").map((k, i) =>
							h("div", { key: "m" + i }, k + ": " + String(materials[k]))),
						d.risk_register_ref ? h("div", { key: "r" }, "risk_register_ref: " + String(d.risk_register_ref)) : null,
						d.config_prediction_ref ? h("div", { key: "p" }, "config_prediction_ref: " + String(d.config_prediction_ref)) : null
					]) : null
				]),
				materials.original_brief_note ? h("div", {
					key: "obn",
					style: { marginTop: "9px", border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn, background: "#fffdf7", borderRadius: "4px", padding: "9px 12px", fontSize: "12px", lineHeight: 1.8 }
				}, ["旧文档说明　", String(materials.original_brief_note)]) : null
			]);
		}

		/** 折叠块（A5 用） */
		function Fold(props) {
			const [open, setOpen] = React.useState(!!props.defaultOpen);
			return h("div", { style: props.style }, [
				h("div", {
					key: "h",
					onClick: () => setOpen(!open),
					style: {
						display: "flex", justifyContent: "space-between", alignItems: "center",
						padding: "7px 11px", background: C.bg, cursor: "pointer",
						borderBottom: open ? "1px solid " + C.faint : "none"
					}
				}, [
					h("span", { key: "t", style: { fontSize: "12px", fontWeight: 600 } }, props.title),
					h("span", { key: "g", style: { fontSize: "10px", color: C.muted } }, open ? "收起 ▾" : "展开 ▸")
				]),
				open ? h("div", { key: "b", style: { padding: "9px 11px" } }, props.children) : null
			]);
		}

		/**
		 * A5 · 功能详情 · 界面图
		 * ① §5.0 界面清单快照　② Figma 提示条（折叠，只提示不执行）
		 * ③ 每个 UI 的骨架图（内嵌；失败则退化为打开）　④ 边界声明
		 */
		function InterfacePanel(props) {
			const data = props.data;
			const srWs = props.srWs || "";
			const onOpen = props.onOpen;
			const [broken, setBroken] = React.useState({});

			if (!data) return h("div", { style: { color: C.muted, fontSize: "12px" } }, "正在读定稿的 §5…");
			if (data.error) return h("div", { style: { color: C.bad, fontSize: "12px" } }, data.error);
			if (data.empty) return h("div", { style: { color: C.muted, fontSize: "12px" } }, data.empty);

			const rows = data.uiRows || [];
			const uis = data.uis || [];
			const imgTotal = uis.reduce((n, u) => n + u.images.length, 0);
			const ueTotal = uis.reduce((n, u) => n + u.ueCount, 0);
			const markBroken = (k) => setBroken((s) => { const o = {}; for (const x in s) o[x] = s[x]; o[k] = true; return o; });

			return h("div", null, [
				h("div", { key: "sum", style: { fontSize: "12px", color: C.muted, marginBottom: "10px" } },
					"来自定稿 " + (data.file || "") + "　界面 " + rows.length + " 个 · 骨架图 " + imgTotal + " 张 · UE 规则 " + ueTotal + " 条"),

				// ② Figma 提示条（只提示不执行）
				h("div", {
					key: "figma",
					style: {
						border: "1px solid " + C.faint, borderLeft: "3px solid " + C.warn,
						background: "#fffdf7", borderRadius: "4px", marginBottom: "11px"
					}
				}, h(Fold, {
					title: "本节含 " + imgTotal + " 张界面图 · 可用 Figma MCP 生成线框图 · 手工触发",
					children: h("div", { style: { fontSize: "12px", lineHeight: 1.9, color: C.ink } }, [
						h("div", { key: "a" }, "工作台**不代跑**这一步（成本、TTY 授权与外部副作用都由你决定）。"),
						h("div", { key: "b" }, "做法：把上面对应 UI 的 ASCII 图/骨架图交给 Figma MCP，新建 Figma Draft；生成后把 Draft 链接记回 §5。"),
						h("div", { key: "c", style: { color: C.muted } }, "参考：成稿到线框图-提示方案.md · S0 实测报告.md")
					])
				})),

				// ① §5.0 界面清单
				rows.length ? h("div", {
					key: "tbl",
					style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", overflow: "hidden", marginBottom: "11px" }
				}, [
					h("div", { key: "t", style: { fontSize: "12px", fontWeight: 600, padding: "7px 11px", background: C.bg, borderBottom: "1px solid " + C.faint } }, "§5.0 界面清单（" + rows.length + "）"),
					h("div", { key: "b", style: { padding: "0" } }, rows.map((r, i) => h("div", {
						key: i,
						style: { display: "flex", gap: "9px", padding: "6px 11px", borderTop: i ? "1px solid " + C.faint : "none", fontSize: "12px", lineHeight: 1.7 }
					}, [
						h("span", { key: "i", style: { fontFamily: "monospace", fontSize: "11px", color: C.muted, minWidth: "52px", flex: "0 0 auto" } }, r.id),
						h("span", { key: "n", style: { fontWeight: 600, minWidth: "110px", flex: "0 0 auto" } }, r.name),
						h("span", { key: "e", style: { flex: "1 1 200px", color: C.muted } }, "进入：" + r.enter),
						h("span", { key: "x", style: { flex: "0 1 160px", color: C.muted } }, "退出：" + r.exit)
					])))
				]) : null,

				// ③ 各 UI 的骨架图
				...uis.map((u) => h("div", {
					key: u.id,
					style: { border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff", marginBottom: "10px", overflow: "hidden" }
				}, [
					h("div", {
						key: "h",
						style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 11px", background: C.bg, borderBottom: "1px solid " + C.faint }
					}, [
						h("span", { key: "t", style: { fontSize: "12px", fontWeight: 600 } }, u.id + "　" + (u.title || "")),
						h("span", { key: "c", style: { fontSize: "10px", color: C.muted, fontFamily: "monospace" } }, "UE " + u.ueCount + " 条 · 图 " + u.images.length)
					]),
					h("div", { key: "b", style: { padding: "10px 11px", display: "flex", flexWrap: "wrap", gap: "10px" } },
						u.images.length ? u.images.map((rel, i) => {
							const abs = srWs + "/proposals/" + rel;
							const name = String(rel).split("/").pop();
							return h("div", { key: i, style: { flex: "1 1 300px", maxWidth: "460px" } }, [
								broken[abs]
									? h("div", {
										key: "f",
										style: { border: "1px dashed " + C.soft, borderRadius: "4px", padding: "18px", textAlign: "center", fontSize: "11px", color: C.muted }
									}, [
										h("div", { key: "a" }, "图片未能在面板内显示"),
										h("button", {
											key: "b", type: "button",
											onClick: () => onOpen(abs),
											style: { font: "inherit", fontSize: "11px", marginTop: "6px", padding: "3px 10px", border: "1px solid " + C.ink, background: "#fff", borderRadius: "3px", cursor: "pointer" }
										}, "用默认程序打开")
									])
									: h("img", {
										key: "i",
										src: fileUrl(abs),
										alt: name,
										onError: () => markBroken(abs),
										style: { width: "100%", border: "1px solid " + C.faint, borderRadius: "4px", background: C.bg, display: "block" }
									}),
								h("div", { key: "n", style: { marginTop: "4px" } }, h("button", {
									type: "button",
									onClick: () => onOpen(abs),
									title: abs,
									style: {
										font: "inherit", fontSize: "10px", fontFamily: "monospace", padding: 0,
										border: "none", background: "none", color: "#3b6ea5", cursor: "pointer",
										textAlign: "left", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
									}
								}, name))
							]);
						}) : [h("span", { key: "none", style: { fontSize: "11px", color: C.muted } }, "该界面还没有骨架图引用")])
				])),

				// ④ 边界声明
				data.boundary ? h("div", {
					key: "bd",
					style: {
						border: "1px solid " + C.faint, borderLeft: "3px solid " + C.soft,
						background: C.bg, borderRadius: "4px", padding: "9px 11px",
						fontSize: "11px", lineHeight: 1.8, color: C.ink
					}
				}, [
					h("div", { key: "t", style: { fontWeight: 600, marginBottom: "3px" } }, "边界声明（§5.0）"),
					h("div", { key: "b" }, data.boundary)
				]) : null,

				h("div", { key: "foot", style: { marginTop: "12px", fontSize: "11px", color: C.muted, lineHeight: 1.85 } }, [
					h("div", { key: "a" }, "界面清单与骨架图引用**从定稿 §5 现场解析**，不另存索引。"),
					h("div", { key: "b" }, "「Draft 记账表」与「漏画/多画对账」还没做——那需要 §5 里记回 Draft 链接，目前定稿里没有这个字段。")
				])
			]);
		}

		/** 折叠起来的原始返回，给需要深究时看 */
		function RawDetail(props) {
			const [open, setOpen] = React.useState(false);
			if (!props.text) return null;
			return h("div", { style: { marginTop: "6px" } }, [
				h("button", {
					key: "b", type: "button",
					onClick: () => setOpen(!open),
					style: {
						font: "inherit", fontSize: "10px", padding: "1px 7px", border: "1px solid " + C.soft,
						background: "#fff", borderRadius: "3px", cursor: "pointer", color: C.muted
					}
				}, open ? "收起技术详情" : "技术详情"),
				open ? h("pre", {
					key: "p",
					style: {
						marginTop: "5px", marginBottom: 0, padding: "8px", fontSize: "10px",
						whiteSpace: "pre-wrap", background: C.bg, border: "1px solid " + C.faint,
						borderRadius: "3px", maxHeight: "240px", overflow: "auto",
						fontFamily: "monospace", userSelect: "text", color: C.muted
					}
				}, props.text) : null
			]);
		}

		/**
		 * A2 流水线（A2 屏）。
		 * 面向策划：六段进度 + 一个「推进一步」。
		 * 通道验证在背后自动做，失败用人话说，原始返回折叠在「技术详情」里。
		 */
		function PipelinePanel(props) {
			const f = props.feature;
			const probe = props.probe;
			const presetId = props.presetId || "sr-workbench";
			const cwd = props.cwd;
			const projectRoot = props.projectRoot || "";
			const cacheKey = workKey(presetId, f ? f.topic : "");
			const [workSid, setWorkSidState] = React.useState(() => WORK_SESSIONS.get(cacheKey) || "");
			const setWorkSid = (v) => { setWorkSidState(v); setWorkSession(cacheKey, v); };
			const [busy, setBusy] = React.useState(false);
			const [msg, setMsg] = React.useState(null);
			const [detail, setDetail] = React.useState("");
			const [wsNote, setWsNote] = React.useState("");

			// ★ hooks 无条件调用：待拍板问题（工作会话那一格）
			const usePending = props.useSessionPendingInteraction;
			const pending = usePending ? usePending((m) => (workSid ? m.get(workSid) : void 0)) : void 0;

			if (!f) return h("div", { style: { color: C.muted, fontSize: "12px" } }, "没有选中功能。");

			const stages = f.stages || {};
			const doneCount = STAGE_ORDER.filter((k) => stages[k]).length;
			const nextKey = STAGE_ORDER.filter((k) => !stages[k])[0] || null;
			const meta = nextKey ? STAGE_META[nextKey] : null;

			const setErr = (text, raw) => { setMsg({ kind: "err", text: text }); setDetail(raw || ""); };
			const setOk = (text) => { setMsg({ kind: "ok", text: text }); setDetail(""); };

			/** 推进一步：确保工作会话 → 执行该阶段的斜杠命令 */
			const advance = () => {
				if (!meta) return;
				setBusy(true);
				setMsg({ kind: "pending", text: "正在准备…" });
				setDetail("");

				// ★ 建会话时必须带 workspaceId，否则会话落进左侧「未分组」而不是项目分组。
				//   工作区 id 用 workspace.create({path}) 按路径查（已存在时返回 created:false）。
				// ★ 会话必须带 workspaceId，否则落进左侧「未分组」。
				//   优先用「当前会话所属的工作区」（与 DSH 新会话按钮同源）；
				//   退而用配置的 projectRoot 按路径查；都没有才用 cwd 兜底。
				const createInProject = () => {
					const info = probe.workspaceInfo();
					if (info && info.id) {
						setWsNote("当前会话的工作区：「" + (info.title || info.id) + "」（" + (info.path || "?") + "）");
						return probe.create(info.id, "", presetId);
					}
					if (projectRoot) {
						return probe.ensureWorkspace(projectRoot).then((wr) => {
							if (!wr.ok) {
								setWsNote("按 projectRoot 查工作区失败：" + humanError(wr));
								return wr;
							}
							const w = wr.value && wr.value.workspace;
							if (!w || !w.workspaceId) {
								setWsNote("工作区已登记但没拿到 workspaceId");
								return { ok: false, error: { message: "工作区已登记但没拿到 workspaceId" } };
							}
							setWsNote("按 projectRoot " + (wr.value.created ? "新建" : "匹配到") + "工作区「" + w.title + "」");
							return probe.create(w.workspaceId, "", presetId);
						});
					}
					setWsNote("未识别当前会话的工作区 —— 会话可能落进「未分组」" +
						(info && info.error ? "（读取异常：" + info.error + "）" : ""));
					return probe.create("", cwd, presetId);
				};

				const ensure = workSid
					? Promise.resolve({ ok: true, value: { sessionId: workSid } })
					: createInProject();

				ensure.then((cr) => {
					if (!cr.ok) {
						setBusy(false);
						setErr("无法为工作台创建会话：" + humanError(cr) +
							"（工作区 " + (projectRoot || "(未配置 projectRoot)") + "）。",
							JSON.stringify(cr, null, 1));
						return;
					}
					const sid = idText(cr.value && cr.value.sessionId) || workSid;
					setWorkSid(sid);

					const line = meta.cmd + " " + f.topic;
					setMsg({ kind: "pending", text: "已启动「" + meta.label + "」，正在把 " + line + " 交给会话…" });

					// ★ skill 不是宿主命令：`commands.execute` 只认 /compact /plan /goal 这类已注册命令，
					//   对 skill 返回 undefined（静默无事发生）。
					//   正确做法与 composer 一致：把 `/skill-name 参数` 当**普通提示词**发出去，
					//   由 host 端的 skill 解析注入指令。
					probe.prompt(sid, line).then((er) => {
						setBusy(false);
						if (er.ok) {
							setOk("已把「" + meta.label + "」交给工作会话（" + line + "）。" +
								"进度与提问在那个会话里看——在左侧列表点开它即可。");
							setDetail(JSON.stringify(er.value, null, 1));
						} else {
							setErr("无法启动「" + meta.label + "」：" + humanError(er), JSON.stringify(er, null, 1));
						}
					});
				});
			};

			return h("div", null, [
				// ① 六段进度
				h("div", {
					key: "bar",
					style: {
						display: "flex", gap: "6px", flexWrap: "wrap",
						marginBottom: "12px", alignItems: "center"
					}
				}, STAGE_ORDER.map((k) => {
					const on = !!stages[k];
					const isNext = k === nextKey;
					return h("div", {
						key: k,
						style: {
							fontSize: "12px", padding: "5px 12px", borderRadius: "4px",
							border: "1px solid " + (on ? C.ok : (isNext ? C.ink : C.soft)),
							background: on ? "#f0fdf4" : (isNext ? "#fff" : "#fafafa"),
							color: on ? C.ok : (isNext ? C.ink : "#aaa"),
							fontWeight: isNext ? 600 : 400
						}
					}, (on ? "✓ " : "") + STAGE_META[k].label);
				})),

				// ② 结论行
				h("div", {
					key: "sum",
					style: {
						border: "1px solid " + C.faint, borderRadius: "4px", background: "#fff",
						padding: "11px 13px", marginBottom: "12px", fontSize: "12px", lineHeight: 1.9
					}
				}, [
					h("div", { key: "a" }, "已完成 " + doneCount + " / 6 个阶段" +
						(f.latestDate ? "　最终版 " + f.latestDate.slice(0, 4) + "-" + f.latestDate.slice(4, 6) + "-" + f.latestDate.slice(6, 8) : "")),
					h("div", { key: "b", style: { color: meta ? C.ink : C.ok } },
						meta
							? "下一步：「" + meta.label + "」——" + meta.desc
							: "已走完六个阶段，可以交程序了。")
				]),

				// ③ 动作
				meta ? h("div", { key: "act", style: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" } }, [
					h("button", {
						key: "go", type: "button", disabled: busy,
						onClick: advance,
						style: {
							font: "inherit", fontSize: "13px", padding: "7px 16px",
							border: "1px solid " + C.ink, background: busy ? "#888" : C.ink,
							color: "#fff", borderRadius: "4px", cursor: busy ? "default" : "pointer"
						}
					}, busy ? "执行中…" : "推进一步：「" + meta.label + "」"),
					h("span", { key: "w", style: { fontSize: "11px", color: C.muted } },
						"会在工作会话里执行 " + meta.cmd + " " + f.topic)
				]) : null,

				// ④ 结果
				msg ? h("div", {
					key: "msg",
					style: {
						border: "1px solid " + (msg.kind === "err" ? C.bad : C.faint),
						borderLeft: "3px solid " + (msg.kind === "err" ? C.bad : msg.kind === "ok" ? C.ok : C.soft),
						background: "#fff", borderRadius: "4px", padding: "10px 12px",
						fontSize: "12px", lineHeight: 1.75,
						color: msg.kind === "err" ? C.bad : msg.kind === "ok" ? C.ok : C.muted
					}
				}, [h("div", { key: "t" }, msg.text), h(RawDetail, { key: "d", text: detail })]) : null,

				// ⑤ 工作会话实时状态
				workSid ? h(WorkSessionStatus, {
					key: "ws", sessionId: workSid,
					useSessions: props.useSessions,
					useSessionPendingInteraction: props.useSessionPendingInteraction,
					onOpen: (sid) => {
						const r = probe.openSession(sid);
						if (!r.ok) setErr("无法打开会话：" + humanError(r), JSON.stringify(r, null, 1));
					}
				}) : null,

				// ⑥ 待拍板：直接在面板里回答（A2 闭环）
				h(PendingQuestionCard, { key: "pq", pending: pending }),

				// ⑥ 底部说明
				h("div", { key: "foot", style: { marginTop: "14px", fontSize: "11px", color: C.muted, lineHeight: 1.85 } }, [
					h("div", { key: "a" }, "工作台不在这里重画流程——它把阶段交给 sr 的 skill，进度与提问都在那个会话里。"),
					h("div", { key: "b" }, "预设：" + presetId + (projectRoot ? "　兜底工作区根：" + projectRoot : "")),
					wsNote ? h("div", { key: "d", style: { color: C.ink } }, "工作区归属：" + wsNote) : null
				])
			]);
		}

		/** 全局面板：A1 功能看板 */
		function Panel(props) {
			const useSessions = props.useSessions;
			// ★ hooks 必须无条件调用：两次 useSessions 都留在顶层，条件移进 selector
			const sessionId = useSessions ? useSessions((s) => s.current) : void 0;
			const cwd = useSessions ? useSessions((s) => {
				const id = s.current;
				if (!id) return void 0;
				const row = s.byId[id];
				return row ? row.cwd : void 0;
			}) : void 0;
			const [state, setState] = React.useState({ phase: "idle" });
			const [q, setQ] = React.useState("");
			const [notice, setNotice] = React.useState(null);
			const [view, setView] = React.useState("dashboard");       // dashboard | detail | assets | config | knowledge
			const [detailTopic, setDetailTopic] = React.useState(null);
			const [dtab, setDtab] = React.useState("design");
			const [ledger, setLedger] = React.useState(null);
			// ★ 台账在**渲染期**从 ledger 派生（不是加载期冻结），见 ledgerOf 的注释
			const designLedger = React.useMemo(() => ledgerOf(ledger), [ledger]);
			const [iface, setIface] = React.useState(null);
			const [finalDoc, setFinalDoc] = React.useState(null);
			const [indexData, setIndexData] = React.useState(null);
			const loader = props.__loader;
			const remoteOpen = props.__remoteOpen;
			const ledgerLoader = props.__ledger;
			const finalLoader = props.__final;
			const fixRunner = props.__fix;
			const interfaceLoader = props.__interfaces;
			const indexLoader = props.__index;
			const diagnose = props.__diagnose;
			const probe = props.__probe;

			// ★ 看板要能看出「哪个功能在等你拍板」。
			//   hooks 无条件调用；订阅整张 pending 表 + 工作会话缓存，在渲染体里算。
			const usePendingMap = props.useSessionPendingInteraction;
			const workMap = useWorkSessions();
			const pendingMap = usePendingMap ? usePendingMap((m) => m) : null;
			/** 功能名 → 'pending'（该功能的会话正等你拍板） */
			const attentionOf = (topic) => {
				if (!pendingMap) return null;
				const sid = workMap.get(workKey("sr-workbench", topic));
				if (sid && pendingMap.get(sid)) return "pending";
				return null;
			};

			/**
			 * 打开一个工作区文件。**每一步都有超时**，保证有限时间内一定给出结果。
			 *   ① DSH 内置 openFile（会话节点树里的文件链接用它；全局面板里的行为未知）
			 *   ② openWorkspacePath —— 系统默认应用
			 *   ③ openWorkspacePath action:"reveal" —— 在文件管理器里显示
			 * ★ 之前 ① 没包超时，一挂就永远停在"正在打开"——那正是你看到的现象。
			 */
			const STEP_MS = 3500;
			const withTimeout = (name, fn, ms) => {
				let p;
				try { p = Promise.resolve(fn()); }
				catch (e) {
					return Promise.reject(new Error(name + "：同步抛错 " + String((e && e.message) || e)));
				}
				return Promise.race([
					p,
					new Promise((_, rej) => setTimeout(
						() => rej(new Error(name + "：超过 " + Math.round((ms || STEP_MS) / 1000) + " 秒未响应")),
						ms || STEP_MS
					))
				]);
			};

			const handleOpen = (f, relOverride) => {
				const rel = relOverride || (f && f.openPath);
				if (!rel) { setNotice({ kind: "err", text: "没有可打开的文件" }); return; }
				const abs = toAbs(cwd, rel);
				setNotice({ kind: "pending", text: "正在打开：" + abs });

				const builtin = props.openFile;
				const hasBuiltin = typeof builtin === "function";
				const steps = [];
				if (hasBuiltin) steps.push(["DSH 内置 openFile", () => builtin(rel)]);
				steps.push(["默认应用", () => remoteOpen({ path: abs }, "默认应用")]);
				steps.push(["文件管理器 reveal", () => remoteOpen({ path: abs, action: "reveal" }, "reveal")]);

				const errs = [];
				const next = (i) => {
					if (i >= steps.length) {
						setNotice({ kind: "err", text: "三种方式都失败 ｜ " + errs.join(" ｜ "), diag: "探测中…" });
						Promise.resolve()
							.then(() => (diagnose ? diagnose() : Promise.resolve("(无诊断)")))
							.then(
								(t) => setNotice({
									kind: "err",
									text: "三种方式都失败 ｜ " + errs.join(" ｜ "),
									diag: "typeof props.openFile = " + typeof builtin + "\n" + String(t || "")
								}),
								(e) => setNotice({
									kind: "err",
									text: "三种方式都失败 ｜ " + errs.join(" ｜ "),
									diag: "typeof props.openFile = " + typeof builtin + "\n诊断本身失败：" + String((e && e.message) || e)
								})
							);
						return;
					}
					const name = steps[i][0];
					withTimeout(name, steps[i][1]).then(
						() => setNotice({ kind: "ok", text: "已打开（" + name + "）：" + rel }),
						(e) => { errs.push(String((e && e.message) || e)); next(i + 1); }
					);
				};
				next(0);
			};

			React.useEffect(() => {
				if (!sessionId) { setState({ phase: "nosession" }); return; }
				let cancelled = false;
				const ac = new AbortController();
				setState({ phase: "loading" });
				loader(sessionId, cwd, ac.signal).then(
					(data) => { if (!cancelled) setState({ phase: "ready", data }); },
					(err) => { if (!cancelled) setState({ phase: "error", error: String((err && err.message) || err) }); }
				);
				return () => { cancelled = true; ac.abort(); };
			}, [sessionId, cwd]);

			// 进「功能详情」时加载该功能的决策台账（§3.2：从**功能根目录**读）
			React.useEffect(() => {
				if (view !== "detail" || !detailTopic || !sessionId) { setLedger(null); return; }
				let cancelled = false;
				const ac = new AbortController();
				setLedger(null);
				const d = state.phase === "ready" ? state.data : null;
				const feat = ((d && d.features) || []).filter((x) => x.topic === detailTopic)[0];
				if (!feat || !feat.root) { setLedger(null); return; }
				ledgerLoader(sessionId, feat.root, d && d.skillsRoot, ac.signal).then(
					(L) => { if (!cancelled) setLedger(L); },
					(e) => { if (!cancelled) setLedger({ records: [], calibration: [], calFiles: [], schemaOk: false, error: String((e && e.message) || e) }); }
				);
				return () => { cancelled = true; ac.abort(); };
			}, [view, detailTopic, sessionId, state.phase]);

			// 进「定稿」页签时读定稿全文并解析结构（§6.2）
			React.useEffect(() => {
				if (view !== "detail" || dtab !== "final" || !sessionId || state.phase !== "ready") { setFinalDoc(null); return; }
				const d0 = state.data;
				const feat = (d0.features || []).filter((x) => x.topic === detailTopic)[0];
				if (!feat || !feat.openPath) { setFinalDoc({ empty: "本功能还没有定稿。" }); return; }
				let cancelled = false;
				const ac = new AbortController();
				setFinalDoc(null);
				finalLoader(sessionId, feat.openPath, ac.signal).then(
					(g) => { if (!cancelled) setFinalDoc(g); },
					(e) => { if (!cancelled) setFinalDoc({ error: "读定稿失败：" + String((e && e.message) || e) }); }
				);
				return () => { cancelled = true; ac.abort(); };
			}, [view, detailTopic, dtab, sessionId, state.phase]);

			// 进「界面图」时读定稿的 §5
			React.useEffect(() => {
				if (view !== "detail" || dtab !== "ui" || !sessionId || state.phase !== "ready") { setIface(null); return; }
				const d0 = state.data;
				const feat = (d0.features || []).filter((x) => x.topic === detailTopic)[0];
				if (!feat || !feat.openPath) { setIface({ empty: "本功能还没有定稿，界面图在定稿的 §5。" }); return; }
				let cancelled = false;
				const ac = new AbortController();
				setIface(null);
				interfaceLoader(sessionId, feat.openPath, ac.signal).then(
					(r) => { if (!cancelled) setIface(r); },
					(e) => { if (!cancelled) setIface({ error: "读取失败：" + String((e && e.message) || e) }); }
				);
				return () => { cancelled = true; ac.abort(); };
			}, [view, dtab, detailTopic, sessionId, state.phase]);

			// 进「设计资产」时读索引
			React.useEffect(() => {
				if (view !== "assets" || !sessionId || state.phase !== "ready") { setIndexData(null); return; }
				let cancelled = false;
				const ac = new AbortController();
				setIndexData(null);
				indexLoader(sessionId, state.data.srWs, ac.signal).then(
					(r) => { if (!cancelled) setIndexData(r); },
					(e) => { if (!cancelled) setIndexData({ error: "读取失败：" + String((e && e.message) || e) }); }
				);
				return () => { cancelled = true; ac.abort(); };
			}, [view, sessionId, state.phase]);

			const shell = (children) => h("div", {
				style: {
					padding: "18px 22px", fontFamily: "system-ui, 'Microsoft YaHei', sans-serif",
					color: C.ink, height: "100%", overflow: "auto", boxSizing: "border-box", background: C.bg
				}
			}, children);

			/** 一级导航当前项：功能详情归在「功能看板」下 */
			const navView = view === "detail" ? "dashboard" : view;
			/** 标题 + 一级导航（做进 head，所有分支自动带上） */
			const head = (sub) => h("div", { key: "hd" }, [
				h("div", { key: "row", style: { display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "12px" } }, [
					h("h1", { key: "t", style: { fontSize: "18px", margin: 0 } }, "策划工作台"),
					h("span", { key: "s", style: { fontSize: "12px", color: C.muted } }, sub)
				]),
				h(TabBar, {
					key: "nav",
					items: NAV,
					view: navView,
					onPick: (id) => { setView(id); setDetailTopic(null); }
				})
			]);

			if (state.phase === "nosession") return shell([head("功能看板 · A1"),
				h("p", { key: "p", style: { color: C.muted } }, "先在左侧选一个会话，工作台才能读到它的工作区。")]);
			if (state.phase === "idle" || state.phase === "loading") return shell([head("功能看板 · A1"),
				h("p", { key: "p", style: { color: C.muted } }, "正在读工作区…")]);
			if (state.phase === "error") return shell([head("功能看板 · A1"),
				h("p", { key: "p", style: { color: C.bad } }, "读取失败：" + state.error),
				h("div", { key: "h", style: { color: C.muted, fontSize: "12px", lineHeight: 1.95, marginTop: "10px" } }, [
					h("div", { key: "a" }, "① 面板锚定方式：读 sr 配置的 sr_workspace 字段（绝对路径），不跟当前会话走。"),
					h("div", { key: "b" }, "② 当前会话工作区：cwd = " + (cwd || "(未解析)")),
					h("div", { key: "c" }, "③ 常见原因：sr 配置没读到（当前会话工作区里没有 .agents/skills/…），或目标目录不在当前会话工作区内。"),
					h("div", { key: "d" }, "④ 目录列举限定在工作区内；文件读取不受限。可在 profile 的 cordis.patch.yml 给本插件加 config.configPath 指定绝对配置路径。")
				])]);

			const d = state.data;
			// ── 功能详情（二级视图）──────────────────────────────
			if (view === "detail") {
				const f = d.features.filter((x) => x.topic === detailTopic)[0];
				return shell([
					head("功能详情 · " + detailTopic),
					h("div", { key: "sub", style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", flexWrap: "wrap" } }, [
						h("button", {
							key: "back", type: "button",
							onClick: () => setView("dashboard"),
							style: { font: "inherit", fontSize: "12px", padding: "3px 9px", border: "1px solid " + C.soft, background: "#fff", borderRadius: "4px", cursor: "pointer" }
						}, "‹ 返回功能看板"),
						f ? badge(f.docType ? f.docType + " / " + (f.status || "?") : "无定稿", f.status === "active" ? "ok" : null) : null,
						f && f.latestFinal ? h("span", { key: "v", style: { fontSize: "11px", color: C.muted, fontFamily: "monospace" } }, "最终版 " + f.latestFinal) : null,
						f && f.openPath ? h("button", {
							key: "open", type: "button",
							onClick: () => handleOpen(f),
							style: { font: "inherit", fontSize: "11px", padding: "3px 9px", border: "1px solid " + C.soft, background: "#fff", borderRadius: "4px", cursor: "pointer" }
						}, "打开最终版") : null
					]),
					h(NoticeBar, { key: "nt", notice: notice }),
					h(TabBar, { key: "dtabs", items: DETAIL_TABS, view: dtab, onPick: setDtab }),
					dtab === "ledger"
						? h(DecisionLedger, { key: "lg", ledger: ledger })
						: dtab === "pipeline"
							? h(PipelinePanel, {
								key: "pp-" + (f ? f.topic : ""),
								feature: f, probe: probe,
								sessionId: sessionId, cwd: cwd, projectRoot: props.__projectRoot,
								useSessions: props.useSessions,
								useSessionPendingInteraction: props.useSessionPendingInteraction
							})
							: dtab === "artifacts"
								? h(ArtifactList, {
									key: "al", feature: f,
									srWs: d.srWs, configRoot: d.configRoot,
									onOpen: (abs) => handleOpen(null, abs)
								})
								: dtab === "ui"
									? h(InterfacePanel, {
										key: "if", data: iface, srWs: d.srWs,
										onOpen: (abs) => handleOpen(null, abs)
									})
									: dtab === "design"
										? h(DesignLedger, { key: "dl", ledger: designLedger })
										: dtab === "final"
											? h(FinalDoc, {
												key: "fd", doc: finalDoc,
												onFix: (req) => fixRunner(d && d.srWs, req)
											})
										: h("div", { key: "soon", style: { color: C.muted, fontSize: "12px" } }, "这一屏还没做。")
				]);
			}

			// ── 设计资产（B1）────────────────────────────────────
			if (view === "assets") {
				const wsPath = (indexData && indexData.srWs) || (state.phase === "ready" ? state.data.srWs : "");
				return shell([
					head("设计资产"),
					h(NoticeBar, { key: "nt", notice: notice }),
					h(AssetsPanel, {
						key: "ap", data: indexData,
						onOpen: (abs) => handleOpen(null, abs),
						read: props.__readText ? (abs) => props.__readText(sessionId, abs) : null,
						onRefresh: props.__refreshIndex ? () => props.__refreshIndex(wsPath) : null,
						onPickDir: props.__pickDir || null,
						onImport: props.__importDocs ? (p, n) => props.__importDocs(wsPath, p, n) : null,
						onManual: props.__addManual ? (t, b, u) => props.__addManual(wsPath, t, b, u) : null,
						// ★ 收件箱：四种输入方式的统一入口（拍板 2026-09-28）
						onIntake: props.__intake ? (src) => props.__intake(Object.assign({}, src, { srWs: wsPath })) : null,
						intakeRefs: props.__intakeRefs && wsPath ? props.__intakeRefs(wsPath) : null
					})
				]);
			}

			// ── 其余一级视图（占位）──────────────────────────────
			if (view !== "dashboard") {
				const label = (NAV.filter((x) => x.id === view)[0] || {}).label || view;
				return shell([
					head(label),
					h("div", {
						key: "soon",
						style: { border: "1px dashed " + C.soft, borderRadius: "4px", padding: "30px", textAlign: "center", color: C.muted, fontSize: "12px" }
					}, "「" + label + "」还没做 —— 屏清单见 工作台界面清单.md")
				]);
			}

			const filtered = q ? d.features.filter((f) => f.topic.toLowerCase().indexOf(q.toLowerCase()) >= 0) : d.features;

			return shell([
				head("功能看板 · A1"),
				// ① 顶栏：锚点路径（来自 sr 配置）+ 搜索
				h("div", { key: "top", style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "12px", flexWrap: "wrap" } }, [
					h("span", {
						key: "p", title: d.srWs || "(未读到 sr 配置)",
						style: {
							fontSize: "11px", fontFamily: "monospace", color: C.muted,
							maxWidth: "360px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
						}
					}, "锚点 " + (d.srWs || "(相对路径兜底)")),
					h("input", {
						key: "q", value: q, placeholder: "搜索功能名…",
						onChange: (e) => setQ(e.target.value),
						style: {
							flex: "1 1 200px", maxWidth: "300px", fontSize: "12px", padding: "4px 8px",
							border: "1px solid " + C.soft, borderRadius: "4px", outline: "none", background: "#fff"
						}
					}),
					h("span", { key: "n", style: { fontSize: "11px", color: C.muted } },
						filtered.length + " / " + d.features.length + " 个功能")
				]),
				// ② 打开结果提示（含失败时的通道诊断）
				h(NoticeBar, { key: "nt", notice: notice }),
				// ③ 风险条
				h(RiskBar, { key: "risk", features: d.features, attentionOf: attentionOf }),
				// ④ 功能卡
				h("div", { key: "grid", style: { display: "flex", flexWrap: "wrap", gap: "10px" } },
					filtered.length
						? filtered.map((f) => h(FeatureCard, {
							key: f.topic,
							feature: f,
							attention: attentionOf(f.topic),
							onOpen: handleOpen,
							onDetail: (x) => { setDetailTopic(x.topic); setDtab("design"); setView("detail"); },
							onAttention: (x) => { setDetailTopic(x.topic); setDtab("pipeline"); setView("detail"); }
						}))
						: [h("div", { key: "none", style: { color: C.muted, fontSize: "12px" } }, "没有匹配的功能。")]),
				// ⑤ 来源说明
				h("div", { key: "foot", style: { marginTop: "16px", fontSize: "11px", color: C.muted, lineHeight: 1.8 } }, [
					h("div", { key: "a" }, "锚点：sr 配置 " + (d.configFile || "?") + (d.pathNote ? " · " + d.pathNote : "")),
					h("div", { key: "b" }, "扫描：" + (d.srWs || SR_WS) + "\\features\\ → **" + d.counts.features + " 个功能**" +
					" · 配置表 " + d.counts.configs +
					(d.legacyLeft ? "　｜　旧结构还剩 " + d.legacyLeft + " 个文件（素材，确认后可删）" : "")),
					h("div", { key: "c" }, "状态派生自定稿头部 doc_type/status，工作台不另存状态；底部 📄 链接打开最终版。")
				])
			]);
		}

		// ════════════════════════════════════════════════════════════════
		// 五、插件
		// ════════════════════════════════════════════════════════════════

		/**
		 * ★ Cordis 要求**服务必须声明注入**；未注入的服务**访问即同步抛错**。
		 * 但反过来：把可选依赖写进 inject，一旦它没被提供，**整个插件就不激活（面板消失）**。
		 * 折中：核心服务（slots/remote）写进 inject 保证插件一定能装上；
		 * 可选依赖（sessions/workspaces/uiWorkspace）用 `ctx.get(name)` 取——返回 undefined 而不抛，
		 * 功能降级但插件照常工作。
		 */
		const inject = [
			"slots", "remote",
			"remote.workspaceFiles", "remote.session",
			"remote.agentPresets", "remote.commands", "remote.workspace",
			"remote.directoryPicker", "remote.fileUploads"
		];

		/** 安全取一个可选服务（可能为 undefined，不抛） */
		const svc = (ctx, name) => {
			try { return ctx.get(name); } catch (e) { return void 0; }
		};

		/** 把一次 Remote 调用的结果原样收成可显示对象（同步抛错也接住） */
		const safeCall = (name, fn) => {
			let p;
			try { p = Promise.resolve(fn()); }
			catch (e) {
				return Promise.resolve({ name: name, ok: false, error: { message: "同步抛错 " + String((e && e.message) || e) } });
			}
			return p.then(
				(r) => ({ name: name, ok: !!(r && r.ok), value: r && r.value, error: r && r.error }),
				(e) => ({ name: name, ok: false, error: { message: String((e && e.message) || e) } })
			);
		};

		/**
		 * ★ 插件配置是 apply 的**第二个参数**（cordis 核心：`runtime.callback(this.ctx, this.config)`）。
		 *   从 ctx 上取 config 会抛 `cannot get property "config" without inject`——config 不是服务。
		 */
		function apply(ctx, config) {
			const read = (sid, path, range, signal) => ctx.remote.workspaceFiles.read(sid, path, range, signal);
			// 可选配置：sr 配置文件的路径。不给就用会话相对的默认候选。
			const cfg = config || {};
			const configPath = cfg.configPath || cfg.srConfigPath || "";
			/** DSH 工作区根：会话要建在它下面，才会落进左侧对应的分组而不是「未分组」 */
			const projectRoot = cfg.projectRoot || "";
			const loader = (sid, cwd, signal) => loadDashboard(ctx, read, sid, cwd, configPath, signal);
			const ledgerLoader = (sid, root, skillsRoot, signal) =>
				loadLedger(ctx, read, sid, root, skillsRoot, signal);
			const interfaceLoader = (sid, absPath, signal) =>
				loadInterface(read, sid, absPath, signal);
			/** 定稿工作面（§6.2）：收**绝对路径**（= 功能的 openPath） */
			const finalLoader = (sid, absPath, signal) => loadFinal(read, sid, absPath, signal);
			const indexLoader = (sid, srWs, signal) => loadIndex(read, sid, srWs, signal);
			/** 按绝对路径读文本（阅读器用） */
			const readTextFile = (sid, abs) => readAllText(read, sid, abs, void 0, 4000);

			/**
			 * 在（复用的）工作会话里跑一条指令。
			 * ★ 所有"改文件"的动作都走这里 —— 工作台在 Remote 层没有写能力，
			 *   只能把意图交给 agent，由它用工具去写。
			 */
			/**
			 * 确保有一个可用的「工作会话」（按 preset + 主题缓存复用）。
			 * ★ 建会话用 workspaceId，**不要再给 cwd** —— host 明确拒绝两者同时给。
			 */
			const ensureWorkSession = async (srWs) => {
				try {
					const info = workspaceInfo();
					const wsId = info && info.id ? info.id : "";
					// 绝对路径兜底：拿不到工作区 id 时用路径建（影响分组归属，不影响可用性）
					const key = workKey("sr-workbench", wsId || srWs || "__assets__");
					const hit = WORK_SESSIONS.get(key) || "";
					if (hit) return { sid: hit, error: "" };
					const cr = wsId
						? await probe.create(wsId, "", "sr-workbench")
						: await probe.create("", srWs || "", "sr-workbench");
					if (!cr.ok) return { sid: "", error: "无法创建工作会话：" + humanError(cr) };
					const sid = idText(cr.value && cr.value.sessionId);
					if (!sid) return { sid: "", error: "会话已创建，但拿不到 sessionId。" };
					setWorkSession(key, sid);
					return { sid: sid, error: "" };
				} catch (e) {
					return { sid: "", error: "建会话失败：" + String((e && e.message) || e) };
				}
			};

			/**
			 * 「就地改这条」（设计 §6.3 条目引用 + §6.4.1 影响范围）。
			 *
			 * ★ 面板不写文件 —— 它只把「改哪儿、改成什么」说到 agent 不用再找的程度：
			 *   带**条目引用**（§5 UI-M1 UE3）+ **现状原文**（行号会漂，原文不会）
			 *   + **面板扫出的结构引用**（让 agent 少一步搜索）。
			 * ★ 语义影响仍然交给 sr-gdd-fix 的 D11 影响面闭合 —— 面板不越界。
			 */
			const fixRunner = async (srWs, req) => {
				if (!req || !req.path || !req.ref) return { ok: false, note: "缺少定稿路径或条目引用。" };
				const L = [];
				L.push("/sr-gdd-fix " + req.path);
				L.push("改 " + req.ref + "。");
				L.push("现状：" + String(req.before || "").trim());
				L.push("要改成：" + String(req.intent || "").trim());
				if (req.impact && req.impact.length) {
					L.push("连带影响（工作台按结构引用扫出，供参考；语义影响请按 D11 自行扫全）：");
					for (const h of req.impact.slice(0, 12)) {
						L.push("  · L" + h.line + (h.kind === "family" ? " [同族] " : " ") + h.where);
					}
				}
				const text = L.join("\n");
				const got = await ensureWorkSession(srWs || "");
				if (got.error) return { ok: false, note: got.error };
				const r = await probe.prompt(got.sid, text);
				if (!r || r.ok !== true) return { ok: false, note: humanError(r) || "发送失败" };
				return { ok: true, sid: got.sid, sent: text };
			};

			const runInWorkSession = async (instruction) => {
				try {
					const info = workspaceInfo();
					const key = workKey("sr-workbench", "__assets__");
					let sid = WORK_SESSIONS.get(key) || "";
					if (!sid) {
						const cr = info && info.id
							? await probe.create(info.id, "", "sr-workbench")
							: await probe.create("", "", "sr-workbench");
						if (!cr.ok) return "无法创建工作会话：" + humanError(cr);
						sid = idText(cr.value && cr.value.sessionId);
						if (!sid) return "会话已创建，但拿不到 sessionId。";
						setWorkSession(key, sid);
					}
					const r = await probe.prompt(sid, instruction);
					if (!r.ok) return "指令发送失败：" + humanError(r);
					return "已交给工作会话。跑完后回本页重进即可看到新索引。";
				} catch (e) {
					return "失败：" + String((e && e.message) || e);
				}
			};
			const REFRESH_LINE = (win) =>
				"请在 " + win + " 下运行 `python scripts/refresh_asset_index.py`，刷新 design-asset-index.json，" +
				"并报告：新增了哪些资产、移除了哪些、哪些被新版本取代。";

			/** 刷新资产索引 */
			const refreshIndex = async (srWs) => {
				if (!srWs) return "拿不到工作区路径，无法刷新。";
				return runInWorkSession(REFRESH_LINE(String(srWs).replace(/\//g, "\\")));
			};

			/** 方式 3 · 导入旧文档（落 inbox/imported/，只登记不提升） */
			const importOldDocs = async (srWs, srcPath, note) => {
				if (!srWs) return "拿不到工作区路径。";
				if (!srcPath) return "没有选择目录。";
				const win = String(srWs).replace(/\//g, "\\");
				const line = "【导入旧文档】把 " + srcPath + " 作为参考资料导入工作区：\n" +
					"1) 在 " + win + "\\inbox\\imported\\ 下建一个以该目录名命名的子目录，把其中的文档复制进去（只复制文档，跳过图片/视频等大文件；不转换格式、不改内容）；\n" +
					"2) 运行 `python scripts/refresh_asset_index.py` 重新生成索引；\n" +
					"3) 报告导入了哪些文件、索引新增了几条。\n" +
					"注意：导入件只登记为 inbox / needs_review，**不要**提升为正式资产，也**不要**改动任何 sr skill。" +
					(note ? "\n补充说明：" + note : "");
				return runInWorkSession(line);
			};

			/** 方式 4 · 人工补充（落 inbox/manual/，只登记不提升） */
			const addManualNote = async (srWs, title, body, upstream) => {
				if (!srWs) return "拿不到工作区路径。";
				if (!title || !body) return "标题与正文都要填。";
				const win = String(srWs).replace(/\//g, "\\");
				const safe = String(title).replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
				const line = "【人工补充】在 " + win + "\\inbox\\manual\\ 下新建 " + safe + ".md，内容如下：\n" +
					"---\ntitle: " + String(title) + "\nsource: human" +
					(upstream ? "\nupstream_asset: " + upstream : "") + "\n---\n\n" + String(body) + "\n\n" +
					"然后运行 `python scripts/refresh_asset_index.py` 重新生成索引，并报告新增条目。" +
					"\n注意：只登记为 inbox / needs_review，**不要**提升为正式资产，也**不要**改动任何 sr skill。";
				return runInWorkSession(line);
			};

			/**
			 * 上传一个文件到**当前会话**（拿不到本机路径时的退路 —— **只留收据，内容读不到**）。
			 * ★ 返回的 attachmentId 是不透明 id，**没有宿主路径**（`fileHostPath` 只给可信同进程消费方）。
			 *   所以上传件 agent 读不到内容：这里**不把它挂进 prompt 的 content**，
			 *   只在指令里写明"收到过、读不到、需要就向我要路径"（见 intakeByKind 第 2 步）。
			 */
			const uploadForSession = async (sid, f) => {
				const bytes = await readFileBytes(f, 64 * 1024 * 1024);
				const r = await safeCall("fileUploads.upload", () => ctx.remote.fileUploads.upload(sid, {
					data: bytesToBase64(bytes),
					name: String(f.name || "upload.bin")
				}));
				if (!r.ok) return { name: String(f.name || ""), error: humanError(r) };
				const file = (r.value && (r.value.file || r.value)) || {};
				return { name: file.name || String(f.name || ""), attachmentId: file.attachmentId, bytes: file.bytes };
			};

			/** 素材数组里"要 agent 去读的路径"有多少条 */
			const pathRefsOf = (rows) => (rows || []).filter((m) => m && (m.kind === "file" || m.kind === "dir")).length;

			/**
			 * ★ 收件箱的唯一出口：把四种输入方式组装好的指令发进工作会话。
			 *   组装逻辑在 `lib/intake-parse.js`（同一份代码有离线回归 test-intake.mjs）。
			 *   这里只做三件事：校验前置 → 处理拿不到路径的文件 → 发指令。
			 */
			const intakeByKind = async (src) => {
				const input = src || {};
				if (!contract) return { ok: false, note: "收件箱逻辑没加载上（intake-parse.js）。" };
				const srWs = (src && src.srWs) || "";
				if (!srWs) return { ok: false, note: "拿不到 sr 工作区路径（工作台锚点配置读不到）。" };

				// 1) 拿不到本机路径的文件 → 上传到工作会话（与下面用的是同一个会话）
				const uploads = [];
				const upErr = [];
				const pathFiles = (input.files || []).filter((f) => f.fullPath && !f.err);
				const noPathFiles = (input.files || []).filter((f) => !f.fullPath && !f.err);
				let sid = null;
				if (noPathFiles.length > 0) {
					const got = await ensureWorkSession(srWs);
					if (got.error) return { ok: false, note: got.error };
					sid = got.sid;
					for (const f of noPathFiles) {
						const u = await uploadForSession(sid, f.orig || { name: f.name, size: f.size });
						if (u.attachmentId) uploads.push(u); else upErr.push(u.name + "（" + u.error + "）");
					}
				}

				// 2) 组装指令（路径入参 / 备注 / 主题）
				const rawTexts = (input.materials || []).filter((m) => m.kind === "text").map((m) => m.text);
				const inline = (input.files || []).filter((f) => f.isText && !f.err)
					.map((f) => "【文件：" + f.name + "】\n" + String(f.text || "").slice(0, INLINE_TEXT_CAP));
				const note = [String(input.note || "").trim()].concat(inline).filter((x) => x !== "").join("\n\n");
				const materialPaths = (input.materials || [])
					.concat(pathFiles.map((f) => ({ kind: "file", path: f.fullPath })));
				const built = contract.buildInstruction(input.kind, {
					materials: materialPaths,
					note: note,
					title: input.topic,
					upstream: input.upstream,
					srWs: srWs
				});
				if (built.blocked) return { ok: false, note: built.blocked };
				let instruction = built.instruction;
				if (inline.length > 0) instruction += "\n\n以下是随指令内联的文件内容（浏览器已读出，不必再读盘）：\n" + inline.join("\n\n");
				if (rawTexts.length > 0 && pathRefsOf(materialPaths) === 0) instruction += "\n\n我在输入框里写的原文：\n" + rawTexts.join("\n\n");
				if (uploads.length > 0) instruction += "\n\n另：本次随消息收到 " + uploads.length + " 个文件（会话附件：" + uploads.map((u) => u.name).join("、") + "）。\n" +
					"**这些文件没有可用路径，你读不到它们的内容** —— 不要假装读过。若这个文件对本次任务必要，请告诉我要它做什么、并请我补一个本机绝对路径。";
				if (upErr.length > 0) instruction += "\n注意：这些文件上传失败，本次没有带上：" + upErr.join("、") + "。";

				// 3) 发出（不带 file block —— 上传件没有宿主路径，agent 读不到内容）
				if (sid === null) {
					const got = await ensureWorkSession(srWs);
					if (got.error) return { ok: false, note: got.error };
					sid = got.sid;
				}
				const sent = await probe.prompt(sid, instruction);
				if (!sent.ok) return { ok: false, note: "指令发送失败：" + humanError(sent) };
				const warn = uploads.length > 0
					? "　⚠ 其中 " + uploads.length + " 个文件没有本机路径，agent 读不到内容（已如实写在指令里）；要用它们请补一个绝对路径。"
					: "";
				return {
					ok: true, sid: sid, kind: input.kind,
					note: "已交给工作会话" + (sid ? "（" + String(sid).slice(0, 8) + "…）" : "") + "。" +
						"它在那个会话里跑，跑完回本页重进就能看到；会话里有决策门时，进度与提问都在那儿。" + warn
				};
			};

			/**
			 * 「跑这一趟之后去哪儿看产物」——面板里的常驻跳转。
			 * ★ 只给路径，不假装知道跑没跑完（工作台读不到会话内部状态就如实说）。
			 */
			const intakeRefs = (srWs) => {
				if (!srWs) return [];
				const abs = String(srWs).replace(/\//g, "\\").replace(/\\+$/, "");
				return [
					{ label: "决策记录目录：" + abs + "\\decisions", abs: abs + "\\decisions" },
					{ label: "分析产出目录：" + abs + "\\analysis", abs: abs + "\\analysis" },
					{ label: "收集箱：" + abs + "\\inbox", abs: abs + "\\inbox" }
				];
			};

			/**
			 * 用系统默认程序打开一个工作区文件。
			 * ★ host 的 openWorkspacePath(request, signal) 会调 signal.throwIfAborted()，
			 *   signal 是**必传**的；不给会抛 TypeError。
			 * request 不带 sessionId，故传绝对路径。
			 */
			/**
			 * 直接调 host 的 openWorkspacePath —— **不加超时**，由调用方统一包超时。
			 * ★ host 的 openWorkspacePath(request, signal) 会调 signal.throwIfAborted()，
			 *   signal 是**必传**的；不给会抛 TypeError。
			 * request 不带 sessionId，故传绝对路径。
			 */
			const remoteOpen = (req, label) => {
				// ★ 访问 ctx.remote.session 本身就可能同步抛错（未注入）——必须包起来
				let sessionNs;
				try { sessionNs = ctx.remote && ctx.remote.session; }
				catch (e) {
					return Promise.reject(new Error(
						label + "：remote.session 未注入（" + String((e && e.message) || e) + "）"
					));
				}
				if (!sessionNs || typeof sessionNs.openWorkspacePath !== "function") {
					return Promise.reject(new Error(
						label + "：remote.session.openWorkspacePath 不可用 · 可用命名空间：" +
						Object.keys(ctx.remote || {}).join(", ")
					));
				}
				const ac = new AbortController();
				return Promise.resolve(sessionNs.openWorkspacePath(req, ac.signal)).then((r) => {
					if (!r || r.ok !== true) {
						const e = r && r.error;
						throw new Error(label + "：" + ((e && (e.message || e.code)) || "返回失败"));
					}
					return true;
				});
			};

			/**
			 * 诊断：打开失败时把通道实况探出来（不再盲猜）。
			 * 返回可读文本，直接显示在面板上。
			 */
			const diagnose = async () => {
				const L = [];
				try { L.push("remote 命名空间：" + Object.keys(ctx.remote || {}).join(", ")); }
				catch (e) { L.push("列命名空间抛错：" + String((e && e.message) || e)); }
				let s = null;
				try { s = ctx.remote && ctx.remote.session; }
				catch (e) { L.push("访问 remote.session 抛错：" + String((e && e.message) || e)); }
				L.push("typeof remote.session = " + typeof s);
				if (!s) return L.join("\n");
				L.push("typeof session.openWorkspacePath = " + typeof s.openWorkspacePath);
				L.push("typeof session.canOpenWorkspacePath = " + typeof s.canOpenWorkspacePath);
				try {
					if (typeof s.canOpenWorkspacePath === "function") {
						const r = await s.canOpenWorkspacePath();
						L.push("canOpenWorkspacePath() = " + (r && r.ok === true ? String(r.value) : "失败 " + JSON.stringify(r && r.error)));
					}
				} catch (e) { L.push("canOpenWorkspacePath() 抛错：" + String((e && e.message) || e)); }
				try {
					if (typeof s.workspaceDesktop === "function") {
						const r = await s.workspaceDesktop();
						L.push("workspaceDesktop() = " + JSON.stringify(r && r.ok === true ? r.value : (r && r.error)));
					} else L.push("workspaceDesktop：客户端无此方法");
				} catch (e) { L.push("workspaceDesktop() 抛错：" + String((e && e.message) || e)); }
				return L.join("\n");
			};

			/**
			 * A2 通道探测：把「列预设 / 列斜杠命令 / 建 sr 工作会话 / 执行命令」四步
			 * 的结果原样报出来。**先确认通道，再搭界面。**
			 */
			/**
			 * 当前会话所属的工作区 —— 与 DSH「新会话」按钮同源的逻辑：
			 *   `workspace.items.find(item => item.sessionIds.includes(sessions.current))?.workspaceId`
			 * 工作台建的会话必须落进这个工作区，否则会进左侧「未分组」。
			 */
			const workspaceInfo = () => {
				try {
					const wsvc = svc(ctx, "workspaces");
					const ssvc = svc(ctx, "sessions");
					if (!wsvc || !ssvc || !wsvc.list || !ssvc.list) {
						return { id: "", title: "", path: "", error: "workspaces/sessions 服务不可用" };
					}
					const ws = wsvc.list.getSnapshot();
					const ss = ssvc.list.getSnapshot();
					const cur = ss && ss.current;
					if (cur === void 0 || cur === null) return { id: "", title: "", path: "" };
					const hit = (ws.items || []).filter(
						(it) => it && Array.isArray(it.sessionIds) && it.sessionIds.indexOf(cur) >= 0
					)[0];
					return hit
						? { id: hit.workspaceId, title: hit.title || "", path: hit.path || "" }
						: { id: "", title: "", path: "" };
				} catch (e) {
					return { id: "", title: "", path: "", error: String((e && e.message) || e) };
				}
			};

			const probe = {
				presets: () => safeCall("agentPresets.list", () => ctx.remote.agentPresets.list()),
				commands: (sid) => safeCall("commands.list", () => ctx.remote.commands.list(sid)),
				/** 按路径查/建工作区 —— 已存在时返回 created:false 并给出 workspaceId */
				ensureWorkspace: (path) => safeCall("workspace.create",
					() => ctx.remote.workspace.create({ path: path })),
				create: (workspaceId, cwd, preset) => safeCall("session.create", () => {
					// ★ host 明确拒绝同时给 workspaceId 与 cwd：
					//   "session.create accepts workspaceId or cwd, not both"（gateway/bad-request）
					//   给了 workspaceId 就用工作区自己的 path 当 cwd。
					const req = workspaceId
						? { workspaceId: workspaceId, agentPreset: preset }
						: { cwd: cwd || void 0, agentPreset: preset };
					return ctx.remote.session.create(req);
				}),
				exec: (sid, line) => safeCall("commands.execute",
					() => ctx.remote.commands.execute(sid, line, [])),
				prompt: (sid, text) => safeCall("session.prompt", () => ctx.remote.session.prompt({
					requestId: "wb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
					sessionId: sid,
					mode: "queue",
					// ★ 不挂 file block：上传件的 attachmentId 没有宿主路径，agent 读不到内容
					//   （见 IntakeBox 的 noPath 警告）。挂上去只会让人以为"它读过了"。
					content: [{ type: "text", text: text }]
				})),
				workspaceInfo: workspaceInfo,
				/** 原生目录选择器（用于"导入旧文档"） */
				pickDirectory: () => safeCall("directoryPicker.pick",
					() => ctx.remote.directoryPicker.pick()),
				/** 跳到某个会话（DSH 自己的服务；会把中栏切回对话） */
				openSession: (sid) => {
					try {
						if (!sid) return { ok: false, error: { message: "没有会话 id" } };
						const uw = svc(ctx, "uiWorkspace");
						if (!uw || typeof uw.openSession !== "function") {
							return { ok: false, error: { message: "uiWorkspace 服务不可用" } };
						}
						uw.openSession(sid);
						return { ok: true, value: { opened: true } };
					} catch (e) {
						return { ok: false, error: { message: String((e && e.message) || e) } };
					}
				}
			};

			function PanelBound(props) {
				return h(PanelErrorBoundary, null,
					h(Panel, Object.assign({}, props, {
						__loader: loader, __remoteOpen: remoteOpen, __ledger: ledgerLoader, __final: finalLoader,
						__fix: fixRunner,
						__diagnose: diagnose, __probe: probe, __projectRoot: projectRoot,
						__interfaces: interfaceLoader, __index: indexLoader,
						__refreshIndex: refreshIndex, __readText: readTextFile,
						__pickDir: probe.pickDirectory,
						__importDocs: importOldDocs, __addManual: addManualNote,
						// ★ 收件箱（四种输入方式的统一入口）
						__intake: intakeByKind, __intakeRefs: intakeRefs
					})));
			}

			ctx.slots.inject("main", function* () {
				yield ctx.slots.register({ name: "main", key: PANEL_ID }, PanelBound);
			});
			ctx.slots.inject("sidebar.panellist", function* () {
				yield ctx.slots.register(
					{ name: "sidebar.panellist", id: PANEL_ID, order: 100, label: "策划工作台" },
					Glyph
				);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
