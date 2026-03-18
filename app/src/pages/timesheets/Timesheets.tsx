import { TimesheetGrid } from '@/components/timesheets/TimesheetGrid';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, Clock, CheckCircle2, TrendingUp } from 'lucide-react';

export default function TimesheetsPage() {
  return (
    <div className="container mx-auto p-6 max-w-7xl animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Timesheets</h1>
          <p className="text-gray-500 mt-1">Manage your work logs, track billable hours, and submit for approval.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border shadow-sm">
          <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-blue-600/60 leading-none">Logged Today</span>
              <span className="text-sm font-bold text-blue-700 leading-tight">6.5h</span>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-green-50 border border-green-100 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-green-600/60 leading-none">Weekly Status</span>
              <span className="text-sm font-bold text-green-700 leading-tight">On Track</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Grid */}
        <div className="lg:col-span-3">
          <TimesheetGrid />
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <Card className="border-none shadow-md bg-gradient-to-br from-indigo-600 to-blue-700 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <TrendingUp className="h-24 w-24" />
            </div>
            <CardHeader className="relative">
              <CardTitle className="text-xl font-bold">Smart Insights</CardTitle>
              <CardDescription className="text-blue-100">AI-driven analysis of your work patterns.</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6 relative">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <p className="text-sm leading-relaxed">
                  "You're 15% more productive in the mornings. Consider tackling complex coding tasks before 11 AM to maximize efficiency."
                </p>
              </div>
            </div>
          </Card>

          <Card className="border-none shadow-sm">
             <CardHeader className="pb-2">
               <CardTitle className="text-sm font-bold text-gray-500 uppercase tracking-widest">Team Availability</CardTitle>
             </CardHeader>
             <CardContent className="space-y-3">
                {[
                  { name: 'Alex Johnson', status: 'In Meeting', color: 'bg-orange-400' },
                  { name: 'Sarah Chen', status: 'Deep Work', color: 'bg-indigo-600' },
                  { name: 'Mike Ross', status: 'Available', color: 'bg-green-500' }
                ].map(member => (
                  <div key={member.name} className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: member.color === 'bg-green-500' ? '#22c55e' : member.color === 'bg-orange-400' ? '#fb923c' : '#4f46e5' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.status}</p>
                    </div>
                  </div>
                ))}
             </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-gray-50 border border-gray-100">
            <CardContent className="p-4">
               <div className="flex items-start gap-3">
                 <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                   <Briefcase className="h-4 w-4 text-blue-600" />
                 </div>
                 <div>
                   <h4 className="text-sm font-bold text-gray-900">Need help with capacity?</h4>
                   <p className="text-xs text-gray-500 mt-1">Talk to your project lead about workload adjustments.</p>
                   <Button variant="link" className="p-0 h-auto text-xs text-blue-600 mt-2">Open Resource Manager</Button>
                 </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
