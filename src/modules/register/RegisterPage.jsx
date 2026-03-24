import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { getCurrentUserProfile, sendSignUpVerificationCode, submitSignUp } from './api';
import { contestRuntimeConfig } from '../../config/contestRuntimeConfig';

const INPUT_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: '#f3f6fc',
  },
  '& .MuiInputLabel-root': {
    color: '#445175',
  },
};

const EMPTY_FORM = {
  username: '',
  phone: '',
  verify_code: '',
  email: '',
  study_status: 'in_school',
  occupation: '',
  school: '',
  major: '',
  grade: '',
  password: '',
};

const MAJOR_CATEGORY_OPTIONS = [
  '中国古代史',
  '中国近现代史',
  '世界史',
  '考古学',
  '文博',
  '区域国别',
  '哲学',
  '政治学',
  '其它',
];
const GRADE_OPTIONS = ['本科生', '研究生', '博士生'];
const REGISTER_DRAFT_STORAGE_KEY = 'contest_register_draft_v1';
const EMAIL_REGEX = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
const DEFAULT_SMS_EXPIRE_SECONDS = 60;

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return EMAIL_REGEX.test(normalizeEmail(email));
}

function resolveSmsExpireSeconds(responseData, fallback = DEFAULT_SMS_EXPIRE_SECONDS) {
  const raw = Number(responseData?.expires_in ?? responseData?.data?.expires_in ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.floor(raw));
}

function normalizePath(path) {
  const raw = String(path || '/').trim();
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  return raw;
}

function resolveNextPath(search = '') {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const rawNext = String(params.get('next') || '').trim();
  if (!rawNext || !rawNext.startsWith('/')) return '';
  if (rawNext.startsWith('//')) return '';
  try {
    const parsed = new URL(rawNext, window.location.origin);
    if (parsed.origin !== window.location.origin) return '';
    return `${normalizePath(parsed.pathname)}${parsed.search || ''}`;
  } catch {
    return '';
  }
}

function pickDraftFromForm(formData) {
  return {
    username: String(formData.username || ''),
    phone: String(formData.phone || ''),
    email: String(formData.email || ''),
    study_status: String(formData.study_status || 'in_school'),
    occupation: String(formData.occupation || ''),
    school: String(formData.school || ''),
    major: String(formData.major || ''),
    grade: String(formData.grade || ''),
  };
}

function parseDraft(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const draft = pickDraftFromForm(parsed);
    draft.study_status = 'in_school';
    draft.occupation = '';
    return draft;
  } catch {
    return null;
  }
}

