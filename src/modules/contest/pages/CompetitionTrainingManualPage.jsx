import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid2,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import CloseIcon from '@mui/icons-material/Close';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  createRequestId,
  deleteCompetitionTrainingManualAsset,
  deleteCompetitionTrainingManualContent,
  getCompetitionTrainingManualContent,
  getCompetitionTrainingManualMeta,
  uploadCompetitionTrainingManualAsset,
  upsertCompetitionTrainingManualContent,
} from '../../../api';
import { getUserFriendlyErrorText } from '../../../utils/errorText';

const BLOCK_TYPES = ['text', 'image', 'video'];
const MANUAL_MODES = ['local', 'feishu'];
const DEFAULT_TRAINING_MANUAL_LIMITS = {
  title: 200,
  // 兼容保留：当前页面不提供摘要编辑入口，仅用于兼容后端字段与历史数据。
  summary: 10000,
  blocks: 50,
  // 兼容保留：当前页面不提供区块标题编辑入口，仅用于兼容后端字段与历史数据。
  blockTitle: 120,
  text: 5000,
  url: 1000,
  caption: 500,
  allowExternalUrl: true,
  uploadImageMaxSizeMb: 10,
  uploadVideoMaxSizeMb: 500,
  uploadImageExts: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'],
  uploadVideoExts: ['mp4', 'webm', 'mov', 'm4v', 'ogg'],
  uploadEnforceMimePrefix: true,
  feishuAllowedDomains: ['feishu.cn', 'larksuite.com'],
};

function normalizePath(path) {
  const raw = String(path || '/').trim();
  if (!raw) return '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

function toSafeText(value) {
  return String(value || '').trim();
}

function toRawText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : null;
}

function isHttpUrl(value) {
  const text = toSafeText(value);
  if (!text) return false;
  try {
    const parsed = new URL(text);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function fileExt(fileName = '') {
  const text = String(fileName || '').trim();
  if (!text.includes('.')) return '';
  return text.split('.').pop().trim().toLowerCase();
}

function normalizeExtensions(rawValue, fallback = []) {
  const source = Array.isArray(rawValue)
    ? rawValue
    : String(rawValue || '').split(',');
  const normalized = [];
  source.forEach((item) => {
    const token = String(item || '').trim().toLowerCase().replace(/^\./, '');
    if (!token) return;
    if (!normalized.includes(token)) normalized.push(token);
  });
  return normalized.length ? normalized : [...fallback];
}

function buildUploadAccept(exts = [], fallback = '') {
  const normalized = normalizeExtensions(exts, []);
  if (!normalized.length) return fallback;
  return normalized.map((item) => `.${item}`).join(',');
}

function formatBytes(size) {
  const value = Number(size);
  if (!Number.isFinite(value) || value <= 0) return '-';
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)}KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)}MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

function normalizeTrainingManualLimits(raw = {}) {
  const asPositiveInt = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(1, Math.floor(parsed));
  };
  return {
    title: asPositiveInt(raw?.title_max_length, DEFAULT_TRAINING_MANUAL_LIMITS.title),
    summary: asPositiveInt(raw?.summary_max_length, DEFAULT_TRAINING_MANUAL_LIMITS.summary),
    blocks: asPositiveInt(raw?.max_blocks, DEFAULT_TRAINING_MANUAL_LIMITS.blocks),
    blockTitle: asPositiveInt(raw?.block_title_max_length, DEFAULT_TRAINING_MANUAL_LIMITS.blockTitle),
    text: asPositiveInt(raw?.text_block_max_length, DEFAULT_TRAINING_MANUAL_LIMITS.text),
    url: asPositiveInt(raw?.url_max_length, DEFAULT_TRAINING_MANUAL_LIMITS.url),
    caption: asPositiveInt(raw?.caption_max_length, DEFAULT_TRAINING_MANUAL_LIMITS.caption),
    allowExternalUrl: raw?.allow_external_url !== false,
    uploadImageMaxSizeMb: asPositiveInt(
      raw?.image_upload_max_size_mb,
      DEFAULT_TRAINING_MANUAL_LIMITS.uploadImageMaxSizeMb
    ),
    uploadVideoMaxSizeMb: asPositiveInt(
      raw?.video_upload_max_size_mb,
      DEFAULT_TRAINING_MANUAL_LIMITS.uploadVideoMaxSizeMb
    ),
    uploadImageExts: normalizeExtensions(
      raw?.image_upload_allowed_extensions,
      DEFAULT_TRAINING_MANUAL_LIMITS.uploadImageExts
    ),
    uploadVideoExts: normalizeExtensions(
      raw?.video_upload_allowed_extensions,
      DEFAULT_TRAINING_MANUAL_LIMITS.uploadVideoExts
    ),
    uploadEnforceMimePrefix: raw?.upload_enforce_mime_prefix !== false,
    feishuAllowedDomains: normalizeExtensions(
      raw?.feishu_allowed_domains,
      DEFAULT_TRAINING_MANUAL_LIMITS.feishuAllowedDomains
    ),
  };
}

function normalizeManualMode(value) {
  const normalized = toSafeText(value).toLowerCase();
  if (MANUAL_MODES.includes(normalized)) return normalized;
  return 'local';
}

