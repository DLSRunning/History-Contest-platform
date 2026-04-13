import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  List,
  ListItemButton,
  Paper,
  Stack,
  TextField,
  Typography,
  Button,
} from '@mui/material';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import dayjs from 'dayjs';
import {
  createRequestId,
  getAssignedSubmissionAttachmentBlob,
  getCompetitionById,
  getMyAssignedSubmissionReview,
  listMyAssignedSubmissionsPaged,
  submitAssignedSubmissionReview,
} from '../../../api';
import { getUserFriendlyErrorText } from '../../../utils/errorText';

const PAGE_SIZE = 200;
const PREVIEW_MIN_HEIGHT_DESKTOP = 'max(1020px, calc(100vh - 150px))';
const PREVIEW_PANEL_MIN_HEIGHT_DESKTOP = 'max(1080px, calc(100vh - 100px))';
const LIST_HEIGHT_DESKTOP = PREVIEW_MIN_HEIGHT_DESKTOP;

function formatTime(value) {
  if (!value) return '-';
  const dt = dayjs(value);
  if (!dt.isValid()) return '-';
  return dt.format('YYYY-MM-DD HH:mm');
}

function isPdfContent(contentType = '', fileName = '') {
  const type = String(contentType || '').toLowerCase();
  if (type.includes('application/pdf')) return true;
  return String(fileName || '').toLowerCase().endsWith('.pdf');
}

function normalizeScore(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: false, message: '请先填写评分' };
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return { ok: false, message: '评分必须是数字' };
  if (parsed < 0 || parsed > 100) return { ok: false, message: '评分范围应为 0 到 100' };
  return { ok: true, value: Math.round(parsed * 100) / 100 };
}

function getHttpStatus(error) {
  return Number(error?.response?.status || 0);
}

