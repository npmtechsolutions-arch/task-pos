import { useState } from 'react';
import { Shield, Users, Bell, Layers, Workflow, Sliders, TicketIcon, CreditCard, Box } from 'lucide-react';
import { SupportTicketSystem } from './SupportTicketSystem';

const SETTINGS_TABS = [
  { id: 'general', label: 'General', icon: Sliders },
  { id: 'users', label: 'Users & Roles', icon: Users },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'issues', label: 'Task / Issue Settings', icon: Layers },
  { id: 'workflows', label: 'Workflows', icon: Workflow },
  { id: 'support', label: 'Support System', icon: TicketIcon },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('support');

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Box className="w-6 h-6 text-indigo-600" />
            Workspace Settings
          </h2>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="space-y-1">
            {SETTINGS_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900/50">
        <div className={`${activeTab === 'support' ? 'max-w-full' : 'max-w-5xl'} mx-auto p-8 transition-all duration-500`}>
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {SETTINGS_TABS.find(t => t.id === activeTab)?.label}
            </h1>
            <p className="text-base text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Manage your workspace configuration and preferences.
            </p>
          </div>

          {activeTab === 'support' ? (
            <div className="anim-fade-in">
              <SupportTicketSystem />
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden p-12 text-center text-slate-500 anim-fade-in">
              <Sliders className="w-12 h-12 mx-auto mb-4 text-slate-400 opacity-50" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Coming Soon</h3>
              <p>The {SETTINGS_TABS.find(t => t.id === activeTab)?.label} module is currently under development.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
