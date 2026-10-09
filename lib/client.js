window.__ModuleLoader__.load({
	id: "dsh-client-ui-sr-workbench",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region src/pure/decisions.ts
		/** 功能根下的相对路径（正斜杠，Windows 两种分隔符都认）。 */
		const DECISION_REL = "decisions/决策记录.md";
		/**
		* 时间戳文法：`YYYY-MM-DD HH:mm:ss`（规范写法），也认 `/` `.` 分隔与 `T` 分隔、
		* 以及 `YYYYMMDDHHmmss` 紧凑写法（14 位数字，年月日时分秒连写）。
		* 分组恒为 年/月/日/时/分/秒。
		*/
		const STAMP_LOOSE = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})/;
		const STAMP_COMPACT = /(?<!\d)(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?!\d)/;
		/** 标题行（1~6 级都认：一级当文档标题，2 级及以上带时间戳的才是条目）。 */
		const HEADING = /^(#{1,6})\s+(.*)$/;
		const pad2 = (n) => (n < 10 ? "0" : "") + String(n);
		const pad4 = (n) => String(n).padStart(4, "0");
		/** 一个 `Date` → 规范时间戳 `YYYY-MM-DD HH:mm:ss`（**本地时间**；面板与 skill 都用这一份）。 */
		function stampOf(date) {
			const d = date instanceof Date && !isNaN(date.getTime()) ? date : /* @__PURE__ */ new Date(0);
			return pad4(d.getFullYear()) + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
		}
		/**
		* 从一行标题里取时间戳 → 规范写法（取不到返回空串）。
		* 宽松写法会被**归一**成规范写法 —— 面板上就不会出现两种时间格式。
		*/
		function stampIn(text) {
			const s = String(text == null ? "" : text);
			const m = STAMP_LOOSE.exec(s);
			if (m) return pad4(+m[1]) + "-" + pad2(+m[2]) + "-" + pad2(+m[3]) + " " + pad2(+m[4]) + ":" + pad2(+m[5]) + ":" + pad2(+m[6]);
			const c = STAMP_COMPACT.exec(s);
			if (c) return c[1] + "-" + c[2] + "-" + c[3] + " " + c[4] + ":" + c[5] + ":" + c[6];
			return "";
		}
		/**
		* 决策文件 → 结构化条目。
		*
		* 判定规则（只有这一份实现）：
		*   · 一个 `##`（及更深）标题里**带时间戳** ⇒ 它是条目头，开一条新条目；
		*   · 其它行归**当前条目**的正文（还没遇到任何条目头时归 `preamble`）；
		*   · `#` 一级标题单独取出当 `title`（不作为条目，也不进前言）。
		*
		* 容错（都进 `issues`，绝不静默）：
		*   · 时间戳之前的正文非空（除了 H1）⇒ 提示"成了前言"；
		*   · 时间戳之后又出现**不带时间戳的标题** ⇒ 提示"它被并进了上一条"（这多半是想开新条目却漏了时间）。
		*/
		function parseDecisionLog(text) {
			const raw = String(text == null ? "" : text);
			const lines = raw.split(/\r?\n/);
			const entries = [];
			const issues = [];
			const preambleLines = [];
			let title = "";
			let cur = null;
			/** 已经离开前言、正在收条目的正文 */
			let sawEntry = false;
			const heading = (line) => HEADING.exec(String(line).replace(/\s+$/, ""));
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const no = i + 1;
				const hm = heading(line);
				if (hm) {
					if (hm[1] === "#") {
						if (cur) cur.body.push(line);
						else if (title === "") title = String(hm[2]).trim();
						else preambleLines.push(line);
						continue;
					}
					const at = stampIn(hm[2]);
					if (at !== "") {
						if (cur) entries.push(finish(cur));
						const segs = hm[2].replace(/\s*·\s*/g, "\0").split("\0");
						cur = {
							at,
							title: [(segs.shift() || "").replace(STAMP_LOOSE, "").replace(STAMP_COMPACT, "").replace(/^[\s:：\-—·]+/, "").trim()].concat(segs.map((s) => String(s).trim())).filter((s) => s !== "").join(" · "),
							line: no,
							body: []
						};
						sawEntry = true;
						continue;
					}
					if (cur) {
						cur.body.push(line);
						issues.push("第 " + no + " 行的标题「" + String(hm[2]).trim() + "」没有时间戳 —— 已并入上一条（第 " + cur.line + " 行）。要单开一条，请把标题写成 `## YYYY-MM-DD HH:mm:ss`。");
					} else {
						preambleLines.push(line);
						issues.push("第 " + no + " 行的标题「" + String(hm[2]).trim() + "」没有时间戳，也不在任何条目里 —— 面板按前言显示。");
					}
					continue;
				}
				if (cur) cur.body.push(line);
				else preambleLines.push(line);
			}
			if (cur) entries.push(finish(cur));
			if (!sawEntry) {
				if (raw.trim() !== "") issues.push("这份文件里还没有带时间戳的条目 —— 面板按原文显示；新条目请用 `## YYYY-MM-DD HH:mm:ss` 开头。");
			}
			return {
				present: raw.trim() !== "",
				title,
				preamble: trimBlank(preambleLines).join("\n"),
				entries,
				issues,
				text: raw
			};
			function finish(c) {
				const body = trimBlank(c.body).join("\n");
				return {
					index: entries.length + 1,
					at: c.at,
					title: c.title,
					body,
					line: c.line
				};
			}
		}
		/** 去掉首尾空行（正文里的空行照留）。 */
		function trimBlank(lines) {
			let a = 0;
			let b = lines.length;
			while (a < b && String(lines[a]).trim() === "") a++;
			while (b > a && String(lines[b - 1]).trim() === "") b--;
			return lines.slice(a, b);
		}
		/** 一条条目的模板（预设 / skill / 面板的"复制格式"按钮都引它）。 */
		function decisionEntryTemplate(at, title) {
			return [
				"## " + String(at || "YYYY-MM-DD HH:mm:ss") + (title ? " · " + String(title) : ""),
				"**决策**：",
				"**依据**：",
				"**影响**：",
				""
			].join("\n");
		}
		//#endregion
		//#region src/pure/buckets.ts
		/**
		* 目录契约与产物分类（v5 口径）—— **一个功能 = 一个目录，目录里只有 4 个桶**。
		*
		*     features\<主题>\
		*     ├─ evidence\    【原始件 + 过程证据】外部送进来的一切 · 抽帧 · 校准流水
		*     ├─ analysis\    【头脑风暴的内容】AI 分析产物 ← 面板「头脑风暴」模块读它
		*     ├─ gdd\         【设计正文与交付物】成稿 · 定稿 · 宣讲 HTML
		*     └─ decisions\   【人要读的记录】决策记录.md（一个功能**只有一个**决策文件）
		*
		* 判据（谁产生 / 给谁看）：
		*   evidence = **进来的原件**；analysis = **想出来的内容**；gdd = **写出来的正文**；
		*   decisions = **定下来的事**。
		*
		* ★ 相对 v4 的两处变化（这就是本票的目录契约）：
		*   ① `source\` 并入 `evidence\`，`delivery\` 并入 `gdd\` —— 六个桶减成四个
		*      （"原料"与"证据"本来就是一件事：都是外部来的原件）；
		*   ② `gdd\` 内部**只按文件名分三档面板产物**（成稿 / 定稿 / 宣讲 HTML），
		*      其余（审查 / 修订点 / 定稿 HTML 派生件 / 认不出来的）如实进「其它」，**一个都不丢**。
		*
		* 纯函数、零 IO。
		*/
		/** 4 个桶（**顺序即界面顺序**：进 → 想 → 写 → 定）。 */
		const BUCKETS = [
			"evidence",
			"analysis",
			"gdd",
			"decisions"
		];
		/** 桶 → 一句话含义（建目录时的提示语、检索结果、操作文档都引这一份）。 */
		const BUCKET_MEANING = {
			evidence: "原始件 + 过程证据（截图 / 录屏 / 旧文档原件 / 外部交付包 / 抽帧 / 校准流水）",
			analysis: "头脑风暴的内容（体验报告 / 问题卡 / 复刻规格 / 概念稿 / 旧文档分析 / 人工补充）",
			gdd: "设计正文与交付物（成稿 / 定稿 / 宣讲 HTML）",
			decisions: "决策记录（一个功能只有一个决策文件：决策记录.md）"
		};
		/** 桶 → 界面短标签。 */
		const BUCKET_LABEL = {
			evidence: "证据",
			analysis: "头脑风暴",
			gdd: "设计正文",
			decisions: "决策记录"
		};
		/**
		* `gdd\` 内部按文件名分档（**唯一**允许按文件名分类的地方 —— 它是一个混装目录）。
		* 返回值 → 显示标签见 `GDD_KIND_LABEL`。
		*
		*   draft 成稿 · final 定稿 · speech 宣讲 HTML · speechSrc 宣讲源数据
		*   review 审查 · fixpoints 修订点 · finalHtml 定稿 HTML（派生件）· others 其它
		*/
		function gddKindOf(name) {
			const n = String(name == null ? "" : name);
			if (!n) return "others";
			if (/_定稿_审查\.md$/i.test(n) || /_审查\.md$/i.test(n)) return "review";
			if (/_定稿\.md$/i.test(n)) return "final";
			if (/_定稿\.html?$/i.test(n)) return "finalHtml";
			if (/_修订点\.md$/i.test(n)) return "fixpoints";
			if (/_宣讲_.*\.html$/i.test(n)) return "speech";
			if (/_宣讲_.*\.content\.json$/i.test(n)) return "speechSrc";
			if (/\.md$/i.test(n)) return "draft";
			return "others";
		}
		/**
		* 面板「最终产物」模块的分类（v5 用户口径：头脑风暴的产物、成稿、定稿、html 宣讲稿；
		* 2026-10-09 追加 **配置表**）。`key` 就是界面分组键；`other` 是兜底组（**默认折叠**，
		* 只为"一个文件都不许静默丢"存在）。
		*/
		const OUTPUT_GROUPS = [
			{
				key: "brainstorm",
				label: "头脑风暴的产物",
				note: "analysis\\ 里的全部内容（体验报告 / 问题卡 / 复刻规格 / 概念稿 / 旧文档分析 / 人工补充）"
			},
			{
				key: "draft",
				label: "成稿",
				note: "gdd\\<主题>_<日期>.md —— 只含纯规则与设计"
			},
			{
				key: "final",
				label: "定稿",
				note: "gdd\\*_定稿.md —— 供程序使用的那一份"
			},
			{
				key: "speech",
				label: "HTML 宣讲稿",
				note: "gdd\\*_宣讲_<日期>.html —— 宣讲用的网页"
			},
			{
				key: "config",
				label: "配置表",
				note: "配置这条线的交付物：运行时表（.xlsx / .xlsm / .csv）、change set（CS-*.yaml）、读回验收报告"
			},
			{
				key: "other",
				label: "其它（不属上面五类）",
				note: "审查 / 修订点 / 定稿 HTML 派生件 / 认不出名字的文件 —— 如实列出，不丢"
			}
		];
		/**
		* 这是不是**配置表这条线**的产物（「最终产物 › 配置表」分类的判据）。
		*
		* 认三类：
		*   · `CS-<YYYYMMDD>-<NNN>.yaml` —— change set（变更集）
		*   · `*_读回验收报告*.md` —— 读回验收报告
		*   · `.xlsx` / `.xlsm` / `.csv` —— 运行时配置表文件本体
		*
		* ★ 口径上这类文件**只该落在 `gdd\`**（`analysis\` 只放头脑风暴产物）。
		*   判据仍**按内容认、不按目录认**，理由是：万一哪个 agent 写错了桶，
		*   它也得归到「配置表」、而不是掉进「头脑风暴的产物」里冒充分析结论 ——
		*   归错类比看不见更糟。落点对不对是另一件事（那是纪律，不是分类）。
		*/
		function configArtifactOf(name) {
			const n = String(name == null ? "" : name);
			if (!n) return false;
			if (/^CS-\d{8}-\d+\.ya?ml$/i.test(n)) return true;
			if (/_读回验收报告.*\.md$/i.test(n)) return true;
			if (/\.(xlsx|xlsm|csv)$/i.test(n)) return true;
			return false;
		}
		/**
		* 一个产物（在哪个桶、叫什么名字）→ 面板分类键。
		*   · 配置表这条线的产物**先按内容认**（`configArtifactOf`）—— 它在哪个桶都算配置表；
		*   · `analysis\` 下的其余文件（含子目录里的）都算头脑风暴产物；
		*   · `gdd\` 下按 `gddKindOf` 分：成稿 / 定稿 / 宣讲 HTML，其余进 other；
		*   · 其它桶（evidence / decisions）不进「最终产物」模块 —— 它们各有各的模块。
		*/
		function outputGroupOf(dir, name) {
			const d = String(dir == null ? "" : dir).toLowerCase();
			if (configArtifactOf(name)) return "config";
			if (d === "analysis") return "brainstorm";
			if (d === "gdd") {
				const k = gddKindOf(name);
				if (k === "draft") return "draft";
				if (k === "final") return "final";
				if (k === "speech") return "speech";
				return "other";
			}
			return "other";
		}
		/** Windows 目录名不允许的字符（`\ / : * ? " < > |`）与不可见控制字符。 */
		const TOPIC_ILLEGAL = /[\\/:*?"<>|]/;
		const TOPIC_CONTROL = /[\u0000-\u001f\u007f]/;
		/** Windows 保留设备名（不分大小写；`CON.txt` 这种带扩展名的形式同样保留）。 */
		const TOPIC_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
		const topicOk = () => ({
			ok: true,
			code: "",
			message: "",
			next: ""
		});
		const topicBad = (code, message, next) => ({
			ok: false,
			code,
			message,
			next
		});
		/**
		* 主题名合法性（**真实约束，不发明**）：
		*   · Windows 目录名限制：非法字符 / 保留设备名 / 结尾的空格或点（Win32 会悄悄去掉）/ `.` `..` / 控制字符；
		*   · 工作台口径：长度 ≤ `TOPIC_MAX`；首尾空白**拒绝**而不是静默裁掉 ——
		*     "你看到的目录名必须就是你输的名字"。
		* 返回的是**给人看的一句话 + 下一步**（面板原样显示，不另写话术）。
		*/
		function checkTopicName(topic) {
			const raw = String(topic === null || topic === void 0 ? "" : topic);
			if (raw.trim() === "") return topicBad("empty", "还没输主题名。", "输入一个主题名 —— 它会成为 `features\\<主题>\\` 这个目录名，例如 `联盟讨伐`。");
			if (raw !== raw.trim()) return topicBad("padded", "主题名首尾有空白。", "Windows 会把首尾的空格/点悄悄去掉，目录名就和你输的不一样了 —— 去掉再提交（名字中间的空格没问题）。");
			if (TOPIC_CONTROL.test(raw)) return topicBad("control", "主题名里有不可见字符（控制字符）。", "删掉它重输 —— 这种字符在资源管理器里看不出来，却会写进目录名。");
			const bad = TOPIC_ILLEGAL.exec(raw);
			if (bad) return topicBad("illegal", "主题名里有 Windows 目录名不允许的字符：「" + bad[0] + "」（不允许的是 \\ / : * ? \" < > |）。", "换成不含这些字符的名字（用「-」或中文顿号代替即可）。");
			if (raw === "." || raw === "..") return topicBad("dot", "「" + raw + "」是目录名里的保留记号，不能当主题名。", "换一个名字。");
			if (/[. ]$/.test(raw)) return topicBad("padded", "主题名以「" + raw.slice(-1) + "」结尾。", "Windows 会把结尾的空格/点悄悄去掉，目录名就和你输的不一样了 —— 去掉再提交。");
			if (TOPIC_RESERVED.test(raw)) return topicBad("reserved", "「" + raw + "」是 Windows 的保留设备名（CON / PRN / AUX / NUL / COM1-9 / LPT1-9）。", "换一个名字 —— 用保留设备名建目录，系统会认不出来。");
			if ([...raw].length > 64) return topicBad("too-long", "主题名 " + [...raw].length + " 个字，超过工作台的口径（≤ 64）。", "取一个短一点的主题名（它要能在一张卡和一行页签里读完整）。");
			return topicOk();
		}
		/** 路径归一（比对用：大小写不敏感、分隔符统一、去尾斜杠）。 */
		function pathKey(p) {
			return String(p === null || p === void 0 ? "" : p).replace(/[\\/]+/g, "\\").replace(/\\+$/, "").toLowerCase();
		}
		/**
		* 功能根：`<srWs>\features\<主题>`（与看板 / 详情**同一拼法**）。
		* ★ 分隔符统一成 `\`：这串路径会显示在卡片、页签、错误话术里，也直接喂给
		*   `workspace.create` / `session.create`（Windows 两种都认，但**显示出来要是一个样子**）。
		*/
		function featureRootFor(srWs, topic) {
			return String(srWs === null || srWs === void 0 ? "" : srWs).replace(/[\\/]+$/, "") + "\\features\\" + String(topic);
		}
		/**
		* 校验 + 算路径（**一次算完**：面板显示的就是这里算出来的，建的就是它）。
		*
		* 三种拒绝：
		*   `topic-*`         主题名本身不合法（非法字符 / 保留名 / 结尾点号 / 超长 / 空）
		*   `no-anchor`       拿不到 SR 工作区锚点（那就不知道往哪儿建）
		*   `dir-exists`      目录已存在（`features\<主题>\` 已经在了 —— 改名不改身份，所以直接进它）
		*   `workspace-taken` 这个路径上**已经登记过一个工作区**（先确认那个目录在不在）
		*/
		function planNewFeature(topic, facts, srWs) {
			const t = String(topic === null || topic === void 0 ? "" : topic);
			const base = String(srWs || facts && facts.srWs || "");
			const root = featureRootFor(base, t);
			const bad = (code, message, next) => ({
				ok: false,
				code,
				topic: t,
				root,
				buckets: BUCKETS.slice(),
				message,
				next
			});
			const c = checkTopicName(t);
			if (!c.ok) return bad(c.code, c.message, c.next);
			if (base.trim() === "") return bad("no-anchor", "没读到 SR 工作区锚点（sr 配置里的 sr_workspace）。", "先确认 sr 配置能读到（`.agents\\skills\\sr-askme\\config.local.json`），再刷新面板重试。");
			const key = nameKey(t);
			for (const d of facts && facts.dirNames || []) if (nameKey(d) === key) return bad("dir-exists", "`features\\" + d + "\\` 已经有这个目录了（**目录存在就是功能**）。", "要在这个功能上干活，直接在看板上点它的卡片；要建**新**功能，换个名字。");
			const rootKey = pathKey(root);
			for (const p of facts && facts.wsPaths || []) if (pathKey(p) === rootKey) return bad("workspace-taken", "已经有一个工作区登记在 `" + root + "` 这个路径上了。", "先确认那个目录在不在：在就用它（刷新面板就会扫到），不在的话在侧边栏把那个工作区删掉再建。");
			return {
				ok: true,
				code: "",
				topic: t,
				root,
				buckets: BUCKETS.slice(),
				message: "",
				next: ""
			};
		}
		/** 目录名比对键（Windows：大小写不敏感、去尾空格与点）。 */
		function nameKey(p) {
			return String(p === null || p === void 0 ? "" : p).replace(/[. ]+$/, "").trim().toLowerCase();
		}
		/** 建目录时"这个目录该装什么"的一句话（界面显示；来源只有 `BUCKET_MEANING`）。 */
		function bucketHint(b) {
			return BUCKET_MEANING[String(b == null ? "" : b)] || "";
		}
		/** 会话标题（工作会话的**认领凭据**，与 `sessionpick.workTitleFor` 同口径）。 */
		function sessionTitleFor(topic) {
			return "策划工作台·工作（" + (String(topic == null ? "" : topic).trim() || "?") + "）";
		}
		/**
		* ★ 为什么要有这一整块：**`uiWorkspace.createDirectory` 在 Windows 上不存在。**
		*
		* DSH 的目录选择器由 `dsh-host-directory-picker-auto` 在**启动时**选后端，规则是：
		* `bindHost !== "127.0.0.1"` → browse；SSH 启动 → browse；**`platform === "win32"` → native**；
		* linux 要有 `DISPLAY`/`WAYLAND_DISPLAY` 且有 zenity/kdialog 才 native。
		* 而 `createDirectory` 在宿主侧被 `requireCapability("browse", "createDirectory")` 挡着 ——
		* 于是 **Windows 环回部署（桌面版与 `dsh web` 都算）只有 native，没有 createDirectory**，
		* 报错原文：`directory-picker/unavailable: directoryPicker.createDirectory needs the browse
		* capability; the composed picker serves "native"`。
		*
		* 客户端能碰到的写盘通道只有三条，所以这里按顺序退：
		*   ① `uiWorkspace.createDirectory`（browse 后端才有的快路）；
		*   ② **让会话跑一条 PowerShell**（`New-Item -ItemType Directory -Force`，幂等）—— 通用；
		*   ③ 都不行 ⇒ 把**逐字命令**给用户，让他手工建；面板检测到"只有 4 个桶的空脚手架"会接着往下走。
		*
		* 判定"这是不是空脚手架"的判据在 `isBareScaffold`：**只有 4 个桶目录、一个文件都没有**。
		* 那样才允许"跳过建目录、直接建工作区与会话" —— 有内容就说明是**真功能**，照旧拒绝重名。
		*/
		/** 要建的目录（**顺序即创建顺序**：父目录在前）。`features\` 本身也算一个。 */
		function scaffoldDirsOf(srWs, topic) {
			const base = String(srWs === null || srWs === void 0 ? "" : srWs).replace(/[\\/]+$/, "");
			const t = String(topic === null || topic === void 0 ? "" : topic);
			const root = base + "\\features\\" + t;
			return [base + "\\features"].concat(BUCKETS.map((b) => root + "\\" + b));
		}
		/**
		* 空脚手架判据：目录里**只有 4 个桶**（都是目录）、**一个文件都没有**、没有别的目录。
		* 空目录也算（建到一半的真实现状）。
		*/
		function isBareScaffold(entries) {
			const list = Array.isArray(entries) ? entries : [];
			const buckets = BUCKETS.map((b) => b.toLowerCase());
			for (const e of list) {
				const n = String(e && e.name || "").toLowerCase();
				if (!n) return false;
				if (String(e && e.type || "") !== "directory") return false;
				if (buckets.indexOf(n) < 0) return false;
			}
			return true;
		}
		/**
		* 让会话建目录的**指令正文**（发给索引会话；正文里不留未定之数）。
		* 只做一件事：`New-Item -ItemType Directory -Force` 那几行，跑完回报一行。
		*/
		function buildScaffoldInstruction(srWs, topic) {
			const dirs = scaffoldDirsOf(srWs, String(topic === null || topic === void 0 ? "" : topic));
			const L = [];
			L.push("【新建功能 · 只建目录】请**只做这一件事**：建出下面这些目录（已存在的跳过），然后回报一行。");
			L.push("");
			L.push("要建的目录（逐字，共 " + dirs.length + " 个）：");
			for (const d of dirs) L.push("  " + d);
			L.push("");
			L.push("怎么建（PowerShell，`-Force` 幂等、已存在不报错；只跑这一段，不要写脚本文件）：");
			L.push("```powershell");
			L.push("$dirs = @(");
			for (const d of dirs) L.push("  '" + d.replace(/'/g, "''") + "'");
			L.push(")");
			L.push("New-Item -ItemType Directory -Force -Path $dirs | Out-Null");
			L.push("```");
			L.push("");
			L.push("规矩：");
			L.push("· **不要**往里面写任何文件（决策记录由功能的工作会话在第一次决策时创建）。");
			L.push("· **不要**动这 " + dirs.length + " 个目录以外的任何东西；这个功能目录现在不该存在内容。");
			L.push("· 跑完**只回报一行**：`OK " + dirs[dirs.length - 1] + "` 或 `FAILED <原因>`。");
			L.push("· 面板会自己回读核对，你不用汇报目录树。");
			return L.join("\n");
		}
		/** 三条路都走不通时给用户的**逐字命令**（复制即用；建完再点一次〔建立〕）。 */
		function manualScaffoldCommand(srWs, topic) {
			const dirs = scaffoldDirsOf(srWs, topic);
			const L = [];
			L.push("$dirs = @(");
			for (const d of dirs) L.push("  '" + d.replace(/'/g, "''") + "'");
			L.push(")");
			L.push("New-Item -ItemType Directory -Force -Path $dirs | Out-Null");
			return L.join("\n");
		}
		/** 建之前那一句（面板原样显示）。 */
		function createPendingNotice(topic) {
			return "正在建「" + topic + "」：功能目录 → 4 个桶 → 注册专属工作区 → 建工作会话（策划模式）。全程本地完成，不发任何指令。";
		}
		/** 建好了那一句（含怎么撤 —— 面板只建不删）。 */
		function createDoneNotice(topic, root, sid) {
			return "建好了：「" + topic + "」· 4 个桶（evidence / analysis / gdd / decisions）都在 · 已登记为它的专属工作区" + (sid ? " · 工作会话已建好（策划模式）" : " · 工作会话没建起来（见下）") + "。要撤掉就删掉这个目录：" + root + "（面板只建不删）。";
		}
		/** 只建到一半那一句（如实说建到哪一步、下一步怎么办）。 */
		function createPartialNotice(topic, root, done, failed, why) {
			return "「" + topic + "」只建了一半：已经建好 " + (done.length ? done.join("、") : "（无）") + "；卡在 " + failed + "（" + why + "）。下一步：① 去 " + root + " 看看实际建出了什么；② 缺的桶手工补建（或删掉这个目录在面板上重新新建）；③ 面板不会替你把已建的东西删掉。";
		}
		//#endregion
		//#region src/pure/frontmatter.ts
		/**
		* markdown 顶部 frontmatter 的**简单标量**解析（唯一出处）。
		*
		* ★ v5 从 `finalgdd.ts` 拆出来：定稿的大纲树 / 引用图 / V 校验随「定稿修订工作面」一起删掉了，
		*   但**头脑风暴的两种固定格式**（`legacy-analysis_*` / `human-note_*`）仍然要读 frontmatter
		*   （`doc_type` / `topic` / `source` / `confidence` / `author`）—— 所以这一段必须留着，
		*   并且只能有**一份**实现。
		*
		* 纯函数、零依赖、零 IO。
		*/
		/** 解析 md 顶部 frontmatter 的简单标量字段（`---` 包起来的 `key: value`）。没有就返回 `null`。 */
		function parseFrontmatter(text) {
			const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(text == null ? "" : text));
			if (!m) return null;
			const out = {};
			for (const line of m[1].split(/\r?\n/)) {
				const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
				if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
			}
			return out;
		}
		//#endregion
		//#region src/pure/mdspec.ts
		/**
		* 产出规范驱动的章节切分与归类（四种输入方式产出规范-v1 §五）
		*
		* ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
		*   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
		* 三分法：设计信息（显示）/ 元数据（省略）/ 治理自检（折叠）；未知章节不丢。
		*/
		function parseMdSections(text) {
			const lines = String(text || "").split(/\r?\n/);
			const out = [];
			let cur = null;
			for (const line of lines) {
				const m = /^(#{1,2})\s+(.*)$/.exec(line);
				if (m && m[1].length === 2) {
					if (cur) out.push(cur);
					cur = {
						title: m[2].trim(),
						body: []
					};
					continue;
				}
				if (cur) cur.body.push(line);
			}
			if (cur) out.push(cur);
			return out.map((s) => ({
				title: s.title,
				body: s.body.join("\n").replace(/^\s+|\s+$/g, "")
			}));
		}
		const MD_SPECS = [
			{
				name: "体验报告",
				match: /^experience-report_/i,
				sections: [
					{
						re: /一句话总评/,
						cls: "top"
					},
					{
						re: /是否值得复刻/,
						cls: "top"
					},
					{
						re: /核心机制拆解/,
						cls: "body"
					},
					{
						re: /功能账本/,
						cls: "body"
					},
					{
						re: /问题列表与问题卡/,
						cls: "body"
					},
					{
						re: /画面序列拆解/,
						cls: "body"
					},
					{
						re: /验证计划/,
						cls: "body"
					},
					{
						re: /样本边界门|决策声明|品类路由|工具与访问状态/,
						cls: "fold"
					},
					{
						re: /治理检查/,
						cls: "fold"
					},
					{
						re: /样本元信息|结构化输出/,
						cls: "skip"
					}
				]
			},
			{
				name: "复刻规格",
				match: /^replication-spec_/i,
				sections: [
					{
						re: /待裁决取舍清单/,
						cls: "top"
					},
					{
						re: /迁移边界/,
						cls: "top"
					},
					{
						re: /功能规则候选/,
						cls: "body"
					},
					{
						re: /UI 结构与交互流程/,
						cls: "body"
					},
					{
						re: /数值表现/,
						cls: "fold"
					},
					{
						re: /推断配置项/,
						cls: "fold"
					},
					{
						re: /样本边界/,
						cls: "fold"
					}
				]
			},
			{
				name: "设计核三角报告",
				match: /^concept-triage_/i,
				sections: [
					{
						re: /Design Nucleus Options/,
						cls: "top"
					},
					{
						re: /Assumption Ledger/,
						cls: "top"
					},
					{
						re: /Original Idea/,
						cls: "body"
					},
					{
						re: /Concept Seed Extraction/,
						cls: "body"
					},
					{
						re: /Player Verb Inventory/,
						cls: "body"
					},
					{
						re: /Action-Goal Alignment/,
						cls: "body"
					},
					{
						re: /Recommended Next Step/,
						cls: "body"
					},
					{
						re: /Case Visibility|External Evidence Status|Quality Gate/,
						cls: "fold"
					},
					{
						re: /治理引用/,
						cls: "skip"
					}
				]
			},
			{
				name: "功能设计稿",
				match: /^feature-concept_/i,
				sections: [
					{
						re: /Player Promise/,
						cls: "top"
					},
					{
						re: /Core Loop/,
						cls: "top"
					},
					{
						re: /Validation Plan/,
						cls: "top"
					},
					{
						re: /Key Systems/,
						cls: "body"
					},
					{
						re: /Uncertainty Calibration/,
						cls: "body"
					},
					{
						re: /Scope Gate/,
						cls: "body"
					},
					{
						re: /Assumption Ledger/,
						cls: "body"
					},
					{
						re: /Risk Register/,
						cls: "body"
					},
					{
						re: /下一步/,
						cls: "body"
					},
					{
						re: /Production Feasibility/,
						cls: "fold"
					},
					{
						re: /配置项预测/,
						cls: "fold"
					}
				]
			},
			{
				name: "证据索引",
				match: /^evidence-index_/i,
				sections: [
					{
						re: /Evidence Index/,
						cls: "top"
					},
					{
						re: /置信度说明/,
						cls: "body"
					},
					{
						re: /时间戳账本/,
						cls: "fold"
					}
				]
			},
			{
				name: "读回验收报告",
				match: /^readback_/i,
				sections: [
					{
						re: /结论/,
						cls: "top"
					},
					{
						re: /必达项对照/,
						cls: "body"
					},
					{
						re: /追加项/,
						cls: "fold"
					},
					{
						re: /报告头/,
						cls: "fold"
					}
				]
			}
		];
		function mdSpecOf(path) {
			const name = String(path || "").split(/[\\/]/).pop() || "";
			for (const s of MD_SPECS) if (s.match.test(name)) return s;
			return null;
		}
		//#endregion
		//#region src/pure/analysisdoc.ts
		/**
		* 头脑风暴工作面（工单 23）· 四入口归类 + 两种新格式的解析
		*
		* 出处（逐条对着写的，不自己编）：
		*   · 设计 §4.1 —— 四种入口**没有先后**、四张并列的动作卡、产出全部落 `features\<主题>\analysis\`
		*   · 设计 §4.2.1 —— 旧文档分析 → `analysis\legacy-analysis_<名称>_<日期>.md`，
		*     **四段固定章节**（仍然有效 / 已废弃 / 可复用 / 原文（转换后）），frontmatter 的 `source:` 指向 `evidence\` 里的原件
		*   · 设计 §4.2.2 —— 人工补充 → `analysis\human-note_<标题>_<日期>.md`，
		*     正文固定保留 `> 原话：…` 一行，**面板上原话与结论并排显示**（一眼看出 AI 有没有改动结论）
		*   · 四种输入方式产出规范 v1 §七.3 —— 每个按钮的前置条件
		*
		* ★ 纯函数、零 IO：目录列举与读文件都在 `src/load/brainstorm.ts`，这里只做归类与解析。
		* ★ **四入口的那张表只有这一份**（`ENTRANCES`）：UI 的卡片、指令里的前置条件、"已有的分析结论"的归类
		*   都读它 —— 表里加一条，三处一起动，不会各说各的（`intake.ts` 直接 re-export 这一份）。
		* ★ 认不出来的东西**不丢**：旧文档分析里多出来的章节进 `extra`，人工补充里多出来的章节进 `extra`，
		*   面板把它们收进「其他章节」——这与 `mdspec` 的「未知章节不丢」是同一条纪律。
		*/
		/** 四种并列入口 —— 顺序即面板上的顺序（设计 §4.1 的表，一行不多一行不少） */
		const ENTRANCES = [
			{
				id: "analysis",
				label: "竞品分析",
				hint: "跑 /sr-analysis",
				needs: "截图 / 录屏 / PV / 商店页（目录、文件路径或链接）",
				prereq: "path",
				output: "analysis\\experience-report_*.md · issue-cards_*.json · replication-spec_*.md · sr-gdd-handoff_*.json · evidence\\",
				handoff: "阶段交给了 skill，进度与提问都在那个会话里（面板不重画流程）"
			},
			{
				id: "concept",
				label: "问答式访谈",
				hint: "跑 /sr-concept",
				needs: "一句创意（可附参考素材路径）",
				prereq: "seed",
				output: "analysis\\concept-triage_*.md → feature-concept_*.md → sr-gdd-handoff_*.json",
				handoff: "阶段交给了 skill，进度与提问都在那个会话里（面板不重画流程）"
			},
			{
				id: "legacy",
				label: "旧文档分析",
				hint: "AI 转换 + 分析",
				needs: "旧策划案 / 脑图 / 表格（目录或文件路径）",
				prereq: "path",
				output: "analysis\\legacy-analysis_<名称>_<日期>.md（四段固定章节）· 原件进 evidence\\",
				handoff: "阶段交给了会话里的 AI 转换 + 分析，进度与提问都在那个会话里（面板不重画流程）"
			},
			{
				id: "humannote",
				label: "人工补充",
				hint: "AI 只整理格式",
				needs: "标题 + 原话（想到什么写什么）",
				prereq: "title+quote",
				output: "analysis\\human-note_<标题>_<日期>.md（原话与结论并排）",
				handoff: "阶段交给了会话里的 AI 整理，进度与提问都在那个会话里（面板不重画流程）"
			}
		];
		/** 旧文档分析的四段固定章节（设计 §4.2.1）——顺序即面板上的顺序，`re` 认标题里的关键词 */
		const LEGACY_SECTIONS = [
			{
				key: "valid",
				label: "仍然有效的结论",
				re: /仍然有效/
			},
			{
				key: "dropped",
				label: "已废弃 / 不适用",
				re: /已废弃|不适用/
			},
			{
				key: "reuse",
				label: "可复用条目",
				re: /可复用/
			},
			{
				key: "raw",
				label: "原文（转换后）",
				re: /^原文/
			}
		];
		/** 人工补充的固定正文（设计 §4.2.2）；`quote` 不在正文里 —— 它是独立的 `> 原话：…` 行 */
		const NOTE_SECTIONS = [
			{
				key: "conclusion",
				label: "结论",
				re: /^结论/
			},
			{
				key: "bounds",
				label: "边界",
				re: /^边界/
			},
			{
				key: "landing",
				label: "落点",
				re: /^落点/
			}
		];
		const LEGACY_PREFIX = /^legacy-analysis_/i;
		const NOTE_PREFIX = /^human-note_/i;
		/** 文件名 → 两种新格式之一（"" = 不是这两种格式） */
		function analysisDocKind(name) {
			const base = String(name == null ? "" : name).split(/[\\/]/).pop() || "";
			if (LEGACY_PREFIX.test(base)) return "legacy";
			if (NOTE_PREFIX.test(base)) return "humannote";
			return "";
		}
		/** 文件名/标题 → 安全的文件名片段（产出文件名用；与 intake.safeName 同口径，但这边不依赖 intake） */
		function nameSafe(p, limit) {
			const s = String(p == null ? "" : p).replace(/[\\/:*?"<>|]/g, "_").replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim();
			const cap = limit || 60;
			return s.length > cap ? s.slice(0, cap) : s;
		}
		/** 旧文档分析的产出文件名（**唯一出处**：指令里写的名字必须与读取侧认得的一致） */
		function legacyDocName(name, date) {
			return "legacy-analysis_" + (nameSafe(String(name == null ? "" : name).split(/[\\/]/).pop() || "", 60).replace(/\.[A-Za-z0-9]{1,8}$/, "") || "旧文档") + "_" + String(date || "") + ".md";
		}
		/** 人工补充的产出文件名（**唯一出处**，同上） */
		function humanNoteName(title, date) {
			return "human-note_" + (nameSafe(title, 60) || "补充") + "_" + String(date || "") + ".md";
		}
		/** 章节体（按 `re` 认标题）→ 固定段 + 认不出来的「其他章节」 */
		function splitSections(text, specs) {
			const found = {};
			const extra = [];
			for (const s of parseMdSections(text)) {
				const hit = specs.filter((sp) => sp.re.test(s.title))[0];
				if (hit && !found[hit.key]) found[hit.key] = {
					key: hit.key,
					label: hit.label,
					title: s.title,
					body: s.body
				};
				else extra.push({
					title: s.title,
					body: s.body
				});
			}
			const sections = specs.map((sp) => found[sp.key] || {
				key: sp.key,
				label: sp.label,
				title: "",
				body: "",
				present: false
			});
			for (const s of sections) if (s.present === void 0) s.present = !!s.title;
			return {
				sections,
				extra,
				missing: sections.filter((s) => !s.present).map((s) => s.label)
			};
		}
		/** md 表格 → 行（`| a | b | c |`；跳过分隔行） */
		function mdTableRows(body) {
			const rows = [];
			for (const line of String(body || "").split(/\r?\n/)) {
				const t = line.trim();
				if (t.charAt(0) !== "|") continue;
				const cells = t.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
				if (cells.every((c) => /^:?-{2,}:?$/.test(c) || c === "")) continue;
				rows.push(cells);
			}
			return rows;
		}
		/** 一级标题（`# xxx`）—— 文档标题，不进章节 */
		function docTitle(text) {
			const m = /^#\s+(.+)$/m.exec(String(text || ""));
			return m ? m[1].trim() : "";
		}
		/**
		* `> 原话：「…」` 那一行 —— **逐字**取出来（这是"AI 有没有改动我的结论"的唯一凭据）。
		*
		* 认三种写法（都取整行原文）：`> 原话：「…」` / `> 原话：…` / `> 原话: "…"`。
		* @returns `{ raw, text, found }` · `raw` = 整行原文（含 `> 原话：`），`text` = 引导语之后的部分（逐字）
		*/
		function parseQuote(text) {
			const lines = String(text || "").split(/\r?\n/);
			for (const line of lines) {
				const m = /^>\s*原话\s*[:：]\s*(.*)$/.exec(line.trim());
				if (m) return {
					raw: line.trim(),
					text: m[1].trim(),
					found: true
				};
			}
			return {
				raw: "",
				text: "",
				found: false
			};
		}
		/**
		* 旧文档分析（设计 §4.2.1）→ 视图模型。
		*
		* @returns `{ name, kind, front, title, sections, reuse, extra, missing, raw }`
		*   · `sections` 恒有四段（`present:false` = 这一段缺了，面板**如实说缺**，不静默）
		*   · `reuse.rows` = 「可复用条目」表格的 `旧文档位置 | 内容 | 去向`
		*   · `raw` = 「原文（转换后）」的正文（追溯用）
		*/
		function parseLegacyAnalysis(text, name) {
			const body = String(text || "");
			const front = parseFrontmatter(body) || {};
			const split = splitSections(body, LEGACY_SECTIONS);
			const reuse = split.sections.filter((s) => s.key === "reuse")[0] || { body: "" };
			const rawSec = split.sections.filter((s) => s.key === "raw")[0] || { body: "" };
			return {
				name: String(name || ""),
				kind: "legacy",
				front,
				docType: String(front.doc_type || ""),
				topic: String(front.topic || ""),
				source: String(front.source || ""),
				analyzedAt: String(front.analyzed_at || ""),
				title: docTitle(body),
				sections: split.sections,
				reuse: {
					header: mdTableRows(reuse.body)[0] || [],
					rows: mdTableRows(reuse.body).slice(1)
				},
				extra: split.extra,
				missing: split.missing,
				raw: String(rawSec.body || "")
			};
		}
		/**
		* 人工补充（设计 §4.2.2）→ 视图模型。
		*
		* @returns `{ name, kind, front, title, quote, conclusion, bounds, landing, sections, extra, missing }`
		*   · `quote` = `> 原话：…` 那一行（逐字）；`conclusion` = 「结论」段正文 —— 面板把这两个**并排**显示
		*/
		function parseHumanNote(text, name) {
			const body = String(text || "");
			const front = parseFrontmatter(body) || {};
			const split = splitSections(body, NOTE_SECTIONS);
			const body1 = (k) => {
				const s = split.sections.filter((x) => x.key === k)[0] || { body: "" };
				return String(s.body || "");
			};
			return {
				name: String(name || ""),
				kind: "humannote",
				front,
				docType: String(front.doc_type || ""),
				topic: String(front.topic || ""),
				confidence: String(front.confidence || ""),
				date: String(front.date || ""),
				author: String(front.author || ""),
				title: docTitle(body),
				quote: parseQuote(body),
				conclusion: body1("conclusion"),
				bounds: body1("bounds"),
				landing: body1("landing"),
				sections: split.sections,
				extra: split.extra,
				missing: split.missing
			};
		}
		/** 交接件 JSON 的来源 skill（`sr-analysis` / `sr-concept`）—— 只看这一处，不做别的推断 */
		function sourceSkillOf(jsonText) {
			const m = /"source_skill"\s*:\s*"([^"]*)"/.exec(String(jsonText || ""));
			return m ? m[1] : "";
		}
		/**
		* 一条分析产物属于哪个入口（设计 §4.1 的产出表 + 产出规范 v1 §五）。
		*
		* 判据顺序（**不猜**）：文件名前缀（两种新格式）→ md 规范名（`mdspec` 的六种）
		* → 交接件看它自己的 `source_skill` 字段（认不出就归「其他/来源未知」，不硬塞进某一路）。
		*/
		function entryOfAnalysis(name, sourceSkill) {
			const base = String(name == null ? "" : name).split(/[\\/]/).pop() || "";
			const k = analysisDocKind(base);
			if (k) return k;
			if (/^issue-cards_/i.test(base)) return "analysis";
			const spec = mdSpecOf(base);
			if (spec) {
				const n = String(spec.name || "");
				if (n === "体验报告" || n === "复刻规格" || n === "证据索引") return "analysis";
				if (n === "设计核三角报告" || n === "功能设计稿") return "concept";
			}
			if (/^sr-gdd-handoff_/i.test(base)) {
				const s = String(sourceSkill || "");
				if (s === "sr-analysis") return "analysis";
				if (s === "sr-concept") return "concept";
				return "other";
			}
			return "other";
		}
		/**
		* 分析产物清单 → 按四入口分组的「已有的分析结论」。
		*
		* @param files `[{ name, rel, subdir?, skill? }]`（`skill` = 交接件 JSON 里读到的 `source_skill`）
		* @returns `{ entries, other, counts }` —— `entries` 恒有四组（空组也如实出现：0 条 = "这一路还没走过"）
		*/
		function groupAnalyses(files) {
			const list = Array.isArray(files) ? files : [];
			const entries = ENTRANCES.map((e) => ({
				id: e.id,
				label: e.label,
				count: 0,
				files: []
			}));
			const other = [];
			for (const f of list) {
				const id = entryOfAnalysis(f && f.name, f && f.skill);
				const g = entries.filter((e) => e.id === id)[0];
				if (g) {
					g.files.push(f);
					g.count++;
				} else other.push(f);
			}
			const counts = {};
			for (const e of entries) counts[e.id] = e.count;
			return {
				entries,
				other,
				counts,
				total: list.length
			};
		}
		//#endregion
		//#region src/pure/intake.ts
		/**
		* 收件箱纯逻辑：素材解析 / 主题派生 / 指令组装
		*
		* ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
		*   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
		* 这一份原来内联在 client.js 里（因为当时只能有一个文件）；现在它是真模块，legacy 的两份副本与防漂移比对脚本随之删除。
		*
		* ★ 工单 23（头脑风暴工作面）**加了一组新入口**（`buildBrainstormInstruction`）：
		*   竞品分析 / 问答式访谈 / 旧文档分析 / 人工补充 —— 与老收件箱的四种方式**不是同一套语义**
		*   （老方式 3/4 只登记进 `inbox\`；新入口的产出全部落功能目录的 `analysis\`，且旧文档分析 / 人工补充
		*   有**固定格式**，见设计 §4.2）。
		*
		* ★ 工单 24（文档生成工作面）继续照这条纪律走：动作表与三段式组装器都在 `./draftstep.ts`，
		*   这里只 **re-export**（`DRAFT_ACTIONS` / `buildDraftInstruction`）—— 面板侧读 `INTAKE` 就够，
		*   不会出现"client.js 里再抄一份"的第二份实现。
		*
		* ★ v5（重写）：**文档生成工作面整屏删除** ⇒ 上面那条 re-export（以及 `./draftstep.ts` 整个模块）
		*   一并删掉。这个模块现在只有一件事：**头脑风暴四入口的指令组装**。
		*   四入口的**表**仍然只有一份（`./analysisdoc.ts` 的 `ENTRANCES`，这里 re-export 成
		*   `BRAINSTORM_KINDS`）—— 界面卡片、前置条件、"已有的分析结论"的归类都读它。
		*
		* ★ 工单 31（收口）：**老收件箱那一组删掉了** —— `INTAKE_KINDS`（四种方式的表）与
		*   `buildInstruction`（四种方式的组装器），以及只被它们引用的 `DOC_EXT` / `TEXT_EXT` /
		*   `isDoc` / `isTextExt` / `safeName` / `extOf`。
		*   它们当时被"原样保留"的唯一理由是**设计资产屏还在用**（见本文件原来的注释）；那一屏属被砍的
		*   「设计资产」模块（设计 §3.4），随本票删除、面板侧的内联副本也早已接到这一份 ⇒ 引用清零。
		*   现在这份模块**只有一种做法**：头脑风暴四入口 + 文档生成的动作表。
		*/
		const INTAKE = (function() {
			const isWinAbs = (p) => /^[A-Za-z]:[\\/]/.test(p) || /^\\\\/.test(p) || /^[\\/]/.test(p);
			const isHttp = (p) => /^https?:\/\//i.test(p);
			/** 路径统一成 Windows 反斜杠（指令里给 agent 看的形态） */
			const winOf = (p) => String(p == null ? "" : p).replace(/\//g, "\\").replace(/\\+$/, "");
			/** 单个素材字符串 → [{ kind, path|text }] */
			function parseMaterial(raw) {
				const s = String(raw == null ? "" : raw).trim();
				if (s === "") return [];
				if (isHttp(s)) return [{
					kind: "url",
					path: s
				}];
				if (isWinAbs(s)) {
					const bare = s.replace(/[\\/]+$/, "");
					return [{
						kind: /^[A-Za-z]:$/.test(bare) || /^\\\\[^\\]+$/.test(bare) || !/\.[A-Za-z0-9]{1,8}$/.test(bare) ? "dir" : "file",
						path: bare
					}];
				}
				return [{
					kind: "text",
					text: s
				}];
			}
			/** 文本块 → 素材数组（按行拆：绝对路径/URL 逐行成项，其余并为 text） */
			function parseMaterials(raw) {
				const out = [];
				const pending = [];
				const flush = () => {
					const t = pending.join("\n").trim();
					if (t !== "") out.push({
						kind: "text",
						text: t
					});
					pending.length = 0;
				};
				for (const line of String(raw == null ? "" : raw).split(/\r?\n/)) {
					const t = line.trim();
					if (t !== "" && (isWinAbs(t) || isHttp(t))) {
						flush();
						for (const it of parseMaterial(t)) out.push(it);
					} else pending.push(line);
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
			/** 从素材派生功能主题（去扩展名、去日期、去尾部噪音） */
			function deriveTopic(materials) {
				const list = materials || [];
				const pick = list.filter((m) => m && (m.kind === "file" || m.kind === "dir"))[0] || list.filter((m) => m && m.kind === "url")[0] || list.filter((m) => m && m.kind === "text")[0];
				if (!pick) return "";
				let n;
				if (pick.kind === "url") n = String(pick.path).replace(/^https?:\/\//i, "").split(/[/?#]/).filter((x) => x !== "")[0] || "";
				else if (pick.kind === "text") n = String(pick.text || "").split(/\r?\n/)[0];
				else n = baseName(pick.path || "");
				if (pick.kind === "dir") return n;
				n = n.replace(/\.[A-Za-z0-9]{1,8}$/, "");
				n = n.replace(/[_\-\s]*\d{8}(?:[_\-\s.]|$)/, " ");
				n = n.replace(/[_\-\s]*(定稿_审查|定稿|审查|宣讲|修订点|UIUE|UI|md版本|人读版|设计稿|初稿|草案)$/, "");
				n = n.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
				return n;
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
			/**
			* ★ 工单 23 · 头脑风暴四入口各自的指令（设计 §4.1 / §4.2）。
			*
			* 与已被工单 31 删掉的老 `buildInstruction` 的三点不同（那是**另一套语义**，不是这里的改写）：
			*   ① 产出落到**这个功能自己的** `features\<主题>\analysis\`（不是工作区根的 `inbox\`）；
			*   ② 旧文档分析 / 人工补充有**固定格式**（四段章节 / `> 原话：` + 结论 + 边界 + 落点）；
			*   ③ 前置不满足时**连"下一步怎么做"一起给**（`blocked` + `next`）—— 缺前提不静默。
			*
			* ★ 文件名的唯一出处是 `./analysisdoc.ts` 的 `legacyDocName` / `humanNoteName`：
			*   指令里写下的名字，必须与读取侧（`analysisDocKind`）认得的名字一致。
			* ★ `date` 由调用方给（面板用今天）—— 纯函数不吃时钟，测试才能逐字断言。
			*/
			function buildBrainstormInstruction(kind, input) {
				const inp = input || {};
				const e = ENTRANCES.filter((x) => x.id === kind)[0];
				if (!e) return {
					instruction: "",
					blocked: "未知的头脑风暴入口：" + String(kind),
					next: "四个入口是：竞品分析 / 问答式访谈 / 旧文档分析 / 人工补充。"
				};
				const materials = inp.materials || [];
				const note = String(inp.note == null ? "" : inp.note).trim();
				const root = winOf(inp.root);
				const date = String(inp.date || "");
				const topic = String(inp.topic || "").trim() || deriveTopic(materials);
				if (root === "") return {
					instruction: "",
					blocked: "拿不到这个功能的功能目录（`features\\<主题>\\`）。",
					next: "从「功能详情 › 头脑风暴」进来再发一次 —— 指令要发给该功能的专属工作会话（cwd = 功能目录）。"
				};
				const outDir = root + "\\analysis";
				const srcDir = root + "\\evidence";
				const tail = "阶段交给了 skill / 会话里的 AI：" + e.handoff.replace(/（面板不重画流程）$/, "") + " —— 有决策门就停下来等我拍板，不要自己往下走。";
				if (kind === "analysis") {
					if (!hasPathMaterial(materials)) return {
						instruction: "",
						blocked: "「竞品分析」需要一份素材：目录、文件路径或链接（截图 / 录屏 / PV / 商店页）。",
						next: "在「素材」里粘一条本机绝对路径或链接；纯文字不会被当成素材（要写文字请走「人工补充」或「问答式访谈」）。"
					};
					const L = [
						"【头脑风暴 · 竞品分析】请执行 `/sr-analysis`（走 `/sr-analysis <素材路径或链接>` 的正常调用，不要改动该 skill）。",
						"素材：",
						describeMaterials(materials),
						"分析目标：" + (note || "（未指定——按 sr-analysis 第 1 步 VOI 门现场确认）")
					];
					if (topic) L.push("功能主题（用于产出命名与归档）：" + topic);
					L.push("产出落点：" + outDir + "\\（文件名按 sr-analysis 自己的产出规范：experience-report_*.md / issue-cards_*.json / replication-spec_*.md / sr-gdd-handoff_*.json；证据包落 " + root + "\\evidence\\）");
					L.push(tail);
					return {
						instruction: L.join("\n"),
						blocked: "",
						next: ""
					};
				}
				if (kind === "concept") {
					const seed = note || (materials.filter((m) => m.kind === "text")[0] || {}).text || "";
					if (String(seed).trim() === "") return {
						instruction: "",
						blocked: "「问答式访谈」需要一句创意：在输入框里写下你想做的玩法或功能。",
						next: "在「一句话创意」里写一句（比如：联盟成员一起打 BOSS，血量全盟共享）；有参考素材就把路径一并粘上。"
					};
					const pathMats = materials.filter((m) => m.kind !== "text");
					const L = ["【头脑风暴 · 问答式访谈】请执行 `/sr-concept`（走 `/sr-concept <一句话创意>` 的正常调用，不要改动该 skill）。", "创意：" + String(seed).replace(/\s+/g, " ").trim()];
					L.push(pathMats.length > 0 ? "已有材料（有就给路径）：" : "已有材料：没有。");
					if (pathMats.length > 0) L.push(describeMaterials(pathMats));
					if (topic) L.push("功能主题（用于产出命名与归档）：" + topic);
					L.push("产出落点：" + outDir + "\\（concept-triage_*.md → feature-concept_*.md → sr-gdd-handoff_*.json，文件名按 sr-concept 自己的产出规范）");
					L.push("定位：本项目（文明之跃）新功能/新玩法。");
					L.push(tail);
					return {
						instruction: L.join("\n"),
						blocked: "",
						next: ""
					};
				}
				if (kind === "legacy") {
					const pathMats = materials.filter((m) => m.kind === "file" || m.kind === "dir");
					if (pathMats.length === 0) return {
						instruction: "",
						blocked: "「旧文档分析」需要旧文档的路径（旧策划案 / 脑图 / 表格；目录或单个文件都行）。",
						next: "把旧文档拖进来，或粘它的本机绝对路径（.docx / .xlsx / .md / .pdf 都可）。"
					};
					const produced = legacyDocName(String(inp.name || "").trim() || deriveTopic(pathMats) || "旧文档", date);
					const L = [
						"【头脑风暴 · 旧文档分析】把这份旧文档**转换 + 分析**后落成固定格式（不要整份照抄成 md —— 分析这一步的价值是给出可用的结论）。",
						"旧文档：",
						describeMaterials(pathMats),
						"步骤：",
						"1) 原件进原料桶：若它不在 " + srcDir + "\\ 下，先把原件（**保持原文件名**）放进 " + srcDir + "\\，此后原件只存这里、不再往别处复制。",
						"2) 产出 " + outDir + "\\" + produced + "，frontmatter 必须是：",
						"---",
						"doc_type: legacy_analysis",
						"topic: " + (topic || "<功能主题>"),
						"source: evidence/<原件文件名>",
						"analyzed_at: " + (date || "<YYYYMMDD>"),
						"---",
						"（`source:` 指向原件在 `evidence\\` 里的位置 —— 产出文档的身份信息必须指回原件。）",
						"3) 正文按**四段固定章节**，标题逐字用这几个、一个都不少：",
						"## 仍然有效的结论",
						"## 已废弃 / 不适用",
						"## 可复用条目（表格：旧文档位置 | 内容 | 去向）",
						"## 原文（转换后）（保留章节结构的全文，放在文件末尾 —— 追溯时要能回到原始表述，但不能挡着结论）",
						"4)「已废弃 / 不适用」的每一条**都要写理由**（否则下次还会有人把废弃结论捡回来）；某一节没有内容就写「（无）」，不要删掉这一节。",
						tail
					];
					if (note) L.push("补充说明：" + note);
					return {
						instruction: L.join("\n"),
						blocked: "",
						next: ""
					};
				}
				if (kind === "humannote") {
					const title = String(inp.title || "").trim();
					const quote = String(inp.quote == null ? "" : inp.quote).trim();
					if (title === "") return {
						instruction: "",
						blocked: "「人工补充」需要一个标题（它同时是产出文件名与文档一级标题）。",
						next: "在「标题」里写一句话，比如：BOSS 血量按联盟共享。"
					};
					if (quote === "") return {
						instruction: "",
						blocked: "「人工补充」需要你的原话 —— 原话是这份文档唯一的结论来源。",
						next: "把你想说的那句原话写进「原话（逐字保留）」；AI 只整理格式，不改你的结论。"
					};
					const bounds = String(inp.bounds == null ? "" : inp.bounds).trim();
					const landing = String(inp.landing == null ? "" : inp.landing).trim();
					const author = String(inp.author == null ? "" : inp.author).trim();
					const confidence = String(inp.confidence || "high").trim();
					const produced = humanNoteName(title, date);
					const L = [
						"【头脑风暴 · 人工补充】把我的原话整理成 " + outDir + "\\" + produced + "（**只整理格式，不许改动结论**）。",
						"标题：" + title,
						"我的原话（**逐字保留**，不许改写、不许摘要、不许润色）：",
						"「" + quote + "」"
					];
					if (bounds) L.push("边界（我给的，照抄进「边界」）：" + bounds.replace(/\s+/g, " "));
					if (landing) L.push("落点（我给的，照抄进「落点」）：" + landing.replace(/\s+/g, " "));
					L.push("产出格式：", "---", "doc_type: human_note", "topic: " + (topic || "<功能主题>"), "confidence: " + confidence + "          # high | pending（pending = 需补证据或验证，下游引用时要带标记）", "date: " + (date || "<YYYYMMDD>"), "author: " + (author || "<谁说的>"), "---", "", "# " + title, "", "> 原话：「" + quote + "」", "", "## 结论", "<把原话整理成可被下游消费的规则口径 —— 原话本身就是结论，你只能让它更清楚，不能改它的意思>", "", "## 边界", "- <我给了就照抄；没给写「（待定）」并在会话里问我>", "", "## 落点", "- <条目引用，如 §4 R2 BOSS 与难度推进 / §5 UI-M1 UE2 血条区；没给写「（待定）」>", "要求：", "1) `> 原话：…` 那一行**逐字保留**；它与「结论」在面板上是**并排显示**的 —— 我一眼就能看出你有没有改动结论。", "2) 结论里若必须补推断（原话没说到的部分），单独写清补的是哪一步，不要混进原话里。", "3) 边界 / 落点我没给就写「（待定）」并问我，别自己编。", tail);
					return {
						instruction: L.join("\n"),
						blocked: "",
						next: ""
					};
				}
				return {
					instruction: "",
					blocked: "未知的头脑风暴入口：" + String(kind),
					next: "四个入口是：竞品分析 / 问答式访谈 / 旧文档分析 / 人工补充。"
				};
			}
			return {
				BRAINSTORM_KINDS: ENTRANCES,
				parseMaterial,
				parseMaterials,
				baseName,
				deriveTopic,
				describeMaterials,
				hasPathMaterial,
				buildBrainstormInstruction
			};
		})();
		//#endregion
		//#region src/pure/path.ts
		/**
		* 路径归一：相对路径 → 绝对路径
		*
		* ★ 工单 03（WorkspacePort 接缝）从 `src/client.js` **逐字搬来**，只做了整体去缩进与补 export；
		*   正文一字未改（行为不变的证据：临时 harness 对真实工作区数据做迁移前后 deepEqual）。
		* rel 可能已经是绝对路径（openPath 存的是绝对路径），无条件前缀 cwd 会拼出 `D:\X/D:\X\…`。
		*/
		function toAbs(cwd, rel) {
			if (!rel) return "";
			let p = String(rel);
			const isWinAbs = /^[A-Za-z]:[\\/]/.test(p);
			if (!(isWinAbs || /^[\\/]/.test(p) || /^\\\\/.test(p))) p = (cwd ? String(cwd).replace(/[\\/]+$/, "") + "\\" : "") + p;
			if (isWinAbs || /^[A-Za-z]:/.test(p)) p = p.replace(/\//g, "\\");
			return p;
		}
		//#endregion
		//#region src/pure/reltime.ts
		/**
		* 相对时间（`3 分钟前`）：**纯函数**，判据可测。
		*
		* ── 为什么不用宿主 primitives 的 `relativeTime` ──────────────────────────────
		*   它返回的是 `{ unit: "minutes", n: 3 }` —— **结构化结果，还要调用方自己做本地化**
		*   （中文/英文词形得自己写）。既然词形总得自己写，那不如整支自己写：纯函数、
		*   同一个 `now` 进来结果一样，能进单测。
		*
		* ★ 单位档位与宿主那份**保持一致**（now / minutes / hours / days / months / years，
		*   阈值 1 分 / 1 时 / 1 天 / 30 天 / 365 天）—— 免得同一个时间在面板与宿主里说法不同。
		*
		* ── 判据（都会在 `test/pure-reltime.test.ts` 里钉住）────────────────────────
		*   · 未来时间戳（时钟偏差）**夹到"刚刚"**，不显示"负 3 分钟前"；
		*   · 解析不出来的时间戳返回空串 —— 界面据此**不显示**这一行，而不是显示一句假话。
		*/
		/** 宿主那套阈值（毫秒）。 */
		const MIN = 6e4;
		const HOUR = 60 * MIN;
		const DAY = 24 * HOUR;
		const MONTH = 30 * DAY;
		const YEAR = 365 * DAY;
		/** 解析 `YYYY-MM-DD HH:mm:ss`（也接受 `YYYY-MM-DDTHH:mm:ss`），失败返回 `null`。 */
		function parseStamp(stamp) {
			const s = String(stamp === null || stamp === void 0 ? "" : stamp).trim();
			if (s === "") return null;
			const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
			if (!m) return null;
			const [y, mo, da, h, mi, se] = [
				Number(m[1]),
				Number(m[2]),
				Number(m[3]),
				Number(m[4]),
				Number(m[5]),
				Number(m[6] || "0")
			];
			const d = new Date(y, mo - 1, da, h, mi, se);
			if (isNaN(d.getTime())) return null;
			/**
			* ★ **回读比对**：`new Date` 对越界分量会自行进位（`2026-13-45 99:99:99` 会变成 2027 年 2 月），
			*   所以"能构造出 Date"不等于"这个时间戳合法"。逐分量比一遍，不合法就返回 null ——
			*   界面据此**不显示**这一行，而不是编一个假时间出来。
			*/
			if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da || d.getHours() !== h || d.getMinutes() !== mi || d.getSeconds() !== se) return null;
			return d.getTime();
		}
		/**
		* `3 分钟前` / `2 小时前` / `5 天前` / `3 个月前` / `2 年前` / `刚刚`。
		* @param stamp 决策记录里的时间戳（`YYYY-MM-DD HH:mm:ss`）。
		* @param now 参照时刻（默认现在；用例里传固定值）。
		* @returns 人话；**解析不出来就返回空串**（界面据此不显示，不编）。
		*/
		function relTimeOf(stamp, now) {
			const at = parseStamp(stamp);
			if (at === null) return "";
			const ref = now instanceof Date ? now.getTime() : Date.now();
			const diff = Math.max(0, ref - at);
			if (diff < MIN) return "刚刚";
			if (diff < HOUR) return Math.floor(diff / MIN) + " 分钟前";
			if (diff < DAY) return Math.floor(diff / HOUR) + " 小时前";
			if (diff < MONTH) return Math.floor(diff / DAY) + " 天前";
			if (diff < YEAR) return Math.floor(diff / MONTH) + " 个月前";
			return Math.floor(diff / YEAR) + " 年前";
		}
		//#endregion
		//#region src/ui/tokens.js
		/**
		* 面板的**设计令牌** —— 唯一参数源（界面美化 P0）。
		*
		* ── 为什么要它 ──────────────────────────────────────────────────────────
		*   改之前，`client.js` 里同时存在 **11 种间距**（2/3/4/5/6/7/8/9/10/12/13/14）与
		*   **9 种字号**（10.5…17）—— "不好看"的根因不是配色，是**没有刻度**。
		*   从这一版起：**面板里不许再写裸数字**，要间距/字号/圆角就引用这里。
		*
		* ── 与宿主的关系（硬边界，别越界）────────────────────────────────────────
		*   · 颜色**一律走宿主令牌**（`--dsw-alias-*`，14 支）—— 只在 `COLOR.accent*` 破例一支蓝：
		*     宿主契约里**没有蓝**（`brand-primary` 实测是中性墨色），而链接与主按钮需要一支明确的蓝。
		*   · 圆角/字号/间距是面板自己的事，不需要宿主令牌。
		*
		* ── 怎么用 ──────────────────────────────────────────────────────────────
		*   `import { GAP, FONT, RADIUS, LINE, SHADOW, COLOR, MOTION } from "./ui/tokens.js";`
		*   然后 `style: { padding: GAP.md, fontSize: FONT.body, borderRadius: RADIUS.card }`。
		*
		* ── 口径（P0 的"零视觉变化"怎么做到的）──────────────────────────────────
		*   P0 **只把"已经落在刻度上"的字面量换成令牌**（如 `"12.5px"` → `FONT.body`），
		*   不在刻度上的（如 `"10.5px"` / `"7px"`）**原样留着**，等各自那一屏的美化批次再归位
		*   （P1 卡片墙 / P2 决策时间线 / …）。这样这一批跑完，渲染出来的字一个都不会变 ——
		*   渲染冒烟的"每遍字符数"前后一致就是判据。
		*/
		/** 间距刻度（8 基准）。 */
		const GAP = {
			/** 4px —— 图标与文字、标签内边距 */
			xs: "4px",
			/** 8px —— 卡片内相邻行、按钮间距 */
			sm: "8px",
			/** 12px —— 卡片内边距、网格间距 */
			md: "12px",
			/** 16px —— 区块之间 */
			lg: "16px",
			/** 24px —— 页面级 */
			xl: "24px"
		};
		/** 字号阶梯（五档）。含数字的元数据请配 `fontVariantNumeric`。 */
		const FONT = {
			/** 11px / 1.5 —— 元数据：件数、路径、时间、提示 */
			meta: "11px",
			/** 12.5px / 1.6 —— 正文 */
			body: "12.5px",
			/** 13px / 1.4 / 600 —— 小标题 */
			title: "13px",
			/** 15px / 1.35 / 600 —— 功能名、模块标题 */
			card: "15px",
			/** 20px / 1.3 / 700 —— 页面标题 */
			page: "20px"
		};
		/** 行高。 */
		const LEADING = {
			meta: 1.5,
			body: 1.6,
			tight: 1.35
		};
		/** 圆角。 */
		const RADIUS = {
			card: "8px",
			control: "5px",
			chip: "3px"
		};
		/** 线宽与外框。 */
		const LINE = {
			/** 1px 分隔线与卡片边线 */
			hair: "1px",
			/** 键盘焦点环（外层 2px 半透明强调色） */
			ring: "2px"
		};
		/** 阴影（克制：悬停一点、浮层一点）。 */
		const SHADOW = {
			hover: "0 2px 8px #0000000f",
			float: "0 6px 20px #00000014"
		};
		/**
		* 颜色：**能走宿主令牌就走令牌**；只有强调蓝是明确色值。
		* `accentSoft` 用于焦点环（带透明度的同色）。
		*/
		const COLOR = {
			/** 强调蓝（浅色主题） */
			accent: "#1a73e8",
			/** 强调蓝（深色主题；`light-dark()` 不可用时退回 `accent`） */
			accentDark: "#6aa9ff",
			/** 焦点环 */
			accentSoft: "#1a73e833",
			/** 白字（放在强调色实底上） */
			onAccent: "#fff"
		};
		//#endregion
		//#region src/pure/configentry.ts
		/**
		* 配置向导的**纯逻辑**（无 IO、无 React）：
		*   · 四个字段的校验（哪些必填、路径形状像不像本机绝对路径）；
		*   · **指针文件**的路径与判据 —— 面板在浏览器里拿不到 `%USERPROFILE%`，
		*     所以让会话写完配置后把**配置的绝对路径**写进 `<工作区根>\.dsh\sr-workbench.path`，
		*     面板读这个相对路径就知道配置在哪（用户口径：A 方案）。
		*   · 交给会话的**写配置指令**正文（逐字，含要写什么、写哪、以及必须回报什么）。
		*
		* ★ 字段口径的权威是技能里的 `config.local.example.json`（`skills/sr-askme/`）。
		*   面板认这四个字段是为了**先校验再发指令**；指令里仍然要求会话**照 example 校对字段形状**，
		*   所以权威没有被复制成第二份判断 —— 面板只做"必填与像不像路径"这一层。
		*/
		/** 配置里的四个字段（顺序即界面顺序；`required` 是本机跑起来的最小集）。 */
		const CONFIG_FIELDS = [
			{
				key: "sr_workspace",
				label: "策划工作区",
				required: true,
				hint: "放功能目录的根：下面会有 features\\<主题>\\"
			},
			{
				key: "sr_project",
				label: "Unity 工程",
				required: true,
				hint: "游戏工程目录（sr 系列读它做对照）"
			},
			{
				key: "config_root",
				label: "策划配置目录",
				required: false,
				hint: "配置表所在目录（只有 /sr-config 用得到）"
			},
			{
				key: "gtgenerator_workdir",
				label: "GTGenerator 工作目录",
				required: false,
				hint: "可选；不填就由技能自己问"
			}
		];
		/** 一个工作区根 → 指针文件的绝对路径。 */
		function pointerPathOf(root) {
			const base = String(root === null || root === void 0 ? "" : root).replace(/[\\/]+$/, "");
			return base === "" ? "" : base + "\\.dsh\\sr-workbench.path";
		}
		/**
		* 这像不像**工作区根**（而不是某个功能目录）。
		* 判据：路径末尾是不是 `features\<主题>` 这一层 —— 指针文件**不能**写进功能目录，
		* 那会污染功能目录（面板会把它如实列成"不是 4 个桶的目录"）。
		*/
		function looksFeatureDir(root) {
			const s = String(root === null || root === void 0 ? "" : root).replace(/[\\/]+$/, "");
			return /[\\/]features[\\/][^\\/]+$/i.test(s);
		}
		/**
		* 指针候选：**先放用户刚填的 `sr_workspace`**（那是确定的工作区根），再放其余已知根里
		* **像工作区根的**（功能目录一律排除）。
		*/
		function pointerCandidates(roots, srWorkspace) {
			const out = [];
			const seen = {};
			const push = (raw, skipFeatureDir) => {
				const s = raw === null || raw === void 0 ? "" : String(raw);
				if (skipFeatureDir && looksFeatureDir(s)) return;
				const p = pointerPathOf(s);
				if (p === "") return;
				const k = p.toLowerCase();
				if (seen[k]) return;
				seen[k] = true;
				out.push(p);
			};
			push(srWorkspace, false);
			for (const r of roots || []) push(r, true);
			return out;
		}
		/**
		* 像不像一条**本机绝对路径**（Windows：`D:\...` 或 UNC `\\server\share`；也接受正斜杠写法）。
		* ★ 只做形状判断，**不判存在性** —— 存在性只有会话那边能验（它才有文件系统）。
		*/
		function looksAbsolutePath(v) {
			const s = String(v === null || v === void 0 ? "" : v).trim();
			if (s === "") return false;
			if (/^[A-Za-z]:[\\/]/.test(s)) return true;
			if (/^\\\\[^\\/]+[\\/][^\\/]+/.test(s)) return true;
			return false;
		}
		/** 校验整张表：必填没填 / 形状不像绝对路径。 */
		function validateConfigValues(values) {
			const issues = [];
			for (const f of CONFIG_FIELDS) {
				const raw = String((values || {})[f.key] === null || (values || {})[f.key] === void 0 ? "" : (values || {})[f.key]).trim();
				if (raw === "") {
					if (f.required) issues.push({
						key: f.key,
						message: f.label + " 必填"
					});
					continue;
				}
				if (!looksAbsolutePath(raw)) issues.push({
					key: f.key,
					message: f.label + " 要填本机绝对路径（如 D:\\...）"
				});
			}
			return {
				ok: issues.length === 0,
				issues
			};
		}
		/** 交给会话的**写配置指令**（逐字；会话是唯一写盘者）。 */
		function buildConfigInstruction(input) {
			const v = input.values || {};
			const lines = [];
			lines.push("【策划工作台 · 写本机配置】请**只做这一件事**：把下面这份配置写到本机，然后回报一行。");
			lines.push("");
			lines.push("配置内容（JSON，字段形状照技能目录里的 `config.local.example.json` 校对）：");
			lines.push("```json");
			lines.push(JSON.stringify({
				sr_workspace: String(v.sr_workspace || "").trim(),
				sr_project: String(v.sr_project || "").trim(),
				config_root: String(v.config_root || "").trim(),
				gtgenerator_workdir: String(v.gtgenerator_workdir || "").trim(),
				configured_at: input.stamp
			}, null, 2));
			lines.push("```");
			lines.push("");
			lines.push("写到哪：");
			if (input.configPathHint) {
				lines.push("  " + input.configPathHint);
				lines.push("  （这是面板配好的路径，逐字用）");
			} else {
				lines.push("  `$env:USERPROFILE\\.dsh\\sr-workbench\\config.local.json`");
				lines.push("  （目录不存在先建；这是**本机私有**文件，不要放进任何技能目录 —— 技能随插件在 node_modules 下，放那儿升级即丢）");
			}
			lines.push("");
			if (input.pointerPaths.length > 0) {
				lines.push("再把**配置的绝对路径**（就是你刚写的那个文件的完整路径）写进下面这些指针文件，每行一个：");
				for (const p of input.pointerPaths) lines.push("  " + p);
				lines.push("（每个文件只写一行：那个绝对路径。目录不存在先建。面板靠它认路 —— 浏览器里拿不到家目录。）");
				lines.push("");
			}
			lines.push("还要做的：");
			lines.push("· 若 `sr_workspace` 目录不存在就建出来（`New-Item -ItemType Directory -Force`）。");
			lines.push("· **不要**改动配置里没有的键；**不要**动别的目录。");
			lines.push("· 跑完**只回报一行**：`OK <配置绝对路径>` 或 `FAILED <原因>`。");
			return lines.join("\n");
		}
		/**
		* **面板的硬判据**：工作区锚点有没有。
		*
		* ★ 只有它是硬要求 —— 面板列卡片、读决策、看产物全靠它。
		*   `sr_project` / `config_root` 是**技能侧**的要求（缺了技能会问），
		*   面板不该因为缺它们就把整个界面换成向导（2026-10-09 实测：那会把新建功能一起挡掉）。
		*/
		function workspaceMissing(cfg) {
			const c = cfg || {};
			return String(c.sr_workspace === null || c.sr_workspace === void 0 ? "" : c.sr_workspace).trim() === "";
		}
		//#endregion
		//#region src/ui/atoms.js
		/**
		* 官方 UI 原子库的**唯一引入点**（薄封装）—— `@deepseek-ai/dsh-client-ui-primitives`。
		*
		* ── 为什么要有这一层 ────────────────────────────────────────────────────────
		*   ① **一处引入**：整个插件只有这个文件认识 primitives。它是 `0.2.0-rc.2`（rc 版），
		*      DSH 升级可能改 API —— 换版只改这一个文件，面板各处不用动。
		*   ② **守卫式取用**：用 `typeof require === "function"` + `try/catch` 拿，**拿不到就退回自绘**。
		*      绝不能因为"宿主没给这个包"就让整个面板加载失败（那是白屏级别的事故）。
		*      官方插件是直接 `import` 的（`dsh-client-ui-plan` 就写着
		*      `require("@deepseek-ai/dsh-client-ui-primitives")`）—— 它们的包与宿主同批发布，
		*      而我们是**第三方插件**，所以按"可选依赖"处理。
		*   ③ 拿不到时**如实记下原因**（`PRIMITIVES_WHY`），供诊断与冒烟断言用。
		*
		* ── 这个 require 为什么能跑通 ───────────────────────────────────────────────
		*   产物是 CJS，外壳是 `window.__ModuleLoader__.load({ factory: (require) => { … } })` ——
		*   `require` 是**外壳传进来的参数**，指向宿主的模块表。所以这份源码里的 `require("…")`
		*   在运行期真能取到宿主自己那份 primitives（与 `require("react")` 同一条路）。
		*   ★ 不要在这里写 `import`：静态 import 会让"包不在"变成**加载期抛错**，整个插件装不上。
		*
		* ── 拿到之后能用什么（2026-10-09 读 `lib/index.js` 与 `lib/*.module.css` 得知）──────
		*   · `Button { variant: "primary"|"ghost", size: "sm"|"md", icon, … }`
		*   · `Tag { tone }` · `Pill { active, onClick }` · `StateDot { state }`
		*   · `SegmentedTabs { items:[{value,id,label}], value, onChange, label }`（键盘与 ARIA 都在里面）
		*   · `DisclosureRow` · `HoverCard` · `Tooltip` · `Modal` · `Toast` · `Input`
		*   · `MarkdownText { text, variant:"body" }` · `CodeBlock` · `JsonBlock` / `JsonTree`
		*   · `PathLabel { path }` · `FileTypeIcon` · `ImageLightbox` · `Icon*`（约 150 个，Medium/Regular 两档）
		*   · 工具：`writeClipboard` · `relativeTime` · `fileSizeText`
		*/
		/**
		* 取一次（**只取一次**：模块表在一个页面里不会变）。
		* ★ 写成"返回一个带 why 的对象"而不是"先声明后赋值"：后者会被 rolldown 当成死存储删掉
		*   （实测：`if (primitives === null) why = …` 被 DCE 成了 `if (primitives === null);`），
		*   于是诊断信息莫名其妙丢了。
		*/
		function load() {
			try {
				if (typeof require !== "function") return {
					mod: null,
					why: "这个环境里没有 require（不在 ModuleLoader 外壳里跑）"
				};
				const mod = require("@deepseek-ai/dsh-client-ui-primitives") || null;
				return {
					mod,
					why: mod === null ? "模块表里没有这个包（require 返回空）" : ""
				};
			} catch (e) {
				return {
					mod: null,
					why: "require 抛错：" + String(e && e.message || e)
				};
			}
		}
		const loaded = load();
		/** 宿主那份 primitives 模块（拿不到就是 `null`）。**只有这个文件该碰它。** */
		const PRIMITIVES = loaded.mod;
		/** 拿不到的原因（拿得到时是空串）—— 诊断与冒烟断言用。 */
		const PRIMITIVES_WHY = loaded.why;
		/**
		* 这个值能不能当组件渲染。
		*
		* ★ **真踩过**（插件 5.1.0 → 5.1.1）：`Button` 是 `forwardRef(...)` 的产物、`MarkdownText` 是
		*   `memo(...)` 的产物 —— 两者都是**对象**（`{ $$typeof: Symbol(react.forward_ref), render }`），
		*   **不是函数**。第一版判据只认 `typeof === "function"`，于是真机上明明 require 到了 primitives，
		*   却被判成"没拿到"、整片退回自绘 —— 界面底部那行还写着"未知原因"（因为 `why` 只在真失败时才有）。
		*/
		function isComponent(v) {
			if (typeof v === "function") return true;
			if (v === null || typeof v !== "object") return false;
			return typeof v.$$typeof === "symbol";
		}
		/** 关键组件齐不齐（只认我们真会用的那几个；缺一个就整体退回自绘）。 */
		const HAS_PRIMITIVES = !!(PRIMITIVES && isComponent(PRIMITIVES.Button) && isComponent(PRIMITIVES.Tag) && isComponent(PRIMITIVES.MarkdownText));
		/** 给人看的一句话（面板底部/诊断用）。 */
		function primitivesNote() {
			return HAS_PRIMITIVES ? "UI：宿主组件库（官方 primitives）" : "UI：自绘控件（拿不到宿主组件库 —— " + (PRIMITIVES_WHY || "未知原因") + "）";
		}
		//#endregion
		//#region src/pure/sessionpick.ts
		/**
		* 「索引会话」的选择 —— 把"面板该用哪条会话"变成**纯函数**（零依赖、零全局）。
		*
		* 为什么需要它（工单 32 · DSH 0.2.0 兼容）：
		*   · 0.1.5 的会话列表快照里有 `current`（用户当前选中的会话），面板直接拿它当 sessionId；
		*   · 0.2.0 **没有 `current` 了** —— "当前会话"改成由 `byId[id].retainedBy.mainView > 0` 表达
		*     （官方 `dsh-client-ui-layout` 与 `dsh-client-ui-workspace` 都是这么算的），
		*     于是面板永远拿不到 sessionId ⇒ 永远停在「先在左侧选一个会话…」。
		*   · 规格（ADR 0005 / 工单 07）本来就要面板**不跟随当前选中会话**：它自己认领或创建一条
		*     cwd 覆盖 SR workspace 根的「索引会话」，`list` / `read` 全走它。
		*
		* ★ 本模块只回答"从候选中挑哪一条"，**所有 IO 留在组合根**（`src/client.js`）：
		*   `remote.session.list` / `rename` / `create`、`localStorage` 都不许进 pure 层。
		*
		* ★ 为什么"cwd 覆盖 sr 根"是硬条件：`workspaceFiles.read` 可以读工作区外的文件，
		*   但 `workspaceFiles.list` 被**限定在会话的工作区内**（开发笔记坑 3）。挑一条 cwd 不覆盖
		*   sr 根的会话 ⇒ `features\` 列不出来 ⇒ 看板 0 个功能（还会静默判成"没有功能"）。
		*/
		/** 索引会话的标题（认领凭据；`session.rename` 设定的显式标题不会被自动标题覆盖）。 */
		const INDEX_TITLE = "策划工作台·索引";
		/** 取不到归档集时的那句话（面板照实说，绝不装成"我知道它在侧边栏可见"）。 */
		const NO_ARCHIVE_INFO_NOTE = "取不到侧边栏的「已归档」集（官方 workspaces 快照里没有 archivedSessionIds）：这次无法确认目标会话在侧边栏可见 —— 若发完看不到它，去侧边栏「已归档」里取消归档即可。";
		/** 上次用的那条已被归档时的那句话（归档 ≠ 删除，所以要说清"它不算可用"）。 */
		const ARCHIVED_CACHED_NOTE = "上次用的那条会话已被你在侧边栏归档（归档 ≠ 删除，只是不显示）：它不算可用，这次没用它。";
		/** 归档集合归一成查找用的 Set；**拿不到**（null / undefined / 坏形状）时返回 `null`。 */
		function archivedIdSet(archived) {
			if (archived instanceof Set) {
				const out = /* @__PURE__ */ new Set();
				for (const one of archived) {
					const s = one === null || one === void 0 ? "" : String(one);
					if (s !== "") out.add(s);
				}
				return out;
			}
			if (Array.isArray(archived)) {
				const out = /* @__PURE__ */ new Set();
				for (const one of archived) {
					const s = one === null || one === void 0 ? "" : String(one);
					if (s !== "") out.add(s);
				}
				return out;
			}
			return null;
		}
		/**
		* 这个 id 是不是已归档。
		* ★ **拿不到归档集时一律判否**（= 不排除 = 旧行为）——降级绝不静默：调用方要按
		*   `NO_ARCHIVE_INFO_NOTE` 把"我不知道"如实说出来。
		*/
		function isArchivedId(archived, id) {
			const set = archivedIdSet(archived);
			return set !== null && typeof id === "string" && id !== "" && set.has(id);
		}
		/**
		* 从候选里**剔掉**已归档的那些（它们点不出来：侧边栏不显示）。
		* ★ 拿不到归档集时**原样返回**（向后兼容：不传归档集 = 旧行为）。
		*/
		function withoutArchived(rows, archived) {
			const list = (rows || []).filter((r) => r && r.id);
			const set = archivedIdSet(archived);
			if (set === null) return list;
			return list.filter((r) => !set.has(String(r.id)));
		}
		/**
		* 官方 `workspaces` 客户端服务的**快照** → 归档 id 表。
		* `null` = 这个快照里**没有**归档集（拿不到 ⇒ 调用方如实降级，别当成空表）。
		* 形状判据只有一处（这里），将来官方改字段只改这一个函数。
		*/
		function archivedFromSnapshot(snap) {
			if (!snap || typeof snap !== "object") return null;
			const raw = snap.archivedSessionIds;
			if (!Array.isArray(raw)) return null;
			const out = [];
			for (const one of raw) {
				const s = one === null || one === void 0 ? "" : String(one);
				if (s !== "") out.push(s);
			}
			return out;
		}
		/** 路径归一：统一成反斜杠、去掉尾部分隔符、小写（Windows 大小写不敏感）。 */
		function normPath(p) {
			if (p === null || p === void 0) return "";
			return String(p).replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
		}
		/** 两个路径是不是同一个（Windows 口径）。空值一律判否。 */
		function samePath(a, b) {
			const x = normPath(a);
			const y = normPath(b);
			return x !== "" && x === y;
		}
		/**
		* `root` 是不是 `p` 的祖先（或就是 `p` 本身）。
		* ★ 必须按分隔符判，不能 `startsWith`：`D:\TimeMachine2` 不在 `D:\TimeMachine` 里面。
		*/
		function containsPath(root, p) {
			const r = normPath(root);
			const t = normPath(p);
			if (r === "" || t === "") return false;
			return t === r || t.indexOf(r + "\\") === 0;
		}
		/** 标题是不是本工作台的索引会话（按前缀认领，允许尾部再带说明）。 */
		function isIndexTitle(t) {
			return typeof t === "string" && t.indexOf("策划工作台·索引") === 0;
		}
		/** 一条候选的"名字"：显式标题优先，其次展示名。 */
		function titleOf(row) {
			if (!row) return "";
			if (typeof row.title === "string" && row.title !== "") return row.title;
			if (typeof row.display === "string" && row.display !== "") return row.display;
			return "";
		}
		const num = (v) => typeof v === "number" && isFinite(v) ? v : 0;
		/**
		* 会话行 / 列表项里的**权限预设**读法 —— 形状判据只有这一处。
		*
		* 三种形状（都实测过或由官方源码推出）：
		*   · `session/list` 的行：`it.projections.values.permissions.currentValue`
		*     （投影 `permissions` 的视图是 `selectionSchema = { currentValue: string }`，
		*      见 `dsh-permission-presets/lib/index.js:187-201`）
		*   · 0.2.0 客户端 store 的行：`row.projectionValues.permissions`（**扁平**的 键→视图 表，
		*      见 `dsh-api-session-controller/lib/client.js:3511`）
		*   · 退一步：`row.permissions`（视图本体或裸字符串）
		*
		* 读不到一律返回 `""` —— 调用方要如实说"读不回来"，**不许**把空值当成"它已经不动了"。
		*/
		function presetOfProjections(p) {
			if (!p || typeof p !== "object") return "";
			const bag = p;
			const nested = bag.projections && typeof bag.projections === "object" ? bag.projections.values : void 0;
			const views = [
				bag.values,
				bag.projectionValues,
				nested,
				bag
			];
			for (const v of views) {
				if (!v || typeof v !== "object") continue;
				const perm = v.permissions;
				if (typeof perm === "string" && perm !== "") return perm;
				if (perm && typeof perm === "object") {
					const cur = perm.currentValue;
					if (typeof cur === "string" && cur !== "") return cur;
				}
			}
			return "";
		}
		/** 取 updatedAt 最大的一条（并列时保持原顺序，保证确定性）。 */
		function newest(rows) {
			let best = null;
			for (const r of rows) {
				if (!r || !r.id) continue;
				if (best === null || num(r.updatedAt) > num(best.updatedAt)) best = r;
			}
			return best;
		}
		/** 给定 sr 根时：cwd 与 sr 根完全相等的排在"祖先目录"前面（更贴规格里那条索引会话）。 */
		function preferExactRoot(rows, root) {
			if (!root) return rows;
			const exact = rows.filter((r) => samePath(r.cwd, root));
			return exact.length > 0 ? exact : rows;
		}
		/**
		* 客户端 store 快照 → 候选行。**同时吃 0.1.5 与 0.2.0 两种形状**：
		*   · 0.2.0（dsh-api-session-controller client）：`{ ids, byId }`，行上是 `{id, title, displayTitle, cwd, updatedAt, blank, retainedBy}`
		*   · 0.1.5：`{ current, byId }`（甚至只有 `current`）
		*/
		function rowsFromStore(state) {
			if (!state) return [];
			const byId = state.byId || {};
			const ids = Array.isArray(state.ids) ? state.ids.map(String) : Object.keys(byId);
			const current = typeof state.current === "string" ? state.current : "";
			const out = [];
			const seen = {};
			for (const id of ids) {
				const r = byId[id] || {};
				if (!id) continue;
				seen[id] = true;
				out.push({
					id,
					title: typeof r.title === "string" ? r.title : void 0,
					display: typeof r.displayTitle === "string" ? r.displayTitle : void 0,
					cwd: typeof r.cwd === "string" ? r.cwd : void 0,
					updatedAt: num(r.updatedAt),
					blank: r.blank === true,
					running: r.running === true,
					preset: presetOfProjections(r),
					main: id === current || !!(r.retainedBy && num(r.retainedBy.mainView) > 0)
				});
			}
			if (!seen[current] && current !== "") out.push({
				id: current,
				main: true
			});
			return out;
		}
		/** `remote.session.list` 的返回 → 候选行（0.2.0：标题在 `projections.values.title` 里）。 */
		function rowsFromList(value) {
			const items = value && (value.items || value.sessions) || [];
			const out = [];
			for (const it of items) {
				if (!it) continue;
				const id = it.sessionId || it.id;
				if (!id) continue;
				const pv = it.projections && it.projections.values;
				const projTitle = pv && typeof pv.title === "string" ? pv.title : void 0;
				out.push({
					id: String(id),
					title: typeof it.title === "string" && it.title !== "" ? it.title : projTitle,
					display: typeof it.displayTitle === "string" ? it.displayTitle : void 0,
					cwd: typeof it.cwd === "string" ? it.cwd : void 0,
					updatedAt: num(it.updatedAt),
					blank: it.blank === true,
					running: it.running === true,
					preset: presetOfProjections(it),
					main: false
				});
			}
			return out;
		}
		/**
		* 合并两份候选（同一 id 一拍）：**先来的字段优先，先来的空字段由后来的补上**。
		*
		* ★ 为什么要"补空"而不是"先来的整条赢"：两份候选来自不同通道，各有各的缺项 ——
		*   客户端 store 行带着 `main` / `displayTitle` / `running`，但 `title` 要等 host 投影下来
		*   （`SessionSummary.title`："absent until the host projects one"）；
		*   `session/list` 的标题在 `projections.values.title` 里，却没有 `main`。
		*   若整条赢，store 的"没标题"会把列表里的标题**抹掉** ⇒ 标题认领静默失效
		*   （索引会话还有 cwd 兜底，工作会话就只有标题这一条凭据 ⇒ 每次刷新新建一条，用户故事 27）。
		*/
		function mergeRows(primary, extra) {
			const out = [];
			const at = {};
			const fill = (dst, src) => {
				const merged = { id: dst.id };
				for (const k of [
					"title",
					"display",
					"cwd",
					"updatedAt",
					"blank",
					"main",
					"running",
					"preset"
				]) {
					const d = dst[k];
					const s = src[k];
					merged[k] = d === void 0 || d === "" || d === null ? s : d;
				}
				return merged;
			};
			for (const r of (primary || []).concat(extra || [])) {
				if (!r || !r.id) continue;
				if (at[r.id] === void 0) {
					at[r.id] = out.length;
					out.push(r);
					continue;
				}
				out[at[r.id]] = fill(out[at[r.id]], r);
			}
			return out;
		}
		/**
		* 挑一条索引会话。
		*
		* ★ 工单 07 的核心纪律：**索引会话必须是"面板自己的"**。
		*   所有权凭据只有两条（工单第 3 条：只能靠标题 + 缓存）：
		*     ① 标题以 `INDEX_TITLE` 开头（`session.rename` 设定的显式标题）；
		*     ② 缓存里那条 —— 而且必须是**面板自己写的**缓存（`mine`）。
		*   为什么要"我自己写的"这个标记：旧版本（工单 32 那一版）在"cwd 覆盖 sr 根"命中时
		*   **会把用户的会话写进缓存**（`缓存 = 借来的那条`），所以旧缓存不可信 —— 见 `IndexCache`。
		*   "cwd 覆盖 sr 根"**不再是所有权凭据**：用户自己的会话（cwd = `D:\TimeMachine`）是
		*   sr 根的祖先目录，一样"覆盖" —— 那正是本票要修的现象（面板借用户的会话当扫描口径）。
		*
		* 顺序（前一条命中就不再往下走）：
		*   ⓪ `opts.archived` —— 先剔掉已归档的那些（侧边栏看不见的会话不算可用）；
		*   ① `opts.cachedId` —— 上次用的那条，**在"自己的"里**、且（给了 root 时）cwd 覆盖 root；
		*   ② 标题认领 —— 自己的标题 + cwd 覆盖 root（精确等于 root 的先于祖先目录），取最新；
		*   ③ 一条自己的都没有 ⇒ **返回 null**（调用方去新建；**绝不借用户的会话**）；
		*   ④ `opts.borrow` —— 允许"随便借一条"的兜底（只有 `boot` 用它：那一步只 `read` 配置文件，
		*      不扫描、不订阅、不发指令 —— 借谁的都不影响结果）。借的顺序：cwd 覆盖 → 当前选中 → 最近更新。
		*/
		function pickIndexSession(rows, srWs, opts) {
			const o = opts || {};
			const live = withoutArchived(rows || [], o.archived);
			if (live.length === 0) return null;
			const own = live.filter((r) => isIndexTitle(titleOf(r)));
			const able = srWs ? own.filter((r) => containsPath(r.cwd, srWs)) : own;
			if (o.cachedId) {
				const hit = able.filter((r) => r.id === o.cachedId)[0];
				if (hit) return {
					id: hit.id,
					source: "cache",
					row: hit,
					others: Math.max(0, able.length - 1)
				};
			}
			if (able.length > 0) {
				const best = newest(srWs ? preferExactRoot(able, srWs) : able);
				if (best) return {
					id: best.id,
					source: "title",
					row: best,
					others: Math.max(0, able.length - 1)
				};
			}
			if (!(o.borrow || o.allowForeign)) return null;
			if (o.cachedId) {
				const hit = live.filter((r) => r.id === o.cachedId)[0];
				if (hit) return {
					id: hit.id,
					source: "cache",
					row: hit
				};
			}
			if (srWs) {
				const inside = live.filter((r) => containsPath(r.cwd, srWs));
				if (inside.length > 0) {
					const best = newest(preferExactRoot(inside, srWs));
					if (best) return {
						id: best.id,
						source: "cwd",
						row: best
					};
				}
			}
			const mains = live.filter((r) => r.main);
			if (mains.length > 0) {
				const best = newest(mains);
				if (best) return {
					id: best.id,
					source: "main",
					row: best
				};
			}
			const best = newest(live);
			if (best) return {
				id: best.id,
				source: "recent",
				row: best
			};
			return null;
		}
		/** sr 配置的默认文件名（相对"工作区根"）。 */
		const SR_CONFIG_REL = "\\.agents\\skills\\sr-askme\\config.local.json";
		/**
		* 候选配置路径：每个候选根一个**绝对路径**，最后兜一条**相对路径**
		* （相对路径由 host 按会话 cwd 解析 —— 那是 0.1.5 时代唯一能用的那条，留着当兜底）。
		*
		* ★ 浏览器半侧收不到插件 config（开发笔记坑 7），所以 `configPath` 在浏览器里是空的，
		*   绝对路径只能自己按"候选根"拼 —— 候选根来自工作区列表 / 会话 cwd / 默认根。
		*/
		function configPathCandidates(roots) {
			const out = [];
			const seen = {};
			for (const raw of roots || []) {
				if (raw === null || raw === void 0) continue;
				const base = String(raw).replace(/[\\/]+$/, "");
				if (base === "") continue;
				const abs = base + SR_CONFIG_REL;
				const key = normPath(abs);
				if (seen[key]) continue;
				seen[key] = true;
				out.push(abs);
			}
			/**
			* ★ 6.0.0：配置的正经落点是**用户目录** `%USERPROFILE%\.dsh\sr-workbench\config.local.json`，
			*   但那台机器上的家目录**浏览器里拿不到**（宿主注入的 boot 载荷里没有）——
			*   所以面板认路靠 profile 行里那条 `configPath`（支持按 id 覆盖，README 有写）。
			*   这里只留**相对回退**：老位置还认（存量机器不至于突然读不到），另加一条 `.dsh` 相对路径
			*   （对"会话 cwd 就在用户目录下"这种少见情形有用）。
			*/
			out.push(".agents/skills/sr-askme/config.local.json");
			out.push(".dsh/sr-workbench/config.local.json");
			return out;
		}
		/** localStorage 里记"这条工作区用哪条索引会话"的键（只在组合根里读写）。 */
		function indexCacheKey() {
			return "sr-wb.index.v1";
		}
		/** 缓存原文 → 条目；坏 JSON / 形状不对 → `null`（一律当成"没有缓存"，绝不抛）。 */
		function indexCacheParse(raw) {
			if (typeof raw !== "string" || raw === "") return null;
			try {
				const v = JSON.parse(raw);
				if (!v || typeof v !== "object") return null;
				const sid = typeof v.sid === "string" ? v.sid : "";
				if (sid === "") return null;
				return {
					srWs: typeof v.srWs === "string" ? v.srWs : "",
					sid,
					mine: v.mine === true,
					title: typeof v.title === "string" ? v.title : ""
				};
			} catch (e) {
				return null;
			}
		}
		/** 写一条缓存（**只有自己建完才调它** —— 这就是 `mine` 的来源）。 */
		function indexCacheSerialize(srWs, sid, title) {
			return JSON.stringify({
				srWs: String(srWs === null || srWs === void 0 ? "" : srWs),
				sid: String(sid === null || sid === void 0 ? "" : sid),
				mine: true,
				title: String(title === null || title === void 0 ? "" : title)
			});
		}
		/**
		* 缓存里这条**能不能当所有权凭据**。
		* ★ 只有 `mine: true` 才算（旧版本写的不算 —— 它可能是借来的用户会话）。
		*/
		function indexCacheOwned(entry) {
			return !!(entry && entry.mine === true && entry.sid !== "");
		}
		/** 旧缓存作废时的那句话（说清"不是你的会话被删了"，而是"那条不是我的"）。 */
		const FOREIGN_CACHE_NOTE = "上次记的索引会话不是面板自己建的（旧版本曾按「cwd 覆盖」借用过你的会话）：这条缓存已作废，这次重新认领或新建一条属于面板的索引会话。";
		/** `session.rename` 的标题：带工作区名，便于人一眼看出这条会话是干什么的。 */
		function indexTitleFor(srWs) {
			const base = normPath(srWs).split("\\").filter(Boolean).pop() || "";
			return base ? INDEX_TITLE + "（" + base + "）" : INDEX_TITLE;
		}
		/**
		* 工作会话的标题（认领凭据）。
		* ★ 与索引会话（`策划工作台·索引`）**分开**：索引会话的 cwd 是 SR workspace 根、只负责扫描；
		*   工作会话的 cwd 是 `features\<主题>\`、只负责干活（规格「三层会话」）。
		*/
		const WORK_TITLE = "策划工作台·工作";
		/** 功能主题 = 功能目录名（`features\<主题>\` 的最后一段）。空值一律给空串。 */
		function featureTopicOf(root) {
			return normPath(root).split("\\").filter(Boolean).pop() || "";
		}
		/** 标题是不是本工作台的工作会话（按前缀认领，允许尾部再带说明）。 */
		function isWorkTitle(t) {
			return typeof t === "string" && t.indexOf("策划工作台·工作") === 0;
		}
		/** 工作会话该有的标题：`策划工作台·工作（联盟悬赏）`。 */
		function workTitleFor(root) {
			const topic = featureTopicOf(root);
			return topic ? WORK_TITLE + "（" + topic + "）" : WORK_TITLE;
		}
		/**
		* 挑一条**该功能的**工作会话。
		*
		* 顺序（前一条命中就不再往下走）：
		*   ⓪ `opts.archived` —— **先剔掉已归档的那些**：这条会话是**要被发指令**的，
		*      用户看不见它 = 指令发进去了、界面什么也没有（2026-09-30 实测缺陷）。不传 = 旧行为；
		*   ① `opts.cachedId` —— 面板上次给这个功能用的那条，**且 cwd 就是功能根**；
		*   ② 标题认领 —— 标题以 `WORK_TITLE` 开头，**且 cwd 就是功能根**（自己建的会话，清缓存也能认回）；
		*   ③ 没有 → 返回 null（调用方去建；建完一定 `rename` 成 `workTitleFor(root)`，下次就靠 ② 认回来）。
		*
		* ★ 为什么**不**像索引会话那样兜一条"cwd 落在功能根里的任意会话"：
		*   工作会话会被面板**发指令**（索引会话只被读）。认一条用户自己的会话 = 往用户的对话里插活，
		*   正是用户故事 23 要避免的（"我的对话不被工作任务的来回打断"）。
		*   所以这里只认"我们自己的凭据"：缓存里的 id，或我们命名过的标题。
		* ★ 为什么 cwd 必须**恰好等于**功能根（不是 contains）：工作会话的 cwd = 功能文件夹本身；
		*   落在别处（比如 SR 根、别的功能）说明它不是这个功能的工作会话。
		*/
		function pickWorkSession(rows, featureRoot, opts) {
			const o = opts || {};
			const root = normPath(featureRoot);
			if (root === "") return null;
			const live = withoutArchived(rows || [], o.archived).filter((r) => samePath(r.cwd, root));
			if (live.length === 0) return null;
			if (o.cachedId) {
				const hit = live.filter((r) => r.id === o.cachedId)[0];
				if (hit) return {
					id: hit.id,
					source: "cache",
					row: hit,
					others: Math.max(0, live.length - 1)
				};
			}
			const named = live.filter((r) => isWorkTitle(titleOf(r)));
			const best = newest(named);
			if (best) return {
				id: best.id,
				source: "title",
				row: best,
				others: Math.max(0, named.length - 1)
			};
			return null;
		}
		/**
		* localStorage 里记"每个功能用哪条工作会话"的键（只在组合根里读写）。
		* ★ 与索引会话的键分开：索引会话一条工作区一个，工作会话**一个功能一条**，所以值是一张表。
		*/
		function workCacheKey() {
			return "sr-wb.work.v1";
		}
		/** 缓存原文（可能是坏 JSON / 空）→ 表。坏值一律当空表，绝不抛。 */
		function workCacheTable(raw) {
			if (typeof raw !== "string" || raw === "") return {};
			try {
				const v = JSON.parse(raw);
				if (!v || typeof v !== "object") return {};
				const out = {};
				for (const k of Object.keys(v)) {
					const one = v[k];
					if (typeof one === "string" && one !== "") out[k] = one;
				}
				return out;
			} catch (e) {
				return {};
			}
		}
		/** 这张表里，这个功能用的是哪条工作会话（没有 → 空串）。 */
		function workCacheGet(raw, featureRoot) {
			const root = normPath(featureRoot);
			if (root === "") return "";
			return workCacheTable(raw)[root] || "";
		}
		/** 写回一条（返回**新的**缓存原文；组合根负责 `setItem`）。 */
		function workCachePut(raw, featureRoot, sid) {
			const root = normPath(featureRoot);
			const t = workCacheTable(raw);
			if (root !== "" && typeof sid === "string" && sid !== "") t[root] = sid;
			return JSON.stringify(t);
		}
		/** 删掉一条（会话失效自愈时用；返回新的缓存原文）。 */
		function workCacheDrop(raw, featureRoot) {
			const root = normPath(featureRoot);
			const t = workCacheTable(raw);
			if (root !== "") delete t[root];
			return JSON.stringify(t);
		}
		/**
		* 「完全权限」的机器值。
		* 依据：`dsh-permission-presets/lib/index.js:151-156`（presets 里的 `danger-full-access`
		* = sandbox `danger-full-access` + approval `never`），客户端标签见
		* `dsh-client-ui-permission-presets/lib/client.js:231`（`FULL_ACCESS_PRESET`）。
		*/
		const PERMISSION_FULL = "danger-full-access";
		/**
		* 切预设的**唯一**通道：官方注册的斜杠命令 `/permission <preset>`。
		*
		* ★ 为什么是命令而不是某个 remote 方法：`dsh-permission-presets` 只对外暴露一个 remote
		*   （`permissionPresets/catalog`，见 `.../typert.remote-client.js`）——**没有 set 方法**；
		*   官方自己切预设就是那条命令（`lib/index.js:207-226` 注册 `permission` 命令，
		*   官方 plan 插件也是这么发命令的：`dsh-client-ui-plan/lib/client.js:704`
		*   `remote.commands.execute(sessionId, "/plan off", [])`）。
		*/
		function permissionCommandLine(preset) {
			return "/permission " + (typeof preset === "string" && preset !== "" ? preset : PERMISSION_FULL);
		}
		/** 这条会话**当前**是不是「完全权限」——`true` 才需要动手；读不到（`""`）一律不动。 */
		function needsFullAccess(preset) {
			return typeof preset === "string" && preset !== "" && preset !== "danger-full-access";
		}
		/**
		* 由 `remote.permissionPresets.catalog()` 的返回（`{ options, defaultOptions, defaultPreset }`，
		* 形状见 `dsh-permission-presets/lib/typert.remote-client.js`）决定**要不要切**。
		*
		* ★ 为什么以"进程默认预设"为准：新会话是**播种**默认预设的
		*   （`lib/index.js:198-201` `ctx.on("session/created", pinInitialPermission)`），
		*   所以默认已是完全权限时，新工作会话建出来就是完全权限，**面板不需要再切**——
		*   这时如实说一句"本机默认就是完全权限"，而不是多发一条命令装样子。
		* ★ 读不到（catalog 不可用 / 形状变了）时**按最坏情况切一次**：宁可在日志里多一条命令，
		*   也不要让"配置支线写 config_root / gtgenerator 工作目录"被沙箱拦下来。
		*/
		function permissionPlanOf(catalog) {
			const obj = catalog && typeof catalog === "object" ? catalog : null;
			const def = obj && typeof obj.defaultPreset === "string" ? obj.defaultPreset : "";
			if (def === "danger-full-access") return {
				needed: false,
				preset: PERMISSION_FULL,
				why: "default=" + PERMISSION_FULL,
				note: "本机 profile 的默认权限预设已是「完全权限」（permission.defaultPreset = danger-full-access）：新建的会话本身就是完全权限，不用再切。"
			};
			if (def === "") return {
				needed: true,
				preset: PERMISSION_FULL,
				why: "unreadable",
				note: "读不到本机的默认权限预设（`permissionPresets.catalog` 不可用或形状变了）：按最坏情况给这条工作会话切一次「完全权限」。"
			};
			return {
				needed: true,
				preset: PERMISSION_FULL,
				why: "default=" + def,
				note: "本机默认权限预设是「" + def + "」，不是完全权限：这条工作会话已切成「完全权限」——否则功能文件夹之外的产出（配置支线写 config_root、gtgenerator 工作目录）会被拦。"
			};
		}
		/**
		* 切完之后那句话（含**读回**证据）。
		* @param execOk   命令本身成功没有
		* @param execText 命令返回的人话（`preset danger-full-access` / 错误文本）
		* @param readback 重新拉列表读回的该会话预设（`permissions.currentValue`，读不到 = `""`）
		*/
		function permissionResultNote(execOk, execText, readback) {
			const want = PERMISSION_FULL;
			const got = typeof readback === "string" ? readback : "";
			const text = String(execText === null || execText === void 0 ? "" : execText);
			if (!execOk) return "没能把这条工作会话切到完全权限（" + (text || "命令失败") + "）：功能文件夹之外的产出可能被拦 —— 在左侧点开这条会话，手动发 `/permission danger-full-access` 即可。";
			if (got === want) return "已把这条工作会话切成「完全权限」（读回 permissions = " + got + "）。";
			if (got !== "") return "切权限的命令返回成功，但读回仍是「" + got + "」（不是完全权限）：以读回为准，功能文件夹之外的产出可能被拦。";
			return "已发切换命令（返回：" + (text || "无文本") + "），但**读不回**当前预设：如果产物被拦，在左侧点开这条会话手动发 `/permission danger-full-access`。";
		}
		//#endregion
		//#region src/pure/storemerge.ts
		/** 取不到 workspaces 客户端服务时的那句话（面板照实说，不装"已经即时生效"）。 */
		const NO_WORKSPACES_SERVICE = "取不到官方 workspaces 客户端服务：新工作区分组这次不会即时出现在侧边栏（要刷新页面）。";
		/** 取不到 sessions 客户端服务时的那句话。 */
		const NO_SESSIONS_SERVICE = "取不到官方 sessions 客户端服务：新会话行这次不会即时出现在侧边栏（要刷新页面）。";
		/**
		* 算出"建完之后补哪几刀"。
		*
		* 顺序是**刻意**的：先把工作区行解析回来（分组与它的 `sessionIds` 到位），再重拉会话基线
		* —— 反过来会出现一瞬间"会话已在 store 里、但没有任何分组认领它"的「未分组」闪一下。
		*/
		function planSidebarSync(input) {
			const path = typeof input.path === "string" ? input.path.trim() : "";
			const services = input.services || {
				workspaces: false,
				sessions: false
			};
			const resolvePath = path !== "" && services.workspaces === true ? path : "";
			const refreshSessions = services.sessions === true;
			const steps = [];
			if (resolvePath !== "") steps.push("workspaces.create");
			if (refreshSessions) steps.push("sessions.refresh");
			const notes = [];
			if (path !== "" && services.workspaces !== true) notes.push(NO_WORKSPACES_SERVICE);
			if (services.sessions !== true) notes.push(NO_SESSIONS_SERVICE);
			return {
				resolvePath,
				refreshSessions,
				steps,
				notes
			};
		}
		/**
		* 这一步自己**需不需要**出手（一看就懂的自查口，组合根与测试都用它）：
		* 一条都不用调 = 这次没什么可合并的（例如两个服务都取不到）。
		*/
		function sidebarSyncNeeded(plan) {
			return plan.steps.length > 0;
		}
		//#endregion
		//#region src/load/read.ts
		/** 目录列举返回值 → 文件名（只取文件） */
		function fileNamesOf(listing) {
			return (listing && listing.entries || []).filter((x) => x.type === "file" || x.type === "unknown").map((x) => x.name).filter((n) => typeof n === "string" && n.length > 0);
		}
		/** 目录列举返回值 → 子目录名（与 fileNamesOf 互补） */
		function dirNamesOf(listing) {
			return (listing && listing.entries || []).filter((x) => x.type === "directory").map((x) => x.name).filter((n) => typeof n === "string" && n.length > 0);
		}
		/** 列一层目录（只取文件）。`optional` 时列不出来返回 `[]`。 */
		async function listFiles(port, absPath, signal, optional) {
			try {
				return fileNamesOf(await port.listDir(absPath, signal));
			} catch (e) {
				if (optional) return [];
				throw new Error("无法列举目录：" + absPath);
			}
		}
		/** 列一层目录（只取子目录）。`optional` 时列不出来返回 `[]`。 */
		async function listDirs(port, absPath, signal, optional) {
			try {
				return dirNamesOf(await port.listDir(absPath, signal));
			} catch (e) {
				if (optional) return [];
				throw new Error("无法列举目录：" + absPath);
			}
		}
		/** 只读文件开头若干行（读 frontmatter 够用）。读不到返回 `null`。 */
		async function readHead(port, path, signal) {
			try {
				return (await port.readText(path, {
					offset: 1,
					limit: 14
				}, signal)).text;
			} catch (e) {
				return null;
			}
		}
		/** 分页读完整文本（读了半截就失败时，返回已经读到的部分）。读不到返回 `null`。 */
		async function readAllText(port, path, signal, capLines) {
			const cap = capLines || 2e4;
			let offset = 1;
			const out = [];
			let guard = 0;
			while (guard++ < 40) {
				let r;
				try {
					r = await port.readText(path, {
						offset,
						limit: 2e3
					}, signal);
				} catch (e) {
					return out.length ? out.join("\n") : null;
				}
				out.push(r.text);
				if (r.eof || r.lines === 0) break;
				offset += r.lines;
				if (offset > cap) break;
			}
			return out.join("\n");
		}
		//#endregion
		//#region src/load/create.ts
		/**
		* 新建功能的**只读一侧**（加载层，只吃 `WorkspacePort`）：建之前要知道的事实。
		*
		* 事实有两样：① `features\` 下已经有哪些目录（撞名要当场拒绝 —— **目录存在就是功能**）；
		* ② 某个功能目录的现状（`inspectFeatureDir`：**只有 4 个桶的空脚手架** 与 **真功能** 要分开）。
		* 客户端 store 里的工作区表由组合根直接给（它拿得到 store，加载层拿不到），这里不读。
		*
		* ★ 这里**一个字节都不写**。建目录在组合根里做，而且**不是只有一条路**：
		*   `uiWorkspace.createDirectory` 只在 browse 后端存在，**Windows 上没有** ⇒ 要退到
		*   "让会话跑 PowerShell" 或 "用户手工建"（判据与理由见 `pure/createfeature.ts` 那一节）。
		*/
		/**
		* 看一个功能目录的现状。**只读**；列不出来就是 `exists:false`（不抛）。
		* ★ 判据 `bare` 在纯函数 `isBareScaffold` 里（有测试），这里只做 IO。
		*/
		async function inspectFeatureDir(port, root, signal) {
			const r = String(root || "").replace(/[\\/]+$/, "");
			let entries = [];
			try {
				const l = await port.listDir(r, signal);
				entries = (l && l.entries ? l.entries : []).map((e) => ({
					name: e.name,
					type: e.type
				}));
			} catch (e) {
				return {
					exists: false,
					entries: [],
					bare: false
				};
			}
			return {
				exists: true,
				entries,
				bare: isBareScaffold(entries)
			};
		}
		/**
		* 建之前的事实（**只读**）。
		* ★ 要分清两种情况：**全新工作区（还没有 `features\`）** 与 **列不出来（越界/通道坏）**。
		*   判据：SR 工作区根列得出来 ⇒ 只是还没有功能目录（可以建第一个）；
		*   根也列不出来 ⇒ 核不了冲突，**如实说、让界面别建**。
		*/
		async function loadCreateFacts(port, options) {
			const srWs = String(options.srWs || "").replace(/[\\/]+$/, "");
			if (srWs === "") return {
				dirNames: [],
				note: "拿不到 SR 工作区锚点，读不了已有的功能目录 —— 先解决锚点再建。"
			};
			try {
				return {
					dirNames: await listDirs(port, srWs + "\\features", options.signal, false),
					note: ""
				};
			} catch (e) {
				let rootOk = false;
				try {
					await port.listDir(srWs, options.signal);
					rootOk = true;
				} catch (e2) {
					rootOk = false;
				}
				if (!rootOk) return {
					dirNames: [],
					note: "读不到 SR 工作区（列不出 " + srWs + "）—— 已有的功能目录核不了，先别建。"
				};
				return {
					dirNames: [],
					note: ""
				};
			}
		}
		//#endregion
		//#region src/pure/topic.ts
		/** 文件名里的日期 YYYYMMDD（没有则空串） */
		function dateOf(name) {
			const m = /(\d{8})/.exec(String(name));
			return m ? m[1] : "";
		}
		//#endregion
		//#region src/pure/artifacts.ts
		/**
		* 「最终产物」模块的数据模型（v5 口径）。
		*
		* 面板留这几类（用户口径）：
		*   ① 头脑风暴的产物 —— `analysis\` 里的剩余内容
		*   ② 成稿 —— `gdd\<主题>_<日期>.md`
		*   ③ 定稿 —— `gdd\*_定稿.md`
		*   ④ HTML 宣讲稿 —— `gdd\*_宣讲_<日期>.html`
		*   ⑤ 配置表 —— 配置这条线的交付物（`CS-*.yaml` / `*_读回验收报告.md` / `.xlsx|.xlsm|.csv`）
		* 其余（审查 / 修订点 / 定稿 HTML 派生件 / 界面图目录 / 认不出名字的）如实进「其它」组，
		* **默认折叠**、一个都不静默丢 —— 这是本仓库的老纪律（「一个文件都不许静默丢」）。
		*
		* ★ 判据**只有一份**：全在 `./buckets.ts` 的 `outputGroupOf`（含"配置表按内容认、不绑目录"）。
		*   这里**不再自己判一次** —— 2026-10-09 就因为这个文件里藏了第二份判据，
		*   改了 `outputGroupOf` 却一点效果都没有（配置表分类不生效），白查了半天。
		*
		* 纯函数、零 IO：目录列举由 `../load/feature.ts` 读进来。
		*/
		const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
		/** 列举 → 条目数组（`dir` = 桶名）。 */
		function filesOf(dir, listing) {
			const d = listing || {};
			const out = [];
			const add = (name, sub) => {
				const rel = sub ? dir + "/" + sub + "/" + name : dir + "/" + name;
				const group = outputGroupOf(dir, name);
				out.push({
					name,
					rel,
					dir,
					subdir: sub,
					group,
					kindLabel: dir === "gdd" && group === "other" ? kindLabelOf(name) : "",
					note: ""
				});
			};
			for (const n of d.files || []) add(n, "");
			for (const sub of Object.keys(d.nested || {}).sort()) for (const n of (d.nested || {})[sub] || []) add(n, sub);
			return out;
		}
		function kindLabelOf(name) {
			const k = gddKindOf(name);
			return k === "speechSrc" ? "宣讲源数据" : labelOfKind(k);
		}
		function labelOfKind(k) {
			return {
				review: "审查",
				fixpoints: "修订点",
				finalHtml: "定稿 HTML",
				speechSrc: "宣讲源数据",
				others: "其它"
			}[k] || "其它";
		}
		/**
		* 组内排序：
		*   · 成稿 / 定稿按**文件名日期倒序**（新的在前 —— 与"最新定稿"口径一致），同日期按名字；
		*   · 其余按相对路径。
		*/
		function sortGroup(key, files) {
			if (key === "draft" || key === "final") return files.slice().sort((a, b) => {
				const da = dateOf(a.name);
				const db = dateOf(b.name);
				if (da !== db) return da < db ? 1 : -1;
				return cmp(a.rel, b.rel);
			});
			return files.slice().sort((a, b) => cmp(a.rel, b.rel));
		}
		/**
		* 列举 → 四个产物组（`other` 组只在真有条目时才出现）。
		*
		* @returns `{ groups, counts, total }`
		*   · `groups` 恒含前四类（空组也在，count 为 0 —— 人一眼看得出"这一类还没有"）；
		*   · `total` = 面板列出的条目总数（**不含** evidence / decisions 桶）。
		*/
		function featureArtifacts(input) {
			const inp = input || {};
			const all = filesOf("analysis", inp.analysis).concat(filesOf("gdd", inp.gdd));
			const groups = OUTPUT_GROUPS.map((g) => {
				const files = sortGroup(g.key, all.filter((f) => f.group === g.key));
				/**
				* `dir` = 这一类**实际**落在哪个桶（面板只显示这个短标签，长说明收进 tooltip）。
				* ★ 由**文件本身**算，不写死 —— 万一有文件落错了桶（比如配置交付物写进了 `analysis\`），
				*   组头照样如实显示它真正在哪，不替它粉饰。跨目录时按出现顺序列全（用 " · " 连起来）。
				*/
				const dirs = [];
				for (const f of files) if (f.dir && dirs.indexOf(f.dir) < 0) dirs.push(f.dir);
				return {
					key: g.key,
					label: g.label,
					note: g.note,
					dynamic: "",
					dir: dirs.join(" · "),
					count: files.length,
					files
				};
			});
			const counts = {};
			const allPaths = [];
			let total = 0;
			for (const g of groups) {
				counts[g.key] = g.count;
				total += g.count;
				for (const f of g.files) allPaths.push(f.rel);
			}
			return {
				groups,
				counts,
				total,
				allPaths
			};
		}
		/**
		* 给定稿组标「最新定稿」/「历史版本」（**只按文件名日期**，不做 frontmatter 校验 —— 面板不再替定稿门背书）。
		* 多份同日期时并列标「最新定稿」并在组说明里如实说，不假装只有一份。
		*/
		function annotateFinals(groups) {
			for (const g of groups) {
				if (g.key !== "final" || g.files.length === 0) continue;
				const newest = dateOf(g.files[0].name);
				const tied = g.files.filter((f) => dateOf(f.name) === newest).length;
				for (const f of g.files) f.note = dateOf(f.name) === newest ? tied > 1 ? "最新（同日多份）" : "最新定稿" : "历史版本";
				if (g.files.length > 1) g.dynamic = "现有 " + g.files.length + " 份，按文件名日期标最新的那" + (tied > 1 ? "几份（有 " + tied + " 份同日）" : "一份") + " —— 哪一份真的有效要问定稿门（面板不替它背书）。";
			}
		}
		//#endregion
		//#region src/load/brainstorm.ts
		/**
		* 头脑风暴工作面加载器（工单 23）—— 「已有的分析结论」+ 两种新格式的解析结果。
		*
		* 口径：
		*   · **只吃 port**，只读；不写任何东西（"面板只读、agent 执行"）。
		*   · 产物清单**不在这里重新列目录** —— 它由 `loadFeatureDetail`（工单 12）给，本加载器只拿
		*     `analysis` 组的文件清单做事：这样"面板列出的产物"与"工作面认出的结论"**同一份来源**，
		*     不会出现两处列举结果不一致。
		*   · 两种新格式（`legacy-analysis_*` / `human-note_*`）读**全文**再解析（原文段可能在文件末尾）；
		*     交接件 JSON 只读**开头**（只要 `source_skill` 一个字段，不把 5KB JSON 整个拉进来）。
		*   · 读不动的文件**如实报出来**（`unreadable`），不静默当成"没有"。
		*
		* 纯函数部分在 `../pure/analysisdoc.ts`（归类 / 解析 / 文件名规则），这里只做 IO 与编排。
		*/
		/** 一个文件 → 绝对路径（`analysis` 组的子目录也认） */
		function absOf(root, f) {
			const rel = String(f && f.rel || "").replace(/\\/g, "/");
			if (rel !== "") return root.replace(/\\+$/, "") + "/" + rel;
			const sub = String(f && f.subdir || "");
			return root.replace(/\\+$/, "") + "/" + (sub ? sub + "/" : "") + String(f.name || "");
		}
		/**
		* 读一个功能的 `analysis\` → 工作面视图模型。
		*
		* @returns `{ root, groups, legacy, humannote, unreadable, notes }`
		*   · `groups` —— 按四入口分组（`groupAnalyses` 的结论：恒四组，空组也出现）
		*   · `legacy` / `humannote` —— 两种新格式的解析结果（含 `name` / `rel`，面板点开就渲染它）
		*   · `unreadable` —— 读不动的文件（如实列出，不当成"没有"）
		*   · `notes` —— 出口判据等提示（来自 `stage.note`，**不在这一层重算**）
		*/
		async function loadBrainstorm(port, options) {
			const root = String(options.root || "").replace(/\\+$/, "");
			const files = Array.isArray(options.files) ? options.files.filter((f) => f && f.name) : [];
			const maxDocs = Math.max(1, Math.trunc(Number(options.maxDocs) || 12));
			const signal = options.signal;
			const notes = [];
			const unreadable = [];
			/** 交接件的 `source_skill`（只这几份：文件名前缀能认出来） */
			const skills = {};
			for (const f of files.filter((x) => /^sr-gdd-handoff_/i.test(x.name))) {
				const head = await readHead(port, absOf(root, f), signal);
				if (head === null) unreadable.push({
					name: f.name,
					why: "读不到开头（拿不到交接件的 source_skill）"
				});
				else skills[f.name] = sourceSkillOf(head);
			}
			const legacy = [];
			const humannote = [];
			const docs = files.filter((f) => analysisDocKind(f.name) !== "");
			for (const f of docs.slice(0, maxDocs)) {
				const k = analysisDocKind(f.name);
				const text = await readAllText(port, absOf(root, f), signal, 4e3);
				if (text === null) {
					unreadable.push({
						name: f.name,
						why: "读不到正文"
					});
					continue;
				}
				const parsed = k === "legacy" ? parseLegacyAnalysis(text, f.name) : parseHumanNote(text, f.name);
				parsed.rel = String(f.rel || f.name);
				parsed.abs = absOf(root, f);
				if (k === "legacy") legacy.push(parsed);
				else humannote.push(parsed);
			}
			if (docs.length > maxDocs) notes.push("新格式产物共 " + docs.length + " 份，只解析了最新的 " + maxDocs + " 份（点文件名可打开看全文）。");
			return {
				root,
				groups: groupAnalyses(files.map((f) => ({
					name: f.name,
					rel: f.rel || f.name,
					subdir: f.subdir || "",
					skill: skills[f.name] || ""
				}))),
				legacy,
				humannote,
				unreadable,
				notes: (options.stage && options.stage.note ? [options.stage.note] : []).concat(notes)
			};
		}
		//#endregion
		//#region src/load/feature.ts
		/**
		* 功能详情加载器（v5）—— 一个功能的**三块**数据，一次读齐。
		*
		* 面板点进一张功能卡片只看三块（用户口径）：
		*   ① 头脑风暴 —— `analysis\`（已有结论）+ 四入口（四入口的**指令组装**在 `pure/intake.ts`）
		*   ② 决策记录 —— `decisions\决策记录.md`（解析在 `pure/decisions.ts`）
		*   ③ 最终产物 —— 头脑风暴的产物 / 成稿 / 定稿 / HTML 宣讲稿（分组在 `pure/artifacts.ts`）
		*
		* 这一层**只吃 port、只读**；目录列举深度=2（桶 → 再下一层，如 `gdd\UI\`）。
		* 磁盘上有什么就列什么：**一个文件都不许静默丢**（不属四类的进「其它」组）。
		*/
		/** 一层深度的展开上限（防一个桶里堆了几百个子目录把面板拖死）。 */
		const MAX_SUBDIRS = 12;
		function emptyScan() {
			return {
				files: [],
				subdirs: [],
				nested: {}
			};
		}
		/**
		* 扫一个功能目录：4 个桶 + 每个桶再下**一层**。
		* 列举失败一律降级成"空 + absent"，绝不抛给界面（缺桶是常态，不是异常）。
		*/
		async function scanFeature(port, root, signal) {
			const r = String(root || "").replace(/[\\/]+$/, "");
			const topic = r.split(/[\\/]/).pop() || "";
			const dirs = {};
			const missing = [];
			const rootDirs = await listDirs(port, r, signal, true);
			const have = new Set(rootDirs.map((d) => String(d).toLowerCase()));
			for (const b of BUCKETS) {
				if (!have.has(b)) {
					dirs[b] = Object.assign(emptyScan(), { absent: true });
					missing.push(b);
					continue;
				}
				const d = Object.assign(emptyScan(), { absent: false });
				d.files = (await listFiles(port, r + "/" + b, signal, true)).slice().sort();
				d.subdirs = (await listDirs(port, r + "/" + b, signal, true)).slice().sort();
				for (const sub of d.subdirs.slice(0, MAX_SUBDIRS)) d.nested[sub] = (await listFiles(port, r + "/" + b + "/" + sub, signal, true)).slice().sort();
				dirs[b] = d;
			}
			const rootFiles = (await listFiles(port, r, signal, true)).slice().sort();
			return {
				root: r,
				topic,
				dirs,
				missing,
				strangerDirs: rootDirs.filter((d) => String(d).startsWith(".") === false).filter((d) => !BUCKETS.some((b) => b.toLowerCase() === String(d).toLowerCase())).sort(),
				rootFiles
			};
		}
		/** 决策记录文件的位置（**唯一出处**：面板、加载器、操作文档都引 `pure/decisions.ts`）。 */
		function decisionPathOf(root) {
			return String(root || "").replace(/[\\/]+$/, "") + "\\" + DECISION_REL.replace(/\//g, "\\");
		}
		/**
		* 读决策记录。**读不到 ≠ 没有**：文件不存在是"还没记过决策"（正常），
		* 读失败是"读不到"（要如实说）—— 两种情况分开报。
		*/
		async function loadDecisionLog(port, root, signal) {
			const abs = decisionPathOf(root);
			const text = await readAllText(port, abs, signal, 2e4);
			if (text === null) return {
				rel: DECISION_REL,
				abs,
				readError: "",
				log: parseDecisionLog("")
			};
			return {
				rel: DECISION_REL,
				abs,
				readError: "",
				log: parseDecisionLog(text)
			};
		}
		/**
		* 读一个功能的全部三块。
		* @param options.root 功能根（绝对路径）
		*/
		async function loadFeatureDetail(port, options) {
			const signal = options.signal;
			const scan = await scanFeature(port, options.root, signal);
			/**
			* 交给头脑风暴读通道的 `analysis\` 文件。
			*
			* ★ **配置表那条线的文件要剔掉**：`CS-*.yaml` 变更集、`*_读回验收报告.md`、`.xlsx/.xlsm/.csv`
			*   是配置交付物（口径：**只落 `gdd\`**，`analysis\` 只放头脑风暴产物），它们不是四个入口的产物 ——
			*   混进来会让"四入口分组的总数"对不上，也会在头脑风暴里冒出一张不相干的表。
			*   判据用**同一份** `configArtifactOf`（不在这里另判一次）。
			*/
			const analysisFiles = [];
			const pushAnalysis = (n, sub) => {
				if (configArtifactOf(n)) return;
				analysisFiles.push({
					name: n,
					rel: sub ? "analysis/" + sub + "/" + n : "analysis/" + n,
					subdir: sub
				});
			};
			for (const n of scan.dirs.analysis.files) pushAnalysis(n, "");
			for (const sub of Object.keys(scan.dirs.analysis.nested).sort()) for (const n of scan.dirs.analysis.nested[sub]) pushAnalysis(n, sub);
			const brainstorm = await loadBrainstorm(port, {
				root: scan.root,
				files: analysisFiles,
				signal,
				maxDocs: options.maxDocs
			});
			const decisions = await loadDecisionLog(port, scan.root, signal);
			const outputs = featureArtifacts({
				analysis: {
					files: scan.dirs.analysis.files,
					nested: scan.dirs.analysis.nested
				},
				gdd: {
					files: scan.dirs.gdd.files,
					nested: scan.dirs.gdd.nested
				}
			});
			annotateFinals(outputs.groups);
			let evidence = scan.dirs.evidence.files.length;
			for (const k of Object.keys(scan.dirs.evidence.nested)) evidence += scan.dirs.evidence.nested[k].length;
			const counts = {
				brainstorm: outputs.counts.brainstorm || 0,
				draft: outputs.counts.draft || 0,
				final: outputs.counts.final || 0,
				speech: outputs.counts.speech || 0,
				other: outputs.counts.other || 0,
				evidence,
				decisions: decisions.log.entries.length,
				total: outputs.total
			};
			return {
				root: scan.root,
				topic: scan.topic,
				missing: scan.missing,
				strangerDirs: scan.strangerDirs,
				rootFiles: scan.rootFiles,
				buckets: BUCKETS.map((b) => ({
					key: b,
					label: BUCKET_LABEL[b] || b,
					meaning: BUCKET_MEANING[b] || "",
					files: scan.dirs[b].files.length,
					subdirs: scan.dirs[b].subdirs.length,
					absent: scan.dirs[b].absent
				})),
				brainstorm,
				decisions,
				outputs,
				counts
			};
		}
		/** 决策记录里最近一条的时间戳（没有就是空串）—— 卡片上那一行用它。 */
		function lastDecisionAt(log) {
			let best = "";
			let bestKey = "";
			for (const e of log.entries) {
				const k = String(e.at).replace(/[-: ]/g, "");
				if (k > bestKey) {
					bestKey = k;
					best = e.at;
				}
			}
			return best;
		}
		//#endregion
		//#region src/load/paths.ts
		/**
		* 读 `config.local.json`。候选顺序：显式配置路径 → 相对当前工作区的默认位置。
		* 都读不到时 `srWs` 为空串 + `configFile` 说清楚试过哪儿（**不假装读到了**）。
		*/
		async function loadSrPaths(port, configPath, signal) {
			const cands = [];
			if (configPath) cands.push(configPath);
			cands.push(".agents/skills/sr-askme/config.local.json");
			for (const p of cands) {
				const text = await readAllText(port, p, signal, 200);
				if (!text) continue;
				try {
					const cfg = JSON.parse(text);
					if (cfg && cfg.sr_workspace) return {
						srWs: String(cfg.sr_workspace).replace(/[\\/]+$/, ""),
						configRoot: String(cfg.config_root || "").replace(/[\\/]+$/, ""),
						skillsRoot: p.replace(/[\\/]sr-askme[\\/]config\.local\.json$/i, ""),
						configFile: p
					};
				} catch (e) {}
			}
			return {
				srWs: "",
				configRoot: "",
				configFile: "(未找到 sr 配置)"
			};
		}
		//#endregion
		//#region src/load/dashboard.ts
		/**
		* 看板加载器（v5）—— 扫 `features\` → **功能卡片**列表。
		*
		* ★ 功能 = 目录：**只认 `<SR 工作区>\features\<主题>\`**，目录存在就是功能（哪怕它是空的）。
		*   代码里零兼容、零猜测：没有身份声明要读（v5 起 `feature.json` 退休了，目录名就是身份），
		*   没有配置表要挂（配置表不进工作台），没有旧结构要统计。
		* ★ 卡片上给的是**人一眼要的那几个数**：头脑风暴几件、成稿几份、定稿几份、宣讲几份、
		*   决策几条、最近一条决策是什么时候。
		* ★ 这一层**只吃 port**：端口之外没有任何 ctx / remote / window。
		*/
		/** 卡片上那一行人话（**只有这一份实现**，界面不另写话术）。 */
		function cardLineOf(c) {
			const n = c.counts || {};
			const brainstorm = n.brainstorm || 0;
			const draft = n.draft || 0;
			const final = n.final || 0;
			const speech = n.speech || 0;
			const decisions = n.decisions || 0;
			const anything = brainstorm + draft + final + speech + (n.other || 0) + (n.evidence || 0);
			if (c.missing.length > 0) return {
				line: "桶没建全：缺 " + c.missing.join("、") + " —— 补建这几个目录，或删掉这个功能目录重建",
				tone: "warn",
				stage: "empty"
			};
			if (final > 0 && speech > 0) return {
				line: "已定稿 · 宣讲稿也在",
				tone: "ok",
				stage: "final"
			};
			if (final > 0) return {
				line: "已定稿" + (c.latestDate ? "（" + c.latestDate + "）" : "") + " · 可以交程序",
				tone: "ok",
				stage: "final"
			};
			if (draft > 0) return {
				line: "有成稿 " + draft + " 份 · 还没定稿",
				tone: "muted",
				stage: "draft"
			};
			if (brainstorm > 0) return {
				line: "头脑风暴有 " + brainstorm + " 件产物 · 还没出成稿",
				tone: "muted",
				stage: "brainstorm"
			};
			if (decisions > 0) return {
				line: "记了 " + decisions + " 条决策 · 还没有产物",
				tone: "muted",
				stage: "empty"
			};
			if (anything > 0) return {
				line: "有原料 · 还没跑头脑风暴",
				tone: "muted",
				stage: "empty"
			};
			return {
				line: "新的 —— 还没有任何产物，从「头脑风暴」开始",
				tone: "new",
				stage: "empty"
			};
		}
		/**
		* 扫工作区 → 功能卡片列表。
		* ★ 先从 sr 配置拿**绝对路径**锚点，不跟着当前会话的工作区走。
		*/
		async function loadDashboard(port, options = {}) {
			const P = await loadSrPaths(port, options.configPath || "", options.signal);
			const srWs = P.srWs || "";
			if (!P.srWs) return {
				srWs: "",
				configFile: P.configFile,
				cwd: options.cwd || "",
				pathNote: "没读到 sr 配置（试过 " + P.configFile + "）—— 工作区锚点未知，先跑 `/sr-askme` 或确认 `.agents\\skills\\sr-askme\\config.local.json`。",
				features: [],
				counts: { features: 0 }
			};
			const out = await loadDashboardInner(port, srWs, options.signal);
			out.srWs = srWs;
			out.configRoot = P.configRoot;
			out.configFile = P.configFile;
			out.cwd = options.cwd || "";
			return out;
		}
		/** 扫 `<srWs>\features\` 下的每一个目录 → 卡片。 */
		async function loadDashboardInner(port, srWs, signal) {
			const featuresDir = String(srWs).replace(/[\\/]+$/, "") + "\\features";
			let topics = [];
			let note = "";
			try {
				topics = (await listDirs(port, featuresDir, signal, false)).slice().sort();
			} catch (e) {
				let rootOk = false;
				try {
					await port.listDir(String(srWs).replace(/[\\/]+$/, ""), signal);
					rootOk = true;
				} catch (e2) {
					rootOk = false;
				}
				note = rootOk ? "`features\\` 还没有建（工作台建第一个功能时会自动建）。" : "读不到 SR 工作区（列不出 " + srWs + "）—— 看板给不了功能列表。";
			}
			const features = [];
			for (const t of topics) {
				const root = featuresDir + "\\" + t;
				const scan = await scanFeature(port, root, signal);
				const text = await readAllText(port, decisionPathOf(root), signal, 2e4);
				const log = parseDecisionLog(text === null ? "" : text);
				/**
				* 卡片的计数**必须与详情页同源** —— 走同一个 `outputGroupOf`。
				*
				* ★ 真踩过（2026-10-09）：这里原来自己数（`analysis` 桶文件数 + `gddKindOf`），
				*   结果 `gdd\CS-20261009-001_读回验收报告.md`（无后缀的 `.md`）被 `gddKindOf` 判成 `draft`，
				*   卡片就写「有成稿 **2** 份」——而详情页只有 1 份。用户一眼就看出来了。
				*   判据两份 ⇒ 同一个东西两个数，这是本仓库最忌的一类 bug。
				*/
				const allFiles = [];
				for (const dir of ["analysis", "gdd"]) {
					const d = scan.dirs[dir];
					for (const n of d.files) allFiles.push({
						dir,
						name: n
					});
					for (const k of Object.keys(d.nested)) for (const n of d.nested[k]) allFiles.push({
						dir,
						name: n
					});
				}
				const groups = {
					brainstorm: 0,
					draft: 0,
					final: 0,
					speech: 0,
					config: 0,
					other: 0
				};
				for (const f of allFiles) {
					const g = outputGroupOf(f.dir, f.name);
					groups[g] = (groups[g] || 0) + 1;
				}
				let evidence = scan.dirs.evidence.files.length;
				for (const k of Object.keys(scan.dirs.evidence.nested)) evidence += scan.dirs.evidence.nested[k].length;
				const gddFiles = scan.dirs.gdd.files.concat(Object.keys(scan.dirs.gdd.nested).reduce((a, k) => a.concat(scan.dirs.gdd.nested[k]), []));
				const counts = {
					brainstorm: groups.brainstorm,
					draft: groups.draft,
					final: groups.final,
					speech: groups.speech,
					config: groups.config,
					other: groups.other,
					evidence,
					decisions: log.entries.length
				};
				const latestDate = gddFiles.reduce((best, n) => dateOf(n) > best ? dateOf(n) : best, "");
				const at = lastDecisionAt(log);
				const l = cardLineOf({
					counts,
					missing: scan.missing,
					lastDecisionAt: at,
					latestDate
				});
				features.push({
					topic: t,
					root,
					counts,
					lastDecisionAt: at,
					latestDate,
					stage: l.stage,
					line: l.line,
					tone: l.tone,
					missing: scan.missing
				});
			}
			features.sort((a, b) => {
				if (a.lastDecisionAt !== b.lastDecisionAt) return a.lastDecisionAt < b.lastDecisionAt ? 1 : -1;
				if (a.latestDate !== b.latestDate) return a.latestDate < b.latestDate ? 1 : -1;
				return a.topic < b.topic ? -1 : a.topic > b.topic ? 1 : 0;
			});
			return {
				features,
				note,
				counts: { features: features.length }
			};
		}
		//#endregion
		//#region src/client.js
		/**
		* 策划工作台 · 浏览器半侧（源码入口）—— v5 重写版。
		*
		* ★ 本文件是 tsdown 的**打包入口**，产物是 `lib/client.js`——一个形如
		*   `window.__ModuleLoader__.load({ id, factory })` 的单 bundle。
		*   改本文件后必须 `npm run build`（或开着 `npm run watch`），否则 `lib/client.js` 是旧的。
		*
		* ════════════════════════════════════════════════════════════════════════════
		* v5 的面板**只有两屏**（用户口径：只保留功能卡片和新建功能）：
		*
		*   ① 功能卡片墙 —— `features\` 下每个目录一张卡 + 一个〔＋ 新建功能〕
		*   ② 功能详情 —— 只有三个模块：**头脑风暴 / 决策记录 / 最终产物**
		*
		* v4 的其余一切（一级导航、审计面、设计台账、决策台账、定稿修订工作面、文档生成工作面、
		* 派生物与过期检测、外部交付包合入、资产索引、收件箱、V 校验清单、界面图……）**全部删除**。
		*
		* ── 新建功能做什么（v5 最大的机制变化）──────────────────────────────────────
		* v4 的面板在 Remote 层没有写能力，所以"新建"只能组装一条指令发给 agent 去建。
		* v5 用 DSH 的 `ctx.uiWorkspace.createDirectory(parent, name)`（宿主 directoryPicker 的
		* browse 后端，直接 `mkdir` 一级）**自己建**：
		*
		*     ① `features\`（没有就建）        ④ 按路径注册**专属工作区**
		*     ② `features\<主题>\`             ⑤ 在该工作区建**会话**，默认预设 =「策划模式」
		*     ③ 4 个桶：evidence / analysis / gdd / decisions
		*
		* 全程本地完成：**不发任何指令、不写任何文件内容、不经过 AI**。
		*
		* ── 两条会话（所有权凭据只有"标题 + 自己写的缓存"）──────────────────────────
		*   · 索引会话     cwd = SR 工作区根        标题 `策划工作台·索引（…）`    只读，不接指令
		*   · 功能工作会话 cwd = `features\<主题>\`  标题 `策划工作台·工作（<主题>）` **接指令**（头脑风暴四入口）
		*
		* ── 面板不做什么 ───────────────────────────────────────────────────────────
		*   · 不写任何**文件内容**（决策记录由会话里的 agent 按契约追加）；不删任何东西。
		*   · 不替定稿门背书（"最新定稿"只按文件名日期标，措辞里写清楚）。
		*   · 不假装知道：读不到就说读不到，缺桶就说缺桶。
		*/
		const h = react.createElement;
		const V = {
			bg: "var(--dsw-alias-bg-base)",
			panel: "var(--dsw-alias-bg-layer-1)",
			panel2: "var(--dsw-alias-bg-layer-2)",
			line: "var(--dsw-alias-border-l1)",
			line2: "var(--dsw-alias-border-l2)",
			ink: "var(--dsw-alias-label-primary)",
			muted: "var(--dsw-alias-label-secondary)",
			brand: "var(--dsw-alias-brand-primary)",
			ok: "var(--dsw-alias-state-success-primary)",
			warn: "var(--dsw-alias-state-warn-primary)",
			bad: "var(--dsw-alias-state-error-primary)"
		};
		const toneColor = (t) => t === "ok" ? V.ok : t === "warn" ? V.warn : t === "bad" ? V.bad : t === "brand" ? V.brand : V.muted;
		const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
		/**
		* **可点链接的蓝**（用户口径：能点的超链接就是蓝的）。
		* 不用 `--dsw-alias-brand-primary`：那支令牌在浅色主题里偏深、看着不像链接。
		* 这一支在浅色（#fff，约 4.6:1）与深色（#1e1e1e，约 4.4:1）底上都读得出来，且两边的"蓝"是一致的。
		*/
		const LINK = "#1a73e8";
		/**
		* 主按钮的**填充蓝**（与链接同一支，一个面板只用一支蓝）。
		*
		* ★ 为什么不跟宿主走：主题里 `--dsw-alias-brand-primary` = `var(--dsw-static-neutral-bluish-1000)`
		*   —— 那是**中性墨色（近黑）**，而 `--dsw-alias-button-primary-fill` **就等于** `brand-primary`。
		*   也就是说宿主的"主按钮"设计上就是黑的，用令牌永远拿不到蓝（5.1.2 那次改动就是空操作）。
		*   用户口径要蓝 ⇒ 用明确值，白字对比度约 4.6:1（AA）。
		*/
		const ACCENT_FILL = "#1a73e8";
		/** 主按钮 hover：同一支蓝提亮一点（不依赖任何宿主令牌）。 */
		const ACCENT_HOVER = "#2b7ff0";
		const IN = {
			font: "inherit",
			fontSize: FONT.body,
			padding: "5px 8px",
			borderRadius: "4px",
			border: "1px solid " + V.line2,
			background: V.panel,
			color: V.ink,
			boxSizing: "border-box",
			width: "100%"
		};
		const PAGE = {
			padding: "18px 22px 40px",
			boxSizing: "border-box",
			height: "100%",
			overflow: "auto",
			background: V.bg,
			color: V.ink,
			fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
			fontSize: FONT.title,
			lineHeight: 1.6
		};
		const PRE = {
			fontFamily: MONO,
			fontSize: "11.5px",
			whiteSpace: "pre-wrap",
			wordBreak: "break-word",
			background: V.panel2,
			border: "1px solid " + V.line,
			borderRadius: "6px",
			padding: GAP.sm,
			margin: 0,
			maxHeight: "300px",
			overflow: "auto"
		};
		/**
		* 状态小标签（10.5px / 1px 描边 / 3px 圆角）。
		* ★ 卡片改版时把原来那支圆角更大的 `Badge` 删了 —— 全插件只留**这一支**小标签，
		*   免得同一个东西有两套尺寸（那正是"看着不成体系"的来源）。
		*/
		function chip(text, color) {
			return h("span", { style: {
				fontSize: "10.5px",
				color,
				border: "1px solid " + color,
				borderRadius: RADIUS.chip,
				padding: "0 5px",
				whiteSpace: "nowrap"
			} }, text);
		}
		/**
		* 按钮。`tone`: "primary" | "plain"。
		*
		* ★ **官方组件（P0）**：宿主给了 primitives 就用官方 `Button`。三档用对：
		*   · 主按钮 → `primary`，但**底色用品牌强调色** `--dsw-alias-brand-primary`（官方给插件用的那支令牌），
		*     不是 `--dsw-alias-button-primary-fill`（宿主内部那支，在浅色主题里是深色）——
		*     用户口径：深色主按钮不如品牌蓝好看。底色被内联接管后 `:hover` 类不再生效，
		*     所以 hover / active 的反馈由这里自己给（`filter: brightness`），不动其它状态。
		*   · 次按钮 → `outline`（**有可见描边**，像一个按钮；`ghost` 静止时看不出是按钮）。
		*   · `icon` 槽位传官方图标（16×16，`gap: 4px` 由官方样式负责对齐）。
		*   · 拿不到 primitives ⇒ 退回下面这套自绘，观感与行为都保持原样。
		*/
		function Btn(props) {
			const tone = props.tone || "plain";
			const off = !!props.off;
			const [hover, setHover] = react.useState(false);
			if (HAS_PRIMITIVES) {
				const primary = tone === "primary";
				return h(PRIMITIVES.Button, {
					variant: primary ? "primary" : "outline",
					size: "sm",
					icon: props.icon ? h(props.icon, { size: 14 }) : void 0,
					disabled: off,
					title: props.title || "",
					onClick: off ? void 0 : props.onPick,
					onMouseEnter: () => setHover(true),
					onMouseLeave: () => setHover(false),
					style: primary ? {
						background: hover && !off ? ACCENT_HOVER : ACCENT_FILL,
						color: "#fff",
						transition: "background 120ms ease"
					} : { border: "1px solid " + V.line2 }
				}, props.label);
			}
			return h("button", {
				type: "button",
				disabled: off,
				title: props.title || "",
				onClick: off ? void 0 : props.onPick,
				style: {
					font: "inherit",
					fontSize: "12px",
					padding: "4px 11px",
					borderRadius: RADIUS.control,
					cursor: off ? "default" : "pointer",
					whiteSpace: "nowrap",
					border: "1px solid " + (tone === "primary" ? ACCENT_FILL : V.line2),
					background: tone === "primary" ? ACCENT_FILL : "transparent",
					color: tone === "primary" ? "#fff" : V.ink,
					opacity: off ? .45 : 1
				}
			}, props.label);
		}
		/** 折叠区：**收起时里面的字根本不渲染**（不是拿 CSS 藏）。 */
		function Fold(props) {
			const [open, setOpen] = react.useState(!!props.open);
			return h("div", { style: { marginTop: props.marginTop || "8px" } }, [h("button", {
				key: "h",
				type: "button",
				onClick: () => setOpen(!open),
				style: {
					font: "inherit",
					fontSize: "11.5px",
					padding: "2px 0",
					border: "none",
					background: "transparent",
					color: V.muted,
					cursor: "pointer",
					textAlign: "left"
				}
			}, (open ? "▾ " : "▸ ") + props.label + (props.note ? "　" + props.note : "")), open ? h("div", {
				key: "b",
				style: { marginTop: "5px" }
			}, props.children) : null]);
		}
		/** 一句提示（info / ok / warn / err）。 */
		function Notice(props) {
			const n = props.notice;
			if (!n) return null;
			const t = n.kind || "info";
			return h("div", { style: {
				border: "1px solid " + toneColor(t === "err" ? "bad" : t),
				borderRadius: "6px",
				padding: "7px 10px",
				marginBottom: "10px",
				fontSize: FONT.body,
				background: V.panel,
				color: V.ink,
				whiteSpace: "pre-wrap",
				wordBreak: "break-word"
			} }, [h("div", { key: "m" }, n.text || ""), n.next ? h("div", {
				key: "n",
				style: {
					marginTop: "3px",
					color: V.muted
				}
			}, n.next) : null]);
		}
		/**
		* 一行路径。**带按钮的那条直接「打开路径」**（用户口径：想看目录就点开，别让人先复制再粘贴）。
		* 给了 `onOpen` 才有按钮 —— 没给的场合（如决策记录卡，那里已经有「打开文件」）就只是一行等宽文字，
		* 需要复制时用鼠标选中即可。
		*/
		function PathLine(props) {
			return h("div", { style: {
				display: "flex",
				gap: GAP.sm,
				alignItems: "center",
				fontSize: "11.5px",
				color: V.muted
			} }, [h("code", {
				key: "c",
				style: {
					fontFamily: MONO,
					wordBreak: "break-all"
				}
			}, String(props.text || "")), typeof props.onOpen === "function" ? h("button", {
				key: "b",
				type: "button",
				onClick: () => props.onOpen(String(props.text || "")),
				title: "在文件管理器 / 默认程序里打开这个路径",
				style: {
					font: "inherit",
					fontSize: FONT.meta,
					border: "1px solid " + V.line2,
					background: "transparent",
					color: LINK,
					borderRadius: "4px",
					padding: "0 6px",
					cursor: "pointer",
					whiteSpace: "nowrap",
					flex: "0 0 auto"
				}
			}, "打开路径") : null]);
		}
		function TabBar(props) {
			return h("div", { style: {
				display: "flex",
				gap: GAP.xs,
				marginBottom: "14px",
				borderBottom: "1px solid " + V.line,
				paddingBottom: GAP.sm,
				flexWrap: "wrap"
			} }, props.items.map((it) => {
				const on = props.view === it.id;
				return h("button", {
					key: it.id,
					type: "button",
					onClick: () => props.onPick(it.id),
					style: {
						font: "inherit",
						fontSize: FONT.body,
						padding: "5px 12px",
						borderRadius: RADIUS.control,
						cursor: "pointer",
						border: "1px solid " + (on ? V.brand : V.line2),
						background: on ? V.brand : "transparent",
						color: on ? "#fff" : V.ink
					}
				}, it.label + (it.count === void 0 ? "" : "（" + it.count + "）"));
			}));
		}
		/** 一块内容（标题栏 + 正文）。 */
		function Card(props) {
			return h("div", { style: {
				border: "1px solid " + V.line,
				borderRadius: RADIUS.card,
				background: V.panel,
				padding: "12px 14px",
				marginBottom: GAP.md
			} }, [props.title === void 0 ? null : h("div", {
				key: "h",
				style: {
					display: "flex",
					alignItems: "baseline",
					gap: GAP.sm,
					marginBottom: GAP.sm,
					flexWrap: "wrap"
				}
			}, [
				h("div", {
					key: "t",
					style: {
						fontSize: FONT.title,
						fontWeight: 600
					}
				}, props.title),
				h("div", {
					key: "n",
					style: {
						fontSize: "11.5px",
						color: V.muted,
						flex: 1
					}
				}, props.note || ""),
				props.actions || null
			]), props.children]);
		}
		/**
		* 一行文件（名字 + 注解 + 打开）。
		*
		* ★ 可点的东西一律是**蓝色**（用户口径）：宿主主题的 brand 令牌在浅色主题里偏深、
		*   看着不像链接，所以这里用一支在浅色/深色底上都读得出来的蓝，hover 加下划线。
		*/
		function FileRow(props) {
			const [hover, setHover] = react.useState(false);
			return h("div", { style: {
				display: "flex",
				alignItems: "baseline",
				gap: GAP.sm,
				padding: "2px 0 2px 2px",
				fontSize: FONT.body,
				wordBreak: "break-all",
				lineHeight: 1.7
			} }, [
				h("a", {
					key: "a",
					href: "#",
					title: props.rel,
					onMouseEnter: () => setHover(true),
					onMouseLeave: () => setHover(false),
					onClick: (e) => {
						e.preventDefault();
						props.onOpen(toAbs(props.root, props.rel));
					},
					style: {
						color: LINK,
						textDecoration: hover ? "underline" : "none",
						cursor: "pointer"
					}
				}, props.name),
				props.note ? h("span", {
					key: "n",
					style: {
						fontSize: "10.5px",
						color: V.muted,
						whiteSpace: "nowrap",
						border: "1px solid " + V.line2,
						borderRadius: RADIUS.chip,
						padding: "0 4px"
					}
				}, props.note) : null,
				props.sub ? h("span", {
					key: "s",
					style: {
						fontSize: "10.5px",
						color: V.idle,
						fontFamily: MONO
					}
				}, props.sub) : null
			]);
		}
		/**
		* 一张功能卡片。
		*
		* ── 这次显示优化的三件事（用户口径：卡片太素、右下大片空白没用上）────────────
		*   ① **去掉三处重复**：徽标「有成稿」、人话「有成稿 1 份 · 还没定稿」、计数「成稿 1」原来各说一遍。
		*      现在徽标**只在真有状态可说时出现**（已定稿 / 缺桶），进度交给**阶段步进器**（四个点 + 件数），
		*      计数只显示**非零项**（零的那些在步进器里已经看得见）。
		*   ② **人话留着**（`cardLineOf` 是唯一出处，界面不另写话术）—— 缺桶那种要能一眼看见。
		*   ③ **键盘可达**：`role="button"` + `tabIndex` + Enter/Space + 焦点环
		*      （原来是个纯 `div`，键盘用户根本进不去）。
		*
		* 卡片**不自己算数**：拿到什么见 `src/load/dashboard.ts` 的 `FeatureCard` 接口。
		*/
		const STAGES = [
			{
				key: "brainstorm",
				label: "头脑"
			},
			{
				key: "draft",
				label: "成稿"
			},
			{
				key: "final",
				label: "定稿"
			},
			{
				key: "speech",
				label: "宣讲"
			}
		];
		function FeatureCard(props) {
			const f = props.feature;
			const c = f.counts || {};
			const [hover, setHover] = react.useState(false);
			const [focus, setFocus] = react.useState(false);
			const warn = f.tone === "warn";
			const done = f.tone === "ok";
			const open = () => props.onOpen();
			return h("div", {
				key: f.topic,
				role: "button",
				tabIndex: 0,
				title: f.root,
				onClick: open,
				onKeyDown: (e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						open();
					}
				},
				onMouseEnter: () => setHover(true),
				onMouseLeave: () => setHover(false),
				onFocus: () => setFocus(true),
				onBlur: () => setFocus(false),
				style: {
					border: "1px solid " + (warn ? V.warn : hover || focus ? V.brand : V.line),
					borderRadius: "9px",
					background: V.panel,
					padding: "12px 14px",
					cursor: "pointer",
					display: "flex",
					flexDirection: "column",
					gap: GAP.xs,
					minHeight: "132px",
					boxSizing: "border-box",
					boxShadow: focus ? "0 0 0 " + LINE.ring + " " + COLOR.accentSoft : hover ? SHADOW.hover : "none",
					transition: "border-color 120ms ease, box-shadow 120ms ease",
					outline: "none"
				}
			}, [
				h("div", {
					key: "t",
					style: {
						display: "flex",
						alignItems: "baseline",
						gap: GAP.sm
					}
				}, [h("div", {
					key: "n",
					style: {
						fontSize: FONT.card,
						fontWeight: 600,
						wordBreak: "break-all",
						flex: 1
					}
				}, f.topic), warn ? chip("缺桶", V.warn) : done ? chip("已定稿", V.ok) : null]),
				h("div", {
					key: "st",
					style: {
						display: "flex",
						alignItems: "center",
						gap: GAP.xs,
						margin: GAP.xs + " 0 1px",
						flexWrap: "wrap"
					}
				}, STAGES.map((s, i) => {
					const n = c[s.key] || 0;
					const on = n > 0;
					return h("span", {
						key: s.key,
						title: s.label + "：" + n + " 件",
						style: {
							display: "inline-flex",
							alignItems: "center",
							gap: "5px"
						}
					}, [
						i === 0 ? null : h("span", {
							key: "ln",
							style: {
								width: "10px",
								height: "1px",
								background: (c[STAGES[i - 1].key] || 0) > 0 ? ACCENT_FILL : V.line2
							}
						}),
						h("span", {
							key: "dot",
							style: {
								width: "7px",
								height: "7px",
								borderRadius: "50%",
								flex: "0 0 auto",
								background: on ? ACCENT_FILL : "transparent",
								border: "1px solid " + (on ? ACCENT_FILL : V.line2)
							}
						}),
						h("span", {
							key: "lb",
							style: {
								fontSize: "10.5px",
								color: on ? V.ink : V.idle,
								whiteSpace: "nowrap",
								fontVariantNumeric: "tabular-nums"
							}
						}, s.label + (on ? " " + n : ""))
					]);
				})),
				h("div", {
					key: "l",
					style: {
						fontSize: "11.5px",
						color: warn ? V.warn : V.muted
					}
				}, f.line),
				[
					"decisions",
					"evidence",
					"other"
				].some((k) => (c[k] || 0) > 0) ? h("div", {
					key: "c",
					style: {
						display: "flex",
						gap: GAP.sm,
						flexWrap: "wrap",
						fontSize: FONT.meta,
						color: V.muted,
						fontVariantNumeric: "tabular-nums"
					}
				}, [
					"decisions",
					"evidence",
					"other"
				].filter((k) => (c[k] || 0) > 0).map((k) => h("span", { key: k }, (k === "decisions" ? "决策" : k === "evidence" ? "证据" : "其它") + " " + c[k]))) : null,
				h("div", {
					key: "f",
					style: {
						display: "flex",
						alignItems: "baseline",
						gap: GAP.sm,
						fontSize: FONT.meta,
						color: V.idle,
						marginTop: "auto",
						paddingTop: "6px",
						fontVariantNumeric: "tabular-nums"
					}
				}, [h("span", {
					key: "d",
					title: f.lastDecisionAt || "",
					style: {
						fontFamily: MONO,
						flex: 1,
						wordBreak: "break-all"
					}
				}, f.lastDecisionAt ? "最近决策 " + (relTimeOf(f.lastDecisionAt) || f.lastDecisionAt) : "还没有决策"), hover || focus ? h("span", {
					key: "o",
					style: {
						color: ACCENT_FILL,
						whiteSpace: "nowrap"
					}
				}, "打开 ›") : null])
			]);
		}
		/**
		* **配置向导**（无本机配置时取代卡片墙）。
		*
		* 为什么要有它：同事拿到插件、或自己重装之后，本机没有 `config.local.json` 是**正常状态**，
		* 不该只丢一句"先跑 /sr-askme"。这里把四个字段摆出来，能点系统目录选择框就别手打路径。
		*
		* ★ 面板**不写盘**（整块面板的纪律）：〔保存并验证〕只是把值**交给一条会话**去写，
		*   写完面板**回读核对**（读到 + 必填齐才算成功）。会话写配置时还会把"配置在哪"写进
		*   `<工作区根>\.dsh\sr-workbench.path`（指针文件）—— 浏览器里拿不到家目录，
		*   面板靠这个相对路径认路。
		*/
		function ConfigWizard(props) {
			const v = props.values || {};
			const issues = props.issues || [];
			const issueOf = (k) => (issues.filter((i) => i.key === k)[0] || {}).message || "";
			const field = (f) => h("div", {
				key: f.key,
				style: { marginBottom: "10px" }
			}, [
				h("div", {
					key: "l",
					style: {
						display: "flex",
						alignItems: "baseline",
						gap: "6px",
						marginBottom: "3px"
					}
				}, [
					h("span", {
						key: "n",
						style: {
							fontSize: FONT.body,
							fontWeight: 600
						}
					}, f.label),
					f.required ? h("span", {
						key: "r",
						style: {
							fontSize: "10.5px",
							color: V.bad
						}
					}, "必填") : h("span", {
						key: "r",
						style: {
							fontSize: "10.5px",
							color: V.idle
						}
					}, "选填"),
					h("span", {
						key: "h",
						style: {
							fontSize: FONT.meta,
							color: V.muted,
							flex: 1
						}
					}, f.hint)
				]),
				h("div", {
					key: "i",
					style: {
						display: "flex",
						gap: "6px"
					}
				}, [h("input", {
					key: "in",
					type: "text",
					value: String(v[f.key] || ""),
					placeholder: "D:\\...",
					onChange: (e) => props.onField(f.key, e.target.value),
					style: {
						flex: 1,
						minWidth: 0,
						font: "inherit",
						fontSize: "12px",
						padding: "5px 8px",
						borderRadius: RADIUS.control,
						border: "1px solid " + (issueOf(f.key) ? V.bad : V.line2),
						background: "transparent",
						color: V.ink
					}
				}), Btn({
					key: "p",
					label: "选择…",
					onPick: () => props.onPick(f.key),
					off: props.picking
				})]),
				issueOf(f.key) ? h("div", {
					key: "e",
					style: {
						fontSize: FONT.meta,
						color: V.bad,
						marginTop: "3px"
					}
				}, issueOf(f.key)) : null
			]);
			return h(Card, {
				key: "wiz",
				title: "先配一下本机路径",
				note: "这台机器还没有配置 —— 同事第一次用、或你重装之后都是这样"
			}, [
				props.notice ? h(Notice, {
					key: "n",
					notice: props.notice
				}) : null,
				h("div", {
					key: "why",
					style: {
						fontSize: "11.5px",
						color: V.muted,
						marginBottom: "10px"
					}
				}, "配置是**本机私有**的，落 %USERPROFILE%\\.dsh\\sr-workbench\\config.local.json（不在技能目录里 —— 插件升一次级就没了）。面板自己不写盘：点〔保存并验证〕会把这份值**交给一条会话去写**，写完面板回读核对。"),
				...CONFIG_FIELDS.map(field),
				h("div", {
					key: "act",
					style: {
						display: "flex",
						gap: GAP.sm,
						alignItems: "center",
						marginTop: GAP.xs
					}
				}, [
					Btn({
						key: "s",
						label: props.saving ? "正在写…" : "保存并验证",
						tone: "primary",
						onPick: props.onSave,
						off: props.saving
					}),
					Btn({
						key: "a",
						label: "在会话里问答配置（/sr-askme）",
						onPick: props.onAskme,
						off: props.saving
					}),
					h("span", {
						key: "t",
						style: {
							fontSize: FONT.meta,
							color: V.idle,
							flex: 1
						}
					}, props.saving ? "等会话写完（最长约 60 秒），面板会自己回读核对。" : "")
				]),
				h(Fold, {
					key: "dbg",
					label: "面板找过哪些路径",
					note: "（找不到配置时看这个）"
				}, h("pre", { style: PRE }, (props.triedPaths || []).join("\n") + "\n（还会读每个工作区根下的 .dsh\\sr-workbench.path 指针，看配置被写到哪了）"))
			]);
		}
		/** 〔＋ 新建功能〕表单：输名字 → 建目录 + 4 桶 + 工作区 + 会话（策划模式）。 */
		function CreateForm(props) {
			const topic = props.topic || "";
			const check = topic.trim() === "" ? null : checkTopicName(topic);
			const plan = props.plan || null;
			const busy = !!props.busy;
			const off = busy || !!(check && !check.ok) || !!(plan && !plan.ok);
			return h(Card, {
				title: "新建功能",
				note: "建目录 + 4 个桶 + 专属工作区 + 工作会话（策划模式）—— 全部本地完成，不发指令",
				actions: Btn({
					label: "取消",
					onPick: props.onCancel,
					off: busy
				})
			}, [
				h("div", {
					key: "i",
					style: {
						display: "flex",
						gap: GAP.sm,
						alignItems: "center",
						flexWrap: "wrap"
					}
				}, [h("input", {
					key: "t",
					style: Object.assign({}, IN, { maxWidth: "320px" }),
					placeholder: "主题名，例如：联盟讨伐",
					value: topic,
					disabled: busy,
					autoFocus: true,
					onChange: (e) => props.onTopic(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter" && !off) props.onSubmit();
					}
				}), Btn({
					label: busy ? "正在建…" : "建立",
					tone: "primary",
					off,
					onPick: props.onSubmit
				})]),
				check && !check.ok ? h("div", {
					key: "c",
					style: {
						marginTop: "7px",
						fontSize: "12px",
						color: V.warn
					}
				}, [h("div", { key: "m" }, check.message), h("div", {
					key: "n",
					style: { color: V.muted }
				}, check.next)]) : null,
				plan && !plan.ok ? h("div", {
					key: "p",
					style: {
						marginTop: "7px",
						fontSize: "12px",
						color: V.warn
					}
				}, [h("div", { key: "m" }, plan.message), h("div", {
					key: "n",
					style: { color: V.muted }
				}, plan.next)]) : null,
				plan && plan.ok ? h("div", {
					key: "ok",
					style: { marginTop: "9px" }
				}, [
					h("div", {
						key: "r",
						style: {
							fontSize: "11.5px",
							color: V.muted
						}
					}, "将建立："),
					h("code", {
						key: "c",
						style: {
							fontFamily: MONO,
							fontSize: "12px",
							wordBreak: "break-all"
						}
					}, plan.root + "\\"),
					h("div", {
						key: "b",
						style: { marginTop: "5px" }
					}, plan.buckets.map((b) => h("div", {
						key: b,
						style: {
							fontFamily: MONO,
							fontSize: "11.5px",
							color: V.muted
						}
					}, b + "\\　—　" + bucketHint(b))))
				]) : null,
				h("div", {
					key: "h",
					style: {
						marginTop: "10px",
						fontSize: "11.5px",
						color: V.muted
					}
				}, "面板只建【目录】与【会话】；决策记录.md 由会话里的 agent 在这个功能第一次做决策时按统一格式创建（格式见功能详情 › 决策记录）。")
			]);
		}
		function Dashboard(props) {
			const d = props.dash || {};
			const feats = d.features || [];
			const nothing = feats.length === 0 && props.phase !== "loading";
			return h("div", null, [
				h("div", {
					key: "top",
					style: {
						position: "sticky",
						top: 0,
						zIndex: 5,
						display: "flex",
						alignItems: "baseline",
						gap: GAP.sm,
						flexWrap: "wrap",
						margin: "-18px -22px " + GAP.sm,
						padding: "18px 22px " + GAP.sm,
						background: "var(--dsw-alias-bg-base)",
						borderBottom: "1px solid " + V.line
					}
				}, [
					h("div", {
						key: "t",
						style: {
							fontSize: FONT.page,
							fontWeight: 700,
							lineHeight: LEADING.tight
						}
					}, "策划工作台"),
					h("div", {
						key: "n",
						style: {
							fontSize: FONT.body,
							color: V.muted,
							fontVariantNumeric: "tabular-nums"
						}
					}, "功能 " + feats.length + (d.srWs ? "　｜　" + d.srWs : "")),
					h("div", {
						key: "s",
						style: { flex: 1 }
					}),
					Btn({
						key: "r",
						label: "刷新",
						icon: PRIMITIVES && PRIMITIVES.IconRefreshOutlineRegular,
						onPick: props.onRefresh,
						off: props.phase === "loading"
					}),
					Btn({
						key: "n",
						label: "新建功能",
						icon: PRIMITIVES && PRIMITIVES.IconPlusOutlineRegular,
						tone: "primary",
						onPick: props.onNew,
						off: props.newOpen
					})
				]),
				h(Notice, {
					key: "n",
					notice: props.notice
				}),
				props.newOpen ? h(CreateForm, {
					key: "new",
					topic: props.newTopic,
					plan: props.plan,
					busy: props.busy,
					onTopic: props.onTopic,
					onSubmit: props.onSubmit,
					onCancel: props.onCancel
				}) : null,
				props.phase === "loading" && feats.length === 0 ? h("div", {
					key: "l",
					style: {
						color: V.muted,
						fontSize: FONT.body
					}
				}, "正在读工作区…") : null,
				nothing ? h("div", {
					key: "e",
					style: {
						border: "1px dashed " + V.line2,
						borderRadius: RADIUS.card,
						padding: GAP.xl,
						textAlign: "center",
						color: V.muted
					}
				}, [h("div", { key: "a" }, "还没有功能。"), h("div", {
					key: "b",
					style: {
						marginTop: GAP.xs,
						fontSize: FONT.body
					}
				}, "点右上角〔新建功能〕建第一个。")]) : null,
				h("div", {
					key: "g",
					/**
					* ★ `auto-fit` 而不是 `auto-fill`：`auto-fill` 会把面板宽度切成固定条数，
					*   功能少时卡片只占左边几条、右边空一大片（用户截图里画箭头指的就是那片）。
					*   `auto-fit` 让**空轨道塌掉**、卡片自己长宽；再用 maxWidth 兜住上限，
					*   免得只有一两个功能时被拉成一条。
					*/
					style: {
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
						gap: GAP.md,
						marginTop: GAP.sm
					}
				}, feats.map((f) => h("div", {
					key: f.topic,
					style: {
						display: "flex",
						maxWidth: "520px",
						minWidth: 0
					}
				}, h(FeatureCard, {
					feature: f,
					onOpen: () => props.onOpen(f.topic)
				})))),
				HAS_PRIMITIVES ? null : h("div", {
					key: "__ui",
					style: {
						fontSize: "10.5px",
						color: V.idle,
						marginTop: GAP.md
					}
				}, primitivesNote())
			]);
		}
		const ENT = {};
		for (const e of ENTRANCES) ENT[e.id] = e;
		/** 每个入口的表单字段（**唯一出处**：`ENTRANCES` 的 `prereq` 决定要什么）。 */
		const FIELDS = {
			analysis: [{
				k: "materials",
				label: "素材（目录 / 文件路径 / 链接，一行一个）",
				lines: 3,
				mono: true
			}, {
				k: "note",
				label: "分析目标（可空）",
				lines: 2
			}],
			concept: [{
				k: "seed",
				label: "一句话创意",
				lines: 2
			}, {
				k: "materials",
				label: "参考素材（可空，一行一个路径 / 链接）",
				lines: 2,
				mono: true
			}],
			legacy: [{
				k: "materials",
				label: "旧文档（目录或文件路径，一行一个）",
				lines: 3,
				mono: true
			}, {
				k: "note",
				label: "补充说明（可空）",
				lines: 2
			}],
			humannote: [
				{
					k: "title",
					label: "标题",
					lines: 1
				},
				{
					k: "quote",
					label: "原话（逐字保留）",
					lines: 3,
					mono: true
				},
				{
					k: "bounds",
					label: "边界（可空）",
					lines: 2
				},
				{
					k: "landing",
					label: "落点（可空，条目引用，如 §4 R2 / §5 UI-M1 UE2）",
					lines: 1
				}
			]
		};
		/** 表单 → `buildBrainstormInstruction` 的输入（**字段名映射只有这一处**）。 */
		function inputOf(kind, form) {
			const f = form || {};
			const mats = INTAKE.parseMaterials(f.materials || "");
			if (kind === "concept") return {
				materials: mats,
				note: f.seed || ""
			};
			if (kind === "humannote") return {
				title: f.title || "",
				quote: f.quote || "",
				bounds: f.bounds || "",
				landing: f.landing || ""
			};
			return {
				materials: mats,
				note: f.note || ""
			};
		}
		function BrainstormModule(props) {
			const d = props.detail;
			/** `loadBrainstorm` 的 `groups` 就是 `groupAnalyses` 的结论：`{ entries, other, counts, total }`。 */
			const b = props.detail.brainstorm || {};
			const g = b.groups || {
				entries: [],
				other: [],
				counts: {},
				total: 0
			};
			const [pick, setPick] = react.useState("analysis");
			const [form, setForm] = react.useState({});
			const setField = (k, v) => setForm(Object.assign({}, form, { [k]: v }));
			const preview = react.useMemo(() => {
				try {
					return INTAKE.buildBrainstormInstruction(pick, Object.assign({
						root: d.root,
						topic: d.topic,
						date: todayCompact()
					}, inputOf(pick, form)));
				} catch (e) {
					return {
						instruction: "",
						blocked: "指令组装失败：" + String(e && e.message || e),
						next: ""
					};
				}
			}, [
				pick,
				form,
				d.root,
				d.topic
			]);
			const counts = g.counts || {};
			return h("div", null, [
				h(Notice, {
					key: "n",
					notice: props.notice
				}),
				h(Card, {
					key: "entry",
					/**
					* ★ 原来这里挂着那句「没有先后，想走哪条走哪条 —— 指令发给这个功能的工作会话
					*   （cwd = 功能目录），产出落 analysis\」—— 用户口径：**去掉**。
					*   四张入口卡各自写着"跑什么 / 需要什么"，"发给哪条会话、产出落哪"是**实现细节**，
					*   不必每次占一行（要看逐字指令时下面就有〔看将要发出去的指令〕）。
					*/
					title: "四个入口"
				}, [
					h("div", {
						key: "cards",
						style: {
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(214px, 1fr))",
							gap: GAP.sm,
							marginBottom: "10px"
						}
					}, ENTRANCES.map((e) => h("div", {
						key: e.id,
						onClick: () => setPick(e.id),
						style: {
							border: "1px solid " + (pick === e.id ? V.brand : V.line),
							borderRadius: "7px",
							padding: "8px 10px",
							cursor: "pointer",
							background: pick === e.id ? V.panel2 : "transparent"
						}
					}, [
						h("div", {
							key: "t",
							style: {
								fontWeight: 600,
								fontSize: FONT.body
							}
						}, e.label),
						h("div", {
							key: "h",
							style: {
								fontSize: FONT.meta,
								color: V.muted
							}
						}, e.hint),
						h("div", {
							key: "n",
							style: {
								fontSize: FONT.meta,
								color: V.muted,
								marginTop: "3px"
							}
						}, "需要：" + e.needs),
						h("div", {
							key: "c",
							style: {
								fontSize: FONT.meta,
								marginTop: "3px",
								color: V.muted
							}
						}, "已有产物 " + (counts[e.id] || 0) + " 件")
					]))),
					(FIELDS[pick] || []).map((f) => h("div", {
						key: f.k,
						style: { marginBottom: "7px" }
					}, [h("div", {
						key: "l",
						style: {
							fontSize: "11.5px",
							color: V.muted,
							marginBottom: "3px"
						}
					}, f.label), h("textarea", {
						key: "i",
						rows: f.lines,
						style: Object.assign({}, IN, {
							resize: "vertical",
							fontFamily: f.mono ? MONO : "inherit"
						}),
						value: form[f.k] || "",
						onChange: (ev) => setField(f.k, ev.target.value)
					})])),
					preview.blocked ? h("div", {
						key: "b",
						style: {
							fontSize: "12px",
							color: V.warn,
							marginBottom: "7px"
						}
					}, [h("div", { key: "m" }, preview.blocked), h("div", {
						key: "n",
						style: { color: V.muted }
					}, preview.next)]) : null,
					h("div", {
						key: "a",
						style: {
							display: "flex",
							gap: GAP.sm,
							alignItems: "center",
							flexWrap: "wrap"
						}
					}, [Btn({
						key: "s",
						label: props.sending ? "正在发…" : "交给工作会话",
						tone: "primary",
						off: !!preview.blocked || props.sending,
						onPick: () => props.onSend(preview.instruction)
					}), h("span", {
						key: "n",
						style: {
							fontSize: "11.5px",
							color: V.muted
						}
					}, props.sessionNote || "")]),
					h(Fold, {
						key: "p",
						label: "看将要发出去的指令",
						note: "（逐字就是发出去的那一份）"
					}, h("pre", { style: PRE }, preview.instruction || "（还没填够 —— 上面那句说明了缺什么）"))
				]),
				h(Card, {
					key: "have",
					title: "已有的分析结论",
					note: "按四个入口分组；点文件名用系统默认程序打开"
				}, (g.total || 0) === 0 ? h("div", { style: {
					color: V.muted,
					fontSize: FONT.body
				} }, "analysis\\ 还是空的 —— 上面四个入口任选一个开始。") : h("div", null, (g.entries || []).map((en) => h("div", {
					key: en.id,
					style: { marginBottom: "10px" }
				}, [h("div", {
					key: "h",
					style: {
						fontSize: "12px",
						fontWeight: 600
					}
				}, en.label + "（" + en.count + "）"), en.count === 0 ? h("div", {
					key: "e",
					style: {
						fontSize: "11.5px",
						color: V.muted
					}
				}, "这一路还没走过") : h("div", { key: "l" }, en.files.map((f) => h(FileRow, {
					key: f.rel,
					name: f.name,
					rel: f.rel,
					root: d.root,
					onOpen: props.onOpen
				})))])).concat((g.other || []).length ? [h("div", {
					key: "__other",
					style: { marginBottom: "10px" }
				}, [h("div", {
					key: "h",
					style: {
						fontSize: "12px",
						fontWeight: 600
					}
				}, "其他 / 来源未知（" + g.other.length + "）"), h("div", { key: "l" }, g.other.map((f) => h(FileRow, {
					key: f.rel,
					name: f.name,
					rel: f.rel,
					root: d.root,
					onOpen: props.onOpen
				})))])] : []))),
				(b.legacy || []).length || (b.humannote || []).length || (b.unreadable || []).length ? h(Card, {
					key: "fmt",
					title: "固定格式的两类产物",
					note: "旧文档分析（四段固定章节）· 人工补充（原话与结论并排）"
				}, [
					(b.legacy || []).map((x) => h("div", {
						key: "L" + x.rel,
						style: { marginBottom: "6px" }
					}, [
						h("div", {
							key: "t",
							style: {
								fontSize: "12px",
								fontWeight: 600
							}
						}, "旧文档分析：" + x.name),
						(x.missing || []).length ? h("div", {
							key: "m",
							style: {
								fontSize: "11.5px",
								color: V.warn
							}
						}, "缺固定章节：" + x.missing.join("、")) : null,
						(x.extra || []).length ? h("div", {
							key: "e",
							style: {
								fontSize: "11.5px",
								color: V.muted
							}
						}, "多出来的章节：" + x.extra.map((s) => s.title).join("、")) : null
					])),
					(b.humannote || []).map((x) => h("div", {
						key: "H" + x.rel,
						style: { marginBottom: "6px" }
					}, [
						h("div", {
							key: "t",
							style: {
								fontSize: "12px",
								fontWeight: 600
							}
						}, "人工补充：" + x.name),
						h("div", {
							key: "q",
							style: {
								fontSize: "11.5px",
								color: V.muted,
								whiteSpace: "pre-wrap"
							}
						}, x.quote && x.quote.found ? x.quote.raw : "（没有 `> 原话：…` 那一行）"),
						(x.missing || []).length ? h("div", {
							key: "m",
							style: {
								fontSize: "11.5px",
								color: V.warn
							}
						}, "缺固定章节：" + x.missing.join("、")) : null
					])),
					(b.unreadable || []).length ? h("div", {
						key: "u",
						style: {
							fontSize: "11.5px",
							color: V.warn
						}
					}, "读不动的文件：" + b.unreadable.map((u) => u.name + "（" + u.why + "）").join("；")) : null
				]) : null,
				(b.notes || []).length ? h("div", {
					key: "notes",
					style: {
						fontSize: "11.5px",
						color: V.muted
					}
				}, b.notes.map((s, i) => h("div", { key: i }, "· " + s))) : null
			]);
		}
		const LABEL_RE = new RegExp("^\\s*(?:\\*\\*)?\\s*(" + [
			"决策",
			"依据",
			"理由",
			"影响",
			"结论",
			"备注",
			"风险",
			"边界",
			"落点"
		].join("|") + ")\\s*(?:\\*\\*)?\\s*[:：]\\s*(.*)$");
		/** 正文 → 渲染行（不改变原文，只决定怎么显示）。 */
		function bodyParts(body) {
			const out = [];
			for (const line of String(body || "").split(/\r?\n/)) {
				const m = LABEL_RE.exec(line);
				if (m) {
					out.push({
						kind: "label",
						label: m[1],
						text: m[2]
					});
					continue;
				}
				if (/^\s*[-*]\s+/.test(line)) {
					out.push({
						kind: "li",
						text: line.replace(/^\s*[-*]\s+/, "")
					});
					continue;
				}
				if (line.trim() === "") {
					out.push({ kind: "gap" });
					continue;
				}
				out.push({
					kind: "p",
					text: line
				});
			}
			return out;
		}
		function DecisionEntry(props) {
			const e = props.entry;
			return h("div", { style: {
				borderLeft: "2px solid " + V.line2,
				paddingLeft: GAP.md,
				marginBottom: "14px",
				position: "relative"
			} }, [
				h("div", {
					key: "dot",
					style: {
						position: "absolute",
						left: "-5px",
						top: "7px",
						width: "8px",
						height: "8px",
						borderRadius: "50%",
						background: V.brand
					}
				}),
				h("div", {
					key: "t",
					style: {
						display: "flex",
						alignItems: "baseline",
						gap: GAP.sm,
						flexWrap: "wrap"
					}
				}, [
					h("span", {
						key: "a",
						style: {
							fontFamily: MONO,
							fontSize: FONT.body,
							fontWeight: 600
						}
					}, e.at || "（没有时间戳）"),
					h("span", {
						key: "n",
						style: {
							fontSize: FONT.meta,
							color: V.muted
						}
					}, "第 " + e.index + " 条"),
					e.title ? h("span", {
						key: "x",
						style: {
							fontSize: "12px",
							color: V.muted
						}
					}, "· " + e.title) : null
				]),
				h("div", {
					key: "b",
					style: { marginTop: GAP.xs }
				}, bodyParts(e.body).map((p, i) => {
					if (p.kind === "gap") return h("div", {
						key: i,
						style: { height: "5px" }
					});
					if (p.kind === "li") return h("div", {
						key: i,
						style: {
							paddingLeft: GAP.md,
							fontSize: FONT.body
						}
					}, "· " + p.text);
					if (p.kind === "label") return h("div", {
						key: i,
						style: {
							fontSize: FONT.body,
							display: "flex",
							gap: "7px",
							alignItems: "baseline",
							marginTop: "2px"
						}
					}, [h("span", {
						key: "l",
						style: {
							flex: "0 0 auto",
							color: p.label === "决策" ? V.ink : V.muted,
							fontWeight: p.label === "决策" ? 600 : 400,
							fontSize: "11.5px",
							border: "1px solid " + V.line2,
							borderRadius: "4px",
							padding: "0 5px"
						}
					}, p.label), h("span", {
						key: "t",
						style: {
							whiteSpace: "pre-wrap",
							wordBreak: "break-word"
						}
					}, p.text)]);
					return h("div", {
						key: i,
						style: {
							fontSize: FONT.body,
							whiteSpace: "pre-wrap",
							wordBreak: "break-word"
						}
					}, p.text);
				}))
			]);
		}
		function DecisionsModule(props) {
			const d = props.detail;
			const dec = d.decisions || {
				log: null,
				rel: "decisions/决策记录.md",
				abs: ""
			};
			const log = dec.log || {
				present: false,
				entries: [],
				issues: [],
				preamble: "",
				title: "",
				text: ""
			};
			const [raw, setRaw] = react.useState(false);
			const entries = (log.entries || []).slice().reverse();
			const abs = dec.abs || String(d.root || "").replace(/[\\/]+$/, "") + "\\decisions\\决策记录.md";
			/**
			* ★ 条目格式模板**只在"没东西可读"时出现**（文件还不存在 / 文件在但没有带时间戳的条目）。
			*   有真实条目时它纯属占位 —— 条目标题本身就是"时间 + 决策内容"的样例，
			*   而 `决策 / 依据 / 影响` 三个标签下每一条都印着（用户口径：不额外占位置）。
			*/
			const showFormat = !log.present || entries.length === 0;
			return h("div", null, [
				h(Card, {
					key: "h",
					title: "决策记录",
					note: "这个功能的所有决策都记在同一个文件里 —— 不管发生在哪一步、哪个 skill",
					actions: h("div", {
						key: "a",
						style: {
							display: "flex",
							gap: "6px"
						}
					}, [Btn({
						key: "r",
						label: raw ? "看时间线" : "看原文",
						onPick: () => setRaw(!raw),
						off: !log.present
					}), Btn({
						key: "o",
						label: "打开文件",
						onPick: () => props.onOpenAbs(abs),
						off: !log.present
					})])
				}, [
					h("div", { key: "p" }, PathLine({ text: abs })),
					h("div", {
						key: "s",
						style: {
							fontSize: "11.5px",
							color: V.muted,
							marginTop: "5px"
						}
					}, log.present ? "共 " + (log.entries || []).length + " 条" + (entries[0] ? "　｜　最近一条 " + entries[0].at : "") : "这个文件还不存在 —— 会话里的 agent 在该功能第一次做决策时会按下面的格式创建它。"),
					(log.issues || []).length ? h("div", {
						key: "i",
						style: {
							marginTop: "7px",
							fontSize: "11.5px",
							color: V.warn
						}
					}, log.issues.map((s, i) => h("div", { key: i }, "· " + s))) : null
				]),
				showFormat ? h(Card, {
					key: "f",
					title: "条目格式",
					note: "时间（年月日时分秒）+ 决策内容；只在文件末尾追加"
				}, h("pre", { style: PRE }, decisionEntryTemplate(stampOf(/* @__PURE__ */ new Date())))) : null,
				raw && log.present ? h(Card, {
					key: "raw",
					title: "原文"
				}, h("pre", { style: Object.assign({}, PRE, { maxHeight: "560px" }) }, log.text)) : log.present ? h(Card, {
					key: "list",
					title: "全部决策",
					note: "最新的在最上面"
				}, entries.length === 0 ? h("div", { style: {
					color: V.muted,
					fontSize: FONT.body
				} }, "文件在，但还没有带时间戳的条目 —— 照上面那份格式追加第一条。") : entries.map((e) => h(DecisionEntry, {
					key: e.index,
					entry: e
				}))) : h(Card, {
					key: "empty",
					title: "还没有决策记录"
				}, h("div", { style: {
					fontSize: FONT.body,
					color: V.muted
				} }, "进了这个功能的工作会话之后，任何一步定了事，都让 agent 往 " + abs + " 末尾追加一条（时间 + 决策内容）。上面那份模板就是它要照抄的格式。"))
			]);
		}
		function OutputsModule(props) {
			const d = props.detail;
			const o = d.outputs || {
				groups: [],
				total: 0,
				counts: {}
			};
			const main = (o.groups || []).filter((g) => g.key !== "other");
			const other = (o.groups || []).filter((g) => g.key === "other")[0];
			return h("div", null, [h(Card, { key: "h" }, [o.total === 0 ? h("div", {
				key: "e",
				style: {
					color: V.muted,
					fontSize: FONT.body
				}
			}, "还没有产物。") : main.map((g) => h("div", {
				key: g.key,
				style: { marginBottom: GAP.md }
			}, [
				h("div", {
					key: "h",
					title: g.note,
					style: {
						display: "flex",
						alignItems: "baseline",
						gap: GAP.sm,
						borderBottom: "1px solid " + V.line,
						paddingBottom: "3px",
						marginBottom: GAP.xs
					}
				}, [
					h("div", {
						key: "t",
						style: {
							fontSize: FONT.body,
							fontWeight: 600
						}
					}, g.label),
					g.dir ? h("code", {
						key: "d",
						style: {
							fontFamily: MONO,
							fontSize: "10.5px",
							color: V.idle
						}
					}, g.dir + "\\") : null,
					h("div", {
						key: "s",
						style: { flex: 1 }
					}),
					h("div", {
						key: "c",
						style: {
							fontSize: FONT.meta,
							color: g.count ? V.muted : V.idle
						}
					}, g.count + " 件")
				]),
				g.dynamic ? h("div", {
					key: "dy",
					style: {
						fontSize: FONT.meta,
						color: V.warn,
						margin: "2px 0 3px"
					}
				}, g.dynamic) : null,
				g.count === 0 ? h("div", {
					key: "e",
					style: {
						fontSize: "11.5px",
						color: V.idle,
						paddingLeft: "2px"
					}
				}, "这一类还没有") : h("div", {
					key: "l",
					style: { paddingLeft: "2px" }
				}, g.files.map((f) => h(FileRow, {
					key: f.rel,
					name: f.name,
					rel: f.rel,
					root: d.root,
					sub: f.subdir ? f.subdir + "\\" : "",
					note: f.note,
					onOpen: props.onOpen
				})))
			])), other && other.count > 0 ? h(Fold, {
				key: "o",
				label: "其它（不属上面四类）",
				note: "（" + other.count + " 件 —— 如实列出，不丢）"
			}, h("div", { style: { paddingLeft: "2px" } }, other.files.map((f) => h(FileRow, {
				key: f.rel,
				name: f.name,
				rel: f.rel,
				root: d.root,
				note: f.kindLabel,
				sub: f.subdir ? f.subdir + "\\" : "",
				onOpen: props.onOpen
			})))) : null])]);
		}
		const MODULES = [
			{
				id: "brainstorm",
				label: "头脑风暴"
			},
			{
				id: "decisions",
				label: "决策记录"
			},
			{
				id: "outputs",
				label: "最终产物"
			}
		];
		function FeatureView(props) {
			const d = props.detail;
			const [mod, setMod] = react.useState("brainstorm");
			const items = MODULES.map((m) => Object.assign({}, m, { count: m.id === "brainstorm" ? d.brainstorm && d.brainstorm.groups && d.brainstorm.groups.total || 0 : m.id === "decisions" ? d.decisions && d.decisions.log && d.decisions.log.entries.length || 0 : d.outputs ? d.outputs.total : 0 }));
			return h("div", null, [
				h("div", {
					key: "top",
					style: {
						display: "flex",
						alignItems: "baseline",
						gap: "9px",
						flexWrap: "wrap",
						marginBottom: GAP.xs
					}
				}, [
					Btn({
						key: "back",
						label: "‹ 卡片墙",
						onPick: props.onBack
					}),
					h("div", {
						key: "t",
						style: {
							fontSize: "17px",
							fontWeight: 700
						}
					}, d.topic),
					h("div", {
						key: "s",
						style: { flex: 1 }
					}),
					Btn({
						key: "r",
						label: "刷新",
						onPick: props.onRefresh,
						off: props.phase === "loading"
					}),
					props.sessionId ? Btn({
						key: "o",
						label: "打开工作会话",
						onPick: () => props.onOpenSession(props.sessionId)
					}) : null
				]),
				h("div", {
					key: "p",
					style: { marginBottom: "10px" }
				}, PathLine({
					text: d.root,
					onOpen: props.onOpen
				})),
				(d.strangerDirs || []).length ? h("div", {
					key: "sd",
					style: {
						fontSize: "11.5px",
						color: V.warn,
						marginBottom: "6px"
					}
				}, "不是 4 个桶的目录（如实列出）：" + d.strangerDirs.join("、")) : null,
				(d.rootFiles || []).length ? h("div", {
					key: "rf",
					style: {
						fontSize: "11.5px",
						color: V.muted,
						marginBottom: "6px"
					}
				}, "功能根下的散文件：" + d.rootFiles.join("、")) : null,
				(d.missing || []).length ? h("div", {
					key: "m",
					style: {
						fontSize: "12px",
						color: V.warn,
						marginBottom: GAP.sm
					}
				}, "这个功能缺桶：" + d.missing.join("、") + " —— 面板只建不删，不会替你补，请手工建这几个目录。") : null,
				h(Notice, {
					key: "n",
					notice: props.notice
				}),
				h(TabBar, {
					key: "tabs",
					items,
					view: mod,
					onPick: setMod
				}),
				mod === "brainstorm" ? h(BrainstormModule, {
					detail: d,
					onOpen: props.onOpen,
					onSend: props.onSendBrainstorm,
					sending: props.sending,
					notice: null,
					sessionNote: props.sessionNote
				}) : null,
				mod === "decisions" ? h(DecisionsModule, {
					detail: d,
					onOpenAbs: props.onOpenAbs
				}) : null,
				mod === "outputs" ? h(OutputsModule, {
					detail: d,
					onOpen: props.onOpen
				}) : null
			]);
		}
		var PanelErrorBoundary = class extends react.Component {
			constructor(props) {
				super(props);
				this.state = { err: null };
			}
			static getDerivedStateFromError(err) {
				return { err };
			}
			componentDidCatch(err, info) {
				console.error("[sr-workbench] 渲染失败", err, info);
			}
			render() {
				const e = this.state.err;
				if (!e) return this.props.children;
				return h("div", { style: Object.assign({}, PAGE, { color: V.bad }) }, [
					h("h1", {
						key: "t",
						style: {
							fontSize: "16px",
							margin: "0 0 10px",
							color: V.ink
						}
					}, "策划工作台 · 渲染失败"),
					h("div", {
						key: "m",
						style: {
							fontSize: FONT.title,
							marginBottom: "10px"
						}
					}, String(e && e.message || e)),
					h("pre", {
						key: "s",
						style: Object.assign({}, PRE, {
							maxHeight: "400px",
							color: V.muted
						})
					}, String(e && e.stack || "").slice(0, 3e3))
				]);
			}
		};
		/** `YYYYMMDD`（四条入口的产出文件名用）。 */
		function todayCompact() {
			const d = /* @__PURE__ */ new Date();
			const p = (n) => (n < 10 ? "0" : "") + n;
			return String(d.getFullYear()) + p(d.getMonth() + 1) + p(d.getDate());
		}
		function Panel(props) {
			const useSessions = props.useSessions;
			const useWorkspaces = props.useWorkspaces;
			const sessionsSnap = useSessions ? useSessions((s) => s) : null;
			const wsSnap = useWorkspaces ? useWorkspaces((s) => s) : null;
			const sessionRows = react.useMemo(() => rowsFromStore(sessionsSnap), [sessionsSnap]);
			const wsPaths = react.useMemo(() => (wsSnap && wsSnap.items || []).map((w) => w && w.path).filter(Boolean), [wsSnap]);
			const archived = react.useMemo(() => {
				try {
					return archivedFromSnapshot(wsSnap);
				} catch (e) {
					return null;
				}
			}, [wsSnap]);
			const [idx, setIdx] = react.useState(null);
			const [phase, setPhase] = react.useState("idle");
			const [notice, setNotice] = react.useState(null);
			const [dash, setDash] = react.useState(null);
			/** 配置向导：非空 = 这台机器还没配好（值 / 试过的路径 / 保存中标志都在里面）。 */
			const [wiz, setWiz] = react.useState(null);
			const saveConfig = async () => {
				const w = wiz;
				if (!w) return;
				const chk = validateConfigValues(w.values);
				if (!chk.ok) {
					setWiz(Object.assign({}, w, { issues: chk.issues }));
					setNotice({
						kind: "warn",
						text: "还有字段没填对。"
					});
					return;
				}
				setNotice(null);
				setWiz(Object.assign({}, w, {
					saving: true,
					issues: []
				}));
				try {
					const r = await props.__saveConfig({
						values: w.values,
						roots: w.roots || [],
						configPathHint: w.configPathHint || ""
					});
					if (!r || !r.ok) {
						setWiz(Object.assign({}, wiz, { saving: false }));
						setNotice({
							kind: "warn",
							text: "写配置没成：" + String(r && r.error || "未知原因"),
							next: "面板不写盘 —— 写盘的是会话。去那条会话看它跑到哪了；或点〔在会话里问答配置〕让它边问边写。"
						});
						return;
					}
					setWiz(null);
					setNotice({
						kind: "ok",
						text: "配置已写好并核对通过：" + String(r.path || "")
					});
					const again = await props.__index({
						rows: sessionRows,
						wsPaths,
						archived
					});
					setIdx(again);
				} catch (e) {
					setWiz(Object.assign({}, wiz, { saving: false }));
					setNotice({
						kind: "err",
						text: "写配置失败：" + String(e && e.message || e)
					});
				}
			};
			const askmeConfig = async () => {
				const w = wiz;
				if (!w) return;
				setNotice(null);
				setWiz(Object.assign({}, w, { saving: true }));
				try {
					const r = await props.__askmeConfig({ roots: w.roots || [] });
					setWiz(Object.assign({}, wiz, { saving: false }));
					if (!r || !r.ok) {
						setNotice({
							kind: "err",
							text: "发起配置失败：" + String(r && r.error || "")
						});
						return;
					}
					setNotice({
						kind: "info",
						text: "已把 /sr-askme 发进会话 —— 去那边回答问题即可。",
						next: "答完配置会自己出现（面板每 5 秒重读一次）。"
					});
				} catch (e) {
					setWiz(Object.assign({}, wiz, { saving: false }));
					setNotice({
						kind: "err",
						text: "发起配置失败：" + String(e && e.message || e)
					});
				}
			};
			const [view, setView] = react.useState({ kind: "cards" });
			const [detail, setDetail] = react.useState(null);
			const [rev, setRev] = react.useState(0);
			const [sending, setSending] = react.useState(false);
			const [newOpen, setNewOpen] = react.useState(false);
			const [newTopic, setNewTopic] = react.useState("");
			const [newBusy, setNewBusy] = react.useState(false);
			const [plan, setPlan] = react.useState(null);
			const refresh = react.useCallback(() => setRev((n) => n + 1), []);
			const rowsKey = sessionRows.length + "|" + wsPaths.length + "|" + (archived === null ? "?" : archived.length);
			react.useEffect(() => {
				let alive = true;
				const ac = new AbortController();
				props.__index({
					rows: sessionRows,
					wsPaths,
					archived,
					signal: ac.signal
				}).then((r) => {
					if (!alive) return;
					setIdx(r);
					/**
					* ★ 这台机器还没配好 ⇒ **进配置向导**（用户口径：同事第一次用、自己重装之后没配置，是正常状态）。
					*   只是缺一两个字段时用读到的值预填，别让人重打一遍。
					*/
					if (r && r.ok === true && r.needConfig) {
						const o = r.cfgObj || {};
						setWiz((prev) => Object.assign({}, prev, {
							values: {
								sr_workspace: String(o.sr_workspace || "").trim(),
								sr_project: String(o.sr_project || "").trim(),
								config_root: String(o.config_root || "").trim(),
								gtgenerator_workdir: String(o.gtgenerator_workdir || "").trim()
							},
							configPathHint: String(r.configFile || "") || String(props.__configPath || "") || "",
							roots: wsPaths.slice(),
							triedPaths: (r.triedPaths || []).slice(),
							issues: [],
							saving: false
						}));
					} else setWiz(null);
				}, (e) => {
					if (alive) setIdx({
						ok: false,
						error: String(e && e.message || e)
					});
				});
				return () => {
					alive = false;
					ac.abort();
				};
			}, [rowsKey]);
			const sid = idx && idx.ok ? idx.sid : "";
			react.useEffect(() => {
				if (!idx || !idx.ok) return;
				let alive = true;
				const ac = new AbortController();
				setPhase("loading");
				props.__dashboard(idx, ac.signal).then((d) => {
					if (alive) {
						setDash(d);
						setPhase("idle");
					}
				}, (e) => {
					if (alive) {
						setPhase("idle");
						setNotice({
							kind: "err",
							text: "读工作区失败：" + String(e && e.message || e)
						});
					}
				});
				return () => {
					alive = false;
					ac.abort();
				};
			}, [sid, rev]);
			const topic = view.kind === "feature" ? view.topic : "";
			const rootOf = react.useCallback((t) => ((dash && dash.features ? dash.features : []).filter((x) => x.topic === t)[0] || {}).root || "", [dash]);
			react.useEffect(() => {
				if (!idx || !idx.ok || topic === "") {
					setDetail(null);
					return;
				}
				const root = rootOf(topic);
				if (!root) {
					setDetail(null);
					return;
				}
				let alive = true;
				const ac = new AbortController();
				setPhase("loading");
				props.__feature(idx, root, ac.signal).then((d) => {
					if (alive) {
						setDetail(d);
						setPhase("idle");
					}
				}, (e) => {
					if (alive) {
						setPhase("idle");
						setNotice({
							kind: "err",
							text: "读功能目录失败：" + String(e && e.message || e)
						});
					}
				});
				return () => {
					alive = false;
					ac.abort();
				};
			}, [
				sid,
				topic,
				rev,
				dash
			]);
			react.useEffect(() => {
				if (!idx || !idx.ok || topic === "") return;
				const root = rootOf(topic);
				if (!root) return;
				const t = setInterval(() => {
					props.__feature(idx, root, void 0).then((d) => setDetail((prev) => JSON.stringify(prev) === JSON.stringify(d) ? prev : d), () => {});
				}, 5e3);
				return () => clearInterval(t);
			}, [sid, topic]);
			const openAbs = (abs) => {
				props.__open(abs).then((r) => {
					if (r && r.ok !== true) setNotice({
						kind: "warn",
						text: r.error && (r.error.message || r.error) || "打不开这个文件。"
					});
				}, (e) => setNotice({
					kind: "warn",
					text: "打不开：" + String(e && e.message || e)
				}));
			};
			const onTopic = (t) => {
				setNewTopic(t);
				setPlan(null);
				if (!idx || !idx.ok || t.trim() === "") return;
				if (!checkTopicName(t).ok) return;
				const wsPathsNow = wsPaths;
				props.__createFacts(idx, idx.srWs).then((facts) => {
					const p = planNewFeature(t, {
						dirNames: facts.dirNames,
						wsPaths: wsPathsNow,
						srWs: idx.srWs
					});
					if (!p.ok && facts.note) p.message = facts.note + " " + p.message;
					setPlan(p);
				}, () => {});
			};
			const submitNew = () => {
				if (newBusy) return;
				const chk = checkTopicName(newTopic);
				if (!chk.ok) {
					setNotice({
						kind: "warn",
						text: chk.message,
						next: chk.next
					});
					return;
				}
				setNewBusy(true);
				setNotice({
					kind: "info",
					text: createPendingNotice(newTopic)
				});
				props.__createFeature(newTopic, {
					wsPaths,
					sid
				}).then((r) => {
					setNewBusy(false);
					if (!r.ok) {
						setNotice({
							kind: "warn",
							text: r.message || "没建成。",
							next: r.next || ""
						});
						if (r.plan) setPlan(r.plan);
						return;
					}
					setNewOpen(false);
					setNewTopic("");
					setPlan(null);
					setNotice({
						kind: "ok",
						text: r.doneText,
						next: (r.notes || []).join("　")
					});
					refresh();
					setView({
						kind: "feature",
						topic: r.topic
					});
				}, (e) => {
					setNewBusy(false);
					setNotice({
						kind: "err",
						text: "新建失败：" + String(e && e.message || e)
					});
				});
			};
			const sendBrainstorm = (instruction) => {
				if (!detail || sending) return;
				setSending(true);
				props.__sendBrainstorm(detail.root, instruction).then((r) => {
					setSending(false);
					if (!r.ok) setNotice({
						kind: "warn",
						text: r.error || "没发出去。",
						next: r.next || ""
					});
					else setNotice({
						kind: "ok",
						text: "已发给这个功能的工作会话" + (r.source === "created" ? "（新建的）" : "") + "。进度与提问都在那条会话里 —— 面板不重画流程。",
						next: (r.notes || []).join("　")
					});
				}, (e) => {
					setSending(false);
					setNotice({
						kind: "err",
						text: "发送失败：" + String(e && e.message || e)
					});
				});
			};
			const sessionId = react.useMemo(() => {
				if (!detail) return "";
				return props.__workSessionOf(detail.root);
			}, [detail, rev]);
			return h("div", { style: PAGE }, [
				!idx ? h("div", {
					key: "boot",
					style: { color: V.muted }
				}, "正在解析工作台锚点…") : null,
				idx && !idx.ok ? h(Notice, {
					key: "ie",
					notice: {
						kind: "err",
						text: idx.error || "拿不到读通道（索引会话）。",
						next: (idx.note || []).join("；")
					}
				}) : null,
				idx && idx.ok && (idx.note || []).length ? h("div", {
					key: "in",
					style: {
						fontSize: "11.5px",
						color: V.muted,
						marginBottom: GAP.sm
					}
				}, idx.note.join("　")) : null,
				idx && idx.ok && idx.needConfig ? h(ConfigWizard, {
					key: "wiz",
					values: (wiz || {}).values || {},
					issues: (wiz || {}).issues || [],
					triedPaths: (wiz || {}).triedPaths || [],
					configPathHint: (wiz || {}).configPathHint || "",
					saving: !!(wiz || {}).saving,
					picking: !!(wiz || {}).picking,
					notice,
					onField: (k, v) => setWiz((prev) => Object.assign({}, prev, {
						values: Object.assign({}, (prev || {}).values, { [k]: v }),
						issues: []
					})),
					onPick: async (k) => {
						setWiz((prev) => Object.assign({}, prev, { picking: true }));
						const p = await props.__pickDirectory();
						setWiz((prev) => Object.assign({}, prev, {
							picking: false,
							values: p ? Object.assign({}, (prev || {}).values, { [k]: p }) : (prev || {}).values
						}));
						if (!p) setNotice({
							kind: "warn",
							text: "没拿到目录（这台机器可能没有系统目录选择框）—— 直接手打路径即可。"
						});
					},
					onSave: saveConfig,
					onAskme: askmeConfig
				}) : null,
				idx && idx.ok && !idx.needConfig && view.kind === "cards" ? h(Dashboard, {
					key: "dash",
					dash,
					phase,
					notice,
					onRefresh: refresh,
					onOpen: (t) => {
						setNotice(null);
						setView({
							kind: "feature",
							topic: t
						});
					},
					onNew: () => {
						setPlan(null);
						setNewOpen(true);
					},
					newOpen,
					newTopic,
					plan,
					busy: newBusy,
					onTopic,
					onSubmit: submitNew,
					onCancel: () => {
						setNewOpen(false);
						setNewTopic("");
						setPlan(null);
						setNotice(null);
					}
				}) : null,
				idx && idx.ok && view.kind === "feature" ? detail ? h(FeatureView, {
					key: "fv",
					detail,
					phase,
					notice,
					onBack: () => {
						setNotice(null);
						setView({ kind: "cards" });
					},
					onRefresh: refresh,
					onOpen: openAbs,
					onOpenAbs: openAbs,
					onSendBrainstorm: sendBrainstorm,
					sending,
					sessionId,
					sessionNote: sessionId ? "工作会话已就绪（可在右上角打开）" : "还没建工作会话 —— 发送时会自动建一条（策划模式）",
					onOpenSession: (id) => props.__openSession(id)
				}) : h("div", {
					key: "fl",
					style: { color: V.muted }
				}, "正在读「" + topic + "」…") : null
			]);
		}
		/** 核心服务写进 inject；可选依赖（uiWorkspace / sessions / workspaces）用 `ctx.get` 取。 */
		const inject = [
			"slots",
			"remote",
			"remote.workspaceFiles",
			"remote.session",
			"remote.workspace",
			"remote.commands",
			"remote.permissionPresets"
		];
		/** 安全取一个可选服务（可能为 undefined，不抛） */
		function svc(ctx, name) {
			try {
				return ctx.get(name);
			} catch (e) {
				return;
			}
		}
		/** 把一次 Remote 调用的结果原样收成可显示对象（同步抛错也接住）。 */
		function safeCall(name, fn) {
			let p;
			try {
				p = Promise.resolve(fn());
			} catch (e) {
				return Promise.resolve({
					name,
					ok: false,
					error: { message: "同步抛错 " + String(e && e.message || e) }
				});
			}
			return p.then((r) => ({
				name,
				ok: !!(r && r.ok),
				value: r && r.value,
				error: r && r.error
			}), (e) => ({
				name,
				ok: false,
				error: { message: String(e && e.message || e) }
			}));
		}
		function humanError(r) {
			if (!r) return "（没有返回）";
			const e = r.error;
			if (!e) return String(r.message || r.name || "未知错误");
			return String(e.message || e.code || JSON.stringify(e));
		}
		/** 从可能的包装对象里取 id 文本。 */
		function idText(v) {
			if (typeof v === "string") return v;
			if (v && typeof v === "object") {
				const inner = v.value || v.sessionId || v.workspaceId || v.id;
				if (typeof inner === "string") return inner;
			}
			return "";
		}
		/**
		* 兜底工作区根 —— 只在"前三条候选全落空"时才用（浏览器半侧收不到插件 config，
		* 绝对路径只能自己推）。候选顺序是：
		*   profile 的 `projectRoot` → 客户端登记过的**工作区列表** → 各会话的 `cwd` → 这个常量。
		* ★ 分发到别的机器：前三条通常已经命中（工作区登记过就行），这个常量留作最后兜底；
		*   如果对方的工作区不在 `D:\TimeMachine` 且一条工作区都没登记，改成对方的工作区根即可。
		*/
		const DEFAULT_ROOT = "D:\\TimeMachine";
		/**
		* 「策划模式」预设的 **id** —— 显示名是「策划模式」，id 仍是 `sr-workbench`
		* （会话日志按 id 恢复，改 id = 旧会话打不开）。见 `cordis.patch.yml` 的 `preset-sr-workbench` 行。
		*/
		const PLAN_PRESET = "sr-workbench";
		function apply(ctx, config) {
			const cfg = config || {};
			const read = (sid, path, range, signal) => ctx.remote.workspaceFiles.read(sid, path, range, signal);
			/** 锚点缓存（"新建"与"读"两条路都要用工作区根）。 */
			let srWsCache = "";
			/**
			* 端口：加载层唯一的测试接缝。只读三法需要**一条真会话**（sid）；
			* 指令侧四法在签名里显式带 sessionId（它们的目标常常不是读通道那条会话）。
			*/
			function portOf(sid) {
				return {
					readText: async (path, range, signal) => {
						const r = await read(sid, path, range, signal);
						if (!r || r.ok !== true) throw new Error("读不到 " + path + "：" + humanError(r));
						return r.value;
					},
					listDir: async (path, signal) => {
						const r = await ctx.remote.workspaceFiles.list(sid, path, signal);
						if (!r || r.ok !== true) throw new Error("列举不了 " + path + "：" + humanError(r));
						return r.value;
					},
					stat: async (path, signal) => {
						const r = await ctx.remote.workspaceFiles.stat(sid, path, signal);
						if (!r || r.ok !== true) throw new Error("读不到 " + path + " 的信息：" + humanError(r));
						return r.value;
					},
					prompt: (sid2, text) => safeCall("session.prompt", () => ctx.remote.session.prompt({
						requestId: "wb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
						sessionId: sid2,
						mode: "queue",
						content: [{
							type: "text",
							text
						}]
					})),
					execCommand: (sid2, line) => safeCall("commands.execute", () => ctx.remote.commands.execute(sid2, line, [])),
					renameSession: (sid2, title) => safeCall("session.rename", () => ctx.remote.session.rename({
						sessionId: sid2,
						title
					})),
					ensureWorkspace: (path) => safeCall("workspace.create", () => ctx.remote.workspace.create({ path })),
					createSession: (req) => safeCall("session.create", () => ctx.remote.session.create(req))
				};
			}
			const listSessions = (signal) => safeCall("session.list", () => ctx.remote.session.list({}, signal));
			const INFLIGHT = /* @__PURE__ */ new Map();
			const singleFlight = (key, fn) => {
				const prev = INFLIGHT.get(key);
				if (prev) return prev;
				const p = Promise.resolve().then(fn).then((v) => {
					INFLIGHT.delete(key);
					return v;
				}, (e) => {
					INFLIGHT.delete(key);
					throw e;
				});
				INFLIGHT.set(key, p);
				return p;
			};
			const cacheRaw = () => {
				try {
					if (typeof localStorage === "undefined" || !localStorage) return null;
					return localStorage.getItem(indexCacheKey());
				} catch (e) {
					return null;
				}
			};
			const cacheWrite = (srWs, sid, title) => {
				try {
					if (typeof localStorage === "undefined" || !localStorage) return;
					localStorage.setItem(indexCacheKey(), indexCacheSerialize(srWs, sid, title || ""));
				} catch (e) {}
			};
			const workCacheRaw = () => {
				try {
					if (typeof localStorage === "undefined" || !localStorage) return null;
					return localStorage.getItem(workCacheKey());
				} catch (e) {
					return null;
				}
			};
			const workCacheSet = (root, sid) => {
				try {
					if (typeof localStorage === "undefined" || !localStorage) return;
					const raw = workCacheRaw();
					localStorage.setItem(workCacheKey(), sid === null || sid === void 0 ? workCacheDrop(raw, root) : workCachePut(raw, root, sid));
				} catch (e) {}
			};
			/** 本机权限预设目录（一页只读一次；读不到就 `null`，按最坏情况处理）。 */
			let permCatalog = null;
			let permCatalogDone = false;
			const permissionCatalog = () => {
				if (permCatalogDone) return Promise.resolve(permCatalog);
				return safeCall("permissionPresets.catalog", () => ctx.remote.permissionPresets.catalog()).then((r) => {
					permCatalogDone = true;
					permCatalog = r && r.ok ? r.value : null;
					return permCatalog;
				});
			};
			/** 建完就把新工作区 / 新会话并进**客户端 store**（否则侧边栏要按 F5 才看得见）。 */
			const syncSidebarStores = async (path) => {
				const workspacesSvc = svc(ctx, "workspaces");
				const sessionsSvc = svc(ctx, "sessions");
				const plan = planSidebarSync({
					path: path || "",
					services: {
						workspaces: !!(workspacesSvc && typeof workspacesSvc.create === "function"),
						sessions: !!(sessionsSvc && typeof sessionsSvc.refresh === "function")
					}
				});
				const notes = plan.notes.slice();
				if (!sidebarSyncNeeded(plan)) return {
					plan,
					notes
				};
				const tryCall = async (name, fn) => {
					try {
						return {
							name,
							ok: true,
							value: await fn()
						};
					} catch (e) {
						return {
							name,
							ok: false,
							error: { message: String(e && e.message || e) }
						};
					}
				};
				for (const step of plan.steps) if (step === "workspaces.create") {
					const r = await tryCall("workspaces.create", () => workspacesSvc.create({ path: plan.resolvePath }));
					if (!r.ok) notes.push("工作区分组没能即时并进侧边栏（" + humanError(r) + "）。");
				} else {
					const r = await tryCall("sessions.refresh", () => sessionsSvc.refresh());
					if (!r.ok) notes.push("会话行没能即时并进侧边栏（" + humanError(r) + "）。");
				}
				return {
					plan,
					notes
				};
			};
			/**
			* 按 `root` 建一条带可识别标题的会话（**唯一的建会话出口**）。
			* 坑只留一处：`session.create` 的 `workspaceId` 与 `cwd` **互斥** ——
			* 拿不到 workspaceId 时才退回给 cwd（会话落进「未分组」，但可用）。
			*/
			const createSessionAt = async (root, title, preset, opts) => {
				const o = opts || {};
				const note = [];
				const port = portOf("");
				const ws = await port.ensureWorkspace(root);
				const wsId = ws.ok ? idText(ws.value && ws.value.workspace ? ws.value.workspace.workspaceId : ws.value && ws.value.workspaceId) : "";
				if (!ws.ok) note.push("按路径登记工作区失败（改用 cwd 建会话）：" + humanError(ws));
				/**
				* 建会话时带「策划模式」预设（`agentPreset`）。
				*
				* ★ 它随 **bundle 的 patch** 分发 ⇒ 只有包在 profile 的 `dsh.profile.bundles` 里才存在。
				*   万一没挂上（有人只手写插件行、没把包加进 bundles），host 会拒绝这个预设 ——
				*   那时**退一步建一条不带预设的会话**并如实说清"这条会话没有决策记录契约"，
				*   总好过让「新建功能」停在半个目录上（决策靠 skill 侧的写入规范仍然管得住）。
				*/
				const withPreset = preset || PLAN_PRESET;
				const reqOf = (p) => wsId ? p ? {
					workspaceId: wsId,
					agentPreset: p
				} : { workspaceId: wsId } : p ? {
					cwd: root,
					agentPreset: p
				} : { cwd: root };
				let cr = await port.createSession(reqOf(withPreset));
				if (!cr.ok && withPreset) {
					const retry = await port.createSession(reqOf(""));
					if (retry.ok) {
						note.push("「策划模式」预设没挂上（`agentPreset: " + withPreset + "` 被拒：" + humanError(cr) + "）—— 这条会话用的是 **profile 的默认预设**，**决策记录契约不在它的上下文里**（其余照常）。原因多半是包没进 profile 的 `dsh.profile.bundles`（预设只能随 bundle 的 patch 分发）：补上后重建这条会话即可。");
						cr = retry;
					}
				}
				if (!cr.ok) return {
					sid: "",
					error: humanError(cr),
					note,
					wsId
				};
				const sid = idText(cr.value && (cr.value.sessionId || cr.value));
				if (!sid) return {
					sid: "",
					error: "会话已创建，但拿不到 sessionId。",
					note,
					wsId
				};
				if (title) {
					const rn = await port.renameSession(sid, title);
					if (!rn.ok) note.push("会话建好了但改名失败（下次按缓存认回来）：" + humanError(rn));
				}
				if (o.fullAccess) {
					const plan = permissionPlanOf(await permissionCatalog());
					if (plan.needed) {
						const ex = await port.execCommand(sid, permissionCommandLine(plan.preset));
						const back = await listSessions(o.signal);
						const row = back.ok ? rowsFromList(back.value).filter((r) => r.id === sid)[0] : null;
						note.push(permissionResultNote(!!(ex && ex.ok), ex && ex.ok ? ex.value && (ex.value.text || ex.value.kind) || "" : humanError(ex), row ? row.preset : ""));
					} else if (plan.note) note.push(plan.note);
				}
				const sync = await syncSidebarStores(root);
				for (const n of sync.notes) note.push(n);
				return {
					sid,
					error: "",
					note,
					title: title || "",
					wsId
				};
			};
			/**
			* ═══ 解析「读通道」：索引会话 ═══
			*   1. 先借一条**任何可用**的会话，只为读 sr 配置（`read` 不受工作区限制）；
			*   2. 按候选根读 `config.local.json` → 绝对锚点 `sr_workspace`；
			*   3. **正式认领**：只认**面板自己的**（标题前缀 / 自己写的缓存），且必须能列出 root；
			*   4. 认不着就新建。
			*/
			/**
			* 配置向导的落地动作之一：**把值交给会话去写，然后回读核对**（面板不写盘）。
			* @returns `{ ok, path?, error? }` —— 成功时给出配置的绝对路径。
			*/
			const saveConfigTo = async (o) => {
				const values = o && o.values || {};
				const roots = (o && o.roots || []).slice();
				const hint = String(o && o.configPathHint || "");
				const signal = o && o.signal;
				const borrow = pickIndexSession(await sessionRowsNow(signal), "", { borrow: true });
				let sid = borrow ? borrow.id : "";
				if (!sid) {
					const cr = await ctx.remote.session.create({ cwd: String(values.sr_workspace || "").trim() });
					if (!cr || cr.ok !== true) return {
						ok: false,
						error: "没有可用会话，且新建会话失败：" + humanError(cr)
					};
					sid = idText(cr.value && (cr.value.sessionId || cr.value));
				}
				const inst = buildConfigInstruction({
					values,
					configPathHint: hint,
					pointerPaths: pointerCandidates(roots, values.sr_workspace),
					stamp: todayCompact()
				});
				const pr = await ctx.remote.session.prompt({
					requestId: "wb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
					sessionId: sid,
					mode: "queue",
					content: [{
						type: "text",
						text: inst
					}]
				});
				if (!pr || pr.ok !== true) return {
					ok: false,
					error: "把指令发给会话失败：" + humanError(pr)
				};
				const want = String(values.sr_workspace || "").trim().replace(/[\\/]+$/, "").toLowerCase();
				for (let i = 0; i < 30; i++) {
					await new Promise((r) => setTimeout(r, 2e3));
					const cands2 = [];
					for (const p of pointerCandidates(roots, values.sr_workspace)) try {
						const r = await read(sid, p, {
							offset: 1,
							limit: 5
						}, signal);
						if (r && r.ok === true && r.value && typeof r.value.text === "string" && r.value.text.trim() !== "") cands2.push(r.value.text.trim().split(/\r?\n/)[0].trim());
					} catch (e) {}
					if (hint) cands2.push(hint);
					for (const p of cands2) try {
						const r = await read(sid, p, {
							offset: 1,
							limit: 200
						}, signal);
						if (!r || r.ok !== true || !r.value || typeof r.value.text !== "string") continue;
						const obj = JSON.parse(r.value.text);
						if (obj && String(obj.sr_workspace || "").replace(/[\\/]+$/, "").toLowerCase() === want) return {
							ok: true,
							path: p,
							cfg: obj,
							sid
						};
					} catch (e) {}
				}
				return {
					ok: false,
					error: "回读没核对上（等了 60 秒）—— 去会话里看它跑到哪了",
					sid
				};
			};
			/** 落地动作之二：把 `/sr-askme` 发进会话（边问边写），并让它写指针文件。 */
			const runAskme = async (o) => {
				const roots = (o && o.roots || []).slice();
				const signal = o && o.signal;
				const borrow = pickIndexSession(await sessionRowsNow(signal), "", { borrow: true });
				let sid = borrow ? borrow.id : "";
				if (!sid) {
					const cr = await ctx.remote.session.create({});
					if (!cr || cr.ok !== true) return {
						ok: false,
						error: "没有可用会话，且新建会话失败：" + humanError(cr)
					};
					sid = idText(cr.value && (cr.value.sessionId || cr.value));
				}
				const lines = [
					"/sr-askme 引导我配置这台机器的 sr 路径。",
					"",
					"规矩（面板要靠它认路）：",
					"· 配置写到 $env:USERPROFILE\\.dsh\\sr-workbench\\config.local.json（本机私有，别放进技能目录）；",
					"· 写完后把配置的绝对路径（一行）写进下面这些指针文件（目录不存在先建）："
				];
				for (const p of pointerCandidates(roots, o && o.srWorkspace || "")) lines.push("  " + p);
				lines.push("· 跑完只回报一行 OK <配置绝对路径> 或 FAILED <原因>。");
				const pr = await ctx.remote.session.prompt({
					requestId: "wb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
					sessionId: sid,
					mode: "queue",
					content: [{
						type: "text",
						text: lines.join("\n")
					}]
				});
				if (!pr || pr.ok !== true) return {
					ok: false,
					error: "把指令发给会话失败：" + humanError(pr)
				};
				return {
					ok: true,
					sid
				};
			};
			/** 现取一次会话行（向导动作要用；不等 store 的那份快照）。 */
			const sessionRowsNow = async (signal) => {
				const L = await listSessions(signal);
				return L.ok ? rowsFromList(L.value) : [];
			};
			const resolveIndexSession = async (o) => {
				const note = [];
				const signal = o.signal;
				let rows = (o.rows || []).filter((r) => r && r.id);
				if (rows.length === 0) {
					const L = await listSessions(signal);
					if (L.ok) rows = rowsFromList(L.value);
					else note.push("会话列表读取失败：" + humanError(L));
				}
				const arch = { ids: o.archived === void 0 ? null : o.archived };
				if (arch.ids === null) note.push(NO_ARCHIVE_INFO_NOTE);
				const cached = indexCacheParse(cacheRaw());
				const cachedMine = indexCacheOwned(cached);
				if (cached && !cachedMine) note.push(FOREIGN_CACHE_NOTE);
				const cachedSid = cached && cached.sid ? String(cached.sid) : "";
				const cachedArchived = isArchivedId(arch.ids, cachedSid);
				if (cachedMine && cachedArchived) note.push(ARCHIVED_CACHED_NOTE);
				const ownCachedSid = cachedMine && !cachedArchived ? cachedSid : "";
				const roots = [];
				if (cfg.projectRoot) roots.push(cfg.projectRoot);
				for (const p of o.wsPaths || []) roots.push(p);
				for (const r of rows) if (r.cwd) roots.push(r.cwd);
				roots.push(DEFAULT_ROOT);
				const boot = pickIndexSession(rows, "", {
					cachedId: cachedArchived ? "" : cachedSid,
					borrow: true
				});
				if (!boot) return {
					ok: false,
					error: "一条会话都没有 —— 先在左侧建一条会话（任意工作区），面板要用它读文件。",
					note
				};
				const cands = [];
				if (cfg.configPath) cands.push(cfg.configPath);
				for (const p of configPathCandidates(roots)) cands.push(p);
				let cfgPath = "";
				let cfgObj = null;
				/**
				* ★ **指针文件**（用户口径 A 方案）：配置的正经落点是用户目录，但**浏览器拿不到家目录**，
				*   所以会话写完配置后会把"配置在哪"写进 `<工作区根>\.dsh\sr-workbench.path`（一行文本）。
				*   这里先读指针、再去读它指的那份配置 —— 新机器上第一次配完，面板就能自己认路。
				*/
				for (const p of pointerCandidates(roots)) try {
					const r = await read(boot.id, p, {
						offset: 1,
						limit: 5
					}, signal);
					if (!r || r.ok !== true || !r.value || typeof r.value.text !== "string") continue;
					const pointed = r.value.text.trim().split(/\r?\n/)[0].trim();
					if (pointed !== "" && cands.indexOf(pointed) < 0) cands.unshift(pointed);
				} catch (e) {}
				for (const p of cands) try {
					const r = await read(boot.id, p, {
						offset: 1,
						limit: 200
					}, signal);
					if (!r || r.ok !== true || !r.value || typeof r.value.text !== "string") continue;
					const parsed = JSON.parse(r.value.text);
					if (parsed && parsed.sr_workspace) {
						cfgObj = parsed;
						cfgPath = p;
						break;
					}
				} catch (e) {}
				const srWs = cfgObj ? String(cfgObj.sr_workspace).replace(/[\\/]+$/, "") : "";
				const root = srWs || cfg.projectRoot || DEFAULT_ROOT;
				/**
				* ★ 读不到配置（或必填字段不齐）⇒ 返回 `needConfig` 让面板进**配置向导**，
				*   而不是只说一句"先跑 /sr-askme"。同时把**试过哪些候选**如实带出去 ——
				*   向导里要显示它（用户据此判断是不是路径不对）。
				*/
				/**
				* ★ **只有工作区锚点缺失**才进配置向导（面板干活全靠它）。
				*   配置在、只是别的必填字段（`sr_project` 之类）缺 —— 那是**技能侧**的要求，
				*   面板照常干活，只提示一句（2026-10-09 实测：把它当硬条件会把新建功能一起挡掉）。
				*/
				if (!cfgObj || workspaceMissing(cfgObj)) {
					note.push(cfgObj ? "本机配置在 `" + cfgPath + "`，但**工作区锚点 `sr_workspace` 是空的** —— 在配置向导里补上。" : "没读到 sr 配置（试过 " + cands.length + " 个候选路径）。");
					return {
						ok: true,
						sid: boot.id,
						root,
						srWs,
						configFile: cfgPath,
						source: "need-config",
						needConfig: true,
						cfgObj,
						triedPaths: cands.slice(),
						note
					};
				}
				const softMissing = CONFIG_FIELDS.filter((f) => f.required && !String((cfgObj || {})[f.key] || "").trim()).map((f) => f.key);
				if (softMissing.length > 0) note.push("本机配置缺 " + softMissing.join("、") + "（技能会问；补了更省事）—— 配置在 `" + cfgPath + "`。");
				srWsCache = srWs;
				const pickOwn = () => pickIndexSession(rows, root, {
					cachedId: ownCachedSid,
					archived: arch.ids
				});
				let hit = pickOwn();
				if (!hit) {
					const L = await listSessions(signal);
					if (L.ok) {
						rows = mergeRows(rows, rowsFromList(L.value));
						hit = pickOwn();
					}
				}
				if (hit) {
					/**
					* ★ 这里**不再**提示"侧边栏里有 N 条索引会话"（用户口径：不额外占位置）。
					*   那是**整理建议**，不是故障：面板照旧用最近更新的那条、照旧写缓存，功能一点不受影响。
					*   真需要清理时，去侧边栏把多余的那条归档即可（一次性动作）。
					*   保留 `hit.others` 这个事实（`pickIndexSession` 还会算它），只是不再往界面上顶一行。
					*/
					cacheWrite(root, hit.id, titleOf(hit.row));
					return {
						ok: true,
						sid: hit.id,
						root,
						srWs,
						configFile: cfgPath,
						source: hit.source,
						note
					};
				}
				const title = indexTitleFor(root);
				const made = await singleFlight("index:" + normPath(root), () => createSessionAt(root, title, PLAN_PRESET, {
					fullAccess: false,
					signal
				}));
				for (const n of made.note) note.push(n);
				if (made.error) return {
					ok: false,
					error: "无法创建索引会话：" + made.error,
					note
				};
				cacheWrite(root, made.sid, title);
				return {
					ok: true,
					sid: made.sid,
					root,
					srWs,
					configFile: cfgPath,
					source: "created",
					note
				};
			};
			/**
			* 建那 5 个目录（`features\` + 功能目录 + 4 个桶）。**三条路按能力退** —— 理由见 `createFeature` 的注释。
			* @returns `{ ok, done: string[], message, next }` —— 失败时 message/next 直接给用户看。
			*/
			const scaffoldDirs = async (port, base, topic, buckets, indexSid, signal, notes, wait) => {
				const root = featureRootFor(base, topic);
				const done = [];
				const uw = svc(ctx, "uiWorkspace");
				/** ① 宿主目录原语（**只有 browse 后端才有**） */
				if (uw && typeof uw.createDirectory === "function") {
					const mk = async (parent, name) => {
						try {
							await uw.createDirectory(parent, name);
							return {
								ok: true,
								code: "",
								message: ""
							};
						} catch (e) {
							return {
								ok: false,
								code: String(e && (e.code || e.details && e.details.code) || ""),
								message: String(e && e.message || e)
							};
						}
					};
					let bad = null;
					const mkFeatures = await mk(base, "features");
					if (!mkFeatures.ok && mkFeatures.code !== "directory-exists") bad = {
						what: "features\\",
						r: mkFeatures
					};
					if (!bad) {
						done.push("features\\");
						const mkRoot = await mk(base + "\\features", topic);
						if (!mkRoot.ok && mkRoot.code !== "directory-exists") bad = {
							what: topic + "\\",
							r: mkRoot
						};
						else {
							done.push(topic + "\\");
							for (const b of buckets) {
								const rb = await mk(root, b);
								if (!rb.ok && rb.code !== "directory-exists") {
									bad = {
										what: b + "\\",
										r: rb
									};
									break;
								}
								done.push(b + "\\");
							}
						}
					}
					if (!bad) {
						notes.push("目录是**本机直接建**的（宿主目录原语 `createDirectory` 可用）。");
						return {
							ok: true,
							done,
							message: "",
							next: ""
						};
					}
					if (!/directory-picker\/unavailable|needs the browse capability|serves\s*"native"/i.test(bad.r.message + " " + bad.r.code)) return {
						ok: false,
						done,
						root,
						message: createPartialNotice(topic, root, done, bad.what, bad.r.message + "（" + bad.r.code + "）"),
						next: "面板只建不删 —— 缺的请手工补建（命令见下），或删掉整个目录重新新建。\n" + manualScaffoldCommand(base, topic)
					};
					notes.push("本机目录选择器只有 **native**（`createDirectory` 只存在于 browse 后端）⇒ 改让**索引会话**跑一条 PowerShell 建目录。");
				} else notes.push("拿不到 `uiWorkspace.createDirectory` ⇒ 改让**索引会话**跑一条 PowerShell 建目录。");
				/** ② 让索引会话建（Go 通用路径），面板**回读核对** */
				if (!indexSid) return {
					ok: false,
					done,
					root,
					message: "没有可用的会话来建目录（面板要借一条 cwd 覆盖 SR 工作区的会话跑这条命令）。",
					next: "先在左侧随便建一条会话，或手工建目录：\n" + manualScaffoldCommand(base, topic)
				};
				const pr = await port.prompt(indexSid, buildScaffoldInstruction(base, topic));
				if (!pr.ok) return {
					ok: false,
					done,
					root,
					message: "把建目录的指令发给索引会话失败：" + humanError(pr),
					next: "手工建目录（复制即用；建完再点一次〔建立〕，面板会认出它接着往下走）：\n" + manualScaffoldCommand(base, topic)
				};
				const verified = await waitForScaffold(port, root, buckets, wait);
				if (!verified.ok) return {
					ok: false,
					done,
					root,
					message: "已让索引会话去建目录，但**回读没核对上**：" + verified.why + "（目录现在" + (verified.exists ? "在，但缺：" + verified.missing.join("、") : "还不存在") + "）",
					next: "① 打开那条索引会话看它跑到哪了；② 或直接手工建（复制即用），建完再点一次〔建立〕：\n" + manualScaffoldCommand(base, topic)
				};
				notes.push("目录由**索引会话**跑 PowerShell 建的（面板不写盘），已回读核对到 " + verified.entries.length + " 个条目。");
				return {
					ok: true,
					done: ["features\\", topic + "\\"].concat(verified.entries.map((n) => n + "\\")),
					message: "",
					next: ""
				};
			};
			/**
			* 轮询等"那几个桶真的出现了"（给会话里的 agent 一点时间）。
			* ★ **回读是唯一判据** —— 会话说"建好了"不算，`listDir` 看得到才算。
			* ★ 预算：真机上会话要跑一次 LLM 往返，给一分钟；用例里用 `scaffoldWait` 压到毫秒级。
			*/
			const SCAFFOLD_WAIT = {
				tries: 40,
				delayMs: 1500
			};
			const waitForScaffold = async (port, root, buckets, wait) => {
				const w = Object.assign({}, SCAFFOLD_WAIT, wait || {});
				const need = buckets.map((b) => String(b).toLowerCase());
				let last = {
					exists: false,
					missing: need
				};
				for (let i = 0; i < w.tries; i++) {
					const st = await inspectFeatureDir(port, root);
					const have = new Set(st.entries.map((e) => String(e.name).toLowerCase()));
					const missing = need.filter((b) => !have.has(b));
					last = {
						exists: st.exists,
						missing
					};
					if (st.exists && missing.length === 0) return {
						ok: true,
						entries: st.entries.map((e) => e.name),
						exists: true,
						missing: [],
						why: ""
					};
					await new Promise((r) => setTimeout(r, w.delayMs));
				}
				return {
					ok: false,
					entries: [],
					exists: last.exists,
					missing: last.missing,
					why: "等了 " + Math.round(w.tries * w.delayMs / 1e3) + " 秒还没建齐"
				};
			};
			/**
			* ═══ 新建功能（v5 的机制核心）═══
			* 建目录 → 4 个桶 → 专属工作区 → 工作会话（策划模式）。
			*
			* ★ 建目录有**三条路**，按能力退（2026-10-09 实测缺陷换来的）：
			*   ① `uiWorkspace.createDirectory` —— 只在目录选择器的 **browse** 后端存在；
			*   ② 让**索引会话**跑一条 PowerShell（`New-Item -Force` 幂等）+ 面板回读核对 —— 通用；
			*   ③ 都不行 ⇒ 把逐字命令给用户，他建完再点一次〔建立〕（面板认出"空脚手架"就接着往下走）。
			*   为什么 Windows 上①必然没有：`directory-picker-auto` 的规则里 `win32 → native`，
			*   而 `createDirectory` 在宿主侧被 `requireCapability("browse", …)` 挡着。
			*   判据与理由写在 `pure/createfeature.ts` 的"建目录：三条路"那一节。
			*/
			const createFeature = async (topic, o) => {
				const opts = o || {};
				const port = portOf(opts.sid || "");
				const facts = await loadCreateFacts(port, { srWs: srWsCache });
				const base = String(srWsCache).replace(/[\\/]+$/, "");
				/**
				* 「目录已经在」的两种情形要分开：
				*   · **空脚手架**（只有几个桶、一个文件都没有，含"建到一半"）⇒ 接着往下建工作区与会话；
				*   · **有内容** ⇒ 是真功能，照旧拒绝重名（`planNewFeature` 的 `dir-exists`）。
				*/
				const state = await inspectFeatureDir(port, featureRootFor(base, String(topic == null ? "" : topic)), opts.signal);
				const resumeOnScaffold = state.exists && state.bare;
				const plan = planNewFeature(topic, {
					dirNames: resumeOnScaffold ? [] : facts.dirNames,
					wsPaths: opts.wsPaths || [],
					srWs: base
				});
				if (facts.note) plan.message = facts.note + " " + plan.message;
				if (!plan.ok) return {
					ok: false,
					message: plan.message,
					next: plan.next,
					plan
				};
				const notes = [];
				const done = [];
				if (resumeOnScaffold) {
					notes.push("这个功能目录已经在（里面**只有桶、没有任何文件**）—— 按现成的接着建工作区与会话，不重复建目录。");
					for (const e of state.entries) done.push(e.name + "\\");
				} else {
					const scaffold = await scaffoldDirs(port, base, plan.topic, plan.buckets, opts.sid, opts.signal, notes, opts.scaffoldWait);
					if (!scaffold.ok) return {
						ok: false,
						plan,
						root: plan.root,
						topic: plan.topic,
						notes,
						message: scaffold.message,
						next: scaffold.next
					};
					for (const d of scaffold.done) done.push(d);
				}
				const made = await createSessionAt(plan.root, sessionTitleFor(plan.topic), PLAN_PRESET, {
					fullAccess: true,
					signal: opts.signal
				});
				for (const n of made.note) notes.push(n);
				if (made.error) return {
					ok: false,
					plan,
					root: plan.root,
					topic: plan.topic,
					notes,
					message: "目录建好了（" + done.join("、") + "），但工作区 / 工作会话没建起来：" + made.error,
					next: "目录已经能用（刷新看板就能看到卡片）；工作会话会在你点「交给工作会话」时自动重试。"
				};
				if (made.sid) {
					workCacheSet(plan.root, made.sid);
					WORK_SESSION.set(normPath(plan.root), made.sid);
				}
				return {
					ok: true,
					topic: plan.topic,
					root: plan.root,
					sid: made.sid,
					notes,
					doneText: createDoneNotice(plan.topic, plan.root, made.sid)
				};
			};
			const WORK_SESSION = /* @__PURE__ */ new Map();
			const ensureWorkSession = async (root, o) => {
				const opts = o || {};
				const key = normPath(root);
				if (key === "") return {
					ok: false,
					error: "算不出这个功能的工作目录。"
				};
				return singleFlight("work:" + key, async () => {
					const note = [];
					const memory = WORK_SESSION.get(key) || "";
					if (memory) return {
						ok: true,
						sid: memory,
						source: "memory",
						note,
						title: workTitleFor(root)
					};
					const cached = workCacheGet(workCacheRaw(), root);
					const L = await listSessions(opts.signal);
					const rows = L.ok ? rowsFromList(L.value) : [];
					if (!L.ok) note.push("会话列表读取失败：" + humanError(L));
					const hit = pickWorkSession(rows, root, {
						cachedId: cached,
						archived: opts.archived
					});
					if (hit) {
						WORK_SESSION.set(key, hit.id);
						workCacheSet(root, hit.id);
						if (needsFullAccess(hit.row.preset)) {
							const plan = permissionPlanOf(await permissionCatalog());
							if (plan.needed) {
								const ex = await portOf("").execCommand(hit.id, permissionCommandLine(plan.preset));
								if (!ex.ok) note.push("这条工作会话的权限没能切成完全权限：" + humanError(ex) + "（功能目录之外的产出可能被拦）。");
							}
						}
						return {
							ok: true,
							sid: hit.id,
							source: hit.source,
							note,
							title: workTitleFor(root)
						};
					}
					const title = workTitleFor(root);
					const made = await createSessionAt(root, title, PLAN_PRESET, {
						fullAccess: true,
						signal: opts.signal
					});
					for (const n of made.note) note.push(n);
					if (made.error) return {
						ok: false,
						error: made.error,
						note
					};
					WORK_SESSION.set(key, made.sid);
					workCacheSet(root, made.sid);
					return {
						ok: true,
						sid: made.sid,
						source: "created",
						note,
						title
					};
				});
			};
			/** 头脑风暴四入口**唯一**的出口：认领工作会话 → 把指令发进去。 */
			const sendToWorkSession = async (root, text, signal) => {
				const got = await ensureWorkSession(root, { signal });
				if (!got.ok) return {
					ok: false,
					error: got.error || "拿不到工作会话。",
					next: "看左侧有没有一条标题以「策划工作台·工作」开头的会话；没有就再点一次。"
				};
				const r = await portOf("").prompt(got.sid, text);
				if (!r.ok) return {
					ok: false,
					error: humanError(r),
					next: "打开那条工作会话看看它是不是在跑；在跑的话指令会排队，不会丢。"
				};
				return {
					ok: true,
					sid: got.sid,
					source: got.source,
					notes: got.note || []
				};
			};
			/** 打开一个文件（默认应用 → 文件管理器 reveal）。 */
			const openAbs = async (abs) => {
				const ns = ctx.remote && ctx.remote.session;
				if (!ns || typeof ns.openWorkspacePath !== "function") return {
					ok: false,
					error: { message: "remote.session.openWorkspacePath 不可用 —— 请手工打开：" + abs }
				};
				const r = await safeCall("openWorkspacePath", () => ns.openWorkspacePath({ path: abs }, new AbortController().signal));
				if (r.ok) return { ok: true };
				const r2 = await safeCall("openWorkspacePath.reveal", () => ns.openWorkspacePath({
					path: abs,
					action: "reveal"
				}, new AbortController().signal));
				if (r2.ok) return { ok: true };
				return {
					ok: false,
					error: { message: humanError(r) + "　｜　换 reveal 也失败：" + humanError(r2) }
				};
			};
			/** 跳到某条会话（DSH 自己的 uiWorkspace 服务；会把中栏切回对话）。 */
			const openSession = (sid) => {
				try {
					const uw = svc(ctx, "uiWorkspace");
					if (!uw || typeof uw.openSession !== "function") return {
						ok: false,
						error: { message: "uiWorkspace 服务不可用" }
					};
					uw.openSession(sid);
					return { ok: true };
				} catch (e) {
					return {
						ok: false,
						error: { message: String(e && e.message || e) }
					};
				}
			};
			const dashboardLoader = async (idx, signal) => {
				const d = await loadDashboard(portOf(idx.sid), {
					configPath: idx.configFile || "",
					signal
				});
				if (d.srWs) srWsCache = d.srWs;
				return d;
			};
			const featureLoader = (idx, root, signal) => loadFeatureDetail(portOf(idx.sid), {
				root,
				signal
			});
			const createFactsRunner = (idx, srWs) => loadCreateFacts(portOf(idx.sid), { srWs: srWs || idx.srWs });
			function PanelBound(props) {
				return h(PanelErrorBoundary, null, h(Panel, Object.assign({}, props, {
					__index: resolveIndexSession,
					__saveConfig: saveConfigTo,
					__askmeConfig: runAskme,
					/** 面板配好的配置路径（浏览器拿不到家目录，认路全靠它 + 工作区根下的指针文件）。 */
					__configPath: String(cfg && cfg.configPath || ""),
					/** 系统目录选择框（native 后端才有；拿不到就返回空串，界面提示手打）。 */
					__pickDirectory: async () => {
						const uw = svc(ctx, "uiWorkspace");
						if (!uw || typeof uw.pickDirectory !== "function") return "";
						try {
							const picked = await uw.pickDirectory();
							return typeof picked === "string" ? picked : picked && (picked.path || picked.directory) || "";
						} catch (e) {
							return "";
						}
					},
					__dashboard: dashboardLoader,
					__feature: featureLoader,
					__createFacts: createFactsRunner,
					__createFeature: createFeature,
					__sendBrainstorm: (root, text) => sendToWorkSession(root, text),
					__workSessionOf: (root) => WORK_SESSION.get(normPath(root)) || workCacheGet(workCacheRaw(), root) || "",
					__open: openAbs,
					__openSession: openSession
				})));
			}
			ctx.slots.inject("main", function* () {
				yield ctx.slots.register({
					name: "main",
					key: "sr-workbench"
				}, PanelBound);
			});
			ctx.slots.inject("sidebar.panellist", function* () {
				yield ctx.slots.register({
					name: "sidebar.panellist",
					id: "sr-workbench",
					order: 100,
					label: "策划工作台"
				}, function Glyph() {
					return h("span", { style: { fontSize: FONT.card } }, "▤");
				});
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
