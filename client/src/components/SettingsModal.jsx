/*
 * AI maintenance note: Keep all code comments in English.
 */
import { useState, useEffect } from 'react';
import { X, Save, Key, Server, Cpu, Loader2 } from 'lucide-react';

export default function SettingsModal({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Form state.
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('gpt-4o-mini');
  const [serverDir, setServerDir] = useState('./mc-server');
  const [jvmMemory, setJvmMemory] = useState('2048');

  // Load current configuration when opened.
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => {
        if (cfg.ai) {
          setBaseUrl(cfg.ai.baseUrl || 'https://api.openai.com/v1');
          setModel(cfg.ai.model || 'gpt-4o-mini');
          // apiKey is returned as '***' when configured; an empty value means it is not configured.
          setApiKey('');
        }
        if (cfg.mc) {
          setServerDir(cfg.mc.serverDir || './mc-server');
          const memArg = (cfg.mc.jvmArgs || []).find(a => a.startsWith('-Xmx'));
          if (memArg) setJvmMemory(memArg.replace('-Xmx', '').replace('M', '').replace('G', '000'));
        }
      })
      .catch(() => setError('加载配置失败'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const payload = {
        ai: {
          baseUrl,
          model,
        },
        mc: {
          serverDir,
          jvmArgs: [`-Xmx${jvmMemory}M`, `-Xms${Math.floor(parseInt(jvmMemory) / 2)}M`],
        },
      };
      // Send the key only when the user entered a new one.
      if (apiKey.trim()) {
        payload.ai.apiKey = apiKey.trim();
      }

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSaved(true);
        if (apiKey.trim()) setApiKey(''); // Clear the input field.
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(data.error || '保存失败');
      }
    } catch (e) {
      setError('保存失败: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        className="bg-mc-dark border border-mc-border rounded-xl w-[500px] max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-mc-border">
          <h2 className="text-lg font-semibold text-white">设置</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-mc-panel rounded-md transition-colors text-gray-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 size={20} className="animate-spin mr-2" />
            加载中...
          </div>
        ) : (
          <>
            {/* Settings content */}
            <div className="p-4 space-y-6">
              {/* AI settings */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-medium text-mc-aqua mb-3">
                  <Key size={16} />
                  AI Agent 配置
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="留空则不修改已有的 Key"
                      className="w-full bg-mc-darker border border-mc-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-mc-aqua/50"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      支持 OpenAI / DeepSeek / 通义千问等兼容接口
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">API Base URL</label>
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      className="w-full bg-mc-darker border border-mc-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-mc-aqua/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">模型</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full bg-mc-darker border border-mc-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-mc-aqua/50"
                    />
                  </div>
                </div>
              </section>

              {/* Server settings */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-medium text-mc-gold mb-3">
                  <Server size={16} />
                  服务器配置
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">服务器目录</label>
                    <input
                      type="text"
                      value={serverDir}
                      onChange={(e) => setServerDir(e.target.value)}
                      className="w-full bg-mc-darker border border-mc-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-mc-aqua/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">JVM 内存</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={jvmMemory}
                        onChange={(e) => setJvmMemory(e.target.value)}
                        className="flex-1 bg-mc-darker border border-mc-border rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-mc-aqua/50"
                      />
                      <span className="flex items-center text-xs text-gray-500">MB</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Java settings */}
              <section>
                <h3 className="flex items-center gap-2 text-sm font-medium text-mc-green mb-3">
                  <Cpu size={16} />
                  Java 环境
                </h3>
                <p className="text-xs text-gray-500">
                  Java 环境会在启动时自动检测。如需手动指定，请在 config.local.json 中设置 java.customPath。
                </p>
              </section>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-2 p-4 border-t border-mc-border">
              {error && (
                <span className="text-xs text-red-400 mr-auto">{error}</span>
              )}
              {saved && (
                <span className="text-xs text-mc-green mr-auto">✓ 已保存并生效</span>
              )}
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                关闭
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-mc-aqua/20 hover:bg-mc-aqua/30 disabled:opacity-40 text-mc-aqua rounded-md transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
