import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PhoneEnabledRoundedIcon from '@mui/icons-material/PhoneEnabledRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { getCurrentUser, login, loginWithSmsCode, sendSmsLoginCode } from '../../../api';
import { contestRuntimeConfig } from '../../../config/contestRuntimeConfig';
import { getUserFriendlyErrorText } from '../../../utils/errorText';

const INPUT_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: '#eef2fb',
  },
  '& .MuiInputLabel-root': {
    color: '#445175',
  },
};
const DEFAULT_SMS_EXPIRE_SECONDS = 60;

function resolveSmsExpireSeconds(responseData, fallback = DEFAULT_SMS_EXPIRE_SECONDS) {
  const raw = Number(responseData?.expires_in ?? responseData?.data?.expires_in ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.floor(raw));
}

function DividerWithText({ text = '或者' }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: '100%', pt: 0.5 }}>
      <Box sx={{ flex: 1, height: '1px', backgroundColor: '#d7deea' }} />
      <Typography sx={{ color: '#4a5875', fontSize: 14, minWidth: 'fit-content' }}>{text}</Typography>
      <Box sx={{ flex: 1, height: '1px', backgroundColor: '#d7deea' }} />
    </Stack>
  );
}

export default function LoginPage({ onSuccess, setMessage, registerUrl = '', onNavigate }) {
  const agreementConfig = contestRuntimeConfig.agreement || {};
  const registerPageUrl = String(registerUrl || contestRuntimeConfig.route?.registerPageUrl || '/sign-up').trim() || '/sign-up';
  const agreementRequired = !!agreementConfig.requiredOnLogin;
  const agreementTitle = String(agreementConfig.title || '用户协议').trim();
  const agreementPromptText = String(agreementConfig.promptText || '我已阅读并同意').trim();
  const agreementLinkText = String(agreementConfig.linkText || '《用户协议》').trim();
  const agreementContent = String(agreementConfig.content || '暂无协议内容').trim();

  const [mode, setMode] = useState('password');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [agreement, setAgreement] = useState(false);
  const [agreementDialogOpen, setAgreementDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [smsCodeSending, setSmsCodeSending] = useState(false);
  const goTo = (targetPath) => {
    if (typeof onNavigate === 'function') {
      onNavigate(targetPath);
      return;
    }
    window.location.href = targetPath;
  };

  const ensureAgreementAccepted = () => {
    if (agreementRequired && !agreement) {
      setMessage({ type: 'warning', text: `请先勾选并同意${agreementTitle}` });
      return false;
    }
    return true;
  };

  const handlePasswordLogin = async () => {
    const normalizedAccount = String(account || '').trim();
    if (!normalizedAccount || !password) {
      setMessage({ type: 'warning', text: '请填写账号和密码' });
      return;
    }
    if (!ensureAgreementAccepted()) return;

    setLoading(true);
    try {
      await login(normalizedAccount, password);
      const currentUser = await getCurrentUser();
      if (!currentUser?.email) {
        throw new Error('登录状态校验失败');
      }
      setMessage({ type: 'success', text: '登录成功' });
      onSuccess(currentUser);
    } catch (error) {
      setMessage({ type: 'error', text: getUserFriendlyErrorText(error, '登录失败，请检查账号或稍后重试') });
    } finally {
      setLoading(false);
    }
  };

  const handleSendSmsCode = async () => {
    const normalizedPhone = String(phone || '').trim();
    if (!normalizedPhone) {
      setMessage({ type: 'warning', text: '请先输入手机号' });
      return;
    }
    setSmsCodeSending(true);
    try {
      const resp = await sendSmsLoginCode(normalizedPhone);
      const expireSeconds = resolveSmsExpireSeconds(resp);
      const debugCode = String(resp?.debug_code || resp?.data?.debug_code || '').trim();
      setMessage({
        type: 'success',
        text: debugCode
          ? `验证码已发送（调试码：${debugCode}，${expireSeconds}秒内有效）`
          : `验证码已发送至 ${normalizedPhone}（${expireSeconds}秒内有效）`,
      });
    } catch (error) {
      setMessage({ type: 'error', text: getUserFriendlyErrorText(error, '验证码发送失败，请稍后重试') });
    } finally {
      setSmsCodeSending(false);
    }
  };

  const handleSmsLogin = async () => {
    const normalizedPhone = String(phone || '').trim();
    const normalizedCode = String(verifyCode || '').trim();
    if (!normalizedPhone || !normalizedCode) {
      setMessage({ type: 'warning', text: '请先输入手机号和验证码' });
      return;
    }
    if (!ensureAgreementAccepted()) return;
    setLoading(true);
    try {
      await loginWithSmsCode(normalizedPhone, normalizedCode);
      const currentUser = await getCurrentUser();
      if (!currentUser?.email) {
        throw new Error('登录状态校验失败');
      }
      setMessage({ type: 'success', text: '登录成功' });
      onSuccess(currentUser);
    } catch (error) {
      setMessage({ type: 'error', text: getUserFriendlyErrorText(error, '登录失败，请稍后重试') });
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
      <Stack spacing={3} sx={{ width: '100%', maxWidth: 520 }}>
        <Typography
          align="center"
          sx={{
            fontSize: { xs: 38, sm: 52 },
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            background: 'linear-gradient(90deg, #5f1ea2 0%, #a95de8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          数智文献比赛系统
        </Typography>

        <Card
          sx={{
            borderRadius: '18px',
            border: '1px solid #d7deea',
            boxShadow: '0 10px 28px rgba(45, 61, 89, 0.12)',
            backgroundColor: '#f8f9fc',
          }}
        >
          <CardContent sx={{ px: { xs: 2.5, sm: 4 }, py: { xs: 3, sm: 4 } }}>
            <Stack spacing={2.25}>
              <Typography sx={{ fontSize: { xs: 34, sm: 44 }, fontWeight: 800, lineHeight: 1.1 }}>
                {mode === 'password' ? '账号密码登录' : '手机号验证码登录'}
              </Typography>

              {mode === 'password' ? (
                <>
                  <TextField
                    label="账号（邮箱/手机号）"
                    value={account}
                    onChange={(e) => setAccount(e.target.value)}
                    fullWidth
                    size="small"
                    sx={INPUT_SX}
                  />
                  <TextField
                    label="密码"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    size="small"
                    sx={INPUT_SX}
                  />
                </>
              ) : (
                <>
                  <TextField
                    label="手机号"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    fullWidth
                    size="small"
                    sx={INPUT_SX}
                  />
                  <TextField
                    label="手机验证码"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    fullWidth
                    size="small"
                    sx={INPUT_SX}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <Button
                              onClick={handleSendSmsCode}
                              disabled={smsCodeSending}
                              size="small"
                              sx={{ color: '#31456a', fontSize: 14, minWidth: 'fit-content' }}
                            >
                              {smsCodeSending ? '发送中...' : '获取验证码'}
                            </Button>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </>
              )}

              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                <Checkbox checked={agreement} onChange={(e) => setAgreement(e.target.checked)} size="small" sx={{ p: 0.25 }} />
                <Typography sx={{ color: '#263246', fontSize: 15 }}>{agreementPromptText}</Typography>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => setAgreementDialogOpen(true)}
                  sx={{ p: 0, minWidth: 'fit-content', fontSize: 15, textDecoration: 'underline' }}
                >
                  {agreementLinkText}
                </Button>
              </Stack>

              <Dialog open={agreementDialogOpen} onClose={() => setAgreementDialogOpen(false)} fullWidth maxWidth="sm">
                <DialogTitle>{agreementTitle}</DialogTitle>
                <DialogContent dividers>
                  <Typography sx={{ whiteSpace: 'pre-wrap', color: '#223048', fontSize: 14, lineHeight: 1.8 }}>
                    {agreementContent}
                  </Typography>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setAgreementDialogOpen(false)}>关闭</Button>
                </DialogActions>
              </Dialog>

              <Button
                variant="contained"
                disabled={loading}
                onClick={mode === 'password' ? handlePasswordLogin : handleSmsLogin}
                sx={{
                  borderRadius: '12px',
                  py: 1.1,
                  fontSize: 18,
                  fontWeight: 700,
                  background: 'linear-gradient(180deg, #2f3b59 0%, #10192f 100%)',
                  boxShadow: '0 2px 0 #0a1022, inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                {loading ? '登录中...' : '登录'}
              </Button>

              {mode === 'password' ? (
                <>
                  <Typography align="center" sx={{ color: '#1f2b41', fontSize: 16 }}>
                    还没有账号？
                    <Button
                      variant="text"
                      onClick={() => {
                        goTo(registerPageUrl);
                      }}
                      sx={{ ml: 0.5, p: 0, minWidth: 'fit-content', fontSize: 16, textDecoration: 'underline' }}
                    >
                      前往注册
                    </Button>
                  </Typography>
                  <DividerWithText text="或者" />
                  <Button
                    variant="outlined"
                    onClick={() => setMode('sms')}
                    startIcon={<PhoneEnabledRoundedIcon />}
                    sx={{
                      borderRadius: '12px',
                      py: 1,
                      borderColor: '#c8d1e2',
                      color: '#1f2b41',
                      fontSize: 16,
                    }}
                  >
                    使用手机号验证码登录
                  </Button>
                </>
              ) : (
                <>
                  <DividerWithText text="或者" />
                  <Button
                    variant="outlined"
                    onClick={() => setMode('password')}
                    startIcon={<PersonRoundedIcon />}
                    sx={{
                      borderRadius: '12px',
                      py: 1,
                      borderColor: '#c8d1e2',
                      color: '#1f2b41',
                      fontSize: 16,
                    }}
                  >
                    使用账号密码登录
                  </Button>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
