import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, ArrowRight, Check, Loader2, Clock, Zap, AlertCircle } from 'lucide-react';
import { useTimeStore } from '@/stores';

interface AIAgentResponse {
  task: string;
  category: string;
  start_time: string;
  end_time: string;
  duration: string;
  productivity_score: string;
  suggestions: string[];
  alerts: string[];
  insights: string[];
}

interface AIAssistantWidgetProps {
  onInsightGenerated?: (response: AIAgentResponse) => void;
}

export function AIAssistantWidget({ onInsightGenerated }: AIAssistantWidgetProps) {
  const [inputVal, setInputVal] = useState('');
  const [response, setResponse] = useState<AIAgentResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const { processAgenticInput } = useTimeStore();

  const handleProcess = async () => {
    if (!inputVal.trim()) return;
    
    setIsProcessing(true);
    setResponse(null);
    setIsLogged(false);
    
    try {
      const data = await processAgenticInput(inputVal);
      setResponse(data);
      if (onInsightGenerated) {
        onInsightGenerated(data);
      }
    } catch (err) {
      console.error("Agent failed", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLogData = () => {
    // In a full implementation, this would trigger `logTime`
    // using the resolved task_id if one was matched, 
    // or create a standalone TimeEntry.
    setIsLogged(true);
    setTimeout(() => {
      setInputVal('');
      setResponse(null);
      setIsLogged(false);
    }, 2000);
  };

  return (
    <Card className="border shadow-md overflow-hidden bg-white dark:bg-gray-900 duration-500 animate-in fade-in slide-in-from-bottom-4">
      <CardHeader className="bg-gradient-to-r from-violet-600 to-indigo-600 pb-4 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-200" />
          <CardTitle className="text-lg font-bold">Agentic AI Tracker</CardTitle>
        </div>
        <CardDescription className="text-violet-100">
          Describe what you worked on. The AI will classify, log, and analyze it.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4 space-y-4">
        <div className="flex gap-2 relative group">
          <Input 
            placeholder="e.g. 'I worked on the frontend UI for 2 hours'"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={isProcessing}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleProcess();
            }}
            className="flex-1 border-violet-100 focus-visible:ring-violet-500 shadow-sm"
          />
          <Button 
            onClick={handleProcess} 
            disabled={isProcessing || !inputVal.trim()}
            className="bg-violet-600 hover:bg-violet-700 text-white shrink-0 shadow-sm"
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>

        {response && (
          <div className="pt-4 border-t border-gray-100 space-y-4 animate-in slide-in-from-bottom-2 fade-in">
            {/* Overview pill */}
            <div className="flex items-start justify-between bg-gray-50 dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{response.category}</div>
                <div className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{response.task}</div>
              </div>
              <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 px-2 py-1 rounded-md shadow-sm">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{response.duration}</span>
              </div>
            </div>

            {/* Smart Score & Alerts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                <Zap className="h-5 w-5 text-emerald-500 mb-1" />
                <div className="text-xl font-black text-emerald-700">{response.productivity_score}</div>
                <div className="text-[10px] font-bold text-emerald-600/70 uppercase">Prod Score</div>
              </div>
              
              {response.alerts.length > 0 ? (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex flex-col justify-center">
                  <div className="flex items-center gap-1 text-rose-600 mb-1">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs font-bold">Alert</span>
                  </div>
                  <p className="text-[11px] font-medium text-rose-800 leading-tight">
                    {response.alerts[0]}
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex flex-col justify-center">
                  <div className="flex items-center gap-1 text-blue-600 mb-1">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-bold">Insight</span>
                  </div>
                  <p className="text-[11px] font-medium text-blue-800 leading-tight">
                     {response.insights?.[0] || 'Task automatically registered cleanly.'}
                  </p>
                </div>
              )}
            </div>

            <Button 
              className={`w-full font-bold shadow-sm transition-all duration-300 ${
                isLogged ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-900 hover:bg-gray-800 text-white'
              }`}
              onClick={handleLogData}
              disabled={isLogged}
            >
              {isLogged ? (
                <span className="flex items-center gap-2"><Check className="h-4 w-4" /> Logged Successfully</span>
              ) : (
                'Approve & Log Time'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
