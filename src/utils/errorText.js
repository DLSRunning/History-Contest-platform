const CHINESE_TEXT_RE = /[\u4e00-\u9fff]/;

function mapTechnicalTextToChinese(text, fallback) {
  const raw = String(text || '').trim();
  if (!raw) return fallback;
  const lower = raw.toLowerCase();

  if (lower.includes('xlsx_runtime_unsupported')) {
    return '当前环境不支持该操作，请在浏览器中重试';
  }
  if (
    lower.includes('network error')
    || lower.includes('failed to fetch')
    || lower.includes('econnrefused')
    || lower.includes('econnreset')
    || lower.includes('enotfound')
    || lower.includes('err_network')
  ) {
    return '网络连接异常，请稍后重试';
  }
  if (
    lower.includes('timeout')
    || lower.includes('timed out')
    || lower.includes('econnaborted')
    || lower.includes('etimedout')
  ) {
    return '请求超时，请稍后重试';
  }
  if (lower.includes('canceled') || lower.includes('cancelled') || lower.includes('aborted')) {
    return '请求已取消，请重试';
  }
  if (lower.includes('request failed with status code')) {
    return fallback;
  }

  return '';
}

function sanitizeForUser(text, fallback) {
  const raw = String(text || '').trim();
  if (!raw) return fallback;
  if (CHINESE_TEXT_RE.test(raw)) return raw;

  const mapped = mapTechnicalTextToChinese(raw, fallback);
  if (mapped) return mapped;

  if (/^\d{3}(\D|$)/.test(raw)) return fallback;
  if (/^[A-Z0-9_.-]{3,}$/.test(raw)) return fallback;
  if (/[a-z]/i.test(raw)) return fallback;
  return fallback;
}

function extractDetail(data) {
  if (!data) return '';

  const detail = data.detail;
  if (Array.isArray(detail)) {
    const text = detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join('；');
    if (text) return text;
  }
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  return '';
}

export function getUserFriendlyErrorText(error, fallback = '请求失败，请稍后重试') {
  if (!error) return fallback;

  const responseData = error?.response?.data;
  const responseText = extractDetail(responseData);
  if (responseText) return sanitizeForUser(responseText, fallback);

  const rawMessage = String(error?.message || '').trim();
  if (rawMessage) return sanitizeForUser(rawMessage, fallback);

  const code = String(error?.code || '').trim();
  if (code) return sanitizeForUser(code, fallback);

  return fallback;
}

export function toUserFriendlyError(error, fallback = '请求失败，请稍后重试') {
  return new Error(getUserFriendlyErrorText(error, fallback));
}