function isAllowedFeishuUrl(value, allowedDomains = DEFAULT_TRAINING_MANUAL_LIMITS.feishuAllowedDomains) {
  const text = toSafeText(value);
  if (!text) return false;
  if (!isHttpUrl(text)) return false;
  try {
    const host = String(new URL(text).hostname || '').trim().toLowerCase();
    if (!host) return false;
    const domains = normalizeExtensions(allowedDomains, DEFAULT_TRAINING_MANUAL_LIMITS.feishuAllowedDomains);
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function createEmptyBlock(type = 'text') {
  return {
    type,
    title: '',
    text: '',
    url: '',
    asset_id: null,
    asset_url: '',
    asset_name: '',
    asset_size: 0,
    asset_mime: '',
    caption: '',
  };
}

function normalizeBlock(raw = {}) {
  const type = BLOCK_TYPES.includes(String(raw?.type || '').trim()) ? String(raw.type).trim() : 'text';
  return {
    type,
    title: toRawText(raw?.title),
    text: toRawText(raw?.text),
    url: toRawText(raw?.url),
    asset_id: toPositiveInt(raw?.asset_id),
    asset_url: toSafeText(raw?.asset_url),
    asset_name: toSafeText(raw?.asset_name),
    asset_size: Number(raw?.asset_size || 0),
    asset_mime: toSafeText(raw?.asset_mime),
    caption: toRawText(raw?.caption),
  };
}

function normalizeBlocks(rawBlocks = []) {
  if (!Array.isArray(rawBlocks)) return [];
  return rawBlocks.map((item) => normalizeBlock(item));
}

function countTextChars(rawBlocks = []) {
  const blocks = normalizeBlocks(rawBlocks);
  return blocks.reduce((total, block) => {
    if (block.type !== 'text') return total;
    return total + String(block.text || '').length;
  }, 0);
}

function toContentForm(data = {}) {
  return {
    enabled: data?.enabled === true || Number(data?.enabled) === 1,
    manual_mode: normalizeManualMode(data?.manual_mode),
    title: toSafeText(data?.title),
    summary: toSafeText(data?.summary),
    feishu_url: toSafeText(data?.feishu_url),
    blocks: normalizeBlocks(data?.blocks || []),
  };
}

function toPayloadBlocks(rawBlocks = []) {
  return normalizeBlocks(rawBlocks).map((block) => {
    if (block.type === 'text') {
      return {
        type: block.type,
        title: '',
        text: block.text,
        url: '',
        asset_id: null,
        caption: block.caption,
      };
    }
    const normalizedAssetId = toPositiveInt(block.asset_id);
    const normalizedUrl = toSafeText(block.url);
    const useExternalUrl = !normalizedAssetId && Boolean(normalizedUrl);
    return {
      type: block.type,
      title: '',
      text: block.text,
      url: useExternalUrl ? normalizedUrl : '',
      asset_id: useExternalUrl ? null : (normalizedAssetId || null),
      caption: block.caption,
    };
  });
}

function handleMarkdownTabKey(event, currentValue, onUpdate) {
  if (event?.key !== 'Tab') return;
  const textarea = event?.target;
  if (
    !textarea
    || typeof textarea.selectionStart !== 'number'
    || typeof textarea.selectionEnd !== 'number'
  ) {
    return;
  }
  if (typeof onUpdate !== 'function') return;

  event.preventDefault();

  const indent = '    ';
  const value = String(currentValue || '');
  const start = Math.max(0, Number(textarea.selectionStart || 0));
  const end = Math.max(0, Number(textarea.selectionEnd || 0));
  const isOutdent = event.shiftKey === true;

  const commit = (nextValue, nextStart, nextEnd = nextStart) => {
    onUpdate(nextValue);
    requestAnimationFrame(() => {
      try {
        textarea.setSelectionRange(nextStart, nextEnd);
      } catch {
        // ignore
      }
    });
  };

  if (!isOutdent) {
    if (start === end) {
      const nextValue = `${value.slice(0, start)}${indent}${value.slice(end)}`;
      commit(nextValue, start + indent.length);
      return;
    }

    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndRaw = value.indexOf('\n', end);
    const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
    const selectedBlock = value.slice(lineStart, lineEnd);
    const lines = selectedBlock.split('\n');
    const indentedBlock = lines.map((line) => `${indent}${line}`).join('\n');
    const nextValue = `${value.slice(0, lineStart)}${indentedBlock}${value.slice(lineEnd)}`;
    const nextStart = start + indent.length;
    const nextEnd = end + (indent.length * lines.length);
    commit(nextValue, nextStart, nextEnd);
    return;
  }

  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const lineEndRaw = value.indexOf('\n', end);
  const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
  const selectedBlock = value.slice(lineStart, lineEnd);
  const lines = selectedBlock.split('\n');

  const outdentLine = (line) => {
    if (!line) return { text: line, removed: 0 };
    if (line.startsWith('\t')) return { text: line.slice(1), removed: 1 };
    let removed = 0;
    while (removed < indent.length && removed < line.length && line[removed] === ' ') {
      removed += 1;
    }
    return { text: line.slice(removed), removed };
  };

  let removedFirst = 0;
  let removedTotal = 0;
  const outdentedLines = lines.map((line, idx) => {
    const { text, removed } = outdentLine(line);
    if (idx === 0) removedFirst = removed;
    removedTotal += removed;
    return text;
  });

  if (removedTotal <= 0) return;

  const nextBlock = outdentedLines.join('\n');
  const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
  if (start === end) {
    const nextCursor = Math.max(lineStart, start - removedFirst);
    commit(nextValue, nextCursor);
    return;
  }
  const nextStart = Math.max(lineStart, start - removedFirst);
  const nextEnd = Math.max(nextStart, end - removedTotal);
  commit(nextValue, nextStart, nextEnd);
}

function formatTime(raw) {
  if (!raw) return '-';
  const dt = dayjs(raw);
  return dt.isValid() ? dt.format('YYYY-MM-DD HH:mm:ss') : '-';
}

function MarkdownText({ content }) {
  return (
    <Box
      sx={{
        '& p': { my: 1, lineHeight: 1.75 },
        '& h1': { fontSize: { xs: 18, sm: 20 }, fontWeight: 800, my: 1.2, lineHeight: 1.4 },
        '& h2': { fontSize: { xs: 17, sm: 18 }, fontWeight: 800, my: 1.15, lineHeight: 1.4 },
        '& h3': { fontSize: { xs: 16, sm: 17 }, fontWeight: 700, my: 1.1, lineHeight: 1.45 },
        '& h4': { fontSize: { xs: 15, sm: 16 }, fontWeight: 700, my: 1.05, lineHeight: 1.45 },
        '& h5': { fontSize: 15, fontWeight: 700, my: 1, lineHeight: 1.5 },
        '& h6': { fontSize: 14, fontWeight: 700, my: 1, lineHeight: 1.5 },
        '& ul, & ol': { pl: 3.5, my: 1.2 },
        '& li': { mb: 0.4, lineHeight: 1.7 },
        '& blockquote': {
          borderLeft: '4px solid #ceb7ef',
          pl: 1.5,
          ml: 0,
          color: 'text.secondary',
          fontStyle: 'italic',
        },
        '& code': {
          px: 0.5,
          py: 0.1,
          borderRadius: 1,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          backgroundColor: '#f1e8ff',
        },
        '& pre': {
          p: 1.2,
          borderRadius: 2,
          overflow: 'auto',
          backgroundColor: '#f1e8ff',
        },
        '& a': { color: '#5f3d8c' },
        '& hr': { border: 0, borderTop: '1px solid #dfd0f3', my: 2 },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {String(content || '')}
      </ReactMarkdown>
    </Box>
  );
}

function resolveMediaSource(block = {}) {
  return toSafeText(block.url || block.asset_url);
}

function BlockPreview({ block, showAssetMeta = false }) {
  if (block.type === 'text') {
    return (
      <Stack spacing={1}>
        {!!toSafeText(block.text) ? (
          <MarkdownText content={block.text} />
        ) : (
          <Typography color="text.secondary">-</Typography>
        )}
      </Stack>
    );
  }

  const source = resolveMediaSource(block);
  const hasAsset = Boolean(toPositiveInt(block.asset_id));
  const assetText = hasAsset
    ? `本地资源：${block.asset_name || `#${block.asset_id}`}${Number(block.asset_size) > 0 ? `（${formatBytes(block.asset_size)}）` : ''}`
    : '';

  if (block.type === 'image') {
    if (!source) {
      return (
        <Stack spacing={1}>
          <Alert severity="info">请上传图片或填写外链 URL 后预览</Alert>
          {!!block.caption && <Typography color="text.secondary">{block.caption}</Typography>}
        </Stack>
      );
    }
    return (
      <Stack spacing={1}>
        <Box
          component="img"
          src={source}
          alt={block.caption || '比赛手册图片'}
          sx={{
            width: '100%',
            maxHeight: 560,
            objectFit: 'contain',
            borderRadius: 2,
            border: '1px solid #e5dff1',
            backgroundColor: '#ffffff',
          }}
        />
        {showAssetMeta && !!assetText && <Typography variant="caption" color="text.secondary">{assetText}</Typography>}
        {!!block.caption && <Typography color="text.secondary">{block.caption}</Typography>}
      </Stack>
    );
  }

  if (!source) {
    return (
      <Stack spacing={1}>
        <Alert severity="info">请上传视频或填写外链 URL 后预览</Alert>
        {!!block.caption && <Typography color="text.secondary">{block.caption}</Typography>}
      </Stack>
    );
  }
  return (
    <Stack spacing={1}>
      <Box
        component="video"
        controls
        preload="metadata"
        src={source}
        sx={{
          width: '100%',
          maxHeight: 560,
          borderRadius: 2,
          border: '1px solid #e5dff1',
          backgroundColor: '#120e1a',
        }}
      />
      {showAssetMeta && !!assetText && <Typography variant="caption" color="text.secondary">{assetText}</Typography>}
      {!!block.caption && <Typography color="text.secondary">{block.caption}</Typography>}
    </Stack>
  );
}

function TrainingManualDocumentContent({ blocks }) {
  const normalizedBlocks = Array.isArray(blocks) ? blocks.map((block) => normalizeBlock(block)) : [];
  if (!normalizedBlocks.length) {
    return <Alert severity="warning">暂无区块内容，保存启用前请至少添加一个区块。</Alert>;
  }
  return (
    <Stack spacing={2.5}>
      {normalizedBlocks.map((block, index) => (
        <Box key={`doc_block_${index}`}>
          <BlockPreview block={block} />
        </Box>
      ))}
    </Stack>
  );
}

function BlockEditor({
  block,
  index,
  limits = DEFAULT_TRAINING_MANUAL_LIMITS,
  disabled = false,
  uploading = false,
  onChange,
  onRemove,
  onUploadAsset,
  onClearAsset,
}) {
  const update = (key, value) => {
    if (typeof onChange !== 'function') return;
    onChange(index, { ...block, [key]: value });
  };

  const hasAsset = Boolean(toPositiveInt(block.asset_id));
  const hasExternalUrl = !hasAsset && Boolean(toSafeText(block.url));
  const mediaAccept = block.type === 'image'
    ? buildUploadAccept(limits.uploadImageExts, 'image/*')
    : buildUploadAccept(limits.uploadVideoExts, 'video/*');

  return (
    <Card sx={{ border: '1px solid #e5d9f6', borderRadius: 2.5, boxShadow: 'none', background: '#fdfbff' }}>
      <CardContent sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontWeight: 700 }}>内容区块 #{index + 1}</Typography>
            <Button
              size="small"
              color="error"
              disabled={disabled || uploading}
              onClick={() => typeof onRemove === 'function' && onRemove(index)}
            >
              删除区块
            </Button>
          </Stack>
          <TextField
            select
            size="small"
            label="区块类型"
            value={block.type}
            disabled={disabled || uploading}
            onChange={(event) => {
              const nextType = String(event.target.value || 'text');
              const nextBlock = normalizeBlock({ ...block, type: nextType });
              if (nextType !== block.type) {
                nextBlock.asset_id = null;
                nextBlock.asset_url = '';
                nextBlock.asset_name = '';
                nextBlock.asset_size = 0;
                nextBlock.asset_mime = '';
              }
              if (nextType === 'text') {
                nextBlock.url = '';
              }
              if (nextType !== 'text' && block.type === 'text') {
                nextBlock.text = '';
              }
              if (typeof onChange === 'function') {
                onChange(index, nextBlock);
              }
            }}
          >
            <MenuItem value="text">文字</MenuItem>
            <MenuItem value="image">图片</MenuItem>
            <MenuItem value="video">视频</MenuItem>
          </TextField>
          {block.type === 'text' ? (
            <TextField
              multiline
              minRows={5}
              label="文字内容（Markdown）"
              value={block.text}
              disabled={disabled || uploading}
              inputProps={{ maxLength: limits.text }}
              helperText={`${String(block.text || '').length}/${limits.text}`}
              onChange={(event) => update('text', event.target.value)}
              onKeyDown={(event) => {
                handleMarkdownTabKey(event, block.text, (nextValue) => update('text', nextValue));
              }}
              placeholder={'示例：\n# 一级标题\n## 二级标题\n**加粗文本**\n- 列表项1\n- 列表项2'}
            />
          ) : (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button component="label" variant="outlined" disabled={disabled || uploading}>
                  {uploading ? '上传中...' : (block.type === 'image' ? '上传本地图片' : '上传本地视频')}
                  <input
                    hidden
                    type="file"
                    accept={mediaAccept}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      event.target.value = '';
                      if (!file || typeof onUploadAsset !== 'function') return;
                      onUploadAsset(index, file);
                    }}
                  />
                </Button>
                {hasAsset && (
                  <Button
                    variant="text"
                    color="warning"
                    disabled={disabled || uploading}
                    onClick={() => typeof onClearAsset === 'function' && onClearAsset(index)}
                  >
                    移除已上传媒体
                  </Button>
                )}
              </Stack>

              {hasAsset ? (
                <Alert severity="success">
                  已上传本地媒体：{block.asset_name || `资源ID ${block.asset_id}`}
                  {Number(block.asset_size) > 0 ? `（${formatBytes(block.asset_size)}）` : ''}
                </Alert>
              ) : (
                <Alert severity={limits.allowExternalUrl ? 'info' : 'warning'}>
                  {limits.allowExternalUrl
                    ? '尚未上传本地媒体，可直接上传文件，或填写外链 URL。'
                    : '当前比赛已关闭外链 URL，仅支持本地上传媒体。'}
                </Alert>
              )}

              {limits.allowExternalUrl && (
                <TextField
                  size="small"
                  label={block.type === 'image' ? '外链图片 URL（可选）' : '外链视频 URL（可选）'}
                  value={block.url}
                  disabled={disabled || uploading}
                  inputProps={{ maxLength: limits.url }}
                  helperText={`${String(block.url || '').length}/${limits.url}`}
                  onChange={(event) => update('url', event.target.value)}
                  placeholder={block.type === 'image' ? 'https://example.com/demo.jpg' : 'https://example.com/demo.mp4'}
                />
              )}

              {limits.allowExternalUrl && hasAsset && hasExternalUrl && (
                <Alert severity="info">
                  当前已填写外链 URL，保存后将优先使用外链并自动移除该区块原本地媒体引用。
                </Alert>
              )}

              <TextField
                size="small"
                label="说明文字（可选）"
                value={block.caption}
                disabled={disabled || uploading}
                inputProps={{ maxLength: limits.caption }}
                helperText={`${String(block.caption || '').length}/${limits.caption}`}
                onChange={(event) => update('caption', event.target.value)}
              />
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function TrainingManualOverallPreview({
  title,
  manualMode = 'local',
  feishuUrl = '',
  blocks,
  enabled,
}) {
  const normalizedMode = normalizeManualMode(manualMode);
  const normalizedFeishuUrl = toSafeText(feishuUrl);
  return (
    <Stack spacing={1.5}>
      <Alert severity={enabled ? 'success' : 'warning'}>
        {enabled ? '当前草稿保存后将以“启用状态”发布给符合条件的参赛者。' : '当前草稿保存后仍为“未启用状态”，参赛者不可见。'}
      </Alert>
      <Typography sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 700 }}>
        {toSafeText(title) || '比赛手册'}
      </Typography>
      {normalizedMode === 'feishu' ? (
        normalizedFeishuUrl ? (
          <Button
            variant="contained"
            color="info"
            component="a"
            href={normalizedFeishuUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ alignSelf: 'flex-start' }}
          >
            打开飞书手册
          </Button>
        ) : (
          <Alert severity="warning">当前为飞书模式，请先填写飞书手册 URL。</Alert>
        )
      ) : (
        <Box sx={{ border: '1px solid #e2d5f5', borderRadius: 2.5, p: { xs: 1.4, sm: 2 }, backgroundColor: '#ffffff' }}>
          <TrainingManualDocumentContent blocks={blocks} />
        </Box>
      )}
    </Stack>
  );
}

export default function CompetitionTrainingManualPage({
  competitionId,
  search = '',
  setMessage,
  onNavigate,
  homePath = '/',
}) {
  const normalizedCompetitionId = Number(competitionId);
  const normalizedHomePath = normalizePath(homePath || '/');
  const manualViewMode = useMemo(() => {
    const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    return String(params.get('manual_view') || '').trim().toLowerCase();
  }, [search]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [meta, setMeta] = useState(null);
  const [content, setContent] = useState(null);
  const [form, setForm] = useState(() => toContentForm({}));
  const [limits, setLimits] = useState(() => ({ ...DEFAULT_TRAINING_MANUAL_LIMITS }));
  const [isEditing, setIsEditing] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [uploadingMap, setUploadingMap] = useState({});

  const canManageByRole = Boolean(meta?.can_manage);
  const forceParticipantReadonly = manualViewMode === 'participant'
    && canManageByRole
    && Boolean(meta?.is_registered);
  const canManage = canManageByRole && !forceParticipantReadonly;
  const canView = Boolean(meta?.can_view) || forceParticipantReadonly;
  const configured = Boolean(meta?.configured);
  const editingManualMode = normalizeManualMode(form?.manual_mode);
  const viewingManualMode = normalizeManualMode(content?.manual_mode || meta?.manual_mode);

  const navigateTo = useCallback(
    (targetPath) => {
      const normalized = normalizePath(targetPath || normalizedHomePath);
      if (typeof onNavigate === 'function') {
        onNavigate(normalized);
        return;
      }
      window.location.href = normalized;
    },
    [onNavigate, normalizedHomePath]
  );

  const showError = (error, fallback) => {
    if (typeof setMessage === 'function') {
      setMessage({ type: 'error', text: getUserFriendlyErrorText(error, fallback) });
    }
  };

  const loadData = useCallback(async () => {
    if (Number.isNaN(normalizedCompetitionId) || normalizedCompetitionId <= 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const requestId = createRequestId();
      const { data: metaData } = await getCompetitionTrainingManualMeta(normalizedCompetitionId, { requestId });
      setMeta(metaData || null);
      setLimits(normalizeTrainingManualLimits(metaData?.limits || {}));

      if (!metaData?.can_view && !metaData?.can_manage) {
        setContent(null);
        setForm(toContentForm({}));
        setUploadingMap({});
        setIsEditing(false);
        return;
      }

      const { data: contentData } = await getCompetitionTrainingManualContent(normalizedCompetitionId, {
        requestId: createRequestId(),
      });
      const normalizedContent = contentData || {};
      setContent(normalizedContent);
      setForm(toContentForm(normalizedContent));
      setUploadingMap({});
      setIsEditing(Boolean(metaData?.can_manage) && !Boolean(metaData?.configured));
    } catch (error) {
      showError(error, '加载比赛手册失败');
    } finally {
      setLoading(false);
    }
  }, [normalizedCompetitionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const blockCount = useMemo(() => (Array.isArray(form.blocks) ? form.blocks.length : 0), [form.blocks]);
  const editingTextCharCount = useMemo(() => countTextChars(form.blocks || []), [form.blocks]);
  const viewingTextCharCount = useMemo(() => countTextChars(content?.blocks || []), [content?.blocks]);
  const maxTextCharCount = useMemo(() => {
    const maxBlocks = Math.max(0, Number(limits.blocks) || 0);
    const maxTextPerBlock = Math.max(0, Number(limits.text) || 0);
    return maxBlocks * maxTextPerBlock;
  }, [limits.blocks, limits.text]);

  const cleanupAssetBestEffort = useCallback(async (assetId) => {
    const normalizedAssetId = toPositiveInt(assetId);
    if (!normalizedAssetId || Number.isNaN(normalizedCompetitionId) || normalizedCompetitionId <= 0) return;
    try {
      await deleteCompetitionTrainingManualAsset(normalizedCompetitionId, normalizedAssetId, {
        requestId: createRequestId(),
      });
    } catch {
      // 忽略：若资产已被已保存手册引用，后续保存时会自动清理。
    }
  }, [normalizedCompetitionId]);

  const setUploadingForIndex = (index, uploading) => {
    const normalizedIndex = Number(index);
    if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0) return;
    setUploadingMap((prev) => {
      const next = { ...prev };
      if (uploading) {
        next[normalizedIndex] = true;
      } else {
        delete next[normalizedIndex];
      }
      return next;
    });
  };

  const shiftUploadingMapAfterRemove = (removedIndex) => {
    setUploadingMap((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => {
        const idx = Number(key);
        if (!Number.isInteger(idx) || !prev[key]) return;
        if (idx < removedIndex) next[idx] = true;
        if (idx > removedIndex) next[idx - 1] = true;
      });
      return next;
    });
  };

  const shiftUploadingMapAfterInsert = (insertIndex) => {
    setUploadingMap((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => {
        const idx = Number(key);
        if (!Number.isInteger(idx) || !prev[key]) return;
        if (idx < insertIndex) next[idx] = true;
        if (idx >= insertIndex) next[idx + 1] = true;
      });
      return next;
    });
  };

  const insertBlock = (insertIndex, type = 'text') => {
    const currentBlocks = Array.isArray(form.blocks) ? form.blocks : [];
    if (currentBlocks.length >= limits.blocks) return;
    const normalizedIndex = Math.min(
      Math.max(0, Number.isInteger(insertIndex) ? insertIndex : currentBlocks.length),
      currentBlocks.length
    );
    setForm((prev) => {
      const blocks = [...(prev.blocks || [])];
      blocks.splice(normalizedIndex, 0, createEmptyBlock(type));
      return { ...prev, blocks };
    });
    shiftUploadingMapAfterInsert(normalizedIndex);
  };

  const updateBlock = (index, nextValue) => {
    const oldBlock = normalizeBlock((form.blocks || [])[index] || {});
    const nextBlock = normalizeBlock(nextValue);
    const oldAssetId = toPositiveInt(oldBlock.asset_id);
    const nextAssetId = toPositiveInt(nextBlock.asset_id);

    setForm((prev) => {
      const blocks = [...(prev.blocks || [])];
      if (index < 0 || index >= blocks.length) return prev;
      blocks[index] = nextBlock;
      return { ...prev, blocks };
    });

    if (oldAssetId && oldAssetId !== nextAssetId) {
      void cleanupAssetBestEffort(oldAssetId);
    }
  };

  const removeBlock = (index) => {
    const currentBlock = normalizeBlock((form.blocks || [])[index] || {});
    const currentAssetId = toPositiveInt(currentBlock.asset_id);
    setForm((prev) => {
      const blocks = [...(prev.blocks || [])];
      if (index < 0 || index >= blocks.length) return prev;
      blocks.splice(index, 1);
      return { ...prev, blocks };
    });
    shiftUploadingMapAfterRemove(index);
    if (currentAssetId) void cleanupAssetBestEffort(currentAssetId);
  };

  const addBlock = (type = 'text') => {
    insertBlock(Array.isArray(form.blocks) ? form.blocks.length : 0, type);
  };

  const validateLocalFile = (file, blockType) => {
    if (!file) return '未选择文件';
    const maxSizeMb = blockType === 'image' ? limits.uploadImageMaxSizeMb : limits.uploadVideoMaxSizeMb;
    const maxBytes = Number(maxSizeMb || 0) * 1024 * 1024;
    if (maxBytes > 0 && Number(file.size || 0) > maxBytes) {
      return `${blockType === 'image' ? '图片' : '视频'}文件大小超限，最大 ${maxSizeMb}MB`;
    }

    const ext = fileExt(file.name || '');
    const allowedExts = blockType === 'image' ? limits.uploadImageExts : limits.uploadVideoExts;
    if (Array.isArray(allowedExts) && allowedExts.length > 0 && ext && !allowedExts.includes(ext)) {
      return `文件扩展名不支持，仅允许：${allowedExts.join('、')}`;
    }

    if (limits.uploadEnforceMimePrefix) {
      const mime = String(file.type || '').trim().toLowerCase();
      if (mime) {
        const expectedPrefix = blockType === 'image' ? 'image/' : 'video/';
        if (!mime.startsWith(expectedPrefix)) {
          return `文件 MIME 类型不匹配，需以 ${expectedPrefix} 开头`;
        }
      }
    }

    return '';
  };

  const handleUploadAsset = async (index, file) => {
    if (!canManage || Number.isNaN(normalizedCompetitionId) || normalizedCompetitionId <= 0) return;
    const currentBlock = normalizeBlock((form.blocks || [])[index] || {});
    if (!['image', 'video'].includes(currentBlock.type)) {
      if (typeof setMessage === 'function') {
        setMessage({ type: 'warning', text: '仅图片/视频区块支持上传本地媒体' });
      }
      return;
    }

    const validateMessage = validateLocalFile(file, currentBlock.type);
    if (validateMessage) {
      if (typeof setMessage === 'function') {
        setMessage({ type: 'warning', text: validateMessage });
      }
      return;
    }

    const oldAssetId = toPositiveInt(currentBlock.asset_id);
    setUploadingForIndex(index, true);
    try {
      const { data } = await uploadCompetitionTrainingManualAsset(
        normalizedCompetitionId,
        currentBlock.type,
        file,
        { requestId: createRequestId() }
      );
      const nextAssetId = toPositiveInt(data?.asset_id);
      setForm((prev) => {
        const blocks = [...(prev.blocks || [])];
        if (index < 0 || index >= blocks.length) return prev;
        const target = normalizeBlock(blocks[index]);
        blocks[index] = {
          ...target,
          asset_id: nextAssetId,
          asset_url: toSafeText(data?.stream_url),
          asset_name: toSafeText(data?.attachment_name),
          asset_size: Number(data?.attachment_size || 0),
          asset_mime: toSafeText(data?.attachment_mime),
          url: '',
        };
        return { ...prev, blocks };
      });
      if (oldAssetId && nextAssetId && oldAssetId !== nextAssetId) {
        void cleanupAssetBestEffort(oldAssetId);
      }
      if (typeof setMessage === 'function') {
        setMessage({ type: 'success', text: `${currentBlock.type === 'image' ? '图片' : '视频'}上传成功` });
      }
    } catch (error) {
      showError(error, '上传媒体失败');
    } finally {
      setUploadingForIndex(index, false);
    }
  };

  const handleClearBlockAsset = async (index) => {
    const currentBlock = normalizeBlock((form.blocks || [])[index] || {});
    const assetId = toPositiveInt(currentBlock.asset_id);
    if (!assetId) return;

    setForm((prev) => {
      const blocks = [...(prev.blocks || [])];
      if (index < 0 || index >= blocks.length) return prev;
      const target = normalizeBlock(blocks[index]);
      blocks[index] = {
        ...target,
        asset_id: null,
        asset_url: '',
        asset_name: '',
        asset_size: 0,
        asset_mime: '',
      };
      return { ...prev, blocks };
    });

    try {
      await deleteCompetitionTrainingManualAsset(normalizedCompetitionId, assetId, {
        requestId: createRequestId(),
      });
    } catch {
      if (typeof setMessage === 'function') {
        setMessage({ type: 'info', text: '该媒体若已被已保存手册引用，将在你保存手册后自动清理。' });
      }
    }
  };

  const handleStartEdit = () => {
    setForm(toContentForm(content || {}));
    setUploadingMap({});
    setPreviewDialogOpen(false);
    setDeleteDialogOpen(false);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setForm(toContentForm(content || {}));
    setUploadingMap({});
    setPreviewDialogOpen(false);
    setDeleteDialogOpen(false);
    setIsEditing(false);
  };

  const handleOpenDeleteDialog = () => {
    if (!canManage || deleting) return;
    setDeleteDialogOpen(true);
  };

  const validateDraft = (draft) => {
    const manualMode = normalizeManualMode(draft?.manual_mode);
    const title = String(draft?.title || '');
    const feishuUrl = toSafeText(draft?.feishu_url);
    const blocks = Array.isArray(draft?.blocks) ? draft.blocks : [];

    if (title.length > limits.title) return `手册标题不能超过 ${limits.title} 字`;
    if (feishuUrl && feishuUrl.length > limits.url) return `飞书 URL 不能超过 ${limits.url} 字`;
    if (feishuUrl && !isAllowedFeishuUrl(feishuUrl, limits.feishuAllowedDomains)) {
      return `飞书 URL 仅支持域名：${(limits.feishuAllowedDomains || []).join('、')}`;
    }

    if (manualMode === 'feishu') {
      if (draft?.enabled && !feishuUrl) return '启用飞书模式前，请先填写飞书手册 URL';
      return '';
    }

    if (blocks.length > limits.blocks) return `内容区块数量不能超过 ${limits.blocks} 个`;
    if (draft?.enabled && !blocks.length) return '启用比赛手册前，请先添加至少一个内容区块';

    for (let i = 0; i < blocks.length; i += 1) {
      const block = normalizeBlock(blocks[i]);
      const idx = i + 1;
      if (!BLOCK_TYPES.includes(block.type)) return `第 ${idx} 个区块类型无效`;

      if (block.type === 'text') {
        if (toPositiveInt(block.asset_id)) return `第 ${idx} 个文字区块不能配置媒体资源`;
        if (!toSafeText(block.text)) return `第 ${idx} 个文字区块内容不能为空`;
        if (String(block.text || '').length > limits.text) {
          return `第 ${idx} 个文字区块内容不能超过 ${limits.text} 字`;
        }
        continue;
      }

      const hasAsset = Boolean(toPositiveInt(block.asset_id));
      const hasUrl = Boolean(toSafeText(block.url));
      if (!hasAsset && !hasUrl) return `第 ${idx} 个媒体区块至少需要上传本地媒体或填写 URL`;
      const usingExternalUrl = !hasAsset && hasUrl;
      if (usingExternalUrl) {
        if (!limits.allowExternalUrl) return '当前比赛已关闭外链 URL，请使用本地上传媒体';
        if (!isHttpUrl(block.url)) return `第 ${idx} 个媒体区块 URL 必须为 http/https 地址`;
        if (String(block.url || '').length > limits.url) {
          return `第 ${idx} 个媒体区块 URL 不能超过 ${limits.url} 字`;
        }
      }
      if (String(block.caption || '').length > limits.caption) {
        return `第 ${idx} 个媒体区块说明不能超过 ${limits.caption} 字`;
      }
    }
    return '';
  };

  const handleSave = async () => {
    if (!canManage || saving) return;

    const validateMessage = validateDraft(form);
    if (validateMessage) {
      if (typeof setMessage === 'function') {
        setMessage({ type: 'warning', text: validateMessage });
      }
      return;
    }

    setSaving(true);
    try {
      const wasConfigured = Boolean(meta?.configured);
      const manualMode = normalizeManualMode(form?.manual_mode);
      const localBlocksSource = manualMode === 'feishu'
        ? (Array.isArray(content?.blocks) ? content.blocks : [])
        : (form.blocks || []);
      const payload = {
        enabled: Boolean(form.enabled),
        manual_mode: manualMode,
        title: toSafeText(form.title),
        summary: '',
        feishu_url: toSafeText(form.feishu_url),
        blocks: toPayloadBlocks(localBlocksSource),
      };
      const { data } = await upsertCompetitionTrainingManualContent(normalizedCompetitionId, payload, {
        requestId: createRequestId(),
      });
      const nextContent = data || payload;
      setContent(nextContent);
      setForm(toContentForm(nextContent));
      setUploadingMap({});
      setPreviewDialogOpen(false);
      setIsEditing(false);
      await loadData();
      if (typeof setMessage === 'function') {
        setMessage({ type: 'success', text: wasConfigured ? '比赛手册修改成功' : '比赛手册保存成功' });
      }
    } catch (error) {
      showError(error, '保存比赛手册失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canManage || deleting) return;
    setDeleteDialogOpen(false);
    setDeleting(true);
    try {
      await deleteCompetitionTrainingManualContent(normalizedCompetitionId, { requestId: createRequestId() });
      setForm(toContentForm({}));
      setContent(null);
      setUploadingMap({});
      setPreviewDialogOpen(false);
      setIsEditing(true);
      await loadData();
      if (typeof setMessage === 'function') {
        setMessage({ type: 'success', text: '比赛手册及媒体已删除' });
      }
    } catch (error) {
      showError(error, '删除比赛手册失败');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Stack spacing={1} alignItems="center">
          <CircularProgress />
          <Typography variant="body2" color="text.secondary">比赛手册加载中...</Typography>
        </Stack>
      </Box>
    );
  }

  if (!canView && !canManage) {
    return (
      <Box sx={{ minHeight: '100vh', px: 2, py: 3, background: 'linear-gradient(145deg, #f6f0ff 0%, #eee5ff 45%, #f8f5ff 100%)' }}>
        <Card sx={{ maxWidth: 880, mx: 'auto', borderRadius: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <Alert severity="warning">
                当前无权限查看该比赛手册。仅创办者/管理员，或在开放时段内的已报名选手可查看。
              </Alert>
              <Button variant="contained" onClick={() => navigateTo(normalizedHomePath)}>返回首页</Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', px: 2, py: 3, background: 'linear-gradient(145deg, #f6f0ff 0%, #eee5ff 45%, #f8f5ff 100%)' }}>
      <Card sx={{ maxWidth: 980, mx: 'auto', borderRadius: 4, border: '1px solid #dccbf3' }}>
        <CardContent sx={{ p: { xs: 2.2, sm: 3.2 } }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
              spacing={1}
            >
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography sx={{ fontSize: { xs: 24, sm: 30 }, fontWeight: 800 }}>
                  比赛手册
                </Typography>
                {canManage ? (
                  <Chip size="small" color="secondary" label="管理模式" />
                ) : (
                  <Chip size="small" color="info" label="查看模式" />
                )}
                {forceParticipantReadonly && <Chip size="small" color="warning" label="参赛者视角（只读）" />}
                {!configured && <Chip size="small" label="未配置" />}
                {configured && <Chip size="small" color={meta?.enabled ? 'success' : 'default'} label={meta?.enabled ? '已启用' : '未启用'} />}
                <Chip
                  size="small"
                  variant="outlined"
                  label={`模式：${(isEditing ? editingManualMode : viewingManualMode) === 'feishu' ? '飞书 URL' : 'local'}`}
                />
              </Stack>
              <Button variant="outlined" onClick={() => navigateTo(normalizedHomePath)}>
                返回首页
              </Button>
            </Stack>

            <Alert severity="info">
              比赛：{toSafeText(meta?.competition_name) || `#${normalizedCompetitionId}`} ｜ 报名截止：{formatTime(meta?.registration_end)} ｜ 比赛截止：{formatTime(meta?.submission_end)}
            </Alert>

            {canManage && configured && !Boolean(meta?.enabled) && (
              <Alert severity="warning">
                当前未启用，选手将无法看到比赛手册。
              </Alert>
            )}

            <Divider />

            {canManage ? (
              isEditing ? (
                <Stack spacing={2}>
                  <Alert severity={editingManualMode === 'feishu' ? 'info' : 'success'}>
                    {editingManualMode === 'feishu'
                      ? '当前为飞书手册模式：仅需填写飞书 URL，区块内容会保留但不作为当前生效内容。'
                      : '当前为 local 模式：支持本地上传图片/视频与区块编辑。删除手册后，已上传媒体会一并清理。'}
                  </Alert>

                  <Grid2 container spacing={1.5}>
                    <Grid2 size={{ xs: 12, md: 5 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="手册标题"
                        value={form.title}
                        inputProps={{ maxLength: limits.title }}
                        helperText={`${String(form.title || '').length}/${limits.title}`}
                        onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                      />
                    </Grid2>
                    <Grid2 size={{ xs: 12, md: 4 }}>
                      <TextField
                        fullWidth
                        size="small"
                        select
                        label="手册模式"
                        value={editingManualMode}
                        onChange={(event) => {
                          const nextMode = normalizeManualMode(event.target.value);
                          setForm((prev) => ({ ...prev, manual_mode: nextMode }));
                        }}
                      >
                        <MenuItem value="local">local（区块编辑）</MenuItem>
                        <MenuItem value="feishu">飞书手册 URL</MenuItem>
                      </TextField>
                    </Grid2>
                    <Grid2 size={{ xs: 12, md: 3 }}>
                      <FormControlLabel
                        control={(
                          <Checkbox
                            checked={Boolean(form.enabled)}
                            onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
                          />
                        )}
                        label="启用比赛手册"
                      />
                    </Grid2>
                  </Grid2>

                  {editingManualMode === 'feishu' ? (
                    <Stack spacing={1.5}>
                      <TextField
                        fullWidth
                        size="small"
                        label="飞书手册 URL"
                        value={form.feishu_url}
                        inputProps={{ maxLength: limits.url }}
                        helperText={(
                          `${String(form.feishu_url || '').length}/${limits.url}`
                          + ` ｜ 支持域名：${(limits.feishuAllowedDomains || []).join('、')}`
                        )}
                        onChange={(event) => setForm((prev) => ({ ...prev, feishu_url: event.target.value }))}
                        placeholder="https://xxx.feishu.cn/wiki/xxxx"
                      />
                      {!!(content?.blocks || []).length && (
                        <Alert severity="info">
                          已保留 local 区块内容 {Number(content?.blocks?.length || 0)} 个；切回 local 模式后可继续编辑。
                        </Alert>
                      )}
                    </Stack>
                  ) : (
                    <>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Button variant="outlined" disabled={blockCount >= limits.blocks} onClick={() => addBlock('text')}>新增文字</Button>
                        <Button variant="outlined" disabled={blockCount >= limits.blocks} onClick={() => addBlock('image')}>新增图片</Button>
                        <Button variant="outlined" disabled={blockCount >= limits.blocks} onClick={() => addBlock('video')}>新增视频</Button>
                        <Button
                          variant="outlined"
                          color="secondary"
                          disabled={saving || deleting}
                          onClick={() => setPreviewDialogOpen(true)}
                        >
                          打开预览窗口
                        </Button>
                        <Typography color="text.secondary" sx={{ alignSelf: 'center' }}>
                          共 {blockCount}/{limits.blocks} 个区块
                        </Typography>
                        <Typography color="text.secondary" sx={{ alignSelf: 'center' }}>
                          总字数（文字区块）：{editingTextCharCount}/{maxTextCharCount}
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        最大总字数按“最大区块数 × 单区块文字上限”计算：{limits.blocks} × {limits.text}。
                      </Typography>

                      {(form.blocks || []).map((block, index) => (
                        <Stack key={`block_${index}`} spacing={1}>
                          <BlockEditor
                            block={block}
                            index={index}
                            limits={limits}
                            disabled={saving || deleting}
                            uploading={Boolean(uploadingMap[index])}
                            onChange={updateBlock}
                            onRemove={removeBlock}
                            onUploadAsset={handleUploadAsset}
                            onClearAsset={handleClearBlockAsset}
                          />
                          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" sx={{ px: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              在区块 #{index + 1} 后插入：
                            </Typography>
                            <Button
                              size="small"
                              variant="text"
                              disabled={blockCount >= limits.blocks}
                              onClick={() => insertBlock(index + 1, 'text')}
                            >
                              +文字
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              disabled={blockCount >= limits.blocks}
                              onClick={() => insertBlock(index + 1, 'image')}
                            >
                              +图片
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              disabled={blockCount >= limits.blocks}
                              onClick={() => insertBlock(index + 1, 'video')}
                            >
                              +视频
                            </Button>
                          </Stack>
                        </Stack>
                      ))}

                      {!blockCount && <Alert severity="warning">当前还没有内容区块，参赛选手将无法查看手册内容。</Alert>}
                    </>
                  )}

                  <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                    {configured && (
                      <Button variant="text" disabled={saving || deleting} onClick={handleCancelEdit}>
                        取消修改
                      </Button>
                    )}
                    {configured && (
                      <Button color="error" variant="outlined" disabled={saving || deleting} onClick={handleOpenDeleteDialog}>
                        {deleting ? '删除中...' : '删除手册'}
                      </Button>
                    )}
                    <Button variant="contained" disabled={saving || deleting} onClick={handleSave}>
                      {saving ? '保存中...' : '保存比赛手册'}
                    </Button>
                  </Stack>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Alert severity="info">
                    当前为查看模式。点击“修改比赛手册”进入编辑，调整完成后点击“保存比赛手册”才会生效。
                  </Alert>
                  <Typography sx={{ fontSize: { xs: 22, sm: 28 }, fontWeight: 700 }}>
                    {content?.title || meta?.title || '比赛手册'}
                  </Typography>
                  {viewingManualMode === 'feishu' ? (
                    toSafeText(content?.feishu_url) ? (
                      <Button
                        variant="contained"
                        color="info"
                        component="a"
                        href={toSafeText(content?.feishu_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        打开飞书手册
                      </Button>
                    ) : (
                      <Alert severity="warning">当前为飞书模式，但尚未配置可访问的飞书 URL。</Alert>
                    )
                  ) : (
                    (!(content?.blocks || []).length ? (
                      <Alert severity="warning">当前还没有内容区块，参赛选手将无法查看手册内容。</Alert>
                    ) : (
                      <Stack spacing={1.2}>
                        <Alert severity="info">
                          总字数（文字区块）：{viewingTextCharCount}/{maxTextCharCount}
                        </Alert>
                        <Card sx={{ borderRadius: 3, border: '1px solid #e2d5f5', boxShadow: 'none' }}>
                          <CardContent sx={{ p: { xs: 1.6, sm: 2.2 } }}>
                            <TrainingManualDocumentContent blocks={content?.blocks || []} />
                          </CardContent>
                        </Card>
                      </Stack>
                    ))
                  )}
                  <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                    {configured && (
                      <Button color="error" variant="outlined" disabled={deleting} onClick={handleOpenDeleteDialog}>
                        {deleting ? '删除中...' : '删除手册'}
                      </Button>
                    )}
                    <Button variant="contained" disabled={deleting} onClick={handleStartEdit}>
                      修改比赛手册
                    </Button>
                  </Stack>
                </Stack>
              )
            ) : (
              <Stack spacing={2}>
                <Typography sx={{ fontSize: { xs: 22, sm: 28 }, fontWeight: 700 }}>
                  {content?.title || meta?.title || '比赛手册'}
                </Typography>
                {viewingManualMode === 'feishu' ? (
                  toSafeText(content?.feishu_url) ? (
                    <Button
                      variant="contained"
                      color="info"
                      component="a"
                      href={toSafeText(content?.feishu_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      打开飞书手册
                    </Button>
                  ) : (
                    <Alert severity="warning">
                      当前比赛尚未发布可查看的飞书手册链接。
                    </Alert>
                  )
                ) : (
                  (!(content?.blocks || []).length ? (
                    <Alert severity="warning">
                      当前比赛尚未发布可查看的比赛手册内容。
                    </Alert>
                  ) : (
                    <Stack spacing={1.2}>
                      <Alert severity="info">
                        总字数（文字区块）：{viewingTextCharCount}/{maxTextCharCount}
                      </Alert>
                      <Card sx={{ borderRadius: 3, border: '1px solid #e2d5f5', boxShadow: 'none' }}>
                        <CardContent sx={{ p: { xs: 1.6, sm: 2.2 } }}>
                          <TrainingManualDocumentContent blocks={content?.blocks || []} />
                        </CardContent>
                      </Card>
                    </Stack>
                  ))
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {canManage && isEditing && (
        <Box
          sx={{
            position: 'fixed',
            right: {
              xs: 8,
              sm: 'max(8px, calc((100vw - 980px) / 2 - 8px))',
            },
            transform: {
              xs: 'translateX(0)',
              sm: 'translateX(100%)',
            },
            bottom: { xs: 18, sm: 24 },
            zIndex: 1200,
          }}
        >
          <Button variant="contained" color="secondary" onClick={() => setPreviewDialogOpen(true)}>
            整体预览
          </Button>
        </Box>
      )}

      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pr: 6, position: 'relative' }}>
          整体预览（未保存草稿）
          <IconButton
            aria-label="关闭预览"
            onClick={() => setPreviewDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <TrainingManualOverallPreview
            title={form.title}
            manualMode={editingManualMode}
            feishuUrl={form.feishu_url}
            blocks={form.blocks}
            enabled={Boolean(form.enabled)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          if (deleting) return;
          setDeleteDialogOpen(false);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>确认删除比赛手册</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.2}>
            <Alert severity="warning">
              该操作会删除当前比赛手册内容及已上传的图片/视频媒体，删除后不可恢复。
            </Alert>
            <Typography color="text.secondary">
              请确认你已不再需要这些内容。
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            variant="text"
            disabled={deleting}
            onClick={() => setDeleteDialogOpen(false)}
          >
            取消
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? '删除中...' : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
