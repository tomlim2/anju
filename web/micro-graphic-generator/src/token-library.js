import { GRAPHIC_SIZE_SCALE, GRAPHIC_TOKEN_SIZES } from "./config.js";
import { typographyToken } from "./token-model.js";

export function createTokenLibrary({ randomSource, visualTokens, generationDate, measureBadgeWidth }) {
  const { integer, pick, chance } = randomSource;

  function codeToken() {
    return chance(0.46)
      ? `0X${integer(0, 255).toString(16).toUpperCase().padStart(2, "0")}`
      : `${integer(2, 9)}${integer(0, 9)}${integer(0, 9)}`;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function chineseDigitSequence(value) {
    return String(value)
      .split("")
      .map(char => visualTokens.dateTypography.chineseDigits[Number(char)])
      .join("");
  }

  function chineseNumber(value) {
    if (value < 10) return visualTokens.dateTypography.chineseDigits[value];
    if (value === 10) return "十";
    if (value < 20) return `十${visualTokens.dateTypography.chineseDigits[value - 10]}`;
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    return `${visualTokens.dateTypography.chineseDigits[tens]}十${ones ? visualTokens.dateTypography.chineseDigits[ones] : ""}`;
  }

  function todayDateTypographyTokens(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();
    const englishMonth = visualTokens.dateTypography.englishMonths[month - 1];
    const englishMonthShort = visualTokens.dateTypography.englishMonthShort[month - 1];
    const timestamp = `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
    const epochTimestamp = String(date.getTime());
    const koreanMeridiem = hour < 12 ? "오전" : "오후";
    const koreanHour = hour % 12 || 12;
    const labels = visualTokens.dateTypography.refreshedLabels;
    const timestampLabels = visualTokens.dateTypography.timestampLabels;
    const dateToken = (value, typeface) => typographyToken(value, {
      typeface,
      size: "large",
      function: "content",
      role: "date-time"
    });

    return [
      dateToken(`${year}년 ${month}월 ${day}일`, "korean"),
      dateToken(`${year}년 ${month}월 ${day}일 ${koreanMeridiem} ${koreanHour}시 ${minute}분`, "korean"),
      dateToken(`${labels.korean} ${timestamp}`, "korean"),
      dateToken(`${timestampLabels.korean} ${epochTimestamp}`, "korean"),
      dateToken(`${month}월 ${day}일`, "korean"),
      dateToken(`${englishMonth} ${day}, ${year}`, "english"),
      dateToken(`${englishMonth} ${day}, ${year} ${timestamp}`, "english"),
      dateToken(`${pad2(day)} ${englishMonthShort} ${year}`, "english"),
      dateToken(`${labels.english} ${timestamp}`, "english"),
      dateToken(`${timestampLabels.english} ${epochTimestamp}`, "english"),
      dateToken(`${year}年${month}月${day}日`, "chinese"),
      dateToken(`${year}年${month}月${day}日 ${timestamp}`, "chinese"),
      dateToken(`${chineseDigitSequence(year)}年${chineseNumber(month)}月${chineseNumber(day)}日`, "chinese"),
      dateToken(`${labels.chinese} ${timestamp}`, "chinese"),
      dateToken(`${timestampLabels.chinese} ${epochTimestamp}`, "chinese")
    ];
  }

  function actionTypographyTokens(size) {
    return visualTokens.actionTokens.flatMap(item => [
      typographyToken(item.korean, { typeface: "korean", size, function: "content", role: "action-keyword" }),
      typographyToken(item.english, { typeface: "english", size, function: "content", role: "action-keyword" }),
      typographyToken(item.chinese, { typeface: "chinese", size, function: "content", role: "action-keyword" })
    ]);
  }

  function hanjaTypographyTokens(size) {
    return visualTokens.hanjaKeywords.map(value => typographyToken(value, {
      typeface: "hanja",
      size,
      function: "content",
      role: "display-keyword"
    }));
  }

  function largeTypographyTokens() {
    const reservedForMedium = new Set(["STATUS", "REPORT", "MODULE"]);
    const reservedForXlarge = new Set(["접속", "검증", "출력", "ACCESS", "OUTPUT"]);
    return [
      ...visualTokens.koreanKeywords
        .filter(value => !reservedForXlarge.has(value))
        .map(value => typographyToken(value, { typeface: "korean", size: "large", function: "content", role: "display-keyword" })),
      ...visualTokens.englishKeywords
        .filter(value => !reservedForMedium.has(value) && !reservedForXlarge.has(value))
        .map(value => typographyToken(value, { typeface: "english", size: "large", function: "content", role: "display-keyword" })),
      ...hanjaTypographyTokens("large"),
      ...actionTypographyTokens("large"),
      ...todayDateTypographyTokens(generationDate())
    ];
  }

  function xlargeTypographyTokens() {
    return visualTokens.greetingTokens.map(item => typographyToken(item.value, {
      typeface: item.typeface,
      size: "xlarge",
      function: "sign",
      role: "greeting"
    }));
  }

  function xxlargeTypographyTokens() {
    const heroKorean = visualTokens.koreanKeywords
      .filter(value => ["접속", "검증", "출력"].includes(value))
      .map(value => typographyToken(value, { typeface: "korean", size: "xxlarge", function: "content", role: "hero-keyword" }));
    const heroEnglish = visualTokens.englishKeywords
      .filter(value => ["ACCESS", "OUTPUT"].includes(value))
      .map(value => typographyToken(value, { typeface: "english", size: "xxlarge", function: "content", role: "hero-keyword" }));
    return [
      ...heroKorean,
      ...heroEnglish,
      ...hanjaTypographyTokens("xxlarge"),
      ...actionTypographyTokens("xxlarge")
    ];
  }

  function xxxlargeTypographyTokens() {
    return xxlargeTypographyTokens().map(item => typographyToken(item.value, {
      typeface: item.typeface,
      size: "xxxlarge",
      function: item.function,
      role: item.role
    }));
  }

  function createTypographyTokenGroups() {
    const organizations = visualTokens.organizationPrefixes.map((prefix, index) => {
      const suffix = visualTokens.organizationSuffixes[index % visualTokens.organizationSuffixes.length];
      return typographyToken(`@${prefix} ${suffix}`, {
        typeface: "english",
        size: "small",
        function: "content",
        role: "organization"
      });
    });
    const tableTokens = visualTokens.tableFieldLabels.map((labelName, index) => typographyToken(
      `${labelName} ${index % 3 === 0 ? integer(10, 99) : index % 3 === 1 ? `${integer(1, 99)}%` : codeToken()}`,
      { typeface: "mono", size: "small", function: "data", role: "table-cell" }
    ));
    const statusCodeTokens = visualTokens.statusCodes.map((value, index) => typographyToken(value, {
      typeface: "mono",
      size: index % 2 === 0 ? "small" : "medium",
      function: "sign",
      role: "status-code"
    }));
    const small = [
      ...organizations,
      ...tableTokens,
      ...statusCodeTokens.filter(item => item.size === "small"),
      typographyToken("V1.2", { typeface: "mono", size: "small", function: "data", role: "version" }),
      typographyToken("REV A", { typeface: "mono", size: "small", function: "data", role: "revision" }),
      typographyToken("BUILD 859", { typeface: "mono", size: "small", function: "data", role: "build" }),
      typographyToken("SN 3886-9487-TC", { typeface: "mono", size: "small", function: "data", role: "serial" }),
      typographyToken("PORT 117", { typeface: "mono", size: "small", function: "data", role: "port-caption" }),
      typographyToken("LOT C2", { typeface: "mono", size: "small", function: "data", role: "lot" }),
      typographyToken("LAT 50MS", { typeface: "mono", size: "small", function: "data", role: "latency" }),
      typographyToken("CODE 0X7F", { typeface: "mono", size: "small", function: "data", role: "code-caption" }),
      typographyToken("MOD P31 / PORT 97", { typeface: "mono", size: "small", function: "data", role: "port-caption" })
    ];
    const medium = [
      ...statusCodeTokens.filter(item => item.size === "medium"),
      typographyToken("STATUS", { typeface: "english", size: "medium", function: "sign", role: "status" }),
      typographyToken("REPORT", { typeface: "english", size: "medium", function: "content", role: "section-label" }),
      typographyToken("MODULE", { typeface: "english", size: "medium", function: "content", role: "section-label" }),
      typographyToken("INPUT VERIFIED", { typeface: "english", size: "medium", function: "sign", role: "verification" }),
      typographyToken("OUTPUT OK", { typeface: "english", size: "medium", function: "sign", role: "verification" }),
      typographyToken("ACCESS GRANTED", { typeface: "english", size: "medium", function: "sign", role: "access-status" }),
      typographyToken("QC PASS", { typeface: "english", size: "medium", function: "sign", role: "verification" }),
      typographyToken("RUNNING", { typeface: "english", size: "medium", function: "sign", role: "status" }),
      typographyToken("MICRO GRAPHIC", { typeface: "english", size: "medium", function: "content", role: "title" }),
      typographyToken("검증 완료", { typeface: "korean", size: "medium", function: "sign", role: "verification" }),
      typographyToken("출력 대기", { typeface: "korean", size: "medium", function: "sign", role: "status" })
    ];
    const large = [...largeTypographyTokens()];
    const xlarge = [
      ...xlargeTypographyTokens(),
      typographyToken(codeToken(), { typeface: "mono", size: "xlarge", function: "data", role: "hero-code" })
    ];
    const xxlarge = [...xxlargeTypographyTokens()];
    const xxxlarge = [...xxxlargeTypographyTokens()];
    return { small, medium, large, xlarge, xxlarge, xxxlarge };
  }

  function createGraphicTokenDescriptors() {
    const sizedGraphic = base => {
      const size = pick(GRAPHIC_TOKEN_SIZES);
      const scale = GRAPHIC_SIZE_SCALE[size];
      return {
        size,
        intrinsic: { width: base.width * scale, height: base.height * scale }
      };
    };
    const barcodeToken = sizedGraphic({ width: 96, height: 38 });
    const tableToken = sizedGraphic({ width: 96, height: 48 });
    const waveToken = sizedGraphic({ width: 84, height: 42 });
    const pseudoQrToken = sizedGraphic({ width: 48, height: 48 });
    const statusLabelToken = { size: "medium", intrinsic: { width: 84, height: 28 } };
    const metadataBadgeToken = { size: "medium", intrinsic: { width: measureBadgeWidth("REV A"), height: 21 } };
    return [
      { form: "graphic", graphicType: "barcode", function: "data", role: "barcode", size: barcodeToken.size, intrinsic: barcodeToken.intrinsic },
      { form: "graphic", graphicType: "table", function: "data", role: "table", size: tableToken.size, intrinsic: tableToken.intrinsic },
      { form: "graphic", graphicType: "wave", function: "data", role: "wave", size: waveToken.size, intrinsic: waveToken.intrinsic },
      { form: "graphic", graphicType: "pseudo-qr", function: "data", role: "pseudo-qr", size: pseudoQrToken.size, intrinsic: pseudoQrToken.intrinsic },
      { form: "graphic", graphicType: "status-label", function: "sign", role: "status-label", size: statusLabelToken.size, intrinsic: statusLabelToken.intrinsic },
      { form: "graphic", graphicType: "metadata-badge", function: "sign", role: "metadata-badge", size: metadataBadgeToken.size, intrinsic: metadataBadgeToken.intrinsic }
    ];
  }

  function createCategoryDefinitions() {
    const typography = Object.values(createTypographyTokenGroups()).flat();
    const graphics = createGraphicTokenDescriptors();
    return [
      { id: "typography-content", label: "TYPOGRAPHY / CONTENT", shortLabel: "TYPE CONTENT", form: "typography", function: "content", items: typography.filter(item => item.function === "content") },
      { id: "typography-data", label: "TYPOGRAPHY / DATA", shortLabel: "TYPE DATA", form: "typography", function: "data", items: typography.filter(item => item.function === "data") },
      { id: "typography-symbol", label: "TYPOGRAPHY / SYMBOL", shortLabel: "TYPE SYMBOL", form: "typography", function: "symbol", items: typography.filter(item => item.function === "symbol") },
      { id: "typography-sign", label: "TYPOGRAPHY / SIGN", shortLabel: "TYPE SIGN", form: "typography", function: "sign", items: typography.filter(item => item.function === "sign") },
      { id: "graphic-content", label: "GRAPHIC / CONTENT", shortLabel: "GRAPHIC CONTENT", form: "graphic", function: "content", items: graphics.filter(item => item.function === "content") },
      { id: "graphic-data", label: "GRAPHIC / DATA", shortLabel: "GRAPHIC DATA", form: "graphic", function: "data", items: graphics.filter(item => item.function === "data") },
      { id: "graphic-symbol", label: "GRAPHIC / SYMBOL", shortLabel: "GRAPHIC SYMBOL", form: "graphic", function: "symbol", items: graphics.filter(item => item.function === "symbol") },
      { id: "graphic-sign", label: "GRAPHIC / SIGN", shortLabel: "GRAPHIC SIGN", form: "graphic", function: "sign", items: graphics.filter(item => item.function === "sign") }
    ];
  }

  return {
    createCategoryDefinitions,
    createGraphicTokenDescriptors,
    createTypographyTokenGroups
  };
}
