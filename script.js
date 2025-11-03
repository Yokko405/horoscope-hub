const API_ENDPOINT = 'https://horoscope-api.vercel.app/api';
const API_DEFAULT_DAY = 'today';
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const CACHE_NAMESPACE = 'horoscope-hub:fortune';
const LAST_SIGN_KEY = 'horoscope-hub:last-sign';

const zodiacSigns = [
  {
    name: '牡羊座',
    english: 'Aries',
    start: { month: 3, day: 21 },
    end: { month: 4, day: 19 },
  },
  {
    name: '牡牛座',
    english: 'Taurus',
    start: { month: 4, day: 20 },
    end: { month: 5, day: 20 },
  },
  {
    name: '双子座',
    english: 'Gemini',
    start: { month: 5, day: 21 },
    end: { month: 6, day: 21 },
  },
  {
    name: '蟹座',
    english: 'Cancer',
    start: { month: 6, day: 22 },
    end: { month: 7, day: 22 },
  },
  {
    name: '獅子座',
    english: 'Leo',
    start: { month: 7, day: 23 },
    end: { month: 8, day: 22 },
  },
  {
    name: '乙女座',
    english: 'Virgo',
    start: { month: 8, day: 23 },
    end: { month: 9, day: 22 },
  },
  {
    name: '天秤座',
    english: 'Libra',
    start: { month: 9, day: 23 },
    end: { month: 10, day: 23 },
  },
  {
    name: '蠍座',
    english: 'Scorpio',
    start: { month: 10, day: 24 },
    end: { month: 11, day: 22 },
  },
  {
    name: '射手座',
    english: 'Sagittarius',
    start: { month: 11, day: 23 },
    end: { month: 12, day: 21 },
  },
  {
    name: '山羊座',
    english: 'Capricorn',
    start: { month: 12, day: 22 },
    end: { month: 1, day: 19 },
  },
  {
    name: '水瓶座',
    english: 'Aquarius',
    start: { month: 1, day: 20 },
    end: { month: 2, day: 18 },
  },
  {
    name: '魚座',
    english: 'Pisces',
    start: { month: 2, day: 19 },
    end: { month: 3, day: 20 },
  },
];

const fallbackSuggestions = {
  Aries: {
    color: 'フレイムレッド',
    action: '朝一番に短いストレッチでエネルギーを整える',
  },
  Taurus: {
    color: 'フォレストグリーン',
    action: 'お気に入りの香りでリラックスする時間を取る',
  },
  Gemini: {
    color: 'アクアブルー',
    action: '気になっていた人にメッセージを送ってみる',
  },
  Cancer: {
    color: 'ムーンホワイト',
    action: '温かい飲み物をゆっくり味わって心を整える',
  },
  Leo: {
    color: 'サンゴールド',
    action: '鏡の前で今日の目標を声に出して宣言する',
  },
  Virgo: {
    color: 'セージグリーン',
    action: 'デスク周りを5分だけ整えて集中力を高める',
  },
  Libra: {
    color: 'ローズピンク',
    action: 'お気に入りの音楽を流しながら姿勢を正す',
  },
  Scorpio: {
    color: 'ワインレッド',
    action: '深呼吸を3回行い、意識を内側に向ける',
  },
  Sagittarius: {
    color: 'ロイヤルパープル',
    action: '気になっていた本や記事を開いて視野を広げる',
  },
  Capricorn: {
    color: 'チャコールグレー',
    action: '今日のタスクを紙に書き出して優先順位を付ける',
  },
  Aquarius: {
    color: 'ターコイズ',
    action: '新しいアイデアをメモアプリに残しておく',
  },
  Pisces: {
    color: 'ディープブルー',
    action: '好きな音楽を聴きながら5分だけ瞑想する',
  },
};

