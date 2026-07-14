// Extension point: add vocabulary, date labels, and fake data labels here.
export const visualTokens = {
  koreanKeywords: [
    "접속", "검증", "회로", "출력", "신호", "제어", "기록", "연산",
    "동기", "방식", "전원", "해석", "단말", "기준", "응답", "흐름"
  ],
  hanjaKeywords: ["林"],
  greetingTokens: [
    { value: "안녕?", typeface: "korean" },
    { value: "你好?", typeface: "chinese" },
    { value: "HELLO?", typeface: "english" }
  ],
  englishKeywords: [
    "ACCESS", "OUTPUT", "VERIFIED", "STANDBY", "RUNNING", "SIGNAL",
    "VECTOR", "STATUS", "MODULE", "CIRCUIT", "LOCKED", "SYSTEM",
    "FIELD", "REPORT", "QUEUE", "INPUT"
  ],
  statusCodes: ["200", "301", "400", "403", "404", "500", "503"],
  actionTokens: [
    { english: "BUY", korean: "구매", chinese: "购买" },
    { english: "USE", korean: "사용", chinese: "使用" },
    { english: "BREAK", korean: "분해", chinese: "拆解" },
    { english: "FIX", korean: "수리", chinese: "修复" },
    { english: "TRASH", korean: "폐기", chinese: "丢弃" },
    { english: "CHANGE", korean: "변경", chinese: "更改" },
    { english: "MAIL", korean: "메일", chinese: "邮件" },
    { english: "UPGRADE", korean: "업그레이드", chinese: "升级" },
    { english: "CHARGE", korean: "충전", chinese: "充电" },
    { english: "POINT", korean: "지시", chinese: "指向" },
    { english: "ZOOM", korean: "확대", chinese: "缩放" },
    { english: "PRESS", korean: "누르기", chinese: "按下" },
    { english: "SNAP", korean: "캡처", chinese: "快照" },
    { english: "WORK", korean: "작동", chinese: "运作" },
    { english: "QUICK", korean: "빠르게", chinese: "快速" },
    { english: "ERASE", korean: "삭제", chinese: "擦除" },
    { english: "WRITE", korean: "쓰기", chinese: "写入" },
    { english: "CUT", korean: "잘라내기", chinese: "剪切" },
    { english: "PASTE", korean: "붙여넣기", chinese: "粘贴" },
    { english: "SAVE", korean: "저장", chinese: "保存" },
    { english: "LOAD", korean: "불러오기", chinese: "加载" },
    { english: "CHECK", korean: "확인", chinese: "检查" },
    { english: "REWRITE", korean: "다시쓰기", chinese: "重写" },
    { english: "PLUG", korean: "연결", chinese: "接入" },
    { english: "PLAY", korean: "재생", chinese: "播放" },
    { english: "BURN", korean: "굽기", chinese: "刻录" },
    { english: "RIP", korean: "추출", chinese: "提取" },
    { english: "DRAG AND DROP", korean: "드래그앤드롭", chinese: "拖放" },
    { english: "ZIP", korean: "압축", chinese: "压缩" },
    { english: "UNZIP", korean: "압축해제", chinese: "解压" },
    { english: "LOCK", korean: "잠금", chinese: "锁定" },
    { english: "FILL", korean: "채우기", chinese: "填充" },
    { english: "CALL", korean: "호출", chinese: "调用" },
    { english: "FIND", korean: "찾기", chinese: "查找" },
    { english: "VIEW", korean: "보기", chinese: "查看" },
    { english: "CODE", korean: "코딩", chinese: "编码" },
    { english: "JAM", korean: "재밍", chinese: "干扰" },
    { english: "UNLOCK", korean: "잠금해제", chinese: "解锁" },
    { english: "SURF", korean: "탐색", chinese: "浏览" },
    { english: "SCROLL", korean: "스크롤", chinese: "滚动" },
    { english: "PAUSE", korean: "일시정지", chinese: "暂停" },
    { english: "CLICK", korean: "클릭", chinese: "点击" },
    { english: "CROSS", korean: "교차", chinese: "交叉" },
    { english: "CRACK", korean: "해독", chinese: "破解" },
    { english: "SWITCH", korean: "전환", chinese: "切换" },
    { english: "UPDATE", korean: "업데이트", chinese: "更新" },
    { english: "NAME", korean: "명명", chinese: "命名" },
    { english: "READ", korean: "읽기", chinese: "读取" },
    { english: "TUNE", korean: "조정", chinese: "调整" },
    { english: "PRINT", korean: "인쇄", chinese: "打印" },
    { english: "SCAN", korean: "스캔", chinese: "扫描" },
    { english: "SEND", korean: "전송", chinese: "发送" },
    { english: "FAX", korean: "팩스", chinese: "传真" },
    { english: "RENAME", korean: "이름변경", chinese: "重命名" },
    { english: "TOUCH", korean: "터치", chinese: "触摸" },
    { english: "BRING", korean: "가져오기", chinese: "导入" },
    { english: "PAY", korean: "결제", chinese: "支付" },
    { english: "WATCH", korean: "감시", chinese: "监视" },
    { english: "TURN", korean: "회전", chinese: "旋转" },
    { english: "LEAVE", korean: "종료", chinese: "退出" },
    { english: "START", korean: "시작", chinese: "启动" },
    { english: "FORMAT", korean: "포맷", chinese: "格式化" }
  ],
  organizationPrefixes: [
    "RADIAN", "NOVA", "ATLAS", "ORBITAL", "CARGO", "COBALT",
    "SUMMIT", "VECTOR", "MERIDIAN", "HELIX", "AXIOM", "DELTA"
  ],
  organizationSuffixes: ["LABS", "WORKS", "STUDIO", "DIVISION", "SYSTEMS", "ENGINEERING", "INDUSTRIES", "OFFICE"],
  tableFieldLabels: ["LOT", "SPEC", "FREQ", "LOAD", "REV", "TEMP", "POWER", "LAT", "CFG"],
  dateTypography: {
    englishMonths: ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"],
    englishMonthShort: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
    chineseDigits: ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"],
    refreshedLabels: { korean: "갱신", english: "REFRESHED", chinese: "刷新" },
    timestampLabels: { korean: "타임스탬프", english: "TIMESTAMP", chinese: "时间戳" }
  }
};

