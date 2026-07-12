import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import PageShell from '../ui/PageShell.jsx';

export default function AgentPromptsPage({ prompts, onPromptsSaved }) {
  const [activeTab, setActiveTab] = useState('admin');
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!prompts) {
    return (
      <PageShell title="Prompt Settings">
        <div className="flex-1 flex items-center justify-center text-md-outline">
          <Loader2 size={22} className="animate-spin mr-2" /> 加载中...
        </div>
      </PageShell>
    );
  }

  const currentPrompt = activeTab === 'admin' ? prompts.prompts?.admin : prompts.prompts?.player;

  const handleEditClick = () => {
    setDraft(currentPrompt || '');
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = activeTab === 'admin'
        ? { admin: draft }
        : { player: draft };
      const response = await fetch('/api/agent/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || '保存失败');
      setIsEditing(false);
      onPromptsSaved?.();
    } catch (err) {
      alert(`保存失败: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setIsEditing(false);
    setDraft('');
  };

  return (
    <PageShell title="Prompt Settings">
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        <div className="rounded-[20px] bg-md-warning/10 border border-md-warning/30 px-5 py-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-md-warning shrink-0" />
          <div>
            <p className="text-sm font-bold text-md-warning">{prompts.notice || '不建议修改'}</p>
            <p className="text-xs text-md-outline mt-0.5">以下提示词由系统生成并直接用于 Agent 运行，不当修改可能导致 Agent 行为异常。</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab('admin');
              setIsEditing(false);
            }}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              activeTab === 'admin'
                ? 'bg-md-primary text-md-onPrimary shadow-sm'
                : 'bg-md-surfaceVariant/60 text-md-outline hover:bg-md-surfaceVariant'
            }`}
          >
            管理员 Prompt
          </button>
          <button
            onClick={() => {
              setActiveTab('player');
              setIsEditing(false);
            }}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              activeTab === 'player'
                ? 'bg-md-primary text-md-onPrimary shadow-sm'
                : 'bg-md-surfaceVariant/60 text-md-outline hover:bg-md-surfaceVariant'
            }`}
          >
            玩家 Prompt
          </button>
        </div>

        <div className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-md-surfaceVariant/60 flex items-center justify-between">
            <span className="text-xs font-bold text-md-outline">
              {activeTab === 'admin' ? '管理员系统提示词（Web 端完全权限）' : '玩家系统提示词（游戏内 @agent，受限权限）'}
            </span>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDiscard}
                  disabled={saving}
                  className="rounded-full px-3 py-1.5 text-[11px] font-bold bg-md-surfaceVariant text-md-outline hover:bg-md-surfaceVariant/80 transition"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-full px-3 py-1.5 text-[11px] font-bold bg-md-success text-white hover:opacity-90 transition flex items-center gap-1"
                >
                  {saving && <Loader2 size={12} className="animate-spin" />}
                  保存
                </button>
              </div>
            ) : (
              <button
                onClick={handleEditClick}
                className="rounded-full px-3 py-1.5 text-[11px] font-bold bg-md-primaryContainer text-md-onPrimaryContainer hover:bg-md-primaryContainer/80 transition"
              >
                修改
              </button>
            )}
          </div>
          {isEditing ? (
            <textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              className="w-full p-5 text-sm leading-relaxed text-md-onPrimaryContainer whitespace-pre-wrap bg-md-bg/50 max-h-[60vh] min-h-[300px] outline-none resize-y font-sans"
              spellCheck={false}
            />
          ) : (
            <pre className="p-5 text-sm leading-relaxed text-md-onPrimaryContainer whitespace-pre-wrap font-sans overflow-x-auto bg-md-bg/50 max-h-[60vh]">
              {currentPrompt || '暂无内容'}
            </pre>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-md-scrim/50 backdrop-blur-sm p-4">
          <div className="dialog-content rounded-[28px] bg-md-surfaceContainer border border-md-surfaceVariant shadow-lg max-w-sm w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={22} className="text-md-warning shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold">不建议修改</h3>
                <p className="text-sm text-md-outline mt-1">提示词直接影响 Agent 行为，修改后可能导致意外结果。真的要修改吗？</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancel}
                className="rounded-full px-4 py-2 text-sm font-bold bg-md-surfaceVariant text-md-outline hover:bg-md-surfaceVariant/80 transition"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-full px-4 py-2 text-sm font-bold bg-md-primary text-md-onPrimary hover:opacity-90 transition"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