function safeStorageGet(key) {
  try {
    return window.localStorage ? window.localStorage.getItem(key) : null;
  } catch (error) {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    if (window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch (error) {
    // Ignore quota/security failures
  }
}

function safeStorageRemove(key) {
  try {
    if (window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch (error) {
    // Ignore quota/security failures
  }
}

function getCacheKey(sign) {
  return `${CACHE_NAMESPACE}:${sign.english.toLowerCase()}:${API_DEFAULT_DAY}`;
}

function loadCachedFortune(sign) {
  const key = getCacheKey(sign);
  const raw = safeStorageGet(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      safeStorageRemove(key);
      return null;
    }

    const { timestamp, fortune } = parsed;
    if (typeof timestamp !== 'number' || !fortune) {
      safeStorageRemove(key);
      return null;
    }

    if (Date.now() - timestamp > CACHE_TTL_MS) {
      safeStorageRemove(key);
      return null;
    }

    return fortune;
  } catch (error) {
    safeStorageRemove(key);
    return null;
  }
}

function saveFortuneToCache(sign, fortune) {
  const key = getCacheKey(sign);
  const payload = {
    timestamp: Date.now(),
    fortune,
  };
  safeStorageSet(key, JSON.stringify(payload));
}

function rememberLastSign(sign) {
  safeStorageSet(LAST_SIGN_KEY, sign.english);
}

function restoreLastSign() {
  const english = safeStorageGet(LAST_SIGN_KEY);
  if (!english) {
    return null;
  }
  return zodiacSigns.find((sign) => sign.english === english) ?? null;
}

function isWithinRange(month, day, sign) {
  const { start, end } = sign;
  const current = month * 100 + day;
  const startValue = start.month * 100 + start.day;
  const endValue = end.month * 100 + end.day;

  if (startValue <= endValue) {
    return current >= startValue && current <= endValue;
  }

  return current >= startValue || current <= endValue;
}

function formatDateParts(parts) {
  return `${parts.month}月${parts.day}日`;
}

function formatRange(sign) {
  return `期間: ${formatDateParts(sign.start)} - ${formatDateParts(sign.end)}`;
}

function findZodiac(month, day) {
  return zodiacSigns.find((sign) => isWithinRange(month, day, sign));
}

function getValueAtPath(target, path) {
  if (!target || typeof target !== 'object') {
    return undefined;
  }

  const segments = Array.isArray(path) ? path : String(path).split('.');
  return segments.reduce((value, key) => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    return value[key];
  }, target);
}

function firstStringFromSources(sources, paths) {
  for (const source of sources) {
    for (const path of paths) {
      const candidate = getValueAtPath(source, path);
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }
  return '';
}

function parseScoreValue(raw) {
  if (raw == null) {
    return null;
  }

  let value = raw;

  if (typeof value === 'string') {
    const normalised = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const parsed = Number.parseFloat(normalised);
    if (Number.isNaN(parsed)) {
      return null;
    }
    value = parsed;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  if (value > 5) {
    if (value <= 100) {
      value /= 20;
    } else {
      value /= 100;
    }
  }

  if (value < 0) {
    value = 0;
  }

  if (value > 5) {
    value = 5;
  }

  return Number(value.toFixed(2));
}

function firstScoreFromSources(sources, paths) {
  for (const source of sources) {
    for (const path of paths) {
      const candidate = getValueAtPath(source, path);
      const score = parseScoreValue(candidate);
      if (typeof score === 'number') {
        return score;
      }
    }
  }
  return null;
}

function createSources(payload) {
  const sources = [];
  const queue = [payload];

  while (queue.length > 0) {
    const value = queue.shift();
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      continue;
    }

    sources.push(value);

    for (const key of Object.keys(value)) {
      const nested = value[key];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        queue.push(nested);
      }
    }
  }

  return sources;
}

function formatTodayFallback(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long' }).format(date);
  } catch (error) {
    return date.toLocaleDateString('ja-JP');
  }
}

function formatDisplayDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return formatTodayFallback();
  }

  const trimmed = dateString.trim();
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.valueOf())) {
    return formatTodayFallback(parsed);
  }

  return trimmed;
}

function createFallbackFortune(sign) {
  const label = sign?.name ?? 'あなた';
  const suggestion = sign ? fallbackSuggestions[sign.english] : undefined;
  return {
    overall: `${label}の直感が冴える一日。気になったことには素早く行動すると流れをつかめます。`,
    love: `${label}の優しさが伝わるタイミング。小さな感謝を言葉にしてみましょう。`,
    work: `${label}の集中力が高まる日。最初にタスクの優先順位を整えると効率的に進められます。`,
    money: `${label}の堅実さが光ります。日常のルーティンを整えることで運気の底上げに。`,
    color: suggestion?.color ?? 'ミッドナイトブルー',
    action: suggestion?.action ?? '寝る前に今日の感謝を3つメモする',
    scores: {
      overall: null,
      love: null,
      work: null,
      money: null,
    },
  };
}