export default function RegisterPage({ search = '', onNavigate, onSuccess }) {
  const loginPageUrl = String(contestRuntimeConfig.route?.loginPageUrl || '/login').trim() || '/login';
  const homePageUrl = String(contestRuntimeConfig.route?.homeUrl || '/').trim() || '/';
  const nextPath = resolveNextPath(search);
  const loginTarget = nextPath
    ? `${loginPageUrl}${loginPageUrl.includes('?') ? '&' : '?'}next=${encodeURIComponent(nextPath)}`
    : loginPageUrl;
  const postSignUpTarget = nextPath || normalizePath(homePageUrl);
  const goTo = (target) => {
    if (typeof onNavigate === 'function') {
      onNavigate(target);
      return;
    }
    window.location.href = target;
  };
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', content: '' });
  const [codeBtnText, setCodeBtnText] = useState('获取验证码');
  const [codeBtnDisabled, setCodeBtnDisabled] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState(null);

  useEffect(() => {
    try {
      const draft = parseDraft(window.sessionStorage.getItem(REGISTER_DRAFT_STORAGE_KEY));
      if (!draft) return;
      setFormData((prev) => ({
        ...prev,
        ...draft,
        verify_code: '',
        password: '',
      }));
    } catch {
      // ignore restore draft errors
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        REGISTER_DRAFT_STORAGE_KEY,
        JSON.stringify(pickDraftFromForm(formData)),
      );
    } catch {
      // ignore save draft errors
    }
  }, [
    formData.username,
    formData.phone,
    formData.email,
    formData.study_status,
    formData.occupation,
    formData.school,
    formData.major,
    formData.grade,
  ]);

  const set = (k) => (e) => setFormData((prev) => ({ ...prev, [k]: e.target.value }));

  const sendCode = async () => {
    const phone = normalizePhone(formData.phone);
    const email = normalizeEmail(formData.email);
    if (!phone) {
      setMsg({ type: 'error', content: '请先填写手机号' });
      return;
    }
    if (email && !isValidEmail(email)) {
      setMsg({ type: 'error', content: '邮箱格式不正确，请检查后重试' });
      return;
    }

    try {
      setCodeBtnDisabled(true);
      const payload = email ? { phone, email } : { phone };
      const res = await sendSignUpVerificationCode(payload);
      const expireSeconds = resolveSmsExpireSeconds(res);
      const debugCode = String(res?.debug_code || res?.data?.debug_code || '').trim();
      setMsg({
        type: 'success',
        content: debugCode
          ? `验证码已发送（调试码：${debugCode}，${expireSeconds}秒内有效）`
          : `验证码已发送至 ${phone}（${expireSeconds}秒内有效）`,
      });

      let left = expireSeconds;
      setCodeBtnText(`${left}秒后重试`);
      const timer = setInterval(() => {
        left -= 1;
        setCodeBtnText(`${left}秒后重试`);
        if (left <= 0) {
          clearInterval(timer);
          setCodeBtnText('获取验证码');
          setCodeBtnDisabled(false);
        }
      }, 1000);
    } catch (error) {
      setMsg({ type: 'error', content: error.message });
      setCodeBtnDisabled(false);
      setCodeBtnText('获取验证码');
    }
  };

  const submitRegister = async (payload) => {
    setLoading(true);
    try {
      await submitSignUp(payload);
      const currentUser = await getCurrentUserProfile();
      try {
        window.sessionStorage.removeItem(REGISTER_DRAFT_STORAGE_KEY);
      } catch {
        // ignore clear draft errors
      }
      setMsg({ type: 'success', content: '注册成功，正在进入系统...' });
      setTimeout(() => {
        if (typeof onSuccess === 'function') {
          onSuccess(currentUser || null, postSignUpTarget);
          return;
        }
        goTo(postSignUpTarget);
      }, 300);
    } catch (error) {
      setMsg({ type: 'error', content: error.message });
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', content: '' });

    const payload = {
      username: String(formData.username || '').trim(),
      phone: normalizePhone(formData.phone),
      verify_code: String(formData.verify_code || '').trim(),
      email: normalizeEmail(formData.email),
      study_status: 'in_school',
      occupation: '',
      school: String(formData.school || '').trim(),
      major: String(formData.major || '').trim(),
      grade: String(formData.grade || '').trim(),
      password: String(formData.password || ''),
    };

    if (!payload.username || !payload.phone || !payload.verify_code || !payload.email || !payload.password) {
      setMsg({ type: 'error', content: '请完整填写注册信息' });
      return;
    }
    if (!isValidEmail(payload.email)) {
      setMsg({ type: 'error', content: '邮箱格式不正确，请检查后重试' });
      return;
    }
    if (payload.study_status === 'in_school' && (!payload.school || !payload.major || !payload.grade)) {
      setMsg({ type: 'error', content: '就读用户需填写学校、专业、年级' });
      return;
    }

    setPendingPayload(payload);
    setConfirmOpen(true);
  };

  const closeConfirmDialog = () => {
    if (loading) return;
    setConfirmOpen(false);
    setPendingPayload(null);
  };

  const confirmRegister = async () => {
    if (!pendingPayload || loading) return;
    setConfirmOpen(false);
    await submitRegister(pendingPayload);
    setPendingPayload(null);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        px: 2,
        py: { xs: 4, sm: 6 },
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(circle at top, #f0e6ff 0%, #eef2fb 40%, #e9edf6 100%)',
      }}
    >
      <Card
        sx={{
          width: '100%',
          maxWidth: 560,
          borderRadius: '18px',
          border: '1px solid #d7deea',
          boxShadow: '0 10px 28px rgba(45, 61, 89, 0.12)',
          backgroundColor: '#f8f9fc',
        }}
      >
        <CardContent sx={{ px: { xs: 2.5, sm: 4 }, py: { xs: 3, sm: 4 } }}>
          <Stack spacing={2.5}>
            <Typography sx={{ fontSize: { xs: 30, sm: 38 }, fontWeight: 800, lineHeight: 1.1 }}>
              账号注册
            </Typography>
            <Typography sx={{ color: '#41557b', fontSize: 15 }}>
              请填写以下信息完成注册
            </Typography>

            {msg.content && <Alert severity={msg.type}>{msg.content}</Alert>}

            <Box component="form" onSubmit={submit}>
              <Stack spacing={2}>
                <TextField
                  label="用户名*"
                  placeholder="请填写真实姓名"
                  value={formData.username}
                  onChange={set('username')}
                  fullWidth
                  size="small"
                  sx={INPUT_SX}
                />
                <TextField
                  label="手机号*"
                  placeholder="请输入手机号"
                  value={formData.phone}
                  onChange={set('phone')}
                  fullWidth
                  size="small"
                  sx={INPUT_SX}
                />
                <TextField
                  label="手机验证码*"
                  placeholder="6位数字"
                  value={formData.verify_code}
                  onChange={set('verify_code')}
                  fullWidth
                  size="small"
                  sx={INPUT_SX}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button
                            onClick={sendCode}
                            disabled={codeBtnDisabled}
                            size="small"
                            sx={{ color: '#31456a', fontSize: 14, minWidth: 'fit-content' }}
                          >
                            {codeBtnText}
                          </Button>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  label="邮箱*"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={set('email')}
                  fullWidth
                  size="small"
                  sx={INPUT_SX}
                />
                <TextField
                  label="密码*"
                  type="password"
                  value={formData.password}
                  onChange={set('password')}
                  fullWidth
                  size="small"
                  sx={INPUT_SX}
                />
                <TextField
                  label="学校*"
                  placeholder="请输入学校名称"
                  value={formData.school}
                  onChange={set('school')}
                  fullWidth
                  size="small"
                  sx={INPUT_SX}
                />
                <TextField
                  select
                  label="专业*"
                  value={formData.major}
                  onChange={set('major')}
                  fullWidth
                  size="small"
                  sx={INPUT_SX}
                >
                  {[...new Set([...MAJOR_CATEGORY_OPTIONS, String(formData.major || '').trim()].filter(Boolean))].map((item) => (
                    <MenuItem key={item} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField select label="年级*" value={formData.grade} onChange={set('grade')} fullWidth size="small" sx={INPUT_SX}>
                  {GRADE_OPTIONS.map((item) => (
                    <MenuItem key={item} value={item}>
                      {item}
                    </MenuItem>
                  ))}
                </TextField>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{
                    borderRadius: '12px',
                    py: 1.1,
                    fontSize: 18,
                    fontWeight: 700,
                    background: 'linear-gradient(180deg, #2f3b59 0%, #10192f 100%)',
                    boxShadow: '0 2px 0 #0a1022, inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}
                >
                  {loading ? '注册中...' : '注册'}
                </Button>

                <Typography align="center" sx={{ color: '#1f2b41', fontSize: 16 }}>
                  已有账号？
                  <Button
                    variant="text"
                    onClick={() => {
                      goTo(loginTarget);
                    }}
                    sx={{ ml: 0.5, p: 0, minWidth: 'fit-content', fontSize: 16, textDecoration: 'underline' }}
                  >
                    前往登录
                  </Button>
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
      <Dialog
        open={confirmOpen}
        onClose={closeConfirmDialog}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>确认注册信息</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            请确认手机号与邮箱。注册后当前版本暂不支持修改这两项信息。
          </DialogContentText>
          <Typography sx={{ color: '#1f2b41', fontSize: 14, lineHeight: 1.8 }}>
            手机号：{pendingPayload?.phone || '-'}
          </Typography>
          <Typography sx={{ color: '#1f2b41', fontSize: 14, lineHeight: 1.8 }}>
            邮箱：{pendingPayload?.email || '-'}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeConfirmDialog} disabled={loading}>
            返回修改
          </Button>
          <Button onClick={confirmRegister} variant="contained" disabled={loading}>
            {loading ? '注册中...' : '确认注册'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