export const VOCABULARY_VERSION = 1;

const LANGUAGE_METADATA = Object.freeze({
  en: { script: "latin", typeface: "english" },
  ko: { script: "hangul", typeface: "korean" },
  zh: { script: "han", typeface: "chinese" }
});

const ACTION_LANGUAGE_FIELDS = Object.freeze({ en: "english", ko: "korean", zh: "chinese" });

function slugifyEnglish(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function displayClassFor(text, phrasePackId = null) {
  if (phrasePackId) return "phrase";
  if (text.length <= 4) return "short";
  if (text.length <= 8) return "medium";
  return "long";
}

function lexicalUse({
  id,
  text,
  language,
  partOfSpeech,
  tags,
  domains,
  marker = null,
  scopeNote,
  examples = [],
  counterExamples = [],
  phrasePackId = null,
  familyId,
  materializationOrdinal,
  instanceKey
}) {
  const record = {
    id,
    text,
    language,
    script: LANGUAGE_METADATA[language].script,
    typeface: LANGUAGE_METADATA[language].typeface,
    partOfSpeech,
    tags,
    domains,
    marker,
    displayClass: displayClassFor(text, phrasePackId),
    scopeNote,
    examples,
    counterExamples,
    phrasePackId,
    source: "curated",
    reviewStatus: "approved",
    familyId: familyId || `lexical:${id}`,
    materializationOrdinal: materializationOrdinal ?? 0
  };
  if (instanceKey !== undefined) record.instanceKey = instanceKey;
  return Object.freeze(record);
}

const ACTION_EQUIVALENCE_OVERRIDES = Object.freeze({
  BREAK: { ko: "adapted", zh: "adapted" },
  MAIL: { ko: "adapted", zh: "close" },
  POINT: { ko: "close" },
  SNAP: { ko: "close", zh: "adapted" },
  RIP: { ko: "adapted", zh: "adapted" },
  CALL: { ko: "adapted" },
  CODE: { ko: "adapted" },
  JAM: { ko: "adapted", zh: "close" },
  CROSS: { ko: "close" },
  BRING: { ko: "close", zh: "adapted" },
  WATCH: { ko: "close", zh: "close" },
  TURN: { ko: "close" },
  LEAVE: { ko: "adapted", zh: "close" },
  FORMAT: { ko: "adapted" }
});

const actionLexicalUses = [];
const actionTranslationSets = [];

for (const group of visualTokens.actionTokens) {
  const isModifier = group.english === "QUICK";
  const usage = isModifier ? "modifier" : "command";
  const slug = slugifyEnglish(group.english);
  const translationSetId = `${slug}.${usage}`;
  const phrasePackId = group.english === "DRAG AND DROP" ? "technologic.action-phrase" : null;
  const members = [];

  for (const [language, field] of Object.entries(ACTION_LANGUAGE_FIELDS)) {
    const id = `${translationSetId}.${language}`;
    const text = group[field];
    actionLexicalUses.push(lexicalUse({
      id,
      text,
      language,
      partOfSpeech: isModifier ? "adverb" : "verb",
      tags: [isModifier ? "modifier" : "action"],
      domains: ["system", "interface"],
      scopeNote: isModifier
        ? "Speed modifier used with an approved command."
        : `Imperative ${group.english.toLowerCase()} operation used as a system-facing command.`,
      examples: isModifier ? ["QUICK + UPDATE"] : [`${group.english} + SYSTEM`],
      counterExamples: isModifier ? ["QUICK as a standalone command"] : [`${group.english} + FOREST`],
      phrasePackId
    }));
    members.push(Object.freeze({
      lexicalUseId: id,
      equivalence: ACTION_EQUIVALENCE_OVERRIDES[group.english]?.[language] || "exact"
    }));
  }

  actionTranslationSets.push(Object.freeze({
    id: translationSetId,
    gloss: isModifier
      ? "Perform an adjacent command with speed."
      : `Perform the ${group.english.toLowerCase()} operation in a digital or technical context.`,
    members: Object.freeze(members)
  }));
}

const curatedMultilingualGroups = [
  {
    id: "system.topic",
    texts: { en: "SYSTEM", ko: "시스템", zh: "系统" },
    partOfSpeech: "noun",
    tags: ["topic"],
    domains: ["system"],
    gloss: "A technical system that can receive actions or expose state."
  },
  {
    id: "network.topic",
    texts: { en: "NETWORK", ko: "네트워크", zh: "网络" },
    partOfSpeech: "noun",
    tags: ["topic"],
    domains: ["network"],
    gloss: "A connected technical network."
  },
  {
    id: "forest.topic",
    texts: { en: "FOREST", ko: "숲", zh: "森林" },
    partOfSpeech: "noun",
    tags: ["topic"],
    domains: ["nature"],
    gloss: "A natural forest, retained as an intentional incompatibility fixture."
  },
  {
    id: "access-denied.status",
    texts: { en: "ACCESS DENIED", ko: "접근 거부", zh: "拒绝访问" },
    partOfSpeech: "phrase",
    tags: ["state", "result"],
    domains: ["system", "network"],
    gloss: "A system state in which access was refused.",
    phrasePackId: "status.atomic"
  },
  {
    id: "verified.status",
    texts: { en: "VERIFIED", ko: "검증 완료", zh: "已验证" },
    partOfSpeech: "adjective",
    tags: ["state", "result"],
    domains: ["system", "production"],
    gloss: "A completed verification state."
  },
  {
    id: "running.status",
    texts: { en: "RUNNING", ko: "실행 중", zh: "运行中" },
    partOfSpeech: "adjective",
    tags: ["state"],
    domains: ["system"],
    gloss: "A system currently operating."
  },
  {
    id: "standby.status",
    texts: { en: "STANDBY", ko: "대기", zh: "待机" },
    partOfSpeech: "noun",
    tags: ["state"],
    domains: ["system"],
    gloss: "A system ready but not actively operating."
  },
  {
    id: "locked.status",
    texts: { en: "LOCKED", ko: "잠김", zh: "已锁定" },
    partOfSpeech: "adjective",
    tags: ["state", "result"],
    domains: ["system"],
    gloss: "A locked system state."
  },
  {
    id: "retry.command",
    texts: { en: "RETRY", ko: "재시도", zh: "重试" },
    partOfSpeech: "verb",
    tags: ["action"],
    domains: ["system", "network"],
    gloss: "Attempt a failed or denied operation again."
  },
  {
    id: "operator.mention",
    texts: { en: "@OPERATOR", ko: "@운영자", zh: "@操作员" },
    partOfSpeech: "proper-noun",
    tags: ["identity"],
    domains: ["social", "system"],
    marker: "mention",
    gloss: "A fictional person or operator mention."
  },
  {
    id: "system.hashtag",
    texts: { en: "#SYSTEM", ko: "#시스템", zh: "#系统" },
    partOfSpeech: "noun",
    tags: ["topic"],
    domains: ["social", "system"],
    marker: "hashtag",
    gloss: "A fictional system topic tag."
  },
  {
    id: "hello.greeting",
    texts: { en: "HELLO?", ko: "안녕?", zh: "你好?" },
    partOfSpeech: "interjection",
    tags: ["greeting"],
    domains: ["social", "interface"],
    gloss: "A short questioning greeting."
  }
];

const curatedLexicalUses = [];
const curatedTranslationSets = [];

for (const group of curatedMultilingualGroups) {
  const members = [];
  for (const language of ["en", "ko", "zh"]) {
    const id = `${group.id}.${language}`;
    const text = group.texts[language];
    curatedLexicalUses.push(lexicalUse({
      id,
      text,
      language,
      partOfSpeech: group.partOfSpeech,
      tags: group.tags,
      domains: group.domains,
      marker: group.marker || null,
      scopeNote: group.gloss,
      examples: [`${text} in a ${group.id.split(".").at(-1)} slot`],
      counterExamples: group.id === "forest.topic" ? ["UPGRADE + FOREST"] : [],
      phrasePackId: group.phrasePackId || null
    }));
    members.push(Object.freeze({ lexicalUseId: id, equivalence: "exact" }));
  }
  curatedTranslationSets.push(Object.freeze({
    id: group.id,
    gloss: group.gloss,
    members: Object.freeze(members)
  }));
}

const organizationUses = ["RADIAN LABS", "NOVA SYSTEMS", "ATLAS STUDIO"].map((text, index) => lexicalUse({
  id: `organization.identity.${index + 1}.en`,
  text,
  language: "en",
  partOfSpeech: "proper-noun",
  tags: ["identity"],
  domains: ["production", "system"],
  scopeNote: "A fictional organization identity without a mention marker.",
  examples: [`${text} + VERIFIED`],
  counterExamples: [`@${text.replaceAll(" ", "_")}`]
}));

const httpStatusUses = visualTokens.statusCodes.map((code, index) => lexicalUse({
  id: `http-status.reference.${code}.en`,
  text: code,
  language: "en",
  partOfSpeech: "code",
  tags: ["reference", "value"],
  domains: ["network", "system"],
  scopeNote: "An HTTP-shaped status reference used as metadata, not a generic code.",
  examples: [`STATUS ${code}`],
  familyId: "lexical:http-status.reference",
  materializationOrdinal: index,
  instanceKey: `http:${code}`
}));

const genericCodeUses = ["CFG-01", "REV-A", "V1.2", "LOT-07"].map((text, index) => lexicalUse({
  id: `generic-code.reference.${index + 1}.en`,
  text,
  language: "en",
  partOfSpeech: "code",
  tags: ["reference", "value"],
  domains: ["production", "system"],
  scopeNote: "A generic technical reference code distinct from HTTP status semantics.",
  examples: [`SYSTEM + ${text}`],
  familyId: "lexical:generic-code.reference",
  materializationOrdinal: index,
  instanceKey: `generic:${text}`
}));

export const lexicalFamilies = Object.freeze([
  Object.freeze({
    id: "family.http-status",
    kind: "static",
    declaredMaterializationCount: httpStatusUses.length,
    lexicalUseIds: Object.freeze(httpStatusUses.map(use => use.id))
  }),
  Object.freeze({
    id: "family.generic-code",
    kind: "static",
    declaredMaterializationCount: genericCodeUses.length,
    lexicalUseIds: Object.freeze(genericCodeUses.map(use => use.id))
  })
]);

export const lexicalUses = Object.freeze([
  ...actionLexicalUses,
  ...curatedLexicalUses,
  ...organizationUses,
  ...httpStatusUses,
  ...genericCodeUses
]);

export const translationSets = Object.freeze([
  ...actionTranslationSets,
  ...curatedTranslationSets
]);

export const actionTranslationAudit = Object.freeze(actionTranslationSets.map(set => Object.freeze({
  translationSetId: set.id,
  memberCount: set.members.length,
  reviewStatus: "approved",
  equivalenceByLanguage: Object.freeze(Object.fromEntries(set.members.map(member => [
    member.lexicalUseId.split(".").at(-1),
    member.equivalence
  ])))
})));

export const translationErrorLedger = Object.freeze([
  Object.freeze({
    id: "translation-error:break-ko-001",
    translationSetId: "break.command",
    lexicalUseId: "break.command.ko",
    status: "resolved",
    disposition: "Keep adapted equivalence: 분해 means disassemble rather than generic break.",
    adjudicatorIds: Object.freeze(["reviewer-ko-01", "reviewer-ko-02"]),
    evidence: "The approved use is a technical disassembly command, not literal damage."
  }),
  Object.freeze({
    id: "translation-error:snap-zh-001",
    translationSetId: "snap.command",
    lexicalUseId: "snap.command.zh",
    status: "waived",
    disposition: "Retain 快照 as an adapted interface command for the visual corpus.",
    adjudicatorIds: Object.freeze(["reviewer-zh-01", "reviewer-zh-02"]),
    evidence: "The Chinese item is normally a snapshot noun but is legible in command UI context."
  }),
  Object.freeze({
    id: "translation-error:leave-ko-001",
    translationSetId: "leave.command",
    lexicalUseId: "leave.command.ko",
    status: "resolved",
    disposition: "Record 종료 as adapted because it denotes exit or terminate in this interface scope.",
    adjudicatorIds: Object.freeze(["reviewer-ko-01", "reviewer-ko-02"]),
    evidence: "Scope is a system command and not physical departure."
  })
]);

const goodExampleActions = [
  "upgrade", "update", "load", "save", "scan", "send", "lock", "unlock", "start", "pause",
  "check", "find", "view", "print", "format", "rewrite", "plug", "play", "charge", "switch"
];

export const compositionExamples = Object.freeze([
  ...goodExampleActions.flatMap((slug, index) => {
    const language = ["en", "ko", "zh"][index % 3];
    return [Object.freeze({
      id: `good.command.${String(index + 1).padStart(2, "0")}`,
      verdict: "good",
      recipeId: "command",
      lexicalUseIds: Object.freeze([`${slug}.command.${language}`, `system.topic.${language}`]),
      rationale: "A technical action has a legible system target.",
      reviewStatus: "approved"
    })];
  }),
  ...["access-denied", "verified", "running", "standby", "locked"].flatMap((slug, groupIndex) =>
    ["en", "ko", "zh", "en"].map((language, variantIndex) => Object.freeze({
      id: `good.status.${String(groupIndex * 4 + variantIndex + 1).padStart(2, "0")}`,
      verdict: "good",
      recipeId: "status",
      lexicalUseIds: Object.freeze([
        `${slug}.status.${language}`,
        `${variantIndex % 2 === 0 ? "system" : "network"}.topic.${language}`
      ]),
      rationale: "A reviewed state is attached to a technical subject.",
      reviewStatus: "approved"
    }))
  ),
  ...goodExampleActions.map((slug, index) => Object.freeze({
    id: `bad.command.${String(index + 1).padStart(2, "0")}`,
    verdict: "bad",
    recipeId: "command",
    lexicalUseIds: Object.freeze([`${slug}.command.en`, "forest.topic.en"]),
    rationale: "The technical command has no approved direct relation to the nature topic.",
    reviewStatus: "approved"
  }))
]);

function inventoryRecord(id, text, language, typeface, tokenFunction, role) {
  return Object.freeze({
    id,
    text,
    language,
    typeface,
    renderTaxonomy: Object.freeze({
      form: "typography",
      function: tokenFunction,
      role,
      context: "component"
    })
  });
}

export const visibleTokenInventory = Object.freeze([
  ...visualTokens.koreanKeywords.map((text, index) => inventoryRecord(
    `visible.korean-keyword.${index + 1}`,
    text,
    "ko",
    "korean",
    "content",
    "keyword"
  )),
  ...visualTokens.hanjaKeywords.map((text, index) => inventoryRecord(
    `visible.han-keyword.${index + 1}`,
    text,
    "zh",
    "chinese",
    "content",
    "keyword"
  )),
  ...visualTokens.englishKeywords.map((text, index) => inventoryRecord(
    `visible.english-keyword.${index + 1}`,
    text,
    "en",
    "english",
    "content",
    "keyword"
  )),
  ...visualTokens.greetingTokens.map((token, index) => inventoryRecord(
    `visible.greeting.${index + 1}`,
    token.value,
    token.typeface === "english" ? "en" : token.typeface === "korean" ? "ko" : "zh",
    token.typeface,
    "content",
    "greeting"
  )),
  ...actionLexicalUses.map(use => inventoryRecord(
    `visible.${use.id}`,
    use.text,
    use.language,
    use.typeface,
    "content",
    use.tags.includes("modifier") ? "action-modifier" : "action-keyword"
  )),
  ...httpStatusUses.map(use => inventoryRecord(
    `visible.${use.id}`,
    use.text,
    use.language,
    use.typeface,
    "data",
    "status-code"
  ))
]);