function normaliseHoroscopePayload(payload, sign) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const sources = createSources(payload);
  const fallback = createFallbackFortune(sign);

  const overall =
    firstStringFromSources(sources, [
      'overall',
      'general',
      'general_text',
      'description',
      'prediction',
      'horoscope',
    ]) || fallback.overall;

  const love =
    firstStringFromSources(sources, [
      'love',
      'love.text',
      'romance',
      'romance_text',
      'love_prediction',
    ]) || fallback.love;

  const work =
    firstStringFromSources(sources, [
      'work',
      'career',
      'career_text',
      'business',
      'professional',
    ]) || fallback.work;

  const money =
    firstStringFromSources(sources, [
      'money',
      'finance',
      'financial',
      'wealth',
      'money_text',
    ]) || fallback.money;

  const color =
    firstStringFromSources(sources, [
      'color',
      'lucky_color',
      'luckyColour',
      'luckycolour',
    ]) || fallback.color;

  const actionCandidate = firstStringFromSources(sources, [
    'lucky_action',
    'action',
    'lucky_activity',
    'luckyAction',
  ]);
  const luckyTime = firstStringFromSources(sources, [
    'lucky_time',
    'luckyTime',
    'lucky_hour',
  ]);

  const action =
    actionCandidate ||
    (luckyTime ? `ラッキータイムは「${luckyTime}」。その時間帯に動くとチャンスをつかめます。` : fallback.action);

  const dateText =
    firstStringFromSources(sources, [
      'current_date',
      'date',
      'today',
      'meta.date',
      'metadata.date',
    ]) || new Date().toISOString();

  const overallScore =
    firstScoreFromSources(sources, [
      'overall_score',
      'overall.score',
      'overall.rating',
      'score',
      'general_score',
      'general.rating',
      'general.score',
    ]) ?? fallback.scores.overall;

  const loveScore =
    firstScoreFromSources(sources, [
      'love_score',
      'love.score',
      'love.rating',
      'romance_score',
      'romance.rating',
    ]) ?? fallback.scores.love;

  const workScore =
    firstScoreFromSources(sources, [
      'work_score',
      'work.score',
      'work.rating',
      'career_score',
      'career.rating',
    ]) ?? fallback.scores.work;

  const moneyScore =
    firstScoreFromSources(sources, [
      'money_score',
      'money.score',
      'money.rating',
      'finance_score',
      'financial.rating',
      'wealth.score',
    ]) ?? fallback.scores.money;

  return {
    date: formatDisplayDate(dateText),
    overall,
    love,
    work,
    money,
    color,
    action,
    scores: {
      overall: overallScore,
      love: loveScore,
      work: workScore,
      money: moneyScore,
    },
  };
}

function formatApiUrl(sign) {
  const url = new URL(API_ENDPOINT);
  url.searchParams.set('sign', sign.english.toLowerCase());
  url.searchParams.set('day', API_DEFAULT_DAY);
  return url.toString();
}

