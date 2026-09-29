/**
 * 宿主半侧（Node ESM 入口，构建成 `lib/index.js`）—— 工单 05：**技能随包注册**。
 *
 * 为什么要有这半侧的行为：实测（`05-skill-catalog-premise.md`）证明 sr 技能的可见性**完全由 cwd 决定** ——
 * 同一台机器、同一个 profile，cwd 从 `D:\TimeMachine` 换到功能文件夹，10 个 sr 技能**全部消失**
 * （磁盘侧那 10 个来自 `.agents\skills`，靠"回退 cwd 才命中"）。所以让技能随包走不是优化，是硬前提。
 *
 * 做什么：把构建期生成进包里的 12 个 sr 技能，逐条 `ctx.skills.register(...)` 到**本行所属的层**
 * （宿主行 ⇒ cordis 无 scope ⇒ global 层 ⇒ 所有会话可见，与今天的行为一致）。
 * 不做什么：**不 `provide` 任何服务**，不碰磁盘技能目录的正文，不写任何文件。
 *
 * ── 兄弟资源（references / tools / resources）的取舍：**只嵌正文**（要点 §2 的方案 A）─────
 * 进包的只有 SKILL.md 正文（118.7 KB）；兄弟资源合计 1.51 MB（`sr-gdd-html` 一个占 1.09 MB）**没进包**。
 * 所以本文件对"有兄弟资源"的技能挂 `resourceBase`：
 *   · 磁盘技能目录存在 ⇒ `{kind:'directory', path: <磁盘根>/<技能名>}`（与磁盘侧今天给出的形状一致）；
 *   · 不存在（同事机器上没 clone 技能目录）⇒ `{kind:'opaque', description: …}`，**如实说明资源不可用**，
 *     绝不假装资源可用。
 * ★ 结论必须写清楚：**只嵌正文 ≠ 技能完整可用**。纯正文流程（sr-concept / sr-gdd-human / …）不受影响；
 *   依赖兄弟文件的环节（如 `sr-askme` 的 `references/decision.schema.json`、`sr-gdd-html` 的 `tools/`）
 *   仍然要本机那份磁盘技能目录。连兄弟资源一起打包是后续票的选项。
 *
 * ── 与磁盘侧同名技能的优先级（读 dsh-skill 源码得出，别改这里）─────────────────────────
 *   project-dsh 100 < project-agents 200 < **runtime 250** < custom 300 < user-dsh 400 < user-agents 500 < bundled 600
 *   ⇒ 在 `cwd` 命中 `.agents\skills` 的会话里（今天的工作会话），**磁盘那一份仍然赢**，本文件不改变
 *   现有行为；只有在 cwd 够不到磁盘技能目录时，随包这一份才顶上（`05-skill-catalog-premise.md` 的处理臂）。
 */
import fs from "node:fs";
import path from "node:path";
import { SKILLS, SKILLS_MANIFEST } from "./generated/skills.ts";

/** 要求 `ctx.skills`（`@deepseek-ai/dsh-skill` 的注册表服务）；插件行落在宿主 ⇒ 注册进 global 层。 */
export const inject = ["skills"];

/** 磁盘根找不到时给模型/用户看的话——必须**如实**说明兄弟资源不可用。 */
const OPAQUE_DESCRIPTION =
	"随包技能：只嵌入了 SKILL.md 正文，references/ tools/ resources/ 等兄弟资源没有随包分发，磁盘上也找不到技能目录";

/** 每个技能有几个兄弟资源（构建期量出来的，写进 SKILLS_MANIFEST.files）。 */
const RESOURCE_FILES = new Map(SKILLS_MANIFEST.files.map((f) => [f.name, f.resources]));

/**
 * 找"磁盘上的技能根"。只用于 `resourceBase`（兄弟资源解析），**技能的可见性不依赖它**。
 * 顺序：宿主行 config 的 `skillsRoot` → 环境变量 `SR_SKILLS_ROOT` → 构建期记录的源目录。
 * 三个都没有/都不存在就返回 `undefined`（走 opaque）。
 * @param {{ skillsRoot?: unknown } | undefined} config 宿主行传入的 config（web profile 里那份含 configPath/projectRoot）
 */
function findDiskSkillsRoot(config) {
	const candidates = [];
	if (typeof config?.skillsRoot === "string" && config.skillsRoot.trim() !== "") candidates.push(config.skillsRoot);
	if (typeof process.env.SR_SKILLS_ROOT === "string" && process.env.SR_SKILLS_ROOT.trim() !== "") candidates.push(process.env.SR_SKILLS_ROOT);
	candidates.push(SKILLS_MANIFEST.source);
	for (const candidate of candidates) {
		try {
			if (fs.statSync(candidate).isDirectory()) return path.resolve(candidate);
		} catch {
			// 不存在/没权限：试下一个候选，别让资源解析影响技能注册本身
		}
	}
	return undefined;
}

/**
 * 给一条技能算 `resourceBase`。没有兄弟资源的技能**不挂**（没什么可解析的，别造字段）。
 * 导出是为了让仓内用例能直接钉住"磁盘根不在 ⇒ opaque"这条（真机上一直有磁盘根，测不到那一支）。
 * @param {string | undefined} diskRoot 磁盘技能根（找不到时 undefined）
 * @param {string} name 技能名（= 磁盘上的目录名）
 */
export function resolveResourceBase(diskRoot, name) {
	if ((RESOURCE_FILES.get(name) ?? 0) === 0) return undefined;
	if (diskRoot !== undefined) {
		const dir = path.join(diskRoot, name);
		try {
			if (fs.statSync(dir).isDirectory()) return { kind: "directory", path: dir };
		} catch {
			// 落到 opaque
		}
	}
	return { kind: "opaque", description: OPAQUE_DESCRIPTION };
}

/**
 * 注册全部随包技能。逐条来自 `src/generated/skills.ts`（构建期生成、入库、由 `npm run check:skills` 防漂移）。
 * @param {any} ctx cordis 上下文（需要 `skills` 服务）
 * @param {{ skillsRoot?: unknown } | undefined} config 宿主行 config
 */
export function apply(ctx, config) {
	const diskRoot = findDiskSkillsRoot(config);
	let withResources = 0;
	let opaque = 0;

	for (const skill of SKILLS) {
		const resourceBase = resolveResourceBase(diskRoot, skill.name);
		if (resourceBase !== undefined) {
			withResources += 1;
			if (resourceBase.kind === "opaque") opaque += 1;
		}
		ctx.skills.register({
			name: skill.name,
			description: skill.description,
			content: skill.content,
			source: "bundled",
			invocation: skill.invocation,
			// 省略 = 不挂这个字段（纯正文技能没有兄弟资源可解析）
			...(resourceBase === undefined ? {} : { resourceBase }),
		});
	}

	const modelVisible = SKILLS.filter((s) => s.invocation.modelInvocable).length;
	ctx.logger?.info?.(
		`[sr-workbench] 随包注册 ${SKILLS.length} 个 sr 技能（模型可见 ${modelVisible} · 用户专用 ${SKILLS.length - modelVisible}）` +
			`· 正文 ${(SKILLS_MANIFEST.bodyBytes / 1024).toFixed(1)} KB · 有兄弟资源 ${withResources} 个` +
			`（磁盘技能根${diskRoot === undefined ? "未找到 ⇒ resourceBase=opaque" : "：" + diskRoot}${diskRoot === undefined ? "" : "，其中 " + opaque + " 个落到 opaque"}）`,
	);
}
