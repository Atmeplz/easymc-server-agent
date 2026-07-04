/*
 * AI maintenance note: Keep all code comments in English.
 */
import { useState, useEffect, useCallback } from 'react';
import { X, Download, CheckCircle, AlertCircle, Loader2, Server, ChevronRight } from 'lucide-react';

const CORE_INFO = {
  vanilla: { icon: '🟫', color: 'text-yellow-400' },
  paper:   { icon: '📄', color: 'text-white' },
  purpur:  { icon: '💜', color: 'text-purple-400' },
  fabric:  { icon: '🧵', color: 'text-amber-400' },
  forge:   { icon: '🔨', color: 'text-orange-400' },
};

export default function DeployWizard({ emit, on, onClose, onComplete }) {
  const [step, setStep] = useState(1); // 1=type selection, 2=version selection, 3=deploying, 4=complete
  const [coreTypes, setCoreTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [deployProgress, setDeployProgress] = useState(null);
  const [deploySteps, setDeploySteps] = useState([]);
  const [result, setResult] = useState(null);

  // Load core types.
  useEffect(() => {
    emit('deploy:get_types', {});
    const unsub = on('deploy:types', (types) => setCoreTypes(types));
    return unsub;
  }, [emit, on]);

  // Load version list.
  const loadVersions = useCallback((coreType) => {
    setLoadingVersions(true);
    setVersions([]);
    emit('deploy:get_versions', { coreType });
  }, [emit]);

  useEffect(() => {
    const unsub = on('deploy:versions', ({ coreType, versions: v }) => {
      if (coreType === selectedType) {
        // Versions may be object arrays or string arrays.
        const normalized = v.map(item =>
          typeof item === 'string' ? item : item.id || item.version
        ).filter(Boolean);
        setVersions(normalized);
        setLoadingVersions(false);
      }
    });
    return unsub;
  }, [on, selectedType]);

  // Listen for deployment events.
  useEffect(() => {
    const unsubs = [
      on('deploy:step', (data) => {
        setDeploySteps(prev => [...prev, data]);
      }),
      on('deploy:progress', (data) => {
        setDeployProgress(data);
      }),
      on('deploy:java_progress', (data) => {
        setDeployProgress(prev => ({ ...prev, java: data }));
      }),
      on('deploy:complete', (data) => {
        setResult(data);
        setStep(4);
      }),
      on('deploy:error', (data) => {
        setResult({ success: false, error: data.error });
        setStep(4);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [on]);

  const handleSelectType = (type) => {
    setSelectedType(type);
    setStep(2);
    loadVersions(type);
  };

  const handleDeploy = () => {
    if (!selectedType || !selectedVersion) return;
    setStep(3);
    setDeploySteps([]);
    setDeployProgress(null);
    emit('deploy:start', { coreType: selectedType, version: selectedVersion });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-mc-dark border border-mc-border rounded-xl w-[560px] max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-mc-border">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-mc-aqua" />
            <h2 className="text-lg font-semibold text-white">服务器部署向导</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-mc-panel rounded-md transition-colors text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-mc-border/50">
          {['选择核心', '选择版本', '部署中', '完成'].map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step > i + 1 ? 'bg-green-600 text-white' :
                step === i + 1 ? 'bg-mc-aqua text-mc-darker' :
                'bg-mc-panel text-gray-500'
              }`}>
                {step > i + 1 ? '✓' : i + 1}
              </span>
              <span className={`text-xs ${step === i + 1 ? 'text-white' : 'text-gray-500'}`}>{label}</span>
              {i < 3 && <ChevronRight size={12} className="text-gray-600" />}
            </div>
          ))}
        </div>

        <div className="p-4">
          {/* Step 1: choose core type */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400 mb-4">选择要部署的服务端类型：</p>
              <div className="grid grid-cols-2 gap-3">
                {coreTypes.map(ct => {
                  const info = CORE_INFO[ct.id] || {};
                  return (
                    <button
                      key={ct.id}
                      onClick={() => handleSelectType(ct.id)}
                      className="flex items-start gap-3 p-3 bg-mc-panel hover:bg-mc-border border border-mc-border hover:border-mc-aqua/30 rounded-lg transition-all text-left"
                    >
                      <span className="text-2xl">{info.icon || '📦'}</span>
                      <div>
                        <p className={`text-sm font-medium ${info.color || 'text-white'}`}>{ct.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{ct.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: choose version */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setStep(1)} className="text-xs text-mc-aqua hover:underline">← 返回</button>
                <p className="text-sm text-gray-400">
                  {CORE_INFO[selectedType]?.icon} {selectedType} — 选择版本：
                </p>
              </div>

              {loadingVersions ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 size={20} className="animate-spin mr-2" /> 获取版本列表...
                </div>
              ) : (
                <>
                  <div className="max-h-60 overflow-y-auto space-y-1 bg-mc-darker rounded-lg p-2">
                    {versions.slice(0, 30).map(v => (
                      <button
                        key={v}
                        onClick={() => setSelectedVersion(v)}
                        className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                          selectedVersion === v
                            ? 'bg-mc-aqua/20 text-mc-aqua border border-mc-aqua/30'
                            : 'text-gray-300 hover:bg-mc-panel'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  {versions.length > 30 && (
                    <p className="text-xs text-gray-600">显示前 30 个版本（共 {versions.length} 个）</p>
                  )}
                  <button
                    onClick={handleDeploy}
                    disabled={!selectedVersion}
                    className="w-full mt-3 py-2 bg-mc-aqua/20 hover:bg-mc-aqua/30 disabled:opacity-30 text-mc-aqua rounded-lg transition-colors text-sm font-medium"
                  >
                    <Download size={16} className="inline mr-2" />
                    部署 {selectedType} {selectedVersion}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step 3: deployment progress */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                {deploySteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle size={14} className="text-green-400 shrink-0" />
                    <span className="text-gray-300">{s.message}</span>
                  </div>
                ))}
                {deploySteps.length === 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 size={14} className="animate-spin" /> 准备中...
                  </div>
                )}
              </div>

              {deployProgress && deployProgress.total > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>下载中...</span>
                    <span>{deployProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-mc-darker rounded-full h-2">
                    <div
                      className="bg-mc-aqua h-2 rounded-full transition-all duration-300"
                      style={{ width: `${deployProgress.percent}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {(deployProgress.downloaded / 1024 / 1024).toFixed(1)} MB / {(deployProgress.total / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: complete */}
          {step === 4 && result && (
            <div className="text-center py-6">
              {result.success ? (
                <>
                  <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-white mb-2">部署完成！</h3>
                  <div className="text-sm text-gray-400 space-y-1">
                    <p>核心: {result.coreType} {result.version}</p>
                    <p>Java: {result.javaVersion}</p>
                    <p className="text-xs text-gray-600 mt-2">{result.serverDir}</p>
                  </div>
                  <button
                    onClick={() => { onComplete?.(); onClose(); }}
                    className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                  >
                    启动服务器
                  </button>
                </>
              ) : (
                <>
                  <AlertCircle size={48} className="text-red-400 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-white mb-2">部署失败</h3>
                  <p className="text-sm text-red-300">{result.error || result.message}</p>
                  <button
                    onClick={() => { setStep(1); setResult(null); }}
                    className="mt-4 px-6 py-2 bg-mc-panel hover:bg-mc-border text-white rounded-lg transition-colors text-sm"
                  >
                    重试
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
