import { useEffect, useState } from 'react';
import { Coffee, KeyRound, Loader2, Save, Server } from 'lucide-react';
import { PARKED_FEATURES } from '../../constants/app.js';
import PageShell from '../ui/PageShell.jsx';
import SetupRow from './SetupRow.jsx';
import ToggleSwitch from './ToggleSwitch.jsx';

export default function BasicSetupPage({ properties, setProperties, configForm, setConfigForm, javaStatus, setupSaving, setupNotice, saveSetup }) {
  const [coreInfo, setCoreInfo] = useState({ name: 'unknown', version: 'unknown', supportsMods: false, supportsPlugins: false });
  const [coreDialogOpen, setCoreDialogOpen] = useState(false);
  const [coreUploading, setCoreUploading] = useState(false);
  const [javaDialogOpen, setJavaDialogOpen] = useState(false);
  const [javaScanning, setJavaScanning] = useState(false);
  const [scannedJavas, setScannedJavas] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/server/core')
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setCoreInfo(data);
      })
      .catch(() => {
        if (!cancelled) setCoreInfo({ name: 'unknown', version: 'unknown', supportsMods: false, supportsPlugins: false });
      });
    return () => { cancelled = true; };
  }, []);

  const javaMajor = javaStatus?.javas?.[0]?.majorVersion;
  const currentGamemode = properties.hardcore === 'true' ? 'hardcore' : (properties.gamemode || 'survival');

  const handleJarSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCoreUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const response = await fetch('/api/server/core/jar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, fileData: base64 }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || '核心替换失败');
      const info = await fetch('/api/server/core').then(res => res.json());
      setCoreInfo(info);
      setCoreDialogOpen(false);
    } catch (err) {
      alert(`核心替换失败: ${err.message}`);
    } finally {
      setCoreUploading(false);
      event.target.value = '';
    }
  };

  const handleJavaFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const javaPath = file.path || file.name;
    setConfigForm(prev => ({ ...prev, javaPath }));
    setJavaDialogOpen(false);
    event.target.value = '';
  };

  const scanForJavas = async () => {
    setJavaScanning(true);
    try {
      const data = await fetch('/api/java/scan').then(res => res.json());
      setScannedJavas(data.javas || []);
    } catch (err) {
      alert(`扫描失败: ${err.message}`);
    } finally {
      setJavaScanning(false);
    }
  };

  const selectScannedJava = (javaPath) => {
    setConfigForm(prev => ({ ...prev, javaPath }));
    setJavaDialogOpen(false);
    setScannedJavas([]);
  };

  return (
    <PageShell
      title="Server Basic Setup"
      action={
        <button
          onClick={saveSetup}
          disabled={setupSaving}
          className="rounded-full bg-md-primary px-5 py-2 text-sm font-bold text-md-onPrimary shadow-sm disabled:opacity-50 flex items-center gap-2"
        >
          {setupSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
        </button>
      }
    >
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Core cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-4 flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-md-primaryContainer flex items-center justify-center text-md-onPrimaryContainer shrink-0">
              <Server size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold truncate">{coreInfo.name} {coreInfo.version}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${coreInfo.supportsMods ? 'bg-md-success' : 'bg-md-error'}`} />
                  Mods
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${coreInfo.supportsPlugins ? 'bg-md-success' : 'bg-md-error'}`} />
                  Plugins
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-md-outline">服务器核心</span>
                <button onClick={() => setCoreDialogOpen(true)} className="text-sm text-md-primary hover:opacity-80">更换&gt;</button>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-4 flex items-center gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-md-secondaryContainer flex items-center justify-center text-md-onSecondaryContainer shrink-0">
              <Coffee size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold truncate">JDK {javaMajor ?? 'unknown'}</div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-md-outline">Java版本</span>
                <button onClick={() => setJavaDialogOpen(true)} className="text-sm text-md-primary hover:opacity-80">更换&gt;</button>
              </div>
            </div>
          </div>
        </section>

        {/* Game mode */}
        <div className="rounded-[24px] bg-md-surfaceContainer shadow-sm border border-md-surfaceVariant px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold">游戏默认模式</p>
            <p className="text-xs text-md-outline">默认进入游戏时的模式</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {[
              { value: 'survival', label: '生存' },
              { value: 'creative', label: '创造' },
              { value: 'hardcore', label: '极限' },
              { value: 'adventure', label: '冒险' },
            ].map(option => {
              const selected = currentGamemode === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setProperties(prev => {
                    if (option.value === 'hardcore') {
                      return { ...prev, gamemode: 'survival', hardcore: 'true' };
                    }
                    return { ...prev, gamemode: option.value, hardcore: 'false' };
                  })}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                    selected
                      ? 'bg-md-primary text-md-onPrimary'
                      : 'bg-md-surfaceVariant text-md-outline hover:bg-md-surfaceVariant/80'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Difficulty */}
        <div className="rounded-[24px] bg-md-surfaceContainer shadow-sm border border-md-surfaceVariant px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold">世界难度</p>
            <p className="text-xs text-md-outline">怪物生成与伤害倍率</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {[
              { value: 'peaceful', label: '和平' },
              { value: 'easy', label: '简单' },
              { value: 'normal', label: '普通' },
              { value: 'hard', label: '困难' },
            ].map(option => {
              const selected = (properties.difficulty || 'easy') === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setProperties(prev => ({ ...prev, difficulty: option.value }))}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                    selected
                      ? 'bg-md-primary text-md-onPrimary'
                      : 'bg-md-surfaceVariant text-md-outline hover:bg-md-surfaceVariant/80'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Online mode */}
        <div className="rounded-[24px] bg-md-surfaceContainer shadow-sm border border-md-surfaceVariant px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold">正版验证</p>
            <p className="text-xs text-md-outline">关闭后离线玩家可进入</p>
          </div>
          <ToggleSwitch
            checked={properties['online-mode'] === 'true'}
            onChange={checked => setProperties(prev => ({ ...prev, 'online-mode': checked ? 'true' : 'false' }))}
          />
        </div>

        {/* Allow flight */}
        <div className="rounded-[24px] bg-md-surfaceContainer shadow-sm border border-md-surfaceVariant px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold">允许飞行</p>
            <p className="text-xs text-md-outline">允许玩家在空中飞行</p>
          </div>
          <ToggleSwitch
            checked={properties['allow-flight'] === 'true'}
            onChange={checked => setProperties(prev => ({ ...prev, 'allow-flight': checked ? 'true' : 'false' }))}
          />
        </div>

        <section>
          <h2 className="text-xl font-medium text-md-primary mb-3">Runtime & Agent</h2>
          <div className="grid grid-cols-1 gap-3">
            <SetupRow
              label="Server Directory"
              hint="Minecraft 服务端目录"
              value={configForm.serverDir}
              onChange={value => setConfigForm(prev => ({ ...prev, serverDir: value }))}
            />
            <SetupRow
              label="JVM Memory"
              hint="最大内存，单位 MB"
              value={configForm.jvmMemory}
              onChange={value => setConfigForm(prev => ({ ...prev, jvmMemory: value }))}
            />
            <SetupRow
              label="AI Base URL"
              hint="OpenAI-compatible API 地址"
              value={configForm.baseUrl}
              onChange={value => setConfigForm(prev => ({ ...prev, baseUrl: value }))}
            />
            <SetupRow
              label="AI Model"
              hint="Agent 使用的模型名称"
              value={configForm.model}
              onChange={value => setConfigForm(prev => ({ ...prev, model: value }))}
            />
            <SetupRow
              label="API Key"
              hint="留空则不修改已保存的 Key"
              value={configForm.apiKey}
              type="password"
              onChange={value => setConfigForm(prev => ({ ...prev, apiKey: value }))}
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-medium text-md-primary mb-3">Parked Draft Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PARKED_FEATURES.map(feature => (
              <div key={feature.title} className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-4 flex gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-md-primaryContainer flex items-center justify-center text-md-onPrimaryContainer shrink-0">
                  <feature.icon size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">{feature.title}</h3>
                  <p className="text-xs text-md-outline mt-1 leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] bg-md-surfaceContainer border border-md-surfaceVariant p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-md-secondaryContainer flex items-center justify-center text-md-onSecondaryContainer">
            <KeyRound size={22} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm">Java Status</p>
            <p className="text-xs text-md-outline mt-1">
              {javaStatus?.found ? `Detected Java ${javaStatus.javas?.[0]?.majorVersion} (${javaStatus.javas?.[0]?.source})` : 'Java has not been detected yet.'}
            </p>
          </div>
        </section>

        {setupNotice && (
          <div className="rounded-[20px] bg-md-primaryContainer/55 px-4 py-3 text-sm text-md-onPrimaryContainer">
            {setupNotice}
          </div>
        )}
      </div>

      {/* Core replacement dialog */}
      {coreDialogOpen && (
        <div className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-md-scrim/50 backdrop-blur-sm p-4">
          <div className="dialog-content rounded-[28px] bg-md-surfaceContainer border border-md-surfaceVariant shadow-lg max-w-sm w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Server size={22} className="text-md-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold">更换服务器核心</h3>
                <p className="text-sm text-md-outline mt-1">选择一个服务端 jar 文件替换当前的 server.jar。原 jar 会被备份。</p>
              </div>
            </div>
            <label className="block">
              <input type="file" accept=".jar" className="hidden" onChange={handleJarSelect} />
              <span className="block w-full text-center rounded-full px-4 py-3 text-sm font-bold bg-md-primary text-md-onPrimary hover:opacity-90 transition cursor-pointer">
                {coreUploading ? <Loader2 size={16} className="animate-spin inline" /> : '从文件资源管理器选择'}
              </span>
            </label>
            <div className="flex justify-end">
              <button onClick={() => setCoreDialogOpen(false)} className="rounded-full px-4 py-2 text-sm font-bold bg-md-surfaceVariant text-md-outline hover:bg-md-surfaceVariant/80 transition">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JDK selection dialog */}
      {javaDialogOpen && (
        <div className="dialog-backdrop fixed inset-0 z-50 flex items-center justify-center bg-md-scrim/50 backdrop-blur-sm p-4">
          <div className="dialog-content rounded-[28px] bg-md-surfaceContainer border border-md-surfaceVariant shadow-lg max-w-md w-full p-5 space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-start gap-3">
              <Coffee size={22} className="text-md-secondary shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold">更换 Java 版本</h3>
                <p className="text-sm text-md-outline mt-1">选择一个已安装的 JDK，或扫描系统查找可用 JDK。</p>
              </div>
            </div>
            <label className="block">
              <input type="file" accept=".exe,.cmd,.bat,.sh" className="hidden" onChange={handleJavaFileSelect} />
              <span className="block w-full text-center rounded-full px-4 py-3 text-sm font-bold bg-md-primary text-md-onPrimary hover:opacity-90 transition cursor-pointer">
                从文件资源管理器选择
              </span>
            </label>
            <button
              onClick={scanForJavas}
              disabled={javaScanning}
              className="w-full rounded-full px-4 py-3 text-sm font-bold bg-md-secondaryContainer text-md-onSecondaryContainer hover:bg-md-secondaryContainer/80 transition disabled:opacity-50"
            >
              {javaScanning ? <Loader2 size={16} className="animate-spin inline" /> : '扫描可用 JDK'}
            </button>
            {scannedJavas.length > 0 && (
              <div className="overflow-y-auto space-y-2 pr-1 max-h-48">
                {scannedJavas.map(j => (
                  <button
                    key={j.path}
                    onClick={() => selectScannedJava(j.path)}
                    className="w-full text-left rounded-[18px] bg-md-surface border border-md-surfaceVariant px-4 py-3 hover:border-md-primary transition"
                  >
                    <p className="text-sm font-bold">Java {j.majorVersion}</p>
                    <p className="text-xs text-md-outline truncate">{j.path}</p>
                    <p className="text-xs text-md-primary">来源: {j.source}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => { setJavaDialogOpen(false); setScannedJavas([]); }} className="rounded-full px-4 py-2 text-sm font-bold bg-md-surfaceVariant text-md-outline hover:bg-md-surfaceVariant/80 transition">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
