import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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

const STUDY_STATUS_OPTIONS = [
  { value: 'in_school', label: '在读' },
  { value: 'not_in_school', label: '非在读' },
];

const GRADE_OPTIONS = ['本科生', '研究生', '博士生'];
const REGISTER_DRAFT_STORAGE_KEY = 'contest_register_draft_v1';

function normalizePhone(phone) {
  return String(phone || '').trim();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
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
    if (draft.study_status !== 'in_school' && draft.study_status !== 'not_in_school') {
      draft.study_status = 'in_school';
    }
    if (draft.study_status === 'in_school') draft.occupation = '';
    if (draft.study_status === 'not_in_school') {
      draft.school = '';
      draft.major = '';
      draft.grade = '';
    }
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
  const onStudyStatusChange = (e) => {
    const nextStatus = String(e.target.value || '');
    setFormData((prev) => ({
      ...prev,
      study_status: nextStatus,
      occupation: nextStatus === 'in_school' ? '' : prev.occupation,
    }));
  };

  const sendCode = async () => {
    const phone = normalizePhone(formData.phone);
    const email = normalizeEmail(formData.email);
    if (!phone) {
      setMsg({ type: 'error', content: '请先填写手机号' });
      return;
    }

    try {
      setCodeBtnDisabled(true);
      const payload = email ? { phone, email } : { phone };
      const res = await sendSignUpVerificationCode(payload);
      const debugCode = String(res?.debug_code || res?.data?.debug_code || '').trim();
      setMsg({
        type: 'success',
        content: debugCode ? `验证码已发送（调试码：${debugCode}）` : `验证码已发送至 ${phone}`,
      });

      let left = 60;
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

  const submit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', content: '' });

    const payload = {
      username: String(formData.username || '').trim(),
      phone: normalizePhone(formData.phone),
      verify_code: String(formData.verify_code || '').trim(),
      email: normalizeEmail(formData.email),
      study_status: String(formData.study_status || 'in_school').trim(),
      occupation: String(formData.occupation || '').trim(),
      school: String(formData.school || '').trim(),
      major: String(formData.major || '').trim(),
      grade: String(formData.grade || '').trim(),
      password: String(formData.password || ''),
    };

    if (!payload.username || !payload.phone || !payload.verify_code || !payload.email || !payload.password) {
      setMsg({ type: 'error', content: '请完整填写注册信息' });
      return;
    }
    if (payload.study_status === 'in_school' && (!payload.school || !payload.major || !payload.grade)) {
      setMsg({ type: 'error', content: '在读用户需填写学校、专业、年级' });
      return;
    }
    if (payload.study_status === 'not_in_school' && !payload.occupation) {
      setMsg({ type: 'error', content: '非在读用户请填写职业' });
      return;
    }
    if (payload.study_status === 'not_in_school') {
      payload.school = '';
      payload.major = '';
      payload.grade = '';
    }

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
                  select
                  label="在读状态*"
                  value={formData.study_status}
                  onChange={onStudyStatusChange}
                  fullWidth
                  size="small"
                  sx={INPUT_SX}
                >
                  {STUDY_STATUS_OPTIONS.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </TextField>
                {formData.study_status === 'not_in_school' && (
                  <TextField
                    label="职业*"
                    placeholder="请输入职业"
                    value={formData.occupation}
                    onChange={set('occupation')}
                    fullWidth
                    size="small"
                    sx={INPUT_SX}
                  />
                )}
                {formData.study_status === 'in_school' && (
                  <>
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
                      label="专业*"
                      placeholder="请输入专业名称"
                      value={formData.major}
                      onChange={set('major')}
                      fullWidth
                      size="small"
                      sx={INPUT_SX}
                    />
                    <TextField select label="年级*" value={formData.grade} onChange={set('grade')} fullWidth size="small" sx={INPUT_SX}>
                      {GRADE_OPTIONS.map((item) => (
                        <MenuItem key={item} value={item}>
                          {item}
                        </MenuItem>
                      ))}
                    </TextField>
                  </>
                )}
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
    </Box>
  );
}
