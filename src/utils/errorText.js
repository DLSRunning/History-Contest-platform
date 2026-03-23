const CHINESE_TEXT_RE = /[\u4e00-\u9fff]/;

function mapAuthErrorToChinese(text, status = 0) {
  const raw = String(text || '').trim();
  if (!raw) {
    if (Number(status) === 401) return '登录已失效，请重新登录';
    return '';
  }

  const lower = raw.toLowerCase();
  const knownAuthErrors = (
    lower.includes('缺少 access_token')
    || lower.includes('missing access_token')
    || lower.includes('无效的 access_token')
    || lower.includes('invalid access_token')
    || lower.includes('access_token 已过期')
    || lower.includes('access_token expired')
    || lower.includes('token has expired')
    || lower.includes('用户不存在或已失效')
    || lower.includes('user not found or inactive')
  );

  if (knownAuthErrors) {
    return '登录已失效，请重新登录';
  }
  return '';
}

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
  // 去掉前缀错误码/异常名，只保留用户可读正文
  const cleaned = raw
    .replace(/^(http(exception|error)\s*[:：]\s*)/i, '')
    .replace(/^(\d{3}\s*[:：]\s*)+/, '')
    .trim();
  if (!cleaned) return fallback;
  if (CHINESE_TEXT_RE.test(cleaned)) return cleaned;

  const mapped = mapTechnicalTextToChinese(cleaned, fallback);
  if (mapped) return mapped;

  if (/^\d{3}(\D|$)/.test(cleaned)) return fallback;
  if (/^[A-Z0-9_.-]{3,}$/.test(cleaned)) return fallback;
  if (/[a-z]/i.test(cleaned)) return fallback;
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

  const status = Number(error?.response?.status || 0);
  if (status === 413) return '上传文件过大，请压缩后重试';
  if (status === 408 || status === 504) return '上传超时，请稍后重试';
  if (status === 502 || status === 503) return '服务暂时不可用，请稍后重试';

  const responseData = error?.response?.data;
  const responseText = extractDetail(responseData);
  if (responseText) {
    const authText = mapAuthErrorToChinese(responseText, status);
    if (authText) return authText;
    return sanitizeForUser(responseText, fallback);
  }

  const rawMessage = String(error?.message || '').trim();
  if (rawMessage) {
    const authText = mapAuthErrorToChinese(rawMessage, status);
    if (authText) return authText;
    return sanitizeForUser(rawMessage, fallback);
  }

  if (status === 401) return '登录已失效，请重新登录';

  const code = String(error?.code || '').trim();
  if (code) return sanitizeForUser(code, fallback);

  return fallback;
}

export function toUserFriendlyError(error, fallback = '请求失败，请稍后重试') {
  return new Error(getUserFriendlyErrorText(error, fallback));
}
