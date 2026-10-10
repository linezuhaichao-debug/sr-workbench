/**
 * ★ 本文件由 `npm run gen:teaching` **生成**，不要手改。
 *   来源：包内 `skills/sr-askme/`（`SKILL.md` 的教学节 + `references/teaching/*.md`）。
 *   判据：`npm run check:teaching` 会断言它与现读技能文件的解析结果一致。
 */
export const TEACHING = {
	"ok": true,
	"steps": [
		{
			"n": 1,
			"title": "头脑风暴（四个入口）",
			"text": "竞品分析 `/sr-analysis` · 问答式访谈 `/sr-concept` · 旧文档分析 · 人工补充——手里是什么材料就从哪个入口进，产出落 `analysis\\`。"
		},
		{
			"n": 2,
			"title": "成稿",
			"text": "`/sr-gdd-human` 出**成稿**——只有纯规则与界面（零配置指代），全部决策留痕在附录 A，供你审核确认；**这一步期间可以反复改**。"
		},
		{
			"n": 3,
			"title": "可选的两件事",
			"text": "（需要时才做；**不做也能直接进第 4 步**；两件都可以做、也可以只做一件）：\n   - `□` 从成稿**生成配置表**：`/sr-config` 从成稿的规则**派生**配置表字段与记录（新表/加字段/改记录，带读回验收）；\n   - `□` 把成稿里的 **ASCII 界面 UI 换成真实 UI**：**没有对应技能，人工做**；替换 UI 可能带来功能改动。"
		},
		{
			"n": 4,
			"title": "输出定稿",
			"text": "`/sr-gdd-ai` 把 **成稿 + 配置表**综合整合成**定稿**（功能规则、界面、配置契约、多语言文本、验收标准），并据定稿列出多语言文本条目；主线在定稿门之前**必经一道定稿审查**（`/sr-gdd-review` 出审查报告，随定稿一并呈门）。**定稿之后仍然可以改**——改走 `/sr-gdd-fix`（涉及配置表就调 `/sr-config` 改表并同步对应行）。**主线定稿通过后状态为 `active`、成稿归档**。直接调用只产出 `provisional` 工作版或 `blocked` 产物（不做审查）。"
		},
		{
			"n": 5,
			"title": "正式 UE 回写",
			"text": "把定稿真正落到工程里——**没有对应技能，人工做**。"
		}
	],
	"standalone": "**独立技能**（不在主线，需要时单独用）：`/sr-gtgenerator`、`/sr-gdd-review`（定稿审查，只读出报告）、`/sr-gdd-fix`（定稿之后的改动入口）。",
	"routes": [
		{
			"want": "我有个创意 / 想个新玩法 / 这个点子能不能做",
			"skill": "`/sr-concept`"
		},
		{
			"want": "分析这段录屏 / 拆一下这个竞品 / 能不能复刻",
			"skill": "`/sr-analysis`"
		},
		{
			"want": "写策划案 / 出 GDD / 整理成功能文档\"（主线成稿步，过程留痕+可读结果）",
			"skill": "`/sr-gdd-human`"
		},
		{
			"want": "整合定稿 / 出正式版 GDD / 交给程序的策划案",
			"skill": "`/sr-gdd-ai`"
		},
		{
			"want": "改定稿 / 修订定稿 / 调一下定稿里的某处",
			"skill": "`/sr-gdd-fix`"
		},
		{
			"want": "审查定稿 / 检查策划案 / 这稿能不能交程序",
			"skill": "`/sr-gdd-review`"
		},
		{
			"want": "把定稿出成评审会用的 HTML / 做成宣讲页\"（用户调用型，需手动输入）",
			"skill": "`/sr-gdd-html`"
		},
		{
			"want": "把这条规则落成配置表 / 加字段 / 建新表",
			"skill": "`/sr-config`"
		},
		{
			"want": "配英雄技能 / 把技能设计落到配置表\"（用户调用型，需手动输入）",
			"skill": "`/skill-hero-config`（**配套技能，不属于 sr 系列**，随工作区技能目录走、不在插件里）"
		},
		{
			"want": "新增/改 GID / 改多语言文案 / 导出 string_zh_CN / 翻译合并",
			"skill": "`/sr-gtgenerator`"
		}
	],
	"rules": [
		{
			"title": "产出落盘位置",
			"body": "每个功能的工作全部落在 **`<功能目录>` = `<SR_WORKSPACE>\\features\\<主题>\\`** 这一个目录里（从策划工作台进入的会话，工作目录**就是**它）。产物按\"谁产生 / 给谁看\"落进 4 个桶：\n\n| 桶 | 装什么 | 典型产出 |\n| --- | --- | --- |\n| `evidence\\` | **进来的原件 + 过程证据** | 竞品截图/录屏/PV · 旧文档原件 · 外部交付包 `UE交付_<日期>\\` · 抽帧与证据包 · 校准流水 `calibration_<主题>.jsonl` |\n| `analysis\\` | **想出来的内容** | 设计核三角报告 · 功能设计稿 · 体验报告 · 问题卡 · 复刻规格 · 各类交接 JSON · 旧文档分析 · 人工补充 |\n| `gdd\\` | **写出来的正文与交付物** | 成稿 `<主题>_<日期>.md` · 定稿 `<主题>_<日期>_定稿.md` · 修订点清单 · 审查报告 `<主题>_<日期>_审查.md` · 评审宣讲 HTML（+ content.json） |\n| `decisions\\` | **定下来的事** | `决策记录.md` —— **一个功能只有一个决策文件**，所有决策按时间追加（见 `references/decision-recording.md`） |\n\n★ 旧口径里的 `source\\` 并入 `evidence\\`、`delivery\\` 并入 `gdd\\`；工作区根下平铺的 `proposals\\ analysis\\ decisions\\ evidence\\` 是**历史结构**，新工作一律进功能目录。"
		},
		{
			"title": "数值铁律",
			"body": "完整约束见 `references/sr_project_context.md`（各 skill 第 0 步载入的同一份文件）；正文行内四类标注（`【推断】`、`待确认：`、`[真实]`、`[示例]`）见 `references/evidence-boundary.md`「轻量标注」——两处均不另存副本。"
		}
	],
	"cards": [
		{
			"id": "skill-hero-config",
			"title": "skill-hero-config 使用卡：英雄技能配置",
			"body": "# skill-hero-config 使用卡：英雄技能配置\n\n> 它是**配套技能**，**不属于 sr 系列**（名字里没有 `sr-` 前缀，也不随策划工作台插件分发）。\n\n**职责**：把【小世界】英雄技能详细设计.xlsm 的技能按规范落到副玩法技能表（B008-副玩法技能表.xlsx），自动推导子技能 / 计算 / buff 行与 ID 引用链。**用户调用型**——只能由人输入 `/skill-hero-config` 触发，agent 不会自动接手。\n\n**什么时候用**：\"配置弗莱德\"、\"把技能设计落到配置表\"、\"这把英雄技能配一下\"（都需手动输入命令）。\n\n**怎么用**：\n\n```\n/skill-hero-config 把弗莱德的技能配进 B008\n```\n\n**产出**（目标表同目录）：配置副本 `<原表名>-新增<日期>.xlsx`（不覆盖原表）、审查报告 `<原表名>-配置审查报告-<日期>.md`、变动行视图 `.xlsx`（供界面查看高亮改动）。\n",
			"rel": "references/teaching/skill-hero-config.md"
		},
		{
			"id": "sr-analysis",
			"title": "sr-analysis 使用卡：分析素材 / 拆解竞品",
			"body": "# sr-analysis 使用卡：分析素材 / 拆解竞品\n\n**职责**：从游戏素材（截图、录屏、PV、商店页、视频链接）出证据链诊断，你判定可参考后拆成可复刻的规格，交 `sr-gdd-human` 出成稿。\n\n**什么时候用**：\"分析这段录屏\"、\"拆一下这个竞品玩法\"、\"这个功能能不能复刻\"。\n\n**怎么用**：\n\n```\n/sr-analysis D:\\recordings\\新手期首战.mp4\n```\n\n**产出**（本功能目录 `<功能目录>\\` 下）：证据包落 `evidence\\`；`analysis\\` 下 experience-report（体验报告）、issue-cards（问题卡）、replication-spec（复刻规格）、sr-gdd-handoff（交接 JSON）；每次拍板追加一条 `decisions\\决策记录.md`。\n",
			"rel": "references/teaching/sr-analysis.md"
		},
		{
			"id": "sr-concept",
			"title": "sr-concept 使用卡：从创意到功能设计",
			"body": "# sr-concept 使用卡：从创意到功能设计\n\n**职责**：把一句话创意展开成可验证的功能设计——先出设计核三角报告（2~4 个候选方向，各带风险与验证方式），你拍板后展开完整功能设计稿，最后交 `sr-gdd-human` 出成稿。\n\n**什么时候用**：\"我有个创意\"、\"想个新玩法\"、\"这个点子能不能做\"。\n\n**怎么用**：\n\n```\n/sr-concept 玩家可以回溯时间改写上一场战斗的结果\n```\n\n**产出**（本功能目录 `<功能目录>\\analysis\\`）：concept-triage（设计核三角报告）、feature-concept（功能设计稿）、sr-gdd-handoff（交接 JSON）；每次拍板追加一条 `decisions\\决策记录.md`。\n",
			"rel": "references/teaching/sr-concept.md"
		},
		{
			"id": "sr-config",
			"title": "sr-config 使用卡：策划规则落配置数据",
			"body": "# sr-config 使用卡：策划规则落配置数据\n\n**职责**：把 `sr-gdd-human` 成稿的规则**派生**成配置表字段与记录（新建运行时表 / 增删改字段 / 增删改记录），可追溯、可读回验收。改的是配置表本身；**若该功能已有定稿，改完顺手同步定稿 §4 的字段对应与 §6 配置契约**（最小编辑，不重跑整合、不过门）。\n\n**什么时候用**：\"把这条规则落成配置表\"、\"给这张表加个字段\"、\"建一张新配置表\"。\n\n**怎么用**：\n\n```\n/sr-config 给英雄基础表加一个\"碎片合成所需数量\"字段\n/sr-config 新建一张神话宝库里程碑表\n```\n\n**产出**：**新建的运行时表落 `<功能目录>\\gdd\\<表名>.xlsx`（不直接进 `config_root`，需你手动放过去）**；change set 与读回验收报告也在 `<功能目录>\\gdd\\`；**改既有表**时在 `config_root` 就地更新 + 同目录 `<表名>.backup.<时间戳>` 备份。已有定稿时另回写定稿 §4 / §6 对应行。\n",
			"rel": "references/teaching/sr-config.md"
		},
		{
			"id": "sr-gdd-ai",
			"title": "sr-gdd-ai 使用卡：功能 GDD 整合定稿",
			"body": "# sr-gdd-ai 使用卡：功能 GDD 整合定稿\r\n\r\n**职责**：**首次整合**——综合 `sr-gdd-human` 成稿的规则与 `/sr-config` 的配置表整成交给程序的定稿（规则与配置字段的对应、§6 配置契约、§7 多语言文本、验收标准），不带过程留痕；主线在定稿门之前必经一道 `/sr-gdd-review` 审查（报告随定稿呈门），主线通过后才是 `active` 定稿，直接调用只产出 `provisional` 工作版或 `blocked` 产物。**定稿通过后它不再承接修改**：成稿归档废弃，之后的改动走 `/sr-gdd-fix`（三者分工见 `../gdd-pipeline.md`）。\r\n\r\n**什么时候用**：\"整合定稿\"、\"出正式版 / 最终版 GDD\"、\"出交给程序的策划案\"。\r\n\r\n**怎么用**：\r\n\r\n```\r\n/sr-gdd-ai 把神话宝库的成稿和配置变更整合成定稿\r\n```\r\n\r\n**产出**（本功能目录 `<功能目录>\\` 下）：定稿 `gdd\\<主题>_<日期>_定稿.md`（带 `_定稿` 后缀，头部 `doc_type: final_gdd` + `status: pending`，过门后 `active`）；退回成稿时另出 `_修订点.md`；每次拍板追加一条 `decisions\\决策记录.md`。\r\n",
			"rel": "references/teaching/sr-gdd-ai.md"
		},
		{
			"id": "sr-gdd-fix",
			"title": "sr-gdd-fix 使用卡：功能 GDD 定稿修改",
			"body": "# sr-gdd-fix 使用卡：功能 GDD 定稿修改\r\n\r\n**职责**：定稿之后的**唯一改动入口**——只接头部 `doc_type: final_gdd` + `status: active` 的已有定稿，按共用撰写纪律（`../gdd-writing-discipline.md`，按适用列取用）改规则、界面、范围、验收、配置对应与多语言文本；先做影响面扫描再最小编辑，不重跑整合。需要动配置表时调 `/sr-config`（后者改完顺手回写定稿 §4 / §6）。\r\n\r\n**什么时候用**：\"改定稿\"、\"修订定稿\"、\"调一下定稿里的某处\"、\"定稿里这个规则要改成…\"。\r\n\r\n**怎么用**：\r\n\r\n```\r\n/sr-gdd-fix 把神话宝库定稿里每日次数从 3 次改成 5 次\r\n```\r\n\r\n**产出**（本功能目录 `<功能目录>\\` 下）：定稿**原地更新**（`gdd\\<主题>_<日期>_定稿.md`，维持唯一活文档）；改动清单**不单独落盘**，要点写进 `decisions\\决策记录.md` 那一条的正文。\r\n",
			"rel": "references/teaching/sr-gdd-fix.md"
		},
		{
			"id": "sr-gdd-html",
			"title": "sr-gdd-html 使用卡：评审宣讲 HTML",
			"body": "# sr-gdd-html 使用卡：评审宣讲 HTML\n\n**职责**：把功能 GDD **定稿**重排成\"能边看图边讲\"的单文件 HTML——一个界面一节、左图右文、规则块化，截图 base64 内嵌、零外链，可直接投屏、可直接外发。只搬运不发明：规则与数值全部来自源定稿，且定稿要有界面清单。\n\n**什么时候用**（**手动调用**——本 skill 是用户调用型，agent 不会自动接手）：\"把定稿出成评审会用的 HTML\"、\"把定稿做成宣讲页\"。\n\n**怎么用**：\n\n```\n/sr-gdd-html <功能目录>\\gdd\\英雄升级功能优化_20260902_定稿.md\n```\n\n**产出**（本功能目录 `<功能目录>\\gdd\\`）：`<主题>_宣讲_<日期>.html` 与同名 `.content.json` 成对留档；出口拍板追加一条 `decisions\\决策记录.md`。\n",
			"rel": "references/teaching/sr-gdd-html.md"
		},
		{
			"id": "sr-gdd-human",
			"title": "sr-gdd-human 使用卡：功能 GDD 成稿",
			"body": "# sr-gdd-human 使用卡：功能 GDD 成稿\r\n\r\n**职责**：入口产出（sr-concept 设计稿 / sr-analysis 复刻规格 / 旧案）在这里第一次落成完整功能 GDD——**只有纯规则与设计，不含任何配置内容**，决策留痕在附录 A。这些规则是 `/sr-config` 派生配置字段的唯一依据；**定稿通过后本成稿归档废弃，后续修改直接改定稿**（三者分工见 `../gdd-pipeline.md`）。\r\n\r\n**什么时候用**：\"写策划案\"、\"出 GDD\"、\"出设计提案 / 功能文档\"、\"出一份人类可读版 GDD\"。\r\n\r\n**怎么用**：\r\n\r\n```\r\n/sr-gdd-human 基于 英雄改造v0.2.xlsx 出一份人类可读的成稿\r\n```\r\n\r\n**产出**（本功能目录 `<功能目录>\\` 下）：成稿 `gdd\\<主题>_<日期>.md`（头部 `doc_type: draft_gdd`）；被定稿退回时另出 `_修订点.md`；每次拍板追加一条 `decisions\\决策记录.md`。\r\n",
			"rel": "references/teaching/sr-gdd-human.md"
		},
		{
			"id": "sr-gdd-review",
			"title": "sr-gdd-review 使用卡：功能 GDD 定稿审查",
			"body": "# sr-gdd-review 使用卡：功能 GDD 定稿审查\r\n\r\n**职责**：对 sr 系列产出的功能 GDD **定稿**做**只读审查**——结构骨架、撰写纪律（按 `../gdd-writing-discipline.md` 适用列）、数值落地标注、§6 配置契约与 §7 多语言文本、与成稿/配置表的整合一致性，出审查报告（`gdd\\<主题>_<日期>_审查.md`）。**不改定稿**：修复转 `/sr-gdd-fix`（配置表问题转 `/sr-config`）。\r\n\r\n**什么时候用**：\"审查定稿\"、\"检查策划案\"、\"review GDD\"、\"这份定稿能不能交程序\"。\r\n\r\n**怎么用**：\r\n\r\n```\r\n/sr-gdd-review 神话宝库\r\n```\r\n\r\n**产出**（本功能目录 `<功能目录>\\` 下）：审查报告 `gdd\\<主题>_<日期>_审查.md`；审查结论**也追加一条决策记录**到 `decisions\\决策记录.md`。\r\n",
			"rel": "references/teaching/sr-gdd-review.md"
		},
		{
			"id": "sr-gtgenerator",
			"title": "sr-gtgenerator 使用卡：GTGenerator 配置维护",
			"body": "# sr-gtgenerator 使用卡：GTGenerator 配置维护\n\n**职责**：维护《文明之跃》GTGenerator 配置——GID 类型表（gtypes.xml）与多语言文本表（normaltxt.xml）的新增 / 废弃 / 修改，并通过自带 CLI 导出 lua 与 Android 文本资源；写操作自动备份，可 `--dry-run` 预演。\n\n**什么时候用**：\"新增/修改/废弃 GID\"、\"加一条多语言文案 / Localizatio(n) 文案\"、\"生成 string_zh_CN.txt / APQualityMap.txt / Android 文本资源\"、\"翻译合并\"。\n\n**怎么用**：\n\n```\n/sr-gtgenerator 新增 GID <类型> <说明>\n```\n\n**产出**（GTGenerator 工作目录下）：`gtypes.xml` / `normaltxt.xml` 写回（备份在 `.gtgen-backup/<时间戳>/`）、`OutPut_Dev/string_zh_CN.txt` 与 `APQualityMap.txt` 重新生成（Android 文本资源需另行生成）。\n",
			"rel": "references/teaching/sr-gtgenerator.md"
		}
	],
	"problems": []
};