function buildDocxPreviewSrcDoc(fileName, docxHtml, warnings = []) {
  const safeTitle = String(fileName || '文档预览').replace(/[<>]/g, '');
  const warningLines = (Array.isArray(warnings) ? warnings : [])
    .map((msg) => String(msg?.message || msg || '').trim())
    .filter(Boolean)
    .map((line) => `<li>${line.replace(/[<>]/g, '')}</li>`)
    .join('');
  const warningBlock = warningLines
    ? `<div style="margin-bottom:12px;padding:10px 12px;border-radius:10px;background:#fff4e5;border:1px solid #f7cf8f;color:#8a5200;"><strong>转换提示：</strong><ul style="margin:8px 0 0 18px;padding:0;">${warningLines}</ul></div>`
    : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    body { margin: 0; padding: 18px; background: #faf7ff; color: #231637; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }
    .hint { margin-bottom: 12px; padding: 10px 12px; border-radius: 10px; background: #f2ecff; border: 1px solid #dcccf8; color: #4b2b7f; }
    .content { background: #fff; border: 1px solid #e7dcfa; border-radius: 12px; padding: 18px; line-height: 1.75; word-break: break-word; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; max-width: 100%; }
    td, th { border: 1px solid #d8c6f4; padding: 6px 8px; }
  </style>
</head>
<body>
  <div class="hint">当前为 docx 在线预览，格式与原文件可能存在差异。</div>
  ${warningBlock}
  <div class="content">${String(docxHtml || '').trim() || '<div style="color:#666;">文档内容为空</div>'}</div>
</body>
</html>`;
}

async function convertDocxBlobToHtml(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const mammothModule = await import('mammoth');
  const mammothLib = (
    mammothModule && typeof mammothModule.convertToHtml === 'function'
  ) ? mammothModule : mammothModule.default;
  if (!mammothLib || typeof mammothLib.convertToHtml !== 'function') {
    throw new Error('docx_preview_not_supported');
  }
  const result = await Promise.race([
    mammothLib.convertToHtml({ arrayBuffer }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('docx_preview_timeout')), 15000);
    }),
  ]);
  return {
    html: String(result?.value || ''),
    warnings: Array.isArray(result?.messages) ? result.messages : [],
  };
}

export default function JudgeReviewPage({
  competitionId,
  setMessage,
}) {
  const normalizedCompetitionId = Number(competitionId || 0);
  const [competition, setCompetition] = useState(null);
  const [listLoading, setListLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [previewDocxSrcDoc, setPreviewDocxSrcDoc] = useState('');
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState('');
  const [scoreInput, setScoreInput] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [editingReviewed, setEditingReviewed] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedRow = useMemo(
    () => rows.find((item) => Number(item.submission_id) === Number(selectedSubmissionId)) || null,
    [rows, selectedSubmissionId]
  );
  const selectedReviewed = Boolean(selectedRow?.reviewed);
  const pdfPreviewSrc = useMemo(() => {
    if (!previewUrl) return '';
    // 尽量按页宽展示，并关闭导航面板以减少左右无效留白（不同浏览器支持度不同）。
    return `${previewUrl}#page=1&zoom=130&navpanes=0&pagemode=none`;
  }, [previewUrl]);
  const reviewPermission = useMemo(() => {
    const now = dayjs();
    const submissionEnd = competition?.submission_end ? dayjs(competition.submission_end) : null;
    const reviewStart = competition?.review_start ? dayjs(competition.review_start) : null;
    const reviewEnd = competition?.review_end ? dayjs(competition.review_end) : null;
    const nonReviewMessage = '当前为非评审阶段，不能点评';
    if (submissionEnd && submissionEnd.isValid() && (now.isBefore(submissionEnd) || now.isSame(submissionEnd))) {
      return { canScore: false, message: nonReviewMessage };
    }
    if (!reviewStart || !reviewStart.isValid() || now.isBefore(reviewStart)) {
      return { canScore: false, message: '当前为非评审阶段，不能点评' };
    }
    if (reviewEnd && reviewEnd.isValid() && now.isAfter(reviewEnd)) {
      return { canScore: false, message: nonReviewMessage };
    }
    return { canScore: true, message: '' };
  }, [competition?.submission_end, competition?.review_start, competition?.review_end]);
  const canEditReviewFields = Boolean(
    selectedRow
    && reviewPermission.canScore
    && !saving
    && (!selectedReviewed || editingReviewed)
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (previewDownloadUrl) URL.revokeObjectURL(previewDownloadUrl);
    };
  }, [previewDownloadUrl, previewUrl]);

  useEffect(() => {
    setEditingReviewed(false);
  }, [selectedSubmissionId]);

  useEffect(() => {
    if (!normalizedCompetitionId) return;
    let cancelled = false;
    (async () => {
      try {
        const detail = await getCompetitionById(normalizedCompetitionId, { requestId: createRequestId() });
        if (cancelled) return;
        setCompetition(detail?.data || null);
      } catch {
        if (!cancelled) setCompetition(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [normalizedCompetitionId]);

  useEffect(() => {
    if (!normalizedCompetitionId) return;
    let cancelled = false;
    (async () => {
      setListLoading(true);
      try {
        const mergedItems = [];
        let offset = 0;
        let guard = 0;
        while (guard < 100) {
          const result = await listMyAssignedSubmissionsPaged(
            normalizedCompetitionId,
            PAGE_SIZE,
            offset,
            '',
            { requestId: createRequestId() }
          );
          const pageItems = Array.isArray(result?.items) ? result.items : [];
          if (pageItems.length) mergedItems.push(...pageItems);

          const total = Number(result?.total || 0);
          const resolvedOffset = Number(result?.offset || offset);
          const nextOffset = resolvedOffset + pageItems.length;
          const hasMore = total > 0 ? nextOffset < total : pageItems.length >= PAGE_SIZE;
          if (!hasMore || pageItems.length === 0) break;

          offset = nextOffset;
          guard += 1;
        }
        if (cancelled) return;
        setRows(mergedItems);
        setSelectedSubmissionId((prev) => {
          if (!mergedItems.length) return 0;
          if (mergedItems.some((item) => Number(item.submission_id) === Number(prev))) return Number(prev);
          return Number(mergedItems[0].submission_id || 0);
        });
      } catch (error) {
        if (!cancelled) {
          setRows([]);
          setSelectedSubmissionId(0);
          setMessage?.({ type: 'error', text: getUserFriendlyErrorText(error, '加载分配作品失败') });
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [normalizedCompetitionId, setMessage]);

  useEffect(() => {
    if (!normalizedCompetitionId || !selectedSubmissionId) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (previewDownloadUrl) URL.revokeObjectURL(previewDownloadUrl);
      setPreviewUrl('');
      setPreviewName('');
      setPreviewError('');
      setPreviewDocxSrcDoc('');
      setPreviewDownloadUrl('');
      setScoreInput('');
      setCommentInput('');
      return;
    }

    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      setPreviewError('');
      try {
        const reviewPromise = getMyAssignedSubmissionReview(normalizedCompetitionId, selectedSubmissionId, {
          requestId: createRequestId(),
        });

        let attachmentError = '';
        let attachmentResult;
        let usedFormat = 'pdf';
        try {
          try {
            attachmentResult = await getAssignedSubmissionAttachmentBlob(normalizedCompetitionId, selectedSubmissionId, {
              requestId: createRequestId(),
              disposition: 'inline',
              attachmentExt: 'pdf',
            });
          } catch (pdfError) {
            if (getHttpStatus(pdfError) !== 404) throw pdfError;
            try {
              attachmentResult = await getAssignedSubmissionAttachmentBlob(normalizedCompetitionId, selectedSubmissionId, {
                requestId: createRequestId(),
                disposition: 'inline',
                attachmentExt: 'docx',
              });
              usedFormat = 'docx';
            } catch (docxError) {
              if (getHttpStatus(docxError) !== 404) throw docxError;
              attachmentResult = await getAssignedSubmissionAttachmentBlob(normalizedCompetitionId, selectedSubmissionId, {
                requestId: createRequestId(),
                disposition: 'attachment',
                attachmentExt: 'xlsx',
              });
              usedFormat = 'xlsx';
            }
          }
        } catch (attachmentFetchError) {
          attachmentError = getUserFriendlyErrorText(attachmentFetchError, '加载作品附件失败');
          attachmentResult = null;
        }

        const reviewResult = await reviewPromise;
        if (cancelled) return;

        if (previewUrl) URL.revokeObjectURL(previewUrl);
        if (previewDownloadUrl) URL.revokeObjectURL(previewDownloadUrl);
        setPreviewUrl('');
        setPreviewDocxSrcDoc('');
        setPreviewDownloadUrl('');

        const blob = attachmentResult?.blob || null;
        const fileName = attachmentResult?.fileName || `submission_${selectedSubmissionId}.${usedFormat}`;
        const contentType = attachmentResult?.contentType || '';
        if (!blob) {
          setPreviewUrl('');
          setPreviewName(fileName);
          setPreviewDocxSrcDoc('');
          setPreviewError(attachmentError || '该作品未提供可在线预览附件');
        } else if (usedFormat === 'pdf') {
          if (!isPdfContent(contentType, fileName)) {
            setPreviewUrl('');
            setPreviewName(fileName);
            setPreviewDocxSrcDoc('');
            setPreviewError('该作品未提供可在线预览的 PDF，请下载后查看。');
          } else {
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
            setPreviewName(fileName);
            setPreviewDocxSrcDoc('');
            setPreviewError('');
          }
        } else if (usedFormat === 'docx') {
          const { html, warnings } = await convertDocxBlobToHtml(blob);
          if (cancelled) return;
          setPreviewName(fileName);
          setPreviewUrl('');
          setPreviewDocxSrcDoc(buildDocxPreviewSrcDoc(fileName, html, warnings));
          setPreviewError('');
        } else {
          const downloadUrl = URL.createObjectURL(blob);
          setPreviewName(fileName);
          setPreviewUrl('');
          setPreviewDocxSrcDoc('');
          setPreviewDownloadUrl(downloadUrl);
          setPreviewError('该作品为 Excel 附件，暂不支持在线预览，请点击“下载附件”查看。');
        }

        const review = reviewResult?.data || null;
        setScoreInput(review?.score !== undefined && review?.score !== null ? String(review.score) : '');
        setCommentInput(String(review?.comment || ''));
      } catch (error) {
        if (!cancelled) {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          if (previewDownloadUrl) URL.revokeObjectURL(previewDownloadUrl);
          setPreviewUrl('');
          setPreviewName('');
          setPreviewError(getUserFriendlyErrorText(error, '加载作品详情失败'));
          setPreviewDocxSrcDoc('');
          setPreviewDownloadUrl('');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalizedCompetitionId, selectedSubmissionId]);

  const handleDownloadPreviewAttachment = () => {
    if (!previewDownloadUrl) return;
    const link = document.createElement('a');
    link.href = previewDownloadUrl;
    link.download = previewName || 'submission';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveReview = async () => {
    if (!normalizedCompetitionId || !selectedSubmissionId) return;
    if (!reviewPermission.canScore) {
      setMessage?.({ type: 'warning', text: reviewPermission.message || '当前为非评审阶段，不能点评' });
      return;
    }
    const normalized = normalizeScore(scoreInput);
    if (!normalized.ok) {
      setMessage?.({ type: 'warning', text: normalized.message });
      return;
    }

    setSaving(true);
    try {
      const currentId = Number(selectedSubmissionId);
      const currentIndex = rows.findIndex((item) => Number(item.submission_id) === currentId);
      const nextRow = currentIndex >= 0 ? rows[currentIndex + 1] : null;

      await submitAssignedSubmissionReview(
        normalizedCompetitionId,
        selectedSubmissionId,
        {
          score: normalized.value,
          comment: String(commentInput || '').trim(),
        },
        { requestId: createRequestId() }
      );
      setMessage?.({ type: 'success', text: '评分已保存' });
      setRows((prev) => prev.map((item) => (
        Number(item.submission_id) === Number(selectedSubmissionId)
          ? { ...item, reviewed: true, my_score: normalized.value }
          : item
      )));
      setEditingReviewed(false);
      if (nextRow && Number(nextRow.submission_id || 0) > 0) {
        setSelectedSubmissionId(Number(nextRow.submission_id));
        setMessage?.({ type: 'success', text: '评分已保存，已切换到下一个作品' });
      } else {
        setMessage?.({ type: 'success', text: '评分已保存' });
      }
    } catch (error) {
      setMessage?.({ type: 'error', text: getUserFriendlyErrorText(error, '保存评分失败') });
    } finally {
      setSaving(false);
    }
  };

  if (!normalizedCompetitionId || Number.isNaN(normalizedCompetitionId)) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">无效的比赛参数</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        pt: 0,
        px: { xs: 0.5, md: 0.8 },
        pb: { xs: 0.8, md: 1.2 },
        background: 'linear-gradient(150deg, #f6f0ff 0%, #ebe0ff 45%, #f8f4ff 100%)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid #ddcff2',
          overflow: 'hidden',
          background: 'linear-gradient(165deg, #ffffff 0%, #f7f1ff 100%)',
        }}
      >
        <Box
          sx={{
            px: { xs: 1.4, md: 2.2 },
            py: 1.1,
            borderBottom: '1px solid #e9def8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            background: 'linear-gradient(90deg, #ffffff 0%, #f4ecff 100%)',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#3f2467' }}>
              数智文献处理平台比赛 评审工作台
            </Typography>
          </Stack>
          <Chip
            size="small"
            color="secondary"
            variant="outlined"
            label={`评审时间：${formatTime(competition?.review_start)} ~ ${formatTime(competition?.review_end)}`}
          />
        </Box>
        <Box
          sx={{
            p: { xs: 0.9, md: 1.2 },
            display: 'grid',
            gap: 1.2,
            width: '100%',
            maxWidth: { md: 1680 },
            mx: 'auto',
            pr: { md: 0.6 },
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateAreas: {
                xs: '"list" "preview" "review"',
                md: '"list preview" "review review"',
                xl: '"list preview review"',
              },
              gridTemplateColumns: {
                xs: '1fr',
                md: '240px minmax(640px, 980px)',
                xl: '260px minmax(760px, 980px) minmax(380px, 460px)',
              },
              gap: 1.6,
              minHeight: { xs: 540, md: PREVIEW_PANEL_MIN_HEIGHT_DESKTOP },
              alignItems: 'start',
              justifyContent: 'center',
            }}
          >
            <Box sx={{ gridArea: 'list' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#553383', mb: 1 }}>
                作品列表
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  borderColor: '#ddcff2',
                  overflow: 'hidden',
                  background: '#fff',
                  boxShadow: '0 8px 24px rgba(90, 50, 145, 0.08)',
                }}
              >
                {listLoading ? (
                  <Stack alignItems="center" justifyContent="center" sx={{ height: { xs: 240, md: LIST_HEIGHT_DESKTOP } }} spacing={1}>
                    <CircularProgress size={26} />
                    <Typography variant="body2" color="text.secondary">加载中...</Typography>
                  </Stack>
                ) : !rows.length ? (
                  <Box sx={{ p: 2, minHeight: { xs: 240, md: LIST_HEIGHT_DESKTOP } }}>
                    <Alert severity="info">当前比赛暂无分配给你的作品</Alert>
                  </Box>
                ) : (
                  <List
                    disablePadding
                    sx={{
                      height: { xs: 240, md: LIST_HEIGHT_DESKTOP },
                      overflowY: 'scroll',
                      scrollbarGutter: 'stable',
                      scrollbarWidth: 'auto',
                      scrollbarColor: '#c8c8d2 #f3f3f8',
                      p: 1,
                      '&::-webkit-scrollbar': { width: 14 },
                      '&::-webkit-scrollbar-thumb': {
                        backgroundColor: '#ffffff',
                        backgroundImage: 'repeating-linear-gradient(180deg, rgba(186, 186, 194, 0.95) 0px, rgba(186, 186, 194, 0.95) 1px, rgba(255, 255, 255, 0.95) 1px, rgba(255, 255, 255, 0.95) 4px)',
                        borderRadius: 999,
                        border: '1px solid #b8b8c4',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(210,210,220,0.95), 0 2px 5px rgba(0,0,0,0.2)',
                      },
                      '&::-webkit-scrollbar-thumb:hover': {
                        borderColor: '#a8a8b6',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(196,196,209,0.95), 0 3px 6px rgba(0,0,0,0.24)',
                      },
                      '&::-webkit-scrollbar-track': {
                        background: 'linear-gradient(180deg, #ffffff 0%, #f7f7fb 100%)',
                        borderRadius: 999,
                        boxShadow: 'inset 0 0 0 1px rgba(208,208,220,0.95)',
                      },
                    }}
                  >
                    {rows.map((row, index) => {
                      const selected = Number(selectedSubmissionId) === Number(row.submission_id);
                      const listNo = index + 1;
                      return (
                        <ListItemButton
                          key={row.assignment_id || row.submission_id}
                          selected={selected}
                          onClick={() => setSelectedSubmissionId(Number(row.submission_id || 0))}
                          sx={{
                            width: '100%',
                            height: 44,
                            minHeight: 44,
                            maxHeight: 44,
                            alignSelf: 'flex-start',
                            flex: '0 0 auto',
                            py: 0.75,
                            px: 1.25,
                            mb: 0.65,
                            border: selected ? '2px solid #7b4dc2' : '1px solid #dfd1f4',
                            borderRadius: 1.5,
                            background: selected ? 'linear-gradient(120deg, #f6efff 0%, #ffffff 100%)' : '#fff',
                            boxShadow: selected ? '0 8px 20px rgba(85, 49, 134, 0.16)' : '0 4px 12px rgba(90, 50, 145, 0.06)',
                            '&:hover': {
                              borderColor: selected ? '#7446be' : '#c9afea',
                              background: selected ? 'linear-gradient(120deg, #f4ecff 0%, #ffffff 100%)' : '#fcf9ff',
                              boxShadow: selected ? '0 10px 22px rgba(85, 49, 134, 0.18)' : '0 8px 16px rgba(90, 50, 145, 0.12)',
                            },
                          }}
                        >
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
                            <Box
                              sx={{
                                width: 9,
                                height: 9,
                                borderRadius: '50%',
                                flexShrink: 0,
                                backgroundColor: row.reviewed ? '#2e7d32' : '#9e9e9e',
                                boxShadow: row.reviewed ? '0 0 0 2px rgba(46, 125, 50, 0.16)' : '0 0 0 2px rgba(158, 158, 158, 0.16)',
                              }}
                            />
                            <Typography
                              variant="body2"
                              sx={{
                                width: '100%',
                                fontWeight: selected ? 700 : 500,
                                color: selected ? '#43266f' : '#5a3b88',
                                lineHeight: 1.4,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {`${listNo}. ${row.title || '-'}`}
                            </Typography>
                          </Stack>
                        </ListItemButton>
                      );
                    })}
                    {rows.length <= 3 && (
                      <Box
                        component="li"
                        sx={{
                          listStyle: 'none',
                          width: '100%',
                          height: { xs: 220, md: 'calc(100% + 220px)' },
                        }}
                      />
                    )}
                  </List>
                )}
              </Paper>
            </Box>
            <Paper
              variant="outlined"
              sx={{
                gridArea: 'preview',
                width: '100%',
                justifySelf: 'center',
                borderRadius: 2,
                borderColor: '#dbcaf5',
                p: 1.2,
                display: 'grid',
                gridTemplateRows: 'auto 1fr',
                minHeight: { xs: 480, md: PREVIEW_PANEL_MIN_HEIGHT_DESKTOP },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 0.5, pb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: '#4e2f7f', fontWeight: 700 }}>
                  {selectedRow ? `作品：${selectedRow.title || `#${selectedRow.submission_id}`}` : '请选择作品'}
                </Typography>
                {previewDownloadUrl ? (
                  <Button size="small" variant="outlined" onClick={handleDownloadPreviewAttachment}>
                    下载附件
                  </Button>
                ) : null}
              </Stack>
              <Box sx={{ border: '1px solid #e9def8', borderRadius: 1.5, overflow: 'hidden', background: '#fff' }}>
                {detailLoading ? (
                  <Stack alignItems="center" justifyContent="center" sx={{ minHeight: { xs: 420, md: PREVIEW_MIN_HEIGHT_DESKTOP } }} spacing={1}>
                    <CircularProgress size={26} />
                    <Typography variant="body2" color="text.secondary">加载作品中...</Typography>
                  </Stack>
                ) : previewError ? (
                  <Box sx={{ p: 2.2 }}>
                    <Alert severity="warning">{previewError}</Alert>
                  </Box>
                ) : previewUrl ? (
                  <Box
                    sx={{
                      width: '100%',
                      minHeight: { xs: 420, md: PREVIEW_MIN_HEIGHT_DESKTOP },
                      height: 'auto',
                      background: '#f7f7fa',
                      display: 'flex',
                      justifyContent: 'flex-start',
                    }}
                  >
                    <Box sx={{ width: '100%' }}>
                      <iframe
                        title={previewName || 'submission-preview'}
                        src={pdfPreviewSrc || previewUrl}
                        style={{ width: '100%', height: PREVIEW_MIN_HEIGHT_DESKTOP, minHeight: PREVIEW_MIN_HEIGHT_DESKTOP, border: 'none' }}
                      />
                    </Box>
                  </Box>
                ) : previewDocxSrcDoc ? (
                  <Box
                    sx={{
                      width: '100%',
                      minHeight: { xs: 420, md: PREVIEW_MIN_HEIGHT_DESKTOP },
                      height: 'auto',
                      background: '#f7f7fa',
                      display: 'flex',
                      justifyContent: 'flex-start',
                    }}
                  >
                    <Box sx={{ width: '100%' }}>
                      <iframe
                        title={previewName || 'submission-docx-preview'}
                        srcDoc={previewDocxSrcDoc}
                        style={{ width: '100%', height: PREVIEW_MIN_HEIGHT_DESKTOP, minHeight: PREVIEW_MIN_HEIGHT_DESKTOP, border: 'none' }}
                      />
                    </Box>
                  </Box>
                ) : (
                  <Stack alignItems="center" justifyContent="center" sx={{ minHeight: { xs: 420, md: PREVIEW_MIN_HEIGHT_DESKTOP } }}>
                    <Typography variant="body2" color="text.secondary">请选择左侧作品开始评审</Typography>
                  </Stack>
                )}
              </Box>
            </Paper>

            <Paper
              variant="outlined"
              sx={{
                gridArea: 'review',
                borderRadius: 2,
                borderColor: '#dbcaf5',
                p: { xs: 1.2, md: 1.6 },
                alignSelf: { xs: 'stretch', md: 'start' },
                mt: { xs: 0, md: 0, xl: 'clamp(48px, 7vh, 110px)' },
                justifySelf: 'stretch',
              }}
            >
              <Stack spacing={1.2}>
                {!reviewPermission.canScore && (
                  <Alert severity="warning">{reviewPermission.message}</Alert>
                )}
                <Typography variant="subtitle2" sx={{ color: '#4e2f7f', fontWeight: 700 }}>
                  评分与评语
                </Typography>
                <TextField
                  label="评分（0-100）"
                  type="number"
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  inputProps={{ min: 0, max: 100, step: 0.5 }}
                  disabled={!canEditReviewFields}
                  fullWidth
                />
                <TextField
                  label="评语（可选）"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  disabled={!canEditReviewFields}
                  multiline
                  minRows={20}
                  maxRows={20}
                  fullWidth
                  helperText="最多 2000 字"
                  sx={{
                    '& .MuiInputBase-inputMultiline': {
                      overflowY: 'auto !important',
                    },
                  }}
                />
                <Stack direction="row" justifyContent="flex-end">
                  {!selectedReviewed && (
                    <Button
                      variant="contained"
                      startIcon={<SaveRoundedIcon />}
                      disabled={!canEditReviewFields}
                      onClick={saveReview}
                      sx={{ minWidth: 132 }}
                    >
                      {saving ? '保存中...' : '保存评分'}
                    </Button>
                  )}
                  {selectedReviewed && !editingReviewed && (
                    <Button
                      variant="contained"
                      disabled={!selectedRow || saving || !reviewPermission.canScore}
                      onClick={() => setEditingReviewed(true)}
                      sx={{ minWidth: 132 }}
                    >
                      修改评分
                    </Button>
                  )}
                  {selectedReviewed && editingReviewed && (
                    <Button
                      variant="contained"
                      startIcon={<SaveRoundedIcon />}
                      disabled={!canEditReviewFields}
                      onClick={saveReview}
                      sx={{ minWidth: 132 }}
                    >
                      {saving ? '保存中...' : '确定修改'}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