async function fetchHoroscope(sign) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(formatApiUrl(sign), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch horoscope: ${response.status}`);
    }

    const payload = await response.json();
    const normalised = normaliseHoroscopePayload(payload, sign);
    if (!normalised) {
      throw new Error('Invalid horoscope payload');
    }

    return normalised;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('リクエストがタイムアウトしました。時間をおいて再度お試しください。');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function initFortuneChecker() {
  const form = document.getElementById('birth-form');
  const input = document.getElementById('birthdate');
  const submitButton = form?.querySelector("button[type='submit']");
  const resultSection = document.getElementById('fortune-result');
  const loader = document.getElementById('fortune-loading');
  const errorNode = document.getElementById('fortune-error');
  const refreshButton = document.getElementById('fortune-refresh');
  const zodiacNameNode = document.getElementById('zodiac-name');
  const zodiacRangeNode = document.getElementById('zodiac-range');
  const dateNode = document.getElementById('fortune-date');
  const statusNode = document.getElementById('fortune-status');
  const overallNode = document.getElementById('fortune-overall');
  const loveNode = document.getElementById('fortune-love');
  const workNode = document.getElementById('fortune-work');
  const moneyNode = document.getElementById('fortune-money');
  const colorNode = document.getElementById('fortune-color');
  const actionNode = document.getElementById('fortune-action');
  const overallScoreNode = document.getElementById('fortune-overall-score');
  const overallScoreMeter = document.getElementById('fortune-overall-score-meter');
  const overallScoreText = document.getElementById('fortune-overall-score-text');
  const loveScoreNode = document.getElementById('fortune-love-score');
  const loveScoreMeter = document.getElementById('fortune-love-score-meter');
  const loveScoreText = document.getElementById('fortune-love-score-text');
  const workScoreNode = document.getElementById('fortune-work-score');
  const workScoreMeter = document.getElementById('fortune-work-score-meter');
  const workScoreText = document.getElementById('fortune-work-score-text');
  const moneyScoreNode = document.getElementById('fortune-money-score');
  const moneyScoreMeter = document.getElementById('fortune-money-score-meter');
  const moneyScoreText = document.getElementById('fortune-money-score-text');
  const zodiacCards = Array.from(document.querySelectorAll('.zodiac-card[data-sign]'));

  if (
    !form ||
    !input ||
    !submitButton ||
    !resultSection ||
    !loader ||
    !errorNode ||
    !refreshButton ||
    !zodiacNameNode ||
    !zodiacRangeNode ||
    !dateNode ||
    !statusNode ||
    !overallNode ||
    !loveNode ||
    !workNode ||
    !moneyNode ||
    !colorNode ||
    !actionNode ||
    !overallScoreNode ||
    !overallScoreMeter ||
    !overallScoreText ||
    !loveScoreNode ||
    !loveScoreMeter ||
    !loveScoreText ||
    !workScoreNode ||
    !workScoreMeter ||
    !workScoreText ||
    !moneyScoreNode ||
    !moneyScoreMeter ||
    !moneyScoreText
  ) {
    return;
  }

  let lastSign = null;
  let lastBirth = null;
  let activeCard = null;
  const zodiacCardMap = new Map(
    zodiacCards.map((card) => [card.dataset.sign, card])
  );
  refreshButton.disabled = true;
  setStatus('');

  function setStatus(message) {
    if (!message) {
      statusNode.textContent = '';
      statusNode.hidden = true;
      return;
    }
    statusNode.textContent = message;
    statusNode.hidden = false;
  }

  function parseBirthdate(value) {
    const segments = value.split('-').map((segment) => Number.parseInt(segment, 10));
    if (segments.length !== 3 || segments.some(Number.isNaN)) {
      return null;
    }
    const [, month, day] = segments;
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    return { month, day };
  }

  function highlightSign(sign) {
    const targetCard = sign ? zodiacCardMap.get(sign.english) : null;
    if (activeCard && activeCard !== targetCard) {
      activeCard.classList.remove('is-active');
    }
    if (targetCard) {
      targetCard.classList.add('is-active');
      activeCard = targetCard;
    } else {
      activeCard = null;
    }
  }

  function setLoading(isLoading) {
    loader.hidden = !isLoading;
    submitButton.disabled = isLoading;
    refreshButton.disabled = isLoading || !lastSign;
    if (isLoading) {
      resultSection.hidden = true;
      setStatus('');
    }
  }

  function hideError() {
    errorNode.hidden = true;
    errorNode.textContent = '';
  }

  function showError(message) {
    setStatus('');
    errorNode.textContent = message;
    errorNode.hidden = false;
    resultSection.hidden = true;
  }

  function renderSign(sign) {
    highlightSign(sign);
    zodiacNameNode.textContent = `${sign.name} (${sign.english})`;
    zodiacRangeNode.textContent = formatRange(sign);
  }

  function updateScoreDisplay(wrapper, meter, textNode, value) {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      meter.value = value;
      meter.setAttribute('value', String(value));
      textNode.textContent = `スコア ${value.toFixed(1)} / 5`;
      wrapper.hidden = false;
    } else {
      textNode.textContent = '';
      wrapper.hidden = true;
    }
  }

  function renderFortune(sign, fortune, options = {}) {
    const { fromCache = false, statusMessage = '' } = options;
    renderSign(sign);
    dateNode.textContent = `今日の占い: ${fortune.date}`;
    overallNode.textContent = fortune.overall;
    loveNode.textContent = fortune.love;
    workNode.textContent = fortune.work;
    moneyNode.textContent = fortune.money;
    colorNode.textContent = fortune.color;
    actionNode.textContent = fortune.action;
    updateScoreDisplay(overallScoreNode, overallScoreMeter, overallScoreText, fortune.scores?.overall ?? null);
    updateScoreDisplay(loveScoreNode, loveScoreMeter, loveScoreText, fortune.scores?.love ?? null);
    updateScoreDisplay(workScoreNode, workScoreMeter, workScoreText, fortune.scores?.work ?? null);
    updateScoreDisplay(moneyScoreNode, moneyScoreMeter, moneyScoreText, fortune.scores?.money ?? null);
    resultSection.dataset.status = fromCache ? 'cached' : 'fresh';
    if (statusMessage) {
      setStatus(statusMessage);
    } else if (fromCache) {
      setStatus('キャッシュされた占い結果を表示中です。');
    } else {
      setStatus('最新の占い結果を取得しました。');
    }
    refreshButton.disabled = false;
    rememberLastSign(sign);
    resultSection.hidden = false;
  }

  async function handleFortuneRequest(sign, options = {}) {
    const { bypassCache = false } = options;
    hideError();

    if (!bypassCache) {
      const cachedFortune = loadCachedFortune(sign);
      if (cachedFortune) {
        renderFortune(sign, cachedFortune, {
          fromCache: true,
          statusMessage: 'キャッシュされた占い結果を表示中です。',
        });
        return;
      }
    }

    setLoading(true);
    try {
      const fortune = await fetchHoroscope(sign);
      saveFortuneToCache(sign, fortune);
      renderFortune(sign, fortune, {
        fromCache: false,
        statusMessage: '最新の占い結果を取得しました。',
      });
    } catch (error) {
      const fallback = createFallbackFortune(sign);
      const friendlyMessage =
        error.message && error.message.startsWith('Failed to fetch')
          ? '占いAPIへの接続に失敗しました。時間をおいて再度お試しください。'
          : error.message || '占い結果の取得に失敗しました。時間をおいて再度お試しください。';
      showError(friendlyMessage);
      renderFortune(sign, {
        date: formatTodayFallback(),
        overall: fallback.overall,
        love: fallback.love,
        work: fallback.work,
        money: fallback.money,
        color: fallback.color,
        action: fallback.action,
        scores: fallback.scores,
      }, {
        fromCache: false,
        statusMessage: '占いAPIから取得できなかったため、代替メッセージを表示しています。',
      });
    } finally {
      setLoading(false);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!input.value) {
      showError('生年月日を入力してください。');
      input.focus();
      return;
    }

    const birthdate = parseBirthdate(input.value);
    if (!birthdate) {
      showError('生年月日の形式が正しくありません。');
      input.focus();
      return;
    }

    const sign = findZodiac(birthdate.month, birthdate.day);
    if (!sign) {
      showError('星座が判定できませんでした。入力内容をご確認ください。');
      return;
    }

    lastSign = sign;
    lastBirth = birthdate;
    hideError();
    renderSign(sign);
    handleFortuneRequest(sign);
  });

  refreshButton.addEventListener('click', () => {
    if (!lastSign) {
      return;
    }
    hideError();
    handleFortuneRequest(lastSign, { bypassCache: true });
  });

  input.addEventListener('change', () => {
    if (!input.value || !lastBirth) {
      return;
    }

    const parsed = parseBirthdate(input.value);
    if (!parsed) {
      return;
    }

    if (parsed.month === lastBirth.month && parsed.day === lastBirth.day) {
      return;
    }

    const sign = findZodiac(parsed.month, parsed.day);
    if (!sign) {
      return;
    }

    lastSign = sign;
    lastBirth = parsed;
    hideError();
    renderSign(sign);
    handleFortuneRequest(sign);
  });

  zodiacCards.forEach((card) => {
    card.addEventListener('click', (event) => {
      event.preventDefault();
      const english = card.dataset.sign;
      if (!english) {
        return;
      }

      const sign = zodiacSigns.find((item) => item.english === english);
      if (!sign) {
        return;
      }

      lastSign = sign;
      lastBirth = null;
      input.value = '';
      hideError();
      renderSign(sign);
      handleFortuneRequest(sign);
      const section = document.getElementById('fortune-checker');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  const restoredSign = restoreLastSign();
  if (restoredSign) {
    lastSign = restoredSign;
    hideError();
    renderSign(restoredSign);
    handleFortuneRequest(restoredSign);
  }
}

document.addEventListener('DOMContentLoaded', initFortuneChecker);
